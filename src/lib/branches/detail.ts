/**
 * Branch detay sayfası için veri toplama — variant stok matrix + son hareketler
 * + atanmış kullanıcılar (müdür + STAFF).
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  branchInventory,
  productVariants,
  products,
  stockMovements,
  users,
} from '@/db/schema';

export interface BranchVariantStock {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  stockQty: number;
  threshold: number;
  isLow: boolean; // stockQty <= threshold
  isZero: boolean;
}

export interface BranchMovementRow {
  id: string;
  type: string;
  subtype: string | null;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  productName: string;
  variantLabel: string;
  createdAt: Date;
  createdByEmail: string | null;
  reason: string | null;
}

/**
 * Belirli şubeye ait variant stok listesi. Tüm aktif variant'lar görünür,
 * branch_inventory satırı yoksa stock=0 olarak gösterilir.
 */
export async function listBranchVariantStock(
  companyId: string,
  branchId: string,
  db: DbClient,
): Promise<BranchVariantStock[]> {
  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: productVariants.productId,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      stockQty: sql<number>`COALESCE(${branchInventory.stockQty}, 0)::int`,
      threshold: productVariants.threshold,
      branchThresholds: productVariants.branchThresholds,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(
      branchInventory,
      and(
        eq(branchInventory.variantId, productVariants.id),
        eq(branchInventory.branchId, branchId),
      ),
    )
    .where(and(eq(productVariants.companyId, companyId), eq(productVariants.isActive, true)))
    .orderBy(products.name, productVariants.displayOrder);

  return rows.map((r) => {
    const perBranchThreshold = r.branchThresholds?.[branchId];
    const threshold = perBranchThreshold ?? r.threshold;
    return {
      variantId: r.variantId,
      productId: r.productId,
      productName: r.productName,
      variantLabel: r.variantLabel,
      sku: r.sku,
      stockQty: r.stockQty,
      threshold,
      isLow: r.stockQty <= threshold,
      isZero: r.stockQty === 0,
    };
  });
}

/**
 * Şubedeki son N stok hareketi.
 */
export async function listBranchRecentMovements(
  companyId: string,
  branchId: string,
  db: DbClient,
  limit: number = 12,
): Promise<BranchMovementRow[]> {
  const rows = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      subtype: stockMovements.subtype,
      quantity: stockMovements.quantity,
      beforeQty: stockMovements.beforeQty,
      afterQty: stockMovements.afterQty,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      createdAt: stockMovements.createdAt,
      createdByEmail: users.email,
      reason: stockMovements.reason,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(users, eq(users.id, stockMovements.createdById))
    .where(
      and(eq(stockMovements.companyId, companyId), eq(stockMovements.branchId, branchId)),
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);

  return rows as BranchMovementRow[];
}

// ─────────────────────────────────────────────────────────────────
// ASSIGNED USERS (manager + staff) — Branch detail "👤 Şube müdürü" kart
// ─────────────────────────────────────────────────────────────────

export interface BranchUserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export interface BranchAssignedUsers {
  /** En fazla 1 (DB-level partial unique index garanti eder). */
  manager: BranchUserRow | null;
  /** O şubeye atanmış STAFF kullanıcılar. */
  staff: BranchUserRow[];
}

/**
 * Belirli şubeye atanmış kullanıcılar — SUBE_MUDURU (en fazla 1) + STAFF dizisi.
 * BAYI_SAHIBI / SUPERADMIN tenant geneli olduğu için branchId null'dur ve burada
 * görünmez.
 */
export async function listBranchAssignedUsers(
  companyId: string,
  branchId: string,
  db: DbClient,
): Promise<BranchAssignedUsers> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.branchId, branchId)))
    .orderBy(asc(users.role), asc(users.createdAt));

  const manager = (rows.find((r) => r.role === 'SUBE_MUDURU') as BranchUserRow | undefined) ?? null;
  const staff = rows.filter((r) => r.role === 'STAFF') as BranchUserRow[];
  return { manager, staff };
}
