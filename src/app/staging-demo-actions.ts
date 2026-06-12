'use server';

import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { signIn } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies, storefrontSettings, users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';

/**
 * Demo bayi admin (pet shop yönetim) paneli auto-login — "Yönetim panelini
 * önizle" butonu (login/register hero + /yapim-asamasinda).
 *
 * Akış (gerçek BAYI_SAHIBI deneyimi — impersonation YOK):
 *   1. Demo BAYI_SAHIBI user'ı (STAGING_DEMO_BAYI_EMAIL) var mı?
 *   2. VARSA → her modda güvenle signIn (sabit demo tenant'ına bağlı).
 *   3. YOKSA → yalnız staging'de oluştur: onaylı + aktif vitrin'li ilk tenant'a
 *      bağla. (Güvenlik: production'da rastgele GERÇEK tenant'a bağlamamak için
 *      oluşturma staging-gated. Demo tenant lansman öncesi seed edilmeli.)
 *   4. signIn → /admin'e redirect.
 *
 * Env (staging):
 *   STAGING_DEMO_BAYI_EMAIL=demo-bayi@petstockpro.local (default)
 *   STAGING_DEMO_BAYI_PASSWORD=DemoBayi123! (default)
 */
const DEFAULT_DEMO_EMAIL = 'demo-bayi@petstockpro.local';
const DEFAULT_DEMO_PASSWORD = 'DemoBayi123!';

export async function stagingDemoLoginAction(): Promise<void> {
  const email = process.env.STAGING_DEMO_BAYI_EMAIL ?? DEFAULT_DEMO_EMAIL;
  const password = process.env.STAGING_DEMO_BAYI_PASSWORD ?? DEFAULT_DEMO_PASSWORD;

  // Demo BAYI_SAHIBI user'ı var mı?
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existingUser) {
    // Demo kullanıcı YOK → yalnız staging'de oluştur (production güvenliği).
    if (process.env.NEXT_PUBLIC_STAGING_MODE !== 'true') {
      redirect('/' as never);
    }

    // Demo tenant — onaylı + aktif vitrin'li, mock data dolu ilk pet shop
    const [demoTenant] = await db
      .select({ id: companies.id })
      .from(companies)
      .innerJoin(
        storefrontSettings,
        eq(storefrontSettings.companyId, companies.id),
      )
      .where(
        and(
          eq(companies.storefrontStatus, 'approved'),
          eq(storefrontSettings.isEnabled, true),
        ),
      )
      .limit(1);

    if (!demoTenant) {
      redirect('/yapim-asamasinda' as never);
    }

    const passwordHash = await hashPassword(password);
    await db.insert(users).values({
      email,
      passwordHash,
      role: 'BAYI_SAHIBI',
      companyId: demoTenant.id,
      name: 'Demo Bayi',
      emailVerifiedAt: new Date(),
      onboardingCompletedAt: new Date(),
      kvkkConsentedAt: new Date(),
    });
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
  } catch {
    redirect('/' as never);
  }

  // Demo bayi her açılışta kar yağışı default — Snowfall mount'ta bu
  // cookie'yi okur, localStorage'ı 'snow' yapar, cookie'yi siler.
  const cookieStore = await (await import('next/headers')).cookies();
  cookieStore.set('pp-force-snow', '1', {
    httpOnly: false, // client okuyabilmeli
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60, // tek seferlik (kısa)
  });

  redirect('/admin' as never);
}
