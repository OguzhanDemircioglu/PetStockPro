'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { createProduct } from '@/lib/catalog/products';
import { transferSeedImageToProduct } from '@/lib/catalog/seed-image-transfer';
import { writeAuditLogAsync } from '@/lib/audit/log';

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

  // Seed katalog görselini transfer et (autocomplete'ten seçilen ürünün imagePath'i)
  const seedImagePath = formData.get('seedImagePath');
  let imageTransferSuffix = '';
  if (typeof seedImagePath === 'string' && seedImagePath.length > 0) {
    const transfer = await transferSeedImageToProduct(
      session.user.companyId,
      result.productId,
      seedImagePath,
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

  redirect(`/admin/products?created=success${imageTransferSuffix}` as never);
}
