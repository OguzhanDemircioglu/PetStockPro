/**
 * Sitemap data — Next.js `app/sitemap.ts` için URL listesi.
 *
 * MVP yaklaşım: dynamic SSR sitemap (DEVAM-REHBERI'nde pg_cron + R2 pre-build
 * planlı ama 81 il + ~970 ilçe + N tenant + N ürün = max ~2K URL'lik kapsam
 * Workers 5dk limitine fazlasıyla sığar; pre-build Faz 2'de scale gerektiğinde).
 *
 * Yayınlanan URL grupları:
 *   - / (anasayfa) + /vitrin (dizin) — static
 *   - /vitrin/[il] — pet shop'u olan iller (cross-listing helpers ile)
 *   - /vitrin/[il]/[ilce] — pet shop'u olan ilçeler
 *   - /vitrin/magaza/[slug] — approved + isEnabled tenant'lar
 *   - /vitrin/magaza/[slug]/urun/[productSlug] — vitrin'de yayında ürünler
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  categories,
  cities,
  companies,
  districts,
  products,
  storefrontSettings,
} from '@/db/schema';

export interface SitemapEntry {
  loc: string;
  lastModified?: Date;
  changeFrequency?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
}

/**
 * Tüm sitemap entry'lerini toplar.
 *
 * @param baseUrl - "https://petstockpro.com" gibi (slash YOK)
 * @param db - drizzle client
 */
export async function collectSitemapEntries(
  baseUrl: string,
  db: DbClient,
): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];

  // Static — anasayfa + vitrin dizin
  entries.push({
    loc: `${baseUrl}/`,
    changeFrequency: 'weekly',
    priority: 1.0,
  });
  entries.push({
    loc: `${baseUrl}/vitrin`,
    changeFrequency: 'daily',
    priority: 0.9,
  });

  // Active cities — pet shop'u olan iller
  const cityRows = await db
    .selectDistinct({
      id: cities.id,
      name: cities.name,
      slug: cities.slug,
    })
    .from(cities)
    .innerJoin(companies, eq(companies.cityId, cities.id))
    .innerJoin(
      storefrontSettings,
      eq(storefrontSettings.companyId, companies.id),
    )
    .where(
      and(
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .orderBy(asc(cities.slug));

  for (const c of cityRows) {
    entries.push({
      loc: `${baseUrl}/vitrin/${c.slug}`,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  // Active districts — pet shop'u olan ilçeler (her şehir altı)
  const districtRows = await db
    .selectDistinct({
      citySlug: cities.slug,
      districtSlug: districts.slug,
    })
    .from(districts)
    .innerJoin(cities, eq(cities.id, districts.cityId))
    .innerJoin(companies, eq(companies.districtId, districts.id))
    .innerJoin(
      storefrontSettings,
      eq(storefrontSettings.companyId, companies.id),
    )
    .where(
      and(
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .orderBy(asc(cities.slug), asc(districts.slug));

  for (const d of districtRows) {
    entries.push({
      loc: `${baseUrl}/vitrin/${d.citySlug}/${d.districtSlug}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  // Tenant profilleri — approved + isEnabled
  const tenantRows = await db
    .select({
      slug: companies.slug,
      lastModified: storefrontSettings.updatedAt,
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
      ),
    )
    .orderBy(asc(companies.slug));

  for (const t of tenantRows) {
    entries.push({
      loc: `${baseUrl}/vitrin/magaza/${t.slug}`,
      lastModified: t.lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  // Vitrin'de yayında ürünler — products.vitrin_published=true AND deleted_at IS NULL
  // AND companies approved + isEnabled
  const productRows = await db
    .select({
      companySlug: companies.slug,
      productSlug: products.slug,
      lastModified: sql<Date>`GREATEST(
        ${products.updatedAt},
        ${storefrontSettings.updatedAt}
      )`,
    })
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
    )
    .orderBy(asc(companies.slug), asc(products.slug));

  for (const p of productRows) {
    entries.push({
      loc: `${baseUrl}/vitrin/magaza/${p.companySlug}/urun/${p.productSlug}`,
      lastModified: p.lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  // Cross-tenant kategori sayfaları — distinct slug, en az 1 vitrin'de ürünü
  // olan kategoriler (default 16 slug + tenant'ların custom ekledikleri).
  const categoryRows = await db
    .selectDistinct({ slug: categories.slug })
    .from(categories)
    .innerJoin(products, eq(products.categoryId, categories.id))
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
    )
    .orderBy(asc(categories.slug));

  for (const c of categoryRows) {
    entries.push({
      loc: `${baseUrl}/vitrin/kategori/${c.slug}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  return entries;
}

/**
 * Public base URL — Workers env veya `.env`'den.
 *
 * Production: `https://petstockpro.com`
 * Dev: `http://localhost:3000`
 */
export function getPublicBaseUrl(): string {
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? null;
  if (env) {
    return env.replace(/\/+$/, ''); // sonundaki slash'leri sil
  }
  return 'http://localhost:3000';
}
