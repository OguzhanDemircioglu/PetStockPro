'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  buildSidebarGroups,
  isLinkActive,
  type SidebarGroup,
} from './admin-nav-config';
import { AnimatedShinyText } from './magicui/animated-shiny-text';
import { logoutAction } from '@/app/login/actions';

interface Props {
  open: boolean;
  onClose: () => void;
  tenantName: string;
  displayName: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  planLabel: string;
  planLimitLabel: string;
  productCount: number;
  productLimit: number;
  usagePct: number;
  isNearLimit: boolean;
  lowStockCount: number;
  unreadNotifications: number;
  isSuperadmin: boolean;
  isImpersonating?: boolean;
}

export function AdminMobileDrawer({
  open,
  onClose,
  tenantName,
  displayName,
  plan,
  planLabel,
  planLimitLabel,
  productCount,
  productLimit,
  usagePct,
  isNearLimit,
  lowStockCount,
  unreadNotifications,
  isSuperadmin,
  isImpersonating = false,
}: Props) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastPathRef = useRef(pathname);

  const groups: SidebarGroup[] = buildSidebarGroups({
    lowStockCount,
    unreadNotifications,
    isSuperadmin,
    isImpersonating,
  });

  // Route değişince drawer'ı kapat (link tıklayınca otomatik kapanma).
  useEffect(() => {
    if (lastPathRef.current !== pathname && open) {
      onClose();
    }
    lastPathRef.current = pathname;
  }, [pathname, open, onClose]);

  // ESC tuşu + body scroll lock + initial focus.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    focusable?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      data-testid="admin-mobile-drawer"
      aria-hidden={!open}
      className={`fixed inset-0 z-[60] md:hidden ${open ? '' : 'pointer-events-none'}`}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Menüyü kapat"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Yan menü"
        className={`absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto border-r border-line bg-paper shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header — brand + close */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <Link
            href={'/admin' as never}
            className="text-[18px] font-bold tracking-tight text-cart"
            onClick={onClose}
          >
            <AnimatedShinyText>PetStockPro</AnimatedShinyText>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Menüyü kapat"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-paper text-ink-3 hover:border-cat hover:text-cat transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tenant info */}
        <Link
          href={'/admin' as never}
          onClick={onClose}
          className="flex items-center gap-3 border-b border-line px-4 py-3 hover:bg-line-soft/50 transition-colors"
        >
          <Image
            src="/logo.webp"
            alt="PetStockPro"
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 object-contain"
          />
          <div className="min-w-0 flex-1" title={tenantName}>
            <div className="truncate text-[15px] font-bold text-cart">
              {displayName}
            </div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
              Pet Shop
            </div>
          </div>
        </Link>

        {/* Nav groups */}
        <nav className="flex flex-1 flex-col gap-4 px-3 py-4 text-[14px]" data-testid="mobile-drawer-nav">
          {groups.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-0.5">
              {g.label && (
                <div className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4">
                  {g.label}
                </div>
              )}
              {g.links.map((link) => {
                const active = isLinkActive(pathname, link);
                const badgeToneCls: Record<string, string> = {
                  cat: 'bg-cat text-white',
                  danger: 'bg-danger text-white',
                  arrow: 'bg-arrow text-white',
                };
                return (
                  <Link
                    key={link.href}
                    href={link.href as never}
                    onClick={onClose}
                    data-sidebar-link={link.href}
                    data-active={active ? '1' : '0'}
                    className={
                      active
                        ? 'flex items-center gap-2 rounded-lg bg-gradient-to-r from-cat to-cat-2 px-2.5 py-2.5 font-bold text-white shadow-[0_4px_12px_rgba(212,74,20,.25)]'
                        : 'flex items-center gap-2 rounded-lg px-2.5 py-2.5 font-bold text-ink-2 hover:bg-line-soft hover:text-cart'
                    }
                  >
                    <span
                      aria-hidden
                      className="inline-flex w-5 shrink-0 items-center justify-center text-center leading-none"
                    >
                      {link.icon ?? ''}
                    </span>
                    <span className="flex-1 truncate">{link.label}</span>
                    {link.badge !== undefined && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                          badgeToneCls[link.badgeTone ?? 'cat']
                        }`}
                      >
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Plan card */}
        <div className="border-t border-line bg-line-soft/30 p-3">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cart to-cart-7 p-3 text-white shadow-[0_8px_24px_rgba(26,85,136,.32)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-75">PLAN</div>
                <div className="text-base font-bold">{planLabel}</div>
              </div>
              {isNearLimit && (
                <span className="rounded-full bg-cat px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider">
                  limit
                </span>
              )}
            </div>
            <div className="mt-2">
              <div className="mb-1 flex justify-between text-[12px] font-bold opacity-90">
                <span>Ürün</span>
                <span className="font-mono tabular-nums">
                  {productCount} / {planLimitLabel}
                </span>
              </div>
              {productLimit > 0 ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-white/16">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cat-2 to-cat"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              ) : (
                <div className="h-1.5 rounded-full bg-gradient-to-r from-arrow to-arrow-2" />
              )}
            </div>
            {plan === 'FREE' && (
              <Link
                href={'/admin/settings' as never}
                onClick={onClose}
                className="mt-2 block rounded-[9px] bg-white/18 px-2.5 py-2 text-center text-[12.5px] font-bold text-white hover:bg-white/30 transition-colors"
              >
                PRO&apos;ya geç →
              </Link>
            )}
          </div>

          {/* Logout — mobile drawer'da topbar logout butonu sm altında gizli */}
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              data-testid="drawer-logout"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-[13.5px] font-bold text-ink-2 transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger-7"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Çıkış yap
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
