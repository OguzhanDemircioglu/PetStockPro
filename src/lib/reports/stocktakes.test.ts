import { describe, it, expect, vi } from 'vitest';
import { listStocktakeHistory, stocktakeHistorySummary } from './stocktakes';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';

function makeMockDb(selectResponse: unknown[]) {
  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      leftJoin: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      orderBy: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(selectResponse),
      then: (cb: (rows: unknown[]) => unknown) => Promise.resolve(selectResponse).then(cb),
    };
    return chain;
  });
  return { select } as unknown as DbClient;
}

describe('listStocktakeHistory', () => {
  it('completed + cancelled satırlar döner + durationMinutes hesaplanır', async () => {
    const startedAt = new Date('2026-05-15T10:00:00Z');
    const closedAt = new Date('2026-05-15T10:25:00Z'); // 25 dk
    const db = makeMockDb([
      {
        id: 'sk1',
        branchName: 'Merkez',
        status: 'completed',
        totalItems: 10,
        countedItems: 10,
        diffItems: 2,
        startedAt,
        closedAt,
        startedByEmail: 'admin@petshop.com',
      },
    ]);
    const result = await listStocktakeHistory(COMPANY, db, 30, 10);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('completed');
    expect(result[0].durationMinutes).toBe(25);
    expect(result[0].diffItems).toBe(2);
  });

  it('closedAt yoksa durationMinutes = null', async () => {
    const db = makeMockDb([
      {
        id: 'sk2',
        branchName: 'Merkez',
        status: 'cancelled',
        totalItems: 5,
        countedItems: 1,
        diffItems: 0,
        startedAt: new Date('2026-05-15T10:00:00Z'),
        closedAt: null,
        startedByEmail: null,
      },
    ]);
    const result = await listStocktakeHistory(COMPANY, db, 30, 10);
    expect(result[0].durationMinutes).toBeNull();
  });

  it('empty array reddi: hiç sayım yoksa boş array', async () => {
    const db = makeMockDb([]);
    const result = await listStocktakeHistory(COMPANY, db);
    expect(result).toEqual([]);
  });
});

describe('stocktakeHistorySummary', () => {
  it('happy path — completed/cancelled/totalDiff/avgDuration hesaplanır', async () => {
    const db = makeMockDb([
      {
        completedCount: 3,
        cancelledCount: 1,
        totalDiffItems: 7,
        avgDurationMinutes: 18.5,
      },
    ]);
    const result = await stocktakeHistorySummary(COMPANY, db, 30);
    expect(result).toEqual({
      completedCount: 3,
      cancelledCount: 1,
      totalDiffItems: 7,
      avgDurationMinutes: 19, // round
    });
  });

  it('avgDurationMinutes null → null kalır', async () => {
    const db = makeMockDb([
      {
        completedCount: 0,
        cancelledCount: 2,
        totalDiffItems: 0,
        avgDurationMinutes: null,
      },
    ]);
    const result = await stocktakeHistorySummary(COMPANY, db, 30);
    expect(result.avgDurationMinutes).toBeNull();
  });

  it('empty DB → default zero / null', async () => {
    const db = makeMockDb([]);
    const result = await stocktakeHistorySummary(COMPANY, db, 30);
    expect(result).toEqual({
      completedCount: 0,
      cancelledCount: 0,
      totalDiffItems: 0,
      avgDurationMinutes: null,
    });
  });
});
