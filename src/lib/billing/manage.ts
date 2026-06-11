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

import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
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

/**
 * Dönem-sonu plan değişimi planla (PRO↔PRO+) — H2. pendingPlan set edilir; renewal'da
 * çekimden ÖNCE uygulanır (proration yok). Sadece aktif/past_due abonelikte geçerli.
 */
export async function schedulePlanChange(
  companyId: string,
  targetPlan: 'PRO' | 'PRO_PLUS',
  db: DbClient,
  opts?: { now?: Date },
): Promise<{ ok: boolean; reason?: 'not_found' | 'same_plan' | 'invalid_plan' }> {
  if (targetPlan !== 'PRO' && targetPlan !== 'PRO_PLUS') {
    return { ok: false, reason: 'invalid_plan' };
  }
  const now = opts?.now ?? new Date();

  const rows = await db
    .select({ id: subscriptions.id, plan: subscriptions.plan })
    .from(subscriptions)
    .where(and(eq(subscriptions.companyId, companyId), inArray(subscriptions.status, ['active', 'past_due'])))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  const sub = rows[0];
  if (!sub) return { ok: false, reason: 'not_found' };
  if (sub.plan === targetPlan) return { ok: false, reason: 'same_plan' };

  await db
    .update(subscriptions)
    .set({ pendingPlan: targetPlan, updatedAt: now })
    .where(eq(subscriptions.id, sub.id));

  const ownerId = await findCompanyOwner(db, companyId);
  if (ownerId) {
    await writeAuditLog(
      {
        companyId,
        userId: ownerId,
        action: 'subscription.plan_change_scheduled',
        entityType: 'subscription',
        entityId: sub.id,
        afterState: { fromPlan: sub.plan, pendingPlan: targetPlan },
      },
      db,
      now,
    );
  }
  return { ok: true };
}

/**
 * Bekleyen plan değişimini iptal et (pendingPlan = NULL) — H2.
 */
export async function cancelScheduledPlanChange(
  companyId: string,
  db: DbClient,
  opts?: { now?: Date },
): Promise<{ ok: boolean; reason?: 'not_found' }> {
  const now = opts?.now ?? new Date();

  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.companyId, companyId),
        inArray(subscriptions.status, ['active', 'past_due']),
        isNotNull(subscriptions.pendingPlan),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  const sub = rows[0];
  if (!sub) return { ok: false, reason: 'not_found' };

  await db
    .update(subscriptions)
    .set({ pendingPlan: null, updatedAt: now })
    .where(eq(subscriptions.id, sub.id));

  const ownerId = await findCompanyOwner(db, companyId);
  if (ownerId) {
    await writeAuditLog(
      {
        companyId,
        userId: ownerId,
        action: 'subscription.plan_change_cancelled',
        entityType: 'subscription',
        entityId: sub.id,
        afterState: { pendingPlan: null },
      },
      db,
      now,
    );
  }
  return { ok: true };
}
