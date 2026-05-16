import { describe, it, expect, vi } from 'vitest';
import { hardDeleteProduct } from './hard-delete';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const PRODUCT = '22222222-2222-2222-2222-222222222222';

function makeMockDb(opts: {
  productRow?: { id: string; name: string; deletedAt: Date | null } | null;
  movementCount?: number;
  stocktakeItemCount?: number;
  deleteFails?: boolean;
}) {
  let selectIdx = 0;
  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      innerJoin: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockImplementation(() => {
        selectIdx++;
        if (selectIdx === 1) return Promise.resolve(opts.productRow ? [opts.productRow] : []);
        return Promise.resolve([]);
      }),
      then: (cb: (rows: unknown[]) => unknown) => {
        selectIdx++;
        // 2nd select = movement count, 3rd select = stocktakeItem count
        const data =
          selectIdx === 2
            ? [{ count: opts.movementCount ?? 0 }]
            : [{ count: opts.stocktakeItemCount ?? 0 }];
        return Promise.resolve(data).then(cb);
      },
    };
    return chain;
  });

  const del = vi.fn().mockImplementation(() => ({
    where: vi.fn().mockImplementation(() =>
      opts.deleteFails ? Promise.reject(new Error('FK violation')) : Promise.resolve(),
    ),
  }));

  return { db: { select, delete: del } as unknown as DbClient };
}

describe('hardDeleteProduct', () => {
  it('not_found — ürün yok veya başka tenant', async () => {
    const { db } = makeMockDb({ productRow: null });
    const r = await hardDeleteProduct(COMPANY, PRODUCT, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('not_soft_deleted — önce soft delete gerek', async () => {
    const { db } = makeMockDb({
      productRow: { id: PRODUCT, name: 'X', deletedAt: null },
    });
    const r = await hardDeleteProduct(COMPANY, PRODUCT, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_soft_deleted');
  });

  it('has_history — stocktake_items var → reject + count', async () => {
    const { db } = makeMockDb({
      productRow: { id: PRODUCT, name: 'X', deletedAt: new Date() },
      movementCount: 0,
      stocktakeItemCount: 3,
    });
    const r = await hardDeleteProduct(COMPANY, PRODUCT, db);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'has_history') {
      expect(r.historyCount).toBe(3);
    } else {
      throw new Error('expected has_history');
    }
  });

  it('has_movements — stock_movements var → reject + count', async () => {
    const { db } = makeMockDb({
      productRow: { id: PRODUCT, name: 'X', deletedAt: new Date() },
      movementCount: 12,
    });
    const r = await hardDeleteProduct(COMPANY, PRODUCT, db);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'has_movements') {
      expect(r.movementCount).toBe(12);
    } else {
      throw new Error('expected has_movements');
    }
  });

  it('happy path — soft-deleted + no movements → delete + name döner', async () => {
    const { db } = makeMockDb({
      productRow: { id: PRODUCT, name: 'Test Ürün', deletedAt: new Date() },
      movementCount: 0,
    });
    const r = await hardDeleteProduct(COMPANY, PRODUCT, db);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.deletedProductId).toBe(PRODUCT);
      expect(r.productName).toBe('Test Ürün');
    }
  });

  it('delete throw → unknown', async () => {
    const { db } = makeMockDb({
      productRow: { id: PRODUCT, name: 'X', deletedAt: new Date() },
      movementCount: 0,
      deleteFails: true,
    });
    const r = await hardDeleteProduct(COMPANY, PRODUCT, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown');
  });
});
