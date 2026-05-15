import { describe, it, expect, vi } from 'vitest';
import {
  dailySalesSummary,
  topSellingVariants,
  periodSummary,
} from './sales';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const NOW = new Date('2026-05-15T12:00:00Z');

function makeSelectChain(responses: unknown[][]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const data = responses[i++] ?? [];
    const makeNode = (): {
      from: ReturnType<typeof vi.fn>;
      innerJoin: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
    } => {
      const node: ReturnType<typeof makeNode> = {
        from: vi.fn(() => makeNode()),
        innerJoin: vi.fn(() => makeNode()),
        where: vi.fn(() => makeNode()),
        groupBy: vi.fn(() => makeNode()),
        orderBy: vi.fn(() => makeNode()),
        limit: vi.fn(() => makeNode()),
        then: (cb) => Promise.resolve(data).then(cb),
      };
      return node;
    };
    return makeNode();
  });
}

describe('dailySalesSummary', () => {
  it('happy path — sıralı gün satırları', async () => {
    const rows = [
      { day: '2026-05-15', qty: 25, revenue: '87475.00', count: 1 },
      { day: '2026-05-14', qty: 10, revenue: '34990.00', count: 2 },
    ];
    const select = makeSelectChain([rows]);
    const db = { select } as unknown as DbClient;

    const result = await dailySalesSummary(COMPANY, db, 30, NOW);
    expect(result).toEqual(rows);
  });

  it('boş dönem → boş array', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await dailySalesSummary(COMPANY, db, 30, NOW);
    expect(result).toEqual([]);
  });
});

describe('topSellingVariants', () => {
  it('en çok satan variant döner', async () => {
    const rows = [
      {
        variantId: 'v1',
        productName: 'Royal Canin',
        variantLabel: '2kg',
        sku: 'RC-2KG',
        totalQty: 30,
        totalRevenue: '5415.00',
        saleCount: 8,
      },
    ];
    const select = makeSelectChain([rows]);
    const db = { select } as unknown as DbClient;
    const result = await topSellingVariants(COMPANY, db, 30, 10, NOW);
    expect(result).toEqual(rows);
  });
});

describe('periodSummary', () => {
  it('avgBasket = revenue / count', async () => {
    const select = makeSelectChain([
      [{ totalQty: 25, totalRevenue: '87475.00', saleCount: 5 }],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await periodSummary(COMPANY, db, 30, NOW);
    expect(result.totalQty).toBe(25);
    expect(result.totalRevenue).toBe('87475.00');
    expect(result.saleCount).toBe(5);
    expect(result.avgBasket).toBe('17495.00'); // 87475 / 5
  });

  it('saleCount=0 → avgBasket "0.00"', async () => {
    const select = makeSelectChain([
      [{ totalQty: 0, totalRevenue: '0', saleCount: 0 }],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await periodSummary(COMPANY, db, 30, NOW);
    expect(result.avgBasket).toBe('0.00');
  });

  it('boş response — defaults', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await periodSummary(COMPANY, db, 30, NOW);
    expect(result.totalQty).toBe(0);
    expect(result.totalRevenue).toBe('0');
    expect(result.saleCount).toBe(0);
    expect(result.avgBasket).toBe('0.00');
  });
});
