import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { cities, districts } from '@/db/schema';
import { getCompanyProfile } from '@/lib/company/settings';
import { CompanyForm } from './company-form';

export default async function CompanySettingsPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const profile = await getCompanyProfile(session.user.companyId, db);
  if (!profile) notFound();

  const cityList = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(asc(cities.name));

  const districtList = profile.cityId
    ? await db
        .select({ id: districts.id, name: districts.name })
        .from(districts)
        .where(eq(districts.cityId, profile.cityId))
        .orderBy(asc(districts.name))
    : [];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
          Admin · Ayarlar
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Firma bilgileri
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          {profile.name} · Plan{' '}
          <span className="rounded bg-cat-soft px-1.5 py-0.5 text-[10px] font-bold text-cart">
            {profile.plan}
          </span>
        </p>
      </header>

      {!profile.vatNo && (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger-7"
        >
          ⚠ <strong>Vergi numarası eksik.</strong> Ürünleri vitrin&apos;de
          yayınlamak için VKN veya TC kimlik numarası zorunlu.
        </div>
      )}

      <CompanyForm
        initial={{
          name: profile.name,
          vatNo: profile.vatNo,
          whatsappPhone: profile.whatsappPhone,
          cityId: profile.cityId,
          districtId: profile.districtId,
        }}
        cities={cityList}
        initialDistricts={districtList}
      />

      <Link
        href={'/' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Panele dön
      </Link>
    </main>
  );
}
