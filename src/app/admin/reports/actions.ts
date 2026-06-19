'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { settleCredit } from '@/lib/reports/open-credits';

export interface SettleCreditActionState {
  ok: boolean;
  message?: string;
  movementId?: string;
}

const REASON_MESSAGES: Record<string, string> = {
  not_found: 'Hareket bulunamadı.',
  not_credit: 'Bu hareket veresiye değil.',
  already_settled: 'Bu kredi zaten kapatılmış.',
  reversed: 'Bu hareket geri alınmış, kapatılamaz.',
  unknown: 'Bilinmeyen bir hata oluştu.',
};

export async function settleCreditAction(
  _prev: SettleCreditActionState,
  formData: FormData,
): Promise<SettleCreditActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    return { ok: false, message: 'Yetki yok.' };
  }
  const companyId = session.user.companyId;
  const userId = session.user.id;

  const movementId = formData.get('movementId');
  if (typeof movementId !== 'string' || movementId.length === 0) {
    return { ok: false, message: 'Geçersiz hareket id.' };
  }

  const result = await withTenant(companyId, (tx) =>
    settleCredit(companyId, userId, movementId, tx),
  );

  if (!result.ok) {
    return {
      ok: false,
      message: REASON_MESSAGES[result.reason] ?? REASON_MESSAGES.unknown,
      movementId,
    };
  }

  revalidatePath('/admin/reports');
  revalidatePath('/admin/audit-log');
  return { ok: true, movementId, message: 'Kredi kapatıldı.' };
}
