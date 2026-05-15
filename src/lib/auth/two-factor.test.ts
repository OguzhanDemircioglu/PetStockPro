import { describe, it, expect } from 'vitest';
import {
  generateTotpSecret,
  buildOtpAuthUri,
  verifyTotp,
  generateTotpCode,
  hashRecoveryCode,
  generateRecoveryCodes,
  verifyRecoveryCode,
  RECOVERY_CODE_COUNT,
} from './two-factor';

describe('generateTotpSecret', () => {
  it('base32 secret üretir (~32 karakter)', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/); // RFC 4648 base32
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it('her çağrı farklı secret üretir', () => {
    const s1 = generateTotpSecret();
    const s2 = generateTotpSecret();
    expect(s1).not.toBe(s2);
  });
});

describe('buildOtpAuthUri', () => {
  const secret = 'JBSWY3DPEHPK3PXP'; // test fixture

  it('otpauth:// protokolü ile başlar', () => {
    const uri = buildOtpAuthUri('test@petshop.com', secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
  });

  it('issuer + email + secret içerir', () => {
    const uri = buildOtpAuthUri('test@petshop.com', secret);
    expect(uri).toContain('PetStockPro');
    expect(uri).toContain('test%40petshop.com'); // URL-encoded @
    expect(uri).toContain(`secret=${secret}`);
  });

  it('algorithm SHA1 + digits 6 + period 30', () => {
    const uri = buildOtpAuthUri('user@example.com', secret);
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});

describe('verifyTotp', () => {
  const secret = generateTotpSecret();

  it('current TOTP kodu doğru', () => {
    const code = generateTotpCode(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('current code boşluklu girilse de doğru', () => {
    const code = generateTotpCode(secret);
    // Bazı authenticator'lar "123 456" gibi gösterir
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(verifyTotp(secret, spaced)).toBe(true);
  });

  it('6 hane değil → reject (5 hane)', () => {
    expect(verifyTotp(secret, '12345')).toBe(false);
  });

  it('6 hane değil → reject (7 hane)', () => {
    expect(verifyTotp(secret, '1234567')).toBe(false);
  });

  it('harf içeriyor → reject', () => {
    expect(verifyTotp(secret, '12345A')).toBe(false);
  });

  it('boş kod → reject', () => {
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('boş secret → reject', () => {
    expect(verifyTotp('', '123456')).toBe(false);
  });

  it('eski timestamp (window dışı) → reject', () => {
    const oldTimestamp = Date.now() - 5 * 60 * 1000; // 5 dakika önce
    const oldCode = generateTotpCode(secret, oldTimestamp);
    // Şu anki window'da o kod artık geçerli değil
    expect(verifyTotp(secret, oldCode)).toBe(false);
  });

  it('±1 window içinde geçerli (~30sn tolerans)', () => {
    const slightlyOldTimestamp = Date.now() - 25 * 1000; // 25 sn önce
    const code = generateTotpCode(secret, slightlyOldTimestamp);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('yanlış secret → reject', () => {
    const code = generateTotpCode(secret);
    const wrongSecret = generateTotpSecret();
    expect(verifyTotp(wrongSecret, code)).toBe(false);
  });
});

describe('hashRecoveryCode', () => {
  it('aynı kod aynı hash üretir (deterministic)', () => {
    expect(hashRecoveryCode('ABCD-EFGH')).toBe(hashRecoveryCode('ABCD-EFGH'));
  });

  it('tire ve boşluk normalize ediyor', () => {
    expect(hashRecoveryCode('ABCD-EFGH')).toBe(hashRecoveryCode('ABCDEFGH'));
    expect(hashRecoveryCode('ABCD-EFGH')).toBe(hashRecoveryCode('ABCD EFGH'));
  });

  it('küçük/büyük harf normalize', () => {
    expect(hashRecoveryCode('abcd-efgh')).toBe(hashRecoveryCode('ABCD-EFGH'));
  });

  it('SHA-256 hex 64 karakter', () => {
    expect(hashRecoveryCode('TEST-CODE')).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('generateRecoveryCodes', () => {
  it('default 8 kod üretir', () => {
    const result = generateRecoveryCodes();
    expect(result.plain).toHaveLength(RECOVERY_CODE_COUNT);
    expect(result.hashed).toHaveLength(RECOVERY_CODE_COUNT);
  });

  it('ABCD-EFGH formatında', () => {
    const result = generateRecoveryCodes(3);
    for (const code of result.plain) {
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
  });

  it('I/O/0/1 karakterlerini içermez (insan okunabilir)', () => {
    const result = generateRecoveryCodes(20);
    const all = result.plain.join('');
    expect(all).not.toContain('I');
    expect(all).not.toContain('O');
    expect(all).not.toContain('0');
    expect(all).not.toContain('1');
  });

  it('hashed kodlar usedAt=null ile başlar', () => {
    const result = generateRecoveryCodes(3);
    for (const code of result.hashed) {
      expect(code.usedAt).toBeNull();
      expect(code.hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('plain ve hashed eşleşir', () => {
    const result = generateRecoveryCodes(5);
    for (let i = 0; i < 5; i++) {
      expect(hashRecoveryCode(result.plain[i])).toBe(result.hashed[i].hash);
    }
  });

  it('her çağrıda farklı kodlar', () => {
    const r1 = generateRecoveryCodes(3);
    const r2 = generateRecoveryCodes(3);
    expect(r1.plain).not.toEqual(r2.plain);
  });
});

describe('verifyRecoveryCode', () => {
  it('Doğru kod → ok + usedAt set + remaining 7', () => {
    const { plain, hashed } = generateRecoveryCodes();
    const now = new Date('2026-05-15T12:00:00Z');

    const result = verifyRecoveryCode(hashed, plain[2], now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.remaining).toBe(7);
      expect(result.updatedCodes[2].usedAt).toBe('2026-05-15T12:00:00.000Z');
      // Diğer kodlar değişmemiş
      expect(result.updatedCodes[0].usedAt).toBeNull();
      expect(result.updatedCodes[7].usedAt).toBeNull();
    }
  });

  it('Bilinmeyen kod → invalid', () => {
    const { hashed } = generateRecoveryCodes();
    const result = verifyRecoveryCode(hashed, 'XXXX-XXXX');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });

  it('Daha önce kullanılmış kod → already_used', () => {
    const { plain, hashed } = generateRecoveryCodes();
    const usedCodes = hashed.map((c, i) =>
      i === 3 ? { ...c, usedAt: new Date().toISOString() } : c,
    );

    const result = verifyRecoveryCode(usedCodes, plain[3]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_used');
  });

  it('Tire/boşluk format → normalize edip kabul eder', () => {
    const { plain, hashed } = generateRecoveryCodes();
    const codeWithoutDash = plain[0].replace('-', '');

    const result = verifyRecoveryCode(hashed, codeWithoutDash);
    expect(result.ok).toBe(true);
  });

  it('Küçük harf girilse de kabul eder', () => {
    const { plain, hashed } = generateRecoveryCodes();
    const result = verifyRecoveryCode(hashed, plain[0].toLowerCase());
    expect(result.ok).toBe(true);
  });

  it('Boş kod listesi → invalid', () => {
    const result = verifyRecoveryCode([], 'ABCD-EFGH');
    expect(result.ok).toBe(false);
  });

  it('Boş kod input → invalid', () => {
    const { hashed } = generateRecoveryCodes();
    const result = verifyRecoveryCode(hashed, '');
    expect(result.ok).toBe(false);
  });

  it('Tüm kodları kullan → remaining=0', () => {
    const { plain, hashed } = generateRecoveryCodes(3);
    let codes = hashed;
    for (const code of plain) {
      const r = verifyRecoveryCode(codes, code);
      expect(r.ok).toBe(true);
      if (r.ok) codes = r.updatedCodes;
    }
    expect(codes.every((c) => c.usedAt !== null)).toBe(true);
  });
});
