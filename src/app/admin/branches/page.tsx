import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listBranches } from '@/lib/branches/manage';
import { ModerationQueryBanner } from '@/components/moderation/moderation-query-banner';
import { BranchStatusControl } from './branch-status-control';
import { BRANCH_STATUS_EMOJI, BRANCH_STATUS_LABELS, type BranchStatus } from '@/lib/branches/status';

// Faz 4 (2026-05-21) — 3-state şube badge stilleri.
const STATUS_BADGE_CLS: Record<BranchStatus, string> = {
  active: 'bg-arrow-soft text-arrow-7',
  holiday: 'bg-cat-soft text-cart',
  inactive: 'bg-line-soft text-ink-4',
};

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    staff_skipped?: string;
    moderation?: 'flagged';
    fields?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const items = await listBranches(session.user.companyId, db);
  const params = await searchParams;
  const activeCount = items.filter((b) => b.status === 'active').length;
  const holidayCount = items.filter((b) => b.status === 'holiday').length;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Şubeler
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Şubelerin
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {items.length} şube · {activeCount} aktif
            {holidayCount > 0 ? ` · ${holidayCount} tatilde` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/branches/export"
            download
            className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-bold text-cart hover:bg-cat-soft"
          >
            ⬇ Excel
          </a>
          <Link
            href={'/admin/branches/new' as never}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
            data-testid="add-branch"
          >
            + Yeni Şube
          </Link>
        </div>
      </header>

      {params.created === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Şube eklendi.
          {params.staff_skipped === '1' && (
            <span className="ml-1 font-normal">
              Çalışan eklemeyi sonraya bıraktın —{' '}
              <a
                href="/admin/settings/users"
                className="underline hover:text-arrow"
              >
                Kullanıcılar
              </a>{' '}
              sayfasından ekleyebilirsin.
            </span>
          )}
        </div>
      )}
      {params.updated === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Şube güncellendi.
        </div>
      )}
      <ModerationQueryBanner
        moderation={params.moderation}
        fields={params.fields}
        entityLabel="Şube"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => (
          <article
            key={b.id}
            data-branch-id={b.id}
            data-branch-status={b.status}
            className={`rounded-2xl border bg-paper p-5 ${
              b.status === 'inactive'
                ? 'border-line bg-line-soft/40 opacity-70'
                : b.status === 'holiday'
                ? 'border-cat/40'
                : 'border-line'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/admin/branches/${b.id}` as never}
                className="text-lg font-bold text-cart hover:underline"
              >
                {b.name}
              </Link>
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11.5px] font-bold ${STATUS_BADGE_CLS[b.status]}`}
                data-testid={`branch-status-${b.status}`}
              >
                {BRANCH_STATUS_EMOJI[b.status]} {BRANCH_STATUS_LABELS[b.status]}
              </span>
            </div>

            <div className="mt-2 text-xs text-ink-3">
              {b.cityName ? (
                <span>
                  📍 {b.cityName}
                  {b.districtName ? ` / ${b.districtName}` : ''}
                </span>
              ) : (
                <span className="italic">Konum yok</span>
              )}
            </div>

            {b.address && (
              <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-4">{b.address}</p>
            )}

            {b.whatsappPhone && (
              <p className="mt-2 font-mono text-xs text-ink-2">
                📞 {b.whatsappPhone}
              </p>
            )}

            <div className="mt-3 flex items-end justify-between border-t border-line-soft pt-3">
              <div className="text-[12.5px] text-ink-3">
                {b.variantInventoryCount} variant ·{' '}
                <strong className="text-ink">{b.totalStockQty}</strong> stok
              </div>
              <BranchStatusControl
                branchId={b.id}
                currentStatus={b.status}
              />
            </div>
          </article>
        ))}
      </div>

      {items.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">🏪</div>
          <h2 className="mt-4 text-xl font-bold text-cart">Henüz şube yok</h2>
          <p className="mt-2 text-sm text-ink-3">
            Yukarıdan <strong>+ Yeni Şube</strong> ile başla.
          </p>
        </div>
      )}

      <Link
        href={'/' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Panele dön
      </Link>
    </main>
  );
}
