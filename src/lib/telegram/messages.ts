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
