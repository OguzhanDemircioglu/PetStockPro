/**
 * Merkezi Vitrin Dizini — public API (Sprint 12 MVP).
 *
 * `/vitrin` ana sayfası ve `/vitrin/magaza/[slug]` profil sayfası için
 * tenant-agnostic helper. Public erişim — auth yok.
 *
 * Filtreler:
 *   - city / district (lokasyona göre)
 *   - q (name LIKE)
 *
 * Görünürlük kuralı (MVP):
 *   - storefront_settings.is_enabled = true
 *   - companies.storefront_status IN ('approved')  — auto_suspended dahil değil
 *
 * Detay tasarım: EKRAN-PUBLIC-VITRIN.md (Sahibinden modeli, eşit görünüm).
 */

import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  branches,
  brands,
  categories,
  cities,
  companies,
  districts,
  productVariants,
  products,
  storefrontSettings,
  branchInventory,
} from '@/db/schema';

export interface StorefrontListItem {
  companyId: string;
  slug: string;
  name: string;
  cityId: number | null;
  cityName: string | null;
  districtId: string | null;
  districtName: string | null;
  whatsappPhone: string | null;
  aboutShort: string | null;
  productCount: number;
  branchCount: number;
  /** Yakınlık filtresi aktif ise km cinsinden mesafe, aksi null. */
  distanceKm: number | null;
  /** Harita marker'ları için — DB'de set edilmiş ise. */
  locationLat: number | null;
  locationLng: number | null;
}

export type StorefrontSort = 'name_asc' | 'recent' | 'products_desc';

export const STOREFRONT_SORTS: readonly StorefrontSort[] = [
  'name_asc',
  'recent',
  'products_desc',
];

/**
 * URL query'sinden gelen string'i güvenli StorefrontSort'a normalize et.
 * Bilinmeyen / eksik değer → 'name_asc' (varsayılan).
 */
export function parseSortParam(
  input: string | null | undefined,
): StorefrontSort {
  if (!input) return 'name_asc';
  return (STOREFRONT_SORTS as readonly string[]).includes(input)
    ? (input as StorefrontSort)
    : 'name_asc';
}

export interface ListStorefrontsFilters {
  cityId?: number;
  districtId?: string;
  q?: string;
  limit?: number;
  offset?: number;
  sort?: StorefrontSort;
  /**
   * Yakınlık filtresi — companies.location_lat/lng üzerinden haversine.
   * lat+lng+radiusKm tümü set ise filter aktive olur. Bbox optimization
   * için ±radius/111 derece pre-filter + haversine WHERE.
   *
   * `sort` parametresi 'name_asc' default olsa bile, location filter
   * varsa sıralama mesafe ASC'ye otomatik geçer (`location` sort tipi).
   */
  location?: {
    lat: number;
    lng: number;
    radiusKm: number;
  };
}

export interface StorefrontDetail {
  companyId: string;
  slug: string;
  name: string;
  cityId: number | null;
  cityName: string | null;
  districtId: string | null;
  districtName: string | null;
  storefrontStatus: string;
  // Settings
  aboutContent: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactTelegram: string | null;
  contactEmail: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialTwitter: string | null;
  socialTiktok: string | null;
  metaDescription: string | null;
  // Companies tablosu fallback whatsapp
  companyWhatsapp: string | null;
  /**
   * Faz 5 (2026-05-21) — Şube status özeti (vitrin tatil/pasif rendering).
   * Tüm şubeler tatildeyse hero'da "🏖 Tatilde" banner + WhatsApp disabled,
   * tüm şubeler pasif/tatil ise storefront null döner (filter).
   */
  branchSummary: {
    activeCount: number;
    holidayCount: number;
    inactiveCount: number;
    allOnHoliday: boolean;
    anyOperational: boolean;
  };
}

export interface StorefrontProduct {
  productId: string;
  productName: string;
  slug: string;
  defaultSalePrice: string | null;
  defaultVariantLabel: string | null;
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  categoryName: string | null;
  categorySlug: string | null;
}

export interface StorefrontProductDetail {
  productId: string;
  productName: string;
  slug: string;
  description: string | null;
  companyId: string;
  companySlug: string;
  companyName: string;
  categoryName: string | null;
  brandName: string | null;
  variants: Array<{
    variantId: string;
    valueLabel: string;
    sku: string;
    salePrice: string;
    isDefault: boolean;
    inStock: boolean;
  }>;
}

const MAX_LIMIT = 60;
const DEFAULT_LIMIT = 24;
const ABOUT_PREVIEW_CHARS = 180;

/**
 * Public dizine giren tenant'ları listele.
 *
 * Sıralama: storefront_settings.updated_at DESC (son aktif olanlar üstte).
 * Faz 2'de PostGIS ST_DWithin ile mesafe sıralaması eklenebilir.
 */
export async function listPublicStorefronts(
  db: DbClient,
  filters: ListStorefrontsFilters = {},
): Promise<StorefrontListItem[]> {
  const conditions = [
    eq(storefrontSettings.isEnabled, true),
    eq(companies.storefrontStatus, 'approved'),
  ];
  if (filters.cityId) {
    conditions.push(eq(companies.cityId, filters.cityId));
  }
  if (filters.districtId) {
    conditions.push(eq(companies.districtId, filters.districtId));
  }
  if (filters.q && filters.q.trim().length > 0) {
    const pattern = `%${filters.q.trim()}%`;
    // Ad ve about_content alanlarında ILIKE arama
    conditions.push(
      or(
        ilike(companies.name, pattern),
        ilike(storefrontSettings.aboutContent, pattern),
      )!,
    );
  }
  if (filters.location) {
    // Yakınlık filtresi — bbox pre-filter (index-friendly) + haversine
    // WHERE. PostGIS YOK; Postgres native math.
    const { lat, lng, radiusKm } = filters.location;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    conditions.push(sql`${companies.locationLat} IS NOT NULL`);
    conditions.push(sql`${companies.locationLng} IS NOT NULL`);
    conditions.push(
      sql`${companies.locationLat} BETWEEN ${lat - latDelta} AND ${lat + latDelta}`,
    );
    conditions.push(
      sql`${companies.locationLng} BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}`,
    );
    conditions.push(
      sql`(
        6371 * 2 * ASIN(LEAST(1, SQRT(
          POWER(SIN(RADIANS(${companies.locationLat}::float - ${lat}) / 2), 2)
          + COS(RADIANS(${lat})) * COS(RADIANS(${companies.locationLat}::float))
            * POWER(SIN(RADIANS(${companies.locationLng}::float - ${lng}) / 2), 2)
        )))
      ) <= ${radiusKm}`,
    );
  }

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(0, filters.offset ?? 0);
  const sort: StorefrontSort = filters.sort ?? 'name_asc';

  // productCount subquery — sort 'products_desc' için reuse edilebilmesi için sql template
  const productCountExpr = sql<number>`
    COALESCE((
      SELECT COUNT(*)::int FROM ${products}
      WHERE ${products.companyId} = ${companies.id}
        AND ${products.vitrinPublished} = true
        AND ${products.deletedAt} IS NULL
    ), 0)
  `;

  const baseQuery = db
    .select({
      companyId: companies.id,
      slug: companies.slug,
      name: companies.name,
      cityId: companies.cityId,
      cityName: cities.name,
      districtId: companies.districtId,
      districtName: districts.name,
      whatsappPhone: companies.whatsappPhone,
      aboutContent: storefrontSettings.aboutContent,
      locationLat: companies.locationLat,
      locationLng: companies.locationLng,
      productCount: productCountExpr,
      branchCount: sql<number>`
        COALESCE((
          SELECT COUNT(*)::int FROM ${branches}
          WHERE ${branches.companyId} = ${companies.id}
            AND ${branches.isActive} = true
        ), 0)
      `,
      // Yakınlık filtresi varsa distance_km hesabı, yoksa null
      distanceKm: filters.location
        ? sql<number>`(
            6371 * 2 * ASIN(LEAST(1, SQRT(
              POWER(SIN(RADIANS(${companies.locationLat}::float - ${filters.location.lat}) / 2), 2)
              + COS(RADIANS(${filters.location.lat})) * COS(RADIANS(${companies.locationLat}::float))
                * POWER(SIN(RADIANS(${companies.locationLng}::float - ${filters.location.lng}) / 2), 2)
            )))
          )`
        : sql<number | null>`NULL`,
    })
    .from(storefrontSettings)
    .innerJoin(companies, eq(companies.id, storefrontSettings.companyId))
    .leftJoin(cities, eq(cities.id, companies.cityId))
    .leftJoin(districts, eq(districts.id, companies.districtId))
    .where(and(...conditions));

  let ordered;
  if (filters.location) {
    // Yakınlık filtresi varsa mesafe ASC öncelikli
    const { lat, lng } = filters.location;
    ordered = baseQuery.orderBy(
      sql`(
        6371 * 2 * ASIN(LEAST(1, SQRT(
          POWER(SIN(RADIANS(${companies.locationLat}::float - ${lat}) / 2), 2)
          + COS(RADIANS(${lat})) * COS(RADIANS(${companies.locationLat}::float))
            * POWER(SIN(RADIANS(${companies.locationLng}::float - ${lng}) / 2), 2)
        )))
      ) ASC`,
      asc(companies.name),
    );
  } else if (sort === 'recent') {
    ordered = baseQuery.orderBy(
      desc(storefrontSettings.updatedAt),
      asc(companies.name),
    );
  } else if (sort === 'products_desc') {
    // productCount subquery'yi ORDER BY içinde tekrar yaz — Drizzle alias'ı
    // ORDER BY içinde reuse etmeyi desteklemiyor, raw sql kullan
    ordered = baseQuery.orderBy(
      sql`(
        SELECT COUNT(*)::int FROM ${products}
        WHERE ${products.companyId} = ${companies.id}
          AND ${products.vitrinPublished} = true
          AND ${products.deletedAt} IS NULL
      ) DESC`,
      asc(companies.name),
    );
  } else {
    ordered = baseQuery.orderBy(asc(companies.name));
  }

  const rows = await ordered.limit(limit).offset(offset);

  return rows.map((r) => ({
    companyId: r.companyId,
    slug: r.slug,
    name: r.name,
    cityId: r.cityId,
    cityName: r.cityName,
    districtId: r.districtId,
    districtName: r.districtName,
    whatsappPhone: r.whatsappPhone,
    aboutShort: r.aboutContent
      ? r.aboutContent.length > ABOUT_PREVIEW_CHARS
        ? `${r.aboutContent.slice(0, ABOUT_PREVIEW_CHARS).trim()}…`
        : r.aboutContent
      : null,
    productCount: r.productCount,
    branchCount: r.branchCount,
    distanceKm: r.distanceKm == null ? null : Number(r.distanceKm),
    locationLat: r.locationLat == null ? null : Number(r.locationLat),
    locationLng: r.locationLng == null ? null : Number(r.locationLng),
  }));
}

/**
 * Pet shop'u olan (approved + isEnabled) şehirleri listele — chip + sitemap için.
 *
 * Distinct cities INNER JOIN storefronts. Boş şehirler hariç.
 */
export async function listCitiesWithStorefronts(
  db: DbClient,
): Promise<Array<{ id: number; name: string; slug: string }>> {
  const rows = await db
    .selectDistinct({
      id: cities.id,
      name: cities.name,
      slug: cities.slug,
    })
    .from(cities)
    .innerJoin(companies, eq(companies.cityId, cities.id))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .where(
      and(
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .orderBy(asc(cities.name));
  return rows;
}

/**
 * Pet shop'u olan ilçeleri (cityId verilirse o ile bağlı) listele — chip için.
 *
 * Distinct districts INNER JOIN storefronts.
 */
export async function listDistrictsWithStorefronts(
  cityId: number,
  db: DbClient,
): Promise<Array<{ id: string; name: string; slug: string }>> {
  const rows = await db
    .selectDistinct({
      id: districts.id,
      name: districts.name,
      slug: districts.slug,
    })
    .from(districts)
    .innerJoin(companies, eq(companies.districtId, districts.id))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .where(
      and(
        eq(districts.cityId, cityId),
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .orderBy(asc(districts.name));
  return rows;
}

/**
 * Slug ile city lookup — SEO route (/vitrin/[il]) için.
 *
 * @returns Cities row veya null (slug yok).
 */
export async function getCityBySlug(
  slug: string,
  db: DbClient,
): Promise<{ id: number; name: string; slug: string } | null> {
  const rows = await db
    .select({
      id: cities.id,
      name: cities.name,
      slug: cities.slug,
    })
    .from(cities)
    .where(eq(cities.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Slug ile district lookup — SEO route (/vitrin/[il]/[ilce]) için.
 *
 * citySlug + districtSlug çiftiyle benzersiz. Aynı district slug birden
 * fazla şehirde olabilir (örn "merkez").
 *
 * @returns Districts row + city info veya null.
 */
export async function getDistrictBySlug(
  citySlug: string,
  districtSlug: string,
  db: DbClient,
): Promise<{
  city: { id: number; name: string; slug: string };
  district: { id: string; name: string; slug: string };
} | null> {
  const rows = await db
    .select({
      cityId: cities.id,
      cityName: cities.name,
      citySlug: cities.slug,
      districtId: districts.id,
      districtName: districts.name,
      districtSlug: districts.slug,
    })
    .from(districts)
    .innerJoin(cities, eq(cities.id, districts.cityId))
    .where(and(eq(cities.slug, citySlug), eq(districts.slug, districtSlug)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    city: { id: row.cityId, name: row.cityName, slug: row.citySlug },
    district: {
      id: row.districtId,
      name: row.districtName,
      slug: row.districtSlug,
    },
  };
}

/**
 * Aynı filtrelerle toplam tenant sayısı — pagination için.
 *
 * `listPublicStorefronts` ile aynı koşulları kullanır, sort/limit/offset YOK.
 */
export async function countPublicStorefronts(
  db: DbClient,
  filters: Pick<
    ListStorefrontsFilters,
    'cityId' | 'districtId' | 'q' | 'location'
  > = {},
): Promise<number> {
  const conditions = [
    eq(storefrontSettings.isEnabled, true),
    eq(companies.storefrontStatus, 'approved'),
  ];
  if (filters.cityId) {
    conditions.push(eq(companies.cityId, filters.cityId));
  }
  if (filters.districtId) {
    conditions.push(eq(companies.districtId, filters.districtId));
  }
  if (filters.q && filters.q.trim().length > 0) {
    const pattern = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        ilike(companies.name, pattern),
        ilike(storefrontSettings.aboutContent, pattern),
      )!,
    );
  }
  if (filters.location) {
    const { lat, lng, radiusKm } = filters.location;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    conditions.push(sql`${companies.locationLat} IS NOT NULL`);
    conditions.push(sql`${companies.locationLng} IS NOT NULL`);
    conditions.push(
      sql`${companies.locationLat} BETWEEN ${lat - latDelta} AND ${lat + latDelta}`,
    );
    conditions.push(
      sql`${companies.locationLng} BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}`,
    );
    conditions.push(
      sql`(
        6371 * 2 * ASIN(LEAST(1, SQRT(
          POWER(SIN(RADIANS(${companies.locationLat}::float - ${lat}) / 2), 2)
          + COS(RADIANS(${lat})) * COS(RADIANS(${companies.locationLat}::float))
            * POWER(SIN(RADIANS(${companies.locationLng}::float - ${lng}) / 2), 2)
        )))
      ) <= ${radiusKm}`,
    );
  }

  const rows = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(storefrontSettings)
    .innerJoin(companies, eq(companies.id, storefrontSettings.companyId))
    .where(and(...conditions));

  return rows[0]?.total ?? 0;
}

/**
 * Slug ile tenant detay — public profil sayfası.
 *
 * @returns Detay objesi veya null (yoksa / kapalıysa / approved değilse).
 */
export async function getStorefrontBySlug(
  slug: string,
  db: DbClient,
): Promise<StorefrontDetail | null> {
  const rows = await db
    .select({
      companyId: companies.id,
      slug: companies.slug,
      name: companies.name,
      cityId: companies.cityId,
      cityName: cities.name,
      districtId: companies.districtId,
      districtName: districts.name,
      storefrontStatus: companies.storefrontStatus,
      companyWhatsapp: companies.whatsappPhone,
      isEnabled: storefrontSettings.isEnabled,
      aboutContent: storefrontSettings.aboutContent,
      contactPhone: storefrontSettings.contactPhone,
      contactWhatsapp: storefrontSettings.contactWhatsapp,
      contactTelegram: storefrontSettings.contactTelegram,
      contactEmail: storefrontSettings.contactEmail,
      socialInstagram: storefrontSettings.socialInstagram,
      socialFacebook: storefrontSettings.socialFacebook,
      socialTwitter: storefrontSettings.socialTwitter,
      socialTiktok: storefrontSettings.socialTiktok,
      metaDescription: storefrontSettings.metaDescription,
    })
    .from(companies)
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .leftJoin(cities, eq(cities.id, companies.cityId))
    .leftJoin(districts, eq(districts.id, companies.districtId))
    .where(eq(companies.slug, slug))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!row.isEnabled) return null;
  if (row.storefrontStatus !== 'approved') return null;

  // Faz 5 — şube status özeti (tek query GROUP BY).
  const branchRows = (await db
    .select({
      status: branches.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(branches)
    .where(eq(branches.companyId, row.companyId))
    .groupBy(branches.status)) as Array<{ status: string; count: number }>;

  let activeCount = 0;
  let holidayCount = 0;
  let inactiveCount = 0;
  for (const r of branchRows) {
    if (r.status === 'active') activeCount = r.count;
    else if (r.status === 'holiday') holidayCount = r.count;
    else if (r.status === 'inactive') inactiveCount = r.count;
  }
  const anyOperational = activeCount + holidayCount > 0;
  const allOnHoliday = activeCount === 0 && holidayCount > 0;

  // Hiç operasyonel şube yoksa (hepsi pasif) → storefront vitrin'den çekilir.
  if (!anyOperational) return null;

  return {
    companyId: row.companyId,
    slug: row.slug,
    name: row.name,
    cityId: row.cityId,
    cityName: row.cityName,
    districtId: row.districtId,
    districtName: row.districtName,
    storefrontStatus: row.storefrontStatus,
    aboutContent: row.aboutContent,
    contactPhone: row.contactPhone,
    contactWhatsapp: row.contactWhatsapp,
    contactTelegram: row.contactTelegram,
    contactEmail: row.contactEmail,
    socialInstagram: row.socialInstagram,
    socialFacebook: row.socialFacebook,
    socialTwitter: row.socialTwitter,
    socialTiktok: row.socialTiktok,
    metaDescription: row.metaDescription,
    companyWhatsapp: row.companyWhatsapp,
    branchSummary: {
      activeCount,
      holidayCount,
      inactiveCount,
      allOnHoliday,
      anyOperational,
    },
  };
}

/**
 * Tenant'ın vitrin'e açık ürünleri.
 *
 * Default variant fiyatı + valueLabel join'i ile tek satır per product.
 */
export async function listStorefrontProducts(
  companyId: string,
  db: DbClient,
  limit: number = 48,
): Promise<StorefrontProduct[]> {
  // Default variant LEFT JOIN — is_default=true + is_active=true. Eğer
  // default işaretli variant yoksa NULL (UI fallback). Brand + kategori
  // LEFT JOIN: pet shop profilinde marka bazlı gruplama için.
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      slug: products.slug,
      defaultSalePrice: productVariants.salePrice,
      defaultVariantLabel: productVariants.valueLabel,
      brandId: brands.id,
      brandName: brands.name,
      brandSlug: brands.slug,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(
      productVariants,
      and(
        eq(productVariants.productId, products.id),
        eq(productVariants.isDefault, true),
        eq(productVariants.isActive, true),
      ),
    )
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(products.companyId, companyId),
        eq(products.vitrinPublished, true),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .orderBy(asc(brands.name), asc(products.name))
    .limit(Math.min(limit, 120));

  return rows;
}

/**
 * Pet shop profili için marka bazlı gruplandırılmış ürün listesi.
 *
 * groupByBrand=true ise: brand bazlı kümeler. Markasız ürünler en altta
 * "Diğer ürünler" bucket'ında. Tek-brand grupların ürünleri açık.
 */
export interface StorefrontBrandGroup {
  brandId: string | null;
  brandName: string;
  brandSlug: string | null;
  productCount: number;
  products: StorefrontProduct[];
}

export function groupStorefrontProductsByBrand(
  items: StorefrontProduct[],
): StorefrontBrandGroup[] {
  const groups = new Map<string, StorefrontBrandGroup>();
  for (const p of items) {
    const key = p.brandId ?? '__no_brand__';
    let group = groups.get(key);
    if (!group) {
      group = {
        brandId: p.brandId,
        brandName: p.brandName ?? 'Diğer ürünler',
        brandSlug: p.brandSlug,
        productCount: 0,
        products: [],
      };
      groups.set(key, group);
    }
    group.products.push(p);
    group.productCount += 1;
  }
  // Sıralama: markalı gruplar productCount DESC, alfabetik; en sonda
  // "Diğer ürünler" (markasız).
  const arr = Array.from(groups.values());
  arr.sort((a, b) => {
    if (a.brandId === null && b.brandId !== null) return 1;
    if (b.brandId === null && a.brandId !== null) return -1;
    if (a.productCount !== b.productCount) return b.productCount - a.productCount;
    return a.brandName.localeCompare(b.brandName, 'tr');
  });
  return arr;
}

/**
 * Pet shop'un belirli bir ürününün vitrin detayı.
 *
 * Visibility: companies.storefront_status='approved' AND
 *             storefront_settings.is_enabled=true AND
 *             products.vitrin_published=true AND products.deleted_at IS NULL.
 *
 * @returns Detay objesi veya null (yoksa / gizliyse).
 */
export async function getStorefrontProductDetail(
  companySlug: string,
  productSlug: string,
  db: DbClient,
): Promise<StorefrontProductDetail | null> {
  // Header query — ürün + şirket + kategori + marka
  const headerRows = await db
    .select({
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      description: products.description,
      companyId: companies.id,
      companySlug: companies.slug,
      companyName: companies.name,
      companyStorefrontStatus: companies.storefrontStatus,
      isEnabled: storefrontSettings.isEnabled,
      vitrinPublished: products.vitrinPublished,
      deletedAt: products.deletedAt,
      categoryName: categories.name,
      brandName: brands.name,
    })
    .from(products)
    .innerJoin(companies, eq(companies.id, products.companyId))
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(
      and(
        eq(companies.slug, companySlug),
        eq(products.slug, productSlug),
      ),
    )
    .limit(1);

  const head = headerRows[0];
  if (!head) return null;
  if (head.companyStorefrontStatus !== 'approved') return null;
  if (!head.isEnabled) return null;
  if (!head.vitrinPublished) return null;
  if (head.deletedAt) return null;

  // Variant'lar — GROUP BY ile aggregate (Drizzle subquery alias çakışmasını
  // önlemek için LEFT JOIN + SUM pattern).
  const variantRows = await db
    .select({
      variantId: productVariants.id,
      valueLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      salePrice: productVariants.salePrice,
      isDefault: productVariants.isDefault,
      displayOrder: productVariants.displayOrder,
      totalStock: sql<number>`COALESCE(SUM(${branchInventory.stockQty}), 0)::int`,
    })
    .from(productVariants)
    .leftJoin(
      branchInventory,
      eq(branchInventory.variantId, productVariants.id),
    )
    .where(
      and(
        eq(productVariants.productId, head.productId),
        eq(productVariants.isActive, true),
      ),
    )
    .groupBy(
      productVariants.id,
      productVariants.valueLabel,
      productVariants.sku,
      productVariants.salePrice,
      productVariants.isDefault,
      productVariants.displayOrder,
    )
    .orderBy(asc(productVariants.displayOrder), asc(productVariants.valueLabel));

  return {
    productId: head.productId,
    productName: head.productName,
    slug: head.productSlug,
    description: head.description,
    companyId: head.companyId,
    companySlug: head.companySlug,
    companyName: head.companyName,
    categoryName: head.categoryName,
    brandName: head.brandName,
    variants: variantRows.map((v) => ({
      variantId: v.variantId,
      valueLabel: v.valueLabel,
      sku: v.sku,
      salePrice: v.salePrice,
      isDefault: v.isDefault,
      inStock: v.totalStock > 0,
    })),
  };
}

/**
 * WhatsApp deep link URL'i üret.
 *
 * Türk numara normalize: 0 prefix kaldır, +90 ekle, 5xx başlıyorsa zaten OK.
 * "Karaköy Pet, vitrin'de gördüm — ... ürünü hala var mı?" gibi prefill metin.
 *
 * @returns wa.me URL veya null (numara yoksa).
 */
export function buildWhatsappLink(
  phone: string | null | undefined,
  message?: string,
): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  let normalized = cleaned;
  if (normalized.startsWith('+')) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith('0')) {
    normalized = '90' + normalized.slice(1);
  }
  if (!normalized.startsWith('90') && normalized.length === 10) {
    normalized = '90' + normalized;
  }
  if (normalized.length < 10) return null;
  const url = `https://wa.me/${normalized}`;
  if (message) {
    return `${url}?text=${encodeURIComponent(message)}`;
  }
  return url;
}
