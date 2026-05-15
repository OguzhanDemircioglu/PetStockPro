import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  checkPasswordStrength,
  isPasswordBreached,
  validateNewPassword,
} from './password';

describe('hashPassword', () => {
  it('bcrypt hash döner ($2b$ prefix)', async () => {
    const hash = await hashPassword('Test1234');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('aynı şifre farklı hash üretir (salt unique)', async () => {
    const h1 = await hashPassword('Test1234');
    const h2 = await hashPassword('Test1234');
    expect(h1).not.toBe(h2);
  });

  it('boş şifre → throw', async () => {
    await expect(hashPassword('')).rejects.toThrow(/zorunlu/);
  });
});

describe('verifyPassword', () => {
  it('doğru şifre → true', async () => {
    const hash = await hashPassword('SecurePass123');
    expect(await verifyPassword('SecurePass123', hash)).toBe(true);
  });

  it('yanlış şifre → false', async () => {
    const hash = await hashPassword('SecurePass123');
    expect(await verifyPassword('WrongPass456', hash)).toBe(false);
  });

  it('boş şifre → false', async () => {
    const hash = await hashPassword('Test1234');
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('boş hash → false', async () => {
    expect(await verifyPassword('Test1234', '')).toBe(false);
  });

  it('geçersiz hash format → false (throw değil)', async () => {
    expect(await verifyPassword('Test1234', 'not-a-bcrypt-hash')).toBe(false);
  });

  it('timing-safe: bcryptjs internal sabit zaman karşılaştırma', async () => {
    // Bu test'i runtime karşılaştırma ile yapamayız (CI variance büyük)
    // Sadece API surface kontrolü: function 100ms+ alıyor mu (gerçek hash compare)
    const hash = await hashPassword('TimingTest1');
    const start = performance.now();
    await verifyPassword('TimingTest1', hash);
    const elapsed = performance.now() - start;
    // Bcrypt cost 4 (test) ile ~10ms beklenir, ama platform varies — > 1ms enough
    expect(elapsed).toBeGreaterThan(1);
  });
});

describe('checkPasswordStrength', () => {
  it('güçlü şifre → isStrong true', () => {
    const result = checkPasswordStrength('SecurePass123');
    expect(result.isStrong).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('8 karakterden kısa → issue', () => {
    const result = checkPasswordStrength('Abc123');
    expect(result.isStrong).toBe(false);
    expect(result.issues).toContain('Şifre en az 8 karakter olmalı');
  });

  it('büyük harf yok → issue', () => {
    const result = checkPasswordStrength('lowercase123');
    expect(result.isStrong).toBe(false);
    expect(result.issues).toContain('Şifre en az 1 büyük harf içermeli');
  });

  it('rakam yok → issue', () => {
    const result = checkPasswordStrength('OnlyLetters');
    expect(result.isStrong).toBe(false);
    expect(result.issues).toContain('Şifre en az 1 rakam içermeli');
  });

  it('hiçbiri yok → 3 issue', () => {
    const result = checkPasswordStrength('abc');
    expect(result.isStrong).toBe(false);
    expect(result.issues).toHaveLength(3);
  });

  it('boş şifre → length + büyük harf + rakam (3 issue)', () => {
    const result = checkPasswordStrength('');
    expect(result.isStrong).toBe(false);
    expect(result.issues).toHaveLength(3);
  });

  it('tam sınırda 8 karakter + büyük + rakam → güçlü', () => {
    expect(checkPasswordStrength('Abcd1234').isStrong).toBe(true);
  });
});

describe('isPasswordBreached (HIBP k-anonymity)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('breached şifre (mock API hit) → true', async () => {
    // "password" → SHA-1: 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // Prefix: 5BAA6, Suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\nOTHERSUFFIX:1234\n', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const result = await isPasswordBreached('password');
    expect(result).toBe(true);
  });

  it('breached değil (mock API miss) → false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('OTHERSUFFIX:1234\nANOTHERSUFFIX:5\n', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const result = await isPasswordBreached('SuperUniqueShifre2026');
    expect(result).toBe(false);
  });

  it('API hatası (500) → fail-open false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 500 }),
    );

    expect(await isPasswordBreached('any-password')).toBe(false);
  });

  it('network error → fail-open false', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ENOTFOUND'));

    expect(await isPasswordBreached('any-password')).toBe(false);
  });

  it('boş şifre → false (API çağrısı yok)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await isPasswordBreached('')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('HIBP API çağrısı doğru prefix + headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('NONE:1\n', { status: 200 }),
    );

    await isPasswordBreached('password'); // SHA-1 5BAA61E4...
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.pwnedpasswords.com/range/5BAA6',
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': 'PetStockPro-Auth' }),
      }),
    );
  });
});

describe('validateNewPassword (tam kontrol)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('güçlü + breached değil → ok=true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('OTHER:1\n', { status: 200 }),
    );

    const result = await validateNewPassword('UniquePass2026!');
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('zayıf → ok=false (HIBP çağrılmaz)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await validateNewPassword('abc');
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    // strength fail → HIBP çağrılmaz (boşa API call)
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('güçlü ama breached → ok=false', async () => {
    // "Password1" güçlülük geçer (8 char + büyük + rakam) ama breached olabilir
    // SHA-1 Password1: 70CCD9007338D6D81DD3B6271621B9CF9A97EA00
    // Prefix 70CCD, suffix 9007338D6D81DD3B6271621B9CF9A97EA00
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('9007338D6D81DD3B6271621B9CF9A97EA00:1234\n', { status: 200 }),
    );

    const result = await validateNewPassword('Password1');
    expect(result.ok).toBe(false);
    expect(result.issues).toContain('Bu şifre bilinen bir veri sızıntısında geçiyor — farklı bir şifre seç');
  });
});
