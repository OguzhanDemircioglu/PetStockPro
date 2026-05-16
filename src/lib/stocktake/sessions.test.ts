import { describe, it, expect, vi } from 'vitest';
import {
  startStocktake,
  updateStocktakeItemCount,
  completeStocktake,
  cancelStocktake,
  startStocktakeSchema,
  updateItemCountSchema,
} from './sessions';
import type { DbClient } from '@/lib/db/client';

vi.mock('@/lib/stock/movements', () => ({
  recordStocktakeAdjustment: vi.fn().mockResolvedValue({
    ok: true,
    movementId: 'mov-uuid',
    delta: -1,
    afterQty: 9,
  }),
}));

const COMPANY = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const BRANCH = '33333333-3333-3333-3333-333333333333';
const STOCKTAKE = '44444444-4444-4444-4444-444444444444';
const ITEM = '55555555-5555-5555-5555-555555555555';
const NOW = new Date('2026-05-16T10:00:00Z');

/**
 * Mock helper — orchestrator pattern: select/insert/update chain.
 * Her .select() çağrısında queue'daki sonraki dizi döner.
 */
function makeMockDb(opts: {
  selectQueue?: unknown[][];
  insertReturning?: { id: string }[];
  transactionResult?: unknown;
  transactionShouldThrow?: boolean;
}) {
  let selectIdx = 0;
  const calls = {
    insertedTo: [] as { tableHint: string; values: unknown }[],
    updates: [] as { values: Record<string, unknown> }[],
    selectCount: 0,
    transactionCalls: 0,
  };

  const select = vi.fn().mockImplementation(() => {
    const queue = opts.selectQueue ?? [];
    const data = queue[selectIdx++] ?? [];
    calls.selectCount++;
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      innerJoin: vi.fn().mockImplementation(() => chain),
      leftJoin: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      orderBy: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(data),
      then: (cb: (rows: unknown[]) => unknown) => Promise.resolve(data).then(cb),
    };
    return chain;
  });

  const txInsert = vi.fn().mockImplementation((table: unknown) => ({
    values: vi.fn().mockImplementation((vals: unknown) => {
      calls.insertedTo.push({ tableHint: String(table), values: vals });
      const promise = Promise.resolve();
      return Object.assign(promise, {
        returning: vi.fn().mockResolvedValue(opts.insertReturning ?? [{ id: STOCKTAKE }]),
      });
    }),
  }));

  const txUpdate = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      calls.updates.push({ values: vals });
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
  }));

  const transaction = vi.fn().mockImplementation(async (fn) => {
    calls.transactionCalls++;
    if (opts.transactionShouldThrow) throw new Error('tx fail');
    const tx = { insert: txInsert, update: txUpdate };
    return await fn(tx as unknown as DbClient);
  });

  return {
    db: {
      select,
      insert: txInsert, // outer insert paths gerek olursa
      update: txUpdate,
      transaction,
    } as unknown as DbClient,
    calls,
  };
}

// ══════════════════════════════════════════════════════════════
// Schema tests
// ══════════════════════════════════════════════════════════════

describe('startStocktakeSchema', () => {
  it('valid full mode → parse OK', () => {
    const r = startStocktakeSchema.safeParse({ branchId: BRANCH, mode: 'full' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mode).toBe('full');
  });

  it('mode default = full', () => {
    const r = startStocktakeSchema.safeParse({ branchId: BRANCH });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mode).toBe('full');
  });

  it('non-uuid branchId reject', () => {
    const r = startStocktakeSchema.safeParse({ branchId: 'not-uuid' });
    expect(r.success).toBe(false);
  });

  it('note 500 char limit', () => {
    const long = 'a'.repeat(501);
    const r = startStocktakeSchema.safeParse({ branchId: BRANCH, note: long });
    expect(r.success).toBe(false);
  });
});

describe('updateItemCountSchema', () => {
  it('countedQty 0+ kabul', () => {
    expect(updateItemCountSchema.safeParse({ countedQty: 0 }).success).toBe(true);
    expect(updateItemCountSchema.safeParse({ countedQty: 100 }).success).toBe(true);
  });

  it('negatif countedQty reject', () => {
    expect(updateItemCountSchema.safeParse({ countedQty: -1 }).success).toBe(false);
  });

  it('reason enum: 7 değer kabul', () => {
    const reasons = ['loss', 'overage', 'wrong_entry', 'expired', 'damage', 'theft', 'other'] as const;
    for (const r of reasons) {
      expect(updateItemCountSchema.safeParse({ countedQty: 5, reason: r }).success).toBe(true);
    }
  });

  it('geçersiz reason reject', () => {
    expect(updateItemCountSchema.safeParse({ countedQty: 5, reason: 'invalid' }).success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// startStocktake
// ══════════════════════════════════════════════════════════════

describe('startStocktake', () => {
  it('invalid input → invalid_input + issues', async () => {
    const { db } = makeMockDb({});
    const result = await startStocktake(COMPANY, USER, { branchId: 'not-uuid' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'invalid_input') {
      expect(result.issues.length).toBeGreaterThan(0);
    } else {
      throw new Error(`expected invalid_input, got ${result.ok ? 'ok' : result.reason}`);
    }
  });

  it('branch bulunamadı → branch_not_found', async () => {
    const { db } = makeMockDb({
      selectQueue: [[]], // branch lookup empty
    });
    const result = await startStocktake(COMPANY, USER, { branchId: BRANCH }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('branch_not_found');
  });

  it('aktif variant yok → no_variants', async () => {
    const { db } = makeMockDb({
      selectQueue: [
        [{ id: BRANCH }], // branch OK
        [], // variants empty
      ],
    });
    const result = await startStocktake(COMPANY, USER, { branchId: BRANCH }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_variants');
  });

  it('happy path → transaction çağrılır + totalItems döner', async () => {
    const variantRows = [
      { variantId: 'v1', systemQty: 25 },
      { variantId: 'v2', systemQty: 10 },
      { variantId: 'v3', systemQty: 0 },
    ];
    const { db, calls } = makeMockDb({
      selectQueue: [
        [{ id: BRANCH }],
        variantRows,
      ],
    });
    const result = await startStocktake(
      COMPANY,
      USER,
      { branchId: BRANCH, mode: 'full', note: 'Aylık' },
      db,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.totalItems).toBe(3);
      expect(result.stocktakeId).toBe(STOCKTAKE);
    }
    expect(calls.transactionCalls).toBe(1);
    // Items insert: 3 satır
    const itemsInsert = calls.insertedTo.find(
      (i) => Array.isArray(i.values) && (i.values as unknown[]).length === 3,
    );
    expect(itemsInsert).toBeDefined();
  });

  it('transaction throw → unknown', async () => {
    const { db } = makeMockDb({
      selectQueue: [
        [{ id: BRANCH }],
        [{ variantId: 'v1', systemQty: 5 }],
      ],
      transactionShouldThrow: true,
    });
    const result = await startStocktake(COMPANY, USER, { branchId: BRANCH }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });
});

// ══════════════════════════════════════════════════════════════
// updateStocktakeItemCount
// ══════════════════════════════════════════════════════════════

describe('updateStocktakeItemCount', () => {
  it('invalid input → invalid_input', async () => {
    const { db } = makeMockDb({});
    const result = await updateStocktakeItemCount(
      COMPANY,
      STOCKTAKE,
      ITEM,
      { countedQty: -5 },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_input');
  });

  it('item bulunamadı → not_found', async () => {
    const { db } = makeMockDb({
      selectQueue: [[]],
    });
    const result = await updateStocktakeItemCount(
      COMPANY,
      STOCKTAKE,
      ITEM,
      { countedQty: 5 },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('session completed → session_closed', async () => {
    const { db } = makeMockDb({
      selectQueue: [
        [{ itemId: ITEM, systemQty: 10, previousCountedQty: null, status: 'completed' }],
      ],
    });
    const result = await updateStocktakeItemCount(
      COMPANY,
      STOCKTAKE,
      ITEM,
      { countedQty: 10 },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('session_closed');
  });

  it('happy path → diff hesaplanır + counter güncellenir', async () => {
    const { db, calls } = makeMockDb({
      selectQueue: [
        [{ itemId: ITEM, systemQty: 10, previousCountedQty: null, status: 'in_progress' }],
        [{ countedItems: 1, diffItems: 1 }], // after-update lookup
      ],
    });
    const result = await updateStocktakeItemCount(
      COMPANY,
      STOCKTAKE,
      ITEM,
      { countedQty: 8, reason: 'loss' },
      db,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diff).toBe(-2);
      expect(result.countedItems).toBe(1);
      expect(result.diffItems).toBe(1);
    }
    // stocktake_items update + stocktakes counter update
    expect(calls.updates.length).toBeGreaterThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════════════
// completeStocktake
// ══════════════════════════════════════════════════════════════

describe('completeStocktake', () => {
  it('not found → not_found', async () => {
    const { db } = makeMockDb({
      selectQueue: [[]],
    });
    const result = await completeStocktake(COMPANY, USER, STOCKTAKE, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('session already closed → session_closed', async () => {
    const { db } = makeMockDb({
      selectQueue: [
        [{ id: STOCKTAKE, branchId: BRANCH, status: 'completed', totalItems: 10, countedItems: 10 }],
      ],
    });
    const result = await completeStocktake(COMPANY, USER, STOCKTAKE, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('session_closed');
  });

  it('hâlâ sayılmamış variant → has_uncounted + count', async () => {
    const { db } = makeMockDb({
      selectQueue: [
        [{ id: STOCKTAKE, branchId: BRANCH, status: 'in_progress', totalItems: 10, countedItems: 7 }],
      ],
    });
    const result = await completeStocktake(COMPANY, USER, STOCKTAKE, db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('has_uncounted');
      expect((result as { reason: 'has_uncounted'; uncountedCount: number }).uncountedCount).toBe(3);
    }
  });

  it('happy path → diff!=0 items için recordStocktakeAdjustment çağrılır + status=completed', async () => {
    const { db, calls } = makeMockDb({
      selectQueue: [
        [{ id: STOCKTAKE, branchId: BRANCH, status: 'in_progress', totalItems: 3, countedItems: 3 }],
        [
          { variantId: 'v1', countedQty: 9, diff: -1, reason: 'loss', customReason: null },
          { variantId: 'v2', countedQty: 26, diff: 1, reason: 'overage', customReason: null },
        ],
      ],
    });
    const result = await completeStocktake(COMPANY, USER, STOCKTAKE, db, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.itemsAdjusted).toBe(2);
      expect(result.movementsCreated).toBe(2);
    }
    // status=completed update
    const completedUpdate = calls.updates.find((u) => u.values.status === 'completed');
    expect(completedUpdate).toBeDefined();
    expect(completedUpdate?.values.closedAt).toEqual(NOW);
  });
});

// ══════════════════════════════════════════════════════════════
// cancelStocktake
// ══════════════════════════════════════════════════════════════

describe('cancelStocktake', () => {
  it('not found → not_found', async () => {
    const { db } = makeMockDb({ selectQueue: [[]] });
    const result = await cancelStocktake(COMPANY, STOCKTAKE, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('zaten completed → already_closed', async () => {
    const { db } = makeMockDb({ selectQueue: [[{ status: 'completed' }]] });
    const result = await cancelStocktake(COMPANY, STOCKTAKE, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_closed');
  });

  it('zaten cancelled → already_closed', async () => {
    const { db } = makeMockDb({ selectQueue: [[{ status: 'cancelled' }]] });
    const result = await cancelStocktake(COMPANY, STOCKTAKE, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_closed');
  });

  it('happy path → cancelled + closedAt set', async () => {
    const { db, calls } = makeMockDb({ selectQueue: [[{ status: 'in_progress' }]] });
    const result = await cancelStocktake(COMPANY, STOCKTAKE, db, NOW);
    expect(result.ok).toBe(true);
    const cancelUpdate = calls.updates.find((u) => u.values.status === 'cancelled');
    expect(cancelUpdate?.values.closedAt).toEqual(NOW);
  });
});
