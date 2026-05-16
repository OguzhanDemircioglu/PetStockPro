/**
 * PetPro Asistanı — İndirim önerileri (Sprint 8 parça 3).
 *
 * Yavaş satış + yüksek stok kombinasyonu için indirim önerisi üretir.
 * Hedef: Pet shop, dönmeyen stoğu indirimle harekete geçirsin.
 *
 * Algoritma:
 *   1. Aktif (isActive=true, product.deletedAt=NULL) variant'ları topla.
 *   2. Variant başına SUM(branch_inventory.stockQty) — tüm şubelerde toplam.
 *   3. Son 30 günde reversal'sız satış adedi (stockMovements type='stock_out',
 *      subtype='sale', reversedById/reversesId IS NULL).
 *   4. Aylık stok süresi = totalStock / sale30d (sale30d zaten 30 günlük
 *      toplam = aylık satış demek). Bölme sıfırı için sale30d=0 ise süre
 *      `Infinity` sayılır → en yüksek indirim seviyesi.
 *   5. Filtre: totalStock >= MIN_STOCK_THRESHOLD (5) — anlamsız öneri yapma.
 *   6. Filtre: monthsOfInventory >= MIN_MONTHS_THRESHOLD (6) — 6 ay altı normal.
 *   7. İndirim seviyesi:
 *        sale30d=0 + totalStock > 50  → 30
 *        24 ay+                        → 30
 *        12-24 ay                      → 20
 *        6-12 ay                       → 10
 *   8. Sıralama: monthsOfInventory DESC (en yavaş satış öncelikli).
 *
 * Pure aggregation — yeni movement üretmez, sadece UI önerisi.
 * "İndirim uygula" linki ürün edit sayfasına gider; fiyat orada değişir.
 */

import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  branchInventory,
  productVariants,
  products,
  stockMovements,
} from '@/db/schema';

export const MIN_STOCK_THRESHOLD = 5;
export const MIN_MONTHS_THRESHOLD = 6;
const ZERO_SALE_HIGH_STOCK = 50;

export interface DiscountSuggestion {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  sku: string;
  totalStock: number;
  sale30d: number;
  monthsOfInventory: number; // Infinity sale30d=0 ise
  suggestedDiscountPct: 10 | 20 | 30;
  salePrice: string; // decimal string
  suggestedPrice: string; // decimal string — penny-safe yuvarlama
}

interface SuggestionInputRow {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  sku: string;
  totalStock: number;
  salePrice: string;
}

export function computeDiscountTier(
  monthsOfInventory: number,
  totalStock: number,
  sale30d: number,
): 10 | 20 | 30 | null {
  if (totalStock < MIN_STOCK_THRESHOLD) return null;
  if (sale30d === 0) {
    return totalStock > ZERO_SALE_HIGH_STOCK ? 30 : null;
  }
  if (monthsOfInventory < MIN_MONTHS_THRESHOLD) return null;
  if (monthsOfInventory >= 24) return 30;
  if (monthsOfInventory >= 12) return 20;
  return 10;
}

export function computeSuggestedPrice(
  salePriceDecimal: string,
  discountPct: 10 | 20 | 30,
): string {
  const price = Number.parseFloat(salePriceDecimal);
  if (!Number.isFinite(price) || price <= 0) return salePriceDecimal;
  const discounted = price * (1 - discountPct / 100);
  return (Math.round(discounted * 100) / 100).toFixed(2);
}

export function computeMonthsOfInventory(
  totalStock: number,
  sale30d: number,
): number {
  if (sale30d <= 0) return Number.POSITIVE_INFINITY;
  // sale30d = son 30 gün satış = aylık satış hızı
  return totalStock / sale30d;
}

export async function listDiscountSuggestions(
  companyId: string,
  db: DbClient,
  limit: number = 5,
): Promise<DiscountSuggestion[]> {
  // Variant başına toplam stok — aktif variant + aktif olmayan silinmemiş ürün
  const stockRows = await db
    .select({
      variantId: branchInventory.variantId,
      productId: products.id,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      salePrice: productVariants.salePrice,
      totalStock: sql<number>`COALESCE(SUM(${branchInventory.stockQty}), 0)::int`,
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
      branchInventory.variantId,
      products.id,
      products.name,
      productVariants.valueLabel,
      productVariants.sku,
      productVariants.salePrice,
    );

  const eligible: SuggestionInputRow[] = stockRows
    .filter((r) => r.totalStock >= MIN_STOCK_THRESHOLD)
    .map((r) => ({
      variantId: r.variantId,
      productId: r.productId,
      productName: r.productName,
      variantLabel: r.variantLabel,
      sku: r.sku,
      totalStock: r.totalStock,
      salePrice: r.salePrice,
    }));

  if (eligible.length === 0) return [];

  // Son 30 gün satış toplamı — type='stock_out' subtype='sale' reversal'sız
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const variantIds = eligible.map((r) => r.variantId);

  const saleRows = await db
    .select({
      variantId: stockMovements.variantId,
      // quantity stock_out için negatif; pozitif adet için ABS al
      sale30d: sql<number>`COALESCE(SUM(ABS(${stockMovements.quantity})), 0)::int`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.companyId, companyId),
        eq(stockMovements.type, 'stock_out'),
        eq(stockMovements.subtype, 'sale'),
        inArray(stockMovements.variantId, variantIds),
        sql`${stockMovements.reversedById} IS NULL`,
        sql`${stockMovements.reversesId} IS NULL`,
        gte(stockMovements.createdAt, cutoff),
      ),
    )
    .groupBy(stockMovements.variantId);

  const sale30dByVariant = new Map<string, number>(
    saleRows.map((r) => [r.variantId, r.sale30d]),
  );

  const suggestions: DiscountSuggestion[] = [];
  for (const row of eligible) {
    const sale30d = sale30dByVariant.get(row.variantId) ?? 0;
    const monthsOfInventory = computeMonthsOfInventory(row.totalStock, sale30d);
    const tier = computeDiscountTier(monthsOfInventory, row.totalStock, sale30d);
    if (tier === null) continue;
    suggestions.push({
      variantId: row.variantId,
      productId: row.productId,
      productName: row.productName,
      variantLabel: row.variantLabel,
      sku: row.sku,
      totalStock: row.totalStock,
      sale30d,
      monthsOfInventory,
      suggestedDiscountPct: tier,
      salePrice: row.salePrice,
      suggestedPrice: computeSuggestedPrice(row.salePrice, tier),
    });
  }

  // monthsOfInventory DESC — en yavaş satış üstte
  suggestions.sort((a, b) => {
    if (a.monthsOfInventory === b.monthsOfInventory) {
      return b.totalStock - a.totalStock;
    }
    return b.monthsOfInventory - a.monthsOfInventory;
  });

  return suggestions.slice(0, limit);
}

// Formatlama yardımcısı UI tarafı için
export function formatMonthsOfInventory(months: number): string {
  if (!Number.isFinite(months)) return '∞ ay';
  if (months >= 24) return `${Math.round(months)} ay`;
  return `${months.toFixed(1)} ay`;
}
