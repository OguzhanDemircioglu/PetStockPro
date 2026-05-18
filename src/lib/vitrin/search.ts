/**
 * Vitrin ürün arama — cross-tenant ILIKE araması.
 *
 * Visibility (vitrin/category-listings.ts ile tutarlı):
 *   - companies.storefront_status = 'approved'
 *   - storefront_settings.is_enabled = true
 *   - products.vitrin_published = true
 *   - products.deleted_at IS NULL
 *
 * Arama hedefi: product.name + brand.name (case-insensitive ILIKE).
 * Pagination: limit (clamp 60) + offset.
 * Order: name ASC (deterministik; Faz 2'de relevance ranking).
 */

import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
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

const MAX_LIMIT = 60;
const DEFAULT_LIMIT = 24;
const MIN_QUERY_LEN = 2;

export interface SearchProductRow {
  productId: string;
  productName: string;
  productSlug: string;
  companyId: string;
  companySlug: string;
  companyName: string;
  cityName: string | null;
  districtName: string | null;
  brandName: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  defaultSalePrice: string | null;
  defaultVariantLabel: string | null;
}

export interface SearchOpts {
  limit?: number;
  offset?: number;
  cityId?: number;
  /** Kategori slug filter (default kategori slug'larından). */
  categorySlug?: string;
}

export interface ParsedSearchQuery {
  /** Trimlenmiş orijinal query. */
  raw: string;
  /** SQL ILIKE için escape edilmiş pattern (%query%). */
  ilikePattern: string;
  /** Min uzunluğa ulaşmış mı (<2 ise arama yapılmaz). */
  valid: boolean;
}

/**
 * Query'yi temizle ve ILIKE pattern üret.
 *
 * - Trim, %_ karakterlerini escape et (SQL injection değil, pattern literal koruması)
 * - 2 karakterden kısa query → valid=false (UI'da empty state göster)
 */
export function parseSearchQuery(raw: string | null | undefined): ParsedSearchQuery {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length < MIN_QUERY_LEN) {
    return { raw: trimmed, ilikePattern: '', valid: false };
  }
  // ILIKE meta karakterleri (% ve _) literal olarak ele al
  const escaped = trimmed.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return { raw: trimmed, ilikePattern: `%${escaped}%`, valid: true };
}

export async function searchPublicProducts(
  query: string,
  db: DbClient,
  opts: SearchOpts = {},
): Promise<SearchProductRow[]> {
  const parsed = parseSearchQuery(query);
  if (!parsed.valid) return [];

  const limit = Math.max(1, Math.min(MAX_LIMIT, opts.limit ?? DEFAULT_LIMIT));
  const offset = Math.max(0, opts.offset ?? 0);

  const filters = [
    eq(products.vitrinPublished, true),
    sql`${products.deletedAt} IS NULL`,
    eq(companies.storefrontStatus, 'approved'),
    eq(storefrontSettings.isEnabled, true),
    or(ilike(products.name, parsed.ilikePattern), ilike(brands.name, parsed.ilikePattern)),
  ];
  if (opts.cityId) {
    filters.push(eq(companies.cityId, opts.cityId));
  }
  if (opts.categorySlug) {
    filters.push(eq(categories.slug, opts.categorySlug));
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
      brandName: brands.name,
      categorySlug: categories.slug,
      categoryName: categories.name,
      defaultSalePrice: productVariants.salePrice,
      defaultVariantLabel: productVariants.valueLabel,
    })
    .from(products)
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .leftJoin(brands, eq(brands.id, products.brandId))
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

export async function countSearchResults(
  query: string,
  db: DbClient,
  opts: { cityId?: number; categorySlug?: string } = {},
): Promise<number> {
  const parsed = parseSearchQuery(query);
  if (!parsed.valid) return 0;

  const filters = [
    eq(products.vitrinPublished, true),
    sql`${products.deletedAt} IS NULL`,
    eq(companies.storefrontStatus, 'approved'),
    eq(storefrontSettings.isEnabled, true),
    or(ilike(products.name, parsed.ilikePattern), ilike(brands.name, parsed.ilikePattern)),
  ];
  if (opts.cityId) {
    filters.push(eq(companies.cityId, opts.cityId));
  }
  if (opts.categorySlug) {
    filters.push(eq(categories.slug, opts.categorySlug));
  }

  const baseQuery = db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(products)
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .leftJoin(brands, eq(brands.id, products.brandId));

  // Kategori filter aktifse join eklenmeli
  const rows = opts.categorySlug
    ? await baseQuery
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .where(and(...filters))
    : await baseQuery.where(and(...filters));

  return rows[0]?.count ?? 0;
}
