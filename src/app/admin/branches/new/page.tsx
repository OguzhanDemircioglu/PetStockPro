import { redirect } from 'next/navigation';
import Link from 'next/link';
import { and, eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { branches, companies } from '@/db/schema';
import { getAllCities } from '@/lib/cache/request-scoped';
import {
  canAddBranch,
  getEffectiveBranchLimit,
} from '@/lib/billing/plan-features';
import { BranchForm } from '../branch-form';
import { addBranchAction } from '../actions';
import { getBranchDetail } from '@/lib/branches/manage';
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
  const companyId = session.user.companyId;

  const params = await searchParams;
  const isStep2 =
    params.step === '2' && typeof params.branchId === 'string' && params.branchId.length > 0;

  if (isStep2) {
    const branch = await withTenant(companyId, (tx) =>
      getBranchDetail(companyId, params.branchId!, tx),
    );
    if (!branch) redirect('/admin/branches' as never);

    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
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

  // 2026-05-22 Karar A revize — şube limit PRO upsell paneli
  // FREE plan tek şube; 2. şubeye eklemek isteyen kullanıcı banner görür.
  const [[companyRow], [branchCountRow]] = await withTenant(companyId, (tx) =>
    Promise.all([
      tx
        .select({
          plan: companies.plan,
          temporaryVitrinLimitOverride: companies.temporaryVitrinLimitOverride,
          temporaryVitrinLimitOverrideUntil: companies.temporaryVitrinLimitOverrideUntil,
          temporaryBranchLimitOverride: companies.temporaryBranchLimitOverride,
          temporaryBranchLimitOverrideUntil: companies.temporaryBranchLimitOverrideUntil,
        })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1),
      tx
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(branches)
        .where(
          and(
            eq(branches.companyId, companyId),
            sql`${branches.status} != 'inactive'`,
          ),
        ),
    ]),
  );
  const activeBranchCount = branchCountRow?.count ?? 0;
  const branchLimitCheck = companyRow
    ? canAddBranch(companyRow, activeBranchCount)
    : { ok: true as const };
  const effectiveBranchLimit = companyRow
    ? getEffectiveBranchLimit(companyRow)
    : Infinity;

  if (!branchLimitCheck.ok) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <header>
          <Link
            href={'/admin/branches' as never}
            className="text-xs text-ink-4 hover:text-cart"
          >
            ← Şubelere dön
          </Link>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-cart">
            Yeni şube ekle
          </h1>
        </header>
        <div className="rounded-2xl border-2 border-cat/40 bg-cat-soft/30 p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cat px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-white">
            ⭐ PRO Özelliği
          </div>
          <h2 className="text-xl font-bold text-cart">
            Çoklu şube PRO planında
          </h2>
          <p className="mt-3 text-sm text-ink-2">
            FREE planında <strong>1 şube</strong> ekleyebilirsin (mahalle pet shop
            için yeter). PRO planında <strong>sınırsız şube</strong> + şubeler arası
            transfer + şube-bazlı raporlar + her şubeye çalışan ataması.
          </p>
          <p className="mt-2 text-xs text-ink-4">
            Mevcut: {branchLimitCheck.count} / {branchLimitCheck.limit} şube
          </p>
          <div className="mt-5 flex gap-3">
            <Link
              href={'/admin/settings' as never}
              className="rounded-xl bg-cat px-5 py-2.5 text-sm font-bold text-white hover:bg-cat/90"
            >
              PRO&apos;ya geç →
            </Link>
            <Link
              href={'/admin/branches' as never}
              className="rounded-xl border border-line bg-paper px-5 py-2.5 text-sm font-bold text-cart hover:bg-cat-soft"
            >
              Şubelere dön
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Step 1 — şube bilgileri formu (varsayılan)
  // 2026-05-22 Tur 7 YT7-6: getAllCities (unstable_cache 24h) — Türkiye 81 il
  // sabit data, request-bağımsız ortak cache. orderBy name (alfabetik) içinde.
  const cityList = await getAllCities();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
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
          {Number.isFinite(effectiveBranchLimit) && (
            <>
              {' · '}
              <span className="text-ink-4">
                {activeBranchCount}/{effectiveBranchLimit} şube
              </span>
            </>
          )}
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
