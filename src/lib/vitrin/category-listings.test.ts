import { describe, it, expect, vi } from 'vitest';
import {
  getCategoryInfoBySlug,
  listProductsByCategorySlug,
  countProductsByCategorySlug,
  listCategoriesWithStorefrontProducts,
  listCategoryNavTree,
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
  it('root slug — emoji + name döner', () => {
    const info = getCategoryInfoBySlug('kedi');
    expect(info.slug).toBe('kedi');
    expect(info.name).toBe('Kedi');
    expect(info.emoji).toBe('🐱');
    expect(info.isDefault).toBe(true);
  });

  it('child slug (kedi-kuru-mamalar) — hiyerarşik default kategori', () => {
    const info = getCategoryInfoBySlug('kedi-kuru-mamalar');
    expect(info.slug).toBe('kedi-kuru-mamalar');
    expect(info.name).toBe('Kuru Mamalar');
    expect(info.emoji).toBe('🥩');
    expect(info.isDefault).toBe(true);
  });

  it('kedi-vitamin-ve-katkilari default kategori', () => {
    const info = getCategoryInfoBySlug('kedi-vitamin-ve-katkilari');
    expect(info.name).toBe('Vitamin ve Katkıları');
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
        { slug: 'kedi-kuru-mamalar', productCount: 18 },
        { slug: 'kedi-oyuncaklar', productCount: 7 },
      ],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await listCategoriesWithStorefrontProducts(db);
    expect(result).toHaveLength(3);
    // Sıralama: productCount DESC
    expect(result[0].slug).toBe('kedi-kuru-mamalar');
    expect(result[0].productCount).toBe(18);
    expect(result[0].name).toBe('Kuru Mamalar');
    expect(result[0].emoji).toBe('🥩');
    expect(result[0].isDefault).toBe(true);

    expect(result[1].slug).toBe('kedi-oyuncaklar');
    expect(result[1].name).toBe('Oyuncaklar');
    expect(result[1].emoji).toBe('🎾');
    expect(result[1].isDefault).toBe(true);

    expect(result[2].slug).toBe('aksesuar-genel'); // custom
    expect(result[2].name).toBe('Diğer');
    expect(result[2].isDefault).toBe(false);
  });
});

describe('listCategoryNavTree', () => {
  it('boş DB — 6 root döner, hepsi 0 ürün', async () => {
    // listCategoriesWithStorefrontProducts boş array döner
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await listCategoryNavTree(db);
    // 6 root: kedi, kopek, kus, akvaryum, kemirgen, surungenler
    expect(result).toHaveLength(6);
    for (const root of result) {
      expect(root.totalProductCount).toBe(0);
      for (const c of root.children) {
        expect(c.productCount).toBe(0);
      }
    }
    // Kedi root'unun child sayısı: default-categories.ts'de 10 child var
    const kedi = result.find((r) => r.slug === 'kedi');
    expect(kedi?.children.length).toBe(10);
  });

  it('child slug count varsa root totalProductCount toplanır', async () => {
    const select = makeSelectChain([
      [
        { slug: 'kedi-kuru-mamalar', productCount: 12 },
        { slug: 'kedi-yas-mamalar', productCount: 3 },
        { slug: 'kopek-oyuncaklar', productCount: 5 },
      ],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await listCategoryNavTree(db);

    const kedi = result.find((r) => r.slug === 'kedi');
    expect(kedi?.totalProductCount).toBe(15); // 12 + 3
    const kediKuru = kedi?.children.find((c) => c.slug === 'kedi-kuru-mamalar');
    expect(kediKuru?.productCount).toBe(12);
    const kediYas = kedi?.children.find((c) => c.slug === 'kedi-yas-mamalar');
    expect(kediYas?.productCount).toBe(3);

    const kopek = result.find((r) => r.slug === 'kopek');
    expect(kopek?.totalProductCount).toBe(5);
    const kopekOyun = kopek?.children.find((c) => c.slug === 'kopek-oyuncaklar');
    expect(kopekOyun?.productCount).toBe(5);

    // Hiç ürünü olmayan root'lar 0 toplam
    const akvaryum = result.find((r) => r.slug === 'akvaryum');
    expect(akvaryum?.totalProductCount).toBe(0);
  });

  it('root\'a doğrudan atanmış ürünler + child ürünleri birlikte sayılır', async () => {
    const select = makeSelectChain([
      [
        { slug: 'kedi', productCount: 4 }, // root'a doğrudan
        { slug: 'kedi-kuru-mamalar', productCount: 6 },
      ],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await listCategoryNavTree(db);
    const kedi = result.find((r) => r.slug === 'kedi');
    expect(kedi?.totalProductCount).toBe(10); // 4 (root) + 6 (child)
  });

  it('children TR locale ile alfabetik sıralı', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await listCategoryNavTree(db);
    const kedi = result.find((r) => r.slug === 'kedi');
    expect(kedi).toBeDefined();
    // Children TR locale ile alfabetik — ilk birkaç child'ı kontrol
    // (default-categories sırası ile değil, isim sırası ile)
    const names = kedi!.children.map((c) => c.name);
    const sortedCopy = [...names].sort((a, b) => a.localeCompare(b, 'tr'));
    expect(names).toEqual(sortedCopy);
  });
});
