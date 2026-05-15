/**
 * Stock UI option helpers — Sprint 4.1
 *
 * Drawer'larda dropdown için: tenant'ın aktif şubeleri + aktif variantları
 * (product adıyla birlikte) + tedarikçiler.
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  branches,
  productVariants,
  products,
  suppliers,
} from '@/db/schema';

export interface BranchOption {
  id: string;
  name: string;
}

export interface VariantOption {
  id: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  defaultSalePrice: string;
}

export interface SupplierOption {
  id: string;
  name: string;
}

export async function listBranchOptions(
  companyId: string,
  db: DbClient,
): Promise<BranchOption[]> {
  return db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(eq(branches.companyId, companyId), eq(branches.isActive, true)))
    .orderBy(asc(branches.name));
}

export async function listVariantOptions(
  companyId: string,
  db: DbClient,
  limit: number = 500,
): Promise<VariantOption[]> {
  return db
    .select({
      id: productVariants.id,
      productId: products.id,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      defaultSalePrice: productVariants.salePrice,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(productVariants.companyId, companyId),
        eq(productVariants.isActive, true),
        eq(products.isActive, true),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .orderBy(asc(products.name), asc(productVariants.displayOrder))
    .limit(limit);
}

export async function listSupplierOptions(
  companyId: string,
  db: DbClient,
): Promise<SupplierOption[]> {
  return db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(and(eq(suppliers.companyId, companyId), eq(suppliers.isActive, true)))
    .orderBy(asc(suppliers.name));
}
