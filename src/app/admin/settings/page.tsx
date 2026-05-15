import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  branches,
  brands,
  categories,
  companies,
  suppliers,
  users,
} from '@/db/schema';

export default async function SettingsHubPage() {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    redirect('/login' as never);
  }

  const [companyRow, userRow, countsRow] = await Promise.all([
    db
      .select({
        name: companies.name,
        vatNo: companies.vatNo,
        whatsappPhone: companies.whatsappPhone,
      })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .limit(1),
    db
      .select({
        email: users.email,
        twoFactorEnabledAt: users.twoFactorEnabledAt,
        pendingEmail: users.pendingEmail,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1),
    db
      .select({
        categoryCount: sql<number>`(SELECT COUNT(*)::int FROM ${categories} WHERE ${categories.companyId} = ${session.user.companyId})`,
        brandCount: sql<number>`(SELECT COUNT(*)::int FROM ${brands} WHERE ${brands.companyId} = ${session.user.companyId})`,
        branchCount: sql<number>`(SELECT COUNT(*)::int FROM ${branches} WHERE ${branches.companyId} = ${session.user.companyId} AND ${branches.isActive} = true)`,
        supplierCount: sql<number>`(SELECT COUNT(*)::int FROM ${suppliers} WHERE ${suppliers.companyId} = ${session.user.companyId} AND ${suppliers.isActive} = true)`,
      })
      .from(sql`(SELECT 1) AS dummy`),
  ]);

  const company = companyRow[0];
  const user = userRow[0];
  const counts = countsRow[0] ?? {
    categoryCount: 0,
    brandCount: 0,
    branchCount: 0,
    supplierCount: 0,
  };
  const vatMissing = !company?.vatNo;
  const twoFaActive = !!user?.twoFactorEnabledAt;
  const emailChangePending = !!user?.pendingEmail;

  const cards: SettingsCardProps[] = [
    {
      href: '/admin/settings/company',
      emoji: '🏢',
      title: 'Firma bilgileri',
      desc: 'Vergi no, WhatsApp, konum, IBAN',
      status: vatMissing
        ? { kind: 'danger', label: '⚠ VKN eksik' }
        : { kind: 'ok', label: '✓ Tam' },
    },
    {
      href: '/admin/account',
      emoji: '👤',
      title: 'Hesap',
      desc: `${user?.email ?? ''} — email değiştirme`,
      status: emailChangePending
        ? { kind: 'pending', label: '⏳ Bekleyen' }
        : { kind: 'ok', label: '✓ Aktif' },
    },
    {
      href: '/admin/security',
      emoji: '🛡',
      title: 'Güvenlik',
      desc: '2FA, recovery kodları',
      status: twoFaActive
        ? { kind: 'ok', label: '✓ 2FA aktif' }
        : { kind: 'warning', label: '⚠ 2FA kapalı' },
    },
  ];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <header>
        <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
          Admin · Ayarlar
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Ayarlar
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          {company?.name ?? 'Pet shop'} — hesap ve firma yönetimi
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          👤 Hesap & Firma
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <SettingsCard key={c.href} {...c} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          📂 Veri yönetimi
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DataLink
            href="/admin/categories"
            emoji="📂"
            title="Kategoriler"
            count={counts.categoryCount}
          />
          <DataLink
            href="/admin/brands"
            emoji="🏷"
            title="Markalar"
            count={counts.brandCount}
          />
          <DataLink
            href="/admin/branches"
            emoji="🏪"
            title="Şubeler"
            count={counts.branchCount}
            suffix="aktif"
          />
          <DataLink
            href="/admin/suppliers"
            emoji="🏢"
            title="Tedarikçiler"
            count={counts.supplierCount}
            suffix="aktif"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          📜 Denetim
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={'/admin/audit-log' as never}
            data-data-link="/admin/audit-log"
            className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 hover:border-cat hover:shadow-sm transition-shadow"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-cat-soft text-2xl">
              📜
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-cart group-hover:text-cat">
                Audit log
              </h3>
              <p className="text-[11px] text-ink-3">Son aksiyonlar (KVKK 5 yıl)</p>
            </div>
          </Link>
        </div>
      </section>

      <Link
        href={'/admin' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Pano&apos;ya dön
      </Link>
    </main>
  );
}

function DataLink({
  href,
  emoji,
  title,
  count,
  suffix,
}: {
  href: string;
  emoji: string;
  title: string;
  count: number;
  suffix?: string;
}) {
  return (
    <Link
      href={href as never}
      data-data-link={href}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 hover:border-cat hover:shadow-sm transition-shadow"
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-cat-soft text-2xl">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-cart group-hover:text-cat">
          {title}
        </h3>
        <p className="text-[11px] text-ink-3">
          <strong className="font-mono text-ink">{count}</strong>{' '}
          {suffix ?? 'kayıt'}
        </p>
      </div>
    </Link>
  );
}

interface SettingsCardProps {
  href: string;
  emoji: string;
  title: string;
  desc: string;
  status: { kind: 'ok' | 'warning' | 'danger' | 'pending'; label: string };
}

function SettingsCard({ href, emoji, title, desc, status }: SettingsCardProps) {
  const statusClasses: Record<string, string> = {
    ok: 'bg-arrow-soft text-arrow-7',
    warning: 'bg-cat-soft text-cart',
    danger: 'bg-danger-soft text-danger-7',
    pending: 'bg-line-soft text-ink-2',
  };

  return (
    <Link
      href={href as never}
      data-settings-card={href}
      className="group flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 hover:border-cat hover:shadow-[var(--shadow-sm)] transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-3xl">{emoji}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClasses[status.kind]}`}
        >
          {status.label}
        </span>
      </div>
      <div>
        <h2 className="text-base font-bold text-cart group-hover:text-cat">{title}</h2>
        <p className="mt-1 text-xs text-ink-3">{desc}</p>
      </div>
    </Link>
  );
}
