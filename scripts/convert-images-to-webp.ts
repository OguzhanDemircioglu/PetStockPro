/**
 * Local image folder'ı WebP'ye dönüştür — boyut tasarrufu + production storage'a
 * hazırlık (R2 / Supabase Storage upload öncesi).
 *
 * Akış:
 *   1. scripts/data/images/ scan et
 *   2. Her jpg/png/avif/gif için:
 *      a. Sharp ile webp dönüştür (quality 80, effort 4)
 *      b. Orijinali scripts/data/images-original/ klasörüne TAŞI (yedek)
 *      c. Yeni webp dosyayı images/ içinde {hash}.webp olarak bırak
 *   3. JSON'da imagePath'i .jpg/.png → .webp olarak güncelle (sha1 hash aynı)
 *   4. Boyut karşılaştırması raporla
 *
 * Idempotent: zaten webp olan dosyaları atlar.
 * Geri alınabilir: images-original/ klasörü silinmedikçe orijinal recovery mümkün.
 *
 * Çalıştırma:
 *   npx tsx scripts/convert-images-to-webp.ts
 */

import { readFile, writeFile, readdir, rename, mkdir, stat, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, parse, basename } from 'node:path';
import sharp from 'sharp';

const IMAGES_DIR = resolve(process.cwd(), 'scripts/data/images');
const BACKUP_DIR = resolve(process.cwd(), 'scripts/data/images-original');
const CATALOG_PATH = resolve(process.cwd(), 'scripts/data/pet-products-catalog.json');

const WEBP_QUALITY = 80;
const WEBP_EFFORT = 4; // 0-6, daha yüksek = daha küçük dosya ama yavaş

interface PetProduct {
  imagePath: string | null;
  imageUrl: string | null;
  [k: string]: unknown;
}

interface CatalogFile {
  version: string;
  generatedAt: string;
  products: PetProduct[];
  stats?: Record<string, unknown>;
  [k: string]: unknown;
}

function bumpPatch(version: string): string {
  const parts = version.split('.').map((s) => Number(s));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return version;
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

async function dirSize(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const f of await readdir(dir)) {
    try {
      const s = await stat(resolve(dir, f));
      total += s.size;
    } catch {
      /* skip */
    }
  }
  return total;
}

async function main(): Promise<void> {
  console.log('[webp] Scanning images dir...');
  await mkdir(BACKUP_DIR, { recursive: true });

  const files = await readdir(IMAGES_DIR);
  const toConvert = files.filter((f) => /\.(jpe?g|png|avif|gif)$/i.test(f));
  const alreadyWebp = files.filter((f) => /\.webp$/i.test(f));

  console.log(
    `[webp] Total: ${files.length} | to convert: ${toConvert.length} | already webp: ${alreadyWebp.length}`,
  );

  const beforeBytes = await dirSize(IMAGES_DIR);

  let converted = 0;
  let failed = 0;
  let bytesAfterConvert = 0;
  let bytesBeforeConvert = 0;
  const failedFiles: string[] = [];

  for (let i = 0; i < toConvert.length; i++) {
    const fname = toConvert[i];
    const srcPath = resolve(IMAGES_DIR, fname);
    const { name } = parse(fname);
    const destPath = resolve(IMAGES_DIR, `${name}.webp`);
    const backupPath = resolve(BACKUP_DIR, fname);

    try {
      // Size before
      const srcStat = await stat(srcPath);
      bytesBeforeConvert += srcStat.size;

      // Convert via sharp
      await sharp(srcPath)
        .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
        .toFile(destPath);

      // Size after
      const destStat = await stat(destPath);
      bytesAfterConvert += destStat.size;

      // Move original to backup (rename — atomic on same disk)
      await rename(srcPath, backupPath);

      converted++;
      if ((i + 1) % 50 === 0 || i + 1 === toConvert.length) {
        process.stdout.write(
          `\r[webp] ${i + 1}/${toConvert.length} (saved ${(
            (bytesBeforeConvert - bytesAfterConvert) /
            1024 /
            1024
          ).toFixed(1)} MB)`,
        );
      }
    } catch (e) {
      failed++;
      failedFiles.push(`${fname}: ${(e as Error).message}`);
    }
  }
  process.stdout.write('\n');

  if (failedFiles.length > 0) {
    console.log('[webp] FAILED FILES (ilk 10):');
    for (const f of failedFiles.slice(0, 10)) console.log(`  ${f}`);
  }

  // Update JSON: imagePath uzantısını .webp'ye çevir
  console.log('[webp] Updating catalog JSON...');
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8')) as CatalogFile;
  let pathsUpdated = 0;
  for (const p of catalog.products) {
    if (!p.imagePath) continue;
    if (p.imagePath.endsWith('.webp')) continue;
    const m = p.imagePath.match(/^(.+)\.(jpe?g|png|avif|gif)$/i);
    if (!m) continue;
    const newPath = `${m[1]}.webp`;
    // Dosya gerçekten var mı? (failed file ise eski path'i koru)
    const abs = resolve(process.cwd(), newPath);
    if (!existsSync(abs)) continue;
    p.imagePath = newPath;
    pathsUpdated++;
  }
  catalog.version = bumpPatch(catalog.version);
  catalog.generatedAt = new Date().toISOString().slice(0, 10);
  await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2));

  const afterBytes = await dirSize(IMAGES_DIR);
  const backupBytes = await dirSize(BACKUP_DIR);

  console.log(`[webp] Done.`);
  console.log(`[webp]   Converted:        ${converted}`);
  console.log(`[webp]   Failed:           ${failed}`);
  console.log(`[webp]   JSON paths fixed: ${pathsUpdated}`);
  console.log(
    `[webp]   images/ size:     ${(beforeBytes / 1024 / 1024).toFixed(1)} MB → ${(afterBytes / 1024 / 1024).toFixed(1)} MB`,
  );
  console.log(
    `[webp]   Saved:            ${((beforeBytes - afterBytes) / 1024 / 1024).toFixed(1)} MB (${(((beforeBytes - afterBytes) / beforeBytes) * 100).toFixed(1)}%)`,
  );
  console.log(`[webp]   Backup dir:       ${(backupBytes / 1024 / 1024).toFixed(1)} MB (images-original/)`);
  console.log(`[webp]   Catalog version:  ${catalog.version}`);
}

main().catch((e) => {
  console.error('[webp] FATAL:', e);
  process.exit(1);
});
