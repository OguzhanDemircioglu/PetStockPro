import { describe, it, expect } from 'vitest';
import {
  PLAN_LIMITS,
  PLAN_LABELS,
  planProductLimit,
  planPrice,
  planLimitDisplay,
} from './plan-limits';

describe('PLAN_LIMITS', () => {
  it('FREE = 50 ürün, 0₺', () => {
    expect(PLAN_LIMITS.FREE.productLimit).toBe(50);
    expect(PLAN_LIMITS.FREE.priceMonthlyTry).toBe(0);
  });
  it('PRO = 500 ürün, 1250₺', () => {
    expect(PLAN_LIMITS.PRO.productLimit).toBe(500);
    expect(PLAN_LIMITS.PRO.priceMonthlyTry).toBe(1250);
  });
  it('PRO_PLUS = ∞, 2250₺', () => {
    expect(PLAN_LIMITS.PRO_PLUS.productLimit).toBe(Infinity);
    expect(PLAN_LIMITS.PRO_PLUS.priceMonthlyTry).toBe(2250);
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

describe('planLimitDisplay', () => {
  it('FREE → "50"', () => expect(planLimitDisplay('FREE')).toBe('50'));
  it('PRO_PLUS → "∞"', () => expect(planLimitDisplay('PRO_PLUS')).toBe('∞'));
});

describe('planPrice', () => {
  it('FREE = 0', () => expect(planPrice('FREE')).toBe(0));
  it('PRO = 1250', () => expect(planPrice('PRO')).toBe(1250));
  it('PRO_PLUS = 2250', () => expect(planPrice('PRO_PLUS')).toBe(2250));
});
