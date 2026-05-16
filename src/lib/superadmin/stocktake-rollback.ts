/**
 * Sayım rollback — Sprint 7b bypass 5.
 *
 * Tamamlanmış bir sayımın oluşturduğu tüm stock_movements'ları geri alır
 * ve stocktake.status'unu 'cancelled' olarak işaretler.
 *
 * Tipik kullanım:
 *   - Yanlış şubede sayım yapıldı (kayıtlar yanlış)
 *   - Sayıma katılan kişi yanlış kalemlerde girdi
 *   - Audit sırasında sayım sonuçları reddedildi
 *
 * Mekanizma:
 *   1. stocktake check (completed olmalı)
 *   2. Sayımın ürettiği movements bul (note LIKE 'Sayım #{prefix}%')
 *   3. Her birini reverseStockMovement(isSuperadmin=true) ile geri al
 *   4. stocktakes.status = 'cancelled' + closedAt korunur, audit damga
 *
 * Audit log'da bypass entry var — 'cancelled' yanıltıcı görünmesin diye.
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import { stocktakes, stockMovements } from '@/db/schema';
import { reverseStockMovement } from '@/lib/stock/movements';

export const stocktakeRollbackSchema = z.object({
  stocktakeId: z.string().uuid('Sayım UUID geçersiz'),
});
export type StocktakeRollbackInput = z.input<typeof stocktakeRollbackSchema>;

export type StocktakeRollbackResult =
  | {
      ok: true;
      stocktakeId: string;
      movementsReversed: number;
      movementsTotal: number;
      branchId: string;
    }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'not_completed'; currentStatus: string }
  | { ok: false; reason: 'unknown' };

export async function rollbackStocktake(
  companyId: string,
  superadminUserId: string,
  input: StocktakeRollbackInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<StocktakeRollbackResult> {
  const parsed = stocktakeRollbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const { stocktakeId } = parsed.data;

  // Stocktake check + tenant ownership
  const rows = await db
    .select({
      id: stocktakes.id,
      status: stocktakes.status,
      branchId: stocktakes.branchId,
    })
    .from(stocktakes)
    .where(and(eq(stocktakes.id, stocktakeId), eq(stocktakes.companyId, companyId)))
    .limit(1);
  const st = rows[0];
  if (!st) return { ok: false, reason: 'not_found' };
  if (st.status !== 'completed') {
    return { ok: false, reason: 'not_completed', currentStatus: st.status };
  }

  // Bu sayımın ürettiği movements — note prefix ile match (sessions.ts'teki
  // `Sayım #${stocktakeId.slice(0, 8)}` pattern'ine bağlı)
  const prefix = stocktakeId.slice(0, 8);
  const notePattern = `Sayım #${prefix}%`;
  const candidateMovements = await db
    .select({
      id: stockMovements.id,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.companyId, companyId),
        eq(stockMovements.branchId, st.branchId),
        eq(stockMovements.type, 'stocktake'),
        isNull(stockMovements.reversedById),
        isNull(stockMovements.reversesId),
        sql`${stockMovements.note} LIKE ${notePattern}`,
      ),
    );

  const movementsTotal = candidateMovements.length;
  let movementsReversed = 0;

  for (const m of candidateMovements) {
    const r = await reverseStockMovement(
      companyId,
      m.id,
      superadminUserId,
      db,
      { isSuperadmin: true, reason: 'Sayım rollback (süperadmin)' },
      now,
    );
    if (r.ok) movementsReversed++;
  }

  try {
    await db
      .update(stocktakes)
      .set({ status: 'cancelled', closedAt: now })
      .where(eq(stocktakes.id, stocktakeId));
  } catch {
    return { ok: false, reason: 'unknown' };
  }

  return {
    ok: true,
    stocktakeId,
    movementsReversed,
    movementsTotal,
    branchId: st.branchId,
  };
}
