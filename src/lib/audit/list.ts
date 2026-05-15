/**
 * Audit Log listing — Sprint 7c süperadmin viewer için foundation.
 *
 * Şu an /admin/audit-log read-only sayfası tenant-scoped son N audit
 * kaydı gösterir. Süperadmin tarafından sistem-geneli viewer Sprint 7c'de.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { auditLogs, users } from '@/db/schema';

export interface AuditLogListItem {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userEmail: string | null;
  beforeState: unknown;
  afterState: unknown;
  performedAsSuperadmin: boolean;
  superadminReason: string | null;
}

export interface ListAuditLogOptions {
  action?: string;
  entityType?: string;
  userId?: string;
  limit?: number;
}

export async function listAuditLogs(
  companyId: string,
  db: DbClient,
  opts: ListAuditLogOptions = {},
): Promise<AuditLogListItem[]> {
  const conditions = [eq(auditLogs.companyId, companyId)];
  if (opts.action) {
    conditions.push(eq(auditLogs.action, opts.action));
  }
  if (opts.entityType) {
    conditions.push(eq(auditLogs.entityType, opts.entityType));
  }
  if (opts.userId) {
    conditions.push(eq(auditLogs.userId, opts.userId));
  }

  return db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      userEmail: sql<string | null>`${users.email}`,
      beforeState: auditLogs.beforeState,
      afterState: auditLogs.afterState,
      performedAsSuperadmin: auditLogs.performedAsSuperadmin,
      superadminReason: auditLogs.superadminReason,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(opts.limit ?? 100);
}
