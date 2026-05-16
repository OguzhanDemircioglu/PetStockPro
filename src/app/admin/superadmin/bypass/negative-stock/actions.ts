'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { verifyBypassGuard, writeBypassAudit } from '@/lib/superadmin/bypass';
import { forceNegativeStockOut } from '@/lib/superadmin/negative-stock';

export interface NegativeStockState {
  ok?: boolean;
  error?: string;
  issues?: string[];
  beforeQty?: number;
  afterQty?: number;
}

const inputSchema = z.object({
  branchId: z.string().uuid('Geçerli şube UUID giriniz'),
  variantId: z.string().uuid('Geçerli variant UUID giriniz'),
  quantity: z.coerce.number().int().positive('Miktar pozitif tam sayı (negatife çekilecek qty)'),
  superadminPassword: z.string().min(1, 'Şifre zorunlu'),
  reason: z.string().min(10, 'Sebep min 10 karakter'),
});

export async function negativeStockAction(
  _prev: NegativeStockState | null,
  formData: FormData,
): Promise<NegativeStockState> {
  await requireSuperadmin();
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect('/login' as never);

  const parsed = inputSchema.safeParse({
    branchId: formData.get('branchId'),
    variantId: formData.get('variantId'),
    quantity: formData.get('quantity'),
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

  const result = await forceNegativeStockOut(
    session.user.companyId,
    session.user.id,
    { branchId: data.branchId, variantId: data.variantId, quantity: data.quantity },
    data.reason,
    db,
  );

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: 'Lib validation hatası', issues: result.issues };
    }
    const messages: Record<string, string> = {
      not_found: 'Variant veya şube bulunamadı (veya başka tenant)',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  await writeBypassAudit({
    companyId: session.user.companyId,
    superadminUserId: session.user.id,
    action: 'superadmin.bypass.negative_stock',
    entityType: 'stock_movement',
    entityId: result.movementId,
    reason: data.reason,
    beforeState: { stockQty: result.beforeQty },
    afterState: { stockQty: result.afterQty, quantityRemoved: data.quantity },
    db,
  });

  revalidatePath('/admin/stock-movements');
  revalidatePath('/admin/products');
  revalidatePath('/admin/audit-log');
  return { ok: true, beforeQty: result.beforeQty, afterQty: result.afterQty };
}
