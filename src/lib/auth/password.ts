/**
 * Password Operations — hash + verify + strength + HIBP check
 *
 * Cloudflare Workers compatible:
 *   - bcryptjs (pure JS, Workers'da çalışır — bcrypt native add-on çalışmaz)
 *   - jose (JWT için, ayrı modül)
 *
 * HIBP k-anonymity API:
 *   - Şifrenin ilk 5 SHA-1 karakteri gönderilir
 *   - API o prefix ile eşleşen tüm hash'leri döner
 *   - Tam şifre asla iletilmez
 *   - https://haveibeenpwned.com/API/v3#PwnedPasswords
 *
 * Otoritatif: docs/EKRAN-AUTH.md §3 (Register), §5 (Forgot Password)
 */

import bcryptjs from 'bcryptjs';
import crypto from 'node:crypto';

/**
 * Bcrypt cost factor — production'da 12 (~250ms hash, brute-force koruma).
 * Test'lerde override edilebilir (4 cost ~10ms — hızlı test).
 */
const BCRYPT_COST = process.env.NODE_ENV === 'test' ? 4 : 12;

/**
 * Bcrypt ile şifre hash'le. Salt otomatik üretilir.
 *
 * @returns hash string (bcryptjs $2b$XX$... formatında)
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword || plainPassword.length === 0) {
    throw new Error('plainPassword zorunlu');
  }
  return bcryptjs.hash(plainPassword, BCRYPT_COST);
}

/**
 * Plain password'u hash'le karşılaştır (timing-safe — bcryptjs internal).
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  if (!plainPassword || !hash) return false;
  try {
    return await bcryptjs.compare(plainPassword, hash);
  } catch {
    return false;
  }
}

/**
 * Şifre güçlülük kontrolü.
 *
 * Kurallar (EKRAN-AUTH.md §3.4):
 *   - En az 8 karakter
 *   - En az 1 büyük harf
 *   - En az 1 rakam
 *
 * Faz 2'de eklenebilir: özel karakter zorunluluğu, password manager öneri.
 */
export interface PasswordStrengthResult {
  isStrong: boolean;
  issues: string[];
}

export function checkPasswordStrength(plainPassword: string): PasswordStrengthResult {
  const issues: string[] = [];

  if (!plainPassword || plainPassword.length < 8) {
    issues.push('Şifre en az 8 karakter olmalı');
  }
  if (!/[A-Z]/.test(plainPassword)) {
    issues.push('Şifre en az 1 büyük harf içermeli');
  }
  if (!/[0-9]/.test(plainPassword)) {
    issues.push('Şifre en az 1 rakam içermeli');
  }

  return {
    isStrong: issues.length === 0,
    issues,
  };
}

/**
 * HIBP (Have I Been Pwned) — k-anonymity şifre sızıntı kontrolü.
 *
 * Algoritma:
 *   1. password SHA-1 hash (hex, uppercase)
 *   2. İlk 5 karakter (prefix) HIBP API'ye gönderilir
 *   3. API o prefix ile eşleşen tüm hash suffix'lerini + breach count döner
 *   4. Bizim hash suffix listede var mı kontrol — varsa breached
 *
 * Network hatası durumunda: false (güvenli default — şifreyi reddetme,
 * kullanıcıyı blokla değil. Network resilience > paranoid security MVP'de).
 *
 * @returns true if breached (kullanıcıya farklı şifre öner)
 */
export async function isPasswordBreached(plainPassword: string): Promise<boolean> {
  if (!plainPassword) return false;

  try {
    const sha1 = crypto
      .createHash('sha1')
      .update(plainPassword, 'utf8')
      .digest('hex')
      .toUpperCase();

    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'User-Agent': 'PetStockPro-Auth' },
      signal: AbortSignal.timeout(3000), // 3sn timeout
    });

    if (!response.ok) {
      // API hata verirse fail-open (güvenli default)
      return false;
    }

    const text = await response.text();
    // Format: SUFFIX:COUNT\nSUFFIX:COUNT\n...
    const lines = text.split('\n');
    for (const line of lines) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix === suffix) {
        return true; // breached
      }
    }
    return false;
  } catch {
    // Network error, timeout, parse error — fail-open
    return false;
  }
}

/**
 * Şifreyi tüm kontrollerden geçir (register/reset için tek nokta).
 *
 * @throws Error if any check fails (caller'a hata mesajı ile bildir)
 */
export interface PasswordValidationResult {
  ok: boolean;
  issues: string[];
}

export async function validateNewPassword(plainPassword: string): Promise<PasswordValidationResult> {
  const issues: string[] = [];

  const strength = checkPasswordStrength(plainPassword);
  if (!strength.isStrong) {
    issues.push(...strength.issues);
  }

  // Strength geçtiyse HIBP'ye gönder (zaten zayıf şifre için API çağrı boşa)
  if (strength.isStrong) {
    const breached = await isPasswordBreached(plainPassword);
    if (breached) {
      issues.push('Bu şifre bilinen bir veri sızıntısında geçiyor — farklı bir şifre seç');
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
