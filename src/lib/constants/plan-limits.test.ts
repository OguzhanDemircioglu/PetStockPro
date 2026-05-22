import { describe, it, expect } from 'vitest';
import {
  PLAN_LIMITS,
  PLAN_LABELS,
  planProductLimit,
  planVitrinLimit,
  planBranchLimit,
  planHasExcelImport,
  planHasAdvancedReports,
  planPrice,
  planLimitDisplay,
  planVitrinLimitDisplay,
  planBranchLimitDisplay,
} from './plan-limits';

describe('PLAN_LIMITS', () => {
  it('FREE = 50 ürün / 10 vitrin / 1 şube / manuel / basit / 0₺', () => {
    expect(PLAN_LIMITS.FREE.productLimit).toBe(50);
    expect(PLAN_LIMITS.FREE.vitrinLimit).toBe(10);
    expect(PLAN_LIMITS.FREE.branchLimit).toBe(1);
    expect(PLAN_LIMITS.FREE.excelImport).toBe(false);
    expect(PLAN_LIMITS.FREE.advancedReports).toBe(false);
    expect(PLAN_LIMITS.FREE.priceMonthlyTry).toBe(0);
  });
  it('PRO = 500 ürün / 500 vitrin / ∞ şube / Excel + raporlar / 1000₺', () => {
    expect(PLAN_LIMITS.PRO.productLimit).toBe(500);
    expect(PLAN_LIMITS.PRO.vitrinLimit).toBe(500);
    expect(PLAN_LIMITS.PRO.branchLimit).toBe(Infinity);
    expect(PLAN_LIMITS.PRO.excelImport).toBe(true);
    expect(PLAN_LIMITS.PRO.advancedReports).toBe(true);
    expect(PLAN_LIMITS.PRO.priceMonthlyTry).toBe(1000);
  });
  it('PRO_PLUS = ∞ hepsi / 2000₺', () => {
    expect(PLAN_LIMITS.PRO_PLUS.productLimit).toBe(Infinity);
    expect(PLAN_LIMITS.PRO_PLUS.vitrinLimit).toBe(Infinity);
    expect(PLAN_LIMITS.PRO_PLUS.branchLimit).toBe(Infinity);
    expect(PLAN_LIMITS.PRO_PLUS.excelImport).toBe(true);
    expect(PLAN_LIMITS.PRO_PLUS.advancedReports).toBe(true);
    expect(PLAN_LIMITS.PRO_PLUS.priceMonthlyTry).toBe(2000);
  });
});

describe('PLAN_LABELS', () => {
  it('PRO_PLUS label "PRO+" (UI gösterim)', () => {
    expect(PLAN_LABELS.PRO_PLUS).toBe('PRO+');
  });
});

describe('planProductLimit', () => {
  it('FREE = 50', () => expect(planProductLimit('FREE')).toBe(50));
  it('PRO = 500', () => expect(planProductLimit('PRO')).toBe(500));
  it('PRO_PLUS = Infinity', () => expect(planProductLimit('PRO_PLUS')).toBe(Infinity));
  it('bilinmeyen plan FREE fallback', () =>
    expect(planProductLimit('BILINMIYOR')).toBe(50));
});

describe('planVitrinLimit', () => {
  it('FREE = 10', () => expect(planVitrinLimit('FREE')).toBe(10));
  it('PRO = 500', () => expect(planVitrinLimit('PRO')).toBe(500));
  it('PRO_PLUS = Infinity', () => expect(planVitrinLimit('PRO_PLUS')).toBe(Infinity));
  it('bilinmeyen plan FREE fallback (10)', () =>
    expect(planVitrinLimit('UNKNOWN')).toBe(10));
});

describe('planBranchLimit', () => {
  it('FREE = 1 (tek şube)', () => expect(planBranchLimit('FREE')).toBe(1));
  it('PRO = Infinity', () => expect(planBranchLimit('PRO')).toBe(Infinity));
  it('PRO_PLUS = Infinity', () => expect(planBranchLimit('PRO_PLUS')).toBe(Infinity));
});

describe('planHasExcelImport', () => {
  it('FREE = false', () => expect(planHasExcelImport('FREE')).toBe(false));
  it('PRO = true', () => expect(planHasExcelImport('PRO')).toBe(true));
  it('PRO_PLUS = true', () => expect(planHasExcelImport('PRO_PLUS')).toBe(true));
  it('bilinmeyen plan FREE fallback (false)', () =>
    expect(planHasExcelImport('UNKNOWN')).toBe(false));
});

describe('planHasAdvancedReports', () => {
  it('FREE = false (basit Pano KPI)', () =>
    expect(planHasAdvancedReports('FREE')).toBe(false));
  it('PRO = true (tam /admin/reports)', () =>
    expect(planHasAdvancedReports('PRO')).toBe(true));
  it('PRO_PLUS = true', () => expect(planHasAdvancedReports('PRO_PLUS')).toBe(true));
});

describe('planLimitDisplay', () => {
  it('FREE → "50"', () => expect(planLimitDisplay('FREE')).toBe('50'));
  it('PRO_PLUS → "∞"', () => expect(planLimitDisplay('PRO_PLUS')).toBe('∞'));
});

describe('planVitrinLimitDisplay', () => {
  it('FREE → "10"', () => expect(planVitrinLimitDisplay('FREE')).toBe('10'));
  it('PRO → "500"', () => expect(planVitrinLimitDisplay('PRO')).toBe('500'));
  it('PRO_PLUS → "∞"', () => expect(planVitrinLimitDisplay('PRO_PLUS')).toBe('∞'));
});

describe('planBranchLimitDisplay', () => {
  it('FREE → "1"', () => expect(planBranchLimitDisplay('FREE')).toBe('1'));
  it('PRO → "∞"', () => expect(planBranchLimitDisplay('PRO')).toBe('∞'));
});

describe('planPrice', () => {
  it('FREE = 0', () => expect(planPrice('FREE')).toBe(0));
  it('PRO = 1000', () => expect(planPrice('PRO')).toBe(1000));
  it('PRO_PLUS = 2000', () => expect(planPrice('PRO_PLUS')).toBe(2000));
});
