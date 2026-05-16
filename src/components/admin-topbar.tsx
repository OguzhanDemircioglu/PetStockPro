'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NotificationBell } from './notification-bell';

interface Props {
  userEmail: string;
  unreadCount: number;
  isSuperadmin?: boolean;
}

const TITLE_BY_PATH: { match: RegExp | string; title: string }[] = [
  { match: '/admin', title: 'Pano' },
  { match: /^\/admin\/products(\/.*)?$/, title: 'Ürünler' },
  { match: /^\/admin\/stock-movements(\/.*)?$/, title: 'Stok hareketleri' },
  { match: /^\/admin\/stocktake(\/.*)?$/, title: 'Sayım' },
  { match: /^\/admin\/low-stock(\/.*)?$/, title: 'Düşük stok' },
  { match: /^\/admin\/suppliers(\/.*)?$/, title: 'Tedarikçiler' },
  { match: /^\/admin\/branches(\/.*)?$/, title: 'Şubeler' },
  { match: /^\/admin\/brands(\/.*)?$/, title: 'Markalar' },
  { match: /^\/admin\/categories(\/.*)?$/, title: 'Kategoriler' },
  { match: /^\/admin\/reports(\/.*)?$/, title: 'Raporlar' },
  { match: /^\/admin\/audit-log(\/.*)?$/, title: 'Audit log' },
  { match: /^\/admin\/notifications(\/.*)?$/, title: 'Bildirimler' },
  { match: /^\/admin\/settings\/storefront(\/.*)?$/, title: 'Vitrin profili' },
  { match: /^\/admin\/settings(\/.*)?$/, title: 'Ayarlar' },
  { match: /^\/admin\/account(\/.*)?$/, title: 'Hesabım' },
  { match: /^\/admin\/security(\/.*)?$/, title: 'Güvenlik' },
  { match: /^\/admin\/superadmin\/vitrin-moderation(\/.*)?$/, title: 'Vitrin moderasyon' },
  { match: /^\/admin\/superadmin\/db-inspector(\/.*)?$/, title: 'DB Inspector' },
  { match: /^\/admin\/superadmin\/system-settings(\/.*)?$/, title: 'Sistem ayarları' },
  { match: /^\/admin\/superadmin(\/.*)?$/, title: 'Süperadmin' },
];

function pathTitle(path: string): string {
  for (const entry of TITLE_BY_PATH) {
    if (typeof entry.match === 'string') {
      if (path === entry.match) return entry.title;
    } else if (entry.match.test(path)) {
      return entry.title;
    }
  }
  return 'Admin';
}

function initials(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

const TR_DATE = new Intl.DateTimeFormat('tr-TR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function AdminTopbar({ userEmail, unreadCount, isSuperadmin }: Props) {
  const pathname = usePathname();
  const title = pathTitle(pathname);
  const dateLabel = TR_DATE.format(new Date());

  return (
    <header
      data-testid="admin-topbar"
      className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/95 px-6 py-3 backdrop-blur"
    >
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-bold text-cart">{title}</div>
        <div className="truncate text-[10.5px] text-ink-3">{dateLabel}</div>
      </div>

      <div className="flex-1" />

      {/* ⌘K placeholder — Faz 2'de command palette */}
      <div
        data-testid="topbar-cmdk"
        className="hidden items-center gap-2 rounded-xl border border-line bg-line-soft/60 px-3 py-1.5 text-[11.5px] text-ink-3 sm:flex"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        Ara…
        <kbd className="rounded border border-line bg-white px-1 text-[10px] font-mono text-ink-4">
          ⌘K
        </kbd>
      </div>

      <Link
        href={'/vitrin' as never}
        target="_blank"
        rel="noreferrer noopener"
        data-testid="topbar-vitrin"
        className="rounded-xl border border-line bg-white px-3 py-1.5 text-[11.5px] font-bold text-cart hover:bg-cat-soft"
      >
        🏪 Vitrin ↗
      </Link>

      {isSuperadmin && (
        <Link
          href={'/admin/superadmin' as never}
          data-testid="topbar-superadmin"
          className="rounded-xl border border-cat/40 bg-cat-soft px-3 py-1.5 text-[11.5px] font-bold text-cart hover:bg-cat hover:text-white"
        >
          🛡 Süperadmin
        </Link>
      )}

      <NotificationBell unreadCount={unreadCount} />

      <Link
        href={'/admin/account' as never}
        data-testid="topbar-avatar"
        title={userEmail}
        className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-cart to-cart-2 text-[11px] font-bold text-white shadow-sm hover:scale-105 transition-transform"
      >
        {initials(userEmail)}
      </Link>
    </header>
  );
}
