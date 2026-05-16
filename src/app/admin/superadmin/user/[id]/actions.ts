'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { verifyBypassGuard, writeBypassAudit } from '@/lib/superadmin/bypass';
import {
  forcePasswordResetLink,
  resetTwoFactor,
  lockAccount,
  unlockAccount,
} from '@/lib/superadmin/user-actions';

export interface RemoteUserActionState {
  ok?: boolean;
  error?: string;
  issues?: string[];
  message?: string;
}

const baseFormFields = {
  targetUserId: z.string().uuid('Hedef kullanıcı UUID geçersiz'),
  superadminPassword: z.string().min(1, 'Şifre zorunlu'),
  reason: z.string().min(10, 'Sebep min 10 karakter'),
};

const passwordResetSchema = z.object(baseFormFields);
const twoFactorResetSchema = z.object(baseFormFields);
const lockSchema = z.object({
  ...baseFormFields,
  hours: z.coerce.number().int().min(1).max(720),
});
const unlockSchema = z.object(baseFormFields);

async function commonGuard(
  formData: FormData,
  reasonField: string,
): Promise<
  | { ok: true; superadminId: string; superadminCompanyId: string; superadminEmail: string; reason: string }
  | { ok: false; state: RemoteUserActionState }
> {
  await requireSuperadmin();
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId || !session.user.email) {
    redirect('/login' as never);
  }
  const reason = String(formData.get(reasonField) ?? '');
  const guard = await verifyBypassGuard(
    session.user.id,
    {
      superadminPassword: String(formData.get('superadminPassword') ?? ''),
      reason,
    },
    db,
  );
  if (!guard.ok) {
    if (guard.reason === 'invalid_reason') {
      return { ok: false, state: { error: 'Sebep geçersiz', issues: guard.issues } };
    }
    if (guard.reason === 'invalid_password') {
      return { ok: false, state: { error: 'Şifre yanlış — re-auth başarısız' } };
    }
    return { ok: false, state: { error: 'Süperadmin doğrulama başarısız' } };
  }
  return {
    ok: true,
    superadminId: session.user.id,
    superadminCompanyId: session.user.companyId,
    superadminEmail: session.user.email,
    reason,
  };
}

// ══════════════════════════════════════════════════════════════
// 1. Force password reset link
// ══════════════════════════════════════════════════════════════

export async function forcePasswordResetAction(
  _prev: RemoteUserActionState | null,
  formData: FormData,
): Promise<RemoteUserActionState> {
  const parsed = passwordResetSchema.safeParse({
    targetUserId: formData.get('targetUserId'),
    superadminPassword: formData.get('superadminPassword'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { error: 'Form geçersiz', issues: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;
  const guard = await commonGuard(formData, 'reason');
  if (!guard.ok) return guard.state;

  const result = await forcePasswordResetLink(
    { targetUserId: data.targetUserId },
    { superadminEmail: guard.superadminEmail, reason: data.reason },
    db,
  );

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: 'Lib validation hatası', issues: result.issues };
    }
    const messages: Record<string, string> = {
      not_found: 'Kullanıcı bulunamadı',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  await writeBypassAudit({
    companyId: guard.superadminCompanyId,
    superadminUserId: guard.superadminId,
    action: 'superadmin.remote.password_reset',
    entityType: 'user',
    entityId: data.targetUserId,
    reason: data.reason,
    afterState: {
      targetEmail: result.targetEmail,
      targetCompanyName: result.targetCompanyName,
      emailSent: result.emailSent,
      tokenExpiresAt: result.tokenExpiresAt.toISOString(),
    },
    db,
  });

  revalidatePath(`/admin/superadmin/user/${data.targetUserId}`);
  revalidatePath('/admin/audit-log');
  return {
    ok: true,
    message: result.emailSent
      ? `Sıfırlama linki ${result.targetEmail} adresine gönderildi (30 dk geçerli)`
      : `Token üretildi ama Brevo email gönderilemedi (logs'a bak) — hedef: ${result.targetEmail}`,
  };
}

// ══════════════════════════════════════════════════════════════
// 2. Reset 2FA
// ══════════════════════════════════════════════════════════════

export async function resetTwoFactorAction(
  _prev: RemoteUserActionState | null,
  formData: FormData,
): Promise<RemoteUserActionState> {
  const parsed = twoFactorResetSchema.safeParse({
    targetUserId: formData.get('targetUserId'),
    superadminPassword: formData.get('superadminPassword'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { error: 'Form geçersiz', issues: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;
  const guard = await commonGuard(formData, 'reason');
  if (!guard.ok) return guard.state;

  const result = await resetTwoFactor(
    { targetUserId: data.targetUserId },
    { superadminEmail: guard.superadminEmail, reason: data.reason },
    db,
  );

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: 'Lib validation hatası', issues: result.issues };
    }
    const messages: Record<string, string> = {
      not_found: 'Kullanıcı bulunamadı',
      not_enabled: '2FA zaten kapalı — reset gereksiz',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  await writeBypassAudit({
    companyId: guard.superadminCompanyId,
    superadminUserId: guard.superadminId,
    action: 'superadmin.remote.two_factor_reset',
    entityType: 'user',
    entityId: data.targetUserId,
    reason: data.reason,
    afterState: {
      targetEmail: result.targetEmail,
      targetCompanyName: result.targetCompanyName,
      wasEnabled: result.wasEnabled,
    },
    db,
  });

  revalidatePath(`/admin/superadmin/user/${data.targetUserId}`);
  revalidatePath('/admin/audit-log');
  return {
    ok: true,
    message: `${result.targetEmail} için 2FA sıfırlandı. Kullanıcı tekrar setup yapmalı.`,
  };
}

// ══════════════════════════════════════════════════════════════
// 3a. Lock account
// ══════════════════════════════════════════════════════════════

export async function lockAccountActionForm(
  _prev: RemoteUserActionState | null,
  formData: FormData,
): Promise<RemoteUserActionState> {
  const parsed = lockSchema.safeParse({
    targetUserId: formData.get('targetUserId'),
    superadminPassword: formData.get('superadminPassword'),
    reason: formData.get('reason'),
    hours: formData.get('hours'),
  });
  if (!parsed.success) {
    return { error: 'Form geçersiz', issues: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;
  const guard = await commonGuard(formData, 'reason');
  if (!guard.ok) return guard.state;

  const result = await lockAccount(
    { targetUserId: data.targetUserId, hours: data.hours },
    { superadminEmail: guard.superadminEmail, reason: data.reason },
    db,
  );

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: 'Lib validation hatası', issues: result.issues };
    }
    const messages: Record<string, string> = {
      not_found: 'Kullanıcı bulunamadı',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  await writeBypassAudit({
    companyId: guard.superadminCompanyId,
    superadminUserId: guard.superadminId,
    action: 'superadmin.remote.account_lock',
    entityType: 'user',
    entityId: data.targetUserId,
    reason: data.reason,
    afterState: {
      targetEmail: result.targetEmail,
      targetCompanyName: result.targetCompanyName,
      lockedUntil: result.lockedUntil.toISOString(),
      hours: result.hours,
    },
    db,
  });

  revalidatePath(`/admin/superadmin/user/${data.targetUserId}`);
  revalidatePath('/admin/audit-log');
  return {
    ok: true,
    message: `${result.targetEmail} hesabı ${result.hours} saat kilitlendi (${result.lockedUntil.toLocaleString('tr-TR')} kadar).`,
  };
}

// ══════════════════════════════════════════════════════════════
// 3b. Unlock account
// ══════════════════════════════════════════════════════════════

export async function unlockAccountActionForm(
  _prev: RemoteUserActionState | null,
  formData: FormData,
): Promise<RemoteUserActionState> {
  const parsed = unlockSchema.safeParse({
    targetUserId: formData.get('targetUserId'),
    superadminPassword: formData.get('superadminPassword'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { error: 'Form geçersiz', issues: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;
  const guard = await commonGuard(formData, 'reason');
  if (!guard.ok) return guard.state;

  const result = await unlockAccount(
    { targetUserId: data.targetUserId },
    { superadminEmail: guard.superadminEmail, reason: data.reason },
    db,
  );

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: 'Lib validation hatası', issues: result.issues };
    }
    const messages: Record<string, string> = {
      not_found: 'Kullanıcı bulunamadı',
      unknown: 'Bilinmeyen hata',
    };
    return { error: messages[result.reason] ?? 'Hata' };
  }

  await writeBypassAudit({
    companyId: guard.superadminCompanyId,
    superadminUserId: guard.superadminId,
    action: 'superadmin.remote.account_unlock',
    entityType: 'user',
    entityId: data.targetUserId,
    reason: data.reason,
    afterState: {
      targetEmail: result.targetEmail,
      targetCompanyName: result.targetCompanyName,
      wasLocked: result.wasLocked,
    },
    db,
  });

  revalidatePath(`/admin/superadmin/user/${data.targetUserId}`);
  revalidatePath('/admin/audit-log');
  return {
    ok: true,
    message: result.wasLocked
      ? `${result.targetEmail} hesap kilidi açıldı (aktif lock vardı, kaldırıldı).`
      : `${result.targetEmail} hesabı zaten kilitli değildi — yine de failed_login_count sıfırlandı.`,
  };
}
