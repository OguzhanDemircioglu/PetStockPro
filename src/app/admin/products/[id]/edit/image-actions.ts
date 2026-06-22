'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { withTenant } from '@/lib/db/with-tenant';
import {
  uploadProductImage,
  deleteProductImage,
  setPrimaryProductImage,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/catalog/product-images';
import { writeAuditLogAsync } from '@/lib/audit/log';

export interface ImageActionState {
  ok: boolean;
  message: string | null;
  uploaded: number;
  /** Yüklenen file isimleri (UI'da listelemek için). */
  successFiles: string[];
  /** Başarısız file'ların kısa nedenleri. */
  failures: Array<{ file: string; reason: string }>;
}

const EMPTY: ImageActionState = {
  ok: false,
  message: null,
  uploaded: 0,
  successFiles: [],
  failures: [],
};

const ROLE_ALLOW = new Set(['BAYI_SAHIBI', 'ADMIN', 'SUPERADMIN']);

const REASON_MSG: Record<string, string> = {
  invalid_input: 'Geçersiz dosya',
  product_not_found: 'Ürün bulunamadı',
  file_too_large: 'Dosya 5MB sınırını aşıyor',
  storage_error: 'Storage hatası',
  db_error: 'DB hatası',
  unknown: 'Bilinmeyen hata',
  empty_file: 'Boş dosya',
  unsupported_mime: 'Sadece JPG / PNG / WebP destekleniyor',
};

/**
 * Görsel(ler) yükle — multipart/form-data form'undan `file` alanı (multiple).
 *
 * Form alanları:
 *   - productId: UUID (action bind ile)
 *   - file: File | File[] (1 veya N adet image/jpeg|png|webp, her biri ≤5MB)
 *
 * Tek file de bu action'ı kullanır — `formData.getAll('file')` 1 elemanlı dizi.
 * Sıralı (paralel değil) yüklenir — displayOrder ardışık atanır + audit log
 * her başarılı dosya için ayrı satır yazar.
 */
export async function uploadImagesAction(
  productId: string,
  _prev: ImageActionState | null,
  formData: FormData,
): Promise<ImageActionState> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.companyId) {
    redirect('/login' as never);
  }
  const role = (session.user as { role?: string }).role ?? '';
  if (!ROLE_ALLOW.has(role)) {
    return {
      ...EMPTY,
      message: 'Bu işlem için yetkin yok (sadece firma sahibi veya admin).',
    };
  }

  const files = formData
    .getAll('file')
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (files.length === 0) {
    return { ...EMPTY, message: 'Dosya seçilmedi' };
  }

  const successFiles: string[] = [];
  const failures: Array<{ file: string; reason: string }> = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      failures.push({
        file: file.name,
        reason: `${REASON_MSG.file_too_large} (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      });
      continue;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      failures.push({ file: file.name, reason: REASON_MSG.unsupported_mime });
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadProductImage(
      session.user.companyId,
      {
        productId,
        fileName: file.name,
        contentType: file.type as (typeof ALLOWED_MIME_TYPES)[number],
        altText: null,
      },
      buffer,
      db,
    );

    if (!result.ok) {
      failures.push({
        file: file.name,
        reason: REASON_MSG[result.reason] ?? 'Hata',
      });
      continue;
    }

    successFiles.push(file.name);
    writeAuditLogAsync(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        action: 'product.image_uploaded',
        entityType: 'product',
        entityId: productId,
        afterState: {
          imageId: result.imageId,
          url: result.url,
          sizeBytes: buffer.byteLength,
          contentType: file.type,
          fileName: file.name,
        },
      },
      db,
    );
  }

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/admin/products');

  const total = files.length;
  const ok = successFiles.length > 0;
  const message = ok
    ? failures.length === 0
      ? `✓ ${successFiles.length} görsel yüklendi`
      : `✓ ${successFiles.length} / ${total} yüklendi, ${failures.length} başarısız`
    : `✕ Hiçbir görsel yüklenemedi (${failures.length} hata)`;

  return {
    ok,
    message,
    uploaded: successFiles.length,
    successFiles,
    failures,
  };
}

export async function deleteImageAction(
  productId: string,
  imageId: string,
): Promise<ImageActionState> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.companyId) {
    redirect('/login' as never);
  }
  const role = (session.user as { role?: string }).role ?? '';
  if (!ROLE_ALLOW.has(role)) {
    return {
      ...EMPTY,
      message: 'Bu işlem için yetkin yok.',
    };
  }

  const result = await deleteProductImage(
    session.user.companyId,
    imageId,
    db,
  );

  if (!result.ok) {
    const msgMap: Record<typeof result.reason, string> = {
      not_found: 'Görsel bulunamadı veya başka tenant\'a ait',
      storage_error: 'Storage hatası: ' + (result.message ?? ''),
      db_error: 'DB hatası: ' + (result.message ?? ''),
    };
    return { ...EMPTY, message: msgMap[result.reason] };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'product.image_deleted',
      entityType: 'product',
      entityId: productId,
      afterState: {
        imageId,
        wasPrimary: result.wasPrimary,
        newPrimaryId: result.newPrimaryId,
      },
    },
    db,
  );

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/admin/products');
  return { ...EMPTY, ok: true, message: '✓ Görsel silindi' };
}

export async function setPrimaryImageAction(
  productId: string,
  imageId: string,
): Promise<ImageActionState> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.companyId) {
    redirect('/login' as never);
  }
  const role = (session.user as { role?: string }).role ?? '';
  if (!ROLE_ALLOW.has(role)) {
    return {
      ...EMPTY,
      message: 'Bu işlem için yetkin yok.',
    };
  }

  const companyId = session.user.companyId;
  const result = await withTenant(companyId, (tx) =>
    setPrimaryProductImage(companyId, imageId, tx),
  );

  if (!result.ok) {
    return { ...EMPTY, message: 'Görsel bulunamadı' };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'product.image_set_primary',
      entityType: 'product',
      entityId: productId,
      afterState: {
        imageId,
        previousPrimaryId: result.previousPrimaryId,
      },
    },
    db,
  );

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/admin/products');
  return { ...EMPTY, ok: true, message: '✓ Ana görsel ayarlandı' };
}
