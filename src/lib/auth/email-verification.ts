/**
 * Email Verification — token üret + verify + resend
 *
 * Akış (EKRAN-AUTH.md §4):
 *   1. Register sonrası: generateVerificationToken → DB'ye yaz → email gönder
 *   2. User link tıklar → /verify-email/[token]
 *   3. verifyEmailToken → DB'de match + ExpiresAt check → emailVerifiedAt = now
 *   4. Resend: 60sn cooldown + 24h max 5
 *   5. 7 gün grace period (pg_cron, hesap kilitli)
 *
 * Token: 32 byte crypto random → base64url (43 char)
 * TTL: 24 saat
 *
 * DB user fields (DATABASE-SCHEMA + EKRAN-AUTH):
 *   emailVerificationToken, ExpiresAt, ResendCount, LastSentAt
 *
 * NOT: Bu Sprint 2.3 foundation. DB schema'da bu field'lar henüz YOK
 * (Sprint 1A subset). Sprint 1B'de eklenecek. Şu an mock-ready helper'lar
 * pure logic olarak hazır — DB integration Sprint 1B sonrası.
 */

import crypto from 'node:crypto';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat
export const RESEND_COOLDOWN_MS = 60 * 1000; // 60 saniye
export const RESEND_MAX_COUNT = 5; // 24 saat içinde max 5 resend
export const RESEND_COUNT_RESET_MS = 24 * 60 * 60 * 1000; // 24 saat sonra count reset
export const VERIFICATION_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün

/**
 * Kriptografik güvenli verification token üretir.
 * 32 byte → base64url (43 karakter, URL-safe).
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export interface VerificationTokenState {
  emailVerificationToken: string | null;
  emailVerificationExpiresAt: Date | null;
  emailVerificationResendCount: number;
  emailVerificationLastSentAt: Date | null;
}

export interface NewTokenResult {
  token: string;
  expiresAt: Date;
}

/**
 * Yeni token üret + expiry hesapla.
 */
export function createVerificationToken(now: Date = new Date()): NewTokenResult {
  return {
    token: generateVerificationToken(),
    expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
  };
}

export type ResendCheckResult =
  | { ok: true; newCount: number; newLastSentAt: Date }
  | { ok: false; reason: 'cooldown'; retryAfterSeconds: number }
  | { ok: false; reason: 'max_count'; resetAt: Date };

/**
 * Resend isteği yapılabilir mi? Cooldown + count limit kontrol.
 *
 * @returns ok=true ise yeni resend yap; ok=false ise UI uyarısı göster
 */
export function canResendVerification(
  state: VerificationTokenState,
  now: Date = new Date(),
): ResendCheckResult {
  // 1. Cooldown check (60sn)
  if (state.emailVerificationLastSentAt) {
    const elapsedMs = now.getTime() - state.emailVerificationLastSentAt.getTime();
    if (elapsedMs < RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
      return { ok: false, reason: 'cooldown', retryAfterSeconds };
    }
  }

  // 2. Max count check (24h içinde 5 resend)
  // Eğer lastSentAt 24h'den eski ise count reset edilmiş kabul ederiz
  const isCountStale =
    !state.emailVerificationLastSentAt ||
    now.getTime() - state.emailVerificationLastSentAt.getTime() >= RESEND_COUNT_RESET_MS;

  const currentCount = isCountStale ? 0 : state.emailVerificationResendCount;

  if (currentCount >= RESEND_MAX_COUNT) {
    // Reset kullanıcının son resend'inden 24h sonra
    const resetAt = new Date(
      (state.emailVerificationLastSentAt?.getTime() ?? now.getTime()) + RESEND_COUNT_RESET_MS,
    );
    return { ok: false, reason: 'max_count', resetAt };
  }

  return {
    ok: true,
    newCount: currentCount + 1,
    newLastSentAt: now,
  };
}

export type VerifyTokenResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_token' | 'expired' };

/**
 * Token verify — DB'den okunan state ile gelen token'ı karşılaştır.
 * Timing-safe comparison + expiry check.
 */
export function verifyEmailToken(
  state: VerificationTokenState,
  providedToken: string,
  now: Date = new Date(),
): VerifyTokenResult {
  if (!state.emailVerificationToken || !providedToken) {
    return { ok: false, reason: 'invalid_token' };
  }

  // Timing-safe
  const expectedBuf = Buffer.from(state.emailVerificationToken, 'utf8');
  const providedBuf = Buffer.from(providedToken, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, reason: 'invalid_token' };
  }

  const match = crypto.timingSafeEqual(expectedBuf, providedBuf);
  if (!match) {
    return { ok: false, reason: 'invalid_token' };
  }

  // Expiry
  if (state.emailVerificationExpiresAt && state.emailVerificationExpiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true };
}

/**
 * Hesap grace period'unu aştı mı?
 * 7 gün boyunca verify edilmezse hesap kilitli (pg_cron job).
 */
export function isGracePeriodExpired(
  userCreatedAt: Date,
  emailVerifiedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (emailVerifiedAt) return false; // verify edilmiş, grace period geçersiz
  return now.getTime() - userCreatedAt.getTime() > VERIFICATION_GRACE_PERIOD_MS;
}
