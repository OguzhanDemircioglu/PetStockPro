/**
 * Email Change Orchestration — Sprint 2.9
 *
 * Akış (EKRAN-AUTH §6):
 *   1. initEmailChange(userId, newEmail, currentPassword) →
 *      • Password re-auth
 *      • Yeni email başka tenant'ta var mı kontrol
 *      • pendingEmail/Token/ExpiresAt set (24h TTL)
 *      • Eski email: "değişiklik isteği — iptal et" CTA
 *      • Yeni email: "doğrula" CTA
 *   2. verifyEmailChange(token) → email = pendingEmail, pendingEmail*=NULL
 *   3. cancelEmailChange(token) → pendingEmail*=NULL + Telegram süperadmin alert
 *      (sen değil de saldırgan değişiklik başlattıysa eski email sahibi iptal eder)
 *
 * Dependency injection — db parametre.
 */

import crypto from 'node:crypto';
import { eq, sql, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { verifyPassword } from './password';
import { sendBrevoEmail } from '@/lib/brevo/client';
import {
  buildEmailChangeRequestNewTemplate,
  buildEmailChangeNotifyOldTemplate,
  buildEmailChangedFinalTemplate,
} from '@/lib/brevo/templates';
import { sendTelegramAlert } from '@/lib/telegram/client';
import { buildEmailChangeCancelledAlert } from '@/lib/telegram/messages';
import type { DbClient } from '@/lib/db/client';
import { users, companies } from '@/db/schema';

export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat

function generateChangeToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// ─────────────────────────────────────────────────────────────────
// 1. INIT — pending email set + 2 email gönder
// ─────────────────────────────────────────────────────────────────

export const initEmailChangeSchema = z.object({
  newEmail: z.string().email('Geçerli bir e-posta gir').toLowerCase(),
  currentPassword: z.string().min(1, 'Şifre zorunlu'),
});

export type InitEmailChangeInput = z.input<typeof initEmailChangeSchema>;

export type InitEmailChangeResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_input' | 'wrong_password' | 'same_email' | 'taken' | 'unknown'; issues?: string[] };

export async function initEmailChange(
  userId: string,
  input: InitEmailChangeInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<InitEmailChangeResult> {
  const parsed = initEmailChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_input', issues: parsed.error.issues.map((i) => i.message) };
  }
  const { newEmail, currentPassword } = parsed.data;

  // User çek
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];

  if (!user || !user.passwordHash) {
    return { ok: false, reason: 'unknown' };
  }

  // Password re-auth
  const passwordOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!passwordOk) {
    return { ok: false, reason: 'wrong_password' };
  }

  // Same email?
  if (user.email === newEmail) {
    return { ok: false, reason: 'same_email' };
  }

  // Başka tenant'ta var mı? (kendi user'ı hariç, hem email hem pendingEmail check)
  const conflicts = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        ne(users.id, userId),
        sql`(${users.email} = ${newEmail} OR ${users.pendingEmail} = ${newEmail})`,
      ),
    )
    .limit(1);
  if (conflicts.length > 0) {
    return { ok: false, reason: 'taken' };
  }

  // Token üret + DB
  const token = generateChangeToken();
  const expiresAt = new Date(now.getTime() + EMAIL_CHANGE_TTL_MS);

  await db
    .update(users)
    .set({
      pendingEmail: newEmail,
      pendingEmailToken: token,
      pendingEmailExpiresAt: expiresAt,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/verify-email-change/${token}`;
  const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/cancel-email-change/${token}`;

  // YENİ email'e: doğrula CTA
  try {
    const newTemplate = buildEmailChangeRequestNewTemplate({
      verifyUrl,
      newEmail,
      currentEmail: user.email,
      expiresInHours: 24,
    });
    await sendBrevoEmail({
      to: { email: newEmail },
      subject: newTemplate.subject,
      htmlContent: newTemplate.htmlContent,
      textContent: newTemplate.textContent,
      tags: ['email-change', 'new-confirm'],
    });
  } catch (err) {
    console.warn(`[change-email] Brevo new-email send fail user=${userId}:`, err);
  }

  // ESKİ email'e: iptal et CTA
  try {
    const oldTemplate = buildEmailChangeNotifyOldTemplate({
      cancelUrl,
      newEmail,
      currentEmail: user.email,
    });
    await sendBrevoEmail({
      to: { email: user.email },
      subject: oldTemplate.subject,
      htmlContent: oldTemplate.htmlContent,
      textContent: oldTemplate.textContent,
      tags: ['email-change', 'old-notify'],
    });
  } catch (err) {
    console.warn(`[change-email] Brevo old-email notify fail user=${userId}:`, err);
  }

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// 2. VERIFY — yeni email doğrulandı, email değişikliği finalize
// ─────────────────────────────────────────────────────────────────

export type VerifyEmailChangeResult =
  | { ok: true; oldEmail: string; newEmail: string }
  | { ok: false; reason: 'invalid_token' | 'expired' | 'unknown' };

export async function verifyEmailChange(
  token: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<VerifyEmailChangeResult> {
  if (!token || token.length < 20) {
    return { ok: false, reason: 'invalid_token' };
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      pendingEmail: users.pendingEmail,
      pendingEmailExpiresAt: users.pendingEmailExpiresAt,
    })
    .from(users)
    .where(eq(users.pendingEmailToken, token))
    .limit(1);
  const user = rows[0];

  if (!user || !user.pendingEmail) {
    return { ok: false, reason: 'invalid_token' };
  }

  if (user.pendingEmailExpiresAt && user.pendingEmailExpiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  const oldEmail = user.email;
  const newEmail = user.pendingEmail;

  try {
    await db
      .update(users)
      .set({
        email: newEmail,
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // ESKİ email'e final bildirim (info, "değişiklik tamamlandı")
    try {
      const template = buildEmailChangedFinalTemplate({ oldEmail, newEmail });
      await sendBrevoEmail({
        to: { email: oldEmail },
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        tags: ['email-change', 'completed'],
      });
    } catch (err) {
      console.warn(`[change-email] Brevo final notify fail user=${user.id}:`, err);
    }

    return { ok: true, oldEmail, newEmail };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// 3. CANCEL — eski email "iptal et" tıkladı, Telegram alert
// ─────────────────────────────────────────────────────────────────

export type CancelEmailChangeResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'invalid_token' };

export async function cancelEmailChange(
  token: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<CancelEmailChangeResult> {
  if (!token || token.length < 20) {
    return { ok: false, reason: 'invalid_token' };
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      pendingEmail: users.pendingEmail,
      companyId: users.companyId,
    })
    .from(users)
    .where(eq(users.pendingEmailToken, token))
    .limit(1);
  const user = rows[0];

  if (!user) {
    return { ok: false, reason: 'invalid_token' };
  }

  await db
    .update(users)
    .set({
      pendingEmail: null,
      pendingEmailToken: null,
      pendingEmailExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  // Telegram süperadmin alert — hesap ele geçirme şüphesi
  try {
    let companyName: string | null = null;
    if (user.companyId) {
      const companyRows = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, user.companyId))
        .limit(1);
      companyName = companyRows[0]?.name ?? null;
    }
    await sendTelegramAlert(
      buildEmailChangeCancelledAlert({
        currentEmail: user.email,
        attemptedEmail: user.pendingEmail ?? '(bilinmiyor)',
        companyName,
      }),
    );
  } catch (err) {
    console.warn(`[change-email] Telegram cancel alert fail user=${user.id}:`, err);
  }

  return { ok: true, email: user.email };
}
