'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { verifyBypassGuard, writeBypassAudit } from '@/lib/superadmin/bypass';
import { overrideCompanyPlan, PLAN_VALUES, type PlanValue } from '@/lib/superadmin/plan-override';

export interface PlanOverrideState {
  ok?: boolean;
  error?: string;
  issues?: string[];
  beforePlan?: PlanValue;
  afterPlan?: PlanValue;
  targetCompanyName?: string;
}

const inputSchema = z.object({
  targetCompanyId: z.string().uuid('Geçerli tenant UUID giriniz'),
  newPlan: z.enum(PLAN_VALUES),
  superadminPassword: z.string().min(1, 'Şifre zorunlu'),
  reason: z.string().min(10, 'Sebep min 10 karakter'),
});

export async function planOverrideAction(
  _prev: PlanOverrideState | null,
  formData: FormData,
): Promise<PlanOverrideState> {
  await requireSuperadmin();
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect('/login' as never);

  const parsed = inputSchema.safeParse({
    targetCompanyId: formData.get('targetCompanyId'),
    newPlan: formData.get('newPlan'),
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

  const result = await overrideCompanyPlan(
    { targetCompanyId: data.targetCompanyId, newPlan: data.newPlan },
    db,
  );

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: 'Lib validation hatası', issues: result.issues };
    }
    if (result.reason === 'same_plan') {
      return {
        error: `Tenant zaten ${result.currentPlan} planında — değişiklik yok`,
      };
    }
    const messages: Record<string, string> = {
      not_found: 'Tenant bulunamadı (UUID hatalı)',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  await writeBypassAudit({
    companyId: data.targetCompanyId,
    superadminUserId: session.user.id,
    action: 'superadmin.bypass.plan_override',
    entityType: 'company',
    entityId: data.targetCompanyId,
    reason: data.reason,
    beforeState: { plan: result.beforePlan },
    afterState: { plan: result.afterPlan, targetCompanyName: result.targetCompanyName },
    db,
  });

  revalidatePath('/admin/superadmin');
  revalidatePath(`/admin/superadmin/tenant/${data.targetCompanyId}`);
  revalidatePath('/admin/audit-log');
  return {
    ok: true,
    beforePlan: result.beforePlan,
    afterPlan: result.afterPlan,
    targetCompanyName: result.targetCompanyName,
  };
}
