'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getBottomTabs, isLinkActive } from './admin-nav-config';

interface Props {
  unreadNotifications: number;
  onMoreClick: () => void;
  isSuperadmin?: boolean;
  isImpersonating?: boolean;
}

/**
 * Mobile-only sticky bottom tab bar. Desktop'ta gizli (md:hidden).
 *
 * 5 sekme: Pano · Ürünler · Hareket · Bildirim (badge) · Daha (drawer aç).
 * Safe-area-inset-bottom destekli — iOS Safari ev butonu/notch'ında doğru padding.
 */
export function AdminBottomTabs({ unreadNotifications, onMoreClick, isSuperadmin = false, isImpersonating = false }: Props) {
  const pathname = usePathname();
  const tabs = getBottomTabs(isSuperadmin, isImpersonating);

  return (
    <nav
      data-testid="admin-bottom-tabs"
      aria-label="Ana navigasyon"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-line bg-paper/95 backdrop-blur-xl shadow-[0_-4px_16px_rgba(0,0,0,.08)] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map((tab) => {
        const active = isLinkActive(pathname, tab);
        const badge =
          tab.badgeKey === 'notifications' && unreadNotifications > 0
            ? unreadNotifications
            : undefined;

        const inner = (
          <>
            <span
              aria-hidden
              className={`relative inline-flex h-6 w-6 items-center justify-center text-[18px] leading-none ${
                active ? 'scale-110' : ''
              } transition-transform`}
            >
              {tab.icon}
              {badge !== undefined && (
                <span className="absolute -top-1 -right-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span
              className={`mt-0.5 text-[10.5px] font-bold leading-none ${
                active ? 'text-cat' : 'text-ink-3'
              }`}
            >
              {tab.label}
            </span>
          </>
        );

        const base =
          'flex flex-1 flex-col items-center justify-center gap-0 px-1 py-1.5 transition-colors';

        if (tab.isMore) {
          return (
            <button
              key="more"
              type="button"
              onClick={onMoreClick}
              data-bottom-tab="more"
              aria-label="Daha fazla menü"
              className={`${base} text-ink-3 hover:text-cat`}
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href as never}
            data-bottom-tab={tab.href}
            data-active={active ? '1' : '0'}
            className={`${base} ${active ? 'text-cat' : 'text-ink-3 hover:text-cat'}`}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
