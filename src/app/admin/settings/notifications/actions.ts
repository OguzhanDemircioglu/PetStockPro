'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  saveTelegramConfig,
  sendTelegramTestMessage,
  setTelegramEnabled,
  type SaveTelegramConfigResult,
  type SetEnabledResult,
} from '@/lib/telegram/settings';
import type { TelegramSendResult } from '@/lib/telegram/client';

export interface NotificationsFormState {
  ok?: boolean;
  testOk?: boolean;
  message?: string;
  issues?: string[];
}

function asString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
}

/**
 * Telegram bot config kaydet — token + chat_id form data ile gelir.
 */
export async function saveTelegramConfigAction(
  _prev: NotificationsFormState,
  formData: FormData,
): Promise<NotificationsFormState> {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const input = {
    botToken: asString(formData, 'botToken'),
    chatId: asString(formData, 'chatId'),
  };
  const result: SaveTelegramConfigResult = await saveTelegramConfig(
    session.user.companyId,
    input,
    db,
  );
  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return {
        ok: false,
        message: 'Form bilgileri geçersiz.',
        issues: result.issues,
      };
    }
    return { ok: false, message: 'Firma bulunamadı.' };
  }
  revalidatePath('/admin/settings/notifications');
  return { ok: true, message: '✓ Telegram bilgileri kaydedildi. Şimdi test mesajı gönderebilirsin.' };
}

/**
 * Test mesajı gönder — kaydedilmiş config veya inline form override.
 */
export async function sendTestMessageAction(
  _prev: NotificationsFormState,
  formData: FormData,
): Promise<NotificationsFormState> {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const inlineBot = asString(formData, 'botToken');
  const inlineChat = asString(formData, 'chatId');
  const opts =
    inlineBot && inlineChat
      ? { configOverride: { botToken: inlineBot.trim(), chatId: inlineChat.trim() } }
      : {};

  const result: TelegramSendResult = await sendTelegramTestMessage(
    session.user.companyId,
    db,
    opts,
  );

  if (result.ok) {
    return {
      ok: true,
      testOk: true,
      message: `✓ Test mesajı gönderildi. Telegram'ı kontrol et${result.messageId ? ` (msg #${result.messageId})` : ''}.`,
    };
  }

  // Hata mesajı kullanıcı-dostu
  const errorMessages: Record<string, string> = {
    NOT_CONFIGURED: 'Önce bot token ve chat ID gir.',
    HTTP_401: 'Bot token yanlış — Telegram reddetti (401).',
    HTTP_400: 'Chat ID yanlış veya bot bu chat\'i bulamadı (400).',
    HTTP_403: 'Bot bu chat\'e mesaj yetkisi yok (403). /start mesajı atmayı dene.',
    NETWORK: 'Telegram\'a ulaşılamadı — ağ hatası.',
  };
  const userMessage =
    errorMessages[result.errorCode ?? ''] ??
    `Hata: ${result.errorCode ?? 'bilinmiyor'}${result.description ? ` (${result.description})` : ''}`;
  return { ok: false, testOk: false, message: userMessage };
}

/**
 * Telegram alert'i aç/kapa.
 */
export async function toggleTelegramEnabledAction(
  formData: FormData,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const enabledRaw = asString(formData, 'enabled');
  const enabled = enabledRaw === 'true';

  const result: SetEnabledResult = await setTelegramEnabled(
    session.user.companyId,
    enabled,
    db,
  );
  if (!result.ok && result.reason === 'not_configured') {
    redirect('/admin/settings/notifications?error=not_configured' as never);
  }
  revalidatePath('/admin/settings/notifications');
  redirect(
    `/admin/settings/notifications?toggled=${enabled ? '1' : '0'}` as never,
  );
}
