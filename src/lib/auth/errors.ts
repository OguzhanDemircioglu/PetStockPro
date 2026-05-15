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

export class AccountLockedError extends CredentialsSignin {
  code = 'account_locked';
}

export class EmailNotVerifiedError extends CredentialsSignin {
  code = 'email_not_verified';
}
