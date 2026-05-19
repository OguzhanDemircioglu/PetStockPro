/**
 * Image-mandatory invariant enforcer.
 *
 * v0.2.0+ schema kuralı: HER ÜRÜNÜN imagePath ALANI DOLU OLMALI VE DOSYA DİSKTE BULUNMALI.
 * Bu script:
 *   1. Catalog'u tara
 *   2. imagePath === null OLAN ürünleri SİL
 *   3. imagePath SET ama dosya disk'te YOK olanları da SİL (broken reference)
 *   4. Kalanlar için stats yeniden hesapla
 *   5. Version bump (PATCH)
 *
 * Bu operasyon irreversible — yedeği `scripts/data/pet-products-catalog.backup.json` olarak yazar.
 *
 * Çalıştırma:
 *   npx tsx scripts/filter-imageless-products.ts
 */

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CATALOG_PATH = resolve(process.cwd(), 'scripts/data/pet-products-catalog.json');
const BACKUP_PATH = resolve(process.cwd(), 'scripts/data/pet-products-catalog.backup.json');

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

function bumpPatch(version: string): string {
  const parts = version.split('.').map((s) => Number(s));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return version;
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

async function main(): Promise<void> {
  console.log('[filter] Loading catalog...');
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8')) as CatalogFile;
  console.log(`[filter] Before: ${catalog.products.length} products`);

  // Yedek
  await copyFile(CATALOG_PATH, BACKUP_PATH);
  console.log(`[filter] Backup written: ${BACKUP_PATH}`);

  // Filter — kuralı çiğneyenleri tespit et
  let noPath = 0;
  let brokenRef = 0;
  const kept: PetProduct[] = [];
  const removed: PetProduct[] = [];

  for (const p of catalog.products) {
    if (!p.imagePath) {
      noPath++;
      removed.push(p);
      continue;
    }
    const abs = resolve(process.cwd(), p.imagePath);
    if (!existsSync(abs)) {
      brokenRef++;
      removed.push(p);
      continue;
    }
    kept.push(p);
  }

  console.log(`[filter] Removed: ${removed.length}`);
  console.log(`[filter]   imagePath null:    ${noPath}`);
  console.log(`[filter]   broken file ref:   ${brokenRef}`);
  console.log(`[filter] Kept: ${kept.length}`);

  if (removed.length === 0) {
    console.log('[filter] Hiç kaldırılacak ürün yok — invariant zaten geçerli.');
    return;
  }

  // Kaldırılan ürün adlarını dump (audit)
  const removedNames = removed.slice(0, 30).map((p) => `${p.brand} ${p.name} (${p.weight})`);
  console.log('[filter] İlk 30 kaldırılan ürün:');
  for (const n of removedNames) console.log(`  - ${n}`);
  if (removed.length > 30) {
    console.log(`  ... ve ${removed.length - 30} ürün daha`);
  }

  // Stats + version
  const newStats = recomputeStats(kept);
  const newCatalog: CatalogFile = {
    ...catalog,
    version: bumpPatch(catalog.version),
    generatedAt: new Date().toISOString().slice(0, 10),
    stats: newStats,
    products: kept,
  };
  await writeFile(CATALOG_PATH, JSON.stringify(newCatalog, null, 2));

  console.log(`[filter] Done.`);
  console.log(`[filter]   Version:      ${catalog.version} → ${newCatalog.version}`);
  console.log(`[filter]   Total:        ${catalog.products.length} → ${kept.length}`);
  console.log(`[filter]   Image coverage: ${newStats.withImagePath}/${kept.length} (${((newStats.withImagePath / kept.length) * 100).toFixed(1)}%)`);
}

main().catch((e) => {
  console.error('[filter] FATAL:', e);
  process.exit(1);
});
