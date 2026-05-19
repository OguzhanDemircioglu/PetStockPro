'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { createProduct } from '@/lib/catalog/products';
import {
  uploadProductImage,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/catalog/product-images';
import { transferSeedImageToProduct } from '@/lib/catalog/seed-image-transfer';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { logModerationFlag } from '@/lib/moderation/audit';

export interface CreateProductState {
  ok: boolean;
  error: string | null;
  issues: string[];
  formValues: {
    name: string | null;
    categoryId: string | null;
    sku: string | null;
    salePrice: string | null;
  };
}

export async function createProductAction(
  _prevState: CreateProductState | null,
  formData: FormData,
): Promise<CreateProductState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    redirect('/login' as never);
  }

  const name = formData.get('name');
  const description = formData.get('description');
  const categoryId = formData.get('categoryId');
  const brandId = formData.get('brandId');
  const valueLabel = formData.get('valueLabel');
  const sku = formData.get('sku');
  const barcode = formData.get('barcode');
  const costPrice = formData.get('costPrice');
  const salePrice = formData.get('salePrice');
  const thresholdRaw = formData.get('threshold');

  const formValues = {
    name: typeof name === 'string' ? name : null,
    categoryId: typeof categoryId === 'string' && categoryId.length > 0 ? categoryId : null,
    sku: typeof sku === 'string' ? sku : null,
    salePrice: typeof salePrice === 'string' ? salePrice : null,
  };

  if (typeof name !== 'string' || typeof sku !== 'string' || typeof salePrice !== 'string') {
    return {
      ok: false,
      error: 'Ürün adı, SKU ve satış fiyatı zorunlu',
      issues: [],
      formValues,
    };
  }

  const threshold =
    typeof thresholdRaw === 'string' && thresholdRaw.length > 0
      ? parseInt(thresholdRaw, 10)
      : 5;

  const result = await createProduct(
    session.user.companyId,
    {
      name,
      description: typeof description === 'string' && description.length > 0 ? description : undefined,
      categoryId: typeof categoryId === 'string' && categoryId.length > 0 ? categoryId : undefined,
      brandId: typeof brandId === 'string' && brandId.length > 0 ? brandId : undefined,
      variant: {
        valueLabel: typeof valueLabel === 'string' && valueLabel.length > 0 ? valueLabel : 'Standart',
        sku,
        barcode: typeof barcode === 'string' && barcode.length > 0 ? barcode : undefined,
        costPrice: typeof costPrice === 'string' && costPrice.length > 0 ? costPrice : undefined,
        salePrice,
        threshold: Number.isFinite(threshold) ? threshold : 5,
      },
    },
    db,
  );

  if (!result.ok) {
    const msg = {
      invalid_input: result.issues?.[0] ?? 'Geçersiz alan',
      sku_taken: 'Bu SKU zaten kullanılıyor — başka bir SKU gir',
      slug_taken: 'Aynı isimde ürün var',
      unknown: 'Ürün oluşturulamadı, tekrar dene',
    }[result.reason];
    return {
      ok: false,
      error: msg,
      issues: result.issues ?? [],
      formValues,
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'product.created',
      entityType: 'product',
      entityId: result.productId,
      afterState: { name, sku, slug: result.slug },
    },
    db,
  );

  // Moderation flag varsa audit log + redirect query param ile UI bildirimi
  if (result.moderationFlags?.flagged) {
    logModerationFlag(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        entityType: 'product',
        entityId: result.productId,
        result: result.moderationFlags,
      },
      db,
    );
  }
  const moderationSuffix = result.moderationFlags?.flagged
    ? `&moderation=flagged&fields=${encodeURIComponent(result.moderationFlags.fieldsFlagged.join(','))}`
    : '';

  // Görsel akışı — öncelik:
  //   1. Manuel upload (productImage File) → R2'ye doğrudan tenant prefix'ine
  //   2. Catalog seed (seedImagePath, R2 seed/ key) → catalog'tan tenant'a kopyala
  //   3. Yok → ürün görselsiz oluşturuldu
  //
  // Banner suffix'i /admin/products?created=success&... query param ile UI'ya iletilir.
  const productImageFile = formData.get('productImage');
  const seedImagePath = formData.get('seedImagePath');
  const hasManualImage = productImageFile instanceof File && productImageFile.size > 0;
  const hasSeedImage = typeof seedImagePath === 'string' && seedImagePath.length > 0;

  let imageTransferSuffix = '';

  if (hasManualImage) {
    const file = productImageFile as File;
    // Erken validation (helper içinde de var ama UX için ayrı reason kodları)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      imageTransferSuffix = '&product_image=fail&reason=too_large';
    } else if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      imageTransferSuffix = '&product_image=fail&reason=wrong_mime';
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadResult = await uploadProductImage(
        session.user.companyId,
        {
          productId: result.productId,
          fileName: file.name,
          contentType: file.type as (typeof ALLOWED_MIME_TYPES)[number],
          altText: null,
        },
        buffer,
        db,
      );
      if (uploadResult.ok) {
        writeAuditLogAsync(
          {
            companyId: session.user.companyId,
            userId: session.user.id,
            action: 'product.image_uploaded',
            entityType: 'product',
            entityId: result.productId,
            afterState: {
              imageId: uploadResult.imageId,
              url: uploadResult.url,
              sizeBytes: buffer.byteLength,
              contentType: file.type,
              source: 'new-product-form',
            },
          },
          db,
        );
        imageTransferSuffix = '&product_image=ok';
      } else {
        imageTransferSuffix = `&product_image=fail&reason=${encodeURIComponent(uploadResult.reason)}`;
      }
    }
  } else if (hasSeedImage) {
    // Manuel görsel yok → catalog seed transfer (mevcut akış)
    const transfer = await transferSeedImageToProduct(
      session.user.companyId,
      result.productId,
      seedImagePath as string,
      db,
    );
    if (transfer.ok) {
      writeAuditLogAsync(
        {
          companyId: session.user.companyId,
          userId: session.user.id,
          action: 'product.image_seed_transfer',
          entityType: 'product',
          entityId: result.productId,
          afterState: { seedImagePath, imageId: transfer.imageId },
        },
        db,
      );
      imageTransferSuffix = '&seed_image=ok';
    } else {
      // Transfer fail olsa bile ürün oluşturuldu — sadece banner mesajıyla kullanıcıya bildir
      imageTransferSuffix = `&seed_image=fail&reason=${encodeURIComponent(transfer.reason ?? 'unknown')}`;
    }
  }

  redirect(`/admin/products?created=success${imageTransferSuffix}${moderationSuffix}` as never);
}
