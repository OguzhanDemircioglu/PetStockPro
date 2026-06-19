import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { withTenant } from '@/lib/db/with-tenant';
import { districts } from '@/db/schema';
import { getBranchDetail } from '@/lib/branches/manage';
import { getAllCities } from '@/lib/cache/request-scoped';
import { BranchForm } from '../../branch-form';
import { updateBranchAction } from '../../actions';
import { BranchStatusControl } from '../../branch-status-control';

export default async function EditBranchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);
  const companyId = session.user.companyId;

  const branch = await withTenant(companyId, (tx) => getBranchDetail(companyId, id, tx));
  if (!branch) notFound();

  // 2026-05-22 Tur 7 YT7-6: getAllCities (unstable_cache 24h)
  const cityList = await getAllCities();

  const districtList = branch.cityId
    ? await db
        .select({ id: districts.id, name: districts.name })
        .from(districts)
        .where(eq(districts.cityId, branch.cityId))
        .orderBy(asc(districts.name))
    : [];

  const boundUpdate = updateBranchAction.bind(null, id);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link href={'/admin/branches' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Şubelere dön
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Şube düzenle
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          {branch.name}
        </h1>
      </header>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-3">
          Şube durumu
        </h2>
        <p className="mt-1 text-[12.5px] text-ink-4">
          Tatil moduna alma anında uygulanır. Pasifleştirme onay ister
          (geri alınabilir).
        </p>
        <div className="mt-4">
          <BranchStatusControl
            branchId={branch.id}
            currentStatus={branch.status}
            variant="radio"
          />
        </div>
      </section>

      <BranchForm
        action={boundUpdate}
        cities={cityList}
        initialDistricts={districtList}
        initial={{
          name: branch.name,
          cityId: branch.cityId,
          districtId: branch.districtId,
          address: branch.address,
          whatsappPhone: branch.whatsappPhone,
        }}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}
