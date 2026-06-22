'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import {
  createVariant,
  updateVariant,
  deleteVariant,
  setDefaultVariant,
  type CreateVariantInput,
  type UpdateVariantInput,
} from '@/lib/catalog/variants';

export interface VariantActionState {
  ok: boolean;
  message: string | null;
  scope: 'create' | 'update' | 'delete' | 'set_default' | null;
  variantId: string | null;
}

const EMPTY_STATE: VariantActionState = {
  ok: false,
  message: null,
  scope: null,
  variantId: null,
};

function parseBranchThresholds(
  formData: FormData,
): Record<string, number> | undefined {
  const raw = formData.get('branchThresholds');
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    // Boş object ise undefined dön — null normalize edilir
    if (Object.keys(parsed).length === 0) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function asString(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// ─────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────

export async function createVariantAction(
  productId: string,
  _prevState: VariantActionState | null,
  formData: FormData,
): Promise<VariantActionState> {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const valueLabel = asString(formData.get('valueLabel'));
  const sku = asString(formData.get('sku'));
  const costPrice = asString(formData.get('costPrice')) ?? '0';
  const salePrice = asString(formData.get('salePrice'));
  const barcode = asString(formData.get('barcode'));
  const thresholdRaw = formData.get('threshold');
  const threshold =
    typeof thresholdRaw === 'string' && thresholdRaw.length > 0
      ? parseInt(thresholdRaw, 10)
      : 5;

  if (!valueLabel || !sku || !salePrice) {
    return {
      ...EMPTY_STATE,
      message: 'Boyut, SKU ve satış fiyatı zorunlu',
      scope: 'create',
    };
  }

  const input: CreateVariantInput = {
    valueLabel,
    sku,
    costPrice,
    salePrice,
    barcode,
    threshold: Number.isFinite(threshold) ? threshold : 5,
    branchThresholds: parseBranchThresholds(formData),
  };

  const companyId = session.user.companyId;
  const result = await withTenant(companyId, (tx) =>
    createVariant(companyId, productId, input, tx),
  );
  if (!result.ok) {
    const msg = {
      invalid_input: result.issues?.[0] ?? 'Geçersiz alan',
      sku_taken: 'Bu SKU zaten kullanılıyor',
      product_not_found: 'Ürün bulunamadı',
      unknown: 'Eklenemedi, tekrar dene',
    }[result.reason];
    return { ...EMPTY_STATE, message: msg, scope: 'create' };
  }

  revalidatePath(`/admin/products/${productId}/edit`);
  return {
    ok: true,
    message: 'Variant eklendi',
    scope: 'create',
    variantId: result.variantId,
  };
}

// ─────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────

export async function updateVariantAction(
  productId: string,
  variantId: string,
  _prevState: VariantActionState | null,
  formData: FormData,
): Promise<VariantActionState> {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const valueLabel = asString(formData.get('valueLabel'));
  const sku = asString(formData.get('sku'));
  const costPrice = asString(formData.get('costPrice')) ?? '0';
  const salePrice = asString(formData.get('salePrice'));
  const barcode = asString(formData.get('barcode'));
  const thresholdRaw = formData.get('threshold');
  const threshold =
    typeof thresholdRaw === 'string' && thresholdRaw.length > 0
      ? parseInt(thresholdRaw, 10)
      : 5;
  const isActiveRaw = formData.get('isActive');
  const isActive = isActiveRaw === null ? undefined : isActiveRaw === 'on';

  if (!valueLabel || !sku || !salePrice) {
    return {
      ...EMPTY_STATE,
      message: 'Boyut, SKU ve satış fiyatı zorunlu',
      scope: 'update',
      variantId,
    };
  }

  const input: UpdateVariantInput = {
    valueLabel,
    sku,
    costPrice,
    salePrice,
    barcode,
    threshold: Number.isFinite(threshold) ? threshold : 5,
    branchThresholds: parseBranchThresholds(formData),
    isActive,
  };

  const companyId = session.user.companyId;
  const result = await withTenant(companyId, (tx) =>
    updateVariant(companyId, variantId, input, tx),
  );
  if (!result.ok) {
    const msg = {
      invalid_input: result.issues?.[0] ?? 'Geçersiz alan',
      not_found: 'Variant bulunamadı',
      sku_taken: 'Bu SKU başka variant tarafından kullanılıyor',
      last_active: 'Son aktif variant pasifleştirilemez',
      unknown: 'Güncellenemedi, tekrar dene',
    }[result.reason];
    return { ...EMPTY_STATE, message: msg, scope: 'update', variantId };
  }

  revalidatePath(`/admin/products/${productId}/edit`);
  return { ok: true, message: 'Variant güncellendi', scope: 'update', variantId };
}

// ─────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────

export async function deleteVariantAction(
  productId: string,
  variantId: string,
): Promise<VariantActionState> {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const companyId = session.user.companyId;
  const result = await withTenant(companyId, (tx) =>
    deleteVariant(companyId, variantId, tx),
  );
  if (!result.ok) {
    const msg = {
      not_found: 'Variant bulunamadı',
      last_active: 'Son aktif variant silinemez — önce yeni variant ekle',
      is_default: 'Default variant silinemez — önce başkasını default yap',
      unknown: 'Silinemedi (stok hareketi olabilir)',
    }[result.reason];
    return { ...EMPTY_STATE, message: msg, scope: 'delete', variantId };
  }

  revalidatePath(`/admin/products/${productId}/edit`);
  return { ok: true, message: 'Variant silindi', scope: 'delete', variantId };
}

// ─────────────────────────────────────────────────────────────────
// SET DEFAULT
// ─────────────────────────────────────────────────────────────────

export async function setDefaultVariantAction(
  productId: string,
  variantId: string,
): Promise<VariantActionState> {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const companyId = session.user.companyId;
  const result = await withTenant(companyId, (tx) =>
    setDefaultVariant(companyId, variantId, tx),
  );
  if (!result.ok) {
    const msg = {
      not_found: 'Variant bulunamadı',
      not_active: 'Pasif variant default yapılamaz',
      unknown: 'Default değiştirilemedi',
    }[result.reason];
    return { ...EMPTY_STATE, message: msg, scope: 'set_default', variantId };
  }

  revalidatePath(`/admin/products/${productId}/edit`);
  return {
    ok: true,
    message: 'Default variant değişti',
    scope: 'set_default',
    variantId,
  };
}
