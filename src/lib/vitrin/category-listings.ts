/**
 * Cross-tenant kategori sayfaları — Faz 2'den çekilen vitrin katmanı.
 *
 * Tenant-level `categories` tablosu var (her pet shop kendi 16 default
 * + opsiyonel ekstra kategorisini tutar) ama tüm tenant'lar aynı slug'a
 * sahip default kategoriler kullanıyor (`kuru-mama`, `aksesuar`...).
 *
 * Bu helper categories.slug üzerinden join yaparak tüm tenant'ların
 * vitrin'e açık ürünlerini tek bir kategori sayfasında birleştirir
 * (Sahibinden modeli — "Kedi maması" tıklayınca tüm pet shop'ların
 * kedi mama ürünleri listelenir).
 *
 * Visibility şartı (vitrin/public.ts ile tutarlı):
 *   - companies.storefront_status = 'approved'
 *   - storefront_settings.is_enabled = true
 *   - products.vitrin_published = true
 *   - products.deleted_at IS NULL
 *
 * 3 fonksiyon:
 *   - getCategoryInfoBySlug(slug) — pure: DEFAULT_CATEGORIES tablosundan
 *     emoji + name lookup. Custom kategori için "Diğer" fallback.
 *   - listProductsByCategorySlug(slug, db, opts) — cross-tenant ürün
 *     listingi (variant default fiyat + pet shop adı + il/ilçe).
 *   - countProductsByCategorySlug(slug, db) — pagination için toplam.
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
import { DEFAULT_CATEGORIES } from '@/lib/catalog/default-categories';

export interface CategoryInfo {
  slug: string;
  name: string;
  emoji: string;
  isDefault: boolean; // false → custom kategori, "Diğer" fallback
}

export function getCategoryInfoBySlug(slug: string): CategoryInfo {
  const def = DEFAULT_CATEGORIES.find((c) => c.slug === slug);
  if (def) {
    return {
      slug: def.slug,
      name: def.name,
      emoji: def.emoji,
      isDefault: true,
    };
  }
  return {
    slug,
    name: 'Diğer',
    emoji: '📦',
    isDefault: false,
  };
}

export interface CategoryProductRow {
  productId: string;
  productName: string;
  productSlug: string;
  companyId: string;
  companySlug: string;
  companyName: string;
  cityName: string | null;
  districtName: string | null;
  brandName: string | null;
  defaultSalePrice: string | null;
  defaultVariantLabel: string | null;
}

export interface ListByCategoryOpts {
  limit?: number;
  offset?: number;
  cityId?: number;
}

const MAX_LIMIT = 60;
const DEFAULT_LIMIT = 24;

export async function listProductsByCategorySlug(
  slug: string,
  db: DbClient,
  opts: ListByCategoryOpts = {},
): Promise<CategoryProductRow[]> {
  const limit = Math.max(1, Math.min(MAX_LIMIT, opts.limit ?? DEFAULT_LIMIT));
  const offset = Math.max(0, opts.offset ?? 0);

  const filters = [
    eq(categories.slug, slug),
    eq(products.vitrinPublished, true),
    sql`${products.deletedAt} IS NULL`,
    eq(companies.storefrontStatus, 'approved'),
    eq(storefrontSettings.isEnabled, true),
  ];
  if (opts.cityId) {
    filters.push(eq(companies.cityId, opts.cityId));
  }

  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      companyId: companies.id,
      companySlug: companies.slug,
      companyName: companies.name,
      cityName: cities.name,
      districtName: districts.name,
      brandName: brands.name,
      defaultSalePrice: productVariants.salePrice,
      defaultVariantLabel: productVariants.valueLabel,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .leftJoin(cities, eq(cities.id, companies.cityId))
    .leftJoin(districts, eq(districts.id, companies.districtId))
    .leftJoin(brands, eq(brands.id, products.brandId))
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

  return rows;
}

export async function countProductsByCategorySlug(
  slug: string,
  db: DbClient,
  opts: { cityId?: number } = {},
): Promise<number> {
  const filters = [
    eq(categories.slug, slug),
    eq(products.vitrinPublished, true),
    sql`${products.deletedAt} IS NULL`,
    eq(companies.storefrontStatus, 'approved'),
    eq(storefrontSettings.isEnabled, true),
  ];
  if (opts.cityId) {
    filters.push(eq(companies.cityId, opts.cityId));
  }

  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .where(and(...filters));

  return rows[0]?.count ?? 0;
}

/**
 * Vitrin'e açık ürünü olan kategorileri sayar (slug bazında DISTINCT).
 * Ana sayfa kategori chip section için kullanılır — boş kategoriler
 * (henüz ürün yok) gizlenir.
 *
 * Slug bazında group by — aynı slug birden çok tenant'ta tekrar eder,
 * COUNT DISTINCT product.id ile cross-tenant toplam ürün sayısı.
 */
export interface CategoryWithCount extends CategoryInfo {
  productCount: number;
}

export async function listCategoriesWithStorefrontProducts(
  db: DbClient,
): Promise<CategoryWithCount[]> {
  const rows = await db
    .select({
      slug: categories.slug,
      productCount: sql<number>`COUNT(DISTINCT ${products.id})::int`,
    })
    .from(categories)
    .innerJoin(products, eq(products.categoryId, categories.id))
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
    .groupBy(categories.slug);

  return rows
    .map((r) => {
      const info = getCategoryInfoBySlug(r.slug);
      return { ...info, productCount: r.productCount };
    })
    .sort((a, b) => b.productCount - a.productCount);
}
