/**
 * Categories CRUD — GLOBAL (Migration 0026, 2026-05-22)
 *
 * 2026-05-22: companyId kaldırıldı. categories artık GLOBAL — TR pet shop
 * pazarında kategoriler (mama, aksesuar, oyuncak, sağlık, ...) ortak.
 * CRUD SUPERADMIN-only — pet shop yeni kategori ekleyemez (Faz 2'de
 * custom_category ihtiyacı doğarsa is_custom + owner_company_id eklenir).
 *
 * Schema:
 * - name (varchar 100, zorunlu)
 * - slug (kebab-case, GLOBAL UNIQUE)
 * - emoji (varchar 10, opsiyonel, global unique)
 * - displayOrder (int, default 0)
 * - sktRequired (boolean, default false)
 * - parentId (self-ref, opsiyonel — 2-seviyeli hiyerarşi)
 *
 * FK ON DELETE SET NULL: ürünler kategorisiz kalır, silinmez.
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { makeSlug } from '@/lib/utils/slug';
import { moderateFields } from '@/lib/moderation/check';
import type { ModerationFlagsResult } from '@/lib/moderation/redirect-suffix';
import type { DbClient } from '@/lib/db/client';
import { categories, products } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  displayOrder: number;
  sktRequired: boolean;
  parentId: string | null;
  productCount: number;
  createdAt: Date;
}

/**
 * Global category listesi (companyId YOK).
 * productCount: vitrin'de yayında VE aktif ürün sayısı (cross-tenant).
 */
export async function listCategories(db: DbClient): Promise<CategoryListItem[]> {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      emoji: categories.emoji,
      displayOrder: categories.displayOrder,
      sktRequired: categories.sktRequired,
      parentId: categories.parentId,
      createdAt: categories.createdAt,
      productCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${products}
        WHERE ${products.categoryId} = ${categories.id}
          AND ${products.deletedAt} IS NULL
      )`,
    })
    .from(categories)
    .orderBy(asc(categories.displayOrder), asc(categories.name));
}

export async function getCategoryDetail(
  categoryId: string,
  db: DbClient,
): Promise<CategoryListItem | null> {
  const rows = await listCategories(db);
  return rows.find((c) => c.id === categoryId) ?? null;
}

// ─────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().min(1, 'Kategori adı boş olamaz').max(100),
  emoji: z
    .string()
    .max(10)
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  sktRequired: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(999).default(100),
  parentId: z
    .string()
    .uuid('Geçerli üst kategori seç')
    .nullable()
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
});

export type CategoryInput = z.input<typeof categorySchema>;

// ─────────────────────────────────────────────────────────────────
// ADD — SUPERADMIN-only
// ─────────────────────────────────────────────────────────────────

export type AddCategoryResult =
  | { ok: true; categoryId: string; moderationFlags?: ModerationFlagsResult }
  | {
      ok: false;
      reason: 'invalid_input' | 'slug_taken' | 'emoji_taken' | 'unknown';
      issues?: string[];
    };

export async function addCategory(
  input: CategoryInput,
  db: DbClient,
): Promise<AddCategoryResult> {
  const parsed = categorySchema.safeParse(input);
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
      issues: ['Kategori adı geçerli slug üretmiyor'],
    };
  }

  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, baseSlug))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, reason: 'slug_taken' };
  }

  // Emoji benzersizlik kontrolü — global. Emoji null/boş ise atlanır.
  if (data.emoji && data.emoji.length > 0) {
    const emojiClash = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.emoji, data.emoji))
      .limit(1);
    if (emojiClash.length > 0) {
      return { ok: false, reason: 'emoji_taken' };
    }
  }

  try {
    const [row] = await db
      .insert(categories)
      .values({
        name: data.name,
        slug: baseSlug,
        emoji: data.emoji ?? null,
        sktRequired: data.sktRequired,
        displayOrder: data.displayOrder,
        parentId: data.parentId ?? null,
      })
      .returning({ id: categories.id });
    const moderation = await moderateFields({ 'Kategori adı': data.name });
    return {
      ok: true,
      categoryId: row.id,
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
// UPDATE — SUPERADMIN-only
// ─────────────────────────────────────────────────────────────────

export type UpdateCategoryResult =
  | { ok: true; moderationFlags?: ModerationFlagsResult }
  | {
      ok: false;
      reason:
        | 'invalid_input'
        | 'not_found'
        | 'slug_taken'
        | 'emoji_taken'
        | 'unknown';
      issues?: string[];
    };

export async function updateCategory(
  categoryId: string,
  input: CategoryInput,
  db: DbClient,
): Promise<UpdateCategoryResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  const newSlug = makeSlug(data.name);
  if (newSlug.length < 1) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: ['Kategori adı geçerli slug üretmiyor'],
    };
  }

  const slugConflict = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(eq(categories.slug, newSlug), sql`${categories.id} != ${categoryId}`),
    )
    .limit(1);
  if (slugConflict.length > 0) return { ok: false, reason: 'slug_taken' };

  if (data.emoji && data.emoji.length > 0) {
    const emojiClash = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.emoji, data.emoji),
          sql`${categories.id} != ${categoryId}`,
        ),
      )
      .limit(1);
    if (emojiClash.length > 0) {
      return { ok: false, reason: 'emoji_taken' };
    }
  }

  try {
    await db
      .update(categories)
      .set({
        name: data.name,
        slug: newSlug,
        emoji: data.emoji ?? null,
        sktRequired: data.sktRequired,
        displayOrder: data.displayOrder,
        parentId: data.parentId ?? null,
      })
      .where(eq(categories.id, categoryId));
    const moderation = await moderateFields({ 'Kategori adı': data.name });
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

// ─────────────────────────────────────────────────────────────────
// DELETE — SUPERADMIN-only, hard delete (FK ON DELETE SET NULL)
// ─────────────────────────────────────────────────────────────────

export type DeleteCategoryResult =
  | { ok: true; affectedProductCount: number }
  | { ok: false; reason: 'not_found' | 'unknown' };

export async function deleteCategory(
  categoryId: string,
  db: DbClient,
): Promise<DeleteCategoryResult> {
  const existing = await db
    .select({
      id: categories.id,
      productCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${products}
        WHERE ${products.categoryId} = ${categories.id}
          AND ${products.deletedAt} IS NULL
      )`,
    })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  try {
    await db.delete(categories).where(eq(categories.id, categoryId));
    return { ok: true, affectedProductCount: existing[0].productCount };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
