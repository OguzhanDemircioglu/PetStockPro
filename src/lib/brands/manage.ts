/**
 * Brands CRUD — Sprint 6.5
 *
 * listBrands + addBrand + updateBrand + deleteBrand.
 *
 * Brands tablosunda isActive yok — sadece hard delete (Sprint 1B schema).
 * Bir markaya bağlı ürün varsa silinemez (FK SET NULL: ürün brandId=NULL).
 *
 * Schema:
 * - name (varchar 100, zorunlu)
 * - slug (kebab-case, tenant başına unique)
 * - logoUrl (text, opsiyonel — image upload Sprint 3.3 sonrası)
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { makeSlug } from '@/lib/utils/slug';
import type { DbClient } from '@/lib/db/client';
import { brands, products } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────

export interface BrandListItem {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
  createdAt: Date;
}

export async function listBrands(
  companyId: string,
  db: DbClient,
): Promise<BrandListItem[]> {
  return db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      logoUrl: brands.logoUrl,
      createdAt: brands.createdAt,
      productCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${products}
        WHERE ${products.brandId} = ${brands.id}
          AND ${products.deletedAt} IS NULL
      )`,
    })
    .from(brands)
    .where(eq(brands.companyId, companyId))
    .orderBy(asc(brands.name));
}

export async function getBrandDetail(
  companyId: string,
  brandId: string,
  db: DbClient,
): Promise<BrandListItem | null> {
  const rows = await listBrands(companyId, db);
  return rows.find((b) => b.id === brandId) ?? null;
}

// ─────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────

export const brandSchema = z.object({
  name: z.string().min(1, 'Marka adı boş olamaz').max(100),
  logoUrl: z.string().url('Geçerli bir URL gir').nullable().optional()
    .or(z.literal('').transform(() => null)),
});

export type BrandInput = z.input<typeof brandSchema>;

// ─────────────────────────────────────────────────────────────────
// ADD
// ─────────────────────────────────────────────────────────────────

export type AddBrandResult =
  | { ok: true; brandId: string }
  | {
      ok: false;
      reason: 'invalid_input' | 'slug_taken' | 'unknown';
      issues?: string[];
    };

export async function addBrand(
  companyId: string,
  input: BrandInput,
  db: DbClient,
): Promise<AddBrandResult> {
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;
  const baseSlug = makeSlug(data.name);
  if (baseSlug.length < 1) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: ['Marka adı geçerli slug üretmiyor'],
    };
  }

  // Slug çakışma kontrolü
  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.companyId, companyId), eq(brands.slug, baseSlug)))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, reason: 'slug_taken' };
  }

  try {
    const [row] = await db
      .insert(brands)
      .values({
        companyId,
        name: data.name,
        slug: baseSlug,
        logoUrl: data.logoUrl ?? null,
      })
      .returning({ id: brands.id });
    return { ok: true, brandId: row.id };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────

export type UpdateBrandResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'invalid_input' | 'not_found' | 'slug_taken' | 'unknown';
      issues?: string[];
    };

export async function updateBrand(
  companyId: string,
  brandId: string,
  input: BrandInput,
  db: DbClient,
): Promise<UpdateBrandResult> {
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.companyId, companyId)))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  const newSlug = makeSlug(data.name);
  if (newSlug.length < 1) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: ['Marka adı geçerli slug üretmiyor'],
    };
  }

  // Slug çakışma — kendi brandId hariç
  const slugConflict = await db
    .select({ id: brands.id })
    .from(brands)
    .where(
      and(
        eq(brands.companyId, companyId),
        eq(brands.slug, newSlug),
        sql`${brands.id} != ${brandId}`,
      ),
    )
    .limit(1);
  if (slugConflict.length > 0) return { ok: false, reason: 'slug_taken' };

  try {
    await db
      .update(brands)
      .set({
        name: data.name,
        slug: newSlug,
        logoUrl: data.logoUrl ?? null,
      })
      .where(eq(brands.id, brandId));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// DELETE — hard delete (FK ON DELETE SET NULL: ürün brandId=NULL)
// ─────────────────────────────────────────────────────────────────

export type DeleteBrandResult =
  | { ok: true; affectedProductCount: number }
  | { ok: false; reason: 'not_found' | 'unknown' };

/**
 * Markayı siler. Ürün FK SET NULL — ürünler brand kaybeder ama silinmez.
 * affectedProductCount: kaç ürünün brand'ı NULL'a düşecek (uyarı için).
 */
export async function deleteBrand(
  companyId: string,
  brandId: string,
  db: DbClient,
): Promise<DeleteBrandResult> {
  const existing = await db
    .select({
      id: brands.id,
      productCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${products}
        WHERE ${products.brandId} = ${brands.id}
          AND ${products.deletedAt} IS NULL
      )`,
    })
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.companyId, companyId)))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  try {
    await db.delete(brands).where(eq(brands.id, brandId));
    return { ok: true, affectedProductCount: existing[0].productCount };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
