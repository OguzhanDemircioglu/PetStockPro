/**
 * Telegram Bot Client — Süperadmin alert kanalı (Sprint 2.8)
 *
 * EKRAN-SUPERADMIN §1.1-1.3 — sistem event'leri için Telegram bot kanalı.
 * Müşteriyle hiç temas yok (ADMIN bildirim kanalı).
 *
 * Production: Telegram Bot API (https://api.telegram.org/bot{TOKEN}/sendMessage)
 * Development/no-token: console.log mock fallback (Brevo pattern'ı).
 *
 * Süperadmin alert event'leri:
 *   - Account locked (1h ve 24h)
 *   - 3 art arda lock (kalıcı saldırı şüphesi — kritik öncelik)
 *   - Yeni tenant register (lansman izleme)
 *   - System error (production)
 */

export interface TelegramSendRequest {
  text: string;
  /** Markdown veya HTML. Default: HTML. */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  /** Bildirim sessiz mi? (false = vibrate + ses). */
  disableNotification?: boolean;
  /** Alert ağırlığı — sadece log'a yansır şu an. */
  severity?: 'info' | 'warning' | 'critical';
}

export interface TelegramSendResult {
  ok: boolean;
  mock?: boolean;
  messageId?: number;
  errorCode?: string;
  description?: string;
}

export interface TenantTelegramConfig {
  botToken: string;
  chatId: string;
}

/**
 * Tenant-specific bot kullanarak alert gönder (Sprint 10).
 *
 * Süperadmin env-based bot'tan ayrı: her tenant kendi bot'unu Telegram
 * BotFather'dan alır, /admin/settings/notifications sayfasında binding yapar.
 *
 * Token/chatId boş olduğu durumda mock fallback.
 */
export async function sendTenantTelegramAlert(
  config: TenantTelegramConfig,
  req: TelegramSendRequest,
): Promise<TelegramSendResult> {
  if (!config.botToken || !config.chatId) {
    return { ok: false, errorCode: 'NOT_CONFIGURED' };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: req.text,
          parse_mode: req.parseMode ?? 'HTML',
          disable_notification: req.disableNotification ?? false,
        }),
      },
    );
    if (!res.ok) {
      let description: string | undefined;
      try {
        const body = (await res.json()) as { description?: string };
        description = body.description;
      } catch {
        // body parse fail — sessiz
      }
      return {
        ok: false,
        errorCode: `HTTP_${res.status}`,
        description,
      };
    }
    const data = (await res.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };
    return {
      ok: data.ok === true,
      messageId: data.result?.message_id,
      description: data.description,
    };
  } catch (err) {
    return {
      ok: false,
      errorCode: 'NETWORK',
      description: err instanceof Error ? err.message : String(err),
    };
  }
}

function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_SUPERADMIN_CHAT_ID);
}

/**
 * Süperadmin Telegram chat'ine mesaj gönder.
 *
 * Config yoksa (dev) console'a log atar — production'da error fırlatır.
 * Fail durumunda sessizce geç (caller business logic'i etkilemesin).
 */
export async function sendTelegramAlert(req: TelegramSendRequest): Promise<TelegramSendResult> {
  if (!isTelegramConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TELEGRAM_BOT_TOKEN ve TELEGRAM_SUPERADMIN_CHAT_ID production\'da zorunlu');
    }
    const sev = req.severity ? `[${req.severity.toUpperCase()}] ` : '';
    console.log(`[telegram:mock] ${sev}${req.text.replace(/\n/g, ' / ').slice(0, 200)}`);
    return { ok: true, mock: true };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_SUPERADMIN_CHAT_ID!;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: req.text,
        parse_mode: req.parseMode ?? 'HTML',
        disable_notification: req.disableNotification ?? false,
      }),
    });

    if (!res.ok) {
      console.warn(`[telegram] API HTTP ${res.status}`);
      return { ok: false };
    }

    const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
    return {
      ok: data.ok === true,
      messageId: data.result?.message_id,
    };
  } catch (err) {
    console.warn('[telegram] send error:', err);
    return { ok: false };
  }
}
