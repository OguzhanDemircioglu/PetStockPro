'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { verifyBypassGuard, writeBypassAudit } from '@/lib/superadmin/bypass';
import { reverseStockMovement } from '@/lib/stock/movements';

export interface ReverseExpiredState {
  ok?: boolean;
  error?: string;
  issues?: string[];
  movementId?: string;
  reversalMovementId?: string;
}

const inputSchema = z.object({
  movementId: z.string().uuid('Geçerli hareket UUID giriniz'),
  superadminPassword: z.string().min(1, 'Şifre zorunlu'),
  reason: z.string().min(10, 'Sebep min 10 karakter'),
});

export async function reverseExpiredAction(
  _prev: ReverseExpiredState | null,
  formData: FormData,
): Promise<ReverseExpiredState> {
  const session = await requireSuperadmin();
  // requireSuperadmin redirect yapar — buradan sonra session garanti
  void session;
  const authSession = await auth();
  if (!authSession?.user?.id) redirect('/login' as never);

  const parsed = inputSchema.safeParse({
    movementId: formData.get('movementId'),
    superadminPassword: formData.get('superadminPassword'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return {
      error: 'Form geçersiz',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // Şifre re-auth + sebep validate
  const guard = await verifyBypassGuard(
    authSession.user.id,
    { superadminPassword: data.superadminPassword, reason: data.reason },
    db,
  );
  if (!guard.ok) {
    if (guard.reason === 'invalid_reason') {
      return { error: 'Sebep geçersiz', issues: guard.issues };
    }
    if (guard.reason === 'invalid_password') {
      return { error: 'Şifre yanlış — re-auth başarısız' };
    }
    return { error: 'Süperadmin doğrulama başarısız' };
  }

  // Reverse yap — isSuperadmin=true → 24h window bypass
  // reverseStockMovement signature: (companyId, movementId, userId, db, opts)
  const result = await reverseStockMovement(
    authSession.user.companyId ?? '',
    data.movementId,
    authSession.user.id,
    db,
    { isSuperadmin: true, reason: data.reason },
  );

  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: 'Hareket bulunamadı (veya başka tenant)',
      already_reversed: 'Hareket zaten geri alınmış',
      is_reversal: 'Bu zaten bir reversal hareketi',
      insufficient_stock: 'Hedef şubede yeterli stok yok',
      transfer_pair_missing: 'Transfer eş hareketi bulunamadı (veri tutarsız)',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  // Audit
  await writeBypassAudit({
    companyId: authSession.user.companyId,
    superadminUserId: authSession.user.id,
    action: 'superadmin.bypass.reverse_expired',
    entityType: 'stock_movement',
    entityId: data.movementId,
    reason: data.reason,
    afterState: { reversalMovementId: result.reversalMovementId, originalMovementId: data.movementId },
    db,
  });

  revalidatePath('/admin/stock-movements');
  revalidatePath('/admin/audit-log');
  return { ok: true, movementId: data.movementId, reversalMovementId: result.reversalMovementId };
}
