/**
 * catalog_seed_products seed helper (Migration 0018 reuse).
 *
 * `scripts/data/pet-products-catalog.json` (1.240 ürün) → `petstockpro.catalog_seed_products`.
 *
 * Bootstrap (FAZ 1) ve `tsx scripts/seed-catalog-table.ts` ortak çağırır.
 * Idempotent: UNIQUE (brand, name, weight) çakışırsa DO UPDATE (description/path refresh).
 *
 * NOT: VACUUM ANALYZE bu helper içinde DEĞİL — caller'a bırakılır
 * (transaction-safe olmadığı için bootstrap sırasında problemli).
 */
import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { catalogSeedProducts } from '@/db/schema';

const CATALOG_PATH = resolve(process.cwd(), 'scripts/data/pet-products-catalog.json');
const CHUNK_SIZE = 500;

interface PetProduct {
  name: string;
  brand: string;
  categorySlug: string;
  animalType: string;
  weight: string;
  imagePath: string | null;
  description?: string;
}

interface CatalogFile {
  products: PetProduct[];
}

interface SeedRow {
  name: string;
  brand: string;
  weight: string;
  animalType: string;
  categorySlug: string;
  imagePath: string;
  description: string | null;
}

export interface SeedCatalogResult {
  inserted: number;
  skipped: boolean;
  total: number;
}

function normalize(p: PetProduct): SeedRow | null {
  if (!p.imagePath) return null;
  if (!p.name || !p.brand || !p.weight) return null;
  const imagePath = `seed/${basename(p.imagePath)}`;
  if (p.name.length > 180) return null;
  if (p.brand.length > 60) return null;
  if (p.weight.length > 16) return null;
  if (p.animalType.length > 10) return null;
  if (p.categorySlug.length > 40) return null;
  if (imagePath.length > 48) return null;
  const desc =
    p.description && p.description.trim().length > 0
      ? p.description.trim().slice(0, 1000)
      : null;
  return {
    name: p.name,
    brand: p.brand,
    weight: p.weight,
    animalType: p.animalType,
    categorySlug: p.categorySlug,
    imagePath,
    description: desc,
  };
}

/**
 * @param force — true ise mevcut satır olsa bile JSON'dan tekrar upsert eder
 *   (description refresh için manuel script kullanır). Bootstrap default false
 *   — yani satır varsa skip eder.
 */
export async function seedCatalogProducts(
  db: DbClient,
  logger: (msg: string) => void = () => {},
  opts: { force?: boolean } = {},
): Promise<SeedCatalogResult> {
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(catalogSeedProducts);
  const existingCount = existing[0]?.count ?? 0;

  if (existingCount > 0 && !opts.force) {
    logger(`[seed:catalog] ${existingCount} satır mevcut — skip`);
    return { inserted: 0, skipped: true, total: existingCount };
  }

  let catalog: CatalogFile;
  try {
    catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8')) as CatalogFile;
  } catch (err) {
    logger(`[seed:catalog] ⚠ JSON okunamadı (${CATALOG_PATH}) — skip`);
    throw err;
  }

  const rows: SeedRow[] = [];
  for (const p of catalog.products) {
    const n = normalize(p);
    if (n) rows.push(n);
  }
  logger(`[seed:catalog] Source: ${catalog.products.length}, valid: ${rows.length}`);

  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const batch = rows.slice(i, i + CHUNK_SIZE);
    const result = await db
      .insert(catalogSeedProducts)
      .values(batch)
      .onConflictDoUpdate({
        target: [catalogSeedProducts.brand, catalogSeedProducts.name, catalogSeedProducts.weight],
        set: {
          animalType: sql`excluded.animal_type`,
          categorySlug: sql`excluded.category_slug`,
          imagePath: sql`excluded.image_path`,
          description: sql`excluded.description`,
        },
      })
      .returning({ id: catalogSeedProducts.id });
    totalInserted += result.length;
  }
  logger(`[seed:catalog] inserted/updated ${totalInserted}/${rows.length}`);
  return { inserted: totalInserted, skipped: false, total: existingCount + totalInserted };
}
