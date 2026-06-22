/**
 * Telegram tenant-level setup wizard (Sprint 10).
 *
 * Adım 1: Pet shop sahibi BotFather'dan yeni bot yarat → token alır.
 * Adım 2: Bot'a /start mesajı at, chat_id'i öğren (getUpdates) — manuel
 *         (UI rehberi gösterir, otomatize karmaşık + servis kullanıyor).
 * Adım 3: /admin/settings/notifications'a token + chat_id gir → Test mesajı.
 * Adım 4: "Aktif" toggle → bildirimlerde Telegram da gönderilir.
 *
 * Schema 0012: companies tablosuna telegramBotToken/ChatId/Enabled/ConfiguredAt.
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { TenantDb } from '@/lib/db/with-tenant';
import { companies } from '@/db/schema';
import {
  sendTenantTelegramAlert,
  type TelegramSendResult,
} from './client';

export const telegramConfigSchema = z.object({
  botToken: z
    .string()
    .trim()
    .min(20, 'Bot token en az 20 karakter olmalı')
    .max(100, 'Bot token 100 karakteri aşamaz')
    // BotFather token formatı: <bot_id>:<auth_string>, ör. "1234567890:AAA..."
    .regex(
      /^\d{6,12}:[A-Za-z0-9_-]{20,}$/,
      'Bot token formatı geçersiz. BotFather "<id>:<hash>" verir.',
    ),
  chatId: z
    .string()
    .trim()
    .min(1, 'Chat ID zorunlu')
    .max(50, 'Chat ID 50 karakteri aşamaz')
    // Telegram chat_id: negatif kanal/grup veya pozitif kullanıcı ID
    .regex(/^-?\d{4,}$/, 'Chat ID rakamlardan oluşmalı (grup için negatif olabilir)'),
});

export type TelegramConfigInput = z.input<typeof telegramConfigSchema>;

export interface TelegramSettings {
  botToken: string | null;
  chatId: string | null;
  enabled: boolean;
  configuredAt: Date | null;
}

export async function getTelegramSettings(
  companyId: string,
  db: TenantDb,
): Promise<TelegramSettings | null> {
  const rows = await db
    .select({
      botToken: companies.telegramBotToken,
      chatId: companies.telegramChatId,
      enabled: companies.telegramEnabled,
      configuredAt: companies.telegramConfiguredAt,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return rows[0] ?? null;
}

export type SaveTelegramConfigResult =
  | { ok: true; configuredAt: Date }
  | { ok: false; reason: 'invalid_input' | 'not_found'; issues?: string[] };

/**
 * Token + chat ID kaydet, enabled=false (önce test edilmeli, sonra toggle aç).
 */
export async function saveTelegramConfig(
  companyId: string,
  input: TelegramConfigInput,
  db: TenantDb,
  now: Date = new Date(),
): Promise<SaveTelegramConfigResult> {
  const parsed = telegramConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const result = await db
    .update(companies)
    .set({
      telegramBotToken: parsed.data.botToken,
      telegramChatId: parsed.data.chatId,
      telegramConfiguredAt: now,
      // Enabled toggle ayrı action — test edilmeden açılmaz.
      updatedAt: now,
    })
    .where(eq(companies.id, companyId))
    .returning({ id: companies.id });
  if (result.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  return { ok: true, configuredAt: now };
}

export type SetEnabledResult =
  | { ok: true; enabled: boolean }
  | { ok: false; reason: 'not_configured' | 'not_found' };

/**
 * Telegram alert'i aç/kapa. Açmak için önce config kaydedilmiş olmalı.
 */
export async function setTelegramEnabled(
  companyId: string,
  enabled: boolean,
  db: TenantDb,
  now: Date = new Date(),
): Promise<SetEnabledResult> {
  // Açmak isteniyorsa önce config olmalı
  if (enabled) {
    const cfg = await getTelegramSettings(companyId, db);
    if (!cfg) return { ok: false, reason: 'not_found' };
    if (!cfg.botToken || !cfg.chatId) {
      return { ok: false, reason: 'not_configured' };
    }
  }
  const result = await db
    .update(companies)
    .set({ telegramEnabled: enabled, updatedAt: now })
    .where(eq(companies.id, companyId))
    .returning({ id: companies.id });
  if (result.length === 0) return { ok: false, reason: 'not_found' };
  return { ok: true, enabled };
}

export interface TestSendOptions {
  /** Test mesajını yollarken zorla bu config ile — kaydedilmemiş input için */
  configOverride?: { botToken: string; chatId: string };
}

/**
 * Test mesajı gönder. Kaydedilmiş config veya inline override kabul eder.
 *
 * Returns TelegramSendResult (errorCode + description ile UI'da gösterilebilir).
 */
export async function sendTelegramTestMessage(
  companyId: string,
  db: TenantDb,
  opts: TestSendOptions = {},
): Promise<TelegramSendResult> {
  let botToken: string | null = null;
  let chatId: string | null = null;
  if (opts.configOverride) {
    botToken = opts.configOverride.botToken;
    chatId = opts.configOverride.chatId;
  } else {
    const cfg = await getTelegramSettings(companyId, db);
    botToken = cfg?.botToken ?? null;
    chatId = cfg?.chatId ?? null;
  }
  if (!botToken || !chatId) {
    return { ok: false, errorCode: 'NOT_CONFIGURED' };
  }
  return sendTenantTelegramAlert(
    { botToken, chatId },
    {
      text: [
        '<b>PetStockPro test mesajı</b>',
        '',
        'Telegram bağlantın çalışıyor. Düşük stok, sayım tamamlandı,',
        'vitrin auto-unpublish gibi olaylarda buraya bildirim göndereceğim.',
      ].join('\n'),
      parseMode: 'HTML',
      severity: 'info',
    },
  );
}
