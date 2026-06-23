import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies } from '@/db/schema';
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

  // ⚠ max:1 Supabase pooler (Fluid Compute): eşzamanlı (Promise.all) DB okuması
  // bağlantı çekişmesi + statement timeout → istek "-" statüde takılıp ekran
  // kararıyordu (admin layout ile aynı ders, commit a5ef400). Çözüm: SIRALI okuma.
  // Ayrıca countCatalogBrands kaldırıldı — Migration 0026'dan beri brands GLOBAL,
  // catalogBrandCount wizard'da kullanılmıyor (gereksiz COUNT DISTINCT query'di).
  // getAllCities defansif: takılırsa boş listeye düş, sayfa yine de render olsun.
  const cityRows = await getAllCities().catch(
    () => [] as Awaited<ReturnType<typeof getAllCities>>,
  );

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
      catalogBrandCount={0}
    />
  );
}
