'use server';

import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { signIn } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies, storefrontSettings, users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';

/**
 * Staging demo bayi admin (pet shop yönetim) paneli auto-login.
 *
 * Mockup ziyaretçisi için akış (gerçek BAYI_SAHIBI deneyimi — impersonation YOK):
 *   1. DB'den onaylı + aktif vitrin'li ilk tenant'ı çek (mock data dolu)
 *   2. O tenant'a bağlı BAYI_SAHIBI demo user'ı var mı kontrol et
 *   3. Yoksa: yarat (email = STAGING_DEMO_BAYI_EMAIL, password hash'i ile)
 *   4. signIn credentials ile bu hesaba gir
 *   5. /admin'e redirect → gerçek bayi pano, "Süperadmin'e dön" buton YOK
 *
 * Sadece NEXT_PUBLIC_STAGING_MODE=true iken çalışır. Production'da no-op.
 *
 * Env (staging):
 *   STAGING_DEMO_BAYI_EMAIL=demo-bayi@petstockpro.local (default)
 *   STAGING_DEMO_BAYI_PASSWORD=DemoBayi123! (default)
 */
const DEFAULT_DEMO_EMAIL = 'demo-bayi@petstockpro.local';
const DEFAULT_DEMO_PASSWORD = 'DemoBayi123!';

export async function stagingDemoLoginAction(): Promise<void> {
  if (process.env.NEXT_PUBLIC_STAGING_MODE !== 'true') {
    redirect('/' as never);
  }

  const email = process.env.STAGING_DEMO_BAYI_EMAIL ?? DEFAULT_DEMO_EMAIL;
  const password = process.env.STAGING_DEMO_BAYI_PASSWORD ?? DEFAULT_DEMO_PASSWORD;

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

  // Demo BAYI_SAHIBI user'ı var mı? Yoksa yarat (idempotent)
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existingUser) {
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
    redirect('/yapim-asamasinda' as never);
  }

  redirect('/admin' as never);
}
