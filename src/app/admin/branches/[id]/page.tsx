import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { getBranchDetail } from '@/lib/branches/manage';
import {
  listBranchVariantStock,
  listBranchRecentMovements,
  listBranchAssignedUsers,
} from '@/lib/branches/detail';
import { RemoveManagerButton } from './remove-manager-button';

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  stock_in: { label: '📥 Giriş', cls: 'bg-arrow-soft text-arrow-7' },
  stock_out: { label: '📤 Çıkış', cls: 'bg-cat-soft text-cart' },
  transfer: { label: '🔁 Transfer', cls: 'bg-line-soft text-ink-2' },
  stocktake: { label: '📋 Sayım', cls: 'bg-line-soft text-ink-2' },
  stocktake_initial: { label: '🗂 İlk', cls: 'bg-line-soft text-ink-2' },
};

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const { id } = await params;
  const [branch, variantStock, movements, assigned] = await Promise.all([
    getBranchDetail(session.user.companyId, id, db),
    listBranchVariantStock(session.user.companyId, id, db),
    listBranchRecentMovements(session.user.companyId, id, db, 12),
    listBranchAssignedUsers(session.user.companyId, id, db),
  ]);

  if (!branch) notFound();

  const canManageUsers =
    session.user.role === 'BAYI_SAHIBI' || session.user.role === 'SUPERADMIN';

  const totalStock = variantStock.reduce((sum, v) => sum + v.stockQty, 0);
  const lowVariants = variantStock.filter((v) => v.isLow).length;
  const zeroVariants = variantStock.filter((v) => v.isZero).length;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Şubeler · Detay
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            🏪 {branch.name}
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {branch.cityName ?? '—'}
            {branch.districtName ? ` · ${branch.districtName}` : ''}
            {branch.status === 'holiday' && (
              <span className="ml-2 rounded-full bg-cat-soft px-2 py-0.5 text-[11.5px] font-bold text-cart">
                🏖 Tatilde
              </span>
            )}
            {branch.status === 'inactive' && (
              <span className="ml-2 rounded-full bg-line-soft px-2 py-0.5 text-[11.5px] font-bold text-ink-3">
                ⚫ Pasif
              </span>
            )}
          </p>
        </div>
        <Link
          href={`/admin/branches/${branch.id}/edit` as never}
          className="rounded-xl border border-line bg-paper px-4 py-2 text-xs font-bold text-cart hover:bg-cat-soft"
        >
          ✎ Şubeyi düzenle
        </Link>
      </header>

      {branch.status === 'inactive' && (
        <div
          role="status"
          className="rounded-xl border border-ink-2/30 bg-line-soft px-4 py-3 text-sm font-bold text-ink-2"
          data-testid="branch-inactive-banner"
        >
          ⚠ Bu şube pasif. Vitrin&apos;den çekildi, üzerinden hiçbir aksiyon yapılamaz.
          Yalnızca görüntüleyebilirsin. Devam etmek için şubeyi aktif veya tatil moduna geri al.
        </div>
      )}
      {branch.status === 'holiday' && (
        <div
          role="status"
          className="rounded-xl border border-cat/40 bg-cat-soft px-4 py-3 text-sm font-bold text-cart"
          data-testid="branch-holiday-banner"
        >
          🏖 Bu şube tatilde. Vitrin&apos;de &quot;Tatilde&quot; rozeti görünür, müşteri WhatsApp atamaz.
          Admin operasyonları (sayım, transfer, stok hareketi) devam edebilir.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI title="Toplam Stok" value={totalStock} emoji="📦" />
        <KPI title="Variant Sayısı" value={variantStock.length} emoji="🏷" />
        <KPI
          title="Düşük Stok"
          value={lowVariants}
          emoji="⚠"
          accent={lowVariants > 0 ? 'danger' : 'arrow'}
        />
        <KPI
          title="Stok Yok"
          value={zeroVariants}
          emoji="🔴"
          accent={zeroVariants > 0 ? 'danger' : 'arrow'}
        />
      </section>

      <section
        className="rounded-2xl border border-line bg-paper p-5"
        data-testid="branch-team-card"
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-3">
            👤 Şube ekibi
          </h2>
          {canManageUsers && (
            <Link
              href={'/admin/settings/users' as never}
              className="text-[12.5px] font-bold text-cat hover:underline"
            >
              Kullanıcı davet et →
            </Link>
          )}
        </header>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div
            className="flex flex-col gap-2 rounded-xl border border-line-soft bg-cat-soft/30 p-4"
            data-testid="branch-manager-block"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                İzleyici
              </span>
              <span className="text-[10.5px] text-ink-4">en fazla 1</span>
            </div>
            {assigned.manager ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-cart">
                    {assigned.manager.name ?? assigned.manager.email}
                  </div>
                  {assigned.manager.name && (
                    <div className="truncate text-[12px] text-ink-3">
                      {assigned.manager.email}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-4">
                    {assigned.manager.emailVerifiedAt ? (
                      <span className="rounded-full bg-arrow-soft px-1.5 py-0.5 font-bold text-arrow-7">
                        ✓ Doğrulandı
                      </span>
                    ) : (
                      <span className="rounded-full bg-line-soft px-1.5 py-0.5 font-bold text-ink-3">
                        Davet bekliyor
                      </span>
                    )}
                  </div>
                </div>
                {canManageUsers && (
                  <RemoveManagerButton
                    branchId={branch.id}
                    managerEmail={assigned.manager.email}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="text-sm text-ink-3">
                  Henüz İzleyici atanmadı.
                </div>
                {canManageUsers && (
                  <Link
                    href={'/admin/settings/users' as never}
                    className="text-[12.5px] font-bold text-cat hover:underline"
                  >
                    + İzleyici davet et
                  </Link>
                )}
              </div>
            )}
          </div>

          <div
            className="flex flex-col gap-2 rounded-xl border border-line-soft bg-arrow-soft/30 p-4"
            data-testid="branch-staff-block"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                Çalışanlar (STAFF)
              </span>
              <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-bold text-ink-2">
                {assigned.staff.length}
              </span>
            </div>
            {assigned.staff.length === 0 ? (
              <div className="text-sm text-ink-3">
                Bu şubeye atanmış çalışan yok.
              </div>
            ) : (
              <ul className="divide-y divide-line-soft" data-testid="branch-staff-rows">
                {assigned.staff.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 py-1.5 text-[13px]"
                  >
                    <span className="min-w-0 flex-1 truncate font-bold text-ink">
                      {s.name ?? s.email}
                    </span>
                    {!s.emailVerifiedAt && (
                      <span className="rounded-full bg-line-soft px-1.5 py-0.5 text-[10.5px] font-bold text-ink-3">
                        Davet bekliyor
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-paper p-5" data-testid="branch-variant-list">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            Variant stoğu
          </h2>
          {variantStock.length === 0 ? (
            <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
              Bu şubede henüz variant kaydı yok.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft" data-testid="branch-variant-rows">
              {variantStock.map((v) => (
                <li
                  key={v.variantId}
                  data-variant-id={v.variantId}
                  data-low={v.isLow ? '1' : '0'}
                  data-zero={v.isZero ? '1' : '0'}
                  className="flex items-center gap-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold text-ink">
                      {v.productName}
                    </div>
                    <div className="text-[12px] text-ink-3">
                      {v.variantLabel} · SKU {v.sku}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div
                      className={`text-base font-bold ${
                        v.isZero ? 'text-danger-7' : v.isLow ? 'text-cart' : 'text-ink'
                      }`}
                    >
                      {v.stockQty}
                    </div>
                    <div className="text-[11.5px] text-ink-4">/ {v.threshold} eşik</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article
          className="rounded-2xl border border-line bg-paper p-5"
          data-testid="branch-movements"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-3">
              🕒 Son hareketler
            </h2>
            <Link
              href={`/admin/stock-movements?branch=${branch.id}` as never}
              className="text-[12.5px] font-bold text-cat hover:underline"
            >
              Tümü →
            </Link>
          </div>
          {movements.length === 0 ? (
            <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
              Bu şubede henüz hareket yok.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft text-xs" data-testid="branch-movement-rows">
              {movements.map((m) => {
                const badge = TYPE_BADGE[m.type] ?? {
                  label: m.type,
                  cls: 'bg-line-soft text-ink-2',
                };
                return (
                  <li
                    key={m.id}
                    data-movement-id={m.id}
                    className="flex items-center gap-2 py-2"
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-ink">{m.productName}</div>
                      <div className="text-[11.5px] text-ink-3">
                        {m.variantLabel} ·{' '}
                        {new Date(m.createdAt).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div
                        className={`text-sm font-bold ${
                          m.quantity > 0 ? 'text-arrow-7' : 'text-cart'
                        }`}
                      >
                        {m.quantity > 0 ? '+' : ''}
                        {m.quantity}
                      </div>
                      <div className="text-[10.5px] text-ink-4">
                        {m.beforeQty} → {m.afterQty}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>

      <Link
        href={'/admin/branches' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Şube listesi
      </Link>
    </main>
  );
}

function KPI({
  title,
  value,
  emoji,
  accent = 'arrow',
}: {
  title: string;
  value: number | string;
  emoji: string;
  accent?: 'cat' | 'arrow' | 'danger';
}) {
  const cls: Record<string, string> = {
    cat: 'border-cat/30 bg-cat-soft/40',
    arrow: 'border-arrow/30 bg-arrow-soft/40',
    danger: 'border-danger/30 bg-danger-soft/40',
  };
  return (
    <article
      className={`flex flex-col gap-2 rounded-2xl border p-5 ${cls[accent]}`}
      data-kpi={title}
    >
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
