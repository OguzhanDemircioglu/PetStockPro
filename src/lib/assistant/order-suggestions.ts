/**
 * PetPro Asistanı — Sipariş önerileri (Sprint 8 parça 1).
 *
 * Düşük stok variantlar için son tedarikçisi (en son stock_in geldiği)
 * ile yeniden sipariş önerisi üretir.
 *
 * Algoritma:
 *   1. branch_inventory satırları: stockQty <= threshold olanlar
 *   2. Her variant için son stock_in movement'tan supplierId al
 *   3. Önerilen qty = (threshold * 2) - currentStock — yeterli buffer
 *   4. Aynı variant farklı şubelerde düşükse şube bazlı satır üretir
 *   5. Tedarikçisi olmayan variantlar listede çıkar (supplierName=null)
 *
 * Pure aggregation — yeni movement üretmez, sadece öneri sunar.
 * Kullanıcı tarafından Pano'da görünür + "Stok girişi yap" linki ile drawer açar.
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { TenantDb } from '@/lib/db/with-tenant';
import {
  branchInventory,
  productVariants,
  products,
  branches,
  stockMovements,
  suppliers,
} from '@/db/schema';

export interface OrderSuggestion {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  sku: string;
  branchId: string;
  branchName: string;
  currentStock: number;
  threshold: number;
  suggestedQty: number;
  lastSupplierId: string | null;
  lastSupplierName: string | null;
  lastOrderDate: Date | null;
  lastUnitCost: string | null;
}

export async function listOrderSuggestions(
  companyId: string,
  db: TenantDb,
  limit: number = 10,
): Promise<OrderSuggestion[]> {
  // Düşük stok satırlarını çek + variant + ürün + şube join
  const lowRows = await db
    .select({
      variantId: branchInventory.variantId,
      branchId: branchInventory.branchId,
      currentStock: branchInventory.stockQty,
      threshold: productVariants.threshold,
      branchThresholds: productVariants.branchThresholds,
      productId: products.id,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      branchName: branches.name,
    })
    .from(branchInventory)
    .innerJoin(productVariants, eq(productVariants.id, branchInventory.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(branches, eq(branches.id, branchInventory.branchId))
    .where(
      and(
        eq(branchInventory.companyId, companyId),
        eq(productVariants.isActive, true),
        eq(branches.isActive, true),
        sql`${products.deletedAt} IS NULL`,
        sql`${branchInventory.stockQty} <= COALESCE(
          (${productVariants.branchThresholds} ->> ${branchInventory.branchId}::text)::int,
          ${productVariants.threshold}
        )`,
      ),
    )
    .orderBy(branchInventory.stockQty);

  if (lowRows.length === 0) return [];

  const sliced = lowRows.slice(0, limit);

  // Her variant için son stock_in movement'tan supplier al (toplu query, 1 round-trip).
  const variantIds = Array.from(new Set(sliced.map((r) => r.variantId)));
  type LastSupplier = {
    variantId: string;
    supplierId: string | null;
    supplierName: string | null;
    createdAt: Date;
    unitCost: string | null;
  };

  let lastSupplierByVariant: Map<string, LastSupplier> = new Map();
  if (variantIds.length > 0) {
    const supplierRows = await db
      .select({
        variantId: stockMovements.variantId,
        supplierId: stockMovements.supplierId,
        supplierName: suppliers.name,
        createdAt: stockMovements.createdAt,
        unitCost: stockMovements.unitCost,
      })
      .from(stockMovements)
      .leftJoin(suppliers, eq(suppliers.id, stockMovements.supplierId))
      .where(
        and(
          eq(stockMovements.companyId, companyId),
          eq(stockMovements.type, 'stock_in'),
          inArray(stockMovements.variantId, variantIds),
          sql`${stockMovements.reversedById} IS NULL`,
          sql`${stockMovements.reversesId} IS NULL`,
        ),
      )
      .orderBy(desc(stockMovements.createdAt));

    // İlk gelen (en yeni) variant başına saklanır
    lastSupplierByVariant = supplierRows.reduce((acc, row) => {
      if (!acc.has(row.variantId)) {
        acc.set(row.variantId, {
          variantId: row.variantId,
          supplierId: row.supplierId,
          supplierName: row.supplierName,
          createdAt: row.createdAt,
          unitCost: row.unitCost,
        });
      }
      return acc;
    }, new Map<string, LastSupplier>());
  }

  // Suggestion oluştur
  return sliced.map((r) => {
    const effectiveThreshold = computeEffectiveThreshold(
      r.threshold,
      r.branchThresholds,
      r.branchId,
    );
    const suggestedQty = Math.max(1, effectiveThreshold * 2 - r.currentStock);
    const last = lastSupplierByVariant.get(r.variantId) ?? null;
    return {
      variantId: r.variantId,
      productId: r.productId,
      productName: r.productName,
      variantLabel: r.variantLabel,
      sku: r.sku,
      branchId: r.branchId,
      branchName: r.branchName,
      currentStock: r.currentStock,
      threshold: effectiveThreshold,
      suggestedQty,
      lastSupplierId: last?.supplierId ?? null,
      lastSupplierName: last?.supplierName ?? null,
      lastOrderDate: last?.createdAt ?? null,
      lastUnitCost: last?.unitCost ?? null,
    };
  });
}

export function computeEffectiveThreshold(
  defaultThreshold: number,
  branchThresholds: unknown,
  branchId: string,
): number {
  if (
    branchThresholds &&
    typeof branchThresholds === 'object' &&
    !Array.isArray(branchThresholds)
  ) {
    const rec = branchThresholds as Record<string, unknown>;
    const override = rec[branchId];
    if (typeof override === 'number' && Number.isFinite(override)) {
      return override;
    }
  }
  return defaultThreshold;
}
