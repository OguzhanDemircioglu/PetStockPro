import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_CATEGORIES,
  seedDefaultCategoriesForCompany,
} from './default-categories';
import type { DbClient } from '@/lib/db/client';

describe('DEFAULT_CATEGORIES', () => {
  it('49 kategori içerir (6 üst + 43 alt)', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(49);
    const roots = DEFAULT_CATEGORIES.filter((c) => !c.parentSlug);
    const children = DEFAULT_CATEGORIES.filter((c) => c.parentSlug);
    expect(roots).toHaveLength(6);
    expect(children).toHaveLength(43);
  });

  it("slug'lar unique", () => {
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

  it('Her child.parentSlug bir root slug eşler', () => {
    const rootSlugs = new Set(
      DEFAULT_CATEGORIES.filter((c) => !c.parentSlug).map((c) => c.slug),
    );
    for (const c of DEFAULT_CATEGORIES.filter((c) => c.parentSlug)) {
      expect(rootSlugs.has(c.parentSlug!)).toBe(true);
    }
  });

  it('6 root: Kedi/Köpek/Kuş/Akvaryum/Kemirgen/Sürüngen', () => {
    const rootSlugs = DEFAULT_CATEGORIES.filter((c) => !c.parentSlug).map(
      (c) => c.slug,
    );
    expect(rootSlugs.sort()).toEqual(
      [
        'akvaryum',
        'kedi',
        'kemirgen',
        'kopek',
        'kus',
        'surungenler',
      ].sort(),
    );
  });

  it("Mama (kedi/köpek kuru/yaş mamalar, ödüller) %10 KDV — TR gıda oranı", () => {
    const foodSlugs = [
      'kedi-kuru-mamalar',
      'kedi-yas-mamalar',
      'kedi-oduller',
      'kopek-kuru-mamalar',
      'kopek-yas-mamalar',
      'kopek-oduller',
      'kus-yemler',
      'akvaryum-balik-yemi',
      'kemirgen-yemler',
      'surungenler-yemi',
    ];
    for (const slug of foodSlugs) {
      const c = DEFAULT_CATEGORIES.find((x) => x.slug === slug);
      expect(c?.vatRate, `${slug} %10 olmalı`).toBe('10.00');
    }
  });

  it('Mama + yem + vitamin kategorileri SKT required', () => {
    const sktCategories = DEFAULT_CATEGORIES.filter((c) => c.sktRequired);
    expect(sktCategories.length).toBeGreaterThanOrEqual(10);
  });

  it('Her kategori emoji içerir', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.emoji.length).toBeGreaterThan(0);
    }
  });

  it('Root displayOrder 1..6 sıralı', () => {
    const roots = DEFAULT_CATEGORIES.filter((c) => !c.parentSlug).sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
    expect(roots.map((r) => r.displayOrder)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('seedDefaultCategoriesForCompany', () => {
  it('Root + children iki ayrı insert (2-fazlı), parent_id resolve edilir', async () => {
    // İlk insert (roots) returning(slug, id) döner — 6 row mock'la.
    const returningMock = vi.fn().mockResolvedValue([
      { id: 'root-kedi', slug: 'kedi' },
      { id: 'root-kopek', slug: 'kopek' },
      { id: 'root-kus', slug: 'kus' },
      { id: 'root-akvaryum', slug: 'akvaryum' },
      { id: 'root-kemirgen', slug: 'kemirgen' },
      { id: 'root-surungenler', slug: 'surungenler' },
    ]);
    const firstInsertValues = vi
      .fn()
      .mockReturnValue({ returning: returningMock });
    const secondInsertValues = vi.fn().mockResolvedValue(undefined);

    let callCount = 0;
    const insertFn = vi.fn().mockImplementation(() => {
      callCount += 1;
      return callCount === 1
        ? { values: firstInsertValues }
        : { values: secondInsertValues };
    });
    const db = { insert: insertFn } as unknown as DbClient;

    const result = await seedDefaultCategoriesForCompany('company-1', db);

    expect(result.inserted).toBe(49);
    expect(insertFn).toHaveBeenCalledTimes(2);

    // 1. çağrı: 6 root
    const rootRows = firstInsertValues.mock.calls[0][0];
    expect(rootRows).toHaveLength(6);
    expect(rootRows[0]).toMatchObject({
      companyId: 'company-1',
      parentId: null,
      slug: 'kedi',
    });

    // 2. çağrı: 43 child, parent_id resolve edilmiş
    const childRows = secondInsertValues.mock.calls[0][0];
    expect(childRows).toHaveLength(43);
    // İlk child Kedi alt kategorisi: parentId='root-kedi'
    const firstKediChild = childRows.find(
      (r: { slug: string; parentId: string }) =>
        r.slug === 'kedi-kuru-mamalar',
    );
    expect(firstKediChild?.parentId).toBe('root-kedi');
    // Sürüngen child
    const firstSurChild = childRows.find(
      (r: { slug: string; parentId: string }) => r.slug === 'surungenler-yemi',
    );
    expect(firstSurChild?.parentId).toBe('root-surungenler');
  });
});
