import { describe, it, expect, vi } from 'vitest';
import { moderateText, moderateFields } from './check';

const NO_OP_FETCH = vi.fn().mockResolvedValue(new Response('not used', { status: 500 }));

describe('moderateText', () => {
  it('boş/null input → flagged=false', async () => {
    const r = await moderateText('', { skipOpenAI: true });
    expect(r).toEqual({ flagged: false, reasons: [], field: undefined, openaiSkipped: undefined });

    const r2 = await moderateText(null, { skipOpenAI: true });
    expect(r2.flagged).toBe(false);
  });

  it('temiz metin → flagged=false', async () => {
    const r = await moderateText('Royal Canin Adult Kedi Maması', { skipOpenAI: true });
    expect(r.flagged).toBe(false);
    expect(r.reasons).toEqual([]);
  });

  it('blacklist match → flagged=true + source=blacklist', async () => {
    const r = await moderateText('amk be ya', { skipOpenAI: true });
    expect(r.flagged).toBe(true);
    expect(r.reasons[0].source).toBe('blacklist');
    expect(r.reasons[0].category).toBe('profanity');
    expect(r.reasons[0].term).toBe('amk');
  });

  it('field label döner', async () => {
    const r = await moderateText('sik', { skipOpenAI: true, field: 'Ürün adı' });
    expect(r.field).toBe('Ürün adı');
  });

  it('skipOpenAI=false + no API key → openaiSkipped=no_api_key', async () => {
    // Test env'de OPENAI_API_KEY yok ya da boş
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const r = await moderateText('temiz metin', { skipOpenAI: false });
    expect(r.openaiSkipped).toBe('no_api_key');
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  });

  it('OpenAI mock flagged → reason eklenir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              flagged: true,
              categories: { harassment: true, hate: false },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const r = await moderateText('hostile text', {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    // API key inject yoksa skip — env'e koy
    if (r.openaiSkipped === 'no_api_key') {
      process.env.OPENAI_API_KEY = 'sk-test';
      const r2 = await moderateText('hostile text', {
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      delete process.env.OPENAI_API_KEY;
      expect(r2.flagged).toBe(true);
      const openaiReason = r2.reasons.find((x) => x.source === 'openai');
      expect(openaiReason).toBeTruthy();
      expect(openaiReason!.category).toBe('harassment');
    } else {
      expect(r.flagged).toBe(true);
    }
  });

  it('OpenAI fetch fail → fail-open (sessiz geç)', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    const r = await moderateText('clean text', {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    delete process.env.OPENAI_API_KEY;
    expect(r.flagged).toBe(false);
    expect(r.openaiSkipped).toBe('http_error');
  });
});

describe('moderateFields', () => {
  it('boş alanlar → flagged=false', async () => {
    const r = await moderateFields({ 'Ürün adı': '', 'Açıklama': null }, { skipOpenAI: true });
    expect(r.flagged).toBe(false);
    expect(r.fieldsFlagged).toEqual([]);
  });

  it('bir alan flagged → fieldsFlagged listede', async () => {
    const r = await moderateFields(
      {
        'Ürün adı': 'temiz',
        'Açıklama': 'sik be',
      },
      { skipOpenAI: true },
    );
    expect(r.flagged).toBe(true);
    expect(r.fieldsFlagged).toEqual(['Açıklama']);
  });

  it('çoklu alan flagged → hepsi listede', async () => {
    const r = await moderateFields(
      {
        Ad: 'amk',
        Aciklama: 'orospu',
        Temiz: 'pet maması',
      },
      { skipOpenAI: true },
    );
    expect(r.flagged).toBe(true);
    expect(r.fieldsFlagged.sort()).toEqual(['Aciklama', 'Ad']);
  });

  it('tüm alan temiz → flagged=false', async () => {
    const r = await moderateFields(
      {
        Ad: 'Royal Canin',
        Aciklama: 'En kaliteli kedi maması',
      },
      { skipOpenAI: true },
    );
    expect(r.flagged).toBe(false);
  });
});
