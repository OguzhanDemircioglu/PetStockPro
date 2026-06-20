import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { isSuperadmin } from '@/lib/superadmin/access';
import { readImpersonation } from '@/lib/superadmin/impersonate';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AdminShell } from '@/components/admin-shell';
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

  // Faz 4B sağlamlaştırma: 4 ayrı withTenant transaction'ı max:1 pooler'da AYNI ANDA
  // (Promise.all) çalıştırmak Fluid Compute'ta bağlantı çekişmesi + statement timeout
  // → TÜM admin panelinin çökmesine yol açıyordu. Çözüm:
  //   (a) SIRALI — her seferinde tek transaction (çekişme yok),
  //   (b) DEFANSİF — bir okuma takılır/başarısız olursa varsayılana düş; sidebar rozeti
  //       eksik kalabilir ama panel ASLA komple çökmez.
  const safeRead = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch {
      return fallback;
    }
  };
  const company = await safeRead(getCompanyById(effectiveCompanyId), null);
  const productCount = await safeRead(getProductCountForCompany(effectiveCompanyId), 0);
  const lowStockCount = await safeRead(getLowStockCountForCompany(effectiveCompanyId), 0);
  const unreadCount = await safeRead(
    getUnreadNotificationCount(effectiveCompanyId, session.user.id),
    0,
  );

  const tenantName = company?.name ?? 'Pet shop';
  const plan = company?.plan ?? 'FREE';
  const rawLimit = planProductLimit(plan);
  const productLimit = rawLimit === Infinity ? 0 : rawLimit;

  // Derived plan values — hem AdminSidebar hem AdminMobileDrawer için ortak.
  const petShopMatch = tenantName.match(/^(.+?)\s*(pet\s*shop|petshop)\s*$/i);
  const displayName = petShopMatch ? petShopMatch[1].trim() : tenantName;
  const planLabelMap: Record<typeof plan, string> = { FREE: 'FREE', PRO: 'PRO', PRO_PLUS: 'PRO+' };
  const planLabel = planLabelMap[plan];
  const planLimitLabel = productLimit === 0 ? '∞' : String(productLimit);
  const usagePct = productLimit > 0 ? Math.min(100, (productCount / productLimit) * 100) : 0;
  const isNearLimit = productLimit > 0 && usagePct >= 80;

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <AdminSidebar
        tenantName={tenantName}
        plan={plan}
        productCount={productCount}
        productLimit={productLimit}
        lowStockCount={lowStockCount}
        unreadNotifications={unreadCount}
        isSuperadmin={showToolbox}
        isImpersonating={!!impersonation}
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
            className="border-b border-cat/30 bg-cat-soft px-4 py-2 text-[12.5px] font-bold text-cart sm:px-6"
          >
            🔍 İzleyici modundasın — tenantın tüm verilerini görebilirsin, ama
            hiçbir aksiyon yapamazsın (satış, ürün, sayım, transfer, ayar).
          </div>
        )}
        <AdminShell
          userEmail={session.user.email ?? ''}
          unreadCount={unreadCount}
          isSuperadmin={showToolbox}
          isObserver={isObserverRole}
          isImpersonating={!!impersonation}
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
        >
          {children}
        </AdminShell>
      </div>
      {showToolbox && <SuperadminToolbox />}
    </div>
  );
}
