'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { withTenant } from '@/lib/db/with-tenant';
import { startStocktake, type StartStocktakeResult } from '@/lib/stocktake/sessions';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { assertNotObserver, ObserverReadOnlyError } from '@/lib/auth/role-gate';
import { hasPermission } from '@/lib/users/permissions';
import { PERMISSION_KEYS } from '@/lib/users/permission-keys';
import { assertBranchOperational, BranchNotOperationalError } from '@/lib/branches/status';

export interface StartStocktakeState {
  ok?: boolean;
  error?: string;
}

export async function startStocktakeAction(
  _prev: StartStocktakeState | null,
  formData: FormData,
): Promise<StartStocktakeState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    return { error: 'Oturum geçersiz, lütfen tekrar giriş yap' };
  }
  const companyId = session.user.companyId;
  const userId = session.user.id;

  // Faz 2 — Observer reject + STOCKTAKE_CREATE yetkisi + şube operasyonel mi
  try {
    assertNotObserver(session);
  } catch (e) {
    if (e instanceof ObserverReadOnlyError) {
      return { error: 'İzleyici modundasın — sayım başlatamazsın' };
    }
    throw e;
  }

  const branchId = formData.get('branchId');
  const note = formData.get('note');
  if (typeof branchId !== 'string' || branchId.length === 0) {
    return { error: 'Şube seçimi zorunlu' };
  }

  // Faz 4B: yetki + şube-assert + startStocktake (self-tx → savepoint) TEK
  // withTenant'ta (GUC). audit fire-forget + redirect DIŞINDA (owner).
  const outcome = await withTenant<
    { error: string } | { result: StartStocktakeResult }
  >(companyId, async (tx) => {
    const allowed = await hasPermission(userId, PERMISSION_KEYS.STOCKTAKE_CREATE, tx);
    if (!allowed) {
      return { error: 'Sayım başlatma yetkisi yok — Bayi Admin\'den iste' };
    }
    try {
      await assertBranchOperational(companyId, branchId, tx);
    } catch (e) {
      if (e instanceof BranchNotOperationalError) {
        return { error: 'Şube pasif — sayım başlatılamaz' };
      }
      throw e;
    }
    const result = await startStocktake(
      companyId,
      userId,
      {
        branchId,
        mode: 'full',
        note: typeof note === 'string' && note.length > 0 ? note : undefined,
      },
      tx,
    );
    return { result };
  });
  if ('error' in outcome) return { error: outcome.error };
  const result = outcome.result;

  if (!result.ok) {
    const messages: Record<string, string> = {
      invalid_input:
        result.reason === 'invalid_input' && result.issues.length > 0
          ? result.issues.join(', ')
          : 'Geçersiz giriş',
      branch_not_found: 'Şube bulunamadı veya sana ait değil',
      no_variants: 'Bu şubede aktif variant yok — önce ürün ekle',
      unknown: 'Sayım başlatılamadı (bilinmeyen hata)',
    };
    return { error: messages[result.reason] ?? 'Beklenmedik hata' };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'stocktake.started',
      entityType: 'stocktake',
      entityId: result.stocktakeId,
      afterState: { branchId, totalItems: result.totalItems, mode: 'full' },
    },
    db,
  );

  revalidatePath('/admin/stocktake');
  redirect(`/admin/stocktake/${result.stocktakeId}` as never);
}
