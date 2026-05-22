/**
 * Global brand seed — catalog_seed_products'taki DISTINCT marka isimlerini
 * GLOBAL `brands` tablosuna ekler (Migration 0026, 2026-05-22).
 *
 * Önceki davranış (her tenant'a kendi brand kopyası) artık geçersiz. brands
 * GLOBAL tablo; bu helper sadece bootstrap için kullanılır (SUPERADMIN'in
 * brand listesini doldurması). Onboarding'de çağrılmaz.
 */

import { sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { brands, catalogSeedProducts } from '@/db/schema';
import { makeSlug } from '@/lib/utils/slug';

export interface SeedBrandsResult {
  inserted: number;
  skipped: number;
  totalCandidates: number;
}

/**
 * `catalog_seed_products` tablosundan DISTINCT marka isimlerini alır,
 * GLOBAL `brands` tablosuna insert eder.
 *
 * Davranış:
 *   - Aynı slug zaten varsa o satır skip.
 *   - Boş/space-only marka isimleri filtre dışı.
 *
 * Idempotent: tekrar çağrılırsa zaten var olanları skip eder.
 */
export async function seedCatalogBrandsGlobal(
  db: DbClient,
): Promise<SeedBrandsResult> {
  const candidates = await db
    .selectDistinct({ name: catalogSeedProducts.brand })
    .from(catalogSeedProducts);

  const seen = new Set<string>();
  const valid: Array<{ name: string; slug: string }> = [];
  for (const row of candidates) {
    const name = row.name?.trim();
    if (!name) continue;
    const slug = makeSlug(name);
    if (slug.length === 0) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    valid.push({ name, slug });
  }

  if (valid.length === 0) {
    return { inserted: 0, skipped: 0, totalCandidates: 0 };
  }

  const existing = await db.select({ slug: brands.slug }).from(brands);
  const existingSlugs = new Set(existing.map((b) => b.slug));

  const toInsert = valid.filter((v) => !existingSlugs.has(v.slug));
  if (toInsert.length === 0) {
    return {
      inserted: 0,
      skipped: valid.length,
      totalCandidates: valid.length,
    };
  }

  try {
    await db.insert(brands).values(
      toInsert.map((v) => ({
        name: v.name,
        slug: v.slug,
        logoUrl: null,
      })),
    );
    return {
      inserted: toInsert.length,
      skipped: valid.length - toInsert.length,
      totalCandidates: valid.length,
    };
  } catch {
    let inserted = 0;
    for (const v of toInsert) {
      try {
        await db.insert(brands).values({
          name: v.name,
          slug: v.slug,
          logoUrl: null,
        });
        inserted++;
      } catch {
        // skip — race
      }
    }
    return {
      inserted,
      skipped: valid.length - inserted,
      totalCandidates: valid.length,
    };
  }
}

/**
 * Catalog'ta kaç DISTINCT marka var — UI bilgilendirme için.
 */
export async function countCatalogBrands(db: DbClient): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`COUNT(DISTINCT ${catalogSeedProducts.brand})::int` })
    .from(catalogSeedProducts)
    .where(sql`${catalogSeedProducts.brand} IS NOT NULL AND length(trim(${catalogSeedProducts.brand})) > 0`);
  return rows[0]?.c ?? 0;
}
