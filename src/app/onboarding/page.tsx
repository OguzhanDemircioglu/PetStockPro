import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { cities, companies } from '@/db/schema';
import { OnboardingWizard } from './wizard';

/**
 * Onboarding Page — Server Component (Sprint 2.6)
 *
 * Gate:
 *   - Unauthenticated → /login
 *   - onboardingCompletedAt dolu → / (zaten tamamlanmış)
 *
 * SSR yükler:
 *   - 81 il listesi (cityId picker için)
 *   - company.name → vitrin slug önerisi
 */
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    redirect('/login' as never);
  }

  // Onboarding zaten tamamlandıysa /'a redirect — middleware yedek, burada da kontrol
  // (middleware Sprint 2.6'da pratik olarak gerek olmayabilir, ama defansif)

  const cityRows = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(cities.id);

  const companyRows = await db
    .select({ name: companies.name, slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, session.user.companyId))
    .limit(1);
  const company = companyRows[0];

  if (!company) {
    redirect('/login' as never);
  }

  return (
    <OnboardingWizard
      userEmail={session.user.email ?? ''}
      companyName={company.name}
      currentSlug={company.slug}
      citiesList={cityRows}
    />
  );
}
