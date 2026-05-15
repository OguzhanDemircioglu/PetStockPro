'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  recordStockIn,
  recordStockOut,
  recordTransfer,
  recordStocktakeAdjustment,
  reverseStockMovement,
  type StockMovementResult,
  type TransferResult,
  type StocktakeResult,
} from '@/lib/stock/movements';
import { writeAuditLogAsync } from '@/lib/audit/log';

export interface MovementActionState {
  ok: boolean;
  scope: 'stock_in' | 'stock_out' | 'transfer' | 'stocktake' | null;
  message: string | null;
  issues: string[];
  meta: {
    available?: number;
    requested?: number;
    afterQty?: number;
    delta?: number;
  } | null;
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
    no_change: 'Sayım sistemdeki miktarla aynı — düzeltme yok',
    unknown: 'Kaydedilemedi, tekrar dene',
  };
  return map[reason] ?? fallback;
}

function buildState<
  R extends StockMovementResult | TransferResult | StocktakeResult,
>(
  scope: NonNullable<MovementActionState['scope']>,
  result: R,
): MovementActionState {
  if (result.ok) {
    const afterQty = 'afterQty' in result ? result.afterQty : undefined;
    const delta = 'delta' in result ? result.delta : undefined;
    return {
      ok: true,
      scope,
      message: 'Kaydedildi',
      issues: [],
      meta:
        afterQty !== undefined || delta !== undefined
          ? { afterQty, delta }
          : null,
    };
  }
  return {
    ...EMPTY,
    scope,
    message: reasonToMessage(result.reason, 'Hata'),
    issues: 'issues' in result ? result.issues ?? [] : [],
    meta: 'meta' in result ? result.meta ?? null : null,
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
    writeAuditLogAsync(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        action: 'stock.in',
        entityType: 'stock_movement',
        entityId: result.movementId,
        afterState: {
          branchId,
          variantId,
          quantity,
          afterQty: result.afterQty,
        },
      },
      db,
    );
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
    writeAuditLogAsync(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        action: 'stock.out',
        entityType: 'stock_movement',
        entityId: result.movementId,
        afterState: {
          branchId,
          variantId,
          quantity,
          subtype,
          paymentMethod,
          afterQty: result.afterQty,
        },
      },
      db,
    );
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
    writeAuditLogAsync(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        action: 'stock.transfer',
        entityType: 'transfer_group',
        entityId: result.transferGroupId,
        afterState: {
          sourceBranchId,
          targetBranchId,
          variantId,
          quantity,
          sourceAfter: result.sourceAfterQty,
          targetAfter: result.targetAfterQty,
        },
      },
      db,
    );
    revalidatePath('/admin/stock-movements');
    revalidatePath('/admin/products');
  }
  return buildState('transfer', result);
}

// ─────────────────────────────────────────────────────────────────
// STOCKTAKE — sayım sonucu düzeltme
// ─────────────────────────────────────────────────────────────────

export async function stocktakeAction(
  _prev: MovementActionState | null,
  formData: FormData,
): Promise<MovementActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const branchId = asStr(formData.get('branchId'));
  const variantId = asStr(formData.get('variantId'));
  const countedQty = asInt(formData.get('countedQty'));
  const reason = asStr(formData.get('reason'));
  const note = asStr(formData.get('note'));

  if (!branchId || !variantId || countedQty === null) {
    return {
      ...EMPTY,
      scope: 'stocktake',
      message: 'Şube, variant ve sayım miktarı zorunlu',
    };
  }

  const result = await recordStocktakeAdjustment(
    session.user.companyId,
    session.user.id,
    { branchId, variantId, countedQty, reason, note },
    db,
  );

  if (result.ok) {
    writeAuditLogAsync(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        action: 'stock.stocktake',
        entityType: 'stock_movement',
        entityId: result.movementId,
        afterState: {
          branchId,
          variantId,
          countedQty,
          delta: result.delta,
          afterQty: result.afterQty,
        },
      },
      db,
    );
    revalidatePath('/admin/stock-movements');
    revalidatePath('/admin/products');
  }
  return buildState('stocktake', result);
}

// ─────────────────────────────────────────────────────────────────
// REVERSAL — 24 saat içinde geri alma (R1)
// ─────────────────────────────────────────────────────────────────

export interface ReversalActionState {
  ok: boolean;
  message: string | null;
  meta: { available?: number; requested?: number } | null;
}

export async function reverseMovementAction(
  movementId: string,
): Promise<ReversalActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const result = await reverseStockMovement(
    session.user.companyId,
    movementId,
    session.user.id,
    db,
  );

  if (result.ok) {
    writeAuditLogAsync(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        action: 'stock.reversed',
        entityType: 'stock_movement',
        entityId: movementId,
        afterState: {
          reversalMovementId: result.reversalMovementId,
          reversalPairId: result.reversalPairId ?? null,
        },
      },
      db,
    );
    revalidatePath('/admin/stock-movements');
    revalidatePath('/admin/products');
    return { ok: true, message: 'Geri alındı', meta: null };
  }

  const msg: Record<string, string> = {
    not_found: 'Hareket bulunamadı',
    already_reversed: 'Bu hareket zaten geri alınmış',
    is_reversal: 'Bir geri alma kaydı tekrar geri alınamaz',
    window_expired: '24 saat geçti — süperadmin müdahalesi gerekli',
    insufficient_stock: 'Stok yetersiz — sonraki satış geri alındıktan sonra dene',
    transfer_pair_missing: 'Transfer eşi bulunamadı (veri tutarsız)',
    unknown: 'Geri alınamadı, tekrar dene',
  };
  return {
    ok: false,
    message: msg[result.reason] ?? 'Hata',
    meta: 'meta' in result ? result.meta ?? null : null,
  };
}
