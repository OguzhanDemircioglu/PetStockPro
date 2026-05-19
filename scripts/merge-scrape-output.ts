/**
 * Merge scraped products into the main catalog (v0.2.0 bump).
 *
 * Steps:
 *   1. Load existing catalog (v0.1.x, 328 products)
 *   2. Load scrape-output.json (new products with image guaranteed)
 *   3. Dedup against existing (brand+name+weight, case-insensitive)
 *   4. Append new products to catalog.products
 *   5. Recompute stats (byAnimalType, topBrands, byCategorySlug, withBarcode, withImageUrl, withSourceUrl, withImagePath)
 *   6. Bump version 0.1.x → 0.2.0 (MINOR — schema rule changed: imagePath mandatory for new entries)
 *   7. Update generatedAt
 *   8. Write back
 *
 * Çalıştırma:
 *   npx tsx scripts/merge-scrape-output.ts
 *
 * Idempotent: tekrar çalıştırılırsa scrape-output ürünleri zaten ana catalog'da olduğu için
 * "0 new added" çıktısı verir (dedup koruması).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CATALOG_PATH = resolve(process.cwd(), 'scripts/data/pet-products-catalog.json');
const SCRAPE_OUTPUT_PATH = resolve(process.cwd(), 'scripts/data/scrape-output.json');

type AnimalType = 'cat' | 'dog' | 'bird' | 'fish' | 'rabbit' | 'hamster' | 'reptile';

interface PetProduct {
  name: string;
  brand: string;
  categorySlug: string;
  animalType: AnimalType;
  weight: string;
  barcode: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  description: string;
  sourceUrl: string | null;
}

interface CatalogStats {
  totalProducts: number;
  byAnimalType: Record<string, number>;
  topBrands: Record<string, number>;
  byCategorySlug: Record<string, number>;
  withBarcode: number;
  withImageUrl: number;
  withSourceUrl: number;
  withImagePath: number;
}

interface CatalogFile {
  version: string;
  generatedAt: string;
  description: string;
  schema: Record<string, string>;
  stats: CatalogStats;
  products: PetProduct[];
}

interface ScrapeOutput {
  products: PetProduct[];
}

function recomputeStats(products: PetProduct[]): CatalogStats {
  const byAnimal: Record<string, number> = {};
  const byBrand: Record<string, number> = {};
  const bySlug: Record<string, number> = {};
  for (const p of products) {
    byAnimal[p.animalType] = (byAnimal[p.animalType] ?? 0) + 1;
    byBrand[p.brand] = (byBrand[p.brand] ?? 0) + 1;
    bySlug[p.categorySlug] = (bySlug[p.categorySlug] ?? 0) + 1;
  }
  const topBrands = Object.entries(byBrand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .reduce<Record<string, number>>((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});
  return {
    totalProducts: products.length,
    byAnimalType: byAnimal,
    topBrands,
    byCategorySlug: bySlug,
    withBarcode: products.filter((p) => p.barcode).length,
    withImageUrl: products.filter((p) => p.imageUrl).length,
    withSourceUrl: products.filter((p) => p.sourceUrl).length,
    withImagePath: products.filter((p) => p.imagePath).length,
  };
}

async function main(): Promise<void> {
  console.log('[merge] Loading catalogs...');
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8')) as CatalogFile;
  const scrape = JSON.parse(await readFile(SCRAPE_OUTPUT_PATH, 'utf8')) as ScrapeOutput;

  console.log(`[merge] Existing: ${catalog.products.length} | Scraped: ${scrape.products.length}`);

  // Dedup set from existing catalog
  const dedupSet = new Set<string>();
  for (const p of catalog.products) {
    const key = `${p.brand}|${p.name}|${p.weight}`.toLowerCase().trim();
    dedupSet.add(key);
  }

  // Filter new products — skip duplicates + skip imagePath-less (safety net; scraper already guarantees this)
  const toAdd: PetProduct[] = [];
  let skippedDup = 0;
  let skippedNoImage = 0;

  for (const p of scrape.products) {
    const key = `${p.brand}|${p.name}|${p.weight}`.toLowerCase().trim();
    if (dedupSet.has(key)) {
      skippedDup++;
      continue;
    }
    if (!p.imagePath) {
      skippedNoImage++;
      continue;
    }
    dedupSet.add(key);
    toAdd.push(p);
  }

  console.log(`[merge] To add: ${toAdd.length}`);
  console.log(`[merge]   Skipped duplicates: ${skippedDup}`);
  console.log(`[merge]   Skipped no-image:   ${skippedNoImage}`);

  if (toAdd.length === 0) {
    console.log('[merge] Nothing to add. Exit.');
    return;
  }

  // Append + recompute
  const merged = [...catalog.products, ...toAdd];
  const newStats = recomputeStats(merged);

  // Version bump: 0.1.x → 0.2.0 first time, then patch bumps 0.2.0 → 0.2.1 etc.
  function bumpVersion(current: string): string {
    const parts = current.split('.').map((s) => Number(s));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return '0.2.0';
    if (parts[0] === 0 && parts[1] < 2) return '0.2.0';
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }

  const newVersion = bumpVersion(catalog.version);

  const newCatalog: CatalogFile = {
    ...catalog,
    version: newVersion,
    generatedAt: new Date().toISOString().slice(0, 10),
    description:
      catalog.description ||
      'TR pet shop pazarında yaygın ürünlerin seed katalogu — tenant ürün eklerken otomatik tamamlama için.',
    stats: newStats,
    products: merged,
  };

  await writeFile(CATALOG_PATH, JSON.stringify(newCatalog, null, 2));

  console.log(`[merge] Done.`);
  console.log(`[merge]   Version:      ${catalog.version} → ${newVersion}`);
  console.log(`[merge]   Total products: ${catalog.products.length} → ${merged.length}`);
  console.log(`[merge]   Image coverage: ${newStats.withImagePath}/${merged.length} (${((newStats.withImagePath / merged.length) * 100).toFixed(1)}%)`);
  console.log(`[merge]   Unique brands:  ${Object.keys(newStats.topBrands).length}+ (top 30 shown)`);
  console.log(`[merge]   Categories:     ${Object.keys(newStats.byCategorySlug).length}`);
}

main().catch((err) => {
  console.error('[merge] FATAL:', err);
  process.exit(1);
});
