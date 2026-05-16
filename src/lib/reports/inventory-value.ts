/**
 * Stok değer raporu — Sprint 11 ext.
 *
 * Mevcut stok değerini (cost-based) hesaplar:
 *   - Tüm aktif variant'ların branch_inventory satırları
 *   - SUM(stock_qty * cost_price) → total inventory value
 *   - Kategori bazında breakdown (en pahalı 10)
 *   - Variant başına detay (en pahalı 20 satır)
 *
 * cost_price NULL veya 0 olan variant'lar değer hesabına dahil edilmez
 * (uyarı kart için ayrı sayım — `missingCostCount`).
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  branchInventory,
  productVariants,
  products,
  categories,
} from '@/db/schema';

export interface InventoryValueSummary {
  totalQty: number;
  totalValueCost: string; // sayısal aggregate string olarak döner (postgres-js bigint)
  variantCount: number;
  missingCostCount: number; // cost_price NULL/0 olan variantlar
  branchCount: number;
}

export async function getInventoryValueSummary(
  companyId: string,
  db: DbClient,
): Promise<InventoryValueSummary> {
  const rows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(${branchInventory.stockQty}), 0)::int AS total_qty,
      COALESCE(SUM(${branchInventory.stockQty} * ${productVariants.costPrice}::numeric), 0)::text AS total_value_cost,
      COUNT(DISTINCT ${productVariants.id})::int AS variant_count,
      COUNT(DISTINCT CASE WHEN ${productVariants.costPrice} IS NULL OR ${productVariants.costPrice}::numeric = 0 THEN ${productVariants.id} END)::int AS missing_cost_count,
      COUNT(DISTINCT ${branchInventory.branchId})::int AS branch_count
    FROM ${branchInventory}
    INNER JOIN ${productVariants} ON ${productVariants.id} = ${branchInventory.variantId}
    INNER JOIN ${products} ON ${products.id} = ${productVariants.productId}
    WHERE ${branchInventory.companyId} = ${companyId}
      AND ${productVariants.isActive} = true
      AND ${products.deletedAt} IS NULL
  `)) as unknown as Array<{
    total_qty: number;
    total_value_cost: string;
    variant_count: number;
    missing_cost_count: number;
    branch_count: number;
  }>;

  const r = rows[0] ?? {
    total_qty: 0,
    total_value_cost: '0',
    variant_count: 0,
    missing_cost_count: 0,
    branch_count: 0,
  };

  return {
    totalQty: r.total_qty,
    totalValueCost: r.total_value_cost,
    variantCount: r.variant_count,
    missingCostCount: r.missing_cost_count,
    branchCount: r.branch_count,
  };
}

export interface InventoryValueByCategoryRow {
  categoryId: string | null;
  categoryName: string;
  categoryEmoji: string | null;
  totalQty: number;
  totalValueCost: string;
  productCount: number;
}

export async function getInventoryValueByCategory(
  companyId: string,
  db: DbClient,
  limit: number = 10,
): Promise<InventoryValueByCategoryRow[]> {
  const rows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      categoryEmoji: categories.emoji,
      totalQty: sql<number>`COALESCE(SUM(${branchInventory.stockQty}), 0)::int`,
      totalValueCost: sql<string>`COALESCE(SUM(${branchInventory.stockQty} * ${productVariants.costPrice}::numeric), 0)::text`,
      productCount: sql<number>`COUNT(DISTINCT ${products.id})::int`,
    })
    .from(branchInventory)
    .innerJoin(productVariants, eq(productVariants.id, branchInventory.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(branchInventory.companyId, companyId),
        eq(productVariants.isActive, true),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .groupBy(categories.id, categories.name, categories.emoji)
    .orderBy(sql`COALESCE(SUM(${branchInventory.stockQty} * ${productVariants.costPrice}::numeric), 0) DESC`)
    .limit(limit);

  // null category → "Kategorisiz" normalize
  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName ?? 'Kategorisiz',
    categoryEmoji: r.categoryEmoji,
    totalQty: r.totalQty,
    totalValueCost: r.totalValueCost,
    productCount: r.productCount,
  }));
}

export interface InventoryValueTopVariant {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  sku: string;
  totalQty: number;
  unitCost: string | null;
  totalValueCost: string;
}

export async function getTopInventoryValueVariants(
  companyId: string,
  db: DbClient,
  limit: number = 20,
): Promise<InventoryValueTopVariant[]> {
  return db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      totalQty: sql<number>`COALESCE(SUM(${branchInventory.stockQty}), 0)::int`,
      unitCost: productVariants.costPrice,
      totalValueCost: sql<string>`COALESCE(SUM(${branchInventory.stockQty} * ${productVariants.costPrice}::numeric), 0)::text`,
    })
    .from(branchInventory)
    .innerJoin(productVariants, eq(productVariants.id, branchInventory.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(branchInventory.companyId, companyId),
        eq(productVariants.isActive, true),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .groupBy(
      productVariants.id,
      products.id,
      products.name,
      productVariants.valueLabel,
      productVariants.sku,
      productVariants.costPrice,
    )
    .orderBy(desc(sql`SUM(${branchInventory.stockQty} * ${productVariants.costPrice}::numeric)`))
    .limit(limit);
}
