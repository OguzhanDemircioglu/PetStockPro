/**
 * Süperadmin uzak kullanıcı yönetimi — Sprint 7c.
 *
 * 3 ana aksiyon (operasyonel destek için):
 *   1. forcePasswordResetLink — kullanıcıya şifre reset linki gönder (Brevo).
 *      Kullanıcının kendi /forgot-password ile yapabileceği şey ama
 *      kullanıcı email'ine erişim kaybetmişse / spam'e gidiyorsa
 *      süperadmin manuel tetikler.
 *
 *   2. resetTwoFactor — 2FA'yı kapat + secret/recoveryCodes temizle.
 *      Kullanıcı telefonunu kaybetti, recovery code'larını da kaybetti
 *      → giriş yapamıyor. Süperadmin reset eder, kullanıcı login olur
 *      ve yeniden setup yapar. KRITIK: Telegram alert.
 *
 *   3. lockAccount / unlockAccount — lockedUntil + lockedReason set/clear.
 *      Şüpheli aktivite veya destek talebi üzerine geçici askıya alma.
 *
 * Tüm aksiyonlar:
 *   • Hedef user başka tenant olabilir (süperadmin tüm tenantlara yetkili)
 *   • Telegram alert fire-and-forget
 *   • Audit log yazımı caller (action layer) yapar
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import { users, companies } from '@/db/schema';
import { createResetToken } from '@/lib/auth/password-reset';
import { sendBrevoEmail } from '@/lib/brevo/client';
import { buildResetPasswordTemplate } from '@/lib/brevo/templates';
import { sendTelegramAlert } from '@/lib/telegram/client';
import {
  buildRemotePasswordResetAlert,
  buildRemoteTwoFactorResetAlert,
  buildRemoteAccountLockAlert,
} from '@/lib/telegram/messages';

// ══════════════════════════════════════════════════════════════
// 1. Force password reset link
// ══════════════════════════════════════════════════════════════

export const forcePasswordResetSchema = z.object({
  targetUserId: z.string().uuid('Hedef kullanıcı UUID geçersiz'),
});
export type ForcePasswordResetInput = z.input<typeof forcePasswordResetSchema>;

export type ForcePasswordResetResult =
  | {
      ok: true;
      targetEmail: string;
      targetCompanyName: string | null;
      emailSent: boolean;
      tokenExpiresAt: Date;
    }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'unknown' };

interface RemoteActionTelemetry {
  superadminEmail: string;
  reason: string;
}

export async function forcePasswordResetLink(
  input: ForcePasswordResetInput,
  telemetry: RemoteActionTelemetry,
  db: DbClient,
  now: Date = new Date(),
): Promise<ForcePasswordResetResult> {
  const parsed = forcePasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      companyName: companies.name,
    })
    .from(users)
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, parsed.data.targetUserId))
    .limit(1);
  const target = rows[0];
  if (!target) return { ok: false, reason: 'not_found' };

  const tokenResult = createResetToken(now);

  try {
    await db
      .update(users)
      .set({
        passwordResetToken: tokenResult.token,
        passwordResetExpiresAt: tokenResult.expiresAt,
        updatedAt: now,
      })
      .where(eq(users.id, target.id));
  } catch {
    return { ok: false, reason: 'unknown' };
  }

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/reset-password/${tokenResult.token}`;
  const template = buildResetPasswordTemplate({
    userName: target.name,
    resetUrl,
    expiresInMinutes: 30,
  });

  let emailSent = false;
  try {
    await sendBrevoEmail({
      to: { email: target.email },
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      tags: ['password-reset', 'superadmin-force'],
    });
    emailSent = true;
  } catch (err) {
    console.warn(`[remote-user] Brevo gönderim hatası target=${target.id}:`, err);
  }

  // Telegram alert fire-and-forget
  void sendTelegramAlert(
    buildRemotePasswordResetAlert({
      superadminEmail: telemetry.superadminEmail,
      targetEmail: target.email,
      targetCompanyName: target.companyName,
      reason: telemetry.reason,
    }),
  ).catch(() => {});

  return {
    ok: true,
    targetEmail: target.email,
    targetCompanyName: target.companyName,
    emailSent,
    tokenExpiresAt: tokenResult.expiresAt,
  };
}

// ══════════════════════════════════════════════════════════════
// 2. Reset 2FA
// ══════════════════════════════════════════════════════════════

export const resetTwoFactorSchema = z.object({
  targetUserId: z.string().uuid('Hedef kullanıcı UUID geçersiz'),
});
export type ResetTwoFactorInput = z.input<typeof resetTwoFactorSchema>;

export type ResetTwoFactorResult =
  | {
      ok: true;
      targetEmail: string;
      targetCompanyName: string | null;
      wasEnabled: boolean;
    }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'not_enabled' }
  | { ok: false; reason: 'unknown' };

export async function resetTwoFactor(
  input: ResetTwoFactorInput,
  telemetry: RemoteActionTelemetry,
  db: DbClient,
  now: Date = new Date(),
): Promise<ResetTwoFactorResult> {
  const parsed = resetTwoFactorSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      twoFactorEnabled: users.twoFactorEnabled,
      companyName: companies.name,
    })
    .from(users)
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, parsed.data.targetUserId))
    .limit(1);
  const target = rows[0];
  if (!target) return { ok: false, reason: 'not_found' };
  if (!target.twoFactorEnabled) {
    return { ok: false, reason: 'not_enabled' };
  }

  try {
    await db
      .update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: null,
        twoFactorEnabledAt: null,
        twoFactorSetupSecret: null,
        twoFactorSetupExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(users.id, target.id));
  } catch {
    return { ok: false, reason: 'unknown' };
  }

  void sendTelegramAlert(
    buildRemoteTwoFactorResetAlert({
      superadminEmail: telemetry.superadminEmail,
      targetEmail: target.email,
      targetCompanyName: target.companyName,
      reason: telemetry.reason,
    }),
  ).catch(() => {});

  return {
    ok: true,
    targetEmail: target.email,
    targetCompanyName: target.companyName,
    wasEnabled: true,
  };
}

// ══════════════════════════════════════════════════════════════
// 3. Lock / Unlock account
// ══════════════════════════════════════════════════════════════

export const lockAccountSchema = z.object({
  targetUserId: z.string().uuid('Hedef kullanıcı UUID geçersiz'),
  hours: z.number().int().min(1).max(720), // 1 saat - 30 gün
});
export type LockAccountInput = z.input<typeof lockAccountSchema>;

export type LockAccountResult =
  | {
      ok: true;
      targetEmail: string;
      targetCompanyName: string | null;
      lockedUntil: Date;
      hours: number;
    }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'unknown' };

export async function lockAccount(
  input: LockAccountInput,
  telemetry: RemoteActionTelemetry,
  db: DbClient,
  now: Date = new Date(),
): Promise<LockAccountResult> {
  const parsed = lockAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const { targetUserId, hours } = parsed.data;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      companyName: companies.name,
    })
    .from(users)
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, targetUserId))
    .limit(1);
  const target = rows[0];
  if (!target) return { ok: false, reason: 'not_found' };

  const lockedUntil = new Date(now.getTime() + hours * 60 * 60 * 1000);

  try {
    await db
      .update(users)
      .set({
        lockedUntil,
        lockedReason: 'SUPERADMIN',
        lastLockedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, target.id));
  } catch {
    return { ok: false, reason: 'unknown' };
  }

  void sendTelegramAlert(
    buildRemoteAccountLockAlert({
      action: 'lock',
      lockHours: hours,
      superadminEmail: telemetry.superadminEmail,
      targetEmail: target.email,
      targetCompanyName: target.companyName,
      reason: telemetry.reason,
    }),
  ).catch(() => {});

  return {
    ok: true,
    targetEmail: target.email,
    targetCompanyName: target.companyName,
    lockedUntil,
    hours,
  };
}

export const unlockAccountSchema = z.object({
  targetUserId: z.string().uuid('Hedef kullanıcı UUID geçersiz'),
});
export type UnlockAccountInput = z.input<typeof unlockAccountSchema>;

export type UnlockAccountResult =
  | {
      ok: true;
      targetEmail: string;
      targetCompanyName: string | null;
      wasLocked: boolean;
    }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'unknown' };

export async function unlockAccount(
  input: UnlockAccountInput,
  telemetry: RemoteActionTelemetry,
  db: DbClient,
  now: Date = new Date(),
): Promise<UnlockAccountResult> {
  const parsed = unlockAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      lockedUntil: users.lockedUntil,
      companyName: companies.name,
    })
    .from(users)
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, parsed.data.targetUserId))
    .limit(1);
  const target = rows[0];
  if (!target) return { ok: false, reason: 'not_found' };

  const wasLocked = !!target.lockedUntil && new Date(target.lockedUntil).getTime() > now.getTime();

  try {
    await db
      .update(users)
      .set({
        lockedUntil: null,
        lockedReason: null,
        failedLoginCount: 0,
        recentLockCount: 0,
        updatedAt: now,
      })
      .where(eq(users.id, target.id));
  } catch {
    return { ok: false, reason: 'unknown' };
  }

  void sendTelegramAlert(
    buildRemoteAccountLockAlert({
      action: 'unlock',
      superadminEmail: telemetry.superadminEmail,
      targetEmail: target.email,
      targetCompanyName: target.companyName,
      reason: telemetry.reason,
    }),
  ).catch(() => {});

  return {
    ok: true,
    targetEmail: target.email,
    targetCompanyName: target.companyName,
    wasLocked,
  };
}
