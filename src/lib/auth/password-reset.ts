/**
 * Password Reset — token üret + verify (Sprint 2.4)
 *
 * Akış (EKRAN-AUTH.md §5):
 *   1. /forgot-password POST → kullanıcı email gir
 *      • Email enumeration koruma: var/yok ayrımı YOK, her durumda generic 200
 *      • Varsa: createResetToken → DB'ye yaz → Brevo email gönder
 *   2. Kullanıcı email'deki linke tıklar → /reset-password/[token]
 *   3. Backend verifyResetToken (timing-safe + expiry + tek kullanımlık)
 *   4. Başarılı reset → passwordHash güncelle + token NULL + failedLoginCount=0 + lockedUntil=NULL
 *
 * Token: 32 byte crypto random → base64url (43 char)
 * TTL: 30 dakika (verification 24 saatten kısa — güvenlik kritik)
 *
 * NIST 800-63B uyumu: tek kullanımlık, kısa TTL, transit + at-rest secure
 */

import crypto from 'node:crypto';

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 dakika

/**
 * Kriptografik güvenli reset token üretir.
 * Email verification ile aynı pattern — 32 byte → base64url (43 char).
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export interface ResetTokenState {
  passwordResetToken: string | null;
  passwordResetExpiresAt: Date | null;
}

export interface NewResetTokenResult {
  token: string;
  expiresAt: Date;
}

/**
 * Yeni reset token + expiry üret.
 */
export function createResetToken(now: Date = new Date()): NewResetTokenResult {
  return {
    token: generateResetToken(),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
  };
}

export type VerifyResetTokenResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_token' | 'expired' };

/**
 * Reset token verify — timing-safe karşılaştırma + expiry check.
 *
 * Tek kullanımlık invariant: caller başarılı verify sonrası DB'de
 * passwordResetToken=NULL yapmalı. Bu helper sadece geçerlilik kontrol eder.
 */
export function verifyResetToken(
  state: ResetTokenState,
  providedToken: string,
  now: Date = new Date(),
): VerifyResetTokenResult {
  if (!state.passwordResetToken || !providedToken) {
    return { ok: false, reason: 'invalid_token' };
  }

  const expectedBuf = Buffer.from(state.passwordResetToken, 'utf8');
  const providedBuf = Buffer.from(providedToken, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, reason: 'invalid_token' };
  }

  const match = crypto.timingSafeEqual(expectedBuf, providedBuf);
  if (!match) {
    return { ok: false, reason: 'invalid_token' };
  }

  if (state.passwordResetExpiresAt && state.passwordResetExpiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true };
}
