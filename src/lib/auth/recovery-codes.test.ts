import { describe, it, expect } from 'vitest';
import {
  formatRecoveryCodesAsText,
  extractRecoveryCodesFromText,
  isValidRecoveryCodeFormat,
  RECOVERY_CODE_REGEX,
} from './recovery-codes';

describe('formatRecoveryCodesAsText', () => {
  const SAMPLE = ['ABCD-EFGH', 'JKMN-PQRS', '2345-6789'];
  const FIXED_DATE = new Date('2026-05-18T12:00:00.000Z');

  it('üretir header + email + tarih + numaralı kod listesi', () => {
    const out = formatRecoveryCodesAsText(SAMPLE, {
      email: 'oguz@petshop.test',
      generatedAt: FIXED_DATE,
    });
    expect(out).toContain('PetStockPro — Yedek Kodlar');
    expect(out).toContain('Hesap: oguz@petshop.test');
    expect(out).toContain('Üretim: 2026-05-18T12:00:00.000Z');
    expect(out).toContain(' 1. ABCD-EFGH');
    expect(out).toContain(' 2. JKMN-PQRS');
    expect(out).toContain(' 3. 2345-6789');
    expect(out).toContain('Her kod tek kullanımlık');
  });

  it('email opsiyonel — yoksa Hesap satırı yok', () => {
    const out = formatRecoveryCodesAsText(SAMPLE, { generatedAt: FIXED_DATE });
    expect(out).not.toContain('Hesap:');
    expect(out).toContain(' 1. ABCD-EFGH');
  });

  it('boş code listesi için sadece header üretir', () => {
    const out = formatRecoveryCodesAsText([], { generatedAt: FIXED_DATE });
    expect(out).toContain('PetStockPro — Yedek Kodlar');
    expect(out).not.toMatch(/^\s*\d+\./m);
  });

  it('default tarih: opts.generatedAt undefined → now ISO', () => {
    const out = formatRecoveryCodesAsText(SAMPLE);
    expect(out).toMatch(/Üretim: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('extractRecoveryCodesFromText', () => {
  it('TXT içinden 8 kodu çıkarır (header + numaralı liste)', () => {
    const txt = `PetStockPro — Yedek Kodlar
Hesap: test@example.com
Üretim: 2026-05-18T12:00:00.000Z

 1. ABCD-EFGH
 2. JKMN-PQRS
 3. 2345-6789
 4. KLMN-PQRS
 5. STUV-WXYZ
 6. 2233-4455
 7. ABCD-2345
 8. WXYZ-6789
`;
    const codes = extractRecoveryCodesFromText(txt);
    expect(codes).toEqual([
      'ABCD-EFGH',
      'JKMN-PQRS',
      '2345-6789',
      'KLMN-PQRS',
      'STUV-WXYZ',
      '2233-4455',
      'ABCD-2345',
      'WXYZ-6789',
    ]);
  });

  it('küçük harfleri büyütür', () => {
    expect(extractRecoveryCodesFromText('abcd-efgh')).toEqual(['ABCD-EFGH']);
  });

  it('duplikatları dedupe eder (ilk gelen kalır)', () => {
    expect(extractRecoveryCodesFromText('ABCD-EFGH ABCD-EFGH JKMN-PQRS')).toEqual([
      'ABCD-EFGH',
      'JKMN-PQRS',
    ]);
  });

  it('I/O/0/1 içerenleri yok sayar (alfabe dışı)', () => {
    expect(extractRecoveryCodesFromText('AIOI-1234 ABCD-EFGH O000-1111')).toEqual([
      'ABCD-EFGH',
    ]);
  });

  it('boş veya null girdi için boş dizi döner', () => {
    expect(extractRecoveryCodesFromText('')).toEqual([]);
    expect(extractRecoveryCodesFromText(null as unknown as string)).toEqual([]);
    expect(extractRecoveryCodesFromText(undefined as unknown as string)).toEqual([]);
  });

  it('format dışı içeriği sessizce atlar', () => {
    const txt = 'Lorem ipsum dolor\nSadece bu kod geçerli: GHJK-MNPQ\nEnd';
    expect(extractRecoveryCodesFromText(txt)).toEqual(['GHJK-MNPQ']);
  });

  it('uzun blok içinde tüm kodları bulur', () => {
    const txt = 'ABCD-EFGH JKMN-PQRS STUV-WXYZ randomtext 2345-6789'.repeat(2);
    const out = extractRecoveryCodesFromText(txt);
    expect(out).toContain('ABCD-EFGH');
    expect(out).toContain('JKMN-PQRS');
    expect(out).toContain('STUV-WXYZ');
    expect(out).toContain('2345-6789');
    expect(out).toHaveLength(4);
  });
});

describe('isValidRecoveryCodeFormat', () => {
  it.each(['ABCD-EFGH', 'JKMN-PQRS', '2345-6789', 'A2B3-C4D5'])('valid: %s', (code) => {
    expect(isValidRecoveryCodeFormat(code)).toBe(true);
  });

  it('küçük harf de geçerli (büyütülerek kontrol)', () => {
    expect(isValidRecoveryCodeFormat('abcd-efgh')).toBe(true);
  });

  it.each([
    '',
    'ABCD',
    'ABCDEFGH',
    'AIOI-1234', // I/O alfabe dışı
    'ABC-DEFGH', // 3-5 dağılım
    'ABCD-EFG', // 7 karakter
    'ABCD_EFGH', // underscore
  ])('invalid: %s', (code) => {
    expect(isValidRecoveryCodeFormat(code)).toBe(false);
  });

  it('null/undefined girdi → false', () => {
    expect(isValidRecoveryCodeFormat(null as unknown as string)).toBe(false);
    expect(isValidRecoveryCodeFormat(undefined as unknown as string)).toBe(false);
  });
});

describe('RECOVERY_CODE_REGEX', () => {
  it('global flag aktif (multiple match için)', () => {
    expect(RECOVERY_CODE_REGEX.global).toBe(true);
  });
});
