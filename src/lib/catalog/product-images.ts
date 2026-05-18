/**
 * Product images CRUD — Sprint 3.3
 *
 * Server-side helper. Supabase Storage bucket `product-images` + Postgres
 * `product_images` tablosu birlikte yönetir.
 *
 * Senaryolar:
 *   - upload(productId, file): Storage'a yükle + DB'ye satır insert. İlk
 *     görsel otomatik primary. displayOrder = max(existing)+1.
 *   - list(productId): DB'den ürünün tüm görsellerini sıralı döner.
 *   - delete(imageId): DB'den sil + Storage'dan dosyayı remove.
 *   - setPrimary(imageId): Yeni primary atar, eski primary unset (transaction).
 *
 * Tüm operasyonlar **tenant-scoped**: companyId param zorunlu, başka tenant'ın
 * ürününe yazma reddedilir (not_found döner).
 *
 * File path: `{companyId}/{productId}/{uuid}.{ext}` — RLS değil, code-level
 * tenant izolasyonu. Path traversal koruması Zod regex ile.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import { productImages, products } from '@/db/schema';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const BUCKET_NAME = 'product-images';
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

export interface ProductImageRow {
  id: string;
  productId: string;
  url: string;
  /** Storage'daki path (`{companyId}/{productId}/{uuid}.{ext}`). Delete için kullanılır. */
  storagePath: string;
  isPrimary: boolean;
  displayOrder: number;
  altText: string | null;
  createdAt: Date;
}

/**
 * URL'den storage path'i çıkar.
 * Public URL örneği:
 *   https://xxx.supabase.co/storage/v1/object/public/product-images/{companyId}/{productId}/{uuid}.png
 * Storage path:
 *   {companyId}/{productId}/{uuid}.png
 */
export function extractStoragePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export const uploadInputSchema = z.object({
  companyId: z.string().uuid('companyId UUID değil'),
  productId: z.string().uuid('productId UUID değil'),
  /** Browser File ya da Buffer/Uint8Array */
  fileName: z
    .string()
    .min(1, 'Dosya adı boş')
    .max(255, 'Dosya adı çok uzun')
    // Path traversal koruması — sadece dosya adı, slash/.. yok
    .regex(/^[^/\\]+$/, 'Dosya adı geçersiz karakter içeriyor'),
  contentType: z.enum(ALLOWED_MIME_TYPES, {
    errorMap: () => ({
      message: 'Sadece JPG, PNG veya WebP görsel yüklenebilir',
    }),
  }),
  fileBytes: z.number().int().positive('Dosya boş'),
  altText: z
    .string()
    .max(200, 'Alt metin 200 karakteri geçemez')
    .optional()
    .nullable()
    .transform((v) => (v === '' || v === undefined ? null : v)),
});

export type UploadInput = z.input<typeof uploadInputSchema>;

export type UploadResult =
  | { ok: true; imageId: string; url: string; storagePath: string }
  | {
      ok: false;
      reason:
        | 'invalid_input'
        | 'product_not_found'
        | 'file_too_large'
        | 'storage_error'
        | 'db_error'
        | 'unknown';
      issues?: string[];
      message?: string;
    };

/**
 * Ürüne görsel yükle.
 *
 * @param fileBuffer - Görselin binary'si (Buffer veya Uint8Array). MIME ve boyut
 *                     ayrıca opts'tan da gelir.
 */
export async function uploadProductImage(
  companyId: string,
  input: Omit<UploadInput, 'companyId' | 'fileBytes'>,
  fileBuffer: Buffer | Uint8Array,
  db: DbClient,
): Promise<UploadResult> {
  // 1. Boyut check (Zod öncesi early reject)
  if (fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      reason: 'file_too_large',
      message: `Dosya boyutu 5MB'i geçemez (gönderilen: ${(fileBuffer.byteLength / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  // 2. Zod validate
  const parsed = uploadInputSchema.safeParse({
    companyId,
    productId: input.productId,
    fileName: input.fileName,
    contentType: input.contentType,
    fileBytes: fileBuffer.byteLength,
    altText: input.altText,
  });
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // 3. Tenant ownership check — başka tenant'ın ürününe yazılamaz
  const productOwner = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.id, data.productId),
        eq(products.companyId, data.companyId),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .limit(1);
  if (productOwner.length === 0) {
    return { ok: false, reason: 'product_not_found' };
  }

  // 4. Dosya path: {companyId}/{productId}/{uuid}.{ext}
  const ext = extensionFromContentType(data.contentType);
  const uuid = crypto.randomUUID();
  const storagePath = `${data.companyId}/${data.productId}/${uuid}.${ext}`;

  // 5. Storage upload
  //
  // cacheControl: 1 yıl (31536000 sn). Path UUID-based + immutable — aynı URL'den
  // hiç farklı bytes gelmez (silinince DB satırı da silinir, kullanılmayan
  // URL kalmaz). Bu sayede CDN (Supabase Storage CDN + Cloudflare cache)
  // public-immutable cache, hot path'te tek byte servisten DB'ye gitmez.
  const supabase = getSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: data.contentType,
      cacheControl: '31536000',
      upsert: false,
    });
  if (uploadError) {
    return {
      ok: false,
      reason: 'storage_error',
      message: uploadError.message,
    };
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);
  const publicUrl = publicData.publicUrl;

  // 6. DB insert — İlk görsel otomatik primary + displayOrder=max+1
  try {
    const existing = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
        maxOrder: sql<number>`COALESCE(MAX(${productImages.displayOrder}), -1)::int`,
      })
      .from(productImages)
      .where(eq(productImages.productId, data.productId));
    const isFirst = (existing[0]?.count ?? 0) === 0;
    const nextOrder = (existing[0]?.maxOrder ?? -1) + 1;

    const [row] = await db
      .insert(productImages)
      .values({
        productId: data.productId,
        url: publicUrl,
        isPrimary: isFirst,
        displayOrder: nextOrder,
        altText: data.altText,
      })
      .returning({ id: productImages.id });

    return {
      ok: true,
      imageId: row.id,
      url: publicUrl,
      storagePath,
    };
  } catch (err) {
    // DB insert fail → orphan storage cleanup (best-effort)
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath])
      .catch(() => undefined);
    return {
      ok: false,
      reason: 'db_error',
      message: err instanceof Error ? err.message : 'Bilinmeyen DB hatası',
    };
  }
}

function extensionFromContentType(ct: string): string {
  switch (ct) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

/**
 * Ürünün tüm görsellerini listele — primary önce, sonra displayOrder ASC.
 */
export async function listProductImages(
  companyId: string,
  productId: string,
  db: DbClient,
): Promise<ProductImageRow[]> {
  const rows = await db
    .select({
      id: productImages.id,
      productId: productImages.productId,
      url: productImages.url,
      isPrimary: productImages.isPrimary,
      displayOrder: productImages.displayOrder,
      altText: productImages.altText,
      createdAt: productImages.createdAt,
    })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(
      and(
        eq(productImages.productId, productId),
        eq(products.companyId, companyId),
      ),
    )
    .orderBy(desc(productImages.isPrimary), asc(productImages.displayOrder));

  return rows.map((r) => ({
    ...r,
    storagePath: extractStoragePathFromUrl(r.url) ?? '',
  }));
}

export type DeleteResult =
  | { ok: true; wasPrimary: boolean; newPrimaryId: string | null }
  | { ok: false; reason: 'not_found' | 'storage_error' | 'db_error'; message?: string };

/**
 * Görseli sil — DB + Storage cleanup. Primary silinince ikinci görsel auto-promote.
 */
export async function deleteProductImage(
  companyId: string,
  imageId: string,
  db: DbClient,
): Promise<DeleteResult> {
  // 1. Tenant ownership + image+product join
  const found = await db
    .select({
      id: productImages.id,
      productId: productImages.productId,
      url: productImages.url,
      isPrimary: productImages.isPrimary,
    })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(
      and(eq(productImages.id, imageId), eq(products.companyId, companyId)),
    )
    .limit(1);
  if (found.length === 0) return { ok: false, reason: 'not_found' };
  const image = found[0];
  const storagePath = extractStoragePathFromUrl(image.url);

  // 2. DB sil
  try {
    await db.delete(productImages).where(eq(productImages.id, imageId));
  } catch (err) {
    return {
      ok: false,
      reason: 'db_error',
      message: err instanceof Error ? err.message : 'DB sil başarısız',
    };
  }

  // 3. Storage temizlik — best-effort. DB silindi, storage orphan kalsa bile
  //    görsel artık görünmüyor (DB'den list edilmiyor). Periyodik cleanup
  //    işi gelecekte.
  if (storagePath) {
    const supabase = getSupabaseAdminClient();
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath])
      .catch(() => undefined);
  }

  // 4. Primary silindiyse, kalan en düşük displayOrder'lı görsel primary olsun
  let newPrimaryId: string | null = null;
  if (image.isPrimary) {
    const remaining = await db
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, image.productId))
      .orderBy(asc(productImages.displayOrder))
      .limit(1);
    if (remaining.length > 0) {
      const next = remaining[0];
      await db
        .update(productImages)
        .set({ isPrimary: true })
        .where(eq(productImages.id, next.id));
      newPrimaryId = next.id;
    }
  }

  return { ok: true, wasPrimary: image.isPrimary, newPrimaryId };
}

export type SetPrimaryResult =
  | { ok: true; previousPrimaryId: string | null }
  | { ok: false; reason: 'not_found' };

/**
 * Yeni primary atama. Aynı ürünün eski primary'sini unset, yenisini set.
 * Transaction içinde iki update.
 */
export async function setPrimaryProductImage(
  companyId: string,
  imageId: string,
  db: DbClient,
): Promise<SetPrimaryResult> {
  const found = await db
    .select({
      id: productImages.id,
      productId: productImages.productId,
    })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(
      and(eq(productImages.id, imageId), eq(products.companyId, companyId)),
    )
    .limit(1);
  if (found.length === 0) return { ok: false, reason: 'not_found' };
  const image = found[0];

  let previousPrimaryId: string | null = null;
  await db.transaction(async (tx) => {
    // Eski primary'yi bul + unset
    const oldPrimary = await tx
      .select({ id: productImages.id })
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, image.productId),
          eq(productImages.isPrimary, true),
          sql`${productImages.id} != ${imageId}`,
        ),
      )
      .limit(1);
    if (oldPrimary.length > 0) {
      previousPrimaryId = oldPrimary[0].id;
      await tx
        .update(productImages)
        .set({ isPrimary: false })
        .where(eq(productImages.id, oldPrimary[0].id));
    }
    // Yenisini set
    await tx
      .update(productImages)
      .set({ isPrimary: true })
      .where(eq(productImages.id, imageId));
  });

  return { ok: true, previousPrimaryId };
}
