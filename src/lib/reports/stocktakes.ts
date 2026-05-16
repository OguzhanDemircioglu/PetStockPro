/**
 * Stocktake history report — Sprint 11 ext
 *
 * Reports sayfasına "Sayım geçmişi" kart için son N tamamlanan/iptal sayım
 * + özet (toplam diff items + value impact + duration).
 *
 * Period filter: son X gün içindeki closedAt'i olan sayımlar.
 */

import { and, eq, gte, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { stocktakes, branches, users } from '@/db/schema';

export interface StocktakeHistoryRow {
  id: string;
  branchName: string | null;
  status: 'completed' | 'cancelled';
  totalItems: number;
  countedItems: number;
  diffItems: number;
  startedAt: Date;
  closedAt: Date | null;
  durationMinutes: number | null;
  startedByEmail: string | null;
}

export interface StocktakeHistorySummary {
  completedCount: number;
  cancelledCount: number;
  totalDiffItems: number;
  avgDurationMinutes: number | null;
}

/**
 * Son N gün içinde kapanan sayımları döner — closedAt ile filtre.
 */
export async function listStocktakeHistory(
  companyId: string,
  db: DbClient,
  days: number = 30,
  limit: number = 10,
): Promise<StocktakeHistoryRow[]> {
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select({
      id: stocktakes.id,
      branchName: branches.name,
      status: stocktakes.status,
      totalItems: stocktakes.totalItems,
      countedItems: stocktakes.countedItems,
      diffItems: stocktakes.diffItems,
      startedAt: stocktakes.startedAt,
      closedAt: stocktakes.closedAt,
      startedByEmail: users.email,
    })
    .from(stocktakes)
    .leftJoin(branches, eq(branches.id, stocktakes.branchId))
    .leftJoin(users, eq(users.id, stocktakes.startedById))
    .where(
      and(
        eq(stocktakes.companyId, companyId),
        sql`${stocktakes.status} IN ('completed', 'cancelled')`,
        gte(stocktakes.closedAt, sql.raw(`'${sinceIso}'::timestamptz`)),
      ),
    )
    .orderBy(sql`${stocktakes.closedAt} DESC`)
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    status: r.status as 'completed' | 'cancelled',
    durationMinutes:
      r.startedAt && r.closedAt
        ? Math.round((new Date(r.closedAt).getTime() - new Date(r.startedAt).getTime()) / 60000)
        : null,
  }));
}

/**
 * Özet metrikler — N gün içinde tamamlanan/iptal edilen sayım sayısı + ortalama süre.
 */
export async function stocktakeHistorySummary(
  companyId: string,
  db: DbClient,
  days: number = 30,
): Promise<StocktakeHistorySummary> {
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select({
      completedCount: sql<number>`COUNT(*) FILTER (WHERE ${stocktakes.status} = 'completed')::int`,
      cancelledCount: sql<number>`COUNT(*) FILTER (WHERE ${stocktakes.status} = 'cancelled')::int`,
      totalDiffItems: sql<number>`COALESCE(SUM(${stocktakes.diffItems}) FILTER (WHERE ${stocktakes.status} = 'completed'), 0)::int`,
      avgDurationMinutes: sql<number | null>`AVG(
        EXTRACT(EPOCH FROM (${stocktakes.closedAt} - ${stocktakes.startedAt})) / 60
      ) FILTER (WHERE ${stocktakes.status} = 'completed')`,
    })
    .from(stocktakes)
    .where(
      and(
        eq(stocktakes.companyId, companyId),
        sql`${stocktakes.status} IN ('completed', 'cancelled')`,
        gte(stocktakes.closedAt, sql.raw(`'${sinceIso}'::timestamptz`)),
      ),
    );

  const r = rows[0] ?? {
    completedCount: 0,
    cancelledCount: 0,
    totalDiffItems: 0,
    avgDurationMinutes: null,
  };

  return {
    completedCount: r.completedCount ?? 0,
    cancelledCount: r.cancelledCount ?? 0,
    totalDiffItems: r.totalDiffItems ?? 0,
    avgDurationMinutes:
      r.avgDurationMinutes != null ? Math.round(Number(r.avgDurationMinutes)) : null,
  };
}
