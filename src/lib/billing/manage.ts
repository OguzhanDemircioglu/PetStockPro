/**
 * Billing yönetimi — iptal + yeniden etkinleştir (Faz 4).
 *
 * İptal: cancelAtPeriodEnd=true → dönem sonuna kadar aktif kalır, sonra cron
 *        (runBillingRenewals) expire eder + plan FREE. Anında kesinti YOK (ödenen dönem hakkı).
 * Yeniden etkinleştir: dönem içindeyse iptali geri al.
 *
 * Plan değişikliği (upgrade/downgrade proration) + kart güncelleme: kapsam dışı
 * (PLAN-PAYTR-NILVERA §6) — sonraki faz.
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { subscriptions, users } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit/log';

export interface ManageResult {
  ok: boolean;
  reason?: 'not_found';
}

async function findCompanyOwner(db: DbClient, companyId: string): Promise<string | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, 'BAYI_SAHIBI')))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Aboneliği dönem sonunda iptal et (cancelAtPeriodEnd). Anında kesmez.
 */
export async function cancelSubscription(
  companyId: string,
  db: DbClient,
  opts?: { now?: Date },
): Promise<ManageResult> {
  const now = opts?.now ?? new Date();

  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.companyId, companyId), inArray(subscriptions.status, ['active', 'past_due'])))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  const sub = rows[0];
  if (!sub) return { ok: false, reason: 'not_found' };

  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, cancelledAt: now, updatedAt: now })
    .where(eq(subscriptions.id, sub.id));

  const ownerId = await findCompanyOwner(db, companyId);
  if (ownerId) {
    await writeAuditLog(
      {
        companyId,
        userId: ownerId,
        action: 'subscription.cancel_scheduled',
        entityType: 'subscription',
        entityId: sub.id,
        afterState: { cancelAtPeriodEnd: true },
      },
      db,
      now,
    );
  }
  return { ok: true };
}

/**
 * Dönem içindeyse iptali geri al (cancelAtPeriodEnd=false).
 */
export async function reactivateSubscription(
  companyId: string,
  db: DbClient,
  opts?: { now?: Date },
): Promise<ManageResult> {
  const now = opts?.now ?? new Date();

  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.companyId, companyId),
        eq(subscriptions.cancelAtPeriodEnd, true),
        inArray(subscriptions.status, ['active', 'past_due']),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  const sub = rows[0];
  if (!sub) return { ok: false, reason: 'not_found' };

  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: false, cancelledAt: null, updatedAt: now })
    .where(eq(subscriptions.id, sub.id));

  const ownerId = await findCompanyOwner(db, companyId);
  if (ownerId) {
    await writeAuditLog(
      {
        companyId,
        userId: ownerId,
        action: 'subscription.reactivated',
        entityType: 'subscription',
        entityId: sub.id,
        afterState: { cancelAtPeriodEnd: false },
      },
      db,
      now,
    );
  }
  return { ok: true };
}
