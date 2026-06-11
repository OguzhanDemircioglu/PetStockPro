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
import { resolveGlobalBrand } from '@/lib/catalog/resolve-brand';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { logModerationFlag } from '@/lib/moderation/audit';
import { assertNotObserver, ObserverReadOnlyError } from '@/lib/auth/role-gate';

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

  // Faz 2 — Yeni ürün oluşturma yalnızca BAYI_SAHIBI/SUPERADMIN'e.
  // OBSERVER + STAFF reject (STAFF için bu yetki Plan §C'de tanımlı değil).
  try {
    assertNotObserver(session);
  } catch (e) {
    if (e instanceof ObserverReadOnlyError) {
      return {
        ok: false,
        error: 'İzleyici modundasın — yeni ürün ekleyemezsin',
        issues: [],
        formValues: {
          name: typeof formData.get('name') === 'string' ? (formData.get('name') as string) : null,
          categoryId: null,
          sku: null,
          salePrice: null,
        },
      };
    }
    throw e;
  }
  if (session.user.role === 'STAFF') {
    return {
      ok: false,
      error: 'Yeni ürün ekleme yetkisi yok — Bayi Admin\'den iste',
      issues: [],
      formValues: {
        name: typeof formData.get('name') === 'string' ? (formData.get('name') as string) : null,
        categoryId: null,
        sku: null,
        salePrice: null,
      },
    };
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

  // Marka resolve — form'dan seçili brandId yoksa ama catalogBrand (catalog'tan
  // gelen string) varsa tenant'ta otomatik oluştur veya mevcut'u kullan.
  const catalogBrand = formData.get('catalogBrand');
  let resolvedBrandId: string | undefined =
    typeof brandId === 'string' && brandId.length > 0 ? brandId : undefined;
  let brandAutoCreated = false;
  let brandAutoCreatedName: string | null = null;

  if (!resolvedBrandId && typeof catalogBrand === 'string' && catalogBrand.trim().length > 0) {
    try {
      const resolved = await resolveGlobalBrand(catalogBrand.trim(), db);
      if (resolved && !resolved.rejected && resolved.id) {
        resolvedBrandId = resolved.id;
        brandAutoCreated = resolved.created;
        if (resolved.created) brandAutoCreatedName = catalogBrand.trim();
      }
      // resolved.rejected (profanity/too_long) → brand boş kalır, kullanıcı manuel ekler
    } catch {
      // Brand resolve fail → product yine de oluşturulur, sadece brand boş kalır
    }
  }

  const result = await createProduct(
    session.user.companyId,
    {
      name,
      description: typeof description === 'string' && description.length > 0 ? description : undefined,
      categoryId: typeof categoryId === 'string' && categoryId.length > 0 ? categoryId : undefined,
      brandId: resolvedBrandId,
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
    let msg: string;
    if (result.reason === 'plan_limit_exceeded') {
      const ctx = result.planContext;
      if (ctx?.hadPromo && !ctx.promoActive) {
        // T+0 sonrası: promo bitti, kullanıcı 50+ ürünle FREE'ye düştü.
        msg = `⛔ PRO promosyonun bitti. ${ctx.currentCount}/${ctx.limit} ürün dolu. Yeni ürün eklemek için PRO aboneliğini başlatman gerekiyor (Sol menüde 💳 Plan ve Fatura).`;
      } else if (ctx?.plan === 'PRO') {
        // PRO kullanıcı 500 üstünde (örn. PRO+ → PRO downgrade) — zaten PRO, düşür ya da PRO+'a yükselt.
        msg = `⛔ PRO ürün limitini aştın: ${ctx.currentCount}/${ctx.limit}. Yeni ürün eklemek için ürün sayını ${ctx.limit}'e düşür (ürün sil) ya da PRO+'a yükselt (Sol menüde 💳 Plan ve Fatura).`;
      } else {
        // Generic FREE limit aşıldı (hiç promo almamış)
        msg = `⛔ Plan limit doldu: ${ctx?.currentCount}/${ctx?.limit} ürün. PRO'ya geçerek 500 ürüne kadar genişletebilirsin (Sol menüde 💳 Plan ve Fatura).`;
      }
    } else {
      msg = {
        invalid_input: result.issues?.[0] ?? 'Geçersiz alan',
        sku_taken: 'Bu SKU zaten kullanılıyor — başka bir SKU gir',
        slug_taken: 'Aynı isimde ürün var',
        unknown: 'Ürün oluşturulamadı, tekrar dene',
      }[result.reason];
    }
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

  // Brand auto-create audit
  if (brandAutoCreated && resolvedBrandId && brandAutoCreatedName) {
    writeAuditLogAsync(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        action: 'brand.auto_created',
        entityType: 'brand',
        entityId: resolvedBrandId,
        afterState: { name: brandAutoCreatedName, source: 'catalog-seed-product-form' },
      },
      db,
    );
  }

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

  // Multi-image görsel akışı:
  //   1. productImage[] — Manuel upload File array (0..n)
  //   2. seedImagePaths[] — Catalog seed R2 key array (0..n)
  //   Sırayla uploadProductImage + transferSeedImageToProduct çağrılır.
  //   İlk yüklenen otomatik primary olur (helper içinde isPrimary=true mantığı).
  const manualFiles = formData.getAll('productImage').filter(
    (v): v is File => v instanceof File && v.size > 0,
  );
  const seedImagePaths = formData.getAll('seedImagePaths').filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );

  let imagesUploaded = 0;
  let imagesFailed = 0;
  const failReasons: string[] = [];

  // Manuel upload'lar
  for (const file of manualFiles) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      imagesFailed++;
      failReasons.push('too_large');
      continue;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      imagesFailed++;
      failReasons.push('wrong_mime');
      continue;
    }
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
      imagesUploaded++;
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
            source: 'new-product-form-manual',
          },
        },
        db,
      );
    } else {
      imagesFailed++;
      failReasons.push(uploadResult.reason);
    }
  }

  // Catalog seed transfer'ları
  for (const seedKey of seedImagePaths) {
    const transfer = await transferSeedImageToProduct(
      session.user.companyId,
      result.productId,
      seedKey,
      db,
    );
    if (transfer.ok) {
      imagesUploaded++;
      writeAuditLogAsync(
        {
          companyId: session.user.companyId,
          userId: session.user.id,
          action: 'product.image_seed_transfer',
          entityType: 'product',
          entityId: result.productId,
          afterState: { seedImagePath: seedKey, imageId: transfer.imageId },
        },
        db,
      );
    } else {
      imagesFailed++;
      failReasons.push(transfer.reason ?? 'unknown');
    }
  }

  let imageTransferSuffix = '';
  if (imagesUploaded > 0 && imagesFailed === 0) {
    imageTransferSuffix = `&images=${imagesUploaded}`;
  } else if (imagesUploaded > 0 && imagesFailed > 0) {
    imageTransferSuffix = `&images=${imagesUploaded}&images_failed=${imagesFailed}`;
  } else if (imagesFailed > 0) {
    imageTransferSuffix = `&images_failed=${imagesFailed}&reason=${encodeURIComponent(failReasons[0] ?? 'unknown')}`;
  }

  redirect(`/admin/products?created=success${imageTransferSuffix}${moderationSuffix}` as never);
}
