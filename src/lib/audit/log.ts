/**
 * Audit Log — Sprint 1A schema + Sprint 7c süperadmin viewer için foundation
 *
 * writeAuditLog: tenant-aware immutable log writer (append-only).
 * Helper'lara opsiyonel parametre olarak geçirilir, çağıran action sonrası
 * yazılır (transaction içine alınabilir veya fire-and-forget).
 *
 * Action pattern: 'entity.action' (Sprint 1A KT2-3 onayı — varchar(100)
 * yeterli esneklik).
 *
 * Örnekler:
 *   product.created / product.updated / product.deleted (soft)
 *   stock.in / stock.out / stock.transfer / stock.stocktake / stock.reversed
 *   branch.created / branch.updated / branch.activated / branch.deactivated
 *   supplier.created / supplier.updated / supplier.activated / supplier.deactivated
 *   brand.created / brand.updated / brand.deleted
 *   category.created / category.updated / category.deleted
 *   company.updated / company.vat_no_set
 *   user.invited / user.logged_in / user.password_reset
 *   storefront.published / storefront.unpublished / storefront.auto_unpublished
 *
 * before/after state JSON: kullanıcıya neyin değiştiği gösterilebilir.
 * Süperadmin override izi: performedAsSuperadmin + session/reason/silent.
 */

import type { DbClient } from '@/lib/db/client';
import { auditLogs } from '@/db/schema';

export interface AuditLogEntry {
  companyId: string;
  userId: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  performedAsSuperadmin?: boolean;
  superadminSessionId?: string | null;
  superadminActionType?:
    | 'impersonation'
    | 'bypass'
    | 'dbfix'
    | 'system'
    | 'user'
    | null;
  superadminReason?: string | null;
  superadminSilent?: boolean | null;
}

/**
 * Audit log insert. Hata durumunda sessiz yutar (audit log fail asla
 * caller'ı bozmamalı — log yoksa veri yoksa, kaybedildiyse Sentry yakalar).
 *
 * dbClient ham veya transaction olabilir; çağıran sorumlu.
 */
export async function writeAuditLog(
  entry: AuditLogEntry,
  db: DbClient,
  now: Date = new Date(),
): Promise<{ ok: boolean }> {
  try {
    await db.insert(auditLogs).values({
      companyId: entry.companyId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      beforeState: entry.beforeState ?? null,
      afterState: entry.afterState ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      performedAsSuperadmin: entry.performedAsSuperadmin ?? false,
      superadminSessionId: entry.superadminSessionId ?? null,
      superadminActionType: entry.superadminActionType ?? null,
      superadminReason: entry.superadminReason ?? null,
      superadminSilent: entry.superadminSilent ?? null,
      createdAt: now,
    });
    return { ok: true };
  } catch {
    // Audit log fail asla caller'ı bozmasın.
    // Production: Sentry.captureException(err).
    return { ok: false };
  }
}

/**
 * Fire-and-forget wrapper — async ama await edilmez, log fail caller'ı etkilemez.
 * Server actions içinde tipik kullanım.
 */
export function writeAuditLogAsync(entry: AuditLogEntry, db: DbClient): void {
  void writeAuditLog(entry, db).catch(() => {
    // Sessiz — production'da Sentry'ye gider
  });
}
