/**
 * Açık Krediler raporu — Sprint 11 (CLAUDE.md S2 2026-05-14):
 *
 *   stock_movements WHERE payment_method='credit' AND credit_paid_at IS NULL
 *
 * 6. rapor olarak satış raporları arasında listelenir.
 *
 * 3 helper:
 *   listOpenCredits — açık krediler listesi (variant + branch + product join)
 *   getOpenCreditsSummary — toplam adet/tutar + yaş bandı (0-15/16-30/31-60/60+)
 *   settleCredit — credit_paid_at=NOW() UPDATE + audit `sale.credit_settled`
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  stockMovements,
  productVariants,
  products,
  branches,
} from '@/db/schema';
import { writeAuditLog } from '@/lib/audit/log';

export interface OpenCreditRow {
  movementId: string;
  createdAt: Date;
  daysOpen: number;
  customerRef: string | null;
  quantity: number;
  unitPrice: string | null;
  amount: string; // qty × unitPrice (positive)
  productName: string;
  variantLabel: string | null;
  sku: string;
  branchId: string;
  branchName: string;
}

export interface ListOpenCreditsOpts {
  branchId?: string;
  customerRef?: string;
  limit?: number;
  now?: Date;
}

export async function listOpenCredits(
  companyId: string,
  db: DbClient,
  opts: ListOpenCreditsOpts = {},
): Promise<OpenCreditRow[]> {
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();
  const limit = opts.limit ?? 200;

  const filters = [
    eq(stockMovements.companyId, companyId),
    eq(stockMovements.type, 'stock_out'),
    eq(stockMovements.subtype, 'sale'),
    eq(stockMovements.paymentMethod, 'credit'),
    sql`${stockMovements.creditPaidAt} IS NULL`,
    sql`${stockMovements.reversedById} IS NULL`,
    sql`${stockMovements.reversesId} IS NULL`,
  ];
  if (opts.branchId) {
    filters.push(eq(stockMovements.branchId, opts.branchId));
  }
  if (opts.customerRef) {
    filters.push(eq(stockMovements.customerRef, opts.customerRef));
  }

  return db
    .select({
      movementId: stockMovements.id,
      createdAt: stockMovements.createdAt,
      daysOpen: sql<number>`FLOOR(EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400)::int`,
      customerRef: stockMovements.customerRef,
      quantity: sql<number>`ABS(${stockMovements.quantity})::int`,
      unitPrice: stockMovements.unitPrice,
      amount: sql<string>`(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0))::text`,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
      branchId: stockMovements.branchId,
      branchName: branches.name,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(branches, eq(branches.id, stockMovements.branchId))
    .where(and(...filters))
    .orderBy(asc(stockMovements.createdAt))
    .limit(limit) as Promise<OpenCreditRow[]>;
}

export interface AgingBand {
  label: '0-15' | '16-30' | '31-60' | '60+';
  count: number;
  amount: string;
}

export interface OpenCreditsSummary {
  totalCount: number;
  totalAmount: string;
  oldestDays: number; // 0 → açık kredi yok
  byBand: AgingBand[]; // 4 band sabit sıra
}

export async function getOpenCreditsSummary(
  companyId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<OpenCreditsSummary> {
  const nowIso = now.toISOString();

  const rows = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_count,
      COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)), 0)::text AS total_amount,
      COALESCE(
        FLOOR(EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - MIN(${stockMovements.createdAt}))) / 86400)::int,
        0
      ) AS oldest_days,
      COUNT(*) FILTER (
        WHERE EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 < 16
      )::int AS band_0_15_count,
      COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)) FILTER (
        WHERE EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 < 16
      ), 0)::text AS band_0_15_amount,
      COUNT(*) FILTER (
        WHERE EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 >= 16
          AND EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 < 31
      )::int AS band_16_30_count,
      COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)) FILTER (
        WHERE EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 >= 16
          AND EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 < 31
      ), 0)::text AS band_16_30_amount,
      COUNT(*) FILTER (
        WHERE EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 >= 31
          AND EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 < 61
      )::int AS band_31_60_count,
      COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)) FILTER (
        WHERE EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 >= 31
          AND EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 < 61
      ), 0)::text AS band_31_60_amount,
      COUNT(*) FILTER (
        WHERE EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 >= 61
      )::int AS band_60_plus_count,
      COALESCE(SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitPrice}, 0)) FILTER (
        WHERE EXTRACT(EPOCH FROM (${sql.raw(`'${nowIso}'::timestamptz`)} - ${stockMovements.createdAt})) / 86400 >= 61
      ), 0)::text AS band_60_plus_amount
    FROM ${stockMovements}
    WHERE ${stockMovements.companyId} = ${companyId}
      AND ${stockMovements.type} = 'stock_out'
      AND ${stockMovements.subtype} = 'sale'
      AND ${stockMovements.paymentMethod} = 'credit'
      AND ${stockMovements.creditPaidAt} IS NULL
      AND ${stockMovements.reversedById} IS NULL
      AND ${stockMovements.reversesId} IS NULL
  `)) as unknown as Array<{
    total_count: number;
    total_amount: string;
    oldest_days: number;
    band_0_15_count: number;
    band_0_15_amount: string;
    band_16_30_count: number;
    band_16_30_amount: string;
    band_31_60_count: number;
    band_31_60_amount: string;
    band_60_plus_count: number;
    band_60_plus_amount: string;
  }>;

  const r = rows[0] ?? {
    total_count: 0,
    total_amount: '0',
    oldest_days: 0,
    band_0_15_count: 0,
    band_0_15_amount: '0',
    band_16_30_count: 0,
    band_16_30_amount: '0',
    band_31_60_count: 0,
    band_31_60_amount: '0',
    band_60_plus_count: 0,
    band_60_plus_amount: '0',
  };

  return {
    totalCount: r.total_count,
    totalAmount: r.total_amount,
    oldestDays: r.oldest_days,
    byBand: [
      { label: '0-15', count: r.band_0_15_count, amount: r.band_0_15_amount },
      { label: '16-30', count: r.band_16_30_count, amount: r.band_16_30_amount },
      { label: '31-60', count: r.band_31_60_count, amount: r.band_31_60_amount },
      { label: '60+', count: r.band_60_plus_count, amount: r.band_60_plus_amount },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────
// settleCredit — kredi kapama
// ─────────────────────────────────────────────────────────────────

export type SettleCreditResult =
  | { ok: true; movementId: string; paidAt: Date }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'not_credit'
        | 'already_settled'
        | 'reversed'
        | 'unknown';
    };

export interface SettleCreditOpts {
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export async function settleCredit(
  companyId: string,
  userId: string,
  movementId: string,
  db: DbClient,
  opts: SettleCreditOpts = {},
): Promise<SettleCreditResult> {
  const now = opts.now ?? new Date();

  try {
    const rows = await db
      .select({
        id: stockMovements.id,
        paymentMethod: stockMovements.paymentMethod,
        creditPaidAt: stockMovements.creditPaidAt,
        reversedById: stockMovements.reversedById,
        reversesId: stockMovements.reversesId,
        customerRef: stockMovements.customerRef,
        quantity: stockMovements.quantity,
        unitPrice: stockMovements.unitPrice,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.id, movementId),
          eq(stockMovements.companyId, companyId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return { ok: false, reason: 'not_found' };
    const m = rows[0];

    if (m.paymentMethod !== 'credit') return { ok: false, reason: 'not_credit' };
    if (m.creditPaidAt) return { ok: false, reason: 'already_settled' };
    if (m.reversedById || m.reversesId) return { ok: false, reason: 'reversed' };

    await db
      .update(stockMovements)
      .set({ creditPaidAt: now })
      .where(eq(stockMovements.id, movementId));

    await writeAuditLog(
      {
        companyId,
        userId,
        action: 'sale.credit_settled',
        entityType: 'stock_movement',
        entityId: movementId,
        afterState: {
          creditPaidAt: now.toISOString(),
          customerRef: m.customerRef,
          quantity: Math.abs(m.quantity),
          unitPrice: m.unitPrice,
        },
        ipAddress: opts.ipAddress ?? null,
        userAgent: opts.userAgent ?? null,
      },
      db,
      now,
    );

    return { ok: true, movementId, paidAt: now };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}
