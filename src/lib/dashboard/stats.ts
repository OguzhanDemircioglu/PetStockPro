/**
 * Dashboard stats — Sprint 8 Pano
 *
 * getDashboardStats: tek tenant için pano metrikleri.
 * - Toplam ürün / aktif variant / toplam stok birimleri
 * - Şube sayısı
 * - Günlük satış (bugünkü stock_out type sale)
 * - Düşük stok variantları (per branch threshold karşılaştırması)
 * - Son hareket feed (Sprint 4 ledger'dan son 10)
 *
 * Branch-level thresholds JSONB'de: `productVariants.branchThresholds`.
 * Genel threshold: `productVariants.threshold`.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { TenantDb } from '@/lib/db/with-tenant';
import {
  branches,
  branchInventory,
  productVariants,
  products,
  stockMovements,
} from '@/db/schema';

export interface DashboardStats {
  totalProducts: number;
  totalActiveVariants: number;
  totalStockQty: number;
  branchCount: number;
  todaySaleQty: number;
  todaySaleRevenue: string;
  lowStockCount: number;
}

export async function getDashboardStats(
  companyId: string,
  db: TenantDb,
): Promise<DashboardStats> {
  // Tek SELECT'te tüm aggregates — performans için.
  // "Bugün" hesabı için DATE_TRUNC('day', NOW()) — Drizzle parametre
  // marshalling'inde Date geçince postgres-js hata atıyor.
  const rows = await db
    .select({
      totalProducts: sql<number>`(
        SELECT COUNT(*)::int FROM ${products}
        WHERE ${products.companyId} = ${companyId}
          AND ${products.deletedAt} IS NULL
      )`,
      totalActiveVariants: sql<number>`(
        SELECT COUNT(*)::int FROM ${productVariants}
        WHERE ${productVariants.companyId} = ${companyId}
          AND ${productVariants.isActive} = true
      )`,
      totalStockQty: sql<number>`(
        SELECT COALESCE(SUM(${branchInventory.stockQty}), 0)::int
        FROM ${branchInventory}
        WHERE ${branchInventory.companyId} = ${companyId}
      )`,
      branchCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${branches}
        WHERE ${branches.companyId} = ${companyId}
          AND ${branches.isActive} = true
      )`,
      todaySaleQty: sql<number>`(
        SELECT COALESCE(SUM(ABS(${stockMovements.quantity})), 0)::int
        FROM ${stockMovements}
        WHERE ${stockMovements.companyId} = ${companyId}
          AND ${stockMovements.type} = 'stock_out'
          AND ${stockMovements.subtype} = 'sale'
          AND ${stockMovements.createdAt} >= DATE_TRUNC('day', NOW())
          AND ${stockMovements.reversedById} IS NULL
      )`,
      todaySaleRevenue: sql<string | null>`(
        SELECT COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)), 0)::text
        FROM ${stockMovements}
        WHERE ${stockMovements.companyId} = ${companyId}
          AND ${stockMovements.type} = 'stock_out'
          AND ${stockMovements.subtype} = 'sale'
          AND ${stockMovements.createdAt} >= DATE_TRUNC('day', NOW())
          AND ${stockMovements.reversedById} IS NULL
      )`,
      lowStockCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${branchInventory} bi
        JOIN ${productVariants} pv ON pv.id = bi.variant_id
        WHERE bi.company_id = ${companyId}
          AND pv.is_active = true
          AND bi.stock_qty <= COALESCE(
            (pv.branch_thresholds ->> bi.branch_id::text)::int,
            pv.threshold
          )
      )`,
    })
    .from(sql`(SELECT 1) AS dummy`);

  const r = rows[0];
  return {
    totalProducts: r?.totalProducts ?? 0,
    totalActiveVariants: r?.totalActiveVariants ?? 0,
    totalStockQty: r?.totalStockQty ?? 0,
    branchCount: r?.branchCount ?? 0,
    todaySaleQty: r?.todaySaleQty ?? 0,
    todaySaleRevenue: r?.todaySaleRevenue ?? '0',
    lowStockCount: r?.lowStockCount ?? 0,
  };
}

export interface LowStockItem {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  branchId: string;
  branchName: string;
  stockQty: number;
  threshold: number;
}

export interface ListLowStockOptions {
  limit?: number;
  categoryId?: string;
  branchId?: string;
}

export async function listLowStock(
  companyId: string,
  db: TenantDb,
  limitOrOpts: number | ListLowStockOptions = 10,
): Promise<LowStockItem[]> {
  const opts: ListLowStockOptions =
    typeof limitOrOpts === 'number' ? { limit: limitOrOpts } : limitOrOpts;
  const limit = opts.limit ?? 10;

  const conditions = [
    eq(branchInventory.companyId, companyId),
    eq(productVariants.isActive, true),
    sql`${branchInventory.stockQty} <= COALESCE(
      (${productVariants.branchThresholds} ->> ${branches.id}::text)::int,
      ${productVariants.threshold}
    )`,
  ];
  if (opts.categoryId) {
    conditions.push(eq(products.categoryId, opts.categoryId));
  }
  if (opts.branchId) {
    conditions.push(eq(branchInventory.branchId, opts.branchId));
  }

  return db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      branchId: branches.id,
      branchName: branches.name,
      stockQty: branchInventory.stockQty,
      threshold: sql<number>`COALESCE(
        (${productVariants.branchThresholds} ->> ${branches.id}::text)::int,
        ${productVariants.threshold}
      )`,
    })
    .from(branchInventory)
    .innerJoin(productVariants, eq(productVariants.id, branchInventory.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(branches, eq(branches.id, branchInventory.branchId))
    .where(and(...conditions))
    .orderBy(sql`${branchInventory.stockQty} ASC`)
    .limit(limit);
}

export interface ActivityItem {
  id: string;
  type: string;
  subtype: string | null;
  quantity: number;
  productName: string;
  variantLabel: string;
  branchName: string;
  createdAt: Date;
}

export async function listRecentActivity(
  companyId: string,
  db: TenantDb,
  limit: number = 8,
): Promise<ActivityItem[]> {
  return db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      subtype: stockMovements.subtype,
      quantity: stockMovements.quantity,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      branchName: branches.name,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(branches, eq(branches.id, stockMovements.branchId))
    .where(eq(stockMovements.companyId, companyId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
}
