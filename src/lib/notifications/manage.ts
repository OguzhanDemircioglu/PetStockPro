/**
 * Notifications — Sprint 15 minimal
 *
 * createNotification: server actions / triggers tarafından çağrılır.
 *   - userId null → tüm tenant'a yayın (tüm admin'ler görür)
 *   - userId set → sadece o user'a (örn. davetin onaylanması)
 * listForUser: oturum açmış user'a görünecek bildirimler (tenant-wide + kişisel).
 * unreadCount: top-bar badge için sayı.
 * markAsRead / markAllAsRead: tıklayınca okundu işaretle.
 *
 * Audit kapsamına almıyoruz — bildirim oluşturma audit-noise yaratır.
 */

import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { companies, notifications, type NotificationContent } from '@/db/schema';
import { sendTenantTelegramAlert } from '@/lib/telegram/client';

export type NotificationType =
  | 'low_stock_critical'
  | 'out_of_stock'
  | 'high_sale'
  | 'new_user'
  | 'plan_limit_warning'
  | 'daily_summary'
  | 'weekly_summary'
  | 'transfer_received'
  | 'stocktake_completed'
  | 'superadmin_session'
  | 'subscription_payment_failed'
  | 'subscription_renewed'
  | 'invoice_issued'
  | 'vitrin_approved'
  | 'vitrin_report_received'
  | 'vitrin_auto_unpublished';

export interface CreateNotificationInput {
  companyId: string;
  userId?: string | null;
  type: NotificationType;
  content: NotificationContent;
  channel?: 'screen' | 'telegram' | 'email';
}

/**
 * Bildirim insert — fire-and-forget pattern uygun (caller awaitlemeyebilir).
 * Hata olursa sessiz fail (audit log'daki pattern gibi).
 *
 * Sprint 10 ext: insert sonrası tenant telegram_enabled=true ise Telegram'a
 * da fire-and-forget gönderim (notification flow'unu bloklamaz, hata yutulur).
 * Skip:
 *   - Tenant-wide olmayan kişisel bildirimler (userId set) Telegram'a düşmez
 *     — kişi Pano + email kullanır; Telegram pet shop sahibi grup kanalı.
 *   - channel='email'/'telegram' override edilmişse screen+telegram fan-out
 *     yine olur (telegram zaten primary).
 */
export async function createNotification(
  input: CreateNotificationInput,
  db: DbClient,
  now: Date = new Date(),
  opts: { awaitTelegram?: boolean } = {},
): Promise<{ ok: boolean; id?: string }> {
  try {
    const [row] = await db
      .insert(notifications)
      .values({
        companyId: input.companyId,
        userId: input.userId ?? null,
        type: input.type,
        channel: input.channel ?? 'screen',
        content: input.content,
        createdAt: now,
      })
      .returning({ id: notifications.id });

    // Tenant-wide (userId NULL) bildirimleri için Telegram fan-out.
    // Kişisel bildirimleri Telegram'a düşürmüyoruz — gizlilik + spam riski.
    if (!input.userId) {
      // Production: fire-and-forget. Test/integration: opts.awaitTelegram=true
      // ile beklenebilir (deterministic test akışı).
      const promise = fanOutTelegram(input, db).catch(() => {
        // Sessiz — Sentry'ye giderse production'da görülür
      });
      if (opts.awaitTelegram) {
        await promise;
      }
    }

    return { ok: true, id: row?.id };
  } catch {
    return { ok: false };
  }
}

/** Fire-and-forget — caller awaitlemez. */
export function createNotificationAsync(input: CreateNotificationInput, db: DbClient): void {
  void createNotification(input, db).catch(() => {});
}

/**
 * Tenant'ın Telegram yapılandırması varsa bildirimi oraya da gönder.
 * Hata olursa sessiz fail.
 */
async function fanOutTelegram(
  input: CreateNotificationInput,
  db: DbClient,
): Promise<void> {
  const cfg = await db
    .select({
      botToken: companies.telegramBotToken,
      chatId: companies.telegramChatId,
      enabled: companies.telegramEnabled,
    })
    .from(companies)
    .where(eq(companies.id, input.companyId))
    .limit(1);

  const row = cfg[0];
  if (!row || !row.enabled || !row.botToken || !row.chatId) return;

  const emoji = input.content.emoji ?? '🔔';
  const title = input.content.title ?? 'Bildirim';
  const body = input.content.body ?? '';
  const text = body
    ? `<b>${emoji} ${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`
    : `<b>${emoji} ${escapeHtml(title)}</b>`;

  await sendTenantTelegramAlert(
    { botToken: row.botToken, chatId: row.chatId },
    { text, parseMode: 'HTML' },
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;',
  );
}

export interface NotificationRow {
  id: string;
  type: NotificationType;
  channel: string;
  content: NotificationContent;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Bir user için bildirim listesi:
 *   - userId NULL (tenant-wide) OR userId = bu user
 *   - en yeni önce, limit default 50
 *   - opts.unreadOnly true → sadece readAt NULL olanlar
 */
export async function listForUser(
  companyId: string,
  userId: string,
  db: DbClient,
  opts?: { limit?: number; unreadOnly?: boolean },
): Promise<NotificationRow[]> {
  const whereClauses = [
    eq(notifications.companyId, companyId),
    or(isNull(notifications.userId), eq(notifications.userId, userId)),
  ];
  if (opts?.unreadOnly) whereClauses.push(isNull(notifications.readAt));

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      channel: notifications.channel,
      content: notifications.content,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(...whereClauses))
    .orderBy(desc(notifications.createdAt))
    .limit(opts?.limit ?? 50);

  return rows as NotificationRow[];
}

/**
 * Top-bar badge için unread count.
 */
export async function unreadCountForUser(
  companyId: string,
  userId: string,
  db: DbClient,
): Promise<number> {
  const rows = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.companyId, companyId),
        or(isNull(notifications.userId), eq(notifications.userId, userId)),
        isNull(notifications.readAt),
      ),
    );
  return rows[0]?.count ?? 0;
}

/**
 * Tek bildirim okundu işaretle. Ownership check (companyId + userId access).
 */
export async function markAsRead(
  companyId: string,
  userId: string,
  notificationId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<{ ok: boolean }> {
  try {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.companyId, companyId),
          or(isNull(notifications.userId), eq(notifications.userId, userId)),
        ),
      );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Tüm okunmamışları okundu işaretle. */
export async function markAllAsRead(
  companyId: string,
  userId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<{ ok: boolean }> {
  try {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.companyId, companyId),
          or(isNull(notifications.userId), eq(notifications.userId, userId)),
          isNull(notifications.readAt),
        ),
      );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
