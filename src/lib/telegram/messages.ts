/**
 * Telegram Alert Mesaj Şablonları — Sprint 2.8
 *
 * Pure fn(input) → TelegramSendRequest. Test edilebilir, client'tan ayrı.
 * HTML parseMode default — Telegram supported: <b>, <i>, <u>, <s>, <code>, <pre>, <a>.
 */

import type { TelegramSendRequest } from './client';

export interface AccountLockedAlertInput {
  email: string;
  reason: 'BRUTE_FORCE_1H' | 'BRUTE_FORCE_24H';
  recentLockCount: number;
  ipAddress?: string | null;
}

export function buildAccountLockedAlert(input: AccountLockedAlertInput): TelegramSendRequest {
  const isPermanent = input.reason === 'BRUTE_FORCE_24H';
  const severity = isPermanent ? 'critical' : 'warning';
  const headline = isPermanent
    ? '🚨 <b>KRİTİK: 24 saat lock (saldırı şüphesi)</b>'
    : '⚠ <b>Hesap kilitli (1 saat)</b>';

  const lines: string[] = [
    headline,
    '',
    `<b>Email:</b> <code>${input.email}</code>`,
    `<b>Sebep:</b> <code>${input.reason}</code>`,
    `<b>Art arda lock sayısı:</b> ${input.recentLockCount}`,
  ];

  if (input.ipAddress) {
    lines.push(`<b>IP:</b> <code>${input.ipAddress}</code>`);
  }

  if (isPermanent) {
    lines.push('', '<i>3 kez art arda 5\'er yanlış giriş denendi — incele.</i>');
  }

  return {
    text: lines.join('\n'),
    parseMode: 'HTML',
    severity,
    disableNotification: false,
  };
}

export interface TwoFactorDisabledAlertInput {
  email: string;
  companyName: string | null;
}

export interface EmailChangeCancelledAlertInput {
  currentEmail: string;
  attemptedEmail: string;
  companyName: string | null;
}

/**
 * Email değişikliği iptal edildi (eski email sahibi "iptal et" tıkladı).
 *
 * Hesap ele geçirme şüphesi — saldırgan değişiklik başlatmış olabilir.
 * Süperadmin için kritik öncelik (impersonate ile bak + kullanıcıyla iletişim).
 */
export function buildEmailChangeCancelledAlert(input: EmailChangeCancelledAlertInput): TelegramSendRequest {
  return {
    text: [
      '🚨 <b>Email değişikliği İPTAL edildi</b>',
      '<i>(hesap ele geçirme şüphesi)</i>',
      '',
      `<b>Hesap email:</b> <code>${input.currentEmail}</code>`,
      `<b>Değiştirilmeye çalışılan:</b> <code>${input.attemptedEmail}</code>`,
      input.companyName ? `<b>Tenant:</b> ${input.companyName}` : '',
      '',
      '<i>Eski email sahibi iptal etti — başka biri hesabı ele geçirmeye çalışmış olabilir. İmpersonate ile incele.</i>',
    ]
      .filter(Boolean)
      .join('\n'),
    parseMode: 'HTML',
    severity: 'critical',
    disableNotification: false,
  };
}

export function buildTwoFactorDisabledAlert(input: TwoFactorDisabledAlertInput): TelegramSendRequest {
  return {
    text: [
      '🛡 <b>2FA kapatıldı</b>',
      '',
      `<b>Email:</b> <code>${input.email}</code>`,
      input.companyName ? `<b>Tenant:</b> ${input.companyName}` : '',
      '',
      '<i>Hesap güvenlik seviyesi düştü. Şüpheli ise tenant\'a impersonate ile bak.</i>',
    ]
      .filter(Boolean)
      .join('\n'),
    parseMode: 'HTML',
    severity: 'info',
    disableNotification: true,
  };
}

// ══════════════════════════════════════════════════════════════
// Sprint 7c — Uzak kullanıcı yönetimi (süperadmin remote actions)
// ══════════════════════════════════════════════════════════════

export interface RemoteUserActionAlertInput {
  /** İşlem yapan süperadmin'in email'i (audit için). */
  superadminEmail: string;
  /** Aksiyon yapılan hedef kullanıcının email'i. */
  targetEmail: string;
  /** Hedef kullanıcının şirket adı (varsa). */
  targetCompanyName?: string | null;
  /** Süperadmin'in zorunlu sebebi (audit). */
  reason: string;
}

export function buildRemotePasswordResetAlert(
  input: RemoteUserActionAlertInput,
): TelegramSendRequest {
  return {
    text: [
      '🔑 <b>Süperadmin: Şifre sıfırlama linki gönderildi</b>',
      '',
      `<b>Hedef:</b> <code>${input.targetEmail}</code>`,
      input.targetCompanyName ? `<b>Tenant:</b> ${input.targetCompanyName}` : '',
      `<b>Süperadmin:</b> ${input.superadminEmail}`,
      `<b>Sebep:</b> <i>${input.reason}</i>`,
    ]
      .filter(Boolean)
      .join('\n'),
    parseMode: 'HTML',
    severity: 'warning',
  };
}

export function buildRemoteTwoFactorResetAlert(
  input: RemoteUserActionAlertInput,
): TelegramSendRequest {
  return {
    text: [
      '🛡 <b>Süperadmin: 2FA sıfırlandı (uzaktan)</b>',
      '',
      `<b>Hedef:</b> <code>${input.targetEmail}</code>`,
      input.targetCompanyName ? `<b>Tenant:</b> ${input.targetCompanyName}` : '',
      `<b>Süperadmin:</b> ${input.superadminEmail}`,
      `<b>Sebep:</b> <i>${input.reason}</i>`,
      '',
      '<i>Kullanıcı bir sonraki login\'de 2FA istenmeyecek.</i>',
    ]
      .filter(Boolean)
      .join('\n'),
    parseMode: 'HTML',
    severity: 'critical',
  };
}

export interface RemoteAccountLockAlertInput extends RemoteUserActionAlertInput {
  /** 'lock' veya 'unlock'. */
  action: 'lock' | 'unlock';
  /** Lock durumunda kaç saat. unlock'ta yok. */
  lockHours?: number;
}

export function buildRemoteAccountLockAlert(
  input: RemoteAccountLockAlertInput,
): TelegramSendRequest {
  const isLock = input.action === 'lock';
  return {
    text: [
      isLock
        ? `🔒 <b>Süperadmin: Hesap kilitlendi (${input.lockHours ?? '?'} saat)</b>`
        : '🔓 <b>Süperadmin: Hesap kilidi açıldı</b>',
      '',
      `<b>Hedef:</b> <code>${input.targetEmail}</code>`,
      input.targetCompanyName ? `<b>Tenant:</b> ${input.targetCompanyName}` : '',
      `<b>Süperadmin:</b> ${input.superadminEmail}`,
      `<b>Sebep:</b> <i>${input.reason}</i>`,
    ]
      .filter(Boolean)
      .join('\n'),
    parseMode: 'HTML',
    severity: isLock ? 'critical' : 'info',
  };
}
