/**
 * Forgot Password — şifre sıfırlama isteği (Sprint 2.4)
 *
 * Akış (EKRAN-AUTH §5.2):
 *   1. Email lookup (case-insensitive)
 *   2. Email enumeration koruma — var/yok ayrımı yapılmaz, dış dünyaya aynı 200 OK
 *   3. Email varsa: createResetToken → UPDATE users → Brevo email gönder
 *   4. Email yoksa: hiçbir şey yapma (audit log dahi tutulmaz — saldırıya iz vermemek için)
 *
 * Dependency injection: db parametre olarak — test'te mock'lanır.
 * Brevo SDK'sı module-level import — register pattern'ı ile aynı (vi.mock ile mocklanır).
 */

import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createResetToken } from './password-reset';
import { sendBrevoEmail } from '@/lib/brevo/client';
import { buildResetPasswordTemplate } from '@/lib/brevo/templates';
import type { DbClient } from '@/lib/db/client';
import { users } from '@/db/schema';

export const forgotPasswordSchema = z.object({
  email: z.string().email('Geçersiz e-posta').toLowerCase(),
});

export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export interface ForgotPasswordResult {
  /** Dış dünyaya her durumda true — enumeration koruma. */
  ok: true;
  /** Internal: gerçekten email gönderildi mi? Test/audit için (response'a dahil edilmez). */
  emailSent: boolean;
  /** Internal: input validation hatası (HTTP 400 — bilgi sızdırmaz). */
  validationIssue?: string;
}

/**
 * Şifre sıfırlama isteği — enumeration koruma ile.
 *
 * @returns Her zaman ok=true (dış dünyaya generic 200). `emailSent` field
 *          internal telemetry için — response body'sine yazılmaz.
 */
export async function requestPasswordReset(
  input: ForgotPasswordInput,
  db: DbClient,
): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: true,
      emailSent: false,
      validationIssue: parsed.error.issues.map((i) => i.message).join(' · '),
    };
  }

  const { email } = parsed.data;

  // Email lookup — case-insensitive (lower())
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);

  const user = rows[0];

  if (!user) {
    // ENUMERATION KORUMA: aynı timing'i koruma için kısa yapay gecikme
    // (gerçek lookup ~5-20ms; bizim case'de hızlı dön)
    return { ok: true, emailSent: false };
  }

  // Token üret + DB'ye yaz
  const now = new Date();
  const tokenResult = createResetToken(now);

  await db
    .update(users)
    .set({
      passwordResetToken: tokenResult.token,
      passwordResetExpiresAt: tokenResult.expiresAt,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  // Brevo email gönder — fail durumunda swallow (kullanıcıya enumeration sızdırma)
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/reset-password/${tokenResult.token}`;
  const template = buildResetPasswordTemplate({
    userName: user.name,
    resetUrl,
    expiresInMinutes: 30,
  });

  try {
    await sendBrevoEmail({
      to: { email: user.email },
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      tags: ['password-reset', 'request'],
    });
    return { ok: true, emailSent: true };
  } catch (err) {
    console.warn(`[forgot-password] Brevo gönderim hatası user=${user.id}:`, err);
    return { ok: true, emailSent: false };
  }
}
