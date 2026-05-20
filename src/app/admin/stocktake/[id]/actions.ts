'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  updateStocktakeItemCount,
  completeStocktake,
  cancelStocktake,
  stocktakeReasonValues,
  type StocktakeReason,
  type UpdateItemCountResult,
} from '@/lib/stocktake/sessions';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { createNotificationAsync } from '@/lib/notifications/manage';
import { assertNotObserver, ObserverReadOnlyError } from '@/lib/auth/role-gate';

/**
 * Faz 2 — sayım oturumu içi mutation'lar (update/complete/cancel) Observer'a
 * yasak; STOCKTAKE_CREATE yetkisi /admin/stocktake/new'da kontrol edilir
 * (sayım başlatma noktası), ondan sonraki kayıt edenler gevşek bırakılır
 * (zaten yetkisi olmasa başlatamazdı).
 */
function rejectIfObserver<T extends { error?: string }>(
  session: { user?: { role?: string } | null } | null,
  shape: T,
): T | null {
  try {
    assertNotObserver(session);
    return null;
  } catch (e) {
    if (e instanceof ObserverReadOnlyError) {
      return { ...shape, error: 'İzleyici modundasın — sayım düzenleyemezsin' };
    }
    throw e;
  }
}

export interface UpdateCountState {
  ok?: boolean;
  itemId?: string;
  diff?: number;
  countedItems?: number;
  diffItems?: number;
  error?: string;
}

export async function updateCountAction(
  stocktakeId: string,
  itemId: string,
  _prev: UpdateCountState | null,
  formData: FormData,
): Promise<UpdateCountState> {
  const session = await auth();
  if (!session?.user?.companyId) return { error: 'Oturum geçersiz' };
  const gate = rejectIfObserver<UpdateCountState>(session, { itemId });
  if (gate) return gate;

  const countedRaw = formData.get('countedQty');
  const reasonRaw = formData.get('reason');
  const customRaw = formData.get('customReason');

  const counted = typeof countedRaw === 'string' ? Number(countedRaw) : NaN;
  if (!Number.isInteger(counted) || counted < 0) {
    return { error: 'Sayılan adet 0 veya pozitif tam sayı olmalı', itemId };
  }

  const reason =
    typeof reasonRaw === 'string' && stocktakeReasonValues.includes(reasonRaw as StocktakeReason)
      ? (reasonRaw as StocktakeReason)
      : undefined;
  const customReason = typeof customRaw === 'string' && customRaw.length > 0 ? customRaw : undefined;

  const result: UpdateItemCountResult = await updateStocktakeItemCount(
    session.user.companyId,
    stocktakeId,
    itemId,
    { countedQty: counted, reason, customReason },
    db,
  );

  if (!result.ok) {
    const messages: Record<string, string> = {
      invalid_input:
        result.reason === 'invalid_input' && result.issues.length > 0
          ? result.issues.join(', ')
          : 'Geçersiz giriş',
      not_found: 'Kayıt bulunamadı',
      session_closed: 'Sayım tamamlandı veya iptal edildi — düzenleme yapılamaz',
      unknown: 'Beklenmedik hata',
    };
    return { error: messages[result.reason] ?? 'Hata', itemId };
  }

  revalidatePath(`/admin/stocktake/${stocktakeId}`);
  return {
    ok: true,
    itemId,
    diff: result.diff,
    countedItems: result.countedItems,
    diffItems: result.diffItems,
  };
}

export interface CompleteStocktakeState {
  ok?: boolean;
  movementsCreated?: number;
  error?: string;
  uncountedCount?: number;
}

export async function completeStocktakeAction(
  stocktakeId: string,
  _prev: CompleteStocktakeState | null,
  _formData: FormData,
): Promise<CompleteStocktakeState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    return { error: 'Oturum geçersiz' };
  }
  const gate = rejectIfObserver<CompleteStocktakeState>(session, {});
  if (gate) return gate;

  const result = await completeStocktake(
    session.user.companyId,
    session.user.id,
    stocktakeId,
    db,
  );

  if (!result.ok) {
    if (result.reason === 'has_uncounted') {
      return {
        error: `${result.uncountedCount} variant hâlâ sayılmadı — hepsini say veya iptal et`,
        uncountedCount: result.uncountedCount,
      };
    }
    const messages: Record<string, string> = {
      not_found: 'Sayım bulunamadı',
      session_closed: 'Sayım zaten kapanmış',
      unknown: 'Hata oluştu',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'stocktake.completed',
      entityType: 'stocktake',
      entityId: stocktakeId,
      afterState: {
        movementsCreated: result.movementsCreated,
        itemsAdjusted: result.itemsAdjusted,
      },
    },
    db,
  );

  // Tüm tenant'a bildirim (userId NULL → tüm admin'ler görür)
  createNotificationAsync(
    {
      companyId: session.user.companyId,
      type: 'stocktake_completed',
      content: {
        title: 'Sayım tamamlandı',
        body: `${result.movementsCreated} stok hareketi üretildi (${result.itemsAdjusted} variant düzeltildi)`,
        link: `/admin/stocktake/${stocktakeId}`,
        emoji: '✅',
      },
    },
    db,
  );

  revalidatePath(`/admin/stocktake/${stocktakeId}`);
  revalidatePath('/admin/stocktake');
  revalidatePath('/admin/stock-movements');
  revalidatePath('/admin');
  return { ok: true, movementsCreated: result.movementsCreated };
}

export interface CancelStocktakeState {
  ok?: boolean;
  error?: string;
}

export async function cancelStocktakeAction(
  stocktakeId: string,
  _prev: CancelStocktakeState | null,
  _formData: FormData,
): Promise<CancelStocktakeState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    return { error: 'Oturum geçersiz' };
  }
  const gate = rejectIfObserver<CancelStocktakeState>(session, {});
  if (gate) return gate;

  const result = await cancelStocktake(session.user.companyId, stocktakeId, db);

  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: 'Sayım bulunamadı',
      already_closed: 'Sayım zaten kapanmış',
      unknown: 'Hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'stocktake.cancelled',
      entityType: 'stocktake',
      entityId: stocktakeId,
    },
    db,
  );

  revalidatePath('/admin/stocktake');
  redirect('/admin/stocktake?cancelled=1' as never);
}
