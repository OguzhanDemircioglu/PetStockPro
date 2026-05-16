/**
 * Müşteri analitik — Sprint 11 ext.
 *
 * Pet shop'ta isim/telefon tutulmuyor (kasiyer hızlı satış kaydeder),
 * ama satış movement'ında `customerRef` opsiyonel field var (vitrin
 * referans kodu, telefon, isim, fatura no — pet shop kendi kullanımıyla
 * doldurur). Bu free-text alan en yaygın değerleri gruplayıp top
 * alıcılar / sıklık / ciro istatistiği üretebiliriz.
 *
 * Üç helper:
 *   1. topCustomers — customerRef bazında SUM(qty + revenue) top N
 *   2. customerSummary — toplam unique customerRef sayısı + named/
 *      anonim oranı (creditli satışlarda customerRef zorunlu, sale'de
 *      opsiyonel — gösterge)
 *   3. busiestHours — günün hangi saatinde en çok satış (0-23 saat
 *      bazlı qty + revenue)
 */

import { and, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { stockMovements } from '@/db/schema';

export interface TopCustomerRow {
  customerRef: string;
  salesCount: number;
  totalQty: number;
  totalRevenue: string;
  lastSaleAt: Date;
}

export async function topCustomers(
  companyId: string,
  db: DbClient,
  days: number = 30,
  limit: number = 10,
  now: Date = new Date(),
): Promise<TopCustomerRow[]> {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return db
    .select({
      customerRef: stockMovements.customerRef,
      salesCount: sql<number>`COUNT(*)::int`,
      totalQty: sql<number>`COALESCE(SUM(ABS(${stockMovements.quantity})), 0)::int`,
      totalRevenue: sql<string>`COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)), 0)::text`,
      lastSaleAt: sql<Date>`MAX(${stockMovements.createdAt})`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.companyId, companyId),
        eq(stockMovements.type, 'stock_out'),
        eq(stockMovements.subtype, 'sale'),
        sql`${stockMovements.customerRef} IS NOT NULL`,
        sql`${stockMovements.reversedById} IS NULL`,
        sql`${stockMovements.reversesId} IS NULL`,
        sql`${stockMovements.createdAt} >= ${sql.raw(`'${from.toISOString()}'::timestamptz`)}`,
      ),
    )
    .groupBy(stockMovements.customerRef)
    .orderBy(sql`SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)) DESC`)
    .limit(limit) as Promise<TopCustomerRow[]>;
}

export interface CustomerSummary {
  uniqueCustomers: number;
  totalSalesWithRef: number;
  totalSalesAnonymous: number;
  creditSalesCount: number;
  creditPaidCount: number;
}

export async function customerSummary(
  companyId: string,
  db: DbClient,
  days: number = 30,
  now: Date = new Date(),
): Promise<CustomerSummary> {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = (await db.execute(sql`
    SELECT
      COUNT(DISTINCT ${stockMovements.customerRef})::int AS unique_customers,
      COUNT(*) FILTER (WHERE ${stockMovements.customerRef} IS NOT NULL)::int AS with_ref,
      COUNT(*) FILTER (WHERE ${stockMovements.customerRef} IS NULL)::int AS anonymous,
      COUNT(*) FILTER (WHERE ${stockMovements.paymentMethod} = 'credit')::int AS credit_count,
      COUNT(*) FILTER (WHERE ${stockMovements.paymentMethod} = 'credit' AND ${stockMovements.creditPaidAt} IS NOT NULL)::int AS credit_paid_count
    FROM ${stockMovements}
    WHERE ${stockMovements.companyId} = ${companyId}
      AND ${stockMovements.type} = 'stock_out'
      AND ${stockMovements.subtype} = 'sale'
      AND ${stockMovements.reversedById} IS NULL
      AND ${stockMovements.reversesId} IS NULL
      AND ${stockMovements.createdAt} >= ${sql.raw(`'${from.toISOString()}'::timestamptz`)}
  `)) as unknown as Array<{
    unique_customers: number;
    with_ref: number;
    anonymous: number;
    credit_count: number;
    credit_paid_count: number;
  }>;

  const r = rows[0] ?? {
    unique_customers: 0,
    with_ref: 0,
    anonymous: 0,
    credit_count: 0,
    credit_paid_count: 0,
  };

  return {
    uniqueCustomers: r.unique_customers,
    totalSalesWithRef: r.with_ref,
    totalSalesAnonymous: r.anonymous,
    creditSalesCount: r.credit_count,
    creditPaidCount: r.credit_paid_count,
  };
}

export interface HourlyBreakdownRow {
  hour: number; // 0-23
  qty: number;
  revenue: string;
  count: number;
}

export async function busiestHours(
  companyId: string,
  db: DbClient,
  days: number = 30,
  now: Date = new Date(),
): Promise<HourlyBreakdownRow[]> {
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = (await db.execute(sql`
    SELECT
      EXTRACT(HOUR FROM ${stockMovements.createdAt} AT TIME ZONE 'Europe/Istanbul')::int AS hour,
      COALESCE(SUM(ABS(${stockMovements.quantity})), 0)::int AS qty,
      COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)), 0)::text AS revenue,
      COUNT(*)::int AS count
    FROM ${stockMovements}
    WHERE ${stockMovements.companyId} = ${companyId}
      AND ${stockMovements.type} = 'stock_out'
      AND ${stockMovements.subtype} = 'sale'
      AND ${stockMovements.reversedById} IS NULL
      AND ${stockMovements.reversesId} IS NULL
      AND ${stockMovements.createdAt} >= ${sql.raw(`'${from.toISOString()}'::timestamptz`)}
    GROUP BY 1
    ORDER BY 1
  `)) as unknown as Array<{
    hour: number;
    qty: number;
    revenue: string;
    count: number;
  }>;
  return rows.map((r) => ({
    hour: r.hour,
    qty: r.qty,
    revenue: r.revenue,
    count: r.count,
  }));
}
