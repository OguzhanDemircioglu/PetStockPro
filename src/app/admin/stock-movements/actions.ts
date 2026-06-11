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
import { checkAndNotifyStockChange } from '@/lib/notifications/stock-triggers';
import { assertNotObserver, ObserverReadOnlyError } from '@/lib/auth/role-gate';
import { hasPermission } from '@/lib/users/permissions';
import { PERMISSION_KEYS, type PermissionKey } from '@/lib/users/permission-keys';
import { assertBranchOperational, BranchNotOperationalError } from '@/lib/branches/status';
import { trackUnexpected } from '@/lib/errors/wrap';

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
    product_limit_exceeded:
      'Ürün limitini aştın — yeni stok eklemek için ürün sayını plan limitine düşür (ürün sil) ya da planını yükselt',
    no_change: 'Sayım sistemdeki miktarla aynı — düzeltme yok',
    observer_read_only: 'İzleyici modundasın — bu işlem yapılamaz',
    permission_required: 'Bu işlem için yetki yok — Bayi Admin\'den iste',
    branch_not_operational: 'Şube pasif veya tatilde — işlem yapılamaz',
    unknown: 'Kaydedilemedi, tekrar dene',
  };
  return map[reason] ?? fallback;
}

/**
 * Faz 2 — mutation action başlangıç gate'i.
 *
 * 3 katmanlı kontrol:
 *   1. Observer rolü → ObserverReadOnlyError (anında reject)
 *   2. Permission yetkisi → required key STAFF için ON mu? (BAYI_SAHIBI/SUPERADMIN bypass)
 *   3. Pasif/tatilde şube → BranchNotOperationalError
 *
 * Geriye state döndürürse caller doğrudan return eder; null → devam.
 *
 * @param scope        MovementActionState için scope
 * @param userId       session.user.id
 * @param requiredKey  hasPermission key (null → permission gate atlanır)
 * @param branchId     assertBranchOperational için (null → gate atlanır)
 * @param requireActiveBranch  true → tatilde de yasak (vitrin gibi)
 */
async function guardMutation(
  scope: NonNullable<MovementActionState['scope']>,
  userId: string,
  session: { user?: { role?: string } | null } | null,
  requiredKey: PermissionKey | null,
  branchId: string | null,
  requireActiveBranch = false,
): Promise<MovementActionState | null> {
  try {
    assertNotObserver(session);
  } catch (e) {
    if (e instanceof ObserverReadOnlyError) {
      return { ...EMPTY, scope, message: reasonToMessage('observer_read_only', 'Reddedildi') };
    }
    throw e;
  }

  if (requiredKey !== null) {
    const allowed = await hasPermission(userId, requiredKey, db);
    if (!allowed) {
      return {
        ...EMPTY,
        scope,
        message: reasonToMessage('permission_required', 'Yetki yok'),
      };
    }
  }

  if (branchId !== null) {
    try {
      await assertBranchOperational(branchId, db, { requireActive: requireActiveBranch });
    } catch (e) {
      if (e instanceof BranchNotOperationalError) {
        return {
          ...EMPTY,
          scope,
          message: reasonToMessage('branch_not_operational', 'Şube uygun değil'),
        };
      }
      throw e;
    }
  }

  return null;
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
  // Over-limit (PRO+ → PRO downgrade sonrası) → sayıları içeren net mesaj.
  const pc = 'planContext' in result ? result.planContext : undefined;
  const message =
    result.reason === 'product_limit_exceeded' && pc
      ? `Ürün limitini aştın (${pc.currentCount}/${pc.limit}). Yeni stok eklemek için ürün sayını ${pc.limit}'e düşür (ürün sil) ya da planını yükselt.`
      : reasonToMessage(result.reason, 'Hata');

  return {
    ...EMPTY,
    scope,
    message,
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

  return trackUnexpected(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      route: '/admin/stock-movements',
      action: 'stock.in',
    },
    async () => {
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

      const gate = await guardMutation(
        'stock_in',
        session.user!.id!,
        session,
        PERMISSION_KEYS.STOCK_IN_CREATE,
        branchId,
      );
      if (gate) return gate;

      const result = await recordStockIn(
        session.user!.companyId!,
        session.user!.id!,
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
            companyId: session.user!.companyId!,
            userId: session.user!.id!,
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
    },
  );
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

  // Stock-out subtype → permission key mapping (Plan §2.3).
  // 'other' subtype Plan'da yok → SALE_CREATE'e indirgeme (sale'in altküme'si gibi).
  const subtypeToKey: Record<StockOutSubtype, PermissionKey> = {
    sale: PERMISSION_KEYS.SALE_CREATE,
    waste: PERMISSION_KEYS.STOCK_OUT_WASTE,
    gift: PERMISSION_KEYS.STOCK_OUT_GIFT,
    sample: PERMISSION_KEYS.STOCK_OUT_SAMPLE,
    internal_use: PERMISSION_KEYS.STOCK_OUT_INTERNAL,
    return: PERMISSION_KEYS.STOCK_OUT_RETURN,
    other: PERMISSION_KEYS.SALE_CREATE,
  };
  const gate = await guardMutation(
    'stock_out',
    session.user.id,
    session,
    subtypeToKey[subtype],
    branchId,
  );
  if (gate) return gate;

  // Veresiye satış için ek yetki kontrolü
  if (subtype === 'sale' && paymentMethod === 'credit') {
    const creditAllowed = await hasPermission(
      session.user.id,
      PERMISSION_KEYS.CREDIT_SALE_CREATE,
      db,
    );
    if (!creditAllowed) {
      return {
        ...EMPTY,
        scope: 'stock_out',
        message: reasonToMessage('permission_required', 'Veresiye yetkisi yok'),
      };
    }
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

    // Eşik geçişi varsa auto-notif (low_stock + out_of_stock + vitrin_auto_unpublished)
    if (result.beforeQty !== undefined) {
      void checkAndNotifyStockChange({
        companyId: session.user.companyId,
        branchId,
        variantId,
        beforeQty: result.beforeQty,
        afterQty: result.afterQty,
        movementCreatedAt: new Date(),
        db,
      });
    }

    revalidatePath('/admin/stock-movements');
    revalidatePath('/admin/products');
    revalidatePath('/admin');
    revalidatePath('/admin/notifications');
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

  // Transfer için hem kaynak hem hedef şube operasyonel olmalı.
  const gateSource = await guardMutation(
    'transfer',
    session.user.id,
    session,
    PERMISSION_KEYS.TRANSFER_CREATE,
    sourceBranchId,
  );
  if (gateSource) return gateSource;

  try {
    await assertBranchOperational(targetBranchId, db);
  } catch (e) {
    if (e instanceof BranchNotOperationalError) {
      return {
        ...EMPTY,
        scope: 'transfer',
        message: reasonToMessage('branch_not_operational', 'Hedef şube uygun değil'),
      };
    }
    throw e;
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

  const gate = await guardMutation(
    'stocktake',
    session.user.id,
    session,
    PERMISSION_KEYS.STOCKTAKE_CREATE,
    branchId,
  );
  if (gate) return gate;

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

    void checkAndNotifyStockChange({
      companyId: session.user.companyId,
      branchId,
      variantId,
      beforeQty: result.beforeQty,
      afterQty: result.afterQty,
      movementCreatedAt: new Date(),
      db,
    });

    revalidatePath('/admin/stock-movements');
    revalidatePath('/admin/products');
    revalidatePath('/admin');
    revalidatePath('/admin/notifications');
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

  // OBSERVER reversal yapamaz. STAFF için Plan'da reversal yetkisi tanımlı değil
  // (24h pencere zaten kullanıcı koruması, Bayi Admin'in iznine bağlı). Mevcut
  // sade-tut: assertNotObserver yeter; sıkı yetki Faz 2 sonrası.
  try {
    assertNotObserver(session);
  } catch (e) {
    if (e instanceof ObserverReadOnlyError) {
      return {
        ok: false,
        message: reasonToMessage('observer_read_only', 'Reddedildi'),
        meta: null,
      };
    }
    throw e;
  }

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
