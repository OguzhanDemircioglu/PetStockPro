'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { inviteUser, ROLE_VALUES, type InviteRole } from '@/lib/users/manage';

export interface InviteUserState {
  ok?: boolean;
  error?: string;
  issues?: string[];
  email?: string;
  acceptUrl?: string;
  expiresAt?: string;
}

const formSchema = z.object({
  email: z.string().email('Geçersiz email').toLowerCase(),
  role: z.enum(ROLE_VALUES),
  name: z.string().max(120).optional(),
  branchId: z.string().uuid().optional().nullable(),
});

export async function inviteUserAction(
  _prev: InviteUserState | null,
  formData: FormData,
): Promise<InviteUserState> {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect('/login' as never);

  // Sadece BAYI_SAHIBI veya SUPERADMIN davet edebilir
  if (session.user.role !== 'BAYI_SAHIBI' && session.user.role !== 'SUPERADMIN') {
    return { error: 'Bu işlem için BAYI_SAHIBI yetkisi gerekli' };
  }

  const branchIdRaw = formData.get('branchId');
  const parsed = formSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
    name: formData.get('name') || undefined,
    branchId:
      typeof branchIdRaw === 'string' && branchIdRaw.length > 0 ? branchIdRaw : null,
  });
  if (!parsed.success) {
    return { error: 'Form geçersiz', issues: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;

  const result = await inviteUser(
    session.user.companyId,
    session.user.id,
    {
      email: data.email,
      role: data.role as InviteRole,
      name: data.name,
      branchId: data.branchId ?? null,
    },
    db,
  );

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: 'Lib validation hatası', issues: result.issues };
    }
    const messages: Record<string, string> = {
      email_already_exists: 'Bu email zaten kullanılıyor — başka email deneyin',
      branch_not_found: 'Şube bulunamadı veya başka tenant\'a ait',
      branch_already_has_manager:
        'Bu şubeye zaten bir Şube Müdürü atanmış — bir şubeye yalnız 1 müdür eklenebilir',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'user.invited',
      entityType: 'user',
      entityId: result.userId,
      afterState: {
        email: result.email,
        role: data.role,
        method: 'link',
        branchId: data.branchId ?? null,
        expiresAt: result.expiresAt.toISOString(),
      },
    },
    db,
  );

  revalidatePath('/admin/settings/users');
  return {
    ok: true,
    email: result.email,
    acceptUrl: result.acceptUrl,
    expiresAt: result.expiresAt.toISOString(),
  };
}
