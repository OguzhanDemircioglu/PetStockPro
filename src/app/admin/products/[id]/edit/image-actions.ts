'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
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
  imageId?: string | null;
}

const EMPTY: ImageActionState = { ok: false, message: null };

const ROLE_ALLOW = new Set(['BAYI_SAHIBI', 'ADMIN', 'SUPERADMIN']);

/**
 * Görsel yükle — multipart/form-data form'undan File alır.
 *
 * Form alanları:
 *   - productId: UUID (bind ile veya hidden input)
 *   - file: File (image/jpeg|png|webp, ≤5MB)
 *   - altText: opsiyonel
 */
export async function uploadImageAction(
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

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ...EMPTY, message: 'Dosya seçilmedi' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ...EMPTY,
      message: `Dosya 5MB'i geçemez (gönderilen: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      ...EMPTY,
      message: 'Sadece JPG, PNG veya WebP yükleyebilirsin',
    };
  }

  const altRaw = formData.get('altText');
  const altText = typeof altRaw === 'string' && altRaw.trim().length > 0
    ? altRaw.trim().slice(0, 200)
    : null;

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await uploadProductImage(
    session.user.companyId,
    {
      productId,
      fileName: file.name,
      contentType: file.type as (typeof ALLOWED_MIME_TYPES)[number],
      altText,
    },
    buffer,
    db,
  );

  if (!result.ok) {
    const msgMap: Record<typeof result.reason, string> = {
      invalid_input: result.issues?.[0] ?? 'Geçersiz dosya',
      product_not_found: 'Ürün bulunamadı',
      file_too_large: result.message ?? 'Dosya çok büyük',
      storage_error: 'Storage hatası: ' + (result.message ?? ''),
      db_error: 'DB hatası: ' + (result.message ?? ''),
      unknown: 'Bilinmeyen hata',
    };
    return { ...EMPTY, message: msgMap[result.reason] };
  }

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
      },
    },
    db,
  );

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/admin/products');
  return {
    ok: true,
    message: '✓ Görsel yüklendi',
    imageId: result.imageId,
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
  return { ok: true, message: '✓ Görsel silindi' };
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

  const result = await setPrimaryProductImage(
    session.user.companyId,
    imageId,
    db,
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
  return { ok: true, message: '✓ Ana görsel ayarlandı' };
}
