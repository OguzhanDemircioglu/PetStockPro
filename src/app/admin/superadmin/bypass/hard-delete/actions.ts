'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { verifyBypassGuard, writeBypassAudit } from '@/lib/superadmin/bypass';
import { hardDeleteProduct } from '@/lib/superadmin/hard-delete';

export interface HardDeleteState {
  ok?: boolean;
  error?: string;
  issues?: string[];
  productName?: string;
  movementCount?: number;
}

const inputSchema = z.object({
  productId: z.string().uuid('Geçerli ürün UUID giriniz'),
  superadminPassword: z.string().min(1, 'Şifre zorunlu'),
  reason: z.string().min(10, 'Sebep min 10 karakter'),
});

export async function hardDeleteAction(
  _prev: HardDeleteState | null,
  formData: FormData,
): Promise<HardDeleteState> {
  await requireSuperadmin();
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect('/login' as never);

  const parsed = inputSchema.safeParse({
    productId: formData.get('productId'),
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

  const result = await hardDeleteProduct(session.user.companyId, data.productId, db);

  if (!result.ok) {
    if (result.reason === 'has_movements') {
      return {
        error: `Stok hareketleri var (${result.movementCount} kayıt) — hard delete imkânsız (immutable ledger)`,
        movementCount: result.movementCount,
      };
    }
    if (result.reason === 'has_history') {
      return {
        error: `Sayım geçmişi var (${result.historyCount} stocktake_item) — hard delete imkânsız (audit korumalı)`,
      };
    }
    const messages: Record<string, string> = {
      not_found: 'Ürün bulunamadı (veya başka tenant)',
      not_soft_deleted: 'Önce soft delete edilmiş olmalı (deletedAt set olmalı)',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  await writeBypassAudit({
    companyId: session.user.companyId,
    superadminUserId: session.user.id,
    action: 'superadmin.bypass.hard_delete',
    entityType: 'product',
    entityId: data.productId,
    reason: data.reason,
    afterState: { productName: result.productName, deletedProductId: result.deletedProductId },
    db,
  });

  revalidatePath('/admin/products');
  revalidatePath('/admin/audit-log');
  return { ok: true, productName: result.productName };
}
