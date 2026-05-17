import { redirect } from 'next/navigation';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies, productVariants, products, branchInventory } from '@/db/schema';
import { isSuperadmin } from '@/lib/superadmin/access';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AdminTopbar } from '@/components/admin-topbar';
import { SuperadminToolbox } from '@/components/superadmin-toolbox';
import { planProductLimit } from '@/lib/constants/plan-limits';
import { unreadCountForUser } from '@/lib/notifications/manage';

/**
 * /admin/* layout — sidebar (brand + nav + plan) + main content area.
 *
 * Sidebar persistent (sticky), Toolbox FAB sadece SUPERADMIN için.
 * lg+ breakpoint'inde sidebar görünür; mobil'de gizli (Faz 2'de hamburger).
 *
 * Plan progress ve düşük stok badge'i için lightweight 3 query (companies +
 * products count + branch_inventory low stock count). Bu data Pano sayfasında
 * tekrar fetch ediliyor (KPI için) — küçük overhead, kabul edilebilir.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const showToolbox = isSuperadmin(session);

  const [companyRow, productCountRow, lowStockRow, unreadCount] = await Promise.all([
    db
      .select({ name: companies.name, plan: companies.plan })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .limit(1),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(products)
      .where(
        and(
          eq(products.companyId, session.user.companyId),
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
          eq(branchInventory.companyId, session.user.companyId),
          eq(productVariants.isActive, true),
          sql`${branchInventory.stockQty} <= COALESCE(
            (${productVariants.branchThresholds} ->> ${branchInventory.branchId}::text)::int,
            ${productVariants.threshold}
          )`,
        ),
      ),
    unreadCountForUser(session.user.companyId, session.user.id, db),
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
        <AdminTopbar
          userEmail={session.user.email ?? ''}
          unreadCount={unreadCount}
          isSuperadmin={showToolbox}
        />
        <div className="flex-1">{children}</div>
      </div>
      {showToolbox && <SuperadminToolbox />}
    </div>
  );
}
