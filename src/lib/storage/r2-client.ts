/**
 * Cloudflare R2 client — S3-compatible API üzerinden.
 *
 * Kullanım:
 * ```ts
 * import { uploadToR2, deleteFromR2, getR2PublicUrl, fetchFromR2 } from '@/lib/storage/r2-client';
 *
 * const url = await uploadToR2('seed/abc123.webp', buffer, 'image/webp');
 * await deleteFromR2('seed/abc123.webp');
 * const buf = await fetchFromR2('seed/abc123.webp');
 * ```
 *
 * Env vars (zorunlu — client lazy-init, env yokken import patlamaz):
 *   - R2_ACCOUNT_ID            → endpoint host
 *   - R2_ACCESS_KEY_ID         → S3 access key
 *   - R2_SECRET_ACCESS_KEY     → S3 secret
 *   - R2_BUCKET                → bucket adı (örn. petstockpro-images)
 *   - R2_PUBLIC_URL            → public base URL (pub-xxxxx.r2.dev veya custom domain)
 *
 * Bucket path konvansiyonu:
 *   - seed/{hash}.webp                                    → catalog seed (immutable)
 *   - tenants/{companyId}/{productId}/{uuid}.{ext}        → tenant ürün resmi
 *
 * Cache: tüm objeler immutable (UUID/hash-based). Cache-Control 1 yıl.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

// Lazy-init: env vars eksikken import patlamaz, sadece çağrıda hata atar.
let _client: S3Client | null = null;

function getR2Client(): S3Client {
  if (_client) return _client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 credentials not configured. Set R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY in .env',
    );
  }

  _client = new S3Client({
    region: 'auto', // R2 region is always 'auto'
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error('R2_BUCKET not configured in .env');
  }
  return bucket;
}

function getPublicBase(): string {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) {
    throw new Error('R2_PUBLIC_URL not configured in .env');
  }
  // Trailing slash temizle
  return base.replace(/\/+$/, '');
}

/**
 * Object key'den public URL üret.
 * Frontend `<img src={getR2PublicUrl(product.imagePath)}>` şeklinde kullanır.
 */
export function getR2PublicUrl(key: string): string {
  return `${getPublicBase()}/${key.replace(/^\/+/, '')}`;
}

export interface UploadOptions {
  /** MIME type (örn. 'image/webp'). */
  contentType: string;
  /**
   * Cache-Control header. Default: immutable 1 yıl (hash-based key'ler için).
   * Mutable nesneler için 'no-cache' veya kısa max-age vermek lazım.
   */
  cacheControl?: string;
  /** İsteğe bağlı metadata (object-level tag). */
  metadata?: Record<string, string>;
}

/**
 * R2'ye binary upload. Başarılıysa public URL döner.
 *
 * Idempotent değil — aynı key tekrar yazılırsa overwrite. Hash-based key'ler için
 * sorun yok (aynı içerik = aynı hash). UUID-based key'ler için caller dikkat etsin.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | string,
  options: UploadOptions,
): Promise<string> {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: options.contentType,
      CacheControl: options.cacheControl ?? 'public, max-age=31536000, immutable',
      Metadata: options.metadata,
    }),
  );
  return getR2PublicUrl(key);
}

/**
 * R2'den binary fetch. Object yoksa null döner.
 *
 * NOT: Production'da `<img src>` veya CDN URL kullan. fetchFromR2 sadece
 * server-side "image transfer" (catalog seed → tenant product) gibi
 * binary-to-binary kopyalama için.
 */
export async function fetchFromR2(key: string): Promise<Buffer | null> {
  const client = getR2Client();
  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );
    if (!res.Body) return null;
    const arr = await res.Body.transformToByteArray();
    return Buffer.from(arr);
  } catch (err) {
    // NoSuchKey, AccessDenied vs.
    if ((err as { name?: string })?.name === 'NoSuchKey') return null;
    throw err;
  }
}

/**
 * R2'den object var mı kontrol et (binary indirme yok, sadece HEAD).
 */
export async function existsInR2(key: string): Promise<boolean> {
  const client = getR2Client();
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );
    return true;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'NoSuchKey' || name === 'NotFound') return false;
    throw err;
  }
}

/**
 * R2'den object sil. NoSuchKey hatası swallow edilir (idempotent).
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'NoSuchKey') return;
    throw err;
  }
}

/**
 * URL'den R2 object key'i çıkar.
 * Public URL: `https://pub-xxxxx.r2.dev/tenants/abc/def/uuid.webp`
 * Object key: `tenants/abc/def/uuid.webp`
 *
 * Eski Supabase Storage URL'lerinden migration için.
 */
export function extractR2KeyFromUrl(url: string): string | null {
  try {
    const base = getPublicBase();
    if (!url.startsWith(base)) return null;
    return url.slice(base.length).replace(/^\/+/, '');
  } catch {
    return null;
  }
}
