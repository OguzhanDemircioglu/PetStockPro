import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { isSuperadmin } from '@/lib/superadmin/access';
import { readImpersonation } from '@/lib/superadmin/impersonate';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AdminTopbar } from '@/components/admin-topbar';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { SuperadminToolbox } from '@/components/superadmin-toolbox';
import { planProductLimit } from '@/lib/constants/plan-limits';
// Tur 2 (P0-2): request-scoped cache — layout + pano duplicate query elimine
import {
  getCompanyById,
  getProductCountForCompany,
  getLowStockCountForCompany,
  getUnreadNotificationCount,
} from '@/lib/cache/request-scoped';

/**
 * /admin/* layout — sidebar (brand + nav + plan) + main content area.
 *
 * Süperadmin impersonation: `pp-impersonate-tenant` cookie varsa ve aktif kullanıcı
 * SUPERADMIN ise, sayfa o tenant'ın verileriyle render edilir. Sticky banner üstte.
 * Non-SUPERADMIN için cookie yok sayılır (silent reject).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const showToolbox = isSuperadmin(session);
  // Faz 8 (2026-05-21) — OBSERVER (İzleyici) read-only sticky banner + topbar rozet.
  const isObserverRole = session.user.role === 'OBSERVER';

  // Impersonation: SUPERADMIN için cookie'den effective companyId
  const impersonation = showToolbox
    ? await readImpersonation(session.user.id, session.user.email ?? '')
    : null;
  const effectiveCompanyId = impersonation?.companyId ?? session.user.companyId;

  // Tur 2 (P0-2): React.cache wrap'li helper'lar — pano helper'larıyla request-scoped
  // dedupe, aynı request içinde ikinci çağrı 0 DB roundtrip.
  const [company, productCount, lowStockCount, unreadCount] = await Promise.all([
    getCompanyById(effectiveCompanyId),
    getProductCountForCompany(effectiveCompanyId),
    getLowStockCountForCompany(effectiveCompanyId),
    getUnreadNotificationCount(effectiveCompanyId, session.user.id),
  ]);

  const tenantName = company?.name ?? 'Pet shop';
  const plan = company?.plan ?? 'FREE';
  const rawLimit = planProductLimit(plan);
  const productLimit = rawLimit === Infinity ? 0 : rawLimit;

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <AdminSidebar
        tenantName={tenantName}
        plan={plan}
        productCount={productCount}
        productLimit={productLimit}
        lowStockCount={lowStockCount}
        isSuperadmin={showToolbox}
      />
      <div className="flex min-h-screen flex-1 min-w-0 flex-col">
        {impersonation && (
          <ImpersonationBanner
            companyName={impersonation.companyName}
            impersonatorEmail={impersonation.impersonatorEmail}
          />
        )}
        {isObserverRole && (
          <div
            role="status"
            data-testid="observer-readonly-banner"
            className="border-b border-cat/30 bg-cat-soft px-6 py-2 text-[12.5px] font-bold text-cart"
          >
            🔍 İzleyici modundasın — tenantın tüm verilerini görebilirsin, ama
            hiçbir aksiyon yapamazsın (satış, ürün, sayım, transfer, ayar).
          </div>
        )}
        <AdminTopbar
          userEmail={session.user.email ?? ''}
          unreadCount={unreadCount}
          isSuperadmin={showToolbox}
          isObserver={isObserverRole}
        />
        <div className="flex-1">{children}</div>
      </div>
      {showToolbox && <SuperadminToolbox />}
    </div>
  );
}
