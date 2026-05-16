'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { verifyBypassGuard, writeBypassAudit } from '@/lib/superadmin/bypass';
import { rollbackStocktake } from '@/lib/superadmin/stocktake-rollback';

export interface StocktakeUndoState {
  ok?: boolean;
  error?: string;
  issues?: string[];
  stocktakeId?: string;
  movementsReversed?: number;
  movementsTotal?: number;
}

const inputSchema = z.object({
  stocktakeId: z.string().uuid('Geçerli sayım UUID giriniz'),
  superadminPassword: z.string().min(1, 'Şifre zorunlu'),
  reason: z.string().min(10, 'Sebep min 10 karakter'),
});

export async function stocktakeUndoAction(
  _prev: StocktakeUndoState | null,
  formData: FormData,
): Promise<StocktakeUndoState> {
  await requireSuperadmin();
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect('/login' as never);

  const parsed = inputSchema.safeParse({
    stocktakeId: formData.get('stocktakeId'),
    superadminPassword: formData.get('superadminPassword'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { error: 'Form geçersiz', issues: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;

  const guard = await verifyBypassGuard(
    session.user.id,
    { superadminPassword: data.superadminPassword, reason: data.reason },
    db,
  );
  if (!guard.ok) {
    if (guard.reason === 'invalid_reason') return { error: 'Sebep geçersiz', issues: guard.issues };
    if (guard.reason === 'invalid_password') return { error: 'Şifre yanlış — re-auth başarısız' };
    return { error: 'Süperadmin doğrulama başarısız' };
  }

  const result = await rollbackStocktake(
    session.user.companyId,
    session.user.id,
    { stocktakeId: data.stocktakeId },
    db,
  );

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: 'Lib validation hatası', issues: result.issues };
    }
    if (result.reason === 'not_completed') {
      return {
        error: `Sayım durumu '${result.currentStatus}' — sadece 'completed' sayım rollback edilebilir`,
      };
    }
    const messages: Record<string, string> = {
      not_found: 'Sayım bulunamadı (UUID hatalı veya başka tenant)',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  await writeBypassAudit({
    companyId: session.user.companyId,
    superadminUserId: session.user.id,
    action: 'superadmin.bypass.stocktake_rollback',
    entityType: 'stocktake',
    entityId: result.stocktakeId,
    reason: data.reason,
    afterState: {
      branchId: result.branchId,
      movementsReversed: result.movementsReversed,
      movementsTotal: result.movementsTotal,
      newStatus: 'cancelled',
    },
    db,
  });

  revalidatePath('/admin/stocktake');
  revalidatePath('/admin/stock-movements');
  revalidatePath('/admin/audit-log');
  return {
    ok: true,
    stocktakeId: result.stocktakeId,
    movementsReversed: result.movementsReversed,
    movementsTotal: result.movementsTotal,
  };
}
