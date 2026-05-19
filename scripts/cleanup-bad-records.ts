/**
 * Quality cleanup — kalitesiz scrape kayıtlarını temizle.
 *
 * Silinecekler:
 *   1. Generic title: "7/24 Online Pet Market, Evcil Hayvan Ürünleri" gibi
 *      — markamama'nın og:title fallback'i, gerçek ürün adı içermez.
 *   2. Range weight artifacts: URL'de "9-18-5-cm" gibi yazılmış olup weight regex'in
 *      "9.185 cm" gibi yanlış parse ettiği kayıtlar.
 *      Heuristic: weight'in ondalık kısmı 2+ hane → range artifact.
 *      Ek: weight'inde "-" var → de range tutması (örn "M-L").
 *   3. Çok kısa name (<15 char): nadir, parse hatası.
 *
 * Çalıştırma:
 *   npx tsx scripts/cleanup-bad-records.ts
 */

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CATALOG_PATH = resolve(process.cwd(), 'scripts/data/pet-products-catalog.json');
const BACKUP_PATH = resolve(process.cwd(), 'scripts/data/pet-products-catalog.pre-cleanup.json');

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

const GENERIC_TITLE_RE =
  /^(7\/24|Online Pet|Markamama|Petlebi|Evcil Hayvan Ürünleri|Şimdi Satın Al)/i;
const RANGE_WEIGHT_RE = /^\d+\.\d{2,}/; // 9.185 cm gibi
const HYPHEN_WEIGHT = (w: string) => w.includes('-');

function isBadProduct(p: PetProduct): { bad: boolean; reason: string } {
  if (GENERIC_TITLE_RE.test(p.name)) return { bad: true, reason: 'generic_title' };
  if (RANGE_WEIGHT_RE.test(p.weight)) return { bad: true, reason: 'range_weight_artifact' };
  if (HYPHEN_WEIGHT(p.weight)) return { bad: true, reason: 'hyphen_weight_range' };
  if (p.name.length < 15) return { bad: true, reason: 'name_too_short' };
  if (!p.imagePath) return { bad: true, reason: 'no_image' }; // sanity
  return { bad: false, reason: 'ok' };
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
  console.log('[cleanup] Loading catalog...');
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8')) as CatalogFile;
  console.log(`[cleanup] Before: ${catalog.products.length} products`);

  await copyFile(CATALOG_PATH, BACKUP_PATH);
  console.log(`[cleanup] Backup: ${BACKUP_PATH}`);

  const kept: PetProduct[] = [];
  const reasons: Record<string, number> = {};
  for (const p of catalog.products) {
    const { bad, reason } = isBadProduct(p);
    if (bad) {
      reasons[reason] = (reasons[reason] ?? 0) + 1;
      continue;
    }
    kept.push(p);
  }

  console.log('[cleanup] Removed breakdown:');
  for (const [r, c] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r.padEnd(28)} ${c}`);
  }
  const removed = catalog.products.length - kept.length;
  if (removed === 0) {
    console.log('[cleanup] Hiç temizlenecek kayıt yok.');
    return;
  }
  console.log(`[cleanup] Kept ${kept.length} / Removed ${removed}`);

  const newStats = recomputeStats(kept);
  const newCatalog: CatalogFile = {
    ...catalog,
    version: bumpPatch(catalog.version),
    generatedAt: new Date().toISOString().slice(0, 10),
    stats: newStats,
    products: kept,
  };
  await writeFile(CATALOG_PATH, JSON.stringify(newCatalog, null, 2));

  console.log(`[cleanup] Version: ${catalog.version} → ${newCatalog.version}`);
  console.log(
    `[cleanup] Image coverage: ${newStats.withImagePath}/${kept.length} (${(
      (newStats.withImagePath / kept.length) *
      100
    ).toFixed(1)}%)`,
  );
}

main().catch((e) => {
  console.error('[cleanup] FATAL:', e);
  process.exit(1);
});
