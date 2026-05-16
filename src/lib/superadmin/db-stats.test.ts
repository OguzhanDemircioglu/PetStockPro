import { describe, it, expect, vi } from 'vitest';
import { getDatabaseStats } from './db-stats';
import type { DbClient } from '@/lib/db/client';

function makeMockDb(summary: unknown[], topTables: unknown[]) {
  let idx = 0;
  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      orderBy: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(topTables),
      then: (cb: (rows: unknown[]) => unknown) => {
        idx++;
        return Promise.resolve(idx === 1 ? summary : topTables).then(cb);
      },
    };
    return chain;
  });
  return { select } as unknown as DbClient;
}

describe('getDatabaseStats', () => {
  it('disk size + plan limit + usage% + top tables döner', async () => {
    const db = makeMockDb(
      [{ totalSizeBytes: 20_991_123, totalSizePretty: '20 MB', connectionCount: 5 }],
      [
        { name: 'districts', bytes: 180_224, sizePretty: '176 kB' },
        { name: 'stock_movements', bytes: 131_072, sizePretty: '128 kB' },
      ],
    );
    const r = await getDatabaseStats(db);
    expect(r.totalSizeBytes).toBe(20_991_123);
    expect(r.totalSizePretty).toBe('20 MB');
    expect(r.planLimitMb).toBe(500);
    // 20 MB / 500 MB ≈ %4
    expect(r.usagePct).toBeGreaterThan(3);
    expect(r.usagePct).toBeLessThan(5);
    expect(r.connectionCount).toBe(5);
    expect(r.topTables).toHaveLength(2);
    expect(r.topTables[0].name).toBe('districts');
  });

  it('empty schema → topTables empty + usagePct 0', async () => {
    const db = makeMockDb(
      [{ totalSizeBytes: 0, totalSizePretty: '0 bytes', connectionCount: 1 }],
      [],
    );
    const r = await getDatabaseStats(db);
    expect(r.totalSizeBytes).toBe(0);
    expect(r.usagePct).toBe(0);
    expect(r.topTables).toEqual([]);
  });
});
