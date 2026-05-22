/**
 * Plan features — efektif limit hesaplama (Karar A revize 2026-05-22)
 *
 * Mevcut plan limit'ine süperadmin temporary override'ı eklenir:
 *   efektif = override (TTL geçerli ise) ?? plan defaultu
 *
 * 4 yeni farklılaşma:
 *   - vitrin limit (FREE 10 / PRO 500 / PRO+ ∞)
 *   - şube limit (FREE 1 / PRO ∞ / PRO+ ∞)
 *   - Excel import (FREE ❌ / PRO ✅ / PRO+ ✅) — boolean, override yok
 *   - Gelişmiş raporlar (FREE ❌ / PRO ✅ / PRO+ ✅) — boolean, override yok
 *
 * Override pattern:
 *   companies.temporary_vitrin_limit_override (int) +
 *   companies.temporary_vitrin_limit_override_until (timestamptz NULL=kalıcı)
 *   → süperadmin tek tenant için esnetebilir (paralel field branch için).
 */

import {
  planVitrinLimit,
  planBranchLimit,
  planHasExcelImport,
  planHasAdvancedReports,
} from '@/lib/constants/plan-limits';

export interface CompanyPlanOverrideFields {
  plan: string;
  temporaryVitrinLimitOverride: number | null;
  temporaryVitrinLimitOverrideUntil: Date | null;
  temporaryBranchLimitOverride: number | null;
  temporaryBranchLimitOverrideUntil: Date | null;
}

function overrideStillValid(until: Date | null, now: Date): boolean {
  if (until === null) return true; // kalıcı override
  return until.getTime() > now.getTime();
}

/**
 * Tenant için efektif vitrin limiti.
 * Override aktif (TTL içinde) → override değeri. Aksi halde plan defaultu.
 */
export function getEffectiveVitrinLimit(
  company: CompanyPlanOverrideFields,
  now: Date = new Date(),
): number {
  if (
    company.temporaryVitrinLimitOverride !== null &&
    overrideStillValid(company.temporaryVitrinLimitOverrideUntil, now)
  ) {
    return company.temporaryVitrinLimitOverride;
  }
  return planVitrinLimit(company.plan);
}

/**
 * Tenant için efektif şube limiti.
 */
export function getEffectiveBranchLimit(
  company: CompanyPlanOverrideFields,
  now: Date = new Date(),
): number {
  if (
    company.temporaryBranchLimitOverride !== null &&
    overrideStillValid(company.temporaryBranchLimitOverrideUntil, now)
  ) {
    return company.temporaryBranchLimitOverride;
  }
  return planBranchLimit(company.plan);
}

/**
 * Excel ürün import erişimi — plan-only, override yok (boolean feature flag).
 * Süperadmin esnetmesi için tenant plan'ı geçici PRO yapılabilir (ayrı flow).
 */
export function hasExcelImport(plan: string): boolean {
  return planHasExcelImport(plan);
}

/**
 * Gelişmiş raporlar erişimi — plan-only, override yok.
 */
export function hasAdvancedReports(plan: string): boolean {
  return planHasAdvancedReports(plan);
}

/**
 * Vitrin limit kontrolü — yeni ürünün vitrin'e açılması için kullanıcı
 * tarafı validation. count >= limit ise reject.
 *
 * @param activeVitrinCount Mevcut vitrin'de yayında ürün sayısı (DB count)
 * @returns { ok: true } | { ok: false, limit, count, reason }
 */
export function canPublishToVitrin(
  company: CompanyPlanOverrideFields,
  activeVitrinCount: number,
  now: Date = new Date(),
): { ok: true } | { ok: false; limit: number; count: number; reason: 'vitrin_limit_exceeded' } {
  const limit = getEffectiveVitrinLimit(company, now);
  if (activeVitrinCount >= limit) {
    return {
      ok: false,
      limit,
      count: activeVitrinCount,
      reason: 'vitrin_limit_exceeded',
    };
  }
  return { ok: true };
}

/**
 * Şube limit kontrolü — yeni şube ekleme için validation.
 */
export function canAddBranch(
  company: CompanyPlanOverrideFields,
  activeBranchCount: number,
  now: Date = new Date(),
): { ok: true } | { ok: false; limit: number; count: number; reason: 'branch_limit_exceeded' } {
  const limit = getEffectiveBranchLimit(company, now);
  if (activeBranchCount >= limit) {
    return {
      ok: false,
      limit,
      count: activeBranchCount,
      reason: 'branch_limit_exceeded',
    };
  }
  return { ok: true };
}
