/**
 * Period karşılaştırma — bu hafta vs geçen hafta, bu ay vs geçen ay.
 *
 * KPI delta hesabı için: 2 dönemi paralel sorgu + yüzde değişim.
 * Sıfırdan büyümeye karşı koruma: önceki dönem 0 ise yüzde
 * Infinity yerine "yeni" işareti (UI side `previousZero` flag).
 */

import { sql } from 'drizzle-orm';
import type { TenantDb } from '@/lib/db/with-tenant';
import { stockMovements } from '@/db/schema';

export interface PeriodSummary {
  qty: number;
  revenue: string;
  saleCount: number;
}

async function rangeSummary(
  companyId: string,
  db: TenantDb,
  from: Date,
  to: Date,
): Promise<PeriodSummary> {
  const rows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(ABS(${stockMovements.quantity})), 0)::int AS qty,
      COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)), 0)::text AS revenue,
      COUNT(*)::int AS sale_count
    FROM ${stockMovements}
    WHERE ${stockMovements.companyId} = ${companyId}
      AND ${stockMovements.type} = 'stock_out'
      AND ${stockMovements.subtype} = 'sale'
      AND ${stockMovements.reversedById} IS NULL
      AND ${stockMovements.reversesId} IS NULL
      AND ${stockMovements.createdAt} >= ${sql.raw(`'${from.toISOString()}'::timestamptz`)}
      AND ${stockMovements.createdAt} < ${sql.raw(`'${to.toISOString()}'::timestamptz`)}
  `)) as unknown as Array<{ qty: number; revenue: string; sale_count: number }>;

  const r = rows[0] ?? { qty: 0, revenue: '0', sale_count: 0 };
  return { qty: r.qty, revenue: r.revenue, saleCount: r.sale_count };
}

export interface PeriodComparisonResult {
  label: 'week' | 'month';
  current: PeriodSummary;
  previous: PeriodSummary;
  qtyChangePct: number | null; // null = previous=0 (newly active)
  revenueChangePct: number | null;
  countChangePct: number | null;
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

export async function getPeriodComparison(
  companyId: string,
  db: TenantDb,
  label: 'week' | 'month',
  now: Date = new Date(),
): Promise<PeriodComparisonResult> {
  const periodMs = (label === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000;
  const currentFrom = new Date(now.getTime() - periodMs);
  const previousFrom = new Date(currentFrom.getTime() - periodMs);

  const [current, previous] = await Promise.all([
    rangeSummary(companyId, db, currentFrom, now),
    rangeSummary(companyId, db, previousFrom, currentFrom),
  ]);

  const currentRev = Number(current.revenue || 0);
  const previousRev = Number(previous.revenue || 0);

  return {
    label,
    current,
    previous,
    qtyChangePct: pct(current.qty, previous.qty),
    revenueChangePct: pct(currentRev, previousRev),
    countChangePct: pct(current.saleCount, previous.saleCount),
  };
}

/**
 * UI helper: yüzde formatlama.
 *
 * pct=null → "yeni" (previous 0 + current > 0)
 * pct=0 → "—"
 * pct>0 → "+%X"
 * pct<0 → "-%X"
 */
export function formatChangePct(value: number | null): {
  label: string;
  tone: 'up' | 'down' | 'neutral' | 'new';
} {
  if (value === null) return { label: 'yeni', tone: 'new' };
  if (value === 0) return { label: '—', tone: 'neutral' };
  if (value > 0) return { label: `+%${value.toFixed(0)}`, tone: 'up' };
  return { label: `%${value.toFixed(0)}`, tone: 'down' };
}
