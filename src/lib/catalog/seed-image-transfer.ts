/**
 * Seed katalog ürün görselini tenant ürününe transfer et.
 *
 * /admin/products/new'da SeedCatalogAutocomplete üzerinden seçilen ürünün
 * `imagePath` field'ı (örn. `scripts/data/images/abc123.jpg`) varsa, dosyayı
 * lokalden okuyup Supabase Storage'a yükle ve product_images'a satır insert
 * et (mevcut uploadProductImage helper'ı).
 *
 * Güvenlik:
 *   - imagePath whitelist regex: SADECE `scripts/data/images/[hex/ascii].(jpg|jpeg|png|webp)`
 *   - fs.readFile sadece proje root'undaki scripts/data/images/ altında
 *   - Tenant ownership uploadProductImage helper'ı tarafından check edilir
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DbClient } from '@/lib/db/client';
import {
  uploadProductImage,
  type UploadResult,
} from './product-images';

/** Test injection için — production'da fs.readFile, test'te mock fn. */
export type ReadFileFn = (absolutePath: string) => Promise<Buffer>;
export type UploadFn = typeof uploadProductImage;

interface TransferDeps {
  readFile?: ReadFileFn;
  upload?: UploadFn;
}

/**
 * imagePath whitelist — sadece scripts/data/images/ altındaki dosya adlarına izin ver.
 *
 * Beklenen format: `scripts/data/images/[a-f0-9]{16}.(jpg|jpeg|png|webp)`
 * (16 hex hash = sha1(brand+name).slice(0,16) — enrich-product-images.ts pattern).
 *
 * Daha gevşek alfanümerik+dash kabul edilir ama path traversal (../, /, \) reddedilir.
 */
const SEED_IMAGE_PATH_REGEX =
  /^scripts\/data\/images\/[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$/i;

const CONTENT_TYPE_BY_EXT: Record<string, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export interface TransferSeedImageResult {
  ok: boolean;
  reason?:
    | 'invalid_path'
    | 'file_not_found'
    | 'file_read_error'
    | 'upload_failed'
    | 'unknown';
  imageId?: string;
  url?: string;
  message?: string;
}

/**
 * Seed imagePath → product_images insert + Supabase Storage upload.
 *
 * @param companyId Tenant UUID
 * @param productId Az önce oluşturulmuş ürünün UUID'si
 * @param seedImagePath JSON'daki imagePath field'ı (relative, `scripts/data/images/...`)
 * @param db Drizzle client
 */
export async function transferSeedImageToProduct(
  companyId: string,
  productId: string,
  seedImagePath: string,
  db: DbClient,
  deps: TransferDeps = {},
): Promise<TransferSeedImageResult> {
  const readFile = deps.readFile ?? fs.readFile;
  const upload = deps.upload ?? uploadProductImage;

  // 1. Whitelist regex kontrolü — path traversal koruması
  if (!SEED_IMAGE_PATH_REGEX.test(seedImagePath)) {
    return {
      ok: false,
      reason: 'invalid_path',
      message: `Geçersiz imagePath: ${seedImagePath}`,
    };
  }

  // 2. Mutlak yol — proje root'undan
  const projectRoot = process.cwd();
  const absolutePath = path.resolve(projectRoot, seedImagePath);

  // 3. Defansif: çözümlenmiş path hala scripts/data/images/ altında mı?
  const expectedPrefix = path.resolve(projectRoot, 'scripts/data/images');
  if (!absolutePath.startsWith(expectedPrefix + path.sep) && absolutePath !== expectedPrefix) {
    return {
      ok: false,
      reason: 'invalid_path',
      message: 'Path traversal denemesi reddedildi',
    };
  }

  // 4. Dosyayı oku
  let buffer: Buffer;
  try {
    buffer = await readFile(absolutePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      return { ok: false, reason: 'file_not_found', message: `Seed görsel yok: ${seedImagePath}` };
    }
    return {
      ok: false,
      reason: 'file_read_error',
      message: (err as Error)?.message ?? 'Bilinmeyen dosya hatası',
    };
  }

  // 5. Content-type belirle (extension'dan)
  const ext = path.extname(seedImagePath).slice(1).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'image/jpeg';

  // 6. Storage upload
  const fileName = path.basename(seedImagePath);
  const result: UploadResult = await upload(
    companyId,
    {
      productId,
      fileName,
      contentType,
      altText: null,
    },
    buffer,
    db,
  );

  if (!result.ok) {
    return {
      ok: false,
      reason: 'upload_failed',
      message: result.message ?? `Upload başarısız: ${result.reason}`,
    };
  }

  return {
    ok: true,
    imageId: result.imageId,
    url: result.url,
  };
}
