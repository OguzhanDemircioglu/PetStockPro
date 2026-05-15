/**
 * Stock Movement listing helper — Sprint 4.0
 *
 * Ledger sayfası için. Filter: branch + variant + type + tarih (ileride).
 * Şimdilik MVP: company bazlı, en yeni 100 hareket, join product+variant+branch isimleri.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  stockMovements,
  productVariants,
  products,
  branches,
  users,
} from '@/db/schema';

export interface StockMovementListItem {
  id: string;
  createdAt: Date;
  branchName: string;
  productName: string;
  variantLabel: string;
  type: string;
  subtype: string | null;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  unitCost: string | null;
  unitPrice: string | null;
  customerRef: string | null;
  paymentMethod: string | null;
  documentNo: string | null;
  reason: string | null;
  note: string | null;
  performedBy: string | null;
  transferGroupId: string | null;
  reversesId: string | null;
  reversedById: string | null;
}

export interface ListMovementsOptions {
  branchId?: string;
  variantId?: string;
  type?: 'stock_in' | 'stock_out' | 'transfer' | 'stocktake' | 'stocktake_initial';
  limit?: number;
}

export async function listStockMovements(
  companyId: string,
  db: DbClient,
  opts: ListMovementsOptions = {},
): Promise<StockMovementListItem[]> {
  const conditions = [eq(stockMovements.companyId, companyId)];
  if (opts.branchId) {
    conditions.push(eq(stockMovements.branchId, opts.branchId));
  }
  if (opts.variantId) {
    conditions.push(eq(stockMovements.variantId, opts.variantId));
  }
  if (opts.type) {
    conditions.push(eq(stockMovements.type, opts.type));
  }

  const rows = await db
    .select({
      id: stockMovements.id,
      createdAt: stockMovements.createdAt,
      branchName: branches.name,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      type: stockMovements.type,
      subtype: stockMovements.subtype,
      quantity: stockMovements.quantity,
      beforeQty: stockMovements.beforeQty,
      afterQty: stockMovements.afterQty,
      unitCost: stockMovements.unitCost,
      unitPrice: stockMovements.unitPrice,
      customerRef: stockMovements.customerRef,
      paymentMethod: stockMovements.paymentMethod,
      documentNo: stockMovements.documentNo,
      reason: stockMovements.reason,
      note: stockMovements.note,
      performedBy: sql<string | null>`${users.email}`,
      transferGroupId: stockMovements.transferGroupId,
      reversesId: stockMovements.reversesId,
      reversedById: stockMovements.reversedById,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(branches, eq(branches.id, stockMovements.branchId))
    .leftJoin(users, eq(users.id, stockMovements.createdById))
    .where(and(...conditions))
    .orderBy(desc(stockMovements.createdAt))
    .limit(opts.limit ?? 100);

  return rows;
}

/**
 * Belirli bir variant için ledger (variant detayında kullanılacak — Sprint 4.5+).
 */
export async function listVariantHistory(
  companyId: string,
  variantId: string,
  db: DbClient,
  limit: number = 50,
): Promise<StockMovementListItem[]> {
  return listStockMovements(companyId, db, { variantId, limit });
}
