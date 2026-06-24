import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { getUserForSuperadmin, listUserAudit } from '@/lib/superadmin/user-detail';
import {
  ForcePasswordResetForm,
  ResetTwoFactorForm,
  LockAccountForm,
  UnlockAccountForm,
} from './forms';

// Faz 1 (2026-05-21) — SUBE_MUDURU → OBSERVER key rename (Migration 0021).
const ROLE_BADGE: Record<string, string> = {
  SUPERADMIN: 'bg-cat-soft text-cart',
  BAYI_SAHIBI: 'bg-arrow-soft text-arrow-7',
  OBSERVER: 'bg-line-soft text-ink-2',
  STAFF: 'bg-line-soft text-ink-3',
  BAYI_ADMIN: 'bg-cat-soft text-cart',
};

export default async function SuperadminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperadmin();
  const { id } = await params;

  // max:1 Supabase pooler (prod): paralel okuma statement timeout → kararan ekran
  // (bkz. superadmin/page.tsx). SIRALI: önce kullanıcı (yoksa notFound), sonra audit
  // (takılırsa boş listeye düşer, sayfa yine render olur).
  const user = await getUserForSuperadmin(id, db);
  if (!user) notFound();
  const audit = await listUserAudit(id, db, 15).catch(
    () => [] as Awaited<ReturnType<typeof listUserAudit>>,
  );

  const now = new Date();
  const isLocked = !!user.lockedUntil && new Date(user.lockedUntil).getTime() > now.getTime();
  const tenantHref = user.companyId
    ? (`/admin/superadmin/tenant/${user.companyId}` as never)
    : ('/admin/superadmin' as never);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link href={tenantHref} className="text-xs text-ink-4 hover:text-cart">
          ← {user.companyName ?? 'Süperadmin'}
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Uzak Kullanıcı Yönetimi
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          👤 {user.email}
        </h1>
        <p className="mt-1 text-sm text-ink-3 font-mono">
          {user.name && <span>{user.name} · </span>}
          {user.companyName && <span>{user.companyName} · </span>}
          <span className={`rounded-full px-1.5 py-0.5 text-[12px] font-bold ${ROLE_BADGE[user.role] ?? 'bg-line-soft text-ink-3'}`}>
            {user.role}
          </span>
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="status-grid">
        <Status
          title="Email doğrulama"
          value={user.emailVerifiedAt ? '✓ Doğrulanmış' : '⚠ Bekliyor'}
          accent={user.emailVerifiedAt ? 'arrow' : 'danger'}
        />
        <Status
          title="2FA"
          value={user.twoFactorEnabled ? '🛡 Aktif' : 'Kapalı'}
          accent={user.twoFactorEnabled ? 'arrow' : 'neutral'}
        />
        <Status
          title="Hesap durumu"
          value={isLocked ? `🔒 Kilitli (${user.lockedReason})` : 'Açık'}
          accent={isLocked ? 'danger' : 'arrow'}
        />
        <Status
          title="Failed login / Son 24h lock"
          value={`${user.failedLoginCount} / ${user.recentLockCount}`}
          accent={user.failedLoginCount > 0 ? 'danger' : 'neutral'}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ForcePasswordResetForm targetUserId={user.id} />
        <ResetTwoFactorForm targetUserId={user.id} isEnabled={user.twoFactorEnabled} />
        {isLocked ? (
          <UnlockAccountForm targetUserId={user.id} isLocked={true} />
        ) : (
          <LockAccountForm targetUserId={user.id} isLocked={false} />
        )}
        <article className="rounded-xl border border-line bg-paper p-4" data-testid="user-audit">
          <h3 className="mb-2 text-sm font-bold text-cart">📜 Son audit kayıtları</h3>
          {audit.length === 0 ? (
            <p className="text-center text-xs text-ink-3">Bu kullanıcıya ait audit kaydı yok.</p>
          ) : (
            <ul className="divide-y divide-line-soft text-[12.5px]">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11.5px] text-cart truncate flex-1">
                      {a.action}
                    </span>
                    {a.performedAsSuperadmin && (
                      <span className="rounded bg-cat-soft px-1 py-0.5 text-[10.5px] font-bold text-cart">
                        🛡 {a.superadminActionType ?? '—'}
                      </span>
                    )}
                    <span className="text-[11.5px] text-ink-4 whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {a.superadminReason && (
                    <div className="text-[11.5px] text-ink-3 italic">
                      &quot;{a.superadminReason}&quot;
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <p className="text-center text-[12.5px] text-ink-4">
        🛡 Tüm aksiyonlar audit log&apos;da <code>superadmin.remote.*</code> action&apos;ları
        olarak kayıtlı + şifre re-auth + zorunlu sebep + Telegram alert.
      </p>
    </main>
  );
}

function Status({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: 'cat' | 'arrow' | 'danger' | 'neutral';
}) {
  const cls: Record<string, string> = {
    cat: 'border-cat/30 bg-cat-soft/40',
    arrow: 'border-arrow/30 bg-arrow-soft/40',
    danger: 'border-danger/30 bg-danger-soft/40 text-danger-7',
    neutral: 'border-line bg-paper',
  };
  return (
    <article className={`rounded-xl border p-3 ${cls[accent]}`}>
      <div className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">{title}</div>
      <div className="mt-1 text-[14px] font-bold">{value}</div>
    </article>
  );
}
