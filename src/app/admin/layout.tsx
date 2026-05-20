import { redirect } from 'next/navigation';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies, productVariants, products, branchInventory } from '@/db/schema';
import { isSuperadmin } from '@/lib/superadmin/access';
import { readImpersonation } from '@/lib/superadmin/impersonate';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AdminTopbar } from '@/components/admin-topbar';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { SuperadminToolbox } from '@/components/superadmin-toolbox';
import { planProductLimit } from '@/lib/constants/plan-limits';
import { unreadCountForUser } from '@/lib/notifications/manage';

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

  const [companyRow, productCountRow, lowStockRow, unreadCount] = await Promise.all([
    db
      .select({ name: companies.name, plan: companies.plan })
      .from(companies)
      .where(eq(companies.id, effectiveCompanyId))
      .limit(1),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(products)
      .where(
        and(
          eq(products.companyId, effectiveCompanyId),
          isNull(products.deletedAt),
        ),
      ),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(branchInventory)
      .innerJoin(
        productVariants,
        eq(productVariants.id, branchInventory.variantId),
      )
      .where(
        and(
          eq(branchInventory.companyId, effectiveCompanyId),
          eq(productVariants.isActive, true),
          sql`${branchInventory.stockQty} <= COALESCE(
            (${productVariants.branchThresholds} ->> ${branchInventory.branchId}::text)::int,
            ${productVariants.threshold}
          )`,
        ),
      ),
    unreadCountForUser(effectiveCompanyId, session.user.id, db),
  ]);

  const company = companyRow[0];
  const tenantName = company?.name ?? 'Pet shop';
  const plan = company?.plan ?? 'FREE';
  const rawLimit = planProductLimit(plan);
  const productLimit = rawLimit === Infinity ? 0 : rawLimit;
  const productCount = productCountRow[0]?.count ?? 0;
  const lowStockCount = lowStockRow[0]?.count ?? 0;

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
