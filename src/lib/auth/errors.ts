/**
 * Auth.js Custom Errors — Sprint 2.5
 *
 * Auth.js v5'te authorize null dönerse generic "CredentialsSignin" hatası
 * fırlatılır. Spesifik durumları (2FA gerekli, yanlış TOTP, hesap kilitli)
 * UI'ya iletmek için CredentialsSignin extend edilir, code field'ı set.
 *
 * Login action try/catch'te `err instanceof AuthError` + `err.code` check'i ile
 * UI'ya doğru mesaj gösterilir.
 */

import { CredentialsSignin } from '@auth/core/errors';

export class TwoFactorRequiredError extends CredentialsSignin {
  code = '2fa_required';
}

export class TwoFactorInvalidError extends CredentialsSignin {
  code = '2fa_invalid';
}

/**
 * Hesap kilitli — şifre/2FA doğru olsa bile reddedilir.
 *
 * Login action `err.code === 'account_locked'` ile yakalar +
 * `err.lockedSecondsRemaining` + `err.lockedReason`'ı state'e yansıtır.
 * Frontend /account-locked sayfasına redirect eder.
 */
export class AccountLockedError extends CredentialsSignin {
  code = 'account_locked';
  lockedSecondsRemaining: number;
  lockedReason: string;

  constructor(secondsRemaining: number, reason: string) {
    super(`Hesap kilitli — ${secondsRemaining}sn kaldı (${reason})`);
    this.lockedSecondsRemaining = secondsRemaining;
    this.lockedReason = reason;
  }
}

/**
 * Şifre yanlış + kalan hak bilgisi (Sprint 2.7).
 *
 * authorize null dönmek yerine bunu throw eder ki login action kullanıcıya
 * banner gösterebilsin (3 hakkın kaldı → 1 hakkın kaldı zinciri).
 *
 * NOT: 1-2 fail durumunda da throw edilir; ama banner threshold (3+) frontend'de
 * filtrelenir — backend bilgi sızdırmaz; banner kararı UI tarafında.
 */
export class InvalidCredentialsError extends CredentialsSignin {
  code = 'invalid_credentials';
  remainingAttempts: number;

  constructor(remainingAttempts: number) {
    super('Şifre hatalı');
    this.remainingAttempts = remainingAttempts;
  }
}

export class EmailNotVerifiedError extends CredentialsSignin {
  code = 'email_not_verified';
}
