/**
 * Plan tier limit'leri — tek kaynak
 *
 * 2026-05-14 karar: 3-tier B (TR-only)
 * 2026-05-20 revize (Karar C): pricing 750/1.750 → 1.250/2.250
 * 2026-05-21 revize: pricing düşürüldü — 1.250/2.250 → 1.000/2.000 (kullanıcı kararı).
 * 2026-05-22 Karar A revize: tek farklılaşma "stok limiti" yetersiz görüldü.
 *   4 yeni farklılaşma eklendi (kullanıcı kararı):
 *     - Vitrin'e çıkacak ürün limiti (FREE 10 / PRO 500 / PRO+ ∞)
 *     - Şube sayısı (FREE 1 / PRO ∞ / PRO+ ∞)
 *     - Excel ürün import (FREE ❌ / PRO ✅ / PRO+ ✅)
 *     - Gelişmiş raporlar (FREE ❌ / PRO ✅ / PRO+ ✅)
 *   Vitrin metrikleri + diğer her şey (audit, 2FA, asistan, Telegram, vitrin
 *   görünürlük) tüm planlarda EŞİT kalır (sponsorship/sıralama bonusu YOK
 *   — Karar A eşit rekabet felsefesi korunur).
 *
 *   FREE   = 50 ürün / 10 vitrin / 1 şube / manuel only / basit raporlar (0₺)
 *   PRO    = 500 ürün / 500 vitrin / ∞ şube / Excel + tam raporlar (1.000₺/ay KDV dahil)
 *   PRO+   = ∞ ürün / ∞ vitrin / ∞ şube / Excel + tam raporlar (2.000₺/ay KDV dahil)
 *
 * Bkz. docs/PLAN-KADEMELERI.md (otoritatif).
 */

export interface PlanFeatures {
  productLimit: number;
  /** Vitrin'de aynı anda yayında olabilecek maksimum ürün sayısı */
  vitrinLimit: number;
  /** Tenant'ın açabileceği maksimum aktif şube sayısı (status != inactive) */
  branchLimit: number;
  /** /admin/products/import (Excel toplu import) erişimi */
  excelImport: boolean;
  /** /admin/reports gelişmiş bölümleri (period comparison + top selling + ...) */
  advancedReports: boolean;
  /** TR aylık fiyat (KDV dahil, ₺). Lansmandan itibaren aktif. */
  priceMonthlyTry: number;
  /**
   * Yurt dışı aylık fiyat (USD).
   * 2026-05-22: kullanıcı PRO=20 / PRO+=50 USD pricing'i belirledi.
   * Implementation (Paddle MoR + EN locale + KVKK Md.9) Faz 2'ye saklı —
   * TR-only kararı (2026-05-14) lansman için korunur. Bu değerler doc/karar
   * kaydı olarak tutulur, yurt dışı tier açıldığında bu kalibrasyon kullanılır.
   */
  priceMonthlyUsd: number;
}

export const PLAN_LIMITS: Record<'FREE' | 'PRO' | 'PRO_PLUS', PlanFeatures> = {
  FREE: {
    productLimit: 50,
    vitrinLimit: 10,
    branchLimit: 1,
    excelImport: false,
    advancedReports: false,
    priceMonthlyTry: 0,
    priceMonthlyUsd: 0,
  },
  PRO: {
    productLimit: 500,
    vitrinLimit: 500,
    branchLimit: Infinity,
    excelImport: true,
    advancedReports: true,
    priceMonthlyTry: 10, // ⚠️ GEÇİCİ TEST FİYATI (ödeme akışı testi) — GERÇEK: 1000. Lansman öncesi geri al.
    priceMonthlyUsd: 20,
  },
  PRO_PLUS: {
    productLimit: Infinity,
    vitrinLimit: Infinity,
    branchLimit: Infinity,
    excelImport: true,
    advancedReports: true,
    priceMonthlyTry: 20, // ⚠️ GEÇİCİ TEST FİYATI (ödeme akışı testi) — GERÇEK: 2000. Lansman öncesi geri al.
    priceMonthlyUsd: 50,
  },
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

function getPlan(plan: string): PlanFeatures {
  const k = plan as PlanKey;
  return PLAN_LIMITS[k] ?? PLAN_LIMITS.FREE;
}

export function planProductLimit(plan: string): number {
  return getPlan(plan).productLimit;
}

/** Vitrin'de yayında olabilecek max ürün sayısı (Karar A revize 2026-05-22). */
export function planVitrinLimit(plan: string): number {
  return getPlan(plan).vitrinLimit;
}

/** Tenant'ın açabileceği max aktif şube sayısı (Karar A revize 2026-05-22). */
export function planBranchLimit(plan: string): number {
  return getPlan(plan).branchLimit;
}

/** Excel ürün import erişimi (Karar A revize 2026-05-22). */
export function planHasExcelImport(plan: string): boolean {
  return getPlan(plan).excelImport;
}

/** Gelişmiş raporlar erişimi (Karar A revize 2026-05-22). */
export function planHasAdvancedReports(plan: string): boolean {
  return getPlan(plan).advancedReports;
}

export function planPrice(plan: string): number {
  return getPlan(plan).priceMonthlyTry;
}

export function planLimitDisplay(plan: string): string {
  const v = planProductLimit(plan);
  return v === Infinity ? '∞' : String(v);
}

export function planVitrinLimitDisplay(plan: string): string {
  const v = planVitrinLimit(plan);
  return v === Infinity ? '∞' : String(v);
}

export function planBranchLimitDisplay(plan: string): string {
  const v = planBranchLimit(plan);
  return v === Infinity ? '∞' : String(v);
}
