/**
 * Tek tenant inceleme — Süperadmin perspektifi.
 * Sistem geneli bilgi (user listesi + stok özeti + son hareketler + son audit).
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  companies,
  users,
  branches,
  products,
  stockMovements,
  productVariants,
  auditLogs,
} from '@/db/schema';

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  vatNo: string | null;
  whatsappPhone: string | null;
  storefrontStatus: string;
  createdAt: Date;
  userCount: number;
  productCount: number;
  branchCount: number;
  totalStockQty: number;
  movements24h: number;
}

export async function getTenantDetail(
  companyId: string,
  db: DbClient,
): Promise<TenantDetail | null> {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      plan: companies.plan,
      vatNo: companies.vatNo,
      whatsappPhone: companies.whatsappPhone,
      storefrontStatus: companies.storefrontStatus,
      createdAt: companies.createdAt,
      userCount: sql<number>`(SELECT COUNT(*)::int FROM petstockpro.users u WHERE u.company_id = petstockpro.companies.id)`,
      productCount: sql<number>`(SELECT COUNT(*)::int FROM petstockpro.products p WHERE p.company_id = petstockpro.companies.id AND p.deleted_at IS NULL)`,
      branchCount: sql<number>`(SELECT COUNT(*)::int FROM petstockpro.branches b WHERE b.company_id = petstockpro.companies.id AND b.is_active = true)`,
      totalStockQty: sql<number>`COALESCE((SELECT SUM(p.total_stock_qty)::int FROM petstockpro.products p WHERE p.company_id = petstockpro.companies.id AND p.deleted_at IS NULL), 0)`,
      movements24h: sql<number>`(SELECT COUNT(*)::int FROM petstockpro.stock_movements sm WHERE sm.company_id = petstockpro.companies.id AND sm.created_at > NOW() - INTERVAL '24 hours')`,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return rows[0] as TenantDetail | null;
}

export interface TenantUserRow {
  id: string;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
  twoFactorEnabled: boolean;
  lockedUntil: Date | null;
  createdAt: Date;
}

export async function listTenantUsers(
  companyId: string,
  db: DbClient,
): Promise<TenantUserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      twoFactorEnabled: users.twoFactorEnabled,
      lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.companyId, companyId))
    .orderBy(desc(users.createdAt));
  return rows as TenantUserRow[];
}

export interface TenantMovementRow {
  id: string;
  type: string;
  subtype: string | null;
  quantity: number;
  afterQty: number;
  productName: string;
  variantLabel: string;
  branchName: string | null;
  createdAt: Date;
  performedAsSuperadmin: boolean;
}

export async function listTenantMovements(
  companyId: string,
  db: DbClient,
  limit: number = 15,
): Promise<TenantMovementRow[]> {
  const rows = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      subtype: stockMovements.subtype,
      quantity: stockMovements.quantity,
      afterQty: stockMovements.afterQty,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      branchName: branches.name,
      createdAt: stockMovements.createdAt,
      performedAsSuperadmin: stockMovements.performedAsSuperadmin,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(branches, eq(branches.id, stockMovements.branchId))
    .where(eq(stockMovements.companyId, companyId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
  return rows as TenantMovementRow[];
}

export interface TenantAuditRow {
  id: string;
  action: string;
  entityType: string | null;
  userEmail: string | null;
  performedAsSuperadmin: boolean;
  createdAt: Date;
}

export async function listTenantAudit(
  companyId: string,
  db: DbClient,
  limit: number = 15,
): Promise<TenantAuditRow[]> {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      userEmail: users.email,
      performedAsSuperadmin: auditLogs.performedAsSuperadmin,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(and(eq(auditLogs.companyId, companyId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  return rows as TenantAuditRow[];
}
