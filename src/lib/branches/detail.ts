/**
 * Branch detay sayfası için veri toplama — variant stok matrix + son hareketler.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  branchInventory,
  productVariants,
  products,
  stockMovements,
  users,
} from '@/db/schema';

export interface BranchVariantStock {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  stockQty: number;
  threshold: number;
  isLow: boolean; // stockQty <= threshold
  isZero: boolean;
}

export interface BranchMovementRow {
  id: string;
  type: string;
  subtype: string | null;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  productName: string;
  variantLabel: string;
  createdAt: Date;
  createdByEmail: string | null;
  reason: string | null;
}

/**
 * Belirli şubeye ait variant stok listesi. Tüm aktif variant'lar görünür,
 * branch_inventory satırı yoksa stock=0 olarak gösterilir.
 */
export async function listBranchVariantStock(
  companyId: string,
  branchId: string,
  db: DbClient,
): Promise<BranchVariantStock[]> {
  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: productVariants.productId,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      stockQty: sql<number>`COALESCE(${branchInventory.stockQty}, 0)::int`,
      threshold: productVariants.threshold,
      branchThresholds: productVariants.branchThresholds,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      branchInventory,
      and(
        eq(branchInventory.variantId, productVariants.id),
        eq(branchInventory.branchId, branchId),
      ),
    )
    .where(and(eq(productVariants.companyId, companyId), eq(productVariants.isActive, true)))
    .orderBy(products.name, productVariants.displayOrder);

  return rows.map((r) => {
    const perBranchThreshold = r.branchThresholds?.[branchId];
    const threshold = perBranchThreshold ?? r.threshold;
    return {
      variantId: r.variantId,
      productId: r.productId,
      productName: r.productName,
      variantLabel: r.variantLabel,
      sku: r.sku,
      stockQty: r.stockQty,
      threshold,
      isLow: r.stockQty <= threshold,
      isZero: r.stockQty === 0,
    };
  });
}

/**
 * Şubedeki son N stok hareketi.
 */
export async function listBranchRecentMovements(
  companyId: string,
  branchId: string,
  db: DbClient,
  limit: number = 12,
): Promise<BranchMovementRow[]> {
  const rows = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      subtype: stockMovements.subtype,
      quantity: stockMovements.quantity,
      beforeQty: stockMovements.beforeQty,
      afterQty: stockMovements.afterQty,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      createdAt: stockMovements.createdAt,
      createdByEmail: users.email,
      reason: stockMovements.reason,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(users, eq(users.id, stockMovements.createdById))
    .where(
      and(eq(stockMovements.companyId, companyId), eq(stockMovements.branchId, branchId)),
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);

  return rows as BranchMovementRow[];
}
