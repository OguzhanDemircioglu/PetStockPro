/**
 * Two-Factor Authentication (TOTP) — Sprint 2.5
 *
 * Akış (EKRAN-AUTH §7):
 *   1. /2fa-setup init → generateSecret + buildOtpAuthUri → user QR tarar
 *   2. User 6 haneli kod gir → verifyTotp(secret, code)
 *   3. Doğru → recovery codes üret (8 × 8 char) + SHA-256 hash → DB
 *   4. enable → twoFactorEnabled=true, secret store
 *
 * Login akışı (Sprint 2.5b):
 *   - Şifre doğru + twoFactorEnabled=true → TOTP step
 *   - User 6 haneli kod veya recovery code gir
 *   - verifyTotp veya verifyRecoveryCode
 *
 * RFC 6238 (TOTP) compliance: SHA-1, 6 digit, 30s window.
 * otpauth paketi Cloudflare Workers ile uyumlu (pure JS, no Buffer dependency).
 *
 * Recovery codes:
 *   - 8 adet, format ABCD-EFGH (8 alfanumerik karakter — hash uyumu için harf+rakam mix)
 *   - SHA-256 hash DB'de saklı (düz değer değil)
 *   - Tek kullanımlık (usedAt set edilince invalidate)
 */

import crypto from 'node:crypto';
import { TOTP, Secret } from 'otpauth';
import type { RecoveryCode } from '@/db/schema';

const ISSUER = 'PetStockPro';
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // saniye
const TOTP_ALGORITHM = 'SHA1';
const TOTP_WINDOW = 1;  // ±1 period (~60sn tolerans saat farkı için)

export const TWO_FACTOR_SETUP_TTL_MS = 10 * 60 * 1000; // 10 dk
export const RECOVERY_CODE_COUNT = 8;

/**
 * Yeni TOTP secret üret (base32 encoded).
 * Authenticator app QR tararken veya manuel girerken bu değeri kullanır.
 */
export function generateTotpSecret(): string {
  // otpauth Secret 20 byte default → base32 ~32 char
  return new Secret({ size: 20 }).base32;
}

/**
 * otpauth:// URI üret — Authenticator app'ler bu URI'yi QR olarak okur.
 *
 * Format: otpauth://totp/PetStockPro:user@example.com?secret=XXX&issuer=PetStockPro&...
 *
 * @param email kullanıcı e-postası (account label)
 * @param secret base32 secret
 */
export function buildOtpAuthUri(email: string, secret: string): string {
  const totp = new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(secret),
  });
  return totp.toString();
}

export interface TotpVerifyOptions {
  /** Saat farkı toleransı (period sayısı). Default 1 = ±30sn. */
  window?: number;
  /** Test'lerde Date.now() override için. */
  timestamp?: number;
}

/**
 * 6 haneli TOTP kodunu verify et.
 *
 * @param secret base32 secret
 * @param code 6 haneli string (örn "123456")
 * @returns true if valid, false otherwise
 */
export function verifyTotp(
  secret: string,
  code: string,
  options: TotpVerifyOptions = {},
): boolean {
  if (!secret || !code) return false;
  // 6 haneli rakam değilse erken çık (ekstra karakter / boşluk)
  const cleaned = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;

  try {
    const totp = new TOTP({
      issuer: ISSUER,
      algorithm: TOTP_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
      secret: Secret.fromBase32(secret),
    });
    const delta = totp.validate({
      token: cleaned,
      window: options.window ?? TOTP_WINDOW,
      timestamp: options.timestamp,
    });
    return delta !== null;
  } catch {
    return false;
  }
}

/**
 * Test/dev için TOTP kod üret (verify değil — current secret için anlık kod).
 * Production'da hiçbir yerde çağrılmaz; sadece browser test + unit test'lerde.
 */
export function generateTotpCode(secret: string, timestamp?: number): string {
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(secret),
  });
  return totp.generate({ timestamp });
}

// ─────────────────────────────────────────────────────────────────
// Recovery Codes
// ─────────────────────────────────────────────────────────────────

/**
 * Tek bir recovery code'unu hash'le (SHA-256, hex uppercase).
 * Karşılaştırmada timing-safe equal kullanılır.
 */
export function hashRecoveryCode(plainCode: string): string {
  // Boşluk + tire normalize: "ABCD-EFGH" → "ABCDEFGH"
  const normalized = plainCode.replace(/[\s-]/g, '').toUpperCase();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * 8 adet recovery code üret (format ABCD-EFGH).
 *
 * @returns plain (kullanıcıya gösterilecek) + hashed (DB'ye yazılacak) listeleri
 */
export interface GeneratedRecoveryCodes {
  plain: string[];   // ['ABCD-EFGH', 'IJKL-9MNO', ...]
  hashed: RecoveryCode[];
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): GeneratedRecoveryCodes {
  // İnsan-okunabilir alphabet: I/O/0/1 hariç (karışıklık önle)
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const plain: string[] = [];
  const hashed: RecoveryCode[] = [];

  for (let i = 0; i < count; i++) {
    let raw = '';
    const bytes = crypto.randomBytes(8);
    for (let j = 0; j < 8; j++) {
      raw += ALPHABET[bytes[j] % ALPHABET.length];
    }
    // ABCD-EFGH formatı
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    plain.push(formatted);
    hashed.push({ hash: hashRecoveryCode(formatted), usedAt: null });
  }

  return { plain, hashed };
}

export type RecoveryVerifyResult =
  | { ok: true; updatedCodes: RecoveryCode[]; remaining: number }
  | { ok: false; reason: 'invalid' | 'already_used' };

/**
 * Recovery code'unu verify et + kullanılınca usedAt set.
 *
 * Tek kullanımlık: kullanıldıktan sonra bu listede usedAt timestamp'i tutar
 * ama hash listede kalır — kullanıcı eski kodu tekrar denerse "already_used".
 *
 * Caller başarılı verify sonrası `updatedCodes` listesini DB'ye yazmalı.
 */
export function verifyRecoveryCode(
  codes: RecoveryCode[],
  providedCode: string,
  now: Date = new Date(),
): RecoveryVerifyResult {
  if (!codes || codes.length === 0 || !providedCode) {
    return { ok: false, reason: 'invalid' };
  }

  const providedHash = hashRecoveryCode(providedCode);
  let foundIndex = -1;

  for (let i = 0; i < codes.length; i++) {
    const stored = codes[i];
    // Timing-safe SHA-256 hash comparison
    const storedBuf = Buffer.from(stored.hash, 'hex');
    const providedBuf = Buffer.from(providedHash, 'hex');
    if (storedBuf.length !== providedBuf.length) continue;
    if (crypto.timingSafeEqual(storedBuf, providedBuf)) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex === -1) {
    return { ok: false, reason: 'invalid' };
  }

  if (codes[foundIndex].usedAt) {
    return { ok: false, reason: 'already_used' };
  }

  const updatedCodes = codes.map((c, i) =>
    i === foundIndex ? { ...c, usedAt: now.toISOString() } : c,
  );
  const remaining = updatedCodes.filter((c) => !c.usedAt).length;

  return { ok: true, updatedCodes, remaining };
}
