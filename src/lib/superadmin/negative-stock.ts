/**
 * Eksi stoğa zorla giriş — Sprint 7b bypass 3.
 *
 * Normal recordStockOut: newQty<0 → InsufficientStockError throw.
 * Süperadmin bypass: check'i atla, branch_inventory negatif değere de yazılır.
 *
 * Tipik kullanım: muhasebe kayıt hatasını düzeltmek için stoğu manuel
 * negatife sokmak gerekebilir (kayıtlanan satış>fiziksel stok).
 *
 * Bu helper:
 *   1. Variant + branch ownership check (tenant match)
 *   2. stock_movements insert (type=stock_out, subtype=other, isSuperadmin=true, quantity=-N)
 *   3. branch_inventory upsert (stockQty -= N, negative izin)
 *   4. products.totalStockQty refresh
 *
 * applyInventoryChange'i çağırmaz çünkü o negative reject ediyor.
 */

import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import {
  branchInventory,
  branches,
  products,
  productVariants,
  stockMovements,
} from '@/db/schema';

export const forceNegativeStockSchema = z.object({
  branchId: z.string().uuid('Şube UUID geçersiz'),
  variantId: z.string().uuid('Variant UUID geçersiz'),
  quantity: z.number().int().positive('Miktar pozitif tam sayı (negatife çekilecek qty)'),
});
export type ForceNegativeStockInput = z.input<typeof forceNegativeStockSchema>;

export type ForceNegativeResult =
  | { ok: true; movementId: string; beforeQty: number; afterQty: number }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'unknown' };

export async function forceNegativeStockOut(
  companyId: string,
  userId: string,
  input: ForceNegativeStockInput,
  reason: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<ForceNegativeResult> {
  const parsed = forceNegativeStockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // Ownership check + current stock
  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: productVariants.productId,
      inventoryRowId: branchInventory.id,
      currentQty: branchInventory.stockQty,
    })
    .from(productVariants)
    .innerJoin(branches, eq(branches.id, data.branchId))
    .leftJoin(
      branchInventory,
      and(
        eq(branchInventory.variantId, productVariants.id),
        eq(branchInventory.branchId, data.branchId),
      ),
    )
    .where(
      and(
        eq(productVariants.id, data.variantId),
        eq(productVariants.companyId, companyId),
        eq(branches.companyId, companyId),
      ),
    )
    .limit(1);

  const info = rows[0];
  if (!info) return { ok: false, reason: 'not_found' };

  const beforeQty = info.currentQty ?? 0;
  const delta = -data.quantity;
  const afterQty = beforeQty + delta;

  try {
    const movementId = await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(stockMovements)
        .values({
          companyId,
          branchId: data.branchId,
          variantId: data.variantId,
          type: 'stock_out',
          subtype: 'other',
          quantity: delta,
          beforeQty,
          afterQty,
          reason: `Süperadmin bypass: eksi stok zorla — ${reason}`,
          createdById: userId,
          performedAsSuperadmin: true,
          createdAt: now,
        })
        .returning({ id: stockMovements.id });

      // branch_inventory upsert (negative allow)
      if (info.inventoryRowId) {
        await tx
          .update(branchInventory)
          .set({
            stockQty: afterQty,
            lastSoldAt: now,
            totalSoldQty: sql`${branchInventory.totalSoldQty} + ${data.quantity}`,
            updatedAt: now,
          })
          .where(eq(branchInventory.id, info.inventoryRowId));
      } else {
        // Hiç inventory yoktu — yeni satır negatif değerle
        await tx.insert(branchInventory).values({
          companyId,
          branchId: data.branchId,
          variantId: data.variantId,
          stockQty: afterQty,
          lastSoldAt: now,
          totalSoldQty: data.quantity,
          createdAt: now,
          updatedAt: now,
        });
      }

      // products.totalStockQty refresh (tüm variantlar)
      await tx
        .update(products)
        .set({
          totalStockQty: sql`(
            SELECT COALESCE(SUM(${branchInventory.stockQty}), 0)::int
            FROM ${branchInventory}
            WHERE ${branchInventory.variantId} IN (
              SELECT ${productVariants.id} FROM ${productVariants}
              WHERE ${productVariants.productId} = ${info.productId}
            )
          )`,
          updatedAt: now,
        })
        .where(eq(products.id, info.productId));

      return m.id;
    });

    return { ok: true, movementId, beforeQty, afterQty };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
