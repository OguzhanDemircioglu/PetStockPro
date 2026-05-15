import { describe, it, expect } from 'vitest';
import {
  VAT_RATES,
  DEFAULT_VAT_RATE,
  VAT_RATE_OPTIONS,
  priceWithoutVat,
  priceWithVat,
  vatAmount,
} from './vat-rates';

describe('VAT_RATES sabitleri (TR 2024+ oranlar)', () => {
  it('standart KDV %20', () => {
    expect(VAT_RATES.STANDARD).toBe(20);
  });

  it('pet mama özel oran %10', () => {
    expect(VAT_RATES.PET_FOOD).toBe(10);
  });

  it('indirilmiş oran %8', () => {
    expect(VAT_RATES.REDUCED).toBe(8);
  });

  it('KDV-siz %0', () => {
    expect(VAT_RATES.ZERO).toBe(0);
  });

  it('DEFAULT_VAT_RATE standart oran (%20)', () => {
    expect(DEFAULT_VAT_RATE).toBe(20);
  });

  it('VAT_RATE_OPTIONS 4 oran içerir', () => {
    expect(VAT_RATE_OPTIONS).toHaveLength(4);
    expect(VAT_RATE_OPTIONS.map((o) => o.value)).toEqual([20, 10, 8, 0]);
  });
});

describe('priceWithoutVat — KDV dahil fiyattan KDV hariç', () => {
  it('120₺ %20 KDV dahil → 100₺ KDV hariç', () => {
    expect(priceWithoutVat(120, 20)).toBeCloseTo(100, 2);
  });

  it('110₺ %10 KDV dahil → 100₺ KDV hariç', () => {
    expect(priceWithoutVat(110, 10)).toBeCloseTo(100, 2);
  });

  it('108₺ %8 KDV dahil → 100₺ KDV hariç', () => {
    expect(priceWithoutVat(108, 8)).toBeCloseTo(100, 2);
  });

  it('%0 KDV ise fiyat değişmez', () => {
    expect(priceWithoutVat(50, 0)).toBe(50);
  });
});

describe('priceWithVat — KDV hariç fiyata KDV ekle', () => {
  it('100₺ + %20 KDV → 120₺', () => {
    expect(priceWithVat(100, 20)).toBeCloseTo(120, 2);
  });

  it('100₺ + %10 KDV → 110₺', () => {
    expect(priceWithVat(100, 10)).toBeCloseTo(110, 2);
  });

  it('100₺ + %8 KDV → 108₺', () => {
    expect(priceWithVat(100, 8)).toBeCloseTo(108, 2);
  });

  it('100₺ + %0 KDV → 100₺', () => {
    expect(priceWithVat(100, 0)).toBe(100);
  });
});

describe('vatAmount — KDV tutarı (dahil fiyattan)', () => {
  it('120₺ KDV dahil %20 → 20₺ KDV', () => {
    expect(vatAmount(120, 20)).toBeCloseTo(20, 2);
  });

  it('110₺ KDV dahil %10 → 10₺ KDV', () => {
    expect(vatAmount(110, 10)).toBeCloseTo(10, 2);
  });

  it('108₺ KDV dahil %8 → 8₺ KDV', () => {
    expect(vatAmount(108, 8)).toBeCloseTo(8, 2);
  });

  it('%0 KDV → tutar 0', () => {
    expect(vatAmount(50, 0)).toBe(0);
  });
});
