import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  parseHeadersSkippingCodeBlocks,
  paragraphSplit,
  packParagraphs,
  splitChunks,
  MAX_CHUNK_TOKENS,
  TR_CHARS_PER_TOKEN,
  TARGET_CHUNK_TOKENS,
} from './chunk';

describe('estimateTokens', () => {
  it('boş string → 0', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('TR text → ~length/3.5 token', () => {
    const t = 'Pet shop sahipleri için stok takip uygulaması';
    expect(estimateTokens(t)).toBe(Math.round(t.length / TR_CHARS_PER_TOKEN));
  });

  it('1 karakter → min 1 token', () => {
    expect(estimateTokens('a')).toBe(1);
  });
});

describe('parseHeadersSkippingCodeBlocks', () => {
  it('H1-H4 başlıkları algılar', () => {
    const lines = [
      '# Ana başlık',
      '',
      '## H2 başlık',
      '',
      '### H3 başlık',
      '',
      '#### H4 başlık',
      '',
      '##### H5 yoksay',
    ];
    const hs = parseHeadersSkippingCodeBlocks(lines);
    expect(hs.map((h) => `${h.level}:${h.title}`)).toEqual([
      '1:Ana başlık',
      '2:H2 başlık',
      '3:H3 başlık',
      '4:H4 başlık',
    ]);
  });

  it('code block içindeki # satırlarını yok sayar', () => {
    const lines = [
      '## Gerçek başlık',
      '',
      '```',
      '# Bu bash yorum',
      '## Bu da kod',
      '```',
      '',
      '### Sonraki başlık',
    ];
    const hs = parseHeadersSkippingCodeBlocks(lines);
    expect(hs).toHaveLength(2);
    expect(hs[0].title).toBe('Gerçek başlık');
    expect(hs[1].title).toBe('Sonraki başlık');
  });

  it('lineIndex 0-indexed döner', () => {
    const lines = ['', '', '## İkinci satır', '## Üçüncü değil'];
    const hs = parseHeadersSkippingCodeBlocks(lines);
    expect(hs[0].lineIndex).toBe(2);
    expect(hs[1].lineIndex).toBe(3);
  });

  it("başlık olmayan satırı reddeder ('#' içerse de)", () => {
    const lines = [
      'Bu # ortada',
      '#başlıksız',
      ' ## girintili',
      '## düzgün',
    ];
    const hs = parseHeadersSkippingCodeBlocks(lines);
    expect(hs).toHaveLength(1);
    expect(hs[0].title).toBe('düzgün');
  });
});

describe('paragraphSplit', () => {
  it('boş satırla ayırır', () => {
    const t = 'birinci paragraf\n\nikinci paragraf\n\nüçüncü';
    expect(paragraphSplit(t)).toEqual(['birinci paragraf', 'ikinci paragraf', 'üçüncü']);
  });

  it('çok boş satırla da çalışır', () => {
    const t = 'a\n\n\n\nb';
    expect(paragraphSplit(t)).toEqual(['a', 'b']);
  });

  it('tek paragraf → tek eleman', () => {
    expect(paragraphSplit('tek satır')).toEqual(['tek satır']);
  });

  it('whitespace-only paragraflar atılır', () => {
    expect(paragraphSplit('a\n\n  \n\nb')).toEqual(['a', 'b']);
  });
});

describe('packParagraphs', () => {
  it('boş listede boş döner', () => {
    expect(packParagraphs([])).toEqual([]);
  });

  it('tek paragraf tek chunk olur', () => {
    expect(packParagraphs(['kısa'])).toEqual(['kısa']);
  });

  it('target altında paragrafları birleştirir', () => {
    // 100 token civarı 3 paragraf — target 500, max 800
    const p = 'x'.repeat(100); // ~29 token
    const result = packParagraphs([p, p, p], 200, 500);
    expect(result).toHaveLength(1);
    expect(result[0].split('\n\n')).toHaveLength(3);
  });

  it('target aşınca yeni chunk başlatır', () => {
    const p = 'x'.repeat(700); // ~200 token
    const result = packParagraphs([p, p, p, p], 300, 800);
    // 200 token / chunk, target 300, max 800
    // [p] -> 200, [p,p] -> 400 (target aştı, flush), -> [p,p] sonra [p]
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('max aşılırsa zorla flush', () => {
    const small = 'x'.repeat(100); // ~29 token
    const huge = 'x'.repeat(5000); // ~1429 token — tek başına MAX'tan büyük
    const result = packParagraphs([small, huge, small], 500, 800);
    // small + huge = 1458 token > 800 → small flush, huge tek başına geçer (yasal istisna), small ayrı
    expect(result).toEqual([small, huge, small]);
  });

  it('paragraf sırasını korur', () => {
    const result = packParagraphs(['1', '2', '3']);
    const flat = result.join('\n\n');
    expect(flat).toBe('1\n\n2\n\n3');
  });
});

describe('splitChunks (entegrasyon)', () => {
  it('boş input → boş chunk', () => {
    expect(splitChunks([])).toEqual([]);
  });

  it('H1 ve İçindekiler atlanır', () => {
    const md = [
      '# PetStockPro Kılavuzu',
      '',
      '## İçindekiler',
      '',
      '1. Bölüm A',
      '2. Bölüm B',
      '',
      '## 1. Bölüm A',
      '',
      'İçerik A.',
    ];
    const chunks = splitChunks(md);
    expect(chunks.find((c) => c.title.includes('İçindekiler'))).toBeUndefined();
    expect(chunks.find((c) => c.section === '1. Bölüm A')).toBeDefined();
  });

  it('H2 + H3 children → H2 intro chunk + her H3 ayrı chunk', () => {
    const md = [
      '## 2. Ürünler',
      '',
      "Ürünler stok takibinin kalbidir. Burada parent ürünleri ve variant'larını yönetirsin.",
      'İkinci giriş satırı, biraz daha fazla içerik yeterli olsun ki MIN_CHUNK_TOKENS aşılsın.',
      '',
      '### 2.1 Liste',
      '',
      'Liste sayfası tüm ürünleri gösterir, filtre ve sıralama desteği vardır.',
      '',
      '### 2.2 Detay',
      '',
      'Detay sayfası variant\'ları ve geçmişi gösterir.',
    ];
    const chunks = splitChunks(md);
    const titles = chunks.map((c) => c.title);
    expect(titles).toContain('2. Ürünler (giriş)');
    expect(titles).toContain('2.1 Liste');
    expect(titles).toContain('2.2 Detay');
  });

  it("H2'nin H3 children yoksa tek chunk olur", () => {
    const md = [
      '## Tek Bölüm',
      '',
      'Bu bölümün alt-başlığı yok, tek atom olarak emit edilmeli.',
    ];
    const chunks = splitChunks(md);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].title).toBe('Tek Bölüm');
    expect(chunks[0].section).toBe('Tek Bölüm');
    expect(chunks[0].breadcrumb).toBe('Tek Bölüm');
  });

  it('H3 atom H4 children içerir (sub-split tetiklenmediği sürece)', () => {
    const md = [
      '## Bölüm',
      '',
      '### Alt-bölüm',
      '',
      "Alt-bölümün girişi.",
      '',
      '#### Madde A',
      '',
      'Madde A açıklaması.',
      '',
      '#### Madde B',
      '',
      'Madde B açıklaması.',
    ];
    const chunks = splitChunks(md);
    const sub = chunks.find((c) => c.title === 'Alt-bölüm');
    expect(sub).toBeDefined();
    expect(sub!.content).toContain('Madde A');
    expect(sub!.content).toContain('Madde B');
    // Her H4 için ayrı chunk üretilmemiş (çünkü H3 atom MAX'ı aşmıyor)
    expect(chunks.find((c) => c.title === 'Madde A')).toBeUndefined();
  });

  it('büyük H3 (MAX aşan) H4 ile alt-bölünür', () => {
    // ~3000 char H4 paragraf = ~857 token — tek H4 MAX'ın üzerinde
    const huge = 'x'.repeat(3000);
    const md = [
      '## Bölüm',
      '',
      '### Büyük alt-bölüm',
      '',
      '#### Madde A',
      '',
      huge,
      '',
      '#### Madde B',
      '',
      huge,
    ];
    const chunks = splitChunks(md);
    expect(chunks.find((c) => c.title === 'Madde A' || c.title.startsWith('Madde A'))).toBeDefined();
    expect(chunks.find((c) => c.title === 'Madde B' || c.title.startsWith('Madde B'))).toBeDefined();
  });

  it('chunk id sırayla artar ve unique', () => {
    const md = [
      '## A',
      '',
      'Aaaaa.',
      '',
      '## B',
      '',
      'Bbbbb.',
    ];
    const chunks = splitChunks(md);
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('c-001');
  });

  it('her chunk için content non-empty + charCount/tokenEstimate doğru', () => {
    const md = ['## Test', '', 'Bir paragraf burada yeterince uzun olsun.'];
    const chunks = splitChunks(md);
    for (const c of chunks) {
      expect(c.content.trim().length).toBeGreaterThan(0);
      expect(c.charCount).toBe(c.content.length);
      expect(c.tokenEstimate).toBeGreaterThan(0);
      expect(c.sourceStartLine).toBeGreaterThanOrEqual(1);
      expect(c.sourceEndLine).toBeGreaterThanOrEqual(c.sourceStartLine);
    }
  });

  it('makul paragraf boyutlarında hiçbir chunk MAX_CHUNK_TOKENS aşmamalı', () => {
    // Gerçek user manual'da tek paragraf nadiren 500 token aşar (~1750 char).
    // Burada 5 orta-paragraflık H3 (~2500 token toplam) — packParagraphs MAX altı kalmalı.
    const p = 'Bu orta uzunlukta bir paragraftır. '.repeat(50); // ~500 token
    const md = [
      '## Bölüm',
      '',
      '### Alt 1',
      '',
      p,
      '',
      p,
      '',
      p,
      '',
      p,
      '',
      p,
    ];
    const chunks = splitChunks(md);
    expect(chunks.length).toBeGreaterThan(1); // alt-bölündü
    for (const c of chunks) {
      expect(c.tokenEstimate).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);
    }
  });

  it('tek paragraf MAX aşıyorsa yasal istisna kabul edilir (packParagraphs davranışı)', () => {
    // Edge case: gerçek dosyada olmaz ama doğru davranış: cümle-bazlı sub-split yok, tek paragraf
    // kendi başına emit edilir (boyut > MAX). RAG için zayıf chunk ama hata vermez.
    const huge = 'x'.repeat(5000); // ~1429 token
    const chunks = splitChunks(['## B', '', '### A', '', huge]);
    expect(chunks.length).toBeGreaterThan(0);
    // En az 1 chunk MAX aşar (yasal) — invariant: tüm chunk'lar emit edilmiş
    expect(chunks.some((c) => c.tokenEstimate > MAX_CHUNK_TOKENS)).toBe(true);
  });

  it('breadcrumb H2 > H3 formatında doğru', () => {
    const md = [
      '## Ürünler',
      '',
      '### Yeni ürün ekleme',
      '',
      'İçerik.',
    ];
    const chunks = splitChunks(md);
    const c = chunks.find((x) => x.title === 'Yeni ürün ekleme');
    expect(c?.breadcrumb).toBe('Ürünler > Yeni ürün ekleme');
    expect(c?.section).toBe('Ürünler');
  });

  it('TARGET_CHUNK_TOKENS sabit MAX_CHUNK_TOKENS altında', () => {
    // Sanity check
    expect(TARGET_CHUNK_TOKENS).toBeLessThan(MAX_CHUNK_TOKENS);
  });
});
