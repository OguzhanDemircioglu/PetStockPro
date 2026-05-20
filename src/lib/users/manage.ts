/**
 * Tenant user yönetimi — Sprint 9.
 *
 * BAYI_SAHIBI bir tenant'a yeni kullanıcı davet edebilir (SUBE_MUDURU veya STAFF).
 * Davet yöntemi: **sadece LINK** (2026-05-20 karar revizyonu — email kaldırıldı).
 *   - 24 saat TTL token üretilir
 *   - Admin elden iletir (WhatsApp / kopya-yapıştır)
 *   - Brevo email gönderilmez (gereksiz dış servis, admin zaten kullanıcıyla iletişimde)
 *
 * Şube müdürü constraint (2026-05-20):
 *   - SUBE_MUDURU rolü için branchId ZORUNLU
 *   - Bir şube = 1 müdür (DB-level unique index + runtime check)
 *   - STAFF için branchId opsiyonel
 *
 * Token mekanizması: mevcut passwordResetToken/passwordResetExpiresAt
 * field'larını reuse — kullanıcı /accept-invite/[token] sayfasında şifre belirler.
 */

import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import { users, branches } from '@/db/schema';
import { createResetToken } from '@/lib/auth/password-reset';

export const ROLE_VALUES = ['SUBE_MUDURU', 'STAFF'] as const;
export type InviteRole = (typeof ROLE_VALUES)[number];

/** Davet TTL — link yöntemiyle 24 saat. */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export const ROLE_LABELS: Record<InviteRole, string> = {
  SUBE_MUDURU: 'Şube Müdürü',
  STAFF: 'Kasiyer (STAFF)',
};

export const inviteUserSchema = z
  .object({
    email: z.string().email('Geçersiz email').toLowerCase(),
    role: z.enum(ROLE_VALUES),
    name: z.string().max(120).optional(),
    branchId: z.string().uuid('Geçersiz şube id').nullable().optional(),
  })
  .refine(
    (v) => v.role !== 'SUBE_MUDURU' || (v.branchId && v.branchId.length > 0),
    { message: 'Şube Müdürü için şube seçimi zorunlu', path: ['branchId'] },
  );
export type InviteUserInput = z.input<typeof inviteUserSchema>;

export type InviteUserResult =
  | {
      ok: true;
      userId: string;
      email: string;
      token: string;
      acceptUrl: string;
      expiresAt: Date;
    }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'email_already_exists' }
  | { ok: false; reason: 'branch_not_found' }
  | { ok: false; reason: 'branch_already_has_manager' }
  | { ok: false; reason: 'unknown' };

export async function inviteUser(
  companyId: string,
  inviterUserId: string,
  input: InviteUserInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<InviteUserResult> {
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;
  const branchIdValue = data.branchId ?? null;

  // Email çakışma kontrol (case-insensitive)
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, data.email))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, reason: 'email_already_exists' };
  }

  // Branch ownership + sube-müdürü constraint (SUBE_MUDURU rolü için)
  if (data.role === 'SUBE_MUDURU' && branchIdValue) {
    // 1. Branch tenant'a ait mi?
    const branchOwn = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchIdValue), eq(branches.companyId, companyId)))
      .limit(1);
    if (branchOwn.length === 0) {
      return { ok: false, reason: 'branch_not_found' };
    }
    // 2. Bu şubeye atanmış başka SUBE_MUDURU var mı? (1 şube = 1 müdür)
    const existingManager = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.branchId, branchIdValue),
          eq(users.role, 'SUBE_MUDURU'),
        ),
      )
      .limit(1);
    if (existingManager.length > 0) {
      return { ok: false, reason: 'branch_already_has_manager' };
    }
  }

  // STAFF + branchId opsiyonel — branch ownership check (verilmişse)
  if (data.role === 'STAFF' && branchIdValue) {
    const branchOwn = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchIdValue), eq(branches.companyId, companyId)))
      .limit(1);
    if (branchOwn.length === 0) {
      return { ok: false, reason: 'branch_not_found' };
    }
  }

  const tokenResult = createResetToken(now);
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  let newUserId: string;
  try {
    const inserted = await db
      .insert(users)
      .values({
        companyId,
        email: data.email,
        name: data.name ?? null,
        role: data.role,
        branchId: branchIdValue,
        inviteMethod: 'link', // her zaman link (legacy enum değeri korunur)
        invitedById: inviterUserId,
        passwordHash: null,
        emailVerifiedAt: null,
        passwordResetToken: tokenResult.token,
        passwordResetExpiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: users.id });
    newUserId = inserted[0].id;
  } catch (err) {
    // DB constraint violation (idx_users_one_sube_muduru_per_branch) — race
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      return { ok: false, reason: 'branch_already_has_manager' };
    }
    return { ok: false, reason: 'unknown' };
  }

  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/accept-invite/${tokenResult.token}`;

  return {
    ok: true,
    userId: newUserId,
    email: data.email,
    token: tokenResult.token,
    acceptUrl,
    expiresAt,
  };
}

// ══════════════════════════════════════════════════════════════
// listTenantUsers — kendi tenant'ının kullanıcılarını listele
// ══════════════════════════════════════════════════════════════

export interface TenantUserListItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  branchId: string | null;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  inviteMethod: string | null;
  invitedById: string | null;
  twoFactorEnabled: boolean;
  lockedUntil: Date | null;
  passwordResetExpiresAt: Date | null;
  createdAt: Date;
}

export async function listCompanyUsers(
  companyId: string,
  db: DbClient,
): Promise<TenantUserListItem[]> {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      branchId: users.branchId,
      emailVerifiedAt: users.emailVerifiedAt,
      passwordHash: users.passwordHash,
      inviteMethod: users.inviteMethod,
      invitedById: users.invitedById,
      twoFactorEnabled: users.twoFactorEnabled,
      lockedUntil: users.lockedUntil,
      passwordResetExpiresAt: users.passwordResetExpiresAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.companyId, companyId))
    .orderBy(users.createdAt);
}
