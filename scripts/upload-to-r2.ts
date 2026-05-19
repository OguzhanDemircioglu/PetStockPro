/**
 * Catalog seed image'larını R2'ye yükle (one-time bulk migration).
 *
 * scripts/data/images/{hash}.webp → seed/{hash}.webp (R2 object key)
 *
 * Idempotent:
 *   - existsInR2 ile her dosyayı önce kontrol eder
 *   - var olanları atlar (re-run safe)
 *
 * Concurrency: 8 paralel upload (R2 rate limit yüksek, S3 SDK queue eder)
 *
 * Çalıştırma:
 *   npx tsx scripts/upload-to-r2.ts
 *
 * Env vars (zorunlu):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 */

import 'dotenv/config';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, basename, extname } from 'node:path';
import { uploadToR2, existsInR2 } from '../src/lib/storage/r2-client';

const IMAGES_DIR = resolve(process.cwd(), 'scripts/data/images');
const CONCURRENCY = 8;
const PREFIX = 'seed/';

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

interface UploadStat {
  fileName: string;
  status: 'uploaded' | 'skipped' | 'failed';
  error?: string;
  size?: number;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let cursor = 0;
  let done = 0;
  const total = items.length;
  async function pump(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx], idx);
      done += 1;
      onProgress?.(done, total);
    }
  }
  const pumps = Array.from({ length: Math.min(concurrency, items.length) }, () => pump());
  await Promise.all(pumps);
}

async function main(): Promise<void> {
  console.log('[r2-upload] Scanning local images dir...');
  const files = await readdir(IMAGES_DIR);
  const imageFiles = files.filter((f) => /\.(webp|jpe?g|png|gif|avif)$/i.test(f));
  console.log(`[r2-upload] Found ${imageFiles.length} image files`);

  // Toplam disk boyutu
  let totalLocalBytes = 0;
  for (const f of imageFiles) {
    try {
      const s = await stat(resolve(IMAGES_DIR, f));
      totalLocalBytes += s.size;
    } catch {
      /* skip */
    }
  }
  console.log(`[r2-upload] Local total size: ${(totalLocalBytes / 1024 / 1024).toFixed(1)} MB`);

  console.log(`[r2-upload] Uploading to R2 bucket '${process.env.R2_BUCKET}'...`);
  console.log(`[r2-upload] Concurrency: ${CONCURRENCY}, prefix: '${PREFIX}'`);

  const stats: UploadStat[] = [];

  await runWithConcurrency(
    imageFiles,
    CONCURRENCY,
    async (fileName) => {
      const localPath = resolve(IMAGES_DIR, fileName);
      const key = `${PREFIX}${fileName}`;
      const ext = extname(fileName).toLowerCase();
      const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';

      try {
        // Idempotency: R2'de zaten var mı?
        const exists = await existsInR2(key);
        if (exists) {
          stats.push({ fileName, status: 'skipped' });
          return;
        }

        const buffer = await readFile(localPath);
        await uploadToR2(key, buffer, {
          contentType,
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: { source: 'catalog-seed', hash: basename(fileName, ext) },
        });
        stats.push({ fileName, status: 'uploaded', size: buffer.byteLength });
      } catch (err) {
        stats.push({
          fileName,
          status: 'failed',
          error: (err as Error)?.message ?? 'unknown',
        });
      }
    },
    (done, total) => {
      if (done % 25 === 0 || done === total) {
        const uploaded = stats.filter((s) => s.status === 'uploaded').length;
        const skipped = stats.filter((s) => s.status === 'skipped').length;
        const failed = stats.filter((s) => s.status === 'failed').length;
        process.stdout.write(
          `\r[r2-upload] ${done}/${total} (uploaded=${uploaded} skipped=${skipped} failed=${failed})`,
        );
      }
    },
  );
  process.stdout.write('\n');

  const uploaded = stats.filter((s) => s.status === 'uploaded');
  const skipped = stats.filter((s) => s.status === 'skipped');
  const failed = stats.filter((s) => s.status === 'failed');

  console.log(`[r2-upload] Done.`);
  console.log(`  ✓ Uploaded: ${uploaded.length}`);
  console.log(`  → Skipped:  ${skipped.length} (already in R2)`);
  console.log(`  ✕ Failed:   ${failed.length}`);

  const uploadedBytes = uploaded.reduce((sum, s) => sum + (s.size ?? 0), 0);
  console.log(`  📦 Uploaded size: ${(uploadedBytes / 1024 / 1024).toFixed(1)} MB`);

  if (failed.length > 0) {
    console.log(`[r2-upload] FAILED (ilk 10):`);
    for (const f of failed.slice(0, 10)) {
      console.log(`  ${f.fileName}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[r2-upload] FATAL:', e);
  process.exit(1);
});
