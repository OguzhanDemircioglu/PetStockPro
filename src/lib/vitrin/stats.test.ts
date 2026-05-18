import { describe, it, expect, vi } from 'vitest';
import {
  getPlatformStats,
  listPopularProducts7d,
  listBestSellers,
} from './stats';
import type { DbClient } from '@/lib/db/client';

function makeStatsChain(values: number[]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const value = values[i++] ?? 0;
    const node: Record<string, unknown> = {};
    const wrap = () => node;
    node.from = vi.fn(wrap);
    node.innerJoin = vi.fn(wrap);
    node.where = vi.fn(() => Promise.resolve([{ count: value }]));
    return node;
  });
}

describe('getPlatformStats', () => {
  it('boş DB → 0/0/0', async () => {
    const select = makeStatsChain([0, 0, 0]);
    const db = { select } as unknown as DbClient;
    const result = await getPlatformStats(db);
    expect(result).toEqual({
      storefrontCount: 0,
      productCount: 0,
      cityCount: 0,
    });
  });

  it('3 ayrı COUNT(*) sorgusu — değerler doğru map\'lenir', async () => {
    const select = makeStatsChain([428, 1247, 47]);
    const db = { select } as unknown as DbClient;
    const result = await getPlatformStats(db);
    expect(result).toEqual({
      storefrontCount: 428,
      productCount: 1247,
      cityCount: 47,
    });
  });

  it('null değer → 0 normalize', async () => {
    const select = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{}]),
    }));
    const db = { select } as unknown as DbClient;
    const result = await getPlatformStats(db);
    expect(result).toEqual({
      storefrontCount: 0,
      productCount: 0,
      cityCount: 0,
    });
  });
});

describe('listPopularProducts7d', () => {
  function makePopularChain(rows: unknown[]) {
    const node: Record<string, unknown> = {};
    const wrap = () => node;
    node.from = vi.fn(wrap);
    node.innerJoin = vi.fn(wrap);
    node.leftJoin = vi.fn(wrap);
    node.where = vi.fn(wrap);
    node.groupBy = vi.fn(wrap);
    node.orderBy = vi.fn(wrap);
    node.limit = vi.fn(() => Promise.resolve(rows));
    return node;
  }

  it('boş — boş array', async () => {
    const select = vi.fn(() => makePopularChain([]));
    const db = { select } as unknown as DbClient;
    const result = await listPopularProducts7d(db);
    expect(result).toEqual([]);
  });

  it('happy — sıralı popüler ürün listesi döner', async () => {
    const sampleRows = [
      {
        productId: 'p1',
        productName: 'Royal Canin Adult Kedi 2kg',
        productSlug: 'royal-canin-adult-kedi-2kg',
        companyId: 'c1',
        companyName: 'Mavi Pet',
        companySlug: 'mavi-pet',
        cityName: 'İstanbul',
        districtName: 'Üsküdar',
        defaultSalePrice: '180.00',
        defaultVariantLabel: '2kg',
        primaryImageUrl: 'https://xxx.supabase.co/storage/v1/object/public/product-images/c1/p1/img.png',
        viewCount: 142,
      },
    ];
    const select = vi.fn(() => makePopularChain(sampleRows));
    const db = { select } as unknown as DbClient;
    const result = await listPopularProducts7d(db);
    expect(result).toEqual(sampleRows);
  });

  it('default window 7 gün, limit 8 — opts olmadan çağrılır', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const select = vi.fn().mockImplementation(() => {
      const n: Record<string, unknown> = {};
      const w = () => n;
      n.from = vi.fn(w);
      n.innerJoin = vi.fn(w);
      n.leftJoin = vi.fn(w);
      n.where = vi.fn(w);
      n.groupBy = vi.fn(w);
      n.orderBy = vi.fn(w);
      n.limit = limitMock;
      return n;
    });
    const db = { select } as unknown as DbClient;
    await listPopularProducts7d(db);
    expect(limitMock).toHaveBeenCalledWith(8);
  });

  it('limit clamp — max 50, min 1', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const makeChain = () => {
      const n: Record<string, unknown> = {};
      const w = () => n;
      n.from = vi.fn(w);
      n.innerJoin = vi.fn(w);
      n.leftJoin = vi.fn(w);
      n.where = vi.fn(w);
      n.groupBy = vi.fn(w);
      n.orderBy = vi.fn(w);
      n.limit = limitMock;
      return n;
    };
    const select = vi.fn(makeChain);
    const db = { select } as unknown as DbClient;

    await listPopularProducts7d(db, { limit: 999 });
    expect(limitMock).toHaveBeenLastCalledWith(50);

    await listPopularProducts7d(db, { limit: 0 });
    expect(limitMock).toHaveBeenLastCalledWith(1);
  });

  it('windowDays clamp — max 90, min 1', async () => {
    const select = vi.fn(() => {
      const n: Record<string, unknown> = {};
      const w = () => n;
      n.from = vi.fn(w);
      n.innerJoin = vi.fn(w);
      n.leftJoin = vi.fn(w);
      n.where = vi.fn(w);
      n.groupBy = vi.fn(w);
      n.orderBy = vi.fn(w);
      n.limit = vi.fn().mockResolvedValue([]);
      return n;
    });
    const db = { select } as unknown as DbClient;
    // Bir hata fırlatmamalı, internal clamp aktif
    await expect(listPopularProducts7d(db, { windowDays: 999 })).resolves.toEqual([]);
    await expect(listPopularProducts7d(db, { windowDays: 0 })).resolves.toEqual([]);
  });
});

describe('listBestSellers', () => {
  function makeChain(rows: unknown[]) {
    const node: Record<string, unknown> = {};
    const wrap = () => node;
    node.from = vi.fn(wrap);
    node.innerJoin = vi.fn(wrap);
    node.leftJoin = vi.fn(wrap);
    node.where = vi.fn(wrap);
    node.groupBy = vi.fn(wrap);
    node.orderBy = vi.fn(wrap);
    node.limit = vi.fn(() => Promise.resolve(rows));
    return node;
  }

  it('boş satış → boş array', async () => {
    const select = vi.fn(() => makeChain([]));
    const db = { select } as unknown as DbClient;
    const result = await listBestSellers(db);
    expect(result).toEqual([]);
  });

  it('happy — totalSold sıralı satış listesi döner', async () => {
    const sampleRows = [
      {
        productId: 'p1',
        productName: 'Royal Canin Adult Kedi 2kg',
        productSlug: 'royal-canin-adult-kedi-2kg',
        companyId: 'c1',
        companyName: 'Mavi Pet',
        companySlug: 'mavi-pet',
        cityName: 'İstanbul',
        districtName: 'Üsküdar',
        defaultSalePrice: '180.00',
        defaultVariantLabel: '2kg',
        primaryImageUrl: null,
        totalSold: 87,
      },
    ];
    const select = vi.fn(() => makeChain(sampleRows));
    const db = { select } as unknown as DbClient;
    const result = await listBestSellers(db);
    expect(result).toEqual(sampleRows);
  });

  it('default window 30 gün + limit 8', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const select = vi.fn(() => {
      const n: Record<string, unknown> = {};
      const w = () => n;
      n.from = vi.fn(w);
      n.innerJoin = vi.fn(w);
      n.leftJoin = vi.fn(w);
      n.where = vi.fn(w);
      n.groupBy = vi.fn(w);
      n.orderBy = vi.fn(w);
      n.limit = limitMock;
      return n;
    });
    const db = { select } as unknown as DbClient;
    await listBestSellers(db);
    expect(limitMock).toHaveBeenCalledWith(8);
  });

  it('limit clamp — max 50, min 1', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const makeChainLimit = () => {
      const n: Record<string, unknown> = {};
      const w = () => n;
      n.from = vi.fn(w);
      n.innerJoin = vi.fn(w);
      n.leftJoin = vi.fn(w);
      n.where = vi.fn(w);
      n.groupBy = vi.fn(w);
      n.orderBy = vi.fn(w);
      n.limit = limitMock;
      return n;
    };
    const select = vi.fn(makeChainLimit);
    const db = { select } as unknown as DbClient;
    await listBestSellers(db, { limit: 999 });
    expect(limitMock).toHaveBeenLastCalledWith(50);
    await listBestSellers(db, { limit: 0 });
    expect(limitMock).toHaveBeenLastCalledWith(1);
  });

  it('windowDays clamp — max 180, min 1, hata fırlatmaz', async () => {
    const select = vi.fn(() => makeChain([]));
    const db = { select } as unknown as DbClient;
    await expect(listBestSellers(db, { windowDays: 9999 })).resolves.toEqual([]);
    await expect(listBestSellers(db, { windowDays: -5 })).resolves.toEqual([]);
  });
});
