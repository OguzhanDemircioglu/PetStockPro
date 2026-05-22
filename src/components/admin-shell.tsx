'use client';

import { useState } from 'react';
import { AdminTopbar } from './admin-topbar';
import { AdminMobileDrawer } from './admin-mobile-drawer';
import { AdminBottomTabs } from './admin-bottom-tabs';

interface Props {
  userEmail: string;
  unreadCount: number;
  isSuperadmin: boolean;
  isObserver: boolean;
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
  children: React.ReactNode;
}

/**
 * Client-side admin shell — drawer + bottom tabs state'ini yönetir.
 *
 * Mobile (<768px):
 *  - Topbar'da hamburger butonu drawer'ı açar
 *  - Bottom tab bar 5 sekme, "Daha" drawer'ı açar
 *  - İçerik altına 64px padding (bottom tabs altında)
 *
 * Desktop (>=768px): drawer + bottom tabs gizli, normal sidebar kullanılır.
 */
export function AdminShell({
  userEmail,
  unreadCount,
  isSuperadmin,
  isObserver,
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
  children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <AdminTopbar
        userEmail={userEmail}
        unreadCount={unreadCount}
        isSuperadmin={isSuperadmin}
        isObserver={isObserver}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <div className="flex-1 pb-16 md:pb-0">{children}</div>

      <AdminMobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tenantName={tenantName}
        displayName={displayName}
        plan={plan}
        planLabel={planLabel}
        planLimitLabel={planLimitLabel}
        productCount={productCount}
        productLimit={productLimit}
        usagePct={usagePct}
        isNearLimit={isNearLimit}
        lowStockCount={lowStockCount}
        unreadNotifications={unreadCount}
        isSuperadmin={isSuperadmin}
      />

      <AdminBottomTabs
        unreadNotifications={unreadCount}
        onMoreClick={() => setDrawerOpen(true)}
      />
    </>
  );
}
