/**
 * Hard delete ürün — Sprint 7b bypass 2.
 *
 * Normal flow: softDeleteProduct → products.deletedAt set + isActive=false + vitrinPublished=false.
 * Süperadmin bypass: DB'den gerçekten sil. Bu işlem cascade etkisi:
 *   - product_variants (cascade)
 *   - product_images (cascade)
 *   - branch_inventory (cascade — onDelete: 'cascade' product_variants üzerinden)
 *   - stock_movements ← variantId FK 'restrict' → hareketler varsa silinemez (DB hatası)
 *
 * Tipik kullanım: hatalı eklenen test ürünü, gerçekten kaldırılması gerekli.
 *
 * Reddetme nedenleri:
 *   - not_found: product yok veya başka tenant
 *   - has_movements: stock_movements satırı var → hard delete imkânsız (data integrity)
 *   - not_soft_deleted: önce soft delete edilmeli (deletedAt NOT NULL gerek)
 */

import { and, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { products, productVariants, stockMovements, stocktakeItems } from '@/db/schema';

export type HardDeleteResult =
  | { ok: true; deletedProductId: string; productName: string }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'not_soft_deleted' }
  | { ok: false; reason: 'has_movements'; movementCount: number }
  | { ok: false; reason: 'has_history'; historyCount: number }
  | { ok: false; reason: 'unknown' };

/**
 * Hard delete product + cascade variants/images/inventory.
 * stock_movements referansları varsa reddedilir (immutable ledger).
 */
export async function hardDeleteProduct(
  companyId: string,
  productId: string,
  db: DbClient,
): Promise<HardDeleteResult> {
  // 1. Product var mı + soft-deleted mi?
  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      deletedAt: products.deletedAt,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
    .limit(1);
  const product = productRows[0];
  if (!product) return { ok: false, reason: 'not_found' };
  if (!product.deletedAt) return { ok: false, reason: 'not_soft_deleted' };

  // 2. Bu ürünün variantları → stock_movements var mı?
  const movementRows = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .where(eq(productVariants.productId, productId));
  const movementCount = movementRows[0]?.count ?? 0;
  if (movementCount > 0) {
    return { ok: false, reason: 'has_movements', movementCount };
  }

  // 3. stocktake_items satırı var mı? (variantId FK restrict)
  const stocktakeItemRows = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(stocktakeItems)
    .innerJoin(productVariants, eq(productVariants.id, stocktakeItems.variantId))
    .where(eq(productVariants.productId, productId));
  const stocktakeItemCount = stocktakeItemRows[0]?.count ?? 0;
  if (stocktakeItemCount > 0) {
    return { ok: false, reason: 'has_history', historyCount: stocktakeItemCount };
  }

  // 3. Hard delete — products satırı cascade ile variants + images + inventory siler
  try {
    await db.delete(products).where(eq(products.id, productId));
    return { ok: true, deletedProductId: productId, productName: product.name };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
