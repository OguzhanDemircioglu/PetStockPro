import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { users } from '@/db/schema';

/**
 * Base URL ("/") — yalnızca yönlendirici.
 *
 * Tanıtım/marketing landing + staging "hoş geldin" sayfası kaldırıldı
 * (2026-06-12 kullanıcı kararı). Login artık tek giriş kapısı; demo önizleme
 * login'in sol panelinde (sadece staging/lansman öncesi görünür).
 *
 *   - Giriş yapmış SUPERADMIN  → /admin/superadmin
 *   - Giriş yapmış (onboarding eksik) → /onboarding
 *   - Giriş yapmış diğer       → /admin
 *   - Anonim                   → /login
 */
export default async function Home() {
  const session = await auth();

  if (session?.user?.id) {
    if (session.user.role === 'SUPERADMIN') {
      redirect('/admin/superadmin' as never);
    }
    const rows = await db
      .select({ onboardingCompletedAt: users.onboardingCompletedAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (rows[0] && !rows[0].onboardingCompletedAt) {
      redirect('/onboarding' as never);
    }
    redirect('/admin' as never);
  }

  // Staging (lansman öncesi): anonim ziyaretçi login yapamaz → sadece mockup
  // önizleme (Bayi paneli + Vitrin) /yapim-asamasinda'da. Staging kapalıyken
  // (canlı) login tek giriş kapısı; buraya asla /yapim-asamasinda gelmez.
  if (process.env.NEXT_PUBLIC_STAGING_MODE === 'true') {
    redirect('/yapim-asamasinda' as never);
  }

  redirect('/login' as never);
}
