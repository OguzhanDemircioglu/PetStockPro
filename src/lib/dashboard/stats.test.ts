import { describe, it, expect, vi } from 'vitest';
import {
  getDashboardStats,
  listLowStock,
  listRecentActivity,
} from './stats';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';

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
      limit: ReturnType<typeof vi.fn>;
      then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
    } => {
      const node: ReturnType<typeof makeNode> = {
        from: vi.fn(() => makeNode()),
        innerJoin: vi.fn(() => makeNode()),
        leftJoin: vi.fn(() => makeNode()),
        where: vi.fn(() => makeNode()),
        orderBy: vi.fn(() => makeNode()),
        limit: vi.fn(() => makeNode()),
        then: (cb) => Promise.resolve(data).then(cb),
      };
      return node;
    };
    return makeNode();
  });
}

describe('getDashboardStats', () => {
  it('happy path — tüm metrikler dönüyor', async () => {
    const select = makeSelectChain([
      [
        {
          totalProducts: 12,
          totalActiveVariants: 18,
          totalStockQty: 240,
          branchCount: 2,
          todaySaleQty: 5,
          todaySaleRevenue: '1250.50',
          lowStockCount: 3,
        },
      ],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await getDashboardStats(COMPANY, db);
    expect(result).toEqual({
      totalProducts: 12,
      totalActiveVariants: 18,
      totalStockQty: 240,
      branchCount: 2,
      todaySaleQty: 5,
      todaySaleRevenue: '1250.50',
      lowStockCount: 3,
    });
  });

  it('empty tenant — sıfır defaults', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await getDashboardStats(COMPANY, db);
    expect(result.totalProducts).toBe(0);
    expect(result.todaySaleRevenue).toBe('0');
    expect(result.branchCount).toBe(0);
  });

  it('null değerler 0 ve "0"a normalize edilir', async () => {
    const select = makeSelectChain([
      [
        {
          totalProducts: null,
          totalActiveVariants: null,
          totalStockQty: null,
          branchCount: null,
          todaySaleQty: null,
          todaySaleRevenue: null,
          lowStockCount: null,
        },
      ],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await getDashboardStats(COMPANY, db);
    expect(result.totalProducts).toBe(0);
    expect(result.todaySaleRevenue).toBe('0');
  });
});

describe('listLowStock', () => {
  it('düşük stok variantları döner', async () => {
    const items = [
      {
        variantId: 'v1',
        productId: 'p1',
        productName: 'Royal Canin Adult',
        variantLabel: '2kg',
        sku: 'RC-2KG',
        branchId: 'b1',
        branchName: 'Merkez',
        stockQty: 2,
        threshold: 5,
      },
    ];
    const select = makeSelectChain([items]);
    const db = { select } as unknown as DbClient;

    const result = await listLowStock(COMPANY, db);
    expect(result).toEqual(items);
  });

  it('hiç düşük stok yoksa boş array', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await listLowStock(COMPANY, db);
    expect(result).toEqual([]);
  });
});

describe('listRecentActivity', () => {
  it('son hareketler döner', async () => {
    const acts = [
      {
        id: 'm1',
        type: 'stock_in',
        subtype: null,
        quantity: 50,
        productName: 'Royal Canin',
        variantLabel: '2kg',
        branchName: 'Merkez',
        createdAt: new Date('2026-05-15T12:00:00Z'),
      },
    ];
    const select = makeSelectChain([acts]);
    const db = { select } as unknown as DbClient;
    const result = await listRecentActivity(COMPANY, db, 5);
    expect(result).toEqual(acts);
  });
});
