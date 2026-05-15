/**
 * Reset Password — yeni şifre belirleme (Sprint 2.4)
 *
 * Akış (EKRAN-AUTH §5.4):
 *   1. Token validation (Zod schema)
 *   2. users WHERE passwordResetToken=$1
 *      • Bulunamadı → invalid_token
 *      • Süresi dolmuş → expired
 *   3. HIBP + strength check (validateNewPassword)
 *   4. Transaction:
 *      - UPDATE users SET passwordHash=bcrypt(new), passwordResetToken=NULL,
 *        passwordResetExpiresAt=NULL, failedLoginCount=0, lockedUntil=NULL, updatedAt=NOW
 *      - (Sprint 9+) sessions tablosu invalidate — şu an schema yok, TODO note
 *   5. Brevo bilgilendirme email gönder
 *
 * Dependency injection: db parametre olarak.
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { hashPassword, validateNewPassword } from './password';
import { verifyResetToken } from './password-reset';
import { sendBrevoEmail } from '@/lib/brevo/client';
import { buildPasswordChangedTemplate } from '@/lib/brevo/templates';
import type { DbClient } from '@/lib/db/client';
import { users } from '@/db/schema';

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Geçersiz sıfırlama bağlantısı').max(200),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
});

export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export type ResetPasswordResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: 'invalid_token' | 'expired' | 'weak_password' | 'unknown'; issues?: string[] };

export interface ResetPasswordContext {
  ipAddress?: string | null;
}

/**
 * Şifre sıfırlama tamamla.
 *
 * @returns ok=true ile userId+email (caller redirect için), ya da ok=false + reason
 */
export async function completePasswordReset(
  input: ResetPasswordInput,
  db: DbClient,
  ctx: ResetPasswordContext = {},
): Promise<ResetPasswordResult> {
  // 1. Input validation
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'weak_password',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const { token, password } = parsed.data;

  // 2. DB lookup token
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordResetToken: users.passwordResetToken,
      passwordResetExpiresAt: users.passwordResetExpiresAt,
    })
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);

  const user = rows[0];

  if (!user) {
    return { ok: false, reason: 'invalid_token' };
  }

  // 3. Token expiry + timing-safe check
  const verifyResult = verifyResetToken(
    {
      passwordResetToken: user.passwordResetToken,
      passwordResetExpiresAt: user.passwordResetExpiresAt,
    },
    token,
  );

  if (!verifyResult.ok) {
    return { ok: false, reason: verifyResult.reason };
  }

  // 4. Yeni şifre güçlülük + HIBP
  const passwordCheck = await validateNewPassword(password);
  if (!passwordCheck.ok) {
    return { ok: false, reason: 'weak_password', issues: passwordCheck.issues };
  }

  // 5. Hash + DB güncelle
  const passwordHash = await hashPassword(password);
  const now = new Date();

  try {
    await db
      .update(users)
      .set({
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // TODO Sprint 9+ (sessions tablosu eklenince): bu user'ın tüm açık session'larını
    // DELETE et — "şifre değiştiğinde tüm cihazlar kapanır" UX.

    // 6. Bilgilendirme email — fail durumunda warn, success state'i değiştirme
    const template = buildPasswordChangedTemplate({
      userName: null, // Sprint 2.6'da user.name dolunca buradan geçer
      changedAt: now,
      ipAddress: ctx.ipAddress ?? null,
    });

    try {
      await sendBrevoEmail({
        to: { email: user.email },
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        tags: ['password-reset', 'completed'],
      });
    } catch (err) {
      console.warn(`[reset-password] Brevo bilgilendirme hatası user=${user.id}:`, err);
    }

    return { ok: true, userId: user.id, email: user.email };
  } catch (err) {
    console.error(`[reset-password] DB update hatası user=${user.id}:`, err);
    return { ok: false, reason: 'unknown' };
  }
}
