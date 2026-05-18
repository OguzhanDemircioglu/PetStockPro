/**
 * Categories CRUD — Sprint 6.6
 *
 * listCategories + addCategory + updateCategory + deleteCategory.
 *
 * Register'da 49 default kategori auto-insert ediliyor (default-categories.ts).
 * Bu helper kullanıcının kendi kategorisini eklemesini sağlar.
 *
 * Schema:
 * - name (varchar 100, zorunlu)
 * - slug (kebab-case, tenant başına unique — server-side `makeSlug(name)` ile
 *   otomatik üretilir; UI kullanıcısına gösterilmez ama vitrin route URL'leri
 *   `/vitrin/kategori/[slug]` için kullanılır.)
 * - emoji (varchar 10, opsiyonel, tenant başına unique)
 * - displayOrder (int, default 0 — kullanıcının eklediğinde 100+ atayalım)
 * - sktRequired (boolean, default false)
 * - parentId (self-ref, opsiyonel — 2-seviyeli hiyerarşi: root → child)
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

export async function listCategories(
  companyId: string,
  db: DbClient,
): Promise<CategoryListItem[]> {
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
    .where(eq(categories.companyId, companyId))
    .orderBy(asc(categories.displayOrder), asc(categories.name));
}

export async function getCategoryDetail(
  companyId: string,
  categoryId: string,
  db: DbClient,
): Promise<CategoryListItem | null> {
  const rows = await listCategories(companyId, db);
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
  /** Üst kategori ID — root için null. Form'dan boş string gelirse null normalize. */
  parentId: z
    .string()
    .uuid('Geçerli üst kategori seç')
    .nullable()
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
});

export type CategoryInput = z.input<typeof categorySchema>;

// ─────────────────────────────────────────────────────────────────
// ADD
// ─────────────────────────────────────────────────────────────────

export type AddCategoryResult =
  | { ok: true; categoryId: string; moderationFlags?: ModerationFlagsResult }
  | {
      ok: false;
      reason: 'invalid_input' | 'slug_taken' | 'emoji_taken' | 'unknown';
      issues?: string[];
    };

export async function addCategory(
  companyId: string,
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
    .where(
      and(eq(categories.companyId, companyId), eq(categories.slug, baseSlug)),
    )
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, reason: 'slug_taken' };
  }

  // Emoji benzersizlik kontrolü — tenant başına. Emoji null/boş ise atlanır.
  if (data.emoji && data.emoji.length > 0) {
    const emojiClash = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.companyId, companyId),
          eq(categories.emoji, data.emoji),
        ),
      )
      .limit(1);
    if (emojiClash.length > 0) {
      return { ok: false, reason: 'emoji_taken' };
    }
  }

  try {
    const [row] = await db
      .insert(categories)
      .values({
        companyId,
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
// UPDATE
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
  companyId: string,
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
    .where(
      and(eq(categories.id, categoryId), eq(categories.companyId, companyId)),
    )
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
      and(
        eq(categories.companyId, companyId),
        eq(categories.slug, newSlug),
        sql`${categories.id} != ${categoryId}`,
      ),
    )
    .limit(1);
  if (slugConflict.length > 0) return { ok: false, reason: 'slug_taken' };

  // Emoji benzersizlik — başka kategoride aynı emoji varsa reject (kendisi
  // hariç). Emoji null/boş ise atlanır.
  if (data.emoji && data.emoji.length > 0) {
    const emojiClash = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.companyId, companyId),
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
// DELETE — hard delete (FK ON DELETE SET NULL)
// ─────────────────────────────────────────────────────────────────

export type DeleteCategoryResult =
  | { ok: true; affectedProductCount: number }
  | { ok: false; reason: 'not_found' | 'unknown' };

export async function deleteCategory(
  companyId: string,
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
    .where(
      and(eq(categories.id, categoryId), eq(categories.companyId, companyId)),
    )
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  try {
    await db.delete(categories).where(eq(categories.id, categoryId));
    return { ok: true, affectedProductCount: existing[0].productCount };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
