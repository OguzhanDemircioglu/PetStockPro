/**
 * Register Logic — yeni pet shop tenant oluşturma akışı
 *
 * Akış (EKRAN-AUTH.md §3):
 *   1. Zod validate (pet shop name + email + password + 2 KVKK consent)
 *   2. Password strength + HIBP check (validateNewPassword)
 *   3. Email zaten kayıtlı mı? — varsa hata (frontend "giriş yapmak ister misin" gösterir)
 *   4. Slug oluştur (tr_slug + çakışma için suffix retry)
 *   5. Drizzle transaction:
 *      - INSERT companies (name, slug, plan=FREE)
 *      - INSERT users (companyId, email, passwordHash, role=BAYI_SAHIBI, emailVerifiedAt=null, kvkkConsentedAt=now, dataLocationConsentedAt=now)
 *   6. Email verification token üret + DB'ye yaz (Sprint 2.3'te detay)
 *   7. Brevo ile verification email gönder (Sprint 2.3'te gerçek implementation)
 *
 * Dependency injection — db parametre olarak verilir → test'lerde mock'lanır.
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { hashPassword, validateNewPassword } from './password';
import { createVerificationToken } from './email-verification';
import { sendBrevoEmail } from '@/lib/brevo/client';
import { buildVerifyEmailTemplate } from '@/lib/brevo/templates';
import type { DbClient } from '@/lib/db/client';
import { companies, users } from '@/db/schema';

export const registerSchema = z.object({
  shopName: z.string().min(2, 'Pet shop adı en az 2 karakter').max(200),
  email: z.string().email('Geçersiz e-posta').toLowerCase(),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  kvkkConsent: z.literal(true, { message: 'KVKK aydınlatma onayı zorunlu' }),
  dataLocationConsent: z.literal(true, { message: 'AB veri lokasyonu açık rıza zorunlu' }),
});

export type RegisterInput = z.input<typeof registerSchema>;

export interface RegisterResult {
  ok: boolean;
  userId?: string;
  companyId?: string;
  issues?: string[];
}

/**
 * tr_slug helper — Türkçe slug üretimi.
 * DB'deki petstockpro.tr_slug() function ile aynı pattern.
 * Network round-trip yerine local hesaplama (slug çakışma kontrolü öncesi).
 */
function makeSlug(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90); // max 90, suffix için yer bırak
}

/**
 * Slug çakışmazsa orijinali döner; çakışırsa rastgele 4-haneli suffix ekler.
 * Race condition için tek-deneme yeterli (UUID benzeri çakışma olasılığı düşük).
 */
async function ensureUniqueSlug(baseSlug: string, db: DbClient): Promise<string> {
  const existing = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(eq(companies.slug, baseSlug))
    .limit(1);

  if (existing.length === 0) return baseSlug;

  // Çakışma → kısa rastgele suffix
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${baseSlug}-${suffix}`;
}

/**
 * Tüm register akışı tek noktadan.
 *
 * @returns ok=true + ids if başarılı, ok=false + issues if hata
 */
export async function registerNewTenant(
  input: RegisterInput,
  db: DbClient,
): Promise<RegisterResult> {
  // 1. Validate input shape
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // 2. Password strength + HIBP
  const passwordCheck = await validateNewPassword(data.password);
  if (!passwordCheck.ok) {
    return { ok: false, issues: passwordCheck.issues };
  }

  // 3. Email uniqueness — generic mesaj (enumeration koruma — register'da gerek
  // olmayabilir ama tutarlılık için yine de net mesaj)
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      ok: false,
      issues: ['Bu e-posta adresi zaten kayıtlı — giriş yapmayı dene'],
    };
  }

  // 4. Slug
  const baseSlug = makeSlug(data.shopName);
  if (baseSlug.length < 2) {
    return { ok: false, issues: ['Pet shop adı geçerli slug üretmiyor (en az 2 ASCII karakter)'] };
  }
  const slug = await ensureUniqueSlug(baseSlug, db);

  // 5. Password hash
  const passwordHash = await hashPassword(data.password);

  // 6. Email verification token (Sprint 2.3 — EKRAN-AUTH §4)
  const now = new Date();
  const verification = createVerificationToken(now);

  // 7. Transaction: company + user atomik (verification token user'a yazılır)
  try {
    const result = await db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companies)
        .values({
          name: data.shopName,
          slug,
          plan: 'FREE',
        })
        .returning({ id: companies.id });

      const [user] = await tx
        .insert(users)
        .values({
          companyId: company.id,
          email: data.email,
          passwordHash,
          role: 'BAYI_SAHIBI',
          emailVerifiedAt: null, // verify-email link'i ile set edilir
          kvkkConsentedAt: now,
          dataLocationConsentedAt: now,
          failedLoginCount: 0,
          emailVerificationToken: verification.token,
          emailVerificationExpiresAt: verification.expiresAt,
          emailVerificationResendCount: 1,
          emailVerificationLastSentAt: now,
        })
        .returning({ id: users.id });

      return { companyId: company.id, userId: user.id };
    });

    // 8. Brevo verification email (DB transaction sonrası — email fail user'ı silmesin)
    // Mock mode (no API key) → console.log fallback; production'da gerçek API.
    // Fail durumunda warn ama register başarılı sayılır (resend ile tekrar denenebilir).
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/verify-email/${verification.token}`;
    const template = buildVerifyEmailTemplate({
      userName: null, // Sprint 2.6 onboarding'te alınır
      verifyUrl,
      expiresInHours: 24,
    });

    try {
      await sendBrevoEmail({
        to: { email: data.email },
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        tags: ['verify-email', 'register'],
      });
    } catch (emailErr) {
      // Email gönderim hatası kullanıcıya bildirilmez — Sprint 2.3b resend ile çözer
      console.warn(`[register] Brevo gönderim hatası user=${result.userId}:`, emailErr);
    }

    return { ok: true, userId: result.userId, companyId: result.companyId };
  } catch {
    // DB constraint violation (email unique race condition, vs.) — generic mesaj
    return {
      ok: false,
      issues: ['Kayıt sırasında beklenmedik hata — tekrar dene'],
    };
  }
}

// Test export — slug helper
export { makeSlug as _makeSlugForTesting };
