import { describe, it, expect } from 'vitest';
import {
  PERMISSION_KEYS,
  ALL_PERMISSION_KEYS,
  STAFF_DEFAULT_ON,
  STAFF_DEFAULT_OFF,
  PERMISSION_LABELS,
  isValidPermissionKey,
  type PermissionKey,
} from './permission-keys';

describe('PERMISSION_KEYS', () => {
  it('15 distinct key tanımlı (3 ON + 12 OFF) ve hepsi entity.action formatında', () => {
    expect(ALL_PERMISSION_KEYS).toHaveLength(15);
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(15); // distinct
    for (const key of ALL_PERMISSION_KEYS) {
      // entity.action — alfanumerik+underscore + nokta + alfanumerik+underscore
      expect(key).toMatch(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/);
    }
    // Spot-check: kritik 3 ON key
    expect(PERMISSION_KEYS.SALE_CREATE).toBe('sale.create');
    expect(PERMISSION_KEYS.VARIANT_VIEW).toBe('variant.view');
    expect(PERMISSION_KEYS.CUSTOMER_REF_WRITE).toBe('customer_ref.write');
  });

  it('PERMISSION_LABELS — her key için Türkçe label var, label tekrarsız', () => {
    for (const key of ALL_PERMISSION_KEYS) {
      const label = PERMISSION_LABELS[key];
      expect(label).toBeDefined();
      expect(label.length).toBeGreaterThan(2);
    }
    // Label'lar distinct olmalı (UI'da karışıklık olmasın)
    const labels = ALL_PERMISSION_KEYS.map((k) => PERMISSION_LABELS[k]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('STAFF_DEFAULT_ON: 3 key + hepsi PERMISSION_KEYS içinde + OFF ile çakışma yok', () => {
    expect(STAFF_DEFAULT_ON).toHaveLength(3);
    expect(STAFF_DEFAULT_ON).toEqual([
      'sale.create',
      'variant.view',
      'customer_ref.write',
    ]);
    // Her ON key gerçek PERMISSION_KEYS'de tanımlı olmalı
    for (const key of STAFF_DEFAULT_ON) {
      expect(ALL_PERMISSION_KEYS).toContain(key);
    }
    // OFF ile çakışma yok
    for (const onKey of STAFF_DEFAULT_ON) {
      expect(STAFF_DEFAULT_OFF).not.toContain(onKey);
    }
    // OFF: 12 key
    expect(STAFF_DEFAULT_OFF).toHaveLength(12);
    // ON ∪ OFF = ALL
    expect(STAFF_DEFAULT_ON.length + STAFF_DEFAULT_OFF.length).toBe(
      ALL_PERMISSION_KEYS.length,
    );
  });

  it('isValidPermissionKey — geçerli/geçersiz ayrımı', () => {
    expect(isValidPermissionKey('sale.create')).toBe(true);
    expect(isValidPermissionKey('vitrin.manage')).toBe(true);
    expect(isValidPermissionKey('unknown.action')).toBe(false);
    expect(isValidPermissionKey('')).toBe(false);
    expect(isValidPermissionKey('SALE.CREATE')).toBe(false); // case-sensitive
    // Type narrowing test (compile-time + runtime)
    const candidate: string = 'sale.create';
    if (isValidPermissionKey(candidate)) {
      const narrowed: PermissionKey = candidate;
      expect(narrowed).toBe('sale.create');
    }
  });
});
