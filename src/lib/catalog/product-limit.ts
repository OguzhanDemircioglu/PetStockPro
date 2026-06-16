/**
 * Ürün plan-limit guard'ı.
 *
 * createProduct + recordStockIn gibi action'larda, tenant'ın plan ürün limitini
 * aşıp aşmadığını tek sorguda kontrol eder (FREE 50 / PRO 500 / PRO+ ∞).
 *
 * (Eskiden src/lib/promo/first-100.ts içindeydi + promo bağlamı taşırdı;
 * 2026-06-16 promo kaldırılınca promo'dan arındırılıp buraya taşındı.)
 */
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { planProductLimit } from '@/lib/constants/plan-limits';

type Db = PostgresJsDatabase<Record<string, unknown>>;

export interface ProductLimitContext {
  /** Plan ürün limitini aştı mı? */
  exceeded: boolean;
  /** Mevcut (silinmemiş) ürün sayısı. */
  currentCount: number;
  /** Plan ürün limiti (FREE 50 / PRO 500 / PRO+ ∞). */
  limit: number;
  /** Tenant'ın plan'ı. */
  plan: string;
}

/**
 * Ürün ekleme öncesi plan limit check.
 */
export async function getProductLimitContext(
  db: Db,
  companyId: string,
): Promise<ProductLimitContext> {
  const result = await db.execute<{ plan: string; product_count: number }>(sql`
    SELECT
      c.plan,
      (SELECT COUNT(*)::int FROM petstockpro.products p
        WHERE p.company_id = c.id AND p.deleted_at IS NULL) AS product_count
    FROM petstockpro.companies c
    WHERE c.id = ${companyId}
  `);

  const rows = result as unknown as Array<{ plan: string; product_count: number }>;

  if (rows.length === 0) {
    return { exceeded: false, currentCount: 0, limit: 50, plan: 'FREE' };
  }

  const row = rows[0];
  const limit = planProductLimit(row.plan);
  const exceeded = Number.isFinite(limit) && row.product_count >= limit;

  return { exceeded, currentCount: row.product_count, limit, plan: row.plan };
}
