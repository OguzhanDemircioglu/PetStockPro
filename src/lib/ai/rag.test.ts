import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildSystemPrompt,
  retrieveChunks,
  askWithContext,
  stripUrlPaths,
  DEFAULT_TOP_K,
  LOW_CONFIDENCE_THRESHOLD,
  type RetrievedChunk,
} from './rag';

vi.mock('./cf-client', () => ({
  embedSingle: vi.fn(),
  queryVectorize: vi.fn(),
  chatComplete: vi.fn(),
  TEXT_MODEL: '@cf/meta/llama-3.1-8b-instruct',
  EMBEDDING_MODEL: '@cf/baai/bge-m3',
}));

import { embedSingle, queryVectorize, chatComplete } from './cf-client';

const mockChunk = (overrides: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
  id: 'c-001',
  score: 0.7,
  breadcrumb: 'Ürünler > Yeni ürün ekleme',
  title: 'Yeni ürün ekleme',
  section: 'Ürünler',
  content: 'Ürün ekleme detayları...',
  sourceStartLine: 100,
  sourceEndLine: 150,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildSystemPrompt', () => {
  it('TR talimat + KAYNAKLAR bölümü içerir', () => {
    const prompt = buildSystemPrompt([
      mockChunk({ breadcrumb: 'A > B', content: 'içerik 1' }),
      mockChunk({ id: 'c-002', breadcrumb: 'X > Y', content: 'içerik 2' }),
    ]);
    expect(prompt).toMatch(/Türkçe|TÜRKÇE/);
    expect(prompt).toContain('KAYNAKLAR:');
    expect(prompt).toContain('KAYNAK 1');
    expect(prompt).toContain('A > B');
    expect(prompt).toContain('içerik 1');
    expect(prompt).toContain('KAYNAK 2');
    expect(prompt).toContain('X > Y');
    expect(prompt).toContain('içerik 2');
  });

  it('boş chunk listesi → KAYNAKLAR bölümü boş', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain('KAYNAKLAR:');
    expect(prompt).not.toContain('KAYNAK 1');
  });

  it('kapsam dışı / yetersiz bilgi durumunda destek emailini telkin eder', () => {
    const prompt = buildSystemPrompt([mockChunk()]);
    expect(prompt).toContain('destek@petstockpro.com');
    expect(prompt).toMatch(/yeterince |yeterli bilgi bulamadım/);
  });

  it('uydurma yapmama talimatı içerir', () => {
    expect(buildSystemPrompt([mockChunk()])).toMatch(/uydurma|asla/);
  });

  it('halüsinasyon koruma + süperadmin/yetki yönergesi içerir', () => {
    const prompt = buildSystemPrompt([mockChunk()]);
    expect(prompt).toMatch(/Halüsinasyon|halüsinasyon/);
    expect(prompt).toMatch(/süperadmin|yönetici/);
    expect(prompt).toContain('destek@petstockpro.com');
  });

  it('sidebar navigasyon yönergesi içerir (URL yerine sol menü)', () => {
    const prompt = buildSystemPrompt([mockChunk()]);
    expect(prompt).toMatch(/Sol menü|sidebar|Navigasyon/);
  });
});

describe('stripUrlPaths', () => {
  it('parantez içinde URL → silinir', () => {
    expect(stripUrlPaths('Ürünler sayfasına git (/admin/products) ve aç')).toBe(
      'Ürünler sayfasına git ve aç',
    );
  });

  it('düz "/admin/x sayfasına git" → URL silinir', () => {
    expect(stripUrlPaths('/admin/products/import sayfasına git ve dene')).toBe(
      'sayfasına git ve dene',
    );
  });

  it('cümle ortasında URL: punctuation sonra → silinir', () => {
    expect(stripUrlPaths('Önce /admin/security sayfasına gir, 2FA aktive et')).toBe(
      'Önce sayfasına gir, 2FA aktive et',
    );
  });

  it('"URL: /admin/x" prefix → silinir', () => {
    expect(stripUrlPaths('URL: /admin/products — buradan başla')).toBe(
      '— buradan başla',
    );
  });

  it('URL yoksa cevap olduğu gibi kalır', () => {
    expect(stripUrlPaths("Sol menüden 🛍 Ürünler'e git.")).toBe(
      "Sol menüden 🛍 Ürünler'e git.",
    );
  });

  it('Markdown URL (linkler) — bizim case değil ama bozulmasın', () => {
    // Markdown link içindeki path bozulabilir ama AI cevaplarda link az.
    // Şu an: parantez içindeki path silindiği için "[text](/x)" bozulabilir.
    // Test edip davranışı dokümante et:
    const out = stripUrlPaths('[Ürünler](/admin/products) sayfasına git');
    // (parantez içinde /admin/products → silinir, [Ürünler] kalır)
    expect(out).toBe('[Ürünler] sayfasına git');
  });
});

describe('retrieveChunks', () => {
  it('query → embed → vectorize, top-K döner', async () => {
    vi.mocked(embedSingle).mockResolvedValueOnce([0.1, 0.2, 0.3]);
    vi.mocked(queryVectorize).mockResolvedValueOnce({
      matches: [
        {
          id: 'c-001',
          score: 0.85,
          metadata: {
            breadcrumb: 'A > B',
            title: 'B',
            section: 'A',
            content: 'içerik',
            sourceStartLine: 10,
            sourceEndLine: 20,
          },
        },
      ],
      count: 1,
    });
    const chunks = await retrieveChunks('idx', 'soru');
    expect(embedSingle).toHaveBeenCalledWith('soru');
    expect(queryVectorize).toHaveBeenCalledWith('idx', [0.1, 0.2, 0.3], DEFAULT_TOP_K, 'all');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].breadcrumb).toBe('A > B');
    expect(chunks[0].score).toBe(0.85);
  });

  it('topK özelleştirilebilir', async () => {
    vi.mocked(embedSingle).mockResolvedValueOnce([0]);
    vi.mocked(queryVectorize).mockResolvedValueOnce({ matches: [], count: 0 });
    await retrieveChunks('idx', 'x', 10);
    expect(queryVectorize).toHaveBeenCalledWith('idx', [0], 10, 'all');
  });

  it('metadata eksik → default değer (?, 0)', async () => {
    vi.mocked(embedSingle).mockResolvedValueOnce([0]);
    vi.mocked(queryVectorize).mockResolvedValueOnce({
      matches: [{ id: 'c-x', score: 0.5, metadata: {} }],
      count: 1,
    });
    const chunks = await retrieveChunks('idx', 'x');
    expect(chunks[0].breadcrumb).toBe('?');
    expect(chunks[0].sourceStartLine).toBe(0);
  });
});

describe('askWithContext', () => {
  it('happy path: retrieve + LLM çağrısı + answer döner', async () => {
    vi.mocked(embedSingle).mockResolvedValueOnce([0]);
    vi.mocked(queryVectorize).mockResolvedValueOnce({
      matches: [
        {
          id: 'c-001',
          score: 0.7,
          metadata: {
            breadcrumb: 'A > B',
            title: 'B',
            section: 'A',
            content: 'içerik',
          },
        },
      ],
      count: 1,
    });
    vi.mocked(chatComplete).mockResolvedValueOnce({
      response: '  Vitrin\'e ürün eklemek için ...  ',
      usage: { prompt_tokens: 250, completion_tokens: 80, total_tokens: 330 },
    });
    const res = await askWithContext('idx', 'Vitrin\'e ürün nasıl eklerim?');
    expect(res.answer).toBe("Vitrin'e ürün eklemek için ...");
    expect(res.retrievedChunks).toHaveLength(1);
    expect(res.inputTokens).toBe(250);
    expect(res.outputTokens).toBe(80);
    expect(res.lowConfidence).toBe(false);
    expect(res.modelUsed).toBe('@cf/meta/llama-3.1-8b-instruct');
  });

  it('top score < threshold → lowConfidence true', async () => {
    vi.mocked(embedSingle).mockResolvedValueOnce([0]);
    vi.mocked(queryVectorize).mockResolvedValueOnce({
      matches: [
        {
          id: 'c-x',
          score: LOW_CONFIDENCE_THRESHOLD - 0.05,
          metadata: { breadcrumb: 'X', title: 'X', section: 'X', content: 'x' },
        },
      ],
      count: 1,
    });
    vi.mocked(chatComplete).mockResolvedValueOnce({ response: 'bilgim yok' });
    const res = await askWithContext('idx', 'kapsam dışı soru');
    expect(res.lowConfidence).toBe(true);
  });

  it('hiç chunk yok → lowConfidence true', async () => {
    vi.mocked(embedSingle).mockResolvedValueOnce([0]);
    vi.mocked(queryVectorize).mockResolvedValueOnce({ matches: [], count: 0 });
    vi.mocked(chatComplete).mockResolvedValueOnce({ response: 'bilgim yok' });
    const res = await askWithContext('idx', 'çok ezoterik soru');
    expect(res.lowConfidence).toBe(true);
    expect(res.retrievedChunks).toHaveLength(0);
  });

  it('LLM messages: system + user 2 mesaj', async () => {
    vi.mocked(embedSingle).mockResolvedValueOnce([0]);
    vi.mocked(queryVectorize).mockResolvedValueOnce({ matches: [], count: 0 });
    vi.mocked(chatComplete).mockResolvedValueOnce({ response: 'x' });
    await askWithContext('idx', 'soru');
    const [msgs, opts] = vi.mocked(chatComplete).mock.calls[0];
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1]).toEqual({ role: 'user', content: 'soru' });
    expect(opts?.temperature).toBe(0.2);
    expect(opts?.maxTokens).toBe(512);
  });

  it('opts override aktarılır', async () => {
    vi.mocked(embedSingle).mockResolvedValueOnce([0]);
    vi.mocked(queryVectorize).mockResolvedValueOnce({ matches: [], count: 0 });
    vi.mocked(chatComplete).mockResolvedValueOnce({ response: 'x' });
    await askWithContext('idx', 'q', { topK: 3, maxOutputTokens: 100, temperature: 0 });
    expect(queryVectorize).toHaveBeenCalledWith('idx', [0], 3, 'all');
    const opts = vi.mocked(chatComplete).mock.calls[0][1];
    expect(opts?.maxTokens).toBe(100);
    expect(opts?.temperature).toBe(0);
  });
});
