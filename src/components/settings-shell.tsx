import Link from 'next/link';

/**
 * Settings Shell — kalıcı sol sidebar + içerik alanı.
 *
 * Sprint 2.10: /admin/settings/* + /admin/account + /admin/security + /admin/audit-log
 * sayfalarına ortak nav (Stripe-style sidebar). URL'leri değiştirmedik — her sayfa
 * shell'i kendi sarmalar, `current` prop ile aktif itemi işaretler.
 *
 * Bir sonraki refactor: bu pages /admin/settings/* altına taşınabilir, layout.tsx'e dönüşebilir.
 */
export type SettingsSection =
  | 'overview'
  | 'company'
  | 'storefront'
  | 'users'
  | 'notifications'
  | 'account'
  | 'security'
  | 'audit'
  | 'export';

export interface SettingsNavItem {
  key: SettingsSection;
  href: string;
  emoji: string;
  label: string;
  hint?: string;
}

const NAV: SettingsNavItem[] = [
  { key: 'overview', href: '/admin/settings', emoji: '📊', label: 'Genel Bakış' },
  { key: 'company', href: '/admin/settings/company', emoji: '🏢', label: 'Firma' },
  { key: 'storefront', href: '/admin/settings/storefront', emoji: '🌐', label: 'Vitrin Profili' },
  { key: 'users', href: '/admin/settings/users', emoji: '👥', label: 'Kullanıcılar' },
  { key: 'notifications', href: '/admin/settings/notifications', emoji: '🔔', label: 'Bildirimler' },
  { key: 'account', href: '/admin/account', emoji: '👤', label: 'Hesap' },
  { key: 'security', href: '/admin/security', emoji: '🛡', label: 'Güvenlik' },
  { key: 'audit', href: '/admin/audit-log', emoji: '📜', label: 'Audit Log' },
  { key: 'export', href: '/admin/settings/export', emoji: '⬇', label: 'Verilerimi İndir' },
];

export function SettingsShell({
  current,
  title,
  description,
  children,
}: {
  current: SettingsSection;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header>
        <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Ayarlar
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-ink-3">{description}</p>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <SettingsNav current={current} />
        <div className="min-w-0">{children}</div>
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

function SettingsNav({ current }: { current: SettingsSection }) {
  return (
    <nav
      aria-label="Ayarlar"
      className="flex flex-col gap-1 self-start lg:sticky lg:top-6"
      data-settings-nav={current}
    >
      {NAV.map((item) => {
        const isActive = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href as never}
            aria-current={isActive ? 'page' : undefined}
            data-settings-link={item.key}
            className={
              isActive
                ? 'flex items-center gap-3 rounded-xl border border-cat bg-cat-soft px-4 py-2.5 text-sm font-bold text-cart shadow-[var(--shadow-sm)]'
                : 'flex items-center gap-3 rounded-xl border border-transparent px-4 py-2.5 text-sm text-ink-2 hover:border-line hover:bg-paper'
            }
          >
            <span aria-hidden className="text-lg">
              {item.emoji}
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
