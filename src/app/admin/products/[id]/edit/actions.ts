'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { withTenant } from '@/lib/db/with-tenant';
import {
  softDeleteProduct,
  updateProduct,
  type UpdateProductResult,
} from '@/lib/catalog/products';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { assertNotObserver, ObserverReadOnlyError } from '@/lib/auth/role-gate';
import { hasAnyPermission } from '@/lib/users/permissions';
import { PERMISSION_KEYS } from '@/lib/users/permission-keys';
import { trackUnexpected } from '@/lib/errors/wrap';

export interface EditProductState {
  ok: boolean;
  error: string | null;
  issues: string[];
}

export async function updateProductAction(
  productId: string,
  variantId: string,
  prevState: EditProductState | null,
  formData: FormData,
): Promise<EditProductState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    redirect('/login' as never);
  }

  return trackUnexpected(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      route: '/admin/products/[id]/edit',
      action: 'product.update',
      metadata: { productId, variantId },
    },
    () => updateProductInner(session!, productId, variantId, prevState, formData),
  );
}

async function updateProductInner(
  session: NonNullable<Awaited<ReturnType<typeof auth>>>,
  productId: string,
  variantId: string,
  _prevState: EditProductState | null,
  formData: FormData,
): Promise<EditProductState> {
  // Faz 2 — Observer reject + STAFF için price.edit yetkisi (BAYI_SAHIBI bypass).
  try {
    assertNotObserver(session);
  } catch (e) {
    if (e instanceof ObserverReadOnlyError) {
      return { ok: false, error: 'İzleyici modundasın — bu işlem yapılamaz', issues: [] };
    }
    throw e;
  }
  const companyId = session.user!.companyId!;
  const userId = session.user!.id!;

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

  // Faz 4B: yetki (tenant) + updateProduct (self-tx → savepoint) TEK withTenant'ta.
  const outcome = await withTenant<
    { gate: EditProductState } | { result: UpdateProductResult }
  >(companyId, async (tx) => {
    const canEdit = await hasAnyPermission(userId, [PERMISSION_KEYS.PRICE_EDIT], tx);
    if (!canEdit) {
      return {
        gate: {
          ok: false,
          error: 'Ürün düzenleme yetkisi yok — Bayi Admin\'den iste',
          issues: [],
        },
      };
    }
    const result = await updateProduct(
      companyId,
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
      tx,
    );
    return { result };
  });
  if ('gate' in outcome) return outcome.gate;
  const result = outcome.result;

  if (!result.ok) {
    const msg = {
      invalid_input: result.issues?.[0] ?? 'Geçersiz alan',
      not_found: 'Ürün bulunamadı',
      sku_taken: 'Bu SKU başka bir variant tarafından kullanılıyor',
      unknown: 'Güncellenemedi, tekrar dene',
    }[result.reason];
    return { ok: false, error: msg, issues: result.issues ?? [] };
  }

  writeAuditLogAsync(
    {
      companyId,
      userId,
      action: 'product.updated',
      entityType: 'product',
      entityId: productId,
      afterState: { name, sku: typeof sku === 'string' ? sku : null },
    },
    db,
  );

  redirect('/admin/products?updated=success' as never);
}

export async function deleteProductAction(productId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    redirect('/login' as never);
  }
  // Faz 2 — silme yalnızca BAYI_SAHIBI/SUPERADMIN'e (STAFF için yetki key yok).
  // Observer + STAFF reject; BAYI_SAHIBI/SUPERADMIN bypass.
  if (session.user.role === 'OBSERVER' || session.user.role === 'STAFF') {
    redirect('/admin/products?deleted=denied' as never);
  }
  const companyId = session.user.companyId;
  await withTenant(companyId, (tx) => softDeleteProduct(companyId, productId, tx));
  writeAuditLogAsync(
    {
      companyId,
      userId: session.user.id,
      action: 'product.deleted',
      entityType: 'product',
      entityId: productId,
    },
    db,
  );
  redirect('/admin/products?deleted=success' as never);
}
