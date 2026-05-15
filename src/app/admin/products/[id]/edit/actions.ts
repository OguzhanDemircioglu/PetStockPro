'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { softDeleteProduct, updateProduct } from '@/lib/catalog/products';

export interface EditProductState {
  ok: boolean;
  error: string | null;
  issues: string[];
}

export async function updateProductAction(
  productId: string,
  variantId: string,
  _prevState: EditProductState | null,
  formData: FormData,
): Promise<EditProductState> {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect('/login' as never);
  }

  const name = formData.get('name');
  const description = formData.get('description');
  const categoryId = formData.get('categoryId');
  const brandId = formData.get('brandId');
  const isActive = formData.get('isActive') === 'on';

  const valueLabel = formData.get('valueLabel');
  const sku = formData.get('sku');
  const barcode = formData.get('barcode');
  const costPrice = formData.get('costPrice');
  const salePrice = formData.get('salePrice');
  const thresholdRaw = formData.get('threshold');

  if (
    typeof name !== 'string' ||
    typeof valueLabel !== 'string' ||
    typeof sku !== 'string' ||
    typeof costPrice !== 'string' ||
    typeof salePrice !== 'string'
  ) {
    return { ok: false, error: 'Zorunlu alanlar eksik', issues: [] };
  }

  const threshold =
    typeof thresholdRaw === 'string' && thresholdRaw.length > 0
      ? parseInt(thresholdRaw, 10)
      : 5;

  const result = await updateProduct(
    session.user.companyId,
    productId,
    variantId,
    {
      name,
      description: typeof description === 'string' && description.length > 0 ? description : null,
      categoryId: typeof categoryId === 'string' && categoryId.length > 0 ? categoryId : null,
      brandId: typeof brandId === 'string' && brandId.length > 0 ? brandId : null,
      isActive,
      variant: {
        valueLabel,
        sku,
        barcode: typeof barcode === 'string' && barcode.length > 0 ? barcode : null,
        costPrice,
        salePrice,
        threshold: Number.isFinite(threshold) ? threshold : 5,
      },
    },
    db,
  );

  if (!result.ok) {
    const msg = {
      invalid_input: result.issues?.[0] ?? 'Geçersiz alan',
      not_found: 'Ürün bulunamadı',
      sku_taken: 'Bu SKU başka bir variant tarafından kullanılıyor',
      unknown: 'Güncellenemedi, tekrar dene',
    }[result.reason];
    return { ok: false, error: msg, issues: result.issues ?? [] };
  }

  redirect('/admin/products?updated=success' as never);
}

export async function deleteProductAction(productId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect('/login' as never);
  }
  await softDeleteProduct(session.user.companyId, productId, db);
  redirect('/admin/products?deleted=success' as never);
}
