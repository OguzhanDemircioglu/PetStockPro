/**
 * Vitrin homepage istatistikleri + popüler ürünler.
 *
 * `/vitrin` ana sayfası "Info bar" + "Trust strip" için:
 *   - getPlatformStats: toplam aktif pet shop + ürün + şehir count
 *
 * `/vitrin` "🔥 Bu hafta popüler" section için:
 *   - listPopularProducts7d: son 7 günde en çok `product_view` event'i alan
 *     cross-tenant ürünler, ürün/mağaza/fiyat bilgisiyle.
 *
 * Görünürlük kuralı tüm helper'larda aynı:
 *   - companies.storefront_status = 'approved'
 *   - storefront_settings.is_enabled = true
 *   - products.vitrin_published = true (popüler ürünler için)
 *   - products.deleted_at IS NULL
 */

import { aliasedTable, and, asc, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  cities,
  companies,
  districts,
  productImages,
  productVariants,
  products,
  storefrontSettings,
  stockMovements,
  vitrinEvents,
} from '@/db/schema';

export interface PlatformStats {
  /** approved + isEnabled pet shop sayısı */
  storefrontCount: number;
  /** vitrinPublished + !deleted ürün sayısı (tüm aktif tenant'lar) */
  productCount: number;
  /** En az 1 aktif tenant'ı olan şehir sayısı */
  cityCount: number;
}

/**
 * Vitrin için global stats. 3 ayrı COUNT(*) sorgusu — Promise.all paralel.
 * Brand homepage "47 şehir · 428 pet shop · 1.247 ürün" trust strip için.
 */
export async function getPlatformStats(db: DbClient): Promise<PlatformStats> {
  const [storefrontRows, productRows, cityRows] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(companies)
      .innerJoin(
        storefrontSettings,
        eq(storefrontSettings.companyId, companies.id),
      )
      .where(
        and(
          eq(companies.storefrontStatus, 'approved'),
          eq(storefrontSettings.isEnabled, true),
        ),
      ),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(products)
      .innerJoin(companies, eq(companies.id, products.companyId))
      .innerJoin(
        storefrontSettings,
        eq(storefrontSettings.companyId, companies.id),
      )
      .where(
        and(
          eq(products.vitrinPublished, true),
          sql`${products.deletedAt} IS NULL`,
          eq(companies.storefrontStatus, 'approved'),
          eq(storefrontSettings.isEnabled, true),
        ),
      ),
    db
      .select({
        count: sql<number>`COUNT(DISTINCT ${companies.cityId})::int`,
      })
      .from(companies)
      .innerJoin(
        storefrontSettings,
        eq(storefrontSettings.companyId, companies.id),
      )
      .where(
        and(
          eq(companies.storefrontStatus, 'approved'),
          eq(storefrontSettings.isEnabled, true),
          sql`${companies.cityId} IS NOT NULL`,
        ),
      ),
  ]);

  return {
    storefrontCount: storefrontRows[0]?.count ?? 0,
    productCount: productRows[0]?.count ?? 0,
    cityCount: cityRows[0]?.count ?? 0,
  };
}

export interface PopularProductRow {
  productId: string;
  productName: string;
  productSlug: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  cityName: string | null;
  districtName: string | null;
  defaultSalePrice: string | null;
  defaultVariantLabel: string | null;
  /** Ürünün primary product_images URL'i, yoksa null (UI emoji fallback yapar) */
  primaryImageUrl: string | null;
  viewCount: number;
}

/**
 * Son N günde en çok `product_view` event alan vitrin ürünleri.
 *
 * GROUP BY product_id ORDER BY COUNT(*) DESC. View'leri olmayan ürün hiç
 * görünmez (yeni eklenen pet shop için "ürün count = 0" anlamı taşıyabilir,
 * caller boş array için fallback yapsın).
 *
 * Performans notu: vitrin_events tablosu büyürse `created_at` index'i +
 * limit clause yeterli. >100K event olursa daily aggregate cache (Faz 2).
 *
 * @param windowDays - default 7 gün
 * @param limit - default 8 (mockup'taki popüler grid 8'li)
 */
export async function listPopularProducts7d(
  db: DbClient,
  opts: { windowDays?: number; limit?: number } = {},
): Promise<PopularProductRow[]> {
  const windowDays = Math.max(1, Math.min(90, opts.windowDays ?? 7));
  const limit = Math.max(1, Math.min(50, opts.limit ?? 8));

  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  return db
    .select({
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      companyId: companies.id,
      companyName: companies.name,
      companySlug: companies.slug,
      cityName: cities.name,
      districtName: districts.name,
      defaultSalePrice: productVariants.salePrice,
      defaultVariantLabel: productVariants.valueLabel,
      primaryImageUrl: productImages.url,
      viewCount: sql<number>`COUNT(${vitrinEvents.id})::int`,
    })
    .from(vitrinEvents)
    .innerJoin(products, eq(products.id, vitrinEvents.productId))
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(
      storefrontSettings,
      eq(storefrontSettings.companyId, companies.id),
    )
    .leftJoin(cities, eq(cities.id, companies.cityId))
    .leftJoin(districts, eq(districts.id, companies.districtId))
    .leftJoin(
      productVariants,
      and(
        eq(productVariants.productId, products.id),
        eq(productVariants.isDefault, true),
        eq(productVariants.isActive, true),
      ),
    )
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.isPrimary, true),
      ),
    )
    .where(
      and(
        eq(vitrinEvents.eventType, 'product_view'),
        sql`${vitrinEvents.createdAt} >= ${sql.raw(`'${cutoffIso}'::timestamptz`)}`,
        eq(products.vitrinPublished, true),
        sql`${products.deletedAt} IS NULL`,
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .groupBy(
      products.id,
      products.name,
      products.slug,
      companies.id,
      companies.name,
      companies.slug,
      cities.name,
      districts.name,
      productVariants.salePrice,
      productVariants.valueLabel,
      productImages.url,
    )
    .orderBy(desc(sql`COUNT(${vitrinEvents.id})`), asc(products.name))
    .limit(limit);
}

export interface BestSellerRow {
  productId: string;
  productName: string;
  productSlug: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  cityName: string | null;
  districtName: string | null;
  defaultSalePrice: string | null;
  defaultVariantLabel: string | null;
  /** Ürünün primary product_images URL'i, yoksa null (UI emoji fallback yapar) */
  primaryImageUrl: string | null;
  /** Son N gün toplam satış adet (stock_out · sale, reversedById NULL) */
  totalSold: number;
}

/**
 * Son N günde en çok satılan vitrin ürünleri — `stock_movements` üzerinden
 * gerçek satış data'sı.
 *
 * `vitrinPublished=true` ürünler arasından, son N günde `type='stock_out'` +
 * `subtype='sale'` (kasiyer satışı veya admin manuel kayıt) + `reversedById IS
 * NULL` (geri alınmamış) kayıtların quantity SUM'ı.
 *
 * "Popüler" (view-based) ile karıştırılmaz — bu **gerçek satış** ölçütü.
 *
 * @param windowDays - default 30 (popülerden uzun pencere, satış daha seyrek olur)
 * @param limit - default 8
 */
export async function listBestSellers(
  db: DbClient,
  opts: { windowDays?: number; limit?: number } = {},
): Promise<BestSellerRow[]> {
  const windowDays = Math.max(1, Math.min(180, opts.windowDays ?? 30));
  const limit = Math.max(1, Math.min(50, opts.limit ?? 8));

  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  // Aynı productVariants tablosunu iki kez join: bir kez stock_movements'ın
  // variant'ı, bir kez ürünün default variant'ı (fiyat için).
  const soldVariant = aliasedTable(productVariants, 'sold_variant');
  const defaultVariant = aliasedTable(productVariants, 'default_variant');

  return db
    .select({
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      companyId: companies.id,
      companyName: companies.name,
      companySlug: companies.slug,
      cityName: cities.name,
      districtName: districts.name,
      defaultSalePrice: defaultVariant.salePrice,
      defaultVariantLabel: defaultVariant.valueLabel,
      primaryImageUrl: productImages.url,
      totalSold: sql<number>`COALESCE(SUM(ABS(${stockMovements.quantity})), 0)::int`,
    })
    .from(stockMovements)
    .innerJoin(soldVariant, eq(soldVariant.id, stockMovements.variantId))
    .innerJoin(products, eq(products.id, soldVariant.productId))
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(
      storefrontSettings,
      eq(storefrontSettings.companyId, companies.id),
    )
    .leftJoin(cities, eq(cities.id, companies.cityId))
    .leftJoin(districts, eq(districts.id, companies.districtId))
    .leftJoin(
      defaultVariant,
      and(
        eq(defaultVariant.productId, products.id),
        eq(defaultVariant.isDefault, true),
        eq(defaultVariant.isActive, true),
      ),
    )
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.isPrimary, true),
      ),
    )
    .where(
      and(
        eq(stockMovements.type, 'stock_out'),
        eq(stockMovements.subtype, 'sale'),
        sql`${stockMovements.reversedById} IS NULL`,
        sql`${stockMovements.createdAt} >= ${sql.raw(`'${cutoffIso}'::timestamptz`)}`,
        eq(products.vitrinPublished, true),
        sql`${products.deletedAt} IS NULL`,
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .groupBy(
      products.id,
      products.name,
      products.slug,
      companies.id,
      companies.name,
      companies.slug,
      cities.name,
      districts.name,
      defaultVariant.salePrice,
      defaultVariant.valueLabel,
      productImages.url,
    )
    .orderBy(
      desc(sql`COALESCE(SUM(ABS(${stockMovements.quantity})), 0)`),
      asc(products.name),
    )
    .limit(limit);
}
