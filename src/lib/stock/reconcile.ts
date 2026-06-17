/**
 * Stok bütünlüğü reconcile — Faz 3 (PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE §FAZ 3).
 *
 * Ledger (stock_movements) sistemin tek doğruluk kaynağı. branch_inventory.stockQty
 * ve products.totalStockQty denormalize cache'lerdir. Bu cache'ler ledger ile UYUMLU
 * olmalı; bir kez bile saparlarsa (applyInventoryChange dışı bir yazma, manuel
 * müdahale, gelecek bir bug) kimse fark etmez ve sistemin çekirdek vaadi ("kayıtlı
 * stok = gerçek") bozulur.
 *
 * Bu fonksiyon bir TRIPWIRE: sapmayı TESPİT eder, AUTO-REPAIR YAPMAZ. Sapma bir bug
 * sinyalidir; otomatik düzeltmek onu maskeler ve kanıtı yok eder. Süperadmin incelemeli.
 */
import { sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';

/** Ledger ↔ envanter sapması: branch_inventory.stockQty ≠ SUM(stock_movements.quantity). */
export interface StockDriftRow {
  companyId: string;
  branchId: string;
  variantId: string;
  cached: number;
  ledgerSum: number;
  diff: number;
}

/** Sayaç sapması: products.totalStockQty ≠ SUM(branch_inventory.stockQty). */
export interface CounterDriftRow {
  companyId: string;
  productId: string;
  cached: number;
  computed: number;
  diff: number;
}

export interface ReconcileResult {
  ok: boolean;
  stockDriftCount: number;
  counterDriftCount: number;
  stockDriftSample: StockDriftRow[];
  counterDriftSample: CounterDriftRow[];
}

const SAMPLE_LIMIT = 20;

/**
 * İki invariant'ı kontrol eder:
 *  1. Her (branch, variant) için branch_inventory.stockQty == SUM(stock_movements.quantity).
 *     (Reversal kayıtları orijinal + ters movement birlikte toplama girer → net doğru.)
 *  2. Her ürün için products.totalStockQty == SUM(branch_inventory.stockQty over variants).
 */
export async function reconcileStock(db: DbClient): Promise<ReconcileResult> {
  const stockRes = await db.execute(sql`
    SELECT bi.company_id AS "companyId", bi.branch_id AS "branchId", bi.variant_id AS "variantId",
           bi.stock_qty::int AS cached,
           COALESCE(SUM(sm.quantity), 0)::int AS "ledgerSum",
           (bi.stock_qty - COALESCE(SUM(sm.quantity), 0))::int AS diff
    FROM petstockpro.branch_inventory bi
    LEFT JOIN petstockpro.stock_movements sm
      ON sm.branch_id = bi.branch_id AND sm.variant_id = bi.variant_id
    GROUP BY bi.id, bi.company_id, bi.branch_id, bi.variant_id, bi.stock_qty
    HAVING bi.stock_qty <> COALESCE(SUM(sm.quantity), 0)
    ORDER BY abs(bi.stock_qty - COALESCE(SUM(sm.quantity), 0)) DESC
  `);

  const counterRes = await db.execute(sql`
    SELECT p.company_id AS "companyId", p.id AS "productId",
           p.total_stock_qty::int AS cached,
           COALESCE(inv.s, 0)::int AS computed,
           (p.total_stock_qty - COALESCE(inv.s, 0))::int AS diff
    FROM petstockpro.products p
    LEFT JOIN (
      SELECT pv.product_id, SUM(bi.stock_qty) AS s
      FROM petstockpro.product_variants pv
      JOIN petstockpro.branch_inventory bi ON bi.variant_id = pv.id
      GROUP BY pv.product_id
    ) inv ON inv.product_id = p.id
    WHERE p.deleted_at IS NULL
      AND p.total_stock_qty <> COALESCE(inv.s, 0)
    ORDER BY abs(p.total_stock_qty - COALESCE(inv.s, 0)) DESC
  `);

  const stockRows = stockRes as unknown as StockDriftRow[];
  const counterRows = counterRes as unknown as CounterDriftRow[];

  return {
    ok: stockRows.length === 0 && counterRows.length === 0,
    stockDriftCount: stockRows.length,
    counterDriftCount: counterRows.length,
    stockDriftSample: stockRows.slice(0, SAMPLE_LIMIT),
    counterDriftSample: counterRows.slice(0, SAMPLE_LIMIT),
  };
}
