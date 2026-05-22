'use server';

import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { signIn } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies, storefrontSettings } from '@/db/schema';
import { cookies } from 'next/headers';
import { IMPERSONATE_COOKIE_NAME } from '@/lib/superadmin/impersonate';

/**
 * Staging demo bayi admin (pet shop yönetim) paneli auto-login.
 *
 * Mockup ziyaretçisi için akış:
 *   1. SUPERADMIN demo hesabıyla signIn (env'den)
 *   2. DB'den onaylı + aktif vitrin'li ilk tenant'ı çek
 *   3. Impersonation cookie set (o tenant'a "gir")
 *   4. /admin'e redirect → bayi pano + mock data (stok, vitrin, raporlar)
 *
 * Sadece NEXT_PUBLIC_STAGING_MODE=true iken çalışır. Production'da no-op.
 *
 * Env:
 *   STAGING_DEMO_EMAIL=claude@petstockpro.local
 *   STAGING_DEMO_PASSWORD=Test1234!
 */
export async function stagingDemoLoginAction(): Promise<void> {
  if (process.env.NEXT_PUBLIC_STAGING_MODE !== 'true') {
    redirect('/' as never);
  }

  const email = process.env.STAGING_DEMO_EMAIL;
  const password = process.env.STAGING_DEMO_PASSWORD;
  if (!email || !password) {
    redirect('/yapim-asamasinda' as never);
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

  // Impersonate edilecek demo tenant — onaylı vitrin'li ilk pet shop
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

  if (demoTenant) {
    const cookieStore = await cookies();
    cookieStore.set(IMPERSONATE_COOKIE_NAME, demoTenant.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
  }

  // Bayi paneline yönlendir — impersonation cookie ile o tenant'ın panosu
  redirect('/admin' as never);
}
