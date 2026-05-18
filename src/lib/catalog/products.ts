/**
 * Products CRUD Helpers — Sprint 3.0 minimal
 *
 * createProduct + listProducts. Edit/delete Sprint 3.1+.
 *
 * Pattern: registerNewTenant gibi pure helper + dependency injection.
 * Branch_inventory + stock_movements UI ile (Sprint 4'te trigger) güncellenir.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { makeSlug } from '@/lib/utils/slug';
import { moderateFields, type ModerationReason } from '@/lib/moderation/check';
import type { DbClient } from '@/lib/db/client';
import {
  products,
  productVariants,
  categories,
  brands,
} from '@/db/schema';

export interface ModerationFlagsResult {
  flagged: boolean;
  fieldsFlagged: string[];
  reasons: ModerationReason[];
}

// ─────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(3, 'Ürün adı en az 3 karakter').max(255),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid('Geçerli bir kategori seç').optional(),
  brandId: z.string().uuid().optional(),
  // İlk variant (Sprint 3.0 default: tek default variant)
  variant: z.object({
    valueLabel: z.string().min(1, 'Boyut/ambalaj zorunlu').max(50).default('Standart'),
    sku: z.string().min(1, 'SKU zorunlu').max(100),
    barcode: z.string().max(13).optional(),
    costPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Geçerli fiyat gir (örn 120.50)').optional(),
    salePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Geçerli fiyat gir'),
    threshold: z.number().int().min(0).max(9999).default(5),
  }),
});

export type CreateProductInput = z.input<typeof createProductSchema>;

export type CreateProductResult =
  | {
      ok: true;
      productId: string;
      variantId: string;
      slug: string;
      moderationFlags?: ModerationFlagsResult;
    }
  | { ok: false; reason: 'invalid_input' | 'sku_taken' | 'slug_taken' | 'unknown'; issues?: string[] };

export async function createProduct(
  companyId: string,
  input: CreateProductInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<CreateProductResult> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_input', issues: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;

  // Slug üret + çakışma için suffix
  const baseSlug = makeSlug(data.name);
  if (baseSlug.length < 2) {
    return { ok: false, reason: 'invalid_input', issues: ['Ürün adı geçerli slug üretmiyor'] };
  }

  // Slug + SKU çakışma check
  const slugConflict = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.companyId, companyId), eq(products.slug, baseSlug)))
    .limit(1);

  const finalSlug = slugConflict.length > 0
    ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
    : baseSlug;

  const skuConflict = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(and(eq(productVariants.companyId, companyId), eq(productVariants.sku, data.variant.sku)))
    .limit(1);

  if (skuConflict.length > 0) {
    return { ok: false, reason: 'sku_taken' };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          companyId,
          name: data.name,
          slug: finalSlug,
          description: data.description ?? null,
          categoryId: data.categoryId ?? null,
          brandId: data.brandId ?? null,
          isActive: true,
          isPublished: true,
          totalStockQty: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: products.id });

      const [variant] = await tx
        .insert(productVariants)
        .values({
          companyId,
          productId: product.id,
          axisLabel: 'Boyut',
          valueLabel: data.variant.valueLabel,
          sku: data.variant.sku,
          barcode: data.variant.barcode ?? null,
          costPrice: data.variant.costPrice ?? '0',
          salePrice: data.variant.salePrice,
          threshold: data.variant.threshold,
          isActive: true,
          isDefault: true, // Sprint 3.0 minimal: tek default variant
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: productVariants.id });

      return { productId: product.id, variantId: variant.id };
    });

    const moderation = await moderateFields({
      'Ürün adı': data.name,
      ...(data.description ? { 'Ürün açıklaması': data.description } : {}),
    });
    return {
      ok: true,
      productId: result.productId,
      variantId: result.variantId,
      slug: finalSlug,
      ...(moderation.flagged
        ? {
            moderationFlags: {
              flagged: true,
              fieldsFlagged: moderation.fieldsFlagged,
              reasons: moderation.reasons,
            },
          }
        : {}),
    };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  categoryName: string | null;
  brandName: string | null;
  totalStockQty: number;
  variantCount: number;
  defaultSalePrice: string | null;
  isActive: boolean;
  vitrinPublished: boolean;
  createdAt: Date;
}

export interface ListProductsOptions {
  /** Ürün adı veya SKU içinde geçen — ILIKE substring (case-insensitive) */
  query?: string;
  categoryId?: string;
  brandId?: string;
  /** 'active' yalnız aktifler / 'inactive' yalnız pasifler / 'all' hepsi */
  status?: 'active' | 'inactive' | 'all';
  vitrinPublished?: boolean;
  limit?: number;
}

export async function listProducts(
  companyId: string,
  db: DbClient,
  opts: ListProductsOptions = {},
): Promise<ProductListItem[]> {
  const conditions = [
    eq(products.companyId, companyId),
    sql`${products.deletedAt} IS NULL`,
  ];

  if (opts.query && opts.query.trim().length > 0) {
    const pattern = `%${opts.query.trim()}%`;
    conditions.push(
      sql`(
        ${products.name} ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM ${productVariants} pv
          WHERE pv.product_id = ${products.id}
            AND pv.sku ILIKE ${pattern}
        )
      )`,
    );
  }
  if (opts.categoryId) {
    conditions.push(eq(products.categoryId, opts.categoryId));
  }
  if (opts.brandId) {
    conditions.push(eq(products.brandId, opts.brandId));
  }
  if (opts.status === 'active') {
    conditions.push(eq(products.isActive, true));
  } else if (opts.status === 'inactive') {
    conditions.push(eq(products.isActive, false));
  }
  if (opts.vitrinPublished === true) {
    conditions.push(eq(products.vitrinPublished, true));
  } else if (opts.vitrinPublished === false) {
    conditions.push(eq(products.vitrinPublished, false));
  }

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      categoryName: categories.name,
      brandName: brands.name,
      totalStockQty: products.totalStockQty,
      isActive: products.isActive,
      vitrinPublished: products.vitrinPublished,
      createdAt: products.createdAt,
      defaultSalePrice: sql<string | null>`(
        SELECT ${productVariants.salePrice}
        FROM ${productVariants}
        WHERE ${productVariants.productId} = ${products.id}
          AND ${productVariants.isDefault} = true
        LIMIT 1
      )`,
      variantCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${productVariants}
        WHERE ${productVariants.productId} = ${products.id}
          AND ${productVariants.isActive} = true
      )`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .limit(opts.limit ?? 50);

  return rows;
}

// ─────────────────────────────────────────────────────────────────
// DETAIL + EDIT (Sprint 3.1)
// ─────────────────────────────────────────────────────────────────

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  isActive: boolean;
  vitrinPublished: boolean;
  vitrinPublishedAt: Date | null;
  vitrinAutoUnpublishedReason: string | null;
  defaultVariant: {
    id: string;
    valueLabel: string;
    sku: string;
    barcode: string | null;
    costPrice: string;
    salePrice: string;
    threshold: number;
  } | null;
}

/**
 * Tek ürün + default variant detayı. Edit page server-side load için.
 */
export async function getProductDetail(
  companyId: string,
  productId: string,
  db: DbClient,
): Promise<ProductDetail | null> {
  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      categoryId: products.categoryId,
      brandId: products.brandId,
      isActive: products.isActive,
      vitrinPublished: products.vitrinPublished,
      vitrinPublishedAt: products.vitrinPublishedAt,
      vitrinAutoUnpublishedReason: products.vitrinAutoUnpublishedReason,
    })
    .from(products)
    .where(
      and(
        eq(products.companyId, companyId),
        eq(products.id, productId),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .limit(1);

  const product = productRows[0];
  if (!product) return null;

  const variantRows = await db
    .select({
      id: productVariants.id,
      valueLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
      costPrice: productVariants.costPrice,
      salePrice: productVariants.salePrice,
      threshold: productVariants.threshold,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, productId),
        eq(productVariants.isDefault, true),
      ),
    )
    .limit(1);

  return {
    ...product,
    defaultVariant: variantRows[0] ?? null,
  };
}

export const updateProductSchema = z.object({
  name: z.string().min(3, 'Ürün adı en az 3 karakter').max(255),
  description: z.string().max(2000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  variant: z.object({
    valueLabel: z.string().min(1).max(50),
    sku: z.string().min(1).max(100),
    barcode: z.string().max(13).nullable().optional(),
    costPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
    salePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
    threshold: z.number().int().min(0).max(9999),
  }),
});

export type UpdateProductInput = z.input<typeof updateProductSchema>;

export type UpdateProductResult =
  | { ok: true; moderationFlags?: ModerationFlagsResult }
  | { ok: false; reason: 'invalid_input' | 'not_found' | 'sku_taken' | 'unknown'; issues?: string[] };

export async function updateProduct(
  companyId: string,
  productId: string,
  variantId: string,
  input: UpdateProductInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<UpdateProductResult> {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_input', issues: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;

  // Mevcut product check (tenant izolasyonu)
  const existing = await db
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
  if (existing.length === 0) {
    return { ok: false, reason: 'not_found' };
  }

  // SKU çakışma kendi variantId hariç
  const skuConflict = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.companyId, companyId),
        eq(productVariants.sku, data.variant.sku),
        sql`${productVariants.id} != ${variantId}`,
      ),
    )
    .limit(1);
  if (skuConflict.length > 0) {
    return { ok: false, reason: 'sku_taken' };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({
          name: data.name,
          description: data.description ?? null,
          categoryId: data.categoryId ?? null,
          brandId: data.brandId ?? null,
          isActive: data.isActive ?? true,
          updatedAt: now,
        })
        .where(eq(products.id, productId));

      await tx
        .update(productVariants)
        .set({
          valueLabel: data.variant.valueLabel,
          sku: data.variant.sku,
          barcode: data.variant.barcode ?? null,
          costPrice: data.variant.costPrice,
          salePrice: data.variant.salePrice,
          threshold: data.variant.threshold,
          updatedAt: now,
        })
        .where(eq(productVariants.id, variantId));
    });
    const moderation = await moderateFields({
      'Ürün adı': data.name,
      ...(data.description ? { 'Ürün açıklaması': data.description } : {}),
    });
    return {
      ok: true,
      ...(moderation.flagged
        ? {
            moderationFlags: {
              flagged: true,
              fieldsFlagged: moderation.fieldsFlagged,
              reasons: moderation.reasons,
            },
          }
        : {}),
    };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Soft delete — products.deletedAt = now.
 * Variant + branch_inventory + stock_movements korunur (audit + raporlar için).
 */
export async function softDeleteProduct(
  companyId: string,
  productId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<{ ok: boolean }> {
  await db
    .update(products)
    .set({
      deletedAt: now,
      isActive: false,
      vitrinPublished: false,
      updatedAt: now,
    })
    .where(and(eq(products.id, productId), eq(products.companyId, companyId)));
  return { ok: true };
}
