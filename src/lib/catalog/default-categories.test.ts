import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_CATEGORIES,
  seedDefaultCategoriesForCompany,
} from './default-categories';
import type { DbClient } from '@/lib/db/client';

describe('DEFAULT_CATEGORIES', () => {
  it('16 kategori içerir', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(16);
  });

  it('slug\'lar unique', () => {
    const slugs = DEFAULT_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('slug formatı kebab-case alfanumerik tire', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('vatRate sadece 10.00 veya 20.00', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(['10.00', '20.00']).toContain(c.vatRate);
    }
  });

  it('Pet gıda (mama + snack) %10 KDV (TR gıda oranı)', () => {
    const foodSlugs = ['kuru-mama', 'yas-mama', 'odul-snack'];
    const foodCategories = DEFAULT_CATEGORIES.filter((c) => foodSlugs.includes(c.slug));
    expect(foodCategories).toHaveLength(3);
    expect(foodCategories.every((c) => c.vatRate === '10.00')).toBe(true);
  });

  it('Mama + sağlık kategorileri SKT required', () => {
    const sktCategories = DEFAULT_CATEGORIES.filter((c) => c.sktRequired);
    // En az 5 SKT-required kategori (mama 3 + sağlık 2+)
    expect(sktCategories.length).toBeGreaterThanOrEqual(5);
  });

  it('Diğer kategori en sonda (displayOrder=99)', () => {
    const diger = DEFAULT_CATEGORIES.find((c) => c.slug === 'diger');
    expect(diger?.displayOrder).toBe(99);
  });

  it('displayOrder ardışık (1..15) + 99', () => {
    const orders = DEFAULT_CATEGORIES.map((c) => c.displayOrder).sort((a, b) => a - b);
    // 1, 2, 3, ..., 15, 99
    for (let i = 0; i < 15; i++) {
      expect(orders[i]).toBe(i + 1);
    }
    expect(orders[15]).toBe(99);
  });

  it('Her kategori emoji içerir', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.emoji.length).toBeGreaterThan(0);
    }
  });
});

describe('seedDefaultCategoriesForCompany', () => {
  it('Tüm 16 kategori companyId ile insert edilir', async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insertFn = vi.fn().mockReturnValue({ values: insertValues });
    const db = { insert: insertFn } as unknown as DbClient;

    const result = await seedDefaultCategoriesForCompany('company-1', db);

    expect(result.inserted).toBe(16);
    expect(insertValues).toHaveBeenCalledTimes(1);
    const rows = insertValues.mock.calls[0][0];
    expect(rows).toHaveLength(16);
    expect(rows[0]).toMatchObject({
      companyId: 'company-1',
      slug: 'kuru-mama',
      vatRate: '10.00',
      sktRequired: true,
    });
  });
});
