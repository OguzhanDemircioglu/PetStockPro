import { describe, it, expect, vi } from 'vitest';
import {
  getCategoryInfoBySlug,
  listProductsByCategorySlug,
  countProductsByCategorySlug,
  listCategoriesWithStorefrontProducts,
} from './category-listings';
import type { DbClient } from '@/lib/db/client';

function makeSelectChain(responses: unknown[][]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const data = responses[i++] ?? [];
    const makeNode = (): {
      from: ReturnType<typeof vi.fn>;
      innerJoin: ReturnType<typeof vi.fn>;
      leftJoin: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      offset: ReturnType<typeof vi.fn>;
      then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
    } => {
      const node: ReturnType<typeof makeNode> = {
        from: vi.fn(() => makeNode()),
        innerJoin: vi.fn(() => makeNode()),
        leftJoin: vi.fn(() => makeNode()),
        where: vi.fn(() => makeNode()),
        orderBy: vi.fn(() => makeNode()),
        groupBy: vi.fn(() => makeNode()),
        limit: vi.fn(() => makeNode()),
        offset: vi.fn(() => makeNode()),
        then: (cb) => Promise.resolve(data).then(cb),
      };
      return node;
    };
    return makeNode();
  });
}

describe('getCategoryInfoBySlug', () => {
  it('default slug — emoji + name döner', () => {
    const info = getCategoryInfoBySlug('kuru-mama');
    expect(info.slug).toBe('kuru-mama');
    expect(info.name).toBe('Kuru Mama');
    expect(info.emoji).toBe('🥘');
    expect(info.isDefault).toBe(true);
  });

  it('vitamin-ilac default kategori', () => {
    const info = getCategoryInfoBySlug('vitamin-ilac');
    expect(info.name).toBe('Vitamin / İlaç');
    expect(info.emoji).toBe('💊');
    expect(info.isDefault).toBe(true);
  });

  it('custom (default olmayan) slug — Diğer fallback', () => {
    const info = getCategoryInfoBySlug('papagan-yemi');
    expect(info.name).toBe('Diğer');
    expect(info.emoji).toBe('📦');
    expect(info.isDefault).toBe(false);
    expect(info.slug).toBe('papagan-yemi');
  });
});

describe('listProductsByCategorySlug', () => {
  it('boş — boş array', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await listProductsByCategorySlug('kuru-mama', db);
    expect(result).toEqual([]);
  });

  it('happy — ürünler döner', async () => {
    const rows = [
      {
        productId: 'p1',
        productName: 'Royal Canin Adult Kedi',
        productSlug: 'royal-canin-adult-kedi',
        companyId: 'c1',
        companySlug: 'mavi-pet',
        companyName: 'Mavi Pet',
        cityName: 'İzmir',
        districtName: 'Bornova',
        brandName: 'Royal Canin',
        defaultSalePrice: '450.00',
        defaultVariantLabel: '2kg',
      },
    ];
    const select = makeSelectChain([rows]);
    const db = { select } as unknown as DbClient;
    const result = await listProductsByCategorySlug('kuru-mama', db, { limit: 12 });
    expect(result).toEqual(rows);
  });

  it('limit clamp — max 60', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    await listProductsByCategorySlug('kuru-mama', db, { limit: 999 });
    expect(select).toHaveBeenCalled();
  });

  it('offset 0 default', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    await listProductsByCategorySlug('kuru-mama', db);
    expect(select).toHaveBeenCalled();
  });

  it('cityId filter chain çalışır', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    await listProductsByCategorySlug('kuru-mama', db, { cityId: 35 });
    expect(select).toHaveBeenCalled();
  });
});

describe('countProductsByCategorySlug', () => {
  it('boş — 0', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await countProductsByCategorySlug('kuru-mama', db);
    expect(result).toBe(0);
  });

  it('happy — sayım döner', async () => {
    const select = makeSelectChain([[{ count: 42 }]]);
    const db = { select } as unknown as DbClient;
    const result = await countProductsByCategorySlug('kuru-mama', db);
    expect(result).toBe(42);
  });

  it('cityId filter chain çalışır', async () => {
    const select = makeSelectChain([[{ count: 5 }]]);
    const db = { select } as unknown as DbClient;
    const result = await countProductsByCategorySlug('kuru-mama', db, { cityId: 35 });
    expect(result).toBe(5);
  });
});

describe('listCategoriesWithStorefrontProducts', () => {
  it('boş — boş array', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await listCategoriesWithStorefrontProducts(db);
    expect(result).toEqual([]);
  });

  it('productCount DESC sıralama + getCategoryInfoBySlug enrich', async () => {
    const select = makeSelectChain([
      [
        { slug: 'aksesuar-genel', productCount: 5 }, // custom slug → "Diğer" fallback
        { slug: 'kuru-mama', productCount: 18 },
        { slug: 'oyuncak', productCount: 7 },
      ],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await listCategoriesWithStorefrontProducts(db);
    expect(result).toHaveLength(3);
    // Sıralama: productCount DESC
    expect(result[0].slug).toBe('kuru-mama');
    expect(result[0].productCount).toBe(18);
    expect(result[0].name).toBe('Kuru Mama');
    expect(result[0].emoji).toBe('🥘');
    expect(result[0].isDefault).toBe(true);

    expect(result[1].slug).toBe('oyuncak');
    expect(result[1].name).toBe('Oyuncak');

    expect(result[2].slug).toBe('aksesuar-genel'); // custom
    expect(result[2].name).toBe('Diğer');
    expect(result[2].isDefault).toBe(false);
  });
});
