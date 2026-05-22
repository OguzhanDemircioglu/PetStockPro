'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/login/actions';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from './theme/theme-toggle';
import { AnimatedShinyText } from './magicui/animated-shiny-text';

interface Props {
  userEmail: string;
  unreadCount: number;
  isSuperadmin?: boolean;
  /** Faz 8 (2026-05-21) — OBSERVER (İzleyici) sticky banner + topbar rozet. */
  isObserver?: boolean;
  /** Mobil drawer toggle. AdminShell sağlar. */
  onMenuClick?: () => void;
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

export function AdminTopbar({ userEmail, unreadCount, isSuperadmin, isObserver, onMenuClick }: Props) {
  const pathname = usePathname();
  const title = pathTitle(pathname);
  const dateLabel = TR_DATE.format(new Date());

  return (
    <header
      data-testid="admin-topbar"
      className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-paper/75 px-3 py-3 backdrop-blur-xl sm:gap-3 sm:px-6"
    >
      {/* Hamburger — mobile only */}
      {onMenuClick && (
        <button
          type="button"
          data-testid="topbar-menu"
          onClick={onMenuClick}
          aria-label="Menüyü aç"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-paper text-ink-2 transition-colors hover:border-cat hover:text-cat md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      <div className="min-w-0 flex-1 sm:flex-initial">
        <div className="truncate text-[15.5px] font-bold tracking-tight text-cart">
          <AnimatedShinyText>{title}</AnimatedShinyText>
        </div>
        <div className="hidden truncate text-[12px] text-ink-3 font-bold sm:block">{dateLabel}</div>
      </div>

      <div className="hidden flex-1 sm:block" />

      {/* ⌘K placeholder — Faz 2'de command palette */}
      <div
        data-testid="topbar-cmdk"
        className="hidden items-center gap-2 rounded-xl border border-line bg-line-soft/60 px-3 py-1.5 text-[13px] text-ink-3 transition-colors hover:border-cat hover:text-cat lg:flex lg:min-w-[200px]"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        Ara…
        <kbd className="ml-auto rounded border border-line bg-paper px-1 text-[11.5px] font-mono text-ink-4">
          ⌘K
        </kbd>
      </div>

      <ThemeToggle />

      <Link
        href={'/vitrin' as never}
        target="_blank"
        rel="noreferrer noopener"
        data-testid="topbar-vitrin"
        title="Public vitrin (yeni sekme)"
        className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-arrow to-arrow-2 px-2.5 py-2 text-[13px] font-bold text-white shadow-[var(--shadow-arrow)] hover:-translate-y-px transition-transform lg:px-3.5"
      >
        <span aria-hidden>🏪</span>
        <span className="hidden lg:inline">Vitrin ↗</span>
      </Link>

      {isSuperadmin && !pathname.startsWith('/admin/superadmin') && (
        <Link
          href={'/admin/superadmin' as never}
          data-testid="topbar-superadmin"
          aria-label="Süperadmin paneli"
          className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-danger/40 bg-danger-soft px-2.5 py-1.5 text-[13px] font-bold text-danger-7 hover:bg-danger hover:text-white transition-colors md:px-3"
        >
          <span aria-hidden>🛡</span>
          <span className="hidden md:inline">Süperadmin</span>
        </Link>
      )}

      {isObserver && (
        <span
          data-testid="topbar-observer-badge"
          title="İzleyici — sadece okur, hiçbir aksiyon yapamaz"
          className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-cat/40 bg-cat-soft px-2.5 py-1.5 text-[12.5px] font-bold text-cart md:px-3"
        >
          <span aria-hidden>🔍</span>
          <span className="hidden md:inline">İzleyici</span>
        </span>
      )}

      <NotificationBell unreadCount={unreadCount} />

      <Link
        href={'/admin/account' as never}
        data-testid="topbar-avatar"
        title={userEmail}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cat to-cart text-[12.5px] font-bold text-white border-2 border-paper hover:scale-105 transition-transform"
      >
        {initials(userEmail)}
      </Link>

      <form action={logoutAction} className="hidden sm:block">
        <button
          type="submit"
          data-testid="topbar-logout"
          title="Çıkış yap"
          aria-label="Çıkış yap"
          className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-paper text-ink-3 hover:border-danger/40 hover:bg-danger-soft hover:text-danger-7 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </form>
    </header>
  );
}
