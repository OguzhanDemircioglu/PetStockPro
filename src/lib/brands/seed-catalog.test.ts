import { describe, it, expect, vi } from 'vitest';
import { seedCatalogBrandsForCompany } from './seed-catalog';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '00000000-0000-0000-0000-00000000c001';

function makeDb(opts: {
  candidates: Array<{ name: string }>;
  existing: Array<{ slug: string }>;
  onBulkInsert?: (values: unknown[]) => void;
  bulkInsertThrows?: boolean;
}) {
  const seen: { bulkCalls: number; singleCalls: number; insertedValues: unknown[][] } = {
    bulkCalls: 0,
    singleCalls: 0,
    insertedValues: [],
  };

  const selectDistinct = vi.fn().mockReturnValue({
    from: vi.fn().mockResolvedValue(opts.candidates),
  });

  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(opts.existing),
    }),
  });

  const insert = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((vals: unknown) => {
      const arr = Array.isArray(vals) ? vals : [vals];
      seen.insertedValues.push(arr);
      if (Array.isArray(vals)) {
        seen.bulkCalls++;
        opts.onBulkInsert?.(vals);
        if (opts.bulkInsertThrows) {
          return Promise.reject(new Error('bulk fail'));
        }
      } else {
        seen.singleCalls++;
      }
      return Promise.resolve();
    }),
  }));

  return {
    db: { select, selectDistinct, insert } as unknown as DbClient,
    seen,
  };
}

describe('seedCatalogBrandsForCompany', () => {
  it('hiç candidate yok → 0 insert, 0 skip', async () => {
    const { db } = makeDb({ candidates: [], existing: [] });
    const r = await seedCatalogBrandsForCompany(COMPANY, db);
    expect(r).toEqual({ inserted: 0, skipped: 0, totalCandidates: 0 });
  });

  it('3 candidate, hepsi yeni → 3 insert', async () => {
    const { db, seen } = makeDb({
      candidates: [{ name: 'Royal Canin' }, { name: 'Pro Plan' }, { name: 'Catit' }],
      existing: [],
    });
    const r = await seedCatalogBrandsForCompany(COMPANY, db);
    expect(r.inserted).toBe(3);
    expect(r.skipped).toBe(0);
    expect(r.totalCandidates).toBe(3);
    expect(seen.bulkCalls).toBe(1);
    expect(seen.insertedValues[0]).toHaveLength(3);
  });

  it('idempotent — 2 candidate, biri mevcut → 1 insert + 1 skip', async () => {
    const { db } = makeDb({
      candidates: [{ name: 'Royal Canin' }, { name: 'Catit' }],
      existing: [{ slug: 'catit' }],
    });
    const r = await seedCatalogBrandsForCompany(COMPANY, db);
    expect(r.inserted).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.totalCandidates).toBe(2);
  });

  it('slug deduplication — "ProLine" + "Proline" tek slug → 1 distinct', async () => {
    const { db } = makeDb({
      candidates: [{ name: 'ProLine' }, { name: 'Proline' }],
      existing: [],
    });
    const r = await seedCatalogBrandsForCompany(COMPANY, db);
    expect(r.totalCandidates).toBe(1);
    expect(r.inserted).toBe(1);
  });

  it('boş + space-only brand isimleri filter edilir', async () => {
    const { db } = makeDb({
      candidates: [
        { name: '' },
        { name: '   ' },
        { name: 'Royal Canin' },
      ],
      existing: [],
    });
    const r = await seedCatalogBrandsForCompany(COMPANY, db);
    expect(r.totalCandidates).toBe(1);
    expect(r.inserted).toBe(1);
  });

  it('tüm aday zaten varsa 0 insert döner', async () => {
    const { db } = makeDb({
      candidates: [{ name: 'Royal Canin' }, { name: 'Catit' }],
      existing: [{ slug: 'royal-canin' }, { slug: 'catit' }],
    });
    const r = await seedCatalogBrandsForCompany(COMPANY, db);
    expect(r.inserted).toBe(0);
    expect(r.skipped).toBe(2);
  });

  it('bulk insert race fail → per-row fallback', async () => {
    const { db, seen } = makeDb({
      candidates: [{ name: 'Royal Canin' }, { name: 'Catit' }],
      existing: [],
      bulkInsertThrows: true,
    });
    const r = await seedCatalogBrandsForCompany(COMPANY, db);
    expect(seen.bulkCalls).toBe(1);
    // Bulk başarısız olduğu için per-row 2 single insert (her ikisi başarılı varsayım)
    expect(seen.singleCalls).toBe(2);
    expect(r.inserted).toBe(2);
  });
});
