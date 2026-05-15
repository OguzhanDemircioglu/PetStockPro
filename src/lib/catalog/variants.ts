/**
 * Product Variants CRUD Helpers — Sprint 3.2 multi-variant editor
 *
 * createVariant + updateVariant + deleteVariant + setDefaultVariant +
 * listVariants + reorderVariants.
 *
 * Pattern: products.ts — pure helper + dependency injection.
 *
 * İnvariantlar:
 * - Her ürünün ≥1 aktif variant'ı vardır (son aktif variant silinemez).
 * - Her ürünün **tek** isDefault=true variant'ı vardır (transaction içinde garanti).
 * - SKU per tenant unique (DB unique index zaten var, helper'da Zod + early check).
 * - branchThresholds jsonb: { branchId: number } — bos object {} normalize edilir.
 */

import { and, asc, eq, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import { productVariants, products, branches } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────

export interface VariantListItem {
  id: string;
  valueLabel: string;
  axisLabel: string;
  sku: string;
  barcode: string | null;
  costPrice: string;
  salePrice: string;
  threshold: number;
  branchThresholds: Record<string, number> | null;
  isActive: boolean;
  isDefault: boolean;
  displayOrder: number;
}

/**
 * Bir ürünün tüm variant'larını sıralı getirir.
 * isActive=false dahil — UI'da gri gösterilir, kullanıcı geri aktive edebilir.
 */
export async function listVariants(
  companyId: string,
  productId: string,
  db: DbClient,
): Promise<VariantListItem[]> {
  const rows = await db
    .select({
      id: productVariants.id,
      valueLabel: productVariants.valueLabel,
      axisLabel: productVariants.axisLabel,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
      costPrice: productVariants.costPrice,
      salePrice: productVariants.salePrice,
      threshold: productVariants.threshold,
      branchThresholds: productVariants.branchThresholds,
      isActive: productVariants.isActive,
      isDefault: productVariants.isDefault,
      displayOrder: productVariants.displayOrder,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.companyId, companyId),
        eq(productVariants.productId, productId),
      ),
    )
    .orderBy(asc(productVariants.displayOrder), asc(productVariants.valueLabel));

  return rows;
}

// ─────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────

const branchThresholdsSchema = z
  .record(z.string().uuid(), z.number().int().min(0).max(9999))
  .optional();

export const createVariantSchema = z.object({
  valueLabel: z.string().min(1, 'Boyut/ambalaj zorunlu').max(50),
  axisLabel: z.string().min(1).max(50).default('Boyut'),
  sku: z.string().min(1, 'SKU zorunlu').max(100),
  barcode: z.string().max(13).nullable().optional(),
  costPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Geçerli fiyat gir (örn 120.50)')
    .default('0'),
  salePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Geçerli fiyat gir'),
  threshold: z.number().int().min(0).max(9999).default(5),
  branchThresholds: branchThresholdsSchema,
});

export type CreateVariantInput = z.input<typeof createVariantSchema>;

export type CreateVariantResult =
  | { ok: true; variantId: string }
  | {
      ok: false;
      reason: 'invalid_input' | 'sku_taken' | 'product_not_found' | 'unknown';
      issues?: string[];
    };

export async function createVariant(
  companyId: string,
  productId: string,
  input: CreateVariantInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<CreateVariantResult> {
  const parsed = createVariantSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // Tenant + product ownership
  const productOwn = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.id, productId),
        eq(products.companyId, companyId),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .limit(1);
  if (productOwn.length === 0) {
    return { ok: false, reason: 'product_not_found' };
  }

  // SKU çakışma
  const skuConflict = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.companyId, companyId),
        eq(productVariants.sku, data.sku),
      ),
    )
    .limit(1);
  if (skuConflict.length > 0) {
    return { ok: false, reason: 'sku_taken' };
  }

  // displayOrder = mevcut maksimumun bir fazlası (sonuna ekle)
  const orderRows = await db
    .select({ max: sql<number | null>`MAX(${productVariants.displayOrder})` })
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
  const nextOrder = (orderRows[0]?.max ?? -1) + 1;

  try {
    const [inserted] = await db
      .insert(productVariants)
      .values({
        companyId,
        productId,
        axisLabel: data.axisLabel,
        valueLabel: data.valueLabel,
        sku: data.sku,
        barcode: data.barcode ?? null,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        threshold: data.threshold,
        branchThresholds: data.branchThresholds ?? null,
        isActive: true,
        isDefault: false, // setDefaultVariant ile manuel ayarlanır
        displayOrder: nextOrder,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: productVariants.id });

    return { ok: true, variantId: inserted.id };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────

export const updateVariantSchema = z.object({
  valueLabel: z.string().min(1).max(50),
  axisLabel: z.string().min(1).max(50).optional(),
  sku: z.string().min(1).max(100),
  barcode: z.string().max(13).nullable().optional(),
  costPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  salePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  threshold: z.number().int().min(0).max(9999),
  branchThresholds: branchThresholdsSchema,
  isActive: z.boolean().optional(),
});

export type UpdateVariantInput = z.input<typeof updateVariantSchema>;

export type UpdateVariantResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'invalid_input' | 'not_found' | 'sku_taken' | 'last_active' | 'unknown';
      issues?: string[];
    };

export async function updateVariant(
  companyId: string,
  variantId: string,
  input: UpdateVariantInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<UpdateVariantResult> {
  const parsed = updateVariantSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  const existing = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      isActive: productVariants.isActive,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.companyId, companyId),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  const current = existing[0];

  // Eğer aktiften pasife düşüyor — son aktif olmamalı (ürünün ≥1 aktif variant'ı şart)
  if (current.isActive && data.isActive === false) {
    const activeCount = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, current.productId),
          eq(productVariants.isActive, true),
        ),
      );
    if ((activeCount[0]?.c ?? 0) <= 1) {
      return { ok: false, reason: 'last_active' };
    }
  }

  // SKU çakışma (kendi variantId hariç)
  const skuConflict = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.companyId, companyId),
        eq(productVariants.sku, data.sku),
        sql`${productVariants.id} != ${variantId}`,
      ),
    )
    .limit(1);
  if (skuConflict.length > 0) {
    return { ok: false, reason: 'sku_taken' };
  }

  try {
    await db
      .update(productVariants)
      .set({
        valueLabel: data.valueLabel,
        axisLabel: data.axisLabel ?? 'Boyut',
        sku: data.sku,
        barcode: data.barcode ?? null,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        threshold: data.threshold,
        branchThresholds: data.branchThresholds ?? null,
        isActive: data.isActive ?? current.isActive,
        updatedAt: now,
      })
      .where(eq(productVariants.id, variantId));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// DELETE (soft via isActive=false, ya da hard delete son aktif değilse)
// ─────────────────────────────────────────────────────────────────

export type DeleteVariantResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_found' | 'last_active' | 'is_default' | 'unknown';
    };

/**
 * Variant'ı **hard delete** eder. branch_inventory + stock_movements
 * ON DELETE CASCADE/RESTRICT trigger'larına bırakılır (stock_movements
 * RESTRICT olduğundan hareketi olan variant silinemez — DB hata atar).
 *
 * Kurallar:
 * - Son aktif variant silinemez (en az 1 aktif kalmalı).
 * - Default variant silinemez — önce başka variant'ı default yap.
 * - DB FK constraint hareket varsa zaten engeller.
 */
export async function deleteVariant(
  companyId: string,
  variantId: string,
  db: DbClient,
): Promise<DeleteVariantResult> {
  const existing = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      isActive: productVariants.isActive,
      isDefault: productVariants.isDefault,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.companyId, companyId),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  const current = existing[0];

  if (current.isDefault) {
    return { ok: false, reason: 'is_default' };
  }

  if (current.isActive) {
    const activeCount = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, current.productId),
          eq(productVariants.isActive, true),
        ),
      );
    if ((activeCount[0]?.c ?? 0) <= 1) {
      return { ok: false, reason: 'last_active' };
    }
  }

  try {
    await db.delete(productVariants).where(eq(productVariants.id, variantId));
    return { ok: true };
  } catch {
    // FK RESTRICT — stock_movements hareketi olan variant
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// SET DEFAULT
// ─────────────────────────────────────────────────────────────────

export type SetDefaultResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'not_active' | 'unknown' };

/**
 * Bu variant'ı isDefault=true yapar, diğer variant'ları false yapar.
 * Transaction: atomik garanti — tek default kalır.
 * Sadece aktif variant default olabilir.
 */
export async function setDefaultVariant(
  companyId: string,
  variantId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<SetDefaultResult> {
  const target = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      isActive: productVariants.isActive,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.companyId, companyId),
      ),
    )
    .limit(1);
  if (target.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  if (!target[0].isActive) {
    return { ok: false, reason: 'not_active' };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(productVariants)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(productVariants.productId, target[0].productId));

      await tx
        .update(productVariants)
        .set({ isDefault: true, updatedAt: now })
        .where(eq(productVariants.id, variantId));
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// REORDER
// ─────────────────────────────────────────────────────────────────

export type ReorderResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_input' | 'mismatch' | 'unknown' };

/**
 * Variant sırasını günceller — orderedVariantIds[i] → displayOrder=i.
 * Sadece bu ürünün variantları listede olmalı + hepsi bu tenant'ın.
 */
export async function reorderVariants(
  companyId: string,
  productId: string,
  orderedVariantIds: string[],
  db: DbClient,
  now: Date = new Date(),
): Promise<ReorderResult> {
  if (orderedVariantIds.length === 0) {
    return { ok: false, reason: 'invalid_input' };
  }

  // Hepsi bu ürünün + bu tenant'ın olmalı
  const found = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.companyId, companyId),
        eq(productVariants.productId, productId),
        inArray(productVariants.id, orderedVariantIds),
      ),
    );
  if (found.length !== orderedVariantIds.length) {
    return { ok: false, reason: 'mismatch' };
  }

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedVariantIds.length; i++) {
        await tx
          .update(productVariants)
          .set({ displayOrder: i, updatedAt: now })
          .where(eq(productVariants.id, orderedVariantIds[i]));
      }
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// BRANCH OPTIONS (UI için — branchThresholds editor)
// ─────────────────────────────────────────────────────────────────

export interface BranchOption {
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
