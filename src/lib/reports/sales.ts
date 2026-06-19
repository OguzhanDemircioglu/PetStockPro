/**
 * Reports — Sprint 11 minimal: Günlük satış özet
 *
 * dailySalesSummary: son N gün gün gün satış toplam (qty + revenue).
 * Reversed satışlar hariç tutulur.
 *
 * topSellingVariants: son N gün en çok satılan variant'lar.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { TenantDb } from '@/lib/db/with-tenant';
import {
  stockMovements,
  productVariants,
  products,
} from '@/db/schema';

export interface DailySalesRow {
  day: string; // YYYY-MM-DD
  qty: number;
  revenue: string;
  count: number; // hareket sayısı
}

export async function dailySalesSummary(
  companyId: string,
  db: TenantDb,
  days: number = 30,
  now: Date = new Date(),
): Promise<DailySalesRow[]> {
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      day: sql<string>`TO_CHAR(DATE_TRUNC('day', ${stockMovements.createdAt}), 'YYYY-MM-DD')`,
      qty: sql<number>`COALESCE(SUM(ABS(${stockMovements.quantity})), 0)::int`,
      revenue: sql<string>`COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.companyId, companyId),
        eq(stockMovements.type, 'stock_out'),
        eq(stockMovements.subtype, 'sale'),
        sql`${stockMovements.reversedById} IS NULL`,
        sql`${stockMovements.reversesId} IS NULL`,
        sql`${stockMovements.createdAt} >= ${sql.raw(`'${startDate.toISOString()}'::timestamptz`)}`,
      ),
    )
    .groupBy(sql`DATE_TRUNC('day', ${stockMovements.createdAt})`)
    .orderBy(desc(sql`DATE_TRUNC('day', ${stockMovements.createdAt})`));

  return rows;
}

export interface TopVariantRow {
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  totalQty: number;
  totalRevenue: string;
  saleCount: number;
}

export async function topSellingVariants(
  companyId: string,
  db: TenantDb,
  days: number = 30,
  limit: number = 10,
  now: Date = new Date(),
): Promise<TopVariantRow[]> {
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return db
    .select({
      variantId: productVariants.id,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      totalQty: sql<number>`COALESCE(SUM(ABS(${stockMovements.quantity})), 0)::int`,
      totalRevenue: sql<string>`COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)), 0)::text`,
      saleCount: sql<number>`COUNT(*)::int`,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(stockMovements.companyId, companyId),
        eq(stockMovements.type, 'stock_out'),
        eq(stockMovements.subtype, 'sale'),
        sql`${stockMovements.reversedById} IS NULL`,
        sql`${stockMovements.reversesId} IS NULL`,
        sql`${stockMovements.createdAt} >= ${sql.raw(`'${startDate.toISOString()}'::timestamptz`)}`,
      ),
    )
    .groupBy(productVariants.id, products.name, productVariants.valueLabel, productVariants.sku)
    .orderBy(desc(sql`SUM(ABS(${stockMovements.quantity}))`))
    .limit(limit);
}

export interface PeriodSummary {
  totalQty: number;
  totalRevenue: string;
  saleCount: number;
  avgBasket: string; // ortalama hareket başına satış (revenue / count)
}

export async function periodSummary(
  companyId: string,
  db: TenantDb,
  days: number = 30,
  now: Date = new Date(),
): Promise<PeriodSummary> {
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      totalQty: sql<number>`COALESCE(SUM(ABS(${stockMovements.quantity})), 0)::int`,
      totalRevenue: sql<string>`COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)), 0)::text`,
      saleCount: sql<number>`COUNT(*)::int`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.companyId, companyId),
        eq(stockMovements.type, 'stock_out'),
        eq(stockMovements.subtype, 'sale'),
        sql`${stockMovements.reversedById} IS NULL`,
        sql`${stockMovements.reversesId} IS NULL`,
        sql`${stockMovements.createdAt} >= ${sql.raw(`'${startDate.toISOString()}'::timestamptz`)}`,
      ),
    );

  const r = rows[0] ?? { totalQty: 0, totalRevenue: '0', saleCount: 0 };
  const revenue = parseFloat(r.totalRevenue);
  const avg = r.saleCount > 0 ? (revenue / r.saleCount).toFixed(2) : '0.00';
  return {
    totalQty: r.totalQty,
    totalRevenue: r.totalRevenue,
    saleCount: r.saleCount,
    avgBasket: avg,
  };
}
