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
import { notifications, type NotificationContent } from '@/db/schema';

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
 */
export async function createNotification(
  input: CreateNotificationInput,
  db: DbClient,
  now: Date = new Date(),
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
    return { ok: true, id: row?.id };
  } catch {
    return { ok: false };
  }
}

/** Fire-and-forget — caller awaitlemez. */
export function createNotificationAsync(input: CreateNotificationInput, db: DbClient): void {
  void createNotification(input, db).catch(() => {});
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
