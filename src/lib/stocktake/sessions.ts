/**
 * Guided Stocktake (Sayım Oturumu) — Sprint 4.7
 *
 * Sayım workflow:
 *   1. startStocktake — branch + mode (şimdilik 'full') → snapshot tüm aktif variant'lar
 *   2. updateStocktakeItemCount — kullanıcı her variant için countedQty girer
 *   3. completeStocktake — diff != 0 olan her item için stock_movements (type='stocktake') üret
 *   4. cancelStocktake — iptal et, items audit için saklanır
 *
 * MVP scope: 'full' mode only (kategori + manuel Faz 2). softLock pasif (Faz 2 trigger).
 *
 * stock_movements üretimi recordStocktakeAdjustment'i tek-tek loop'lar — DB transaction
 * her variant başına. Batch transaction yapmak Drizzle'da nested transaction gerektirir,
 * bu MVP için karmaşık (loop yeterli — typical sayım <500 variant, performance acceptable).
 */

import { and, eq, asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { TenantDb } from '@/lib/db/with-tenant';
import {
  stocktakes,
  stocktakeItems,
  productVariants,
  products,
  branchInventory,
  branches,
  users,
} from '@/db/schema';
import { recordStocktakeAdjustment } from '@/lib/stock/movements';

// ══════════════════════════════════════════════════════════════
// Types & Schemas
// ══════════════════════════════════════════════════════════════

export const stocktakeModeValues = ['full', 'category', 'manual'] as const;
export type StocktakeMode = (typeof stocktakeModeValues)[number];

export const startStocktakeSchema = z.object({
  branchId: z.string().uuid('Şube seç'),
  mode: z.enum(stocktakeModeValues).default('full'),
  categoryId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

export type StartStocktakeInput = z.input<typeof startStocktakeSchema>;

export const stocktakeReasonValues = [
  'loss',
  'overage',
  'wrong_entry',
  'expired',
  'damage',
  'theft',
  'other',
] as const;
export type StocktakeReason = (typeof stocktakeReasonValues)[number];

export const updateItemCountSchema = z.object({
  countedQty: z.number().int().min(0).max(999_999),
  reason: z.enum(stocktakeReasonValues).optional(),
  customReason: z.string().max(500).optional(),
});

export type UpdateItemCountInput = z.input<typeof updateItemCountSchema>;

// ══════════════════════════════════════════════════════════════
// startStocktake
// ══════════════════════════════════════════════════════════════

export type StartStocktakeResult =
  | { ok: true; stocktakeId: string; totalItems: number }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'branch_not_found' }
  | { ok: false; reason: 'no_variants' }
  | { ok: false; reason: 'unknown' };

/**
 * Yeni sayım oturumu başlat.
 *
 * Snapshot pattern: oturum açıldığı anda şubedeki tüm aktif variant'ların
 * mevcut stoğunu stocktake_items'a yazar. Sonradan stok hareketi olsa bile
 * "sistem snapshot'ı" değişmez (sayım yapanın gördüğü stok ile karşılaştırma için).
 */
export async function startStocktake(
  companyId: string,
  userId: string,
  input: StartStocktakeInput,
  db: TenantDb,
  now: Date = new Date(),
): Promise<StartStocktakeResult> {
  const parsed = startStocktakeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // Branch ownership
  const branchRows = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, data.branchId), eq(branches.companyId, companyId)))
    .limit(1);
  if (!branchRows[0]) {
    return { ok: false, reason: 'branch_not_found' };
  }

  // Variant kapsamı: 'full' = company'nin tüm aktif variant'ları.
  // Snapshot: branch_inventory.stockQty (yoksa 0).
  const variantRows = await db
    .select({
      variantId: productVariants.id,
      systemQty: sql<number>`COALESCE(${branchInventory.stockQty}, 0)::int`,
    })
    .from(productVariants)
    .leftJoin(
      branchInventory,
      and(
        eq(branchInventory.variantId, productVariants.id),
        eq(branchInventory.branchId, data.branchId),
      ),
    )
    .where(and(eq(productVariants.companyId, companyId), eq(productVariants.isActive, true)));

  if (variantRows.length === 0) {
    return { ok: false, reason: 'no_variants' };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [stocktakeRow] = await tx
        .insert(stocktakes)
        .values({
          companyId,
          branchId: data.branchId,
          mode: data.mode,
          categoryId: data.categoryId ?? null,
          softLock: false, // Faz 2 trigger
          status: 'in_progress',
          totalItems: variantRows.length,
          countedItems: 0,
          diffItems: 0,
          note: data.note ?? null,
          startedById: userId,
          startedAt: now,
        })
        .returning({ id: stocktakes.id });

      await tx.insert(stocktakeItems).values(
        variantRows.map((v) => ({
          stocktakeId: stocktakeRow.id,
          variantId: v.variantId,
          systemQty: v.systemQty ?? 0,
          countedQty: null,
          diff: null,
          isSkipped: false,
          updatedAt: now,
        })),
      );

      return stocktakeRow.id;
    });

    return { ok: true, stocktakeId: result, totalItems: variantRows.length };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ══════════════════════════════════════════════════════════════
// listStocktakes
// ══════════════════════════════════════════════════════════════

export interface StocktakeListItem {
  id: string;
  branchId: string;
  branchName: string | null;
  mode: StocktakeMode;
  status: 'in_progress' | 'waiting' | 'completed' | 'cancelled';
  totalItems: number;
  countedItems: number;
  diffItems: number;
  startedAt: Date;
  closedAt: Date | null;
  startedByEmail: string | null;
}

export async function listStocktakes(
  companyId: string,
  db: TenantDb,
  opts?: { limit?: number },
): Promise<StocktakeListItem[]> {
  const rows = await db
    .select({
      id: stocktakes.id,
      branchId: stocktakes.branchId,
      branchName: branches.name,
      mode: stocktakes.mode,
      status: stocktakes.status,
      totalItems: stocktakes.totalItems,
      countedItems: stocktakes.countedItems,
      diffItems: stocktakes.diffItems,
      startedAt: stocktakes.startedAt,
      closedAt: stocktakes.closedAt,
      startedByEmail: users.email,
    })
    .from(stocktakes)
    .leftJoin(branches, eq(branches.id, stocktakes.branchId))
    .leftJoin(users, eq(users.id, stocktakes.startedById))
    .where(eq(stocktakes.companyId, companyId))
    .orderBy(sql`${stocktakes.startedAt} DESC`)
    .limit(opts?.limit ?? 50);

  return rows as StocktakeListItem[];
}

// ══════════════════════════════════════════════════════════════
// getStocktakeWithItems
// ══════════════════════════════════════════════════════════════

export interface StocktakeItemDetail {
  id: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  systemQty: number;
  countedQty: number | null;
  diff: number | null;
  reason: StocktakeReason | null;
  customReason: string | null;
  isSkipped: boolean;
}

export interface StocktakeDetail {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string | null;
  mode: StocktakeMode;
  status: 'in_progress' | 'waiting' | 'completed' | 'cancelled';
  totalItems: number;
  countedItems: number;
  diffItems: number;
  note: string | null;
  startedAt: Date;
  closedAt: Date | null;
  items: StocktakeItemDetail[];
}

export async function getStocktakeWithItems(
  companyId: string,
  stocktakeId: string,
  db: TenantDb,
): Promise<StocktakeDetail | null> {
  const headRows = await db
    .select({
      id: stocktakes.id,
      companyId: stocktakes.companyId,
      branchId: stocktakes.branchId,
      branchName: branches.name,
      mode: stocktakes.mode,
      status: stocktakes.status,
      totalItems: stocktakes.totalItems,
      countedItems: stocktakes.countedItems,
      diffItems: stocktakes.diffItems,
      note: stocktakes.note,
      startedAt: stocktakes.startedAt,
      closedAt: stocktakes.closedAt,
    })
    .from(stocktakes)
    .leftJoin(branches, eq(branches.id, stocktakes.branchId))
    .where(and(eq(stocktakes.id, stocktakeId), eq(stocktakes.companyId, companyId)))
    .limit(1);

  const head = headRows[0];
  if (!head) return null;

  const itemRows = await db
    .select({
      id: stocktakeItems.id,
      variantId: stocktakeItems.variantId,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      systemQty: stocktakeItems.systemQty,
      countedQty: stocktakeItems.countedQty,
      diff: stocktakeItems.diff,
      reason: stocktakeItems.reason,
      customReason: stocktakeItems.customReason,
      isSkipped: stocktakeItems.isSkipped,
    })
    .from(stocktakeItems)
    .innerJoin(productVariants, eq(productVariants.id, stocktakeItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(stocktakeItems.stocktakeId, stocktakeId))
    .orderBy(asc(products.name), asc(productVariants.displayOrder));

  return { ...head, items: itemRows as StocktakeItemDetail[] };
}

// ══════════════════════════════════════════════════════════════
// updateStocktakeItemCount
// ══════════════════════════════════════════════════════════════

export type UpdateItemCountResult =
  | { ok: true; diff: number; countedItems: number; diffItems: number }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'session_closed' }
  | { ok: false; reason: 'unknown' };

export async function updateStocktakeItemCount(
  companyId: string,
  stocktakeId: string,
  itemId: string,
  input: UpdateItemCountInput,
  db: TenantDb,
  now: Date = new Date(),
): Promise<UpdateItemCountResult> {
  const parsed = updateItemCountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // Ownership + status check + item fetch
  const rows = await db
    .select({
      itemId: stocktakeItems.id,
      systemQty: stocktakeItems.systemQty,
      previousCountedQty: stocktakeItems.countedQty,
      status: stocktakes.status,
    })
    .from(stocktakeItems)
    .innerJoin(stocktakes, eq(stocktakes.id, stocktakeItems.stocktakeId))
    .where(
      and(
        eq(stocktakeItems.id, itemId),
        eq(stocktakes.id, stocktakeId),
        eq(stocktakes.companyId, companyId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.status !== 'in_progress' && row.status !== 'waiting') {
    return { ok: false, reason: 'session_closed' };
  }

  const diff = data.countedQty - row.systemQty;
  const wasCountedBefore = row.previousCountedQty !== null;
  const wasDiffBefore = wasCountedBefore && row.previousCountedQty !== row.systemQty;
  const willBeDiff = diff !== 0;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(stocktakeItems)
        .set({
          countedQty: data.countedQty,
          diff,
          reason: data.reason ?? null,
          customReason: data.customReason ?? null,
          isSkipped: false,
          updatedAt: now,
        })
        .where(eq(stocktakeItems.id, itemId));

      // Counter güncelleme — sadece ilk kez sayılıyorsa countedItems++
      const counterChanges: Record<string, unknown> = { updatedAt: now };
      const countedDelta = wasCountedBefore ? 0 : 1;
      const diffDelta = (willBeDiff ? 1 : 0) - (wasDiffBefore ? 1 : 0);

      if (countedDelta !== 0 || diffDelta !== 0) {
        if (countedDelta !== 0) {
          counterChanges.countedItems = sql`${stocktakes.countedItems} + ${countedDelta}`;
        }
        if (diffDelta !== 0) {
          counterChanges.diffItems = sql`${stocktakes.diffItems} + ${diffDelta}`;
        }
        await tx.update(stocktakes).set(counterChanges).where(eq(stocktakes.id, stocktakeId));
      }
    });

    // Counter yeni değerleri için tek select (UI feedback)
    const updated = await db
      .select({
        countedItems: stocktakes.countedItems,
        diffItems: stocktakes.diffItems,
      })
      .from(stocktakes)
      .where(eq(stocktakes.id, stocktakeId))
      .limit(1);

    return {
      ok: true,
      diff,
      countedItems: updated[0]?.countedItems ?? 0,
      diffItems: updated[0]?.diffItems ?? 0,
    };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ══════════════════════════════════════════════════════════════
// completeStocktake
// ══════════════════════════════════════════════════════════════

export interface CompleteStocktakeOk {
  ok: true;
  movementsCreated: number;
  itemsAdjusted: number;
}

export type CompleteStocktakeResult =
  | CompleteStocktakeOk
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'session_closed' }
  | { ok: false; reason: 'has_uncounted'; uncountedCount: number }
  | { ok: false; reason: 'unknown' };

/**
 * Sayımı tamamla — diff != 0 olan her item için stock_movement (type='stocktake') üretir.
 *
 * has_uncounted: hâlâ countedQty=null olan items varsa reddedilir. UI'da
 * "Sayılmamış X variant var, atla veya say." uyarısı.
 *
 * Her item için recordStocktakeAdjustment'ı çağırırız — kendi transaction'ı içinde
 * branch_inventory + product.totalStockQty + audit chain'i çalıştırır (auto-unpublish
 * countedQty=0 senaryosunda vitrin'i kapatır).
 */
export async function completeStocktake(
  companyId: string,
  userId: string,
  stocktakeId: string,
  db: TenantDb,
  now: Date = new Date(),
): Promise<CompleteStocktakeResult> {
  const headRows = await db
    .select({
      id: stocktakes.id,
      branchId: stocktakes.branchId,
      status: stocktakes.status,
      totalItems: stocktakes.totalItems,
      countedItems: stocktakes.countedItems,
    })
    .from(stocktakes)
    .where(and(eq(stocktakes.id, stocktakeId), eq(stocktakes.companyId, companyId)))
    .limit(1);

  const head = headRows[0];
  if (!head) return { ok: false, reason: 'not_found' };
  if (head.status !== 'in_progress' && head.status !== 'waiting') {
    return { ok: false, reason: 'session_closed' };
  }

  const uncountedCount = head.totalItems - head.countedItems;
  if (uncountedCount > 0) {
    return { ok: false, reason: 'has_uncounted', uncountedCount };
  }

  // diff != 0 olan items
  const adjustItems = await db
    .select({
      variantId: stocktakeItems.variantId,
      countedQty: stocktakeItems.countedQty,
      diff: stocktakeItems.diff,
      reason: stocktakeItems.reason,
      customReason: stocktakeItems.customReason,
    })
    .from(stocktakeItems)
    .where(
      and(
        eq(stocktakeItems.stocktakeId, stocktakeId),
        sql`${stocktakeItems.diff} IS NOT NULL AND ${stocktakeItems.diff} != 0`,
      ),
    );

  let movementsCreated = 0;
  for (const item of adjustItems) {
    if (item.countedQty == null) continue;
    const reasonText = item.reason
      ? `Sayım: ${item.reason}${item.customReason ? ` — ${item.customReason}` : ''}`
      : 'Sayım düzeltmesi';
    const result = await recordStocktakeAdjustment(
      companyId,
      userId,
      {
        branchId: head.branchId,
        variantId: item.variantId,
        countedQty: item.countedQty,
        reason: reasonText,
        note: `Sayım #${stocktakeId.slice(0, 8)}`,
      },
      db,
      now,
    );
    if (result.ok) movementsCreated++;
  }

  await db
    .update(stocktakes)
    .set({ status: 'completed', closedAt: now })
    .where(eq(stocktakes.id, stocktakeId));

  return { ok: true, movementsCreated, itemsAdjusted: adjustItems.length };
}

// ══════════════════════════════════════════════════════════════
// cancelStocktake
// ══════════════════════════════════════════════════════════════

export type CancelStocktakeResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'already_closed' }
  | { ok: false; reason: 'unknown' };

export async function cancelStocktake(
  companyId: string,
  stocktakeId: string,
  db: TenantDb,
  now: Date = new Date(),
): Promise<CancelStocktakeResult> {
  const headRows = await db
    .select({ status: stocktakes.status })
    .from(stocktakes)
    .where(and(eq(stocktakes.id, stocktakeId), eq(stocktakes.companyId, companyId)))
    .limit(1);

  const head = headRows[0];
  if (!head) return { ok: false, reason: 'not_found' };
  if (head.status === 'completed' || head.status === 'cancelled') {
    return { ok: false, reason: 'already_closed' };
  }

  try {
    await db
      .update(stocktakes)
      .set({ status: 'cancelled', closedAt: now })
      .where(eq(stocktakes.id, stocktakeId));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
