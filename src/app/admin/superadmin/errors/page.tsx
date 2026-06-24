import Link from 'next/link';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { listErrors, getErrorStats } from '@/lib/errors/list';
import { resolveErrorAction } from './actions';

export const dynamic = 'force-dynamic';

const SEVERITY_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  info: { label: 'INFO', bg: 'bg-cart-soft', text: 'text-cart' },
  warning: { label: 'WARNING', bg: 'bg-cat-soft', text: 'text-cat' },
  error: { label: 'ERROR', bg: 'bg-danger-soft', text: 'text-danger-7' },
  critical: { label: 'CRITICAL', bg: 'bg-danger', text: 'text-white' },
};

interface PageProps {
  searchParams: Promise<{
    severity?: string;
    errorType?: string;
    resolved?: string;
    days?: string;
  }>;
}

export default async function SuperadminErrorsPage(props: PageProps) {
  await requireSuperadmin();
  const sp = await props.searchParams;
  const severity =
    sp.severity && ['info', 'warning', 'error', 'critical'].includes(sp.severity)
      ? (sp.severity as 'info' | 'warning' | 'error' | 'critical')
      : undefined;
  const days = sp.days ? Math.min(parseInt(sp.days, 10) || 7, 90) : 7;
  const now = new Date();
  const fromDate = new Date(now.getTime() - days * 86_400_000).toISOString();
  const resolved =
    sp.resolved === '1' ? true : sp.resolved === '0' ? false : undefined;

  // max:1 Supabase pooler (prod): paralel okuma statement timeout → kararan ekran
  // (bkz. superadmin/page.tsx). SIRALI + defansif: takılırsa boş/sıfıra düşer.
  const rows = await listErrors(db, {
    severity,
    errorType: sp.errorType,
    resolved,
    fromDate,
    limit: 200,
  }).catch(() => [] as Awaited<ReturnType<typeof listErrors>>);
  const stats = await getErrorStats(db).catch(
    () => ({
      total24h: 0,
      unresolved24h: 0,
      critical24h: 0,
      topTypes: [] as Array<{ errorType: string; count: number }>,
    }),
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link href={'/admin/superadmin' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Süperadmin
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Hata İzleme
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          🐛 Hatalar
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          system_errors tablo (Sentry replacement). 90 gün retention.
          5+/saat burst → Telegram critical alert (6h dedup).
        </p>
      </header>

      <section data-testid="error-stats" className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Son 24s toplam" value={stats.total24h} />
        <StatCard
          label="Çözülmemiş 24s"
          value={stats.unresolved24h}
          accent={stats.unresolved24h > 0 ? 'cat' : 'arrow'}
        />
        <StatCard
          label="Critical 24s"
          value={stats.critical24h}
          accent={stats.critical24h > 0 ? 'danger' : 'arrow'}
        />
        <StatCard label="Son retention temizliği" value="—" />
      </section>

      {stats.topTypes.length > 0 && (
        <section data-testid="top-types" className="rounded-2xl border border-line bg-paper p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            🔥 En çok tekrarlayan tipler (24s)
          </h2>
          <ul className="flex flex-wrap gap-2">
            {stats.topTypes.map((t) => (
              <li key={t.errorType}>
                <Link
                  href={`/admin/superadmin/errors?errorType=${encodeURIComponent(t.errorType)}` as never}
                  className="inline-flex items-center gap-2 rounded-full bg-cat-soft px-3 py-1 text-[13px] font-bold text-cart hover:bg-cat hover:text-white"
                >
                  <code>{t.errorType}</code>
                  <span className="rounded-full bg-paper px-2 text-[11px] text-ink">
                    {t.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section data-testid="filters" className="flex flex-wrap gap-2">
        <FilterChip label="Tümü" href="/admin/superadmin/errors" active={!severity && !resolved} />
        <FilterChip label="🔴 Critical" href="/admin/superadmin/errors?severity=critical" active={severity === 'critical'} />
        <FilterChip label="🟠 Error" href="/admin/superadmin/errors?severity=error" active={severity === 'error'} />
        <FilterChip label="🟡 Warning" href="/admin/superadmin/errors?severity=warning" active={severity === 'warning'} />
        <FilterChip label="🔵 Info" href="/admin/superadmin/errors?severity=info" active={severity === 'info'} />
        <FilterChip label="⚠ Çözülmemiş" href="/admin/superadmin/errors?resolved=0" active={resolved === false} />
        <FilterChip label="✓ Çözülmüş" href="/admin/superadmin/errors?resolved=1" active={resolved === true} />
      </section>

      <section data-testid="error-list">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-line bg-paper p-12 text-center">
            <p className="text-4xl">🎉</p>
            <p className="mt-2 text-lg font-bold text-cart">
              Bu kriterlere uyan hata yok
            </p>
            <p className="text-sm text-ink-3">
              system_errors tablo boş veya filter çok dar.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((r) => {
              const sev = SEVERITY_LABELS[r.severity] ?? SEVERITY_LABELS.error!;
              return (
                <article
                  key={r.id}
                  data-error-id={r.id}
                  data-severity={r.severity}
                  data-resolved={r.resolved ? '1' : '0'}
                  className={`rounded-2xl border bg-paper p-4 ${r.resolved ? 'border-arrow/40 opacity-70' : 'border-line'}`}
                >
                  <header className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sev.bg} ${sev.text}`}>
                      {sev.label}
                    </span>
                    <code className="text-[13px] font-bold text-cart">
                      {r.errorType}
                    </code>
                    {r.alertSentAt && (
                      <span className="rounded bg-danger-soft px-2 py-0.5 text-[10px] text-danger-7" title={`Alert: ${r.alertSentAt}`}>
                        🔔 Alert
                      </span>
                    )}
                    {r.resolved && (
                      <span className="rounded bg-arrow-soft px-2 py-0.5 text-[10px] text-arrow-7">
                        ✓ Çözüldü
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-ink-4" title={r.createdAt}>
                      {new Date(r.createdAt).toLocaleString('tr-TR')}
                    </span>
                  </header>

                  <p className="mt-2 break-words font-mono text-[13px] text-ink-2">
                    {r.message}
                  </p>

                  <dl className="mt-2 grid grid-cols-2 gap-x-4 text-[12px] sm:grid-cols-4">
                    {r.route && (
                      <Detail label="Route" value={<code>{r.route}</code>} />
                    )}
                    {r.action && (
                      <Detail label="Action" value={<code>{r.action}</code>} />
                    )}
                    {r.companyName && (
                      <Detail label="Tenant" value={r.companyName} />
                    )}
                    {r.userEmail && (
                      <Detail label="User" value={<code>{r.userEmail}</code>} />
                    )}
                  </dl>

                  {r.stack && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[12px] font-bold text-cart">
                        🧵 Stack trace
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-line-soft p-3 text-[11px] text-ink-2">
                        {r.stack}
                      </pre>
                    </details>
                  )}

                  {r.context !== null && r.context !== undefined && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px] font-bold text-cart">
                        📦 Context
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-line-soft p-3 text-[11px] text-ink-2">
                        {JSON.stringify(r.context, null, 2)}
                      </pre>
                    </details>
                  )}

                  <form action={resolveErrorAction} className="mt-3 flex justify-end">
                    <input type="hidden" name="errorId" value={r.id} />
                    <input
                      type="hidden"
                      name="resolved"
                      value={r.resolved ? '0' : '1'}
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-line bg-paper px-3 py-1 text-[12px] font-bold text-cart hover:bg-cat-soft"
                    >
                      {r.resolved ? '↺ Tekrar aç' : '✓ Çözüldü işaretle'}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent = 'ink',
}: {
  label: string;
  value: string | number;
  accent?: 'ink' | 'arrow' | 'cat' | 'danger';
}) {
  const cls: Record<string, string> = {
    ink: 'text-ink',
    arrow: 'text-arrow-7',
    cat: 'text-cart',
    danger: 'text-danger-7',
  };
  return (
    <article className="rounded-2xl border border-line bg-paper p-4">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-4">
        {label}
      </div>
      <div className={`mt-1 text-3xl font-bold ${cls[accent]}`}>{value}</div>
    </article>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href as never}
      className={`rounded-full border px-3 py-1 text-[12px] font-bold ${
        active
          ? 'border-cart bg-cart text-white'
          : 'border-line bg-paper text-cart hover:bg-cat-soft'
      }`}
    >
      {label}
    </Link>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-4">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink-2">{value}</dd>
    </div>
  );
}
