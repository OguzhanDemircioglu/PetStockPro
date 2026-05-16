'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { verifyBypassGuard, writeBypassAudit } from '@/lib/superadmin/bypass';
import { fixMovementMetadata } from '@/lib/superadmin/metadata-fix';

export interface MetadataFixState {
  ok?: boolean;
  error?: string;
  issues?: string[];
  movementId?: string;
  changedFields?: string[];
  before?: Record<string, string | null>;
  after?: Record<string, string | null>;
}

const inputSchema = z.object({
  movementId: z.string().uuid('Geçerli movement UUID giriniz'),
  reason: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
  customerRef: z.string().max(100).optional(),
  documentNo: z.string().max(100).optional(),
  superadminPassword: z.string().min(1, 'Şifre zorunlu'),
  bypassReason: z.string().min(10, 'Sebep min 10 karakter'),
});

function pickFormValue(formData: FormData, key: string): string | undefined {
  const raw = formData.get(key);
  if (raw === null) return undefined;
  return String(raw);
}

export async function metadataFixAction(
  _prev: MetadataFixState | null,
  formData: FormData,
): Promise<MetadataFixState> {
  await requireSuperadmin();
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect('/login' as never);

  const reasonStr = pickFormValue(formData, 'reason');
  const noteStr = pickFormValue(formData, 'note');
  const customerRefStr = pickFormValue(formData, 'customerRef');
  const documentNoStr = pickFormValue(formData, 'documentNo');

  const parsed = inputSchema.safeParse({
    movementId: formData.get('movementId'),
    superadminPassword: formData.get('superadminPassword'),
    bypassReason: formData.get('bypassReason'),
    ...(reasonStr !== undefined ? { reason: reasonStr } : {}),
    ...(noteStr !== undefined ? { note: noteStr } : {}),
    ...(customerRefStr !== undefined ? { customerRef: customerRefStr } : {}),
    ...(documentNoStr !== undefined ? { documentNo: documentNoStr } : {}),
  });
  if (!parsed.success) {
    return { error: 'Form geçersiz', issues: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;

  const guard = await verifyBypassGuard(
    session.user.id,
    { superadminPassword: data.superadminPassword, reason: data.bypassReason },
    db,
  );
  if (!guard.ok) {
    if (guard.reason === 'invalid_reason') return { error: 'Sebep geçersiz', issues: guard.issues };
    if (guard.reason === 'invalid_password') return { error: 'Şifre yanlış — re-auth başarısız' };
    return { error: 'Süperadmin doğrulama başarısız' };
  }

  const updateInput: {
    movementId: string;
    reason?: string;
    note?: string;
    customerRef?: string;
    documentNo?: string;
  } = { movementId: data.movementId };
  if (data.reason !== undefined) updateInput.reason = data.reason;
  if (data.note !== undefined) updateInput.note = data.note;
  if (data.customerRef !== undefined) updateInput.customerRef = data.customerRef;
  if (data.documentNo !== undefined) updateInput.documentNo = data.documentNo;

  const result = await fixMovementMetadata(session.user.companyId, updateInput, db);

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: 'Lib validation hatası', issues: result.issues };
    }
    const messages: Record<string, string> = {
      not_found: 'Movement bulunamadı (başka tenant veya yok)',
      no_change: 'Hiçbir alan değişmedi — düzeltme yok',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  await writeBypassAudit({
    companyId: session.user.companyId,
    superadminUserId: session.user.id,
    action: 'superadmin.bypass.metadata_fix',
    entityType: 'stock_movement',
    entityId: result.movementId,
    reason: data.bypassReason,
    beforeState: result.before as unknown as Record<string, unknown>,
    afterState: { ...result.after, changedFields: result.changedFields } as unknown as Record<string, unknown>,
    db,
  });

  revalidatePath('/admin/stock-movements');
  revalidatePath('/admin/audit-log');
  return {
    ok: true,
    movementId: result.movementId,
    changedFields: result.changedFields,
    before: result.before as unknown as Record<string, string | null>,
    after: result.after as unknown as Record<string, string | null>,
  };
}
