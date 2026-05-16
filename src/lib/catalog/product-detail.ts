/**
 * Product detail view — variant × şube stok matrix + son hareketler.
 * Mevcut getProductDetail edit için tek-variant minimal.
 * Burası view-only zengin detay: tüm variantlar × tüm şubeler matrix.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  branchInventory,
  branches,
  productVariants,
  products,
  stockMovements,
  brands,
  categories,
  users,
} from '@/db/schema';

export interface ProductDetailRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  vitrinPublished: boolean;
  vitrinAutoUnpublishedReason: string | null;
  totalStockQty: number;
  categoryName: string | null;
  brandName: string | null;
  createdAt: Date;
}

export async function getProductDetailFull(
  companyId: string,
  productId: string,
  db: DbClient,
): Promise<ProductDetailRow | null> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      isActive: products.isActive,
      vitrinPublished: products.vitrinPublished,
      vitrinAutoUnpublishedReason: products.vitrinAutoUnpublishedReason,
      totalStockQty: products.totalStockQty,
      categoryName: categories.name,
      brandName: brands.name,
      createdAt: products.createdAt,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(
      and(
        eq(products.id, productId),
        eq(products.companyId, companyId),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export interface VariantBranchCell {
  variantId: string;
  variantLabel: string;
  sku: string;
  salePrice: string;
  threshold: number;
  isActive: boolean;
  isDefault: boolean;
  branches: { branchId: string; branchName: string; stockQty: number }[];
  totalStockQty: number;
}

/**
 * Variant'ları liste, her birinin tüm aktif şubedeki stoklarını ekle.
 */
export async function getProductVariantMatrix(
  companyId: string,
  productId: string,
  db: DbClient,
): Promise<{
  branches: { id: string; name: string }[];
  variants: VariantBranchCell[];
}> {
  const branchRows = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(eq(branches.companyId, companyId), eq(branches.isActive, true)))
    .orderBy(branches.name);

  const variantRows = await db
    .select({
      id: productVariants.id,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      salePrice: productVariants.salePrice,
      threshold: productVariants.threshold,
      isActive: productVariants.isActive,
      isDefault: productVariants.isDefault,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, productId),
        eq(productVariants.companyId, companyId),
      ),
    )
    .orderBy(productVariants.displayOrder);

  // Tüm variant_id'lerin tüm branch'lerdeki stok kaydı
  const variantIds = variantRows.map((v) => v.id);
  const branchIds = branchRows.map((b) => b.id);

  let inventoryRows: { branchId: string; variantId: string; stockQty: number }[] = [];
  if (variantIds.length > 0 && branchIds.length > 0) {
    inventoryRows = (await db
      .select({
        branchId: branchInventory.branchId,
        variantId: branchInventory.variantId,
        stockQty: branchInventory.stockQty,
      })
      .from(branchInventory)
      .where(
        and(
          eq(branchInventory.companyId, companyId),
          sql`${branchInventory.variantId} IN ${variantIds}`,
        ),
      )) as { branchId: string; variantId: string; stockQty: number }[];
  }

  // Pivot: variant.id × branch.id → stockQty
  const stockMap = new Map<string, number>(); // key: `${variantId}_${branchId}`
  for (const row of inventoryRows) {
    stockMap.set(`${row.variantId}_${row.branchId}`, row.stockQty);
  }

  const variantsWithBranches: VariantBranchCell[] = variantRows.map((v) => {
    const branchStocks = branchRows.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      stockQty: stockMap.get(`${v.id}_${b.id}`) ?? 0,
    }));
    const totalStockQty = branchStocks.reduce((s, br) => s + br.stockQty, 0);
    return {
      variantId: v.id,
      variantLabel: v.variantLabel,
      sku: v.sku,
      salePrice: v.salePrice,
      threshold: v.threshold,
      isActive: v.isActive,
      isDefault: v.isDefault,
      branches: branchStocks,
      totalStockQty,
    };
  });

  return { branches: branchRows, variants: variantsWithBranches };
}

export interface ProductMovementRow {
  id: string;
  type: string;
  subtype: string | null;
  quantity: number;
  afterQty: number;
  variantLabel: string;
  branchName: string;
  createdAt: Date;
  createdByEmail: string | null;
}

export async function listProductRecentMovements(
  companyId: string,
  productId: string,
  db: DbClient,
  limit: number = 12,
): Promise<ProductMovementRow[]> {
  const rows = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      subtype: stockMovements.subtype,
      quantity: stockMovements.quantity,
      afterQty: stockMovements.afterQty,
      variantLabel: productVariants.valueLabel,
      branchName: branches.name,
      createdAt: stockMovements.createdAt,
      createdByEmail: users.email,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .innerJoin(branches, eq(branches.id, stockMovements.branchId))
    .leftJoin(users, eq(users.id, stockMovements.createdById))
    .where(
      and(
        eq(stockMovements.companyId, companyId),
        eq(productVariants.productId, productId),
      ),
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    branchName: r.branchName ?? '—',
  })) as ProductMovementRow[];
}
