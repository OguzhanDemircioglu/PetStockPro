/**
 * Audit Log listing — Sprint 7c süperadmin viewer için foundation.
 *
 * Şu an /admin/audit-log read-only sayfası tenant-scoped son N audit
 * kaydı gösterir. Süperadmin tarafından sistem-geneli viewer Sprint 7c'de.
 */

import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
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
  /** ISO date string "YYYY-MM-DD" — gün başlangıcı (00:00 UTC) >= */
  fromDate?: string;
  /** ISO date string "YYYY-MM-DD" — gün sonu (ertesi gün 00:00 UTC) < */
  toDate?: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function parseDateBoundary(
  iso: string,
  end: boolean,
): Date | null {
  // YYYY-MM-DD bekle
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (end) {
    // toDate dahil — ertesi günün başlangıcı (exclusive upper bound)
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
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
  if (opts.fromDate) {
    const from = parseDateBoundary(opts.fromDate, false);
    if (from) conditions.push(gte(auditLogs.createdAt, from));
  }
  if (opts.toDate) {
    const to = parseDateBoundary(opts.toDate, true);
    if (to) conditions.push(lt(auditLogs.createdAt, to));
  }

  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(0, opts.offset ?? 0);

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
    .limit(limit)
    .offset(offset);
}

/**
 * Aynı filtrelerle toplam audit log sayısı — pagination için.
 *
 * `listAuditLogs` ile aynı WHERE şartları, limit/offset/orderBy YOK.
 */
export async function countAuditLogs(
  companyId: string,
  db: DbClient,
  opts: Pick<
    ListAuditLogOptions,
    'action' | 'entityType' | 'userId' | 'fromDate' | 'toDate'
  > = {},
): Promise<number> {
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
  if (opts.fromDate) {
    const from = parseDateBoundary(opts.fromDate, false);
    if (from) conditions.push(gte(auditLogs.createdAt, from));
  }
  if (opts.toDate) {
    const to = parseDateBoundary(opts.toDate, true);
    if (to) conditions.push(lt(auditLogs.createdAt, to));
  }

  const rows = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(auditLogs)
    .where(and(...conditions));
  return rows[0]?.total ?? 0;
}

export interface AuditUserOption {
  userId: string;
  email: string;
}

/**
 * Tenant'ın audit log'larında görünen kullanıcı listesi —
 * filter dropdown'u için.
 */
export async function listAuditUsers(
  companyId: string,
  db: DbClient,
): Promise<AuditUserOption[]> {
  return db
    .selectDistinctOn([auditLogs.userId], {
      userId: auditLogs.userId,
      email: users.email,
    })
    .from(auditLogs)
    .innerJoin(users, eq(users.id, auditLogs.userId))
    .where(eq(auditLogs.companyId, companyId))
    .orderBy(auditLogs.userId, users.email);
}
