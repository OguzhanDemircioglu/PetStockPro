import { describe, it, expect, vi } from 'vitest';
import { getTransferSuggestionsBulk } from './transfer-suggestions';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const V1 = '22222222-2222-2222-2222-222222222222';
const V2 = '33333333-3333-3333-3333-333333333333';

function makeMockDb(rows: unknown[]) {
  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      innerJoin: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockResolvedValue(rows),
      then: (cb: (r: unknown[]) => unknown) => Promise.resolve(rows).then(cb),
    };
    return chain;
  });
  return { select } as unknown as DbClient;
}

describe('getTransferSuggestionsBulk', () => {
  it('boş variantIds → boş Map', async () => {
    const db = makeMockDb([]);
    const r = await getTransferSuggestionsBulk(COMPANY, [], db);
    expect(r.size).toBe(0);
  });

  it('dolu source + düşük target → öneri çıkar', async () => {
    const db = makeMockDb([
      { variantId: V1, branchId: 'b1', branchName: 'Merkez', stockQty: 50, threshold: 5, branchThresholds: null },
      { variantId: V1, branchId: 'b2', branchName: 'Şube 2', stockQty: 2, threshold: 5, branchThresholds: null },
    ]);
    const r = await getTransferSuggestionsBulk(COMPANY, [V1], db);
    expect(r.size).toBe(1);
    const v1 = r.get(V1)!;
    expect(v1).toHaveLength(1);
    expect(v1[0].sourceBranchId).toBe('b1');
    expect(v1[0].sourceStock).toBe(50);
    expect(v1[0].targetBranchId).toBe('b2');
    expect(v1[0].targetStock).toBe(2);
    // suggestedQty: min(transferable=50-10=40, targetIdeal=10-2=8) = 8
    expect(v1[0].suggestedQty).toBe(8);
  });

  it('source threshold altı → öneri çıkmaz (hepsi düşük)', async () => {
    const db = makeMockDb([
      { variantId: V1, branchId: 'b1', branchName: 'M', stockQty: 3, threshold: 5, branchThresholds: null },
      { variantId: V1, branchId: 'b2', branchName: 'S', stockQty: 2, threshold: 5, branchThresholds: null },
    ]);
    const r = await getTransferSuggestionsBulk(COMPANY, [V1], db);
    expect(r.size).toBe(0);
  });

  it('birden fazla düşük şube → her biri için öneri', async () => {
    const db = makeMockDb([
      { variantId: V1, branchId: 'b1', branchName: 'Merkez', stockQty: 100, threshold: 5, branchThresholds: null },
      { variantId: V1, branchId: 'b2', branchName: 'Şube 2', stockQty: 0, threshold: 5, branchThresholds: null },
      { variantId: V1, branchId: 'b3', branchName: 'Şube 3', stockQty: 1, threshold: 5, branchThresholds: null },
    ]);
    const r = await getTransferSuggestionsBulk(COMPANY, [V1], db);
    const v1 = r.get(V1)!;
    expect(v1).toHaveLength(2); // b2 + b3 hedef
    expect(v1.every((s) => s.sourceBranchId === 'b1')).toBe(true);
  });

  it('birden fazla variant — paralel öneri', async () => {
    const db = makeMockDb([
      { variantId: V1, branchId: 'b1', branchName: 'M', stockQty: 50, threshold: 5, branchThresholds: null },
      { variantId: V1, branchId: 'b2', branchName: 'S', stockQty: 0, threshold: 5, branchThresholds: null },
      { variantId: V2, branchId: 'b1', branchName: 'M', stockQty: 30, threshold: 3, branchThresholds: null },
      { variantId: V2, branchId: 'b2', branchName: 'S', stockQty: 2, threshold: 3, branchThresholds: null },
    ]);
    const r = await getTransferSuggestionsBulk(COMPANY, [V1, V2], db);
    expect(r.size).toBe(2);
    expect(r.get(V1)).toHaveLength(1);
    expect(r.get(V2)).toHaveLength(1);
  });

  it('branchThresholds[branchId] varsa özel threshold kullanılır', async () => {
    const db = makeMockDb([
      {
        variantId: V1,
        branchId: 'b1',
        branchName: 'Premium',
        stockQty: 100,
        threshold: 5,
        branchThresholds: { b2: 20 },
      },
      {
        variantId: V1,
        branchId: 'b2',
        branchName: 'Normal',
        stockQty: 15, // genel threshold 5 üstü ama özel 20 altı
        threshold: 5,
        branchThresholds: { b2: 20 },
      },
    ]);
    const r = await getTransferSuggestionsBulk(COMPANY, [V1], db);
    const v1 = r.get(V1);
    expect(v1).toBeDefined();
    expect(v1![0].targetBranchId).toBe('b2');
  });
});
