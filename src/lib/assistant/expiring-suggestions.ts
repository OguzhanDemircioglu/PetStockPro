/**
 * PetPro Asistanı — SKT yaklaşan ürünler (Sprint 8 ext, Faz 2'den öne çekildi).
 *
 * branch_inventory satırlarından expiryDate IS NOT NULL + stockQty > 0 +
 * expiryDate <= NOW + N gün olanları döner.
 *
 * 3 önem seviyesi (severity):
 *   - 'expired'   → expiryDate < NOW (mama zaten bozulmuş, derhal fire)
 *   - 'critical'  → expiryDate < NOW + 7 gün
 *   - 'warning'   → expiryDate < NOW + 30 gün
 *
 * sktRequired flag yok — branch_inventory'de expiryDate set'liyse alarm
 * üretilir (kategori filtresi gerekmez, zaten data var).
 *
 * Sıralama: expiryDate ASC (en yakın SKT öncelikli).
 *
 * Pano widget'ı pet shop için: "5 ürün SKT geçti, 3 ürün 7 gün içinde
 * SKT'ye geliyor — fire kaydı veya indirim ekleyin."
 */

import { and, asc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import type { TenantDb } from '@/lib/db/with-tenant';
import {
  branchInventory,
  branches,
  productVariants,
  products,
} from '@/db/schema';

export const EXPIRY_CRITICAL_DAYS = 7;
export const EXPIRY_WARNING_DAYS = 30;

export type ExpirySeverity = 'expired' | 'critical' | 'warning';

export interface ExpiringSuggestion {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  sku: string;
  branchId: string;
  branchName: string;
  stockQty: number;
  expiryDate: string; // YYYY-MM-DD
  daysUntilExpiry: number; // negatif → expired
  severity: ExpirySeverity;
}

export function computeSeverity(daysUntilExpiry: number): ExpirySeverity {
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= EXPIRY_CRITICAL_DAYS) return 'critical';
  return 'warning';
}

export async function listExpiringSuggestions(
  companyId: string,
  db: TenantDb,
  limit: number = 5,
  now: Date = new Date(),
): Promise<ExpiringSuggestion[]> {
  const todayIso = now.toISOString().slice(0, 10);
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() + EXPIRY_WARNING_DAYS);
  const cutoffIso = cutoffDate.toISOString().slice(0, 10);

  const rows = await db
    .select({
      variantId: branchInventory.variantId,
      productId: products.id,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      branchId: branchInventory.branchId,
      branchName: branches.name,
      stockQty: branchInventory.stockQty,
      expiryDate: branchInventory.expiryDate,
      daysUntilExpiry: sql<number>`(${branchInventory.expiryDate} - ${sql.raw(`'${todayIso}'::date`)})::int`,
    })
    .from(branchInventory)
    .innerJoin(productVariants, eq(productVariants.id, branchInventory.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(branches, eq(branches.id, branchInventory.branchId))
    .where(
      and(
        eq(branchInventory.companyId, companyId),
        isNotNull(branchInventory.expiryDate),
        gt(branchInventory.stockQty, 0),
        sql`${branchInventory.expiryDate} <= ${sql.raw(`'${cutoffIso}'::date`)}`,
        eq(productVariants.isActive, true),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .orderBy(asc(branchInventory.expiryDate))
    .limit(limit);

  return rows.map((r) => ({
    variantId: r.variantId,
    productId: r.productId,
    productName: r.productName,
    variantLabel: r.variantLabel,
    sku: r.sku,
    branchId: r.branchId,
    branchName: r.branchName,
    stockQty: r.stockQty,
    expiryDate: r.expiryDate as string,
    daysUntilExpiry: r.daysUntilExpiry,
    severity: computeSeverity(r.daysUntilExpiry),
  }));
}

export function formatExpiryLabel(daysUntilExpiry: number): string {
  if (daysUntilExpiry < 0) {
    return `${Math.abs(daysUntilExpiry)} gün önce geçti`;
  }
  if (daysUntilExpiry === 0) return 'Bugün son gün';
  if (daysUntilExpiry === 1) return '1 gün kaldı';
  return `${daysUntilExpiry} gün kaldı`;
}
