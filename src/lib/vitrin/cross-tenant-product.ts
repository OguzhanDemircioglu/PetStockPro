/**
 * Cross-tenant ürün detay + fiyat kıyaslama — Faz 2'den çekilen vitrin UX.
 *
 * Senaryo: müşteri Google'a "Royal Canin Adult Kedi" yazar → tüm pet
 * shop'ların aynı ürününü tek sayfada karşılaştırır → en uygun fiyat /
 * en yakın şube seçer → WhatsApp ile direkt iletişim kurar.
 *
 * Mekanizma: products.slug TENANT-İÇİ unique ama aynı ürün ismi farklı
 * tenant'larda aynı slug üretir (`makeSlug` deterministik). Yani slug
 * üzerinden cross-tenant aggregate yapılabilir.
 *
 * Strateji 1 (MVP): exact slug match. "Royal Canin Adult Kedi" yazımı
 * tüm tenant'larda aynı slug → eşleşme. Yazım farkı (örn. "Royal Canin
 * Yetişkin Kedi") eşleşmez → Faz 3'te pg_trgm fuzzy matching.
 *
 * Visibility şartı (diğer vitrin helper'ları ile tutarlı):
 *   - companies.storefront_status = 'approved'
 *   - storefront_settings.is_enabled = true
 *   - products.vitrin_published = true
 *   - products.deleted_at IS NULL
 *
 * 2 dönüş kümesi:
 *   - meta: ortak ürün adı + (mümkünse) kategori + brand + açıklama
 *     (ilk eşleşen tenant'tan, ürün tüm tenant'larda aynı varsayılır)
 *   - offers: her tenant için ayrı bir satır — pet shop adı + slug +
 *     il/ilçe + min variant fiyatı + stok adedi + WhatsApp telefon
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  branchInventory,
  brands,
  categories,
  cities,
  companies,
  districts,
  productVariants,
  products,
  storefrontSettings,
} from '@/db/schema';

export interface CrossTenantProductMeta {
  slug: string;
  productName: string;
  description: string | null;
  brandName: string | null;
  categoryName: string | null;
  categorySlug: string | null;
}

export interface CrossTenantOffer {
  companyId: string;
  companySlug: string;
  companyName: string;
  cityName: string | null;
  districtName: string | null;
  minSalePrice: string | null;
  maxSalePrice: string | null;
  variantCount: number;
  inStockTotal: number;
  contactWhatsapp: string | null;
  companyWhatsapp: string | null;
  productSlug: string; // bu tenant'ta ürünün slug'ı (her tenant için kendi product ID)
}

export interface CrossTenantProduct {
  meta: CrossTenantProductMeta;
  offers: CrossTenantOffer[];
}

/**
 * Cross-tenant ürün aggregate — slug üzerinden tüm tenant'ların aynı
 * ürününü topla. Sıralama: en düşük fiyat ASC (en ucuz öne).
 *
 * Hiç eşleşme yoksa null döner.
 */
export async function getCrossTenantProduct(
  slug: string,
  db: DbClient,
): Promise<CrossTenantProduct | null> {
  // Meta sorgusu — ilk eşleşen ürünün adı + kategori + brand (cross-
  // tenant'ta hepsi aynı varsayılır; tenant farklı kategoride bağlamış
  // olabilir ama UI seviyesinde ilk eşleşme yeterli).
  const metaRows = await db
    .select({
      productName: products.name,
      description: products.description,
      brandName: brands.name,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(products.slug, slug),
        eq(products.vitrinPublished, true),
        sql`${products.deletedAt} IS NULL`,
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .limit(1);

  const meta = metaRows[0];
  if (!meta) return null;

  // Offers sorgusu — tenant başına aggregate. Variants COUNT + min/max
  // sale price + inStockTotal (branch_inventory SUM > 0 olan variantlar).
  const offerRows = await db
    .select({
      companyId: companies.id,
      companySlug: companies.slug,
      companyName: companies.name,
      cityName: cities.name,
      districtName: districts.name,
      contactWhatsapp: storefrontSettings.contactWhatsapp,
      companyWhatsapp: companies.whatsappPhone,
      productSlug: products.slug,
      minSalePrice: sql<string | null>`MIN(CASE WHEN ${productVariants.isActive} = true THEN ${productVariants.salePrice} END)::text`,
      maxSalePrice: sql<string | null>`MAX(CASE WHEN ${productVariants.isActive} = true THEN ${productVariants.salePrice} END)::text`,
      variantCount: sql<number>`COUNT(DISTINCT ${productVariants.id}) FILTER (WHERE ${productVariants.isActive} = true)::int`,
      inStockTotal: sql<number>`COALESCE(SUM(${branchInventory.stockQty}), 0)::int`,
    })
    .from(products)
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .leftJoin(cities, eq(cities.id, companies.cityId))
    .leftJoin(districts, eq(districts.id, companies.districtId))
    .leftJoin(
      productVariants,
      and(
        eq(productVariants.productId, products.id),
        eq(productVariants.isActive, true),
      ),
    )
    .leftJoin(
      branchInventory,
      eq(branchInventory.variantId, productVariants.id),
    )
    .where(
      and(
        eq(products.slug, slug),
        eq(products.vitrinPublished, true),
        sql`${products.deletedAt} IS NULL`,
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .groupBy(
      companies.id,
      companies.slug,
      companies.name,
      cities.name,
      districts.name,
      storefrontSettings.contactWhatsapp,
      companies.whatsappPhone,
      products.slug,
    )
    .orderBy(
      asc(
        sql`MIN(CASE WHEN ${productVariants.isActive} = true THEN ${productVariants.salePrice} END)`,
      ),
    );

  return {
    meta: {
      slug,
      productName: meta.productName,
      description: meta.description,
      brandName: meta.brandName,
      categoryName: meta.categoryName,
      categorySlug: meta.categorySlug,
    },
    offers: offerRows,
  };
}

/**
 * Sitemap için cross-tenant ürün slug'larını döner — birden çok tenant'ta
 * AYNI slug'a sahip ürünler için tek `/vitrin/urun/[slug]` URL.
 *
 * DISTINCT slug + COUNT > 1 (yalnız 1 tenant'ta varsa cross-tenant
 * sayfasının değeri yok — tenant profili zaten var, duplicate URL
 * yaratmamak için).
 */
export async function listCrossTenantProductSlugs(
  db: DbClient,
): Promise<string[]> {
  const rows = await db
    .select({
      slug: products.slug,
      tenantCount: sql<number>`COUNT(DISTINCT ${products.companyId})::int`,
    })
    .from(products)
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .where(
      and(
        eq(products.vitrinPublished, true),
        sql`${products.deletedAt} IS NULL`,
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .groupBy(products.slug)
    .having(sql`COUNT(DISTINCT ${products.companyId}) > 1`);

  return rows.map((r) => r.slug);
}
