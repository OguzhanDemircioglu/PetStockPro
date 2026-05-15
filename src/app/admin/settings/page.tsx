import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies, users } from '@/db/schema';

export default async function SettingsHubPage() {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    redirect('/login' as never);
  }

  const [companyRow, userRow] = await Promise.all([
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
  ]);

  const company = companyRow[0];
  const user = userRow[0];
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <SettingsCard key={c.href} {...c} />
        ))}
      </div>

      <Link
        href={'/admin' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Pano&apos;ya dön
      </Link>
    </main>
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
