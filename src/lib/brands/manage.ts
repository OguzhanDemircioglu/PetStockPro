/**
 * Brands CRUD — GLOBAL (Migration 0026, 2026-05-22)
 *
 * 2026-05-22: companyId kaldırıldı. brands artık GLOBAL — TR pet shop
 * pazarında "Royal Canin" tek bir markadır. CRUD SUPERADMIN-only —
 * pet shop yeni brand ekleyemez (Faz 2'de custom_brand ihtiyacı doğarsa
 * is_custom + owner_company_id eklenir).
 *
 * Brands tablosunda isActive yok — sadece hard delete.
 * Bir markaya bağlı ürün varsa silinmesinde FK SET NULL: ürün brandId=NULL.
 *
 * Schema:
 * - name (varchar 100, zorunlu)
 * - slug (kebab-case, GLOBAL UNIQUE)
 * - logoUrl (text, opsiyonel)
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import { moderateFields } from '@/lib/moderation/check';
import type { ModerationFlagsResult } from '@/lib/moderation/redirect-suffix';
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

/**
 * Global brand listesi (companyId YOK).
 * productCount: vitrin'de yayında VE aktif ürün sayısı (cross-tenant).
 */
export async function listBrands(db: DbClient): Promise<BrandListItem[]> {
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
    .orderBy(asc(brands.name));
}

export async function getBrandDetail(
  brandId: string,
  db: DbClient,
): Promise<BrandListItem | null> {
  const rows = await listBrands(db);
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
// ADD — SUPERADMIN-only (caller'ın yetki check'i ayrı katmanda)
// ─────────────────────────────────────────────────────────────────

export type AddBrandResult =
  | { ok: true; brandId: string; moderationFlags?: ModerationFlagsResult }
  | {
      ok: false;
      reason: 'invalid_input' | 'slug_taken' | 'profanity' | 'unknown';
      issues?: string[];
    };

export async function addBrand(
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

  // Moderation BLOCKING — küfür/uygunsuz içerik tespit edilirse INSERT yapma.
  const moderation = await moderateFields({ 'Marka adı': data.name });
  if (moderation.flagged) {
    const detected = moderation.reasons
      .filter((r) => r.source === 'blacklist' && r.term)
      .map((r) => r.term)
      .filter(Boolean);
    return {
      ok: false,
      reason: 'profanity',
      issues: [
        `Marka adında uygunsuz içerik tespit edildi${detected.length > 0 ? ': ' + detected.join(', ') : ''}`,
      ],
    };
  }

  const baseSlug = makeSlug(data.name);
  if (baseSlug.length < 1) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: ['Marka adı geçerli slug üretmiyor'],
    };
  }

  // Slug çakışma kontrolü (global)
  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.slug, baseSlug))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, reason: 'slug_taken' };
  }

  try {
    const [row] = await db
      .insert(brands)
      .values({
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
// UPDATE — SUPERADMIN-only
// ─────────────────────────────────────────────────────────────────

export type UpdateBrandResult =
  | { ok: true; moderationFlags?: ModerationFlagsResult }
  | {
      ok: false;
      reason: 'invalid_input' | 'not_found' | 'slug_taken' | 'profanity' | 'unknown';
      issues?: string[];
    };

export async function updateBrand(
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

  const moderation = await moderateFields({ 'Marka adı': data.name });
  if (moderation.flagged) {
    const detected = moderation.reasons
      .filter((r) => r.source === 'blacklist' && r.term)
      .map((r) => r.term)
      .filter(Boolean);
    return {
      ok: false,
      reason: 'profanity',
      issues: [
        `Marka adında uygunsuz içerik tespit edildi${detected.length > 0 ? ': ' + detected.join(', ') : ''}`,
      ],
    };
  }

  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.id, brandId))
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
    .where(and(eq(brands.slug, newSlug), sql`${brands.id} != ${brandId}`))
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
// DELETE — SUPERADMIN-only, hard delete (FK SET NULL)
// ─────────────────────────────────────────────────────────────────

export type DeleteBrandResult =
  | { ok: true; affectedProductCount: number }
  | { ok: false; reason: 'not_found' | 'unknown' };

export async function deleteBrand(
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
    .where(eq(brands.id, brandId))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  try {
    await db.delete(brands).where(eq(brands.id, brandId));
    return { ok: true, affectedProductCount: existing[0].productCount };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
