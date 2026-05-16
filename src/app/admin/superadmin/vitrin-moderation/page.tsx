import Link from 'next/link';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import {
  getModerationStats,
  listAllFeedback,
  type FeedbackRow,
} from '@/lib/vitrin/moderation';
import { FlagButton, UnflagButton } from './buttons';

interface SearchParams {
  tab?: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: '✅ Cevaplandı', cls: 'bg-arrow-soft text-arrow-7' },
  closed_manually: { label: '× Kapatıldı', cls: 'bg-line-soft text-ink-3' },
  dismissed: { label: '👻 Dismiss', cls: 'bg-line-soft text-ink-3' },
  flagged: { label: '🚩 Flagged', cls: 'bg-danger-soft text-danger-7' },
};

const RATING_LABEL: Record<string, { emoji: string; label: string }> = {
  very_good: { emoji: '😊', label: 'Çok iyi' },
  good: { emoji: '🙂', label: 'İyi' },
  neutral: { emoji: '😐', label: 'Orta' },
  bad: { emoji: '😕', label: 'Kötü' },
  unreached: { emoji: '😞', label: 'Ulaşılmadı' },
};

export default async function VitrinModerationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperadmin();

  const { tab } = await searchParams;
  const activeTab = tab === 'flagged' ? 'flagged' : 'all';

  const [stats, allRows, flaggedRows] = await Promise.all([
    getModerationStats(db),
    listAllFeedback(db, { limit: 100 }),
    listAllFeedback(db, { status: 'flagged', limit: 100 }),
  ]);

  const rows = activeTab === 'flagged' ? flaggedRows : allRows;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href={'/admin/superadmin' as never}
          className="text-xs text-ink-4 hover:text-cart"
        >
          ← Süperadmin
        </Link>
        <div className="mt-3 text-[11.5px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Vitrin moderasyon
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          📋 WhatsApp Geri Bildirim Moderasyonu
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Müşteri vitrin feedback&apos;lerini gözden geçir, spam veya yalan
          şikayetleri 🚩 flag&apos;la. Flagged kayıtlar tenant
          dashboard&apos;ında ortalamaya sayılır ama Faz 2&apos;de
          süzülecek.
        </p>
      </header>

      {/* KPI özet */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI title="Toplam feedback" value={stats.totalCount} emoji="📊" />
        <KPI
          title="✅ Cevaplandı"
          value={stats.byStatus.submitted}
          emoji="😊"
          accent="arrow"
        />
        <KPI
          title="🚩 Flagged"
          value={stats.byStatus.flagged}
          emoji="🚩"
          accent={stats.byStatus.flagged > 0 ? 'danger' : 'arrow'}
        />
        <KPI
          title="Son 24s flag"
          value={stats.flaggedTodayCount}
          emoji="⏱"
          accent={stats.flaggedTodayCount > 5 ? 'danger' : 'neutral'}
        />
      </section>

      {/* Tab nav */}
      <nav
        className="flex gap-1 border-b border-line"
        data-testid="moderation-tabs"
      >
        <TabLink href="/admin/superadmin/vitrin-moderation" active={activeTab === 'all'}>
          {`Tümü (${stats.totalCount})`}
        </TabLink>
        <TabLink
          href="/admin/superadmin/vitrin-moderation?tab=flagged"
          active={activeTab === 'flagged'}
        >
          {`🚩 Flagged (${stats.byStatus.flagged})`}
        </TabLink>
      </nav>

      {/* Tablo */}
      <section data-testid="moderation-results">
        {rows.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-white py-12 text-center">
            <div className="text-4xl">
              {activeTab === 'flagged' ? '✓' : '📭'}
            </div>
            <p className="mt-2 text-sm text-ink-3">
              {activeTab === 'flagged'
                ? 'Flagged feedback yok — sistem temiz.'
                : 'Henüz hiç vitrin feedback yok.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table
              className="w-full text-xs"
              data-testid="moderation-table"
            >
              <thead className="bg-line-soft text-[10.5px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-3 py-2 text-left">Tarih</th>
                  <th className="px-3 py-2 text-left">Tenant</th>
                  <th className="px-3 py-2 text-left">Durum</th>
                  <th className="px-3 py-2 text-left">Puan</th>
                  <th className="px-3 py-2 text-left">Ülke</th>
                  <th className="px-3 py-2 text-left">Flag sebebi</th>
                  <th className="px-3 py-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <ModerationRow key={r.id} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-center text-[11px] text-ink-4">
        İşlemler audit log&apos;da{' '}
        <code>vitrin_feedback.flagged</code> /{' '}
        <code>vitrin_feedback.unflagged</code> olarak görünür.
      </p>
    </main>
  );
}

function ModerationRow({ row }: { row: FeedbackRow }) {
  const statusInfo = STATUS_LABEL[row.status] ?? {
    label: row.status,
    cls: 'bg-line-soft',
  };
  const ratingInfo = row.rating ? RATING_LABEL[row.rating] : null;

  return (
    <tr data-row-id={row.id} data-status={row.status}>
      <td className="px-3 py-2 text-ink-3 whitespace-nowrap">
        {row.createdAt.toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        })}{' '}
        <span className="text-[10px] text-ink-4">
          {row.createdAt.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </td>
      <td className="px-3 py-2 font-bold text-cart truncate max-w-[180px]">
        {row.companyName}
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.cls}`}
        >
          {statusInfo.label}
        </span>
      </td>
      <td className="px-3 py-2 text-ink-2">
        {ratingInfo ? (
          <span title={ratingInfo.label}>
            {ratingInfo.emoji}{' '}
            <span className="text-[10px] text-ink-4">{ratingInfo.label}</span>
          </span>
        ) : (
          <span className="text-ink-4">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-ink-3 font-mono text-[10px]">
        {row.countryCode ?? '—'}
      </td>
      <td className="px-3 py-2 text-ink-3 text-[11px] max-w-[200px] truncate">
        {row.status === 'flagged' && row.flagReason ? (
          <span title={row.flagReason}>{row.flagReason}</span>
        ) : (
          <span className="text-ink-4">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {row.status === 'flagged' ? (
          <UnflagButton feedbackId={row.id} />
        ) : (
          <FlagButton feedbackId={row.id} />
        )}
      </td>
    </tr>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as never}
      data-active={active}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition-colors ${
        active
          ? 'border-cat text-cat'
          : 'border-transparent text-ink-3 hover:text-cart'
      }`}
    >
      {children}
    </Link>
  );
}

function KPI({
  title,
  value,
  emoji,
  accent = 'cat',
}: {
  title: string;
  value: number;
  emoji: string;
  accent?: 'cat' | 'arrow' | 'danger' | 'neutral';
}) {
  const accentClasses: Record<string, string> = {
    cat: 'border-cat/30 bg-cat-soft/40',
    arrow: 'border-arrow/30 bg-arrow-soft/40',
    danger: 'border-danger/30 bg-danger-soft/40',
    neutral: 'border-line bg-white',
  };
  return (
    <article
      className={`flex flex-col gap-1 rounded-2xl border p-4 ${accentClasses[accent]}`}
      data-kpi={title}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
          {title}
        </span>
        <span className="text-base">{emoji}</span>
      </div>
      <div className="font-mono text-2xl font-bold text-cart">{value}</div>
    </article>
  );
}
