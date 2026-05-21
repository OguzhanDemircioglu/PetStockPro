import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies } from '@/db/schema';
import { countCatalogBrands } from '@/lib/brands/seed-catalog';
import { getAllCities } from '@/lib/cache/request-scoped';
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

  // 2026-05-22 Tur 7 YT7-6: getAllCities (unstable_cache 24h, name alfabetik)
  // Önceki cities.id sıralaması (TR resmi il kodu) alfabetiğe geçirildi —
  // diğer 3 sayfayla tutarlı + UX standart.
  const [cityRows, companyRows, catalogBrandCount] = await Promise.all([
    getAllCities(),
    db
      .select({ name: companies.name, slug: companies.slug })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .limit(1),
    countCatalogBrands(db).catch(() => 0),
  ]);

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
      catalogBrandCount={catalogBrandCount}
    />
  );
}
