/**
 * Süperadmin error listing — /admin/superadmin/errors (FAZ 2.B).
 */
import { desc, and, eq, gte, sql, type SQL } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { systemErrors, users, companies } from '@/db/schema';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ListErrorsFilter {
  severity?: ErrorSeverity;
  errorType?: string;
  resolved?: boolean;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface ErrorRow {
  id: string;
  errorType: string;
  message: string;
  stack: string | null;
  severity: ErrorSeverity;
  context: unknown;
  companyId: string | null;
  companyName: string | null;
  userId: string | null;
  userEmail: string | null;
  route: string | null;
  action: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedById: string | null;
  alertSentAt: string | null;
  createdAt: string;
}

const MAX_LIMIT = 500;

export async function listErrors(
  db: DbClient,
  filter: ListErrorsFilter = {},
): Promise<ErrorRow[]> {
  const limit = Math.min(filter.limit ?? 200, MAX_LIMIT);
  const conds: SQL[] = [];
  if (filter.severity) conds.push(eq(systemErrors.severity, filter.severity));
  if (filter.errorType)
    conds.push(eq(systemErrors.errorType, filter.errorType));
  if (typeof filter.resolved === 'boolean')
    conds.push(eq(systemErrors.resolved, filter.resolved));
  if (filter.fromDate) {
    const d = new Date(filter.fromDate);
    if (!Number.isNaN(d.getTime())) conds.push(gte(systemErrors.createdAt, d));
  }
  if (filter.toDate) {
    const d = new Date(filter.toDate);
    if (!Number.isNaN(d.getTime()))
      conds.push(sql`${systemErrors.createdAt} <= ${d.toISOString()}::timestamptz`);
  }

  try {
    const rows = await db
      .select({
        id: systemErrors.id,
        errorType: systemErrors.errorType,
        message: systemErrors.message,
        stack: systemErrors.stack,
        severity: systemErrors.severity,
        context: systemErrors.context,
        companyId: systemErrors.companyId,
        companyName: companies.name,
        userId: systemErrors.userId,
        userEmail: users.email,
        route: systemErrors.route,
        action: systemErrors.action,
        resolved: systemErrors.resolved,
        resolvedAt: systemErrors.resolvedAt,
        resolvedById: systemErrors.resolvedById,
        alertSentAt: systemErrors.alertSentAt,
        createdAt: systemErrors.createdAt,
      })
      .from(systemErrors)
      .leftJoin(companies, eq(systemErrors.companyId, companies.id))
      .leftJoin(users, eq(systemErrors.userId, users.id))
      .where(conds.length ? and(...conds) : sql`true`)
      .orderBy(desc(systemErrors.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      severity: r.severity as ErrorSeverity,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      alertSentAt: r.alertSentAt ? r.alertSentAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    // Migration 0022 henüz apply edilmemişse tabloyu sessiz boş döndür
    // (süperadmin sayfası 500 vermesin — UI graceful empty state).
    console.warn('[errors:list] query failed (migration apply edilmedi mi?):', err);
    return [];
  }
}

export interface ErrorStats {
  total24h: number;
  unresolved24h: number;
  critical24h: number;
  topTypes: Array<{ errorType: string; count: number }>;
}

export async function getErrorStats(
  db: DbClient,
  now: Date = new Date(),
): Promise<ErrorStats> {
  const window24h = new Date(now.getTime() - 24 * 3_600_000);
  try {
    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(systemErrors)
      .where(gte(systemErrors.createdAt, window24h));
    const unresolved = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(systemErrors)
      .where(
        and(
          gte(systemErrors.createdAt, window24h),
          eq(systemErrors.resolved, false),
        ),
      );
    const critical = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(systemErrors)
      .where(
        and(
          gte(systemErrors.createdAt, window24h),
          eq(systemErrors.severity, 'critical'),
        ),
      );
    const top = (await db.execute(sql`
      SELECT error_type, COUNT(*)::int AS cnt
      FROM petstockpro.system_errors
      WHERE created_at >= ${window24h.toISOString()}::timestamptz
      GROUP BY error_type
      ORDER BY cnt DESC
      LIMIT 5
    `)) as unknown as Array<{ error_type: string; cnt: number }>;
    return {
      total24h: total[0]?.count ?? 0,
      unresolved24h: unresolved[0]?.count ?? 0,
      critical24h: critical[0]?.count ?? 0,
      topTypes: top.map((t) => ({ errorType: t.error_type, count: t.cnt })),
    };
  } catch {
    return { total24h: 0, unresolved24h: 0, critical24h: 0, topTypes: [] };
  }
}

export async function setErrorResolved(
  db: DbClient,
  errorId: string,
  resolverId: string,
  resolved: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  const result = await db
    .update(systemErrors)
    .set({
      resolved,
      resolvedAt: resolved ? now : null,
      resolvedById: resolved ? resolverId : null,
    })
    .where(eq(systemErrors.id, errorId))
    .returning({ id: systemErrors.id });
  return result.length > 0;
}
