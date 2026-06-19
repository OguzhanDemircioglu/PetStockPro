import { notFound, redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { withTenant } from '@/lib/db/with-tenant';
import { districts } from '@/db/schema';
import { getCompanyProfile } from '@/lib/company/settings';
import { getAllCities } from '@/lib/cache/request-scoped';
import { SettingsShell } from '@/components/settings-shell';
import { CompanyForm } from './company-form';

export default async function CompanySettingsPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);
  const companyId = session.user.companyId;

  const profile = await withTenant(companyId, (tx) => getCompanyProfile(companyId, tx));
  if (!profile) notFound();

  // 2026-05-22 Tur 7 YT7-6: getAllCities (unstable_cache 24h)
  const cityList = await getAllCities();

  const districtList = profile.cityId
    ? await db
        .select({ id: districts.id, name: districts.name })
        .from(districts)
        .where(eq(districts.cityId, profile.cityId))
        .orderBy(asc(districts.name))
    : [];

  return (
    <SettingsShell
      current="company"
      title="Firma bilgileri"
      description={`${profile.name} · Plan ${profile.plan}`}
    >
      <div className="flex max-w-2xl flex-col gap-6">
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
            locationLat: profile.locationLat,
            locationLng: profile.locationLng,
          }}
          cities={cityList}
          initialDistricts={districtList}
        />
      </div>
    </SettingsShell>
  );
}
