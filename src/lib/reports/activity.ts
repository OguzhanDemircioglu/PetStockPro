/**
 * Audit aktivite özeti — Reports sayfası için.
 *
 * Son N günde audit_logs'tan action type bazında count + günlük seri.
 */

import { and, eq, gte, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { auditLogs } from '@/db/schema';

export interface ActivityCountRow {
  action: string;
  count: number;
}

/**
 * Tenant için son N gündeki audit log action'larını kategori bazlı sayar.
 * Sadece tenant'a ait audit (companyId match).
 */
export async function activityCountByAction(
  companyId: string,
  db: DbClient,
  days: number = 30,
  limit: number = 10,
): Promise<ActivityCountRow[]> {
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select({
      action: auditLogs.action,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.companyId, companyId),
        gte(auditLogs.createdAt, sql.raw(`'${sinceIso}'::timestamptz`)),
      ),
    )
    .groupBy(auditLogs.action)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);

  return rows as ActivityCountRow[];
}

export interface ActivityDailyRow {
  day: string; // YYYY-MM-DD
  count: number;
}

/**
 * Son N günde günlük audit log toplam sayısı (her gün için 1 row).
 */
export async function activityDailySummary(
  companyId: string,
  db: DbClient,
  days: number = 30,
): Promise<ActivityDailyRow[]> {
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select({
      day: sql<string>`TO_CHAR(DATE_TRUNC('day', ${auditLogs.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.companyId, companyId),
        gte(auditLogs.createdAt, sql.raw(`'${sinceIso}'::timestamptz`)),
      ),
    )
    .groupBy(sql`DATE_TRUNC('day', ${auditLogs.createdAt})`)
    .orderBy(sql`DATE_TRUNC('day', ${auditLogs.createdAt})`);

  return rows as ActivityDailyRow[];
}

export interface ActivityTotals {
  totalActions: number;
  uniqueActionTypes: number;
  uniqueUsers: number;
}

export async function activityTotals(
  companyId: string,
  db: DbClient,
  days: number = 30,
): Promise<ActivityTotals> {
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const rows = await db
    .select({
      totalActions: sql<number>`COUNT(*)::int`,
      uniqueActionTypes: sql<number>`COUNT(DISTINCT ${auditLogs.action})::int`,
      uniqueUsers: sql<number>`COUNT(DISTINCT ${auditLogs.userId})::int`,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.companyId, companyId),
        gte(auditLogs.createdAt, sql.raw(`'${sinceIso}'::timestamptz`)),
      ),
    );
  return (rows[0] ?? { totalActions: 0, uniqueActionTypes: 0, uniqueUsers: 0 }) as ActivityTotals;
}
