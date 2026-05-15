'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  recordStockIn,
  recordStockOut,
  recordTransfer,
  type StockMovementResult,
  type TransferResult,
} from '@/lib/stock/movements';

export interface MovementActionState {
  ok: boolean;
  scope: 'stock_in' | 'stock_out' | 'transfer' | null;
  message: string | null;
  issues: string[];
  meta: { available?: number; requested?: number; afterQty?: number } | null;
}

const EMPTY: MovementActionState = {
  ok: false,
  scope: null,
  message: null,
  issues: [],
  meta: null,
};

function asStr(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asInt(v: FormDataEntryValue | null): number | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function reasonToMessage(reason: string, fallback: string): string {
  const map: Record<string, string> = {
    invalid_input: 'Geçersiz alan',
    not_found: 'Variant veya şube bulunamadı',
    insufficient_stock: 'Yetersiz stok',
    invalid_state: 'Geçersiz durum',
    unknown: 'Kaydedilemedi, tekrar dene',
  };
  return map[reason] ?? fallback;
}

function buildState<R extends StockMovementResult | TransferResult>(
  scope: NonNullable<MovementActionState['scope']>,
  result: R,
): MovementActionState {
  if (result.ok) {
    const afterQty = 'afterQty' in result ? result.afterQty : undefined;
    return {
      ok: true,
      scope,
      message: 'Kaydedildi',
      issues: [],
      meta: afterQty !== undefined ? { afterQty } : null,
    };
  }
  return {
    ...EMPTY,
    scope,
    message: reasonToMessage(result.reason, 'Hata'),
    issues: result.issues ?? [],
    meta: result.meta ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────
// STOCK IN
// ─────────────────────────────────────────────────────────────────

export async function stockInAction(
  _prev: MovementActionState | null,
  formData: FormData,
): Promise<MovementActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const branchId = asStr(formData.get('branchId'));
  const variantId = asStr(formData.get('variantId'));
  const quantity = asInt(formData.get('quantity'));
  const unitCost = asStr(formData.get('unitCost'));
  const supplierId = asStr(formData.get('supplierId'));
  const documentNo = asStr(formData.get('documentNo'));
  const lotNumber = asStr(formData.get('lotNumber'));
  const expiryDate = asStr(formData.get('expiryDate'));
  const note = asStr(formData.get('note'));

  if (!branchId || !variantId || !quantity) {
    return {
      ...EMPTY,
      scope: 'stock_in',
      message: 'Şube, variant ve miktar zorunlu',
    };
  }

  const result = await recordStockIn(
    session.user.companyId,
    session.user.id,
    {
      branchId,
      variantId,
      quantity,
      unitCost: unitCost ?? undefined,
      supplierId,
      documentNo,
      lotNumber,
      expiryDate,
      note,
    },
    db,
  );

  if (result.ok) {
    revalidatePath('/admin/stock-movements');
    revalidatePath('/admin/products');
  }
  return buildState('stock_in', result);
}

// ─────────────────────────────────────────────────────────────────
// STOCK OUT
// ─────────────────────────────────────────────────────────────────

const STOCK_OUT_SUBTYPES = [
  'sale',
  'waste',
  'gift',
  'sample',
  'return',
  'internal_use',
  'other',
] as const;
type StockOutSubtype = (typeof STOCK_OUT_SUBTYPES)[number];

export async function stockOutAction(
  _prev: MovementActionState | null,
  formData: FormData,
): Promise<MovementActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const branchId = asStr(formData.get('branchId'));
  const variantId = asStr(formData.get('variantId'));
  const quantity = asInt(formData.get('quantity'));
  const subtypeRaw = asStr(formData.get('subtype'));
  const subtype = (
    subtypeRaw && (STOCK_OUT_SUBTYPES as readonly string[]).includes(subtypeRaw)
      ? (subtypeRaw as StockOutSubtype)
      : null
  );
  const unitPrice = asStr(formData.get('unitPrice'));
  const customerRef = asStr(formData.get('customerRef'));
  const paymentMethodRaw = asStr(formData.get('paymentMethod'));
  const paymentMethod = (
    paymentMethodRaw &&
      ['cash', 'card', 'bank_transfer', 'credit'].includes(paymentMethodRaw)
      ? (paymentMethodRaw as 'cash' | 'card' | 'bank_transfer' | 'credit')
      : null
  );
  const reason = asStr(formData.get('reason'));
  const note = asStr(formData.get('note'));

  if (!branchId || !variantId || !quantity || !subtype) {
    return {
      ...EMPTY,
      scope: 'stock_out',
      message: 'Şube, variant, miktar ve çıkış türü zorunlu',
    };
  }

  const result = await recordStockOut(
    session.user.companyId,
    session.user.id,
    {
      branchId,
      variantId,
      quantity,
      subtype,
      unitPrice: unitPrice ?? undefined,
      customerRef,
      paymentMethod,
      reason,
      note,
    },
    db,
  );

  if (result.ok) {
    revalidatePath('/admin/stock-movements');
    revalidatePath('/admin/products');
  }
  return buildState('stock_out', result);
}

// ─────────────────────────────────────────────────────────────────
// TRANSFER
// ─────────────────────────────────────────────────────────────────

export async function transferAction(
  _prev: MovementActionState | null,
  formData: FormData,
): Promise<MovementActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const sourceBranchId = asStr(formData.get('sourceBranchId'));
  const targetBranchId = asStr(formData.get('targetBranchId'));
  const variantId = asStr(formData.get('variantId'));
  const quantity = asInt(formData.get('quantity'));
  const note = asStr(formData.get('note'));

  if (!sourceBranchId || !targetBranchId || !variantId || !quantity) {
    return {
      ...EMPTY,
      scope: 'transfer',
      message: 'Kaynak, hedef, variant ve miktar zorunlu',
    };
  }

  const result = await recordTransfer(
    session.user.companyId,
    session.user.id,
    { sourceBranchId, targetBranchId, variantId, quantity, note },
    db,
  );

  if (result.ok) {
    revalidatePath('/admin/stock-movements');
    revalidatePath('/admin/products');
  }
  return buildState('transfer', result);
}
