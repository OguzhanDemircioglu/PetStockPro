import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import {
  getTenantDetail,
  listTenantUsers,
  listTenantMovements,
  listTenantAudit,
} from '@/lib/superadmin/tenant-detail';

// Faz 1 (2026-05-21) — SUBE_MUDURU → OBSERVER key rename (Migration 0021).
const ROLE_BADGE: Record<string, string> = {
  SUPERADMIN: 'bg-cat-soft text-cart',
  BAYI_SAHIBI: 'bg-arrow-soft text-arrow-7',
  OBSERVER: 'bg-line-soft text-ink-2',
  STAFF: 'bg-line-soft text-ink-3',
  BAYI_ADMIN: 'bg-cat-soft text-cart',
};

const MOVEMENT_BADGE: Record<string, string> = {
  stock_in: '📥',
  stock_out: '📤',
  transfer: '🔁',
  stocktake: '📋',
  stocktake_initial: '🗂',
};

export default async function TenantDetailSuperadminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperadmin();

  const { id } = await params;
  const [tenant, tenantUsers, movements, audit] = await Promise.all([
    getTenantDetail(id, db),
    listTenantUsers(id, db),
    listTenantMovements(id, db, 15),
    listTenantAudit(id, db, 15),
  ]);

  if (!tenant) notFound();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link
          href={'/admin/superadmin' as never}
          className="text-xs text-ink-4 hover:text-cart"
        >
          ← Tenant listesi
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Tenant Detay
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          🏪 {tenant.name}
        </h1>
        <p className="mt-1 text-sm text-ink-3 font-mono">
          {tenant.slug}
          {tenant.vatNo && <span> · VKN {tenant.vatNo}</span>}
          {tenant.whatsappPhone && <span> · {tenant.whatsappPhone}</span>}
          <span> · Plan {tenant.plan}</span>
          <span> · {new Date(tenant.createdAt).toLocaleDateString('tr-TR')}</span>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPI title="Kullanıcı" value={tenant.userCount} emoji="👥" />
        <KPI title="Ürün" value={tenant.productCount} emoji="📦" />
        <KPI title="Şube" value={tenant.branchCount} emoji="🏪" />
        <KPI title="Toplam stok" value={tenant.totalStockQty} emoji="📦" />
        <KPI
          title="24s hareket"
          value={tenant.movements24h}
          emoji="🔄"
          accent={tenant.movements24h > 0 ? 'arrow' : 'neutral'}
        />
      </section>

      {/* Tehlikeli aksiyonlar section — kategoriler GLOBAL artık (Migration 0026), reset gerek yok.
          İleride hard-delete tenant gibi süperadmin bypass aksiyonları buraya eklenebilir. */}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-paper p-5" data-testid="tenant-users">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            👥 Kullanıcılar ({tenantUsers.length})
          </h2>
          {tenantUsers.length === 0 ? (
            <p className="text-center text-xs text-ink-3">Kullanıcı yok.</p>
          ) : (
            <ul className="divide-y divide-line-soft text-xs">
              {tenantUsers.map((u) => (
                <li key={u.id} data-user-id={u.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">{u.email}</div>
                    <div className="flex flex-wrap gap-1.5 text-[11.5px]">
                      <span
                        className={`rounded-full px-1.5 py-0.5 font-bold ${ROLE_BADGE[u.role] ?? 'bg-line-soft text-ink-3'}`}
                      >
                        {u.role}
                      </span>
                      {!u.emailVerifiedAt && (
                        <span className="rounded-full bg-danger-soft px-1.5 py-0.5 font-bold text-danger-7">
                          ⚠ Doğrulanmamış
                        </span>
                      )}
                      {u.twoFactorEnabled && (
                        <span className="rounded-full bg-arrow-soft px-1.5 py-0.5 font-bold text-arrow-7">
                          🛡 2FA
                        </span>
                      )}
                      {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                        <span className="rounded-full bg-danger-soft px-1.5 py-0.5 font-bold text-danger-7">
                          🔒 Kilitli
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/admin/superadmin/user/${u.id}` as never}
                    className="rounded-lg border border-cat/40 bg-cat-soft px-2 py-1 text-[11.5px] font-bold text-cart hover:bg-cat hover:text-white transition-colors"
                  >
                    ⚙ Yönet
                  </Link>
                  <div className="text-[11.5px] text-ink-4 whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article
          className="rounded-2xl border border-line bg-paper p-5"
          data-testid="tenant-audit"
        >
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            📜 Son audit ({audit.length})
          </h2>
          {audit.length === 0 ? (
            <p className="text-center text-xs text-ink-3">Audit kaydı yok.</p>
          ) : (
            <ul className="divide-y divide-line-soft text-[12.5px]">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-1.5">
                  <span className="font-mono text-[11.5px] text-cart truncate flex-1">
                    {a.action}
                  </span>
                  {a.performedAsSuperadmin && (
                    <span className="rounded bg-cat-soft px-1 py-0.5 text-[10.5px] font-bold text-cart">
                      🛡
                    </span>
                  )}
                  <span className="text-[11.5px] text-ink-3 whitespace-nowrap">
                    {a.userEmail?.split('@')[0] ?? '—'}
                  </span>
                  <span className="text-[11.5px] text-ink-4 whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5" data-testid="tenant-movements">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          📦 Son stok hareketleri ({movements.length})
        </h2>
        {movements.length === 0 ? (
          <p className="text-center text-xs text-ink-3">Hareket yok.</p>
        ) : (
          <ul className="divide-y divide-line-soft text-xs">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2">
                <span className="text-base">{MOVEMENT_BADGE[m.type] ?? '?'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-ink">
                    {m.productName} · {m.variantLabel}
                  </div>
                  <div className="text-[11.5px] text-ink-3">
                    {m.branchName ?? '—'}
                    {m.subtype && <span> · {m.subtype}</span>}
                    {' · '}
                    {new Date(m.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div
                  className={`font-mono text-sm font-bold ${
                    m.quantity > 0 ? 'text-arrow-7' : 'text-cart'
                  }`}
                >
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                  <span className="ml-1 text-[11.5px] text-ink-3">→ {m.afterQty}</span>
                </div>
                {m.performedAsSuperadmin && (
                  <span className="rounded bg-cat-soft px-1 py-0.5 text-[10.5px] font-bold text-cart">
                    🛡
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-[12.5px] text-ink-4">
        🛡 Süperadmin · Read-only inceleme. Impersonation + müdahale Faz 2&apos;de.
      </p>
    </main>
  );
}

function KPI({
  title,
  value,
  emoji,
  accent = 'neutral',
}: {
  title: string;
  value: number | string;
  emoji: string;
  accent?: 'cat' | 'arrow' | 'neutral';
}) {
  const cls: Record<string, string> = {
    cat: 'border-cat/30 bg-cat-soft/40',
    arrow: 'border-arrow/30 bg-arrow-soft/40',
    neutral: 'border-line bg-paper',
  };
  return (
    <article className={`flex flex-col gap-2 rounded-2xl border p-5 ${cls[accent]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wider text-ink-3">
          {title}
        </span>
        <span className="text-xl">{emoji}</span>
      </div>
      <div className="font-mono text-2xl font-bold text-cart">{value}</div>
    </article>
  );
}
