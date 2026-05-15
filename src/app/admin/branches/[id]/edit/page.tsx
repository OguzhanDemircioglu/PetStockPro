import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { cities, districts } from '@/db/schema';
import { getBranchDetail } from '@/lib/branches/manage';
import { BranchForm } from '../../branch-form';
import { updateBranchAction } from '../../actions';

export default async function EditBranchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const branch = await getBranchDetail(session.user.companyId, id, db);
  if (!branch) notFound();

  const cityList = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(asc(cities.name));

  const districtList = branch.cityId
    ? await db
        .select({ id: districts.id, name: districts.name })
        .from(districts)
        .where(eq(districts.cityId, branch.cityId))
        .orderBy(asc(districts.name))
    : [];

  const boundUpdate = updateBranchAction.bind(null, id);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/branches' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Şubelere dön
        </Link>
        <div className="mt-3 text-[11.5px] font-bold uppercase tracking-wider text-cat">
          Admin · Şube düzenle
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          {branch.name}
        </h1>
      </header>

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
