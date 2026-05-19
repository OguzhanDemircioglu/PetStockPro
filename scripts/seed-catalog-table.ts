/**
 * Seed catalog_seed_products tablosu — JSON → Aiven/Supabase.
 *
 * `scripts/data/pet-products-catalog.json` (1.240 ürün, v0.2.6+)
 *   → petstockpro.catalog_seed_products
 *
 * Akış:
 *   1. JSON yükle
 *   2. Her ürün için imagePath'i R2 object key'e çevir:
 *        "scripts/data/images/abc123.webp" → "seed/abc123.webp"
 *   3. animal_type, category_slug VARCHAR sınırlarına uy (uzun değer reject)
 *   4. Bulk INSERT ON CONFLICT DO NOTHING (chunk 500 per batch)
 *   5. Sonra count + sample 5 print
 *
 * Idempotent: tekrar çalıştırılırsa UNIQUE (brand, name, weight) duplicate'ları skip eder.
 *
 * Hedef ortam: LOCAL_DB_* set ise Aiven, yoksa DATABASE_URL.
 *
 * Çalıştırma:
 *   npx tsx scripts/seed-catalog-table.ts
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env');
}

const CATALOG_PATH = resolve(process.cwd(), 'scripts/data/pet-products-catalog.json');
const CHUNK_SIZE = 500;

interface PetProduct {
  name: string;
  brand: string;
  categorySlug: string;
  animalType: string;
  weight: string;
  imagePath: string | null;
}

interface CatalogFile {
  products: PetProduct[];
}

interface SeedRow {
  name: string;
  brand: string;
  weight: string;
  animal_type: string;
  category_slug: string;
  image_path: string;
}

function toR2Key(localPath: string): string {
  // "scripts/data/images/abc123.webp" → "seed/abc123.webp"
  return `seed/${basename(localPath)}`;
}

function normalize(p: PetProduct): SeedRow | null {
  if (!p.imagePath) return null;
  if (!p.name || !p.brand || !p.weight) return null;
  const image_path = toR2Key(p.imagePath);
  // VARCHAR sınır kontrolü (overflow olanları skip et — veri kalitesi)
  if (p.name.length > 180) return null;
  if (p.brand.length > 60) return null;
  if (p.weight.length > 16) return null;
  if (p.animalType.length > 10) return null;
  if (p.categorySlug.length > 40) return null;
  if (image_path.length > 48) return null;
  return {
    name: p.name,
    brand: p.brand,
    weight: p.weight,
    animal_type: p.animalType,
    category_slug: p.categorySlug,
    image_path,
  };
}

async function main(): Promise<void> {
  console.log('[seed] Loading catalog JSON...');
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8')) as CatalogFile;
  console.log(`[seed] Source: ${catalog.products.length} products`);

  const rows: SeedRow[] = [];
  const skipped: string[] = [];
  for (const p of catalog.products) {
    const n = normalize(p);
    if (n) rows.push(n);
    else skipped.push(`${p.brand} ${p.name} (${p.weight})`);
  }
  console.log(`[seed] Valid rows: ${rows.length}`);
  console.log(`[seed] Skipped:    ${skipped.length}`);
  if (skipped.length > 0 && skipped.length <= 10) {
    skipped.forEach((s) => console.log(`  - ${s}`));
  }

  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  // Önce mevcut satır sayısını kontrol et
  const [{ c: existing }] = await sql<[{ c: number }]>`
    SELECT count(*)::int AS c FROM petstockpro.catalog_seed_products
  `;
  console.log(`[seed] Existing rows in DB: ${existing}`);

  // Bulk insert chunk'lı
  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const batch = rows.slice(i, i + CHUNK_SIZE);
    const result = await sql`
      INSERT INTO petstockpro.catalog_seed_products
        ${sql(batch, 'name', 'brand', 'weight', 'animal_type', 'category_slug', 'image_path')}
      ON CONFLICT (brand, name, weight) DO NOTHING
    `;
    totalInserted += result.count;
    process.stdout.write(`\r[seed] ${Math.min(i + CHUNK_SIZE, rows.length)}/${rows.length} (inserted ${totalInserted})`);
  }
  process.stdout.write('\n');

  // Final count + sample
  const [{ c: finalCount }] = await sql<[{ c: number }]>`
    SELECT count(*)::int AS c FROM petstockpro.catalog_seed_products
  `;
  const samples = await sql<Array<{ id: number; name: string; brand: string; weight: string }>>`
    SELECT id, name, brand, weight
    FROM petstockpro.catalog_seed_products
    ORDER BY random()
    LIMIT 5
  `;

  console.log(`[seed] Final row count: ${finalCount}`);
  console.log(`[seed] Newly inserted:  ${totalInserted}`);
  console.log(`[seed] Sample 5 rows:`);
  for (const s of samples) {
    console.log(`  #${s.id} ${s.brand} ${s.name} (${s.weight})`);
  }

  // VACUUM ANALYZE — planner istatistikleri güncel olsun
  await sql.unsafe('VACUUM ANALYZE petstockpro.catalog_seed_products');
  console.log('[seed] VACUUM ANALYZE done.');

  await sql.end();
}

main().catch((e) => {
  console.error('[seed] FATAL:', e);
  process.exit(1);
});
