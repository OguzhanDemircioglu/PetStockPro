import { describe, it, expect, vi } from 'vitest';
import { activityCountByAction, activityDailySummary, activityTotals } from './activity';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';

function makeMockDb(rows: unknown[]) {
  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      groupBy: vi.fn().mockImplementation(() => chain),
      orderBy: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(rows),
      then: (cb: (r: unknown[]) => unknown) => Promise.resolve(rows).then(cb),
    };
    return chain;
  });
  return { select } as unknown as DbClient;
}

describe('activityCountByAction', () => {
  it('action count rows döner', async () => {
    const db = makeMockDb([
      { action: 'stock.out', count: 12 },
      { action: 'stocktake.completed', count: 3 },
    ]);
    const r = await activityCountByAction(COMPANY, db, 30, 10);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ action: 'stock.out', count: 12 });
  });

  it('empty array kabul', async () => {
    const db = makeMockDb([]);
    const r = await activityCountByAction(COMPANY, db);
    expect(r).toEqual([]);
  });
});

describe('activityDailySummary', () => {
  it('günlük seri döner', async () => {
    const db = makeMockDb([
      { day: '2026-05-15', count: 4 },
      { day: '2026-05-16', count: 6 },
    ]);
    const r = await activityDailySummary(COMPANY, db, 30);
    expect(r).toHaveLength(2);
    expect(r[0].day).toBe('2026-05-15');
  });
});

describe('activityTotals', () => {
  it('toplam metrikler döner', async () => {
    const db = makeMockDb([
      { totalActions: 25, uniqueActionTypes: 8, uniqueUsers: 3 },
    ]);
    const r = await activityTotals(COMPANY, db, 30);
    expect(r).toEqual({ totalActions: 25, uniqueActionTypes: 8, uniqueUsers: 3 });
  });

  it('empty → 0/0/0', async () => {
    const db = makeMockDb([]);
    const r = await activityTotals(COMPANY, db, 30);
    expect(r).toEqual({ totalActions: 0, uniqueActionTypes: 0, uniqueUsers: 0 });
  });
});
