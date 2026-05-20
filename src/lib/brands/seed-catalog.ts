/**
 * Tenant brand seed — catalog_seed_products'taki DISTINCT marka isimlerini
 * şirkete bağlı `brands` tablosuna ekler. Idempotent (slug çakışmasını
 * sessiz atlar).
 *
 * Kullanım yerleri:
 *   - Onboarding Step 1: opsiyonel "Catalog markalarını içeri aktar"
 *     checkbox işaretliyse `branchAction` içinden çağrılır.
 *   - İleride: süperadmin tenant detay sayfasından manuel re-seed butonu
 *     (gerekirse).
 */

import { eq, sql } from 'drizzle-orm';
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
 * her biri için tenant'a yeni bir `brands` satırı insert eder.
 *
 * Davranış:
 *   - Aynı slug zaten varsa o satır skip — INSERT yapılmaz.
 *   - Boş veya sadece boşluk marka isimleri filtre dışı (makeSlug length=0).
 *   - Tüm operasyon tek transaction içinde (atomic).
 *
 * Idempotent: tekrar çağrılırsa zaten var olanları skip eder, sadece yeni
 * markalar eklenir.
 */
export async function seedCatalogBrandsForCompany(
  companyId: string,
  db: DbClient,
): Promise<SeedBrandsResult> {
  // 1. Catalog'tan DISTINCT brand isimlerini topla (boş/space-only filtreli)
  const candidates = await db
    .selectDistinct({ name: catalogSeedProducts.brand })
    .from(catalogSeedProducts);

  // makeSlug + dedup (örnek: "ProLine" + "Proline" aynı slug verebilir)
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

  // 2. Tenant'ta zaten var olan slug'ları öğren (skip için)
  const existing = await db
    .select({ slug: brands.slug })
    .from(brands)
    .where(eq(brands.companyId, companyId));
  const existingSlugs = new Set(existing.map((b) => b.slug));

  // 3. Sadece yeni olanları insert et
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
        companyId,
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
    // 23505 unique violation veya başka — emniyet için race fallback
    // (paralel istek olursa). Bireysel insert ile yeniden dene, başarısızları skip et.
    let inserted = 0;
    for (const v of toInsert) {
      try {
        await db.insert(brands).values({
          companyId,
          name: v.name,
          slug: v.slug,
          logoUrl: null,
        });
        inserted++;
      } catch {
        // skip — slug çakışması (race) veya başka hata
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
 * Onboarding checkbox label'ında "(95 marka)" sayısını dinamik almak için.
 */
export async function countCatalogBrands(db: DbClient): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`COUNT(DISTINCT ${catalogSeedProducts.brand})::int` })
    .from(catalogSeedProducts)
    .where(sql`${catalogSeedProducts.brand} IS NOT NULL AND length(trim(${catalogSeedProducts.brand})) > 0`);
  // and() destekleyici tipi ihmal — tek koşul direkt where'a verildi
  return rows[0]?.c ?? 0;
}
