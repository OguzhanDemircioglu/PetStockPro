import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listStocktakes } from '@/lib/stocktake/sessions';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  in_progress: { label: '▶ Sürüyor', cls: 'bg-cat-soft text-cart' },
  waiting: { label: '⏸ Beklemede', cls: 'bg-line-soft text-ink-2' },
  completed: { label: '✓ Tamamlandı', cls: 'bg-arrow-soft text-arrow-7' },
  cancelled: { label: '× İptal', cls: 'bg-danger-soft text-danger-7' },
};

const MODE_LABELS: Record<string, string> = {
  full: 'Tam',
  category: 'Kategori',
  manual: 'Manuel',
};

export default async function StocktakeListPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const items = await listStocktakes(session.user.companyId, db, { limit: 100 });
  const active = items.filter((i) => i.status === 'in_progress' || i.status === 'waiting');
  const past = items.filter((i) => i.status === 'completed' || i.status === 'cancelled');

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Sayım
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Sayım oturumları
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {active.length > 0
              ? `${active.length} aktif · ${past.length} geçmiş`
              : `${past.length} geçmiş sayım`}
          </p>
        </div>
        <Link
          href={'/admin/stocktake/new' as never}
          className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
        >
          + Yeni Sayım
        </Link>
      </header>

      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            Aktif sayımlar
          </h2>
          <div className="flex flex-col gap-3">
            {active.map((s) => {
              const pct =
                s.totalItems > 0 ? Math.round((s.countedItems / s.totalItems) * 100) : 0;
              return (
                <Link
                  key={s.id}
                  href={`/admin/stocktake/${s.id}` as never}
                  data-stocktake-id={s.id}
                  className="group rounded-2xl border-2 border-cat/40 bg-paper p-5 hover:border-cat hover:shadow-[var(--shadow-cat)] transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATUS_LABELS[s.status]?.cls ?? ''}`}
                        >
                          {STATUS_LABELS[s.status]?.label ?? s.status}
                        </span>
                        <span className="text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
                          {MODE_LABELS[s.mode] ?? s.mode} · {s.branchName ?? '—'}
                        </span>
                      </div>
                      <h3 className="mt-1 text-lg font-bold text-cart group-hover:text-cat">
                        Sayım #{s.id.slice(0, 8)}
                      </h3>
                      <p className="text-xs text-ink-3">
                        Başlatan: {s.startedByEmail ?? '—'} ·{' '}
                        {new Date(s.startedAt).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-cat">{pct}%</div>
                      <div className="text-[12px] uppercase tracking-wider text-ink-3">
                        tamamlandı
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-line-soft">
                    <div
                      className="h-full bg-gradient-to-r from-cat to-arrow"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex gap-4 text-[12.5px] text-ink-3">
                    <span>
                      ✓ Sayıldı: <strong className="text-ink">{s.countedItems}</strong>
                    </span>
                    <span>
                      ⚠ Fark: <strong className="text-ink">{s.diffItems}</strong>
                    </span>
                    <span>
                      Toplam: <strong className="text-ink">{s.totalItems}</strong>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {past.length === 0 && active.length === 0 ? (
        <section className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">📋</div>
          <h2 className="mt-4 text-xl font-bold text-cart">Henüz sayım yok</h2>
          <p className="mt-2 text-sm text-ink-3">
            Aylık veya haftalık fiziksel sayım yapıp sistemle karşılaştır.
          </p>
          <Link
            href={'/admin/stocktake/new' as never}
            className="mt-4 inline-block rounded-xl bg-cat px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cat-2"
          >
            + İlk sayımı başlat
          </Link>
        </section>
      ) : past.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            Geçmiş sayımlar
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
            <table className="w-full text-sm">
              <thead className="bg-paper">
                <tr className="text-left text-[12px] font-bold uppercase tracking-wider text-ink-3">
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Şube</th>
                  <th className="px-4 py-3">Mod</th>
                  <th className="px-4 py-3 text-right">Sayılan</th>
                  <th className="px-4 py-3 text-right">Fark</th>
                  <th className="px-4 py-3">Başlangıç</th>
                  <th className="px-4 py-3">Yapan</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {past.map((s) => (
                  <tr key={s.id} data-stocktake-id={s.id} className="hover:bg-line-soft">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATUS_LABELS[s.status]?.cls ?? ''}`}
                      >
                        {STATUS_LABELS[s.status]?.label ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13.5px] text-ink-2">{s.branchName ?? '—'}</td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-3">
                      {MODE_LABELS[s.mode] ?? s.mode}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13.5px]">
                      {s.countedItems}/{s.totalItems}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13.5px]">
                      {s.diffItems > 0 ? (
                        <span className="text-cart">{s.diffItems}</span>
                      ) : (
                        <span className="text-ink-4">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-3 whitespace-nowrap">
                      {new Date(s.startedAt).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-3">
                      {s.startedByEmail ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/stocktake/${s.id}` as never}
                        className="text-xs text-cat hover:underline"
                      >
                        Detay →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <Link
        href={'/admin' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Pano&apos;ya dön
      </Link>
    </main>
  );
}
