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

import { and, asc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  brands,
  categories,
  cities,
  companies,
  districts,
  productVariants,
  products,
  storefrontSettings,
} from '@/db/schema';
import { makeSlug } from '@/lib/utils/slug';

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

export interface BrandWithSlug extends BrandWithCount {
  slug: string;
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

/**
 * Marka adından deterministik slug üret (TR-aware). `makeSlug` shared util'i
 * brand isimlerine uygulanır — örneğin "Royal Canin" → "royal-canin",
 * "Hill's Science Plan" → "hill-s-science-plan".
 *
 * Çift yönlü mapping (slug ↔ name) için `getBrandByNameSlug` kullanılır:
 * `brands.name` üzerinden makeSlug çağrılıp slug eşleşmesi aranır.
 */
export function makeBrandSlug(brandName: string): string {
  return makeSlug(brandName);
}

/**
 * Slug'dan brand adı + cross-tenant ürün sayısını döner. Bulunamazsa null.
 *
 * SQL-side slug regenerate edemediğimiz için (TR-aware lowercase + character
 * mapping JS'te), tüm marka isimlerini çekip JS-side filter yapıyoruz.
 * Vitrin'de görünen brand sayısı küçük (~60-100), N+1 değil tek query.
 */
export async function getBrandByNameSlug(
  slug: string,
  db: DbClient,
): Promise<BrandWithSlug | null> {
  if (!slug) return null;
  const normalizedSlug = slug.toLowerCase().trim();
  const allBrands = await listBrandsWithStorefrontProducts(db);
  const match = allBrands.find((b) => makeBrandSlug(b.name) === normalizedSlug);
  return match ? { ...match, slug: normalizedSlug } : null;
}

export interface BrandProductRow {
  productId: string;
  productName: string;
  productSlug: string;
  companyId: string;
  companySlug: string;
  companyName: string;
  cityName: string | null;
  districtName: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  defaultSalePrice: string | null;
  defaultVariantLabel: string | null;
}

export interface ListByBrandOpts {
  limit?: number;
  offset?: number;
  cityId?: number;
}

const MAX_LIMIT = 60;
const DEFAULT_LIMIT = 24;

/**
 * Marka slug'ından cross-tenant ürün listesi.
 *
 * `brands.name` üzerinde `makeBrandSlug` ile eşleşme yapamadığımız için DB-side,
 * önce slug'tan brand adını resolve ediyoruz (`getBrandByNameSlug`), sonra o adı
 * filter olarak kullanıyoruz (case-insensitive eşleşme).
 */
export async function listProductsByBrandSlug(
  slug: string,
  db: DbClient,
  opts: ListByBrandOpts = {},
): Promise<BrandProductRow[]> {
  const brand = await getBrandByNameSlug(slug, db);
  if (!brand) return [];

  const limit = Math.max(1, Math.min(MAX_LIMIT, opts.limit ?? DEFAULT_LIMIT));
  const offset = Math.max(0, opts.offset ?? 0);

  const filters = [
    eq(brands.name, brand.name),
    eq(products.vitrinPublished, true),
    sql`${products.deletedAt} IS NULL`,
    eq(companies.storefrontStatus, 'approved'),
    eq(storefrontSettings.isEnabled, true),
  ];
  if (opts.cityId) {
    filters.push(eq(companies.cityId, opts.cityId));
  }

  return db
    .select({
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      companyId: companies.id,
      companySlug: companies.slug,
      companyName: companies.name,
      cityName: cities.name,
      districtName: districts.name,
      categorySlug: categories.slug,
      categoryName: categories.name,
      defaultSalePrice: productVariants.salePrice,
      defaultVariantLabel: productVariants.valueLabel,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .leftJoin(categories, eq(categories.id, products.categoryId))
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
    .where(and(...filters))
    .orderBy(asc(products.name))
    .limit(limit)
    .offset(offset);
}

export async function countProductsByBrandSlug(
  slug: string,
  db: DbClient,
  opts: { cityId?: number } = {},
): Promise<number> {
  const brand = await getBrandByNameSlug(slug, db);
  if (!brand) return 0;

  const filters = [
    eq(brands.name, brand.name),
    eq(products.vitrinPublished, true),
    sql`${products.deletedAt} IS NULL`,
    eq(companies.storefrontStatus, 'approved'),
    eq(storefrontSettings.isEnabled, true),
  ];
  if (opts.cityId) {
    filters.push(eq(companies.cityId, opts.cityId));
  }

  const rows = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${products.id})::int` })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .where(and(...filters));

  return rows[0]?.count ?? 0;
}
