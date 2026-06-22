'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { withTenant, withOwner } from '@/lib/db/with-tenant';
import { users as usersTable } from '@/db/schema';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { inviteUser, ROLE_VALUES, type InviteRole } from '@/lib/users/manage';
import {
  applyStaffDefaults,
  setBulkPermissions,
  getUserPermissions,
} from '@/lib/users/permissions';
import {
  ALL_PERMISSION_KEYS,
  isValidPermissionKey,
} from '@/lib/users/permission-keys';

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
  const companyId = session.user.companyId;
  const userId = session.user.id;

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

  // Faz 4B: inviteUser cross-tenant email çakışma kontrolü yapar (global email
  // unique) → withOwner (owner conn, RLS bypass). withTenant'ta GUC kontrolü
  // sadece kendi tenant'ını görür, yanlış olurdu.
  const result = await withOwner((owner) =>
    inviteUser(
      companyId,
      userId,
      {
        email: data.email,
        role: data.role as InviteRole,
        name: data.name,
        branchId: data.branchId ?? null,
      },
      owner,
    ),
  );

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: 'Lib validation hatası', issues: result.issues };
    }
    const messages: Record<string, string> = {
      email_already_exists: 'Bu email zaten kullanılıyor — başka email deneyin',
      branch_not_found: 'Şube bulunamadı veya başka tenant\'a ait',
      branch_already_has_manager:
        'Bu şubeye zaten bir İzleyici atanmış — bir şubeye yalnız 1 İzleyici eklenebilir',
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

  // Faz 6 — STAFF davetinde 3 default ON yetki seed (sale.create / variant.view /
  // customer_ref.write). OBSERVER için yetki tablosuna kayıt YOK (read-only,
  // helper bypass eder).
  if (data.role === 'STAFF') {
    await withTenant(companyId, (tx) => applyStaffDefaults(result.userId, userId, tx));
  }

  revalidatePath('/admin/settings/users');
  return {
    ok: true,
    email: result.email,
    acceptUrl: result.acceptUrl,
    expiresAt: result.expiresAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────
// Faz 6 — updateUserPermissionsAction (yetki modal submit)
// ─────────────────────────────────────────────────────────────────

export interface UpdatePermissionsState {
  ok?: boolean;
  error?: string;
  updatedCount?: number;
}

const permissionsSchema = z.object({
  userId: z.string().uuid('Geçersiz kullanıcı id'),
  permissions: z.record(z.string(), z.boolean()),
});

export async function updateUserPermissionsAction(
  _prev: UpdatePermissionsState | null,
  formData: FormData,
): Promise<UpdatePermissionsState> {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    return { error: 'Oturum geçersiz, tekrar giriş yap' };
  }
  if (session.user.role !== 'BAYI_SAHIBI' && session.user.role !== 'SUPERADMIN') {
    return { error: 'Yetki değiştirme yalnızca Bayi Admin\'e açık' };
  }

  const userId = formData.get('userId');
  if (typeof userId !== 'string' || userId.length === 0) {
    return { error: 'Kullanıcı id eksik' };
  }

  // Form'dan 15 permission key okur ('on' / null pattern, checkbox HTML).
  const permissions: Record<string, boolean> = {};
  for (const key of ALL_PERMISSION_KEYS) {
    const v = formData.get(`perm.${key}`);
    permissions[key] = v === 'on' || v === 'true';
  }

  const parsed = permissionsSchema.safeParse({ userId, permissions });
  if (!parsed.success) {
    return { error: 'Form geçersiz' };
  }

  // Geçersiz key gönderildiyse sessiz filtrele (defensive — db'siz).
  const cleanPermissions: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(permissions)) {
    if (isValidPermissionKey(k)) cleanPermissions[k] = v;
  }

  const companyId = session.user.companyId;
  const actorId = session.user.id;
  // Faz 4B: target ownership + setBulkPermissions (tenant) TEK withTenant'ta (GUC).
  const outcome = await withTenant<
    { error: string } | { updatedCount: number; targetEmail: string }
  >(companyId, async (tx) => {
    const target = await tx
      .select({
        id: usersTable.id,
        role: usersTable.role,
        email: usersTable.email,
        companyId: usersTable.companyId,
      })
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.companyId, companyId)))
      .limit(1);
    if (target.length === 0) {
      return { error: 'Kullanıcı bulunamadı veya farklı tenant\'a ait' };
    }
    if (target[0].role !== 'STAFF') {
      return { error: 'Yetki yönetimi sadece Çalışan rolü için' };
    }
    const result = await setBulkPermissions(userId, cleanPermissions, actorId, tx);
    if (!result.ok) {
      return { error: 'Yetkiler güncellenemedi' };
    }
    return { updatedCount: result.updatedCount, targetEmail: target[0].email };
  });
  if ('error' in outcome) return { error: outcome.error };

  writeAuditLogAsync(
    {
      companyId,
      userId: actorId,
      action: 'user.permissions_updated',
      entityType: 'user',
      entityId: userId,
      afterState: {
        targetEmail: outcome.targetEmail,
        permissions: cleanPermissions,
        updatedCount: outcome.updatedCount,
      },
    },
    db,
  );

  revalidatePath('/admin/settings/users');
  return { ok: true, updatedCount: outcome.updatedCount };
}

/**
 * Yetki modal'ı açılırken çağrılır — kullanıcının mevcut permission key'lerini döner.
 * Server-side render (`/admin/settings/users` page'ten import edilir).
 */
export async function fetchUserPermissionsForModal(
  targetUserId: string,
): Promise<readonly string[]> {
  const session = await auth();
  if (!session?.user?.companyId) return [];
  if (session.user.role !== 'BAYI_SAHIBI' && session.user.role !== 'SUPERADMIN') {
    return [];
  }
  // Tenant ownership check + permission fetch TEK withTenant'ta (GUC).
  const companyId = session.user.companyId;
  return withTenant(companyId, async (tx) => {
    const target = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(eq(usersTable.id, targetUserId), eq(usersTable.companyId, companyId)),
      )
      .limit(1);
    if (target.length === 0) return [];
    return getUserPermissions(targetUserId, tx);
  });
}
