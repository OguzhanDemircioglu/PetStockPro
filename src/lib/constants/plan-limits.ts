/**
 * Plan tier limit'leri — tek kaynak
 *
 * 2026-05-14 karar: 3-tier B (TR-only)
 * 2026-05-20 revize (Karar C): pricing 750/1.750 → 1.250/2.250
 * 2026-05-21 revize: pricing düşürüldü — 1.250/2.250 → 1.000/2.000 (kullanıcı kararı).
 *   FREE   = 50 ürün (deneme, 0₺)
 *   PRO    = 500 ürün (1.000₺/ay KDV dahil)
 *   PRO+   = sınırsız (2.000₺/ay KDV dahil)
 *
 * Bkz. docs/PLAN-KADEMELERI.md (otoritatif).
 */

export const PLAN_LIMITS = {
  FREE: { productLimit: 50, priceMonthlyTry: 0 },
  PRO: { productLimit: 500, priceMonthlyTry: 1000 },
  PRO_PLUS: { productLimit: Infinity, priceMonthlyTry: 2000 },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;

export const PLAN_LABELS: Record<PlanKey, string> = {
  FREE: 'FREE',
  PRO: 'PRO',
  PRO_PLUS: 'PRO+',
};

export const PLAN_DESCRIPTIONS: Record<PlanKey, string> = {
  FREE: 'Deneme — küçük pet shop',
  PRO: 'Orta segment esas pazar',
  PRO_PLUS: 'Büyük zincir / sınırsız',
};

export function planProductLimit(plan: string): number {
  const k = plan as PlanKey;
  return PLAN_LIMITS[k]?.productLimit ?? PLAN_LIMITS.FREE.productLimit;
}

export function planPrice(plan: string): number {
  const k = plan as PlanKey;
  return PLAN_LIMITS[k]?.priceMonthlyTry ?? 0;
}

export function planLimitDisplay(plan: string): string {
  const v = planProductLimit(plan);
  return v === Infinity ? '∞' : String(v);
}
