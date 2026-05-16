/**
 * Movement metadata düzelt — Sprint 7b bypass 6.
 *
 * Immutable ledger principle: stock_movements quantity / before_qty /
 * after_qty / type / subtype / branch / variant / createdAt değiştirilemez.
 *
 * Ancak süperadmin **metadata** alanlarını düzeltebilir (typo, yanlış
 * müşteri ref'i, eksik doküman no):
 *   - reason (TEXT — açıklama)
 *   - note (TEXT — uzun not)
 *   - customerRef (varchar — Vitrin referans kodu)
 *   - documentNo (varchar — fatura/sipariş no)
 *
 * Bu helper:
 *   1. Movement ownership check (tenant)
 *   2. En az 1 alan değişmiş mi?
 *   3. UPDATE stock_movements (sadece metadata alanları)
 *   4. before/after snapshot döndür (audit beforeState için)
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import { stockMovements } from '@/db/schema';

export const metadataFixSchema = z
  .object({
    movementId: z.string().uuid('Movement UUID geçersiz'),
    reason: z.string().max(500).nullable().optional(),
    note: z.string().max(1000).nullable().optional(),
    customerRef: z.string().max(100).nullable().optional(),
    documentNo: z.string().max(100).nullable().optional(),
  })
  .refine(
    (d) =>
      d.reason !== undefined ||
      d.note !== undefined ||
      d.customerRef !== undefined ||
      d.documentNo !== undefined,
    'En az 1 metadata alanı belirtilmeli',
  );
export type MetadataFixInput = z.input<typeof metadataFixSchema>;

interface MovementSnapshot {
  reason: string | null;
  note: string | null;
  customerRef: string | null;
  documentNo: string | null;
}

export type MetadataFixResult =
  | {
      ok: true;
      movementId: string;
      before: MovementSnapshot;
      after: MovementSnapshot;
      changedFields: string[];
    }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'no_change' }
  | { ok: false; reason: 'unknown' };

export async function fixMovementMetadata(
  companyId: string,
  input: MetadataFixInput,
  db: DbClient,
): Promise<MetadataFixResult> {
  const parsed = metadataFixSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // Movement çek + tenant ownership
  const rows = await db
    .select({
      id: stockMovements.id,
      reason: stockMovements.reason,
      note: stockMovements.note,
      customerRef: stockMovements.customerRef,
      documentNo: stockMovements.documentNo,
    })
    .from(stockMovements)
    .where(
      and(eq(stockMovements.id, data.movementId), eq(stockMovements.companyId, companyId)),
    )
    .limit(1);
  const m = rows[0];
  if (!m) return { ok: false, reason: 'not_found' };

  const before: MovementSnapshot = {
    reason: m.reason,
    note: m.note,
    customerRef: m.customerRef,
    documentNo: m.documentNo,
  };

  // Hangi alanlar değişecek?
  const updates: Partial<MovementSnapshot> = {};
  const changedFields: string[] = [];

  const fields: (keyof MovementSnapshot)[] = ['reason', 'note', 'customerRef', 'documentNo'];
  for (const f of fields) {
    if (data[f] !== undefined) {
      const newVal = data[f] === '' ? null : (data[f] ?? null);
      if (newVal !== before[f]) {
        updates[f] = newVal;
        changedFields.push(f);
      }
    }
  }

  if (changedFields.length === 0) {
    return { ok: false, reason: 'no_change' };
  }

  try {
    await db
      .update(stockMovements)
      .set(updates)
      .where(eq(stockMovements.id, data.movementId));
    const after: MovementSnapshot = { ...before, ...updates };
    return {
      ok: true,
      movementId: data.movementId,
      before,
      after,
      changedFields,
    };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
