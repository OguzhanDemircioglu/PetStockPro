/**
 * Süperadmin tenant listesi + sistem geneli istatistikler.
 */

import { sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  companies,
  users,
  products,
  stockMovements,
  notifications,
  subscriptions,
} from '@/db/schema';

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  vatNo: string | null;
  storefrontStatus: string;
  userCount: number;
  productCount: number;
  branchCount: number;
  totalStockQty: number;
  createdAt: Date;
}

export async function listAllTenants(
  db: DbClient,
  limit: number = 100,
): Promise<TenantSummary[]> {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      plan: companies.plan,
      vatNo: companies.vatNo,
      storefrontStatus: companies.storefrontStatus,
      userCount: sql<number>`(SELECT COUNT(*)::int FROM petstockpro.users u WHERE u.company_id = petstockpro.companies.id)`,
      productCount: sql<number>`(SELECT COUNT(*)::int FROM petstockpro.products p WHERE p.company_id = petstockpro.companies.id AND p.deleted_at IS NULL)`,
      branchCount: sql<number>`(SELECT COUNT(*)::int FROM petstockpro.branches b WHERE b.company_id = petstockpro.companies.id AND b.is_active = true)`,
      totalStockQty: sql<number>`COALESCE((SELECT SUM(p.total_stock_qty)::int FROM petstockpro.products p WHERE p.company_id = petstockpro.companies.id AND p.deleted_at IS NULL), 0)`,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .orderBy(sql`${companies.createdAt} DESC`)
    .limit(limit);

  return rows as TenantSummary[];
}

export interface SystemStats {
  tenantCount: number;
  activeTenantCount: number;
  totalUsers: number;
  totalProducts: number;
  totalMovementsLast24h: number;
  unreadNotificationsAll: number;
  proSubscriptions: number;
  proPlusSubscriptions: number;
}

export async function getSystemStats(db: DbClient): Promise<SystemStats> {
  const rows = await db
    .select({
      tenantCount: sql<number>`(SELECT COUNT(*)::int FROM ${companies})`,
      activeTenantCount: sql<number>`(SELECT COUNT(*)::int FROM ${companies} WHERE ${companies.storefrontStatus} = 'approved')`,
      totalUsers: sql<number>`(SELECT COUNT(*)::int FROM ${users})`,
      totalProducts: sql<number>`(SELECT COUNT(*)::int FROM ${products} WHERE ${products.deletedAt} IS NULL)`,
      totalMovementsLast24h: sql<number>`(SELECT COUNT(*)::int FROM ${stockMovements} WHERE ${stockMovements.createdAt} > NOW() - INTERVAL '24 hours')`,
      unreadNotificationsAll: sql<number>`(SELECT COUNT(*)::int FROM ${notifications} WHERE ${notifications.readAt} IS NULL)`,
      proSubscriptions: sql<number>`(SELECT COUNT(*)::int FROM ${subscriptions} WHERE ${subscriptions.plan} = 'PRO' AND ${subscriptions.status} = 'active')`,
      proPlusSubscriptions: sql<number>`(SELECT COUNT(*)::int FROM ${subscriptions} WHERE ${subscriptions.plan} = 'PRO_PLUS' AND ${subscriptions.status} = 'active')`,
    })
    .from(sql`(SELECT 1) AS dummy`);

  return (rows[0] ?? {
    tenantCount: 0,
    activeTenantCount: 0,
    totalUsers: 0,
    totalProducts: 0,
    totalMovementsLast24h: 0,
    unreadNotificationsAll: 0,
    proSubscriptions: 0,
    proPlusSubscriptions: 0,
  }) as SystemStats;
}
