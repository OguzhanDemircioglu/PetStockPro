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
import type { DbClient } from '@/lib/db/client';
import {
  products,
  productVariants,
  categories,
  brands,
} from '@/db/schema';

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
  | { ok: true; productId: string; variantId: string; slug: string }
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

    return { ok: true, productId: result.productId, variantId: result.variantId, slug: finalSlug };
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

export async function listProducts(
  companyId: string,
  db: DbClient,
  limit: number = 50,
): Promise<ProductListItem[]> {
  // Drizzle SQL — products + category name + brand name + default variant price + variant count
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
    .where(and(eq(products.companyId, companyId), sql`${products.deletedAt} IS NULL`))
    .orderBy(desc(products.createdAt))
    .limit(limit);

  return rows;
}
