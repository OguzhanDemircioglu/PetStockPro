/**
 * Seed katalog ürün görselini tenant ürününe transfer et (R2-based, 2026-05-19).
 *
 * /admin/products/new'da SeedCatalogAutocomplete üzerinden seçilen ürünün
 * `imagePath` field'ı (R2 object key, örn. `seed/abc123.webp`) varsa, R2'den
 * binary'yi indir + tenant'ın R2 prefix'ine yeniden upload et + product_images
 * tablosuna satır insert et (mevcut uploadProductImage helper'ı kullanılır).
 *
 * Güvenlik:
 *   - imagePath whitelist regex: SADECE `seed/[hex/ascii].(jpg|jpeg|png|webp)`
 *   - Path traversal koruması (../, /, \) reddedilir
 *   - Tenant ownership uploadProductImage helper'ı tarafından check edilir
 *
 * Eski (pre-R2) `scripts/data/images/...` lokal yol formatı artık desteklenmiyor.
 * Catalog DB'sinde imagePath = `seed/{hash}.webp` formatında tutulur.
 */

import type { DbClient } from '@/lib/db/client';
import { fetchFromR2 } from '@/lib/storage/r2-client';
import {
  uploadProductImage,
  type UploadResult,
} from './product-images';

/** Test injection için — production'da fetchFromR2, test'te mock fn. */
export type FetchR2Fn = (key: string) => Promise<Buffer | null>;
export type UploadFn = typeof uploadProductImage;

interface TransferDeps {
  fetchR2?: FetchR2Fn;
  upload?: UploadFn;
}

/**
 * imagePath whitelist — sadece `seed/` prefix altındaki R2 object key'lere izin.
 *
 * Beklenen format: `seed/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)`
 * (16 hex hash = sha1(brand+name).slice(0,16) — scraper pattern).
 *
 * Path traversal (../, /, \) reddedilir — sadece dosya adı kısmı serbest.
 */
const SEED_KEY_REGEX = /^seed\/[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$/i;

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
 * R2 seed key → product_images insert + tenant prefix'e R2 upload.
 *
 * @param companyId Tenant UUID
 * @param productId Az önce oluşturulmuş ürünün UUID'si
 * @param seedKey Catalog DB'sindeki imagePath alanı (R2 object key, `seed/...`)
 * @param db Drizzle client
 */
export async function transferSeedImageToProduct(
  companyId: string,
  productId: string,
  seedKey: string,
  db: DbClient,
  deps: TransferDeps = {},
): Promise<TransferSeedImageResult> {
  const fetchR2 = deps.fetchR2 ?? fetchFromR2;
  const upload = deps.upload ?? uploadProductImage;

  // 1. Whitelist regex kontrolü — path traversal koruması + format
  if (!SEED_KEY_REGEX.test(seedKey)) {
    return {
      ok: false,
      reason: 'invalid_path',
      message: `Geçersiz seed key: ${seedKey}`,
    };
  }

  // 2. R2'den binary fetch
  let buffer: Buffer | null;
  try {
    buffer = await fetchR2(seedKey);
  } catch (err) {
    return {
      ok: false,
      reason: 'file_read_error',
      message: (err as Error)?.message ?? 'R2 fetch hatası',
    };
  }
  if (!buffer) {
    return { ok: false, reason: 'file_not_found', message: `R2'de yok: ${seedKey}` };
  }

  // 3. Content-type belirle (extension'dan)
  const ext = (seedKey.match(/\.([a-z]+)$/i)?.[1] ?? 'jpg').toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'image/jpeg';

  // 4. Tenant'ın kendi R2 prefix'ine yeniden upload (tenants/{companyId}/{productId}/...)
  const fileName = seedKey.split('/').pop() ?? 'seed.webp';
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
