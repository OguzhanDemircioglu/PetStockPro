import { describe, it, expect } from 'vitest';
import {
  computeDiscountTier,
  computeMonthsOfInventory,
  computeSuggestedPrice,
  formatMonthsOfInventory,
  MIN_MONTHS_THRESHOLD,
  MIN_STOCK_THRESHOLD,
} from './discount-suggestions';

describe('computeMonthsOfInventory', () => {
  it('sale30d=0 → Infinity', () => {
    expect(computeMonthsOfInventory(100, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('sale30d negatif (paranoia) → Infinity', () => {
    expect(computeMonthsOfInventory(100, -5)).toBe(Number.POSITIVE_INFINITY);
  });

  it('normal hesap — 200 stok, 30g 10 satış → 20 ay', () => {
    // sale30d=10 demek "ayda 10 satış" — 200 stok 20 ay yeter
    expect(computeMonthsOfInventory(200, 10)).toBe(20);
  });

  it('hızlı satış — 50 stok, 30g 100 satış → 0.5 ay', () => {
    expect(computeMonthsOfInventory(50, 100)).toBe(0.5);
  });

  it('orta — 95 stok, 30g 54 satış → 1.76 ay (öneri eşik altında)', () => {
    const months = computeMonthsOfInventory(95, 54);
    expect(months).toBeCloseTo(1.759, 2);
    expect(computeDiscountTier(months, 95, 54)).toBeNull();
  });
});

describe('computeDiscountTier', () => {
  it('totalStock < MIN → null', () => {
    expect(computeDiscountTier(100, MIN_STOCK_THRESHOLD - 1, 0)).toBeNull();
  });

  it('sale30d=0 ama düşük stok → null', () => {
    expect(computeDiscountTier(Infinity, 20, 0)).toBeNull();
  });

  it('sale30d=0 ve yüksek stok (>50) → 30', () => {
    expect(computeDiscountTier(Infinity, 60, 0)).toBe(30);
  });

  it('monthsOfInventory < threshold → null', () => {
    expect(
      computeDiscountTier(MIN_MONTHS_THRESHOLD - 0.1, 100, 50),
    ).toBeNull();
  });

  it('6-12 ay → 10', () => {
    expect(computeDiscountTier(8, 100, 25)).toBe(10);
    expect(computeDiscountTier(MIN_MONTHS_THRESHOLD, 100, 50)).toBe(10);
  });

  it('12-24 ay → 20', () => {
    expect(computeDiscountTier(15, 200, 20)).toBe(20);
    expect(computeDiscountTier(12, 200, 25)).toBe(20);
  });

  it('24+ ay → 30', () => {
    expect(computeDiscountTier(40, 200, 5)).toBe(30);
    expect(computeDiscountTier(24, 200, 5)).toBe(30);
  });
});

describe('computeSuggestedPrice', () => {
  it('10% indirim — 100₺ → 90.00', () => {
    expect(computeSuggestedPrice('100.00', 10)).toBe('90.00');
  });

  it('20% indirim — 99.99₺ → 79.99', () => {
    expect(computeSuggestedPrice('99.99', 20)).toBe('79.99');
  });

  it('30% indirim — 8.50₺ → 5.95', () => {
    expect(computeSuggestedPrice('8.50', 30)).toBe('5.95');
  });

  it('penny-safe yuvarlama — 33.33 × 0.9 → 30.00', () => {
    expect(computeSuggestedPrice('33.33', 10)).toBe('30.00');
  });

  it('salePrice=0 — değişmez', () => {
    expect(computeSuggestedPrice('0', 30)).toBe('0');
  });

  it('salePrice geçersiz string — değişmez', () => {
    expect(computeSuggestedPrice('abc', 20)).toBe('abc');
  });

  it('salePrice negatif — değişmez', () => {
    expect(computeSuggestedPrice('-5.00', 10)).toBe('-5.00');
  });
});

describe('formatMonthsOfInventory', () => {
  it('Infinity → "∞ ay"', () => {
    expect(formatMonthsOfInventory(Infinity)).toBe('∞ ay');
  });

  it('24+ ay → tam sayı', () => {
    expect(formatMonthsOfInventory(40)).toBe('40 ay');
    expect(formatMonthsOfInventory(24)).toBe('24 ay');
  });

  it('24- ay → 1 ondalık', () => {
    expect(formatMonthsOfInventory(8.5)).toBe('8.5 ay');
    expect(formatMonthsOfInventory(6)).toBe('6.0 ay');
  });
});
