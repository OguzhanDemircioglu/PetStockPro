import { describe, it, expect } from 'vitest';
import { checkBlacklist, normalizeText, getBlacklistSize } from './blacklist';

describe('normalizeText', () => {
  it('boş/null/undefined → ""', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText(null as unknown as string)).toBe('');
    expect(normalizeText(undefined as unknown as string)).toBe('');
  });

  it('TR karakterleri ASCII-eşdeğerine çevirir', () => {
    expect(normalizeText('Şişko')).toBe('sisko');
    expect(normalizeText('öğürmek')).toBe('ogurmek');
    expect(normalizeText('İŞTE')).toBe('iste');
  });

  it('leetspeak çevirir', () => {
    expect(normalizeText('S1K')).toBe('sik');
    expect(normalizeText('@m@')).toBe('ama');
    expect(normalizeText('0r05pu')).toBe('orospu');
  });

  it('word-içi noktalama/boşluk bitişikleştirir', () => {
    expect(normalizeText('s.i.k')).toBe('sik');
    expect(normalizeText('a m k')).toBe('amk');
    expect(normalizeText('o-r-o-s-p-u')).toBe('orospu');
    expect(normalizeText('s*i*k')).toBe('sik');
  });

  it('tekrarlayan harfleri 2\'ye indirir', () => {
    expect(normalizeText('amkkkkk')).toBe('amkk');
    expect(normalizeText('siiiiiiik')).toBe('siik');
  });

  it('Türkçe küçük harf locale çevirir (İ → i)', () => {
    expect(normalizeText('İŞTANBUL')).toBe('istanbul');
  });
});

describe('checkBlacklist', () => {
  it('temiz metin → flagged=false', () => {
    expect(checkBlacklist('Royal Canin Adult Kedi Maması')).toEqual({
      flagged: false,
      matches: [],
    });
    expect(checkBlacklist('Pet shop')).toEqual({ flagged: false, matches: [] });
  });

  it('boş/null/undefined → flagged=false', () => {
    expect(checkBlacklist('').flagged).toBe(false);
    expect(checkBlacklist(null).flagged).toBe(false);
    expect(checkBlacklist(undefined).flagged).toBe(false);
  });

  it('açık küfür → profanity match', () => {
    const r = checkBlacklist('sana amk diyorum');
    expect(r.flagged).toBe(true);
    expect(r.matches.find((m) => m.term === 'amk')?.category).toBe('profanity');
  });

  it('TR karakter küfür → profanity match', () => {
    const r = checkBlacklist('Şikim be');
    expect(r.flagged).toBe(true);
    expect(r.matches.find((m) => m.term === 'sikim')).toBeTruthy();
  });

  it('leetspeak ile gizlenmiş → match', () => {
    expect(checkBlacklist('5ik').flagged).toBe(true);
    expect(checkBlacklist('s1k').flagged).toBe(true);
    expect(checkBlacklist('@minak0yim').flagged).toBe(true);
  });

  it('noktalama gizlemesi → match', () => {
    expect(checkBlacklist('s.i.k yan be').flagged).toBe(true);
    expect(checkBlacklist('a-m-k').flagged).toBe(true);
  });

  it('insult kategorisi', () => {
    const r = checkBlacklist('orospu çocuğusun');
    expect(r.matches.find((m) => m.category === 'insult')).toBeTruthy();
  });

  it('sexual kategorisi', () => {
    const r = checkBlacklist('Porno satıyorum');
    expect(r.matches.find((m) => m.category === 'sexual')).toBeTruthy();
  });

  it('İngilizce küfür → match', () => {
    expect(checkBlacklist('fuck this').flagged).toBe(true);
    expect(checkBlacklist('what a bitch').flagged).toBe(true);
  });

  it('false positive: normal kelimede yok', () => {
    expect(checkBlacklist('Pet shop için kedi maması').flagged).toBe(false);
    expect(checkBlacklist('Akvaryum balığı').flagged).toBe(false);
    expect(checkBlacklist('köpek tasması').flagged).toBe(false);
  });

  it('aynı kelime tekrar → dedupe', () => {
    const r = checkBlacklist('sik sik sik');
    expect(r.matches.filter((m) => m.term === 'sik')).toHaveLength(1);
  });

  it('birden çok terim → çoklu match', () => {
    const r = checkBlacklist('sikim orospu fuck');
    expect(r.matches.length).toBeGreaterThanOrEqual(3);
  });

  it('word-boundary: kelime parçası match etmez (kasıtlı isabetler kaldıkça OK)', () => {
    // "sik" yasaklı ama "sikinti" → "sik" başlangıç olarak match etmemeli
    // (^ veya non-letter ile başlamalı + non-letter veya $ ile bitmeli)
    // Burada `sik` `sikinti` içinde "non-letter sonrası başlamıyor" → false
    expect(checkBlacklist('sikinti').flagged).toBe(false);
  });
});

describe('getBlacklistSize', () => {
  it('en az 30 kelime tanımlı', () => {
    expect(getBlacklistSize()).toBeGreaterThanOrEqual(30);
  });
});
