/**
 * Cross-tenant marka listingleri — il sayfası brand chip section ve
 * (ileride) marka detay sayfası için.
 *
 * Visibility (vitrin/public.ts ile tutarlı):
 *   - companies.storefront_status = 'approved'
 *   - storefront_settings.is_enabled = true
 *   - products.vitrin_published = true
 *   - products.deleted_at IS NULL
 *   - brands.is_active = true
 *
 * NOT: brands tablosu tenant-scope'tur — aynı isim ("Royal Canin") farklı
 * tenant'larda farklı UUID'lerle bulunur. Bu yüzden chip aggregate'i `brands.name`
 * üzerinden yapılır (case-sensitive eşleşme), `brand.id` üzerinden değil.
 */

import { and, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { brands, companies, products, storefrontSettings } from '@/db/schema';

export interface BrandWithCount {
  name: string;
  productCount: number;
}

/**
 * Bir ildeki tenant'larda satışta olan markaları (DISTINCT product) listele.
 * Aynı brand name birden çok tenant'ta görünse de DISTINCT product.id ile çift
 * sayılmaz. brand_id NULL ürünler atılır (sadece markası olan ürünler dahil).
 */
export async function listBrandsInCity(
  cityId: number,
  db: DbClient,
): Promise<BrandWithCount[]> {
  const rows = await db
    .select({
      name: brands.name,
      productCount: sql<number>`COUNT(DISTINCT ${products.id})::int`,
    })
    .from(brands)
    .innerJoin(products, eq(products.brandId, brands.id))
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .where(
      and(
        eq(companies.cityId, cityId),
        eq(products.vitrinPublished, true),
        sql`${products.deletedAt} IS NULL`,
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .groupBy(brands.name);

  return rows.sort((a, b) => {
    if (b.productCount !== a.productCount) return b.productCount - a.productCount;
    return a.name.localeCompare(b.name, 'tr');
  });
}

/**
 * Tüm Türkiye'deki tenant'larda satışta olan markaları listele — vitrin ana
 * sayfada veya /vitrin/marka SEO landing'inde kullanılır.
 */
export async function listBrandsWithStorefrontProducts(
  db: DbClient,
): Promise<BrandWithCount[]> {
  const rows = await db
    .select({
      name: brands.name,
      productCount: sql<number>`COUNT(DISTINCT ${products.id})::int`,
    })
    .from(brands)
    .innerJoin(products, eq(products.brandId, brands.id))
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
    .groupBy(brands.name);

  return rows.sort((a, b) => {
    if (b.productCount !== a.productCount) return b.productCount - a.productCount;
    return a.name.localeCompare(b.name, 'tr');
  });
}
