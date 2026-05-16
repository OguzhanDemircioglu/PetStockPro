/**
 * Tenant user yönetimi — Sprint 9.
 *
 * BAYI_SAHIBI bir tenant'a yeni kullanıcı davet edebilir (SUBE_MUDURU veya STAFF).
 * Hibrit davet (CLAUDE.md kararı 2026-05-14):
 *   📧 Email — Brevo SMTP 7 gün TTL — şube müdürü için
 *   🔗 Link — 24 saat TTL, admin elden iletir — STAFF kasiyer için
 *
 * Token mekanizması: mevcut passwordResetToken/passwordResetExpiresAt
 * field'larını reuse — kullanıcı /accept-invite/[token] sayfasında şifre
 * belirler. (Yeni invite_token field eklemek migration getirirdi; reuse
 * MVP yeterli, davet zaten password-belirleme akışı.)
 */

import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import { users, companies } from '@/db/schema';
import { createResetToken } from '@/lib/auth/password-reset';
import { sendBrevoEmail } from '@/lib/brevo/client';
import { buildUserInviteTemplate } from '@/lib/brevo/templates';

export const ROLE_VALUES = ['SUBE_MUDURU', 'STAFF'] as const;
export type InviteRole = (typeof ROLE_VALUES)[number];

export const INVITE_METHOD_VALUES = ['email', 'link'] as const;
export type InviteMethod = (typeof INVITE_METHOD_VALUES)[number];

export const INVITE_TTL_BY_METHOD: Record<InviteMethod, number> = {
  email: 7 * 24 * 60 * 60 * 1000, // 7 gün
  link: 24 * 60 * 60 * 1000, // 24 saat
};

export const ROLE_LABELS: Record<InviteRole, string> = {
  SUBE_MUDURU: 'Şube Müdürü',
  STAFF: 'Kasiyer (STAFF)',
};

export const inviteUserSchema = z.object({
  email: z.string().email('Geçersiz email').toLowerCase(),
  role: z.enum(ROLE_VALUES),
  method: z.enum(INVITE_METHOD_VALUES),
  name: z.string().max(120).optional(),
});
export type InviteUserInput = z.input<typeof inviteUserSchema>;

export type InviteUserResult =
  | {
      ok: true;
      userId: string;
      email: string;
      method: InviteMethod;
      token: string;
      acceptUrl: string;
      expiresAt: Date;
      emailSent?: boolean;
    }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'email_already_exists' }
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

  // Email çakışma kontrol (case-insensitive)
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, data.email))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, reason: 'email_already_exists' };
  }

  // Token TTL'i method'a göre override (createResetToken default 30dk, biz aslında
  // expiresAt'i manuel override edeceğiz)
  const tokenResult = createResetToken(now);
  const expiresAt = new Date(now.getTime() + INVITE_TTL_BY_METHOD[data.method]);

  // Tenant + inviter detayı (email içeriği için)
  const tenantRows = await db
    .select({
      companyName: companies.name,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const inviterRows = await db
    .select({ inviterName: users.name, inviterEmail: users.email })
    .from(users)
    .where(eq(users.id, inviterUserId))
    .limit(1);

  const companyName = tenantRows[0]?.companyName ?? 'Pet shop';
  const inviterName = inviterRows[0]?.inviterName ?? inviterRows[0]?.inviterEmail ?? 'Yönetici';

  let newUserId: string;
  try {
    const inserted = await db
      .insert(users)
      .values({
        companyId,
        email: data.email,
        name: data.name ?? null,
        role: data.role,
        inviteMethod: data.method,
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
  } catch {
    return { ok: false, reason: 'unknown' };
  }

  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/accept-invite/${tokenResult.token}`;

  if (data.method === 'email') {
    const template = buildUserInviteTemplate({
      inviteeName: data.name ?? null,
      inviterName,
      companyName,
      roleLabel: ROLE_LABELS[data.role],
      acceptUrl,
      expiresInDays: 7,
    });
    let emailSent = false;
    try {
      await sendBrevoEmail({
        to: { email: data.email, name: data.name ?? undefined },
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        tags: ['user-invite', data.method],
      });
      emailSent = true;
    } catch (err) {
      console.warn(`[invite] Brevo email fail user=${newUserId}:`, err);
    }
    return {
      ok: true,
      userId: newUserId,
      email: data.email,
      method: 'email',
      token: tokenResult.token,
      acceptUrl,
      expiresAt,
      emailSent,
    };
  }

  // method === 'link' — admin elden iletir, email gönderilmez
  return {
    ok: true,
    userId: newUserId,
    email: data.email,
    method: 'link',
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
