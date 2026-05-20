import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { cities } from '@/db/schema';
import { BranchForm } from '../branch-form';
import { addBranchAction } from '../actions';
import { getBranchDetail } from '@/lib/branches/manage';
import { asc } from 'drizzle-orm';
import { Step2StaffInvite } from './step2-staff-invite';

/**
 * Faz 7 (2026-05-21) — Yeni şube wizard (2-step).
 *   Step 1: BranchForm (şube bilgileri)
 *   Step 2: "Çalışan ekle veya atla" (?step=2&branchId={id})
 *
 * Onboarding'deki ilk şube etkilenmez (orada ayrı firstBranchAction route).
 */
export default async function NewBranchPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; branchId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const params = await searchParams;
  const isStep2 =
    params.step === '2' && typeof params.branchId === 'string' && params.branchId.length > 0;

  if (isStep2) {
    const branch = await getBranchDetail(session.user.companyId, params.branchId!, db);
    if (!branch) redirect('/admin/branches' as never);

    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
        <header>
          <Link
            href={'/admin/branches' as never}
            className="text-xs text-ink-4 hover:text-cart"
          >
            ← Şubelere dön
          </Link>
          <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Yeni Şube · Çalışan ekle (Adım 2/2)
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            {branch.name} hazır
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            Şubeni başarıyla ekledin. Sırada (opsiyonel): bu şubeye bir çalışan davet et.
          </p>
        </header>

        <Step2StaffInvite branchId={branch.id} branchName={branch.name} />
      </main>
    );
  }

  // Step 1 — şube bilgileri formu (varsayılan)
  const cityList = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(asc(cities.name));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/branches' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Şubelere dön
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Yeni Şube · Bilgiler (Adım 1/2)
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Yeni şube ekle
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Çoklu şube transfer için + stok takip için kullanılır.
          Şubeyi ekledikten sonra opsiyonel olarak çalışan davet edebilirsin.
        </p>
      </header>

      <BranchForm
        action={addBranchAction}
        cities={cityList}
        submitLabel="Şubeyi ekle →"
      />
    </main>
  );
}
