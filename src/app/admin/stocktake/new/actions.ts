'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { startStocktake } from '@/lib/stocktake/sessions';
import { writeAuditLogAsync } from '@/lib/audit/log';

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

  const branchId = formData.get('branchId');
  const note = formData.get('note');
  if (typeof branchId !== 'string' || branchId.length === 0) {
    return { error: 'Şube seçimi zorunlu' };
  }

  const result = await startStocktake(
    session.user.companyId,
    session.user.id,
    {
      branchId,
      mode: 'full',
      note: typeof note === 'string' && note.length > 0 ? note : undefined,
    },
    db,
  );

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
