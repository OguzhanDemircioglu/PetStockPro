import { describe, it, expect, vi } from 'vitest';
import { rollbackStocktake, stocktakeRollbackSchema } from './stocktake-rollback';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const SUPERADMIN = '22222222-2222-2222-2222-222222222222';
const STOCKTAKE = '33333333-3333-3333-3333-333333333333';
const BRANCH = '44444444-4444-4444-4444-444444444444';
const NOW = new Date('2026-05-16T10:00:00Z');

// reverseStockMovement'i mock'la
vi.mock('@/lib/stock/movements', () => ({
  reverseStockMovement: vi.fn(async (_companyId, movementId) => {
    if (movementId === 'fail-mov') return { ok: false, reason: 'already_reversed' };
    return { ok: true, reversalMovementId: `rev-${movementId}` };
  }),
  REVERSAL_WINDOW_MS: 24 * 60 * 60 * 1000,
}));

function makeMockDb(opts: {
  stocktakeRow?: { id: string; status: string; branchId: string } | null;
  candidateMovements?: { id: string }[];
  updateShouldThrow?: boolean;
}) {
  // select calls chain
  const selectCalls: unknown[] = [];
  const select = vi.fn().mockImplementation(() => {
    selectCalls.push(1);
    const isFirst = selectCalls.length === 1;
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(isFirst && opts.stocktakeRow ? [opts.stocktakeRow] : []),
      // 2nd select doesn't call limit, uses await as promise
      then: undefined as never,
    };
    // 2nd select: no .limit() — execute directly
    if (!isFirst) {
      const arr = opts.candidateMovements ?? [];
      return {
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockResolvedValue(arr),
        })),
      };
    }
    return chain;
  });

  const update = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation(() => ({
      where: opts.updateShouldThrow
        ? vi.fn().mockRejectedValue(new Error('db fail'))
        : vi.fn().mockResolvedValue(undefined),
    })),
  }));

  return { select, update } as unknown as DbClient;
}

describe('stocktakeRollbackSchema', () => {
  it('valid input kabul', () => {
    expect(stocktakeRollbackSchema.safeParse({ stocktakeId: STOCKTAKE }).success).toBe(true);
  });
  it('invalid UUID reject', () => {
    expect(stocktakeRollbackSchema.safeParse({ stocktakeId: 'not-uuid' }).success).toBe(false);
  });
});

describe('rollbackStocktake', () => {
  it('happy path — 3 movements reverse', async () => {
    const db = makeMockDb({
      stocktakeRow: { id: STOCKTAKE, status: 'completed', branchId: BRANCH },
      candidateMovements: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
    });
    const r = await rollbackStocktake(COMPANY, SUPERADMIN, { stocktakeId: STOCKTAKE }, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.movementsReversed).toBe(3);
      expect(r.movementsTotal).toBe(3);
      expect(r.branchId).toBe(BRANCH);
    }
  });

  it('happy — 0 movements (diff hiç olmamış sayım)', async () => {
    const db = makeMockDb({
      stocktakeRow: { id: STOCKTAKE, status: 'completed', branchId: BRANCH },
      candidateMovements: [],
    });
    const r = await rollbackStocktake(COMPANY, SUPERADMIN, { stocktakeId: STOCKTAKE }, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.movementsReversed).toBe(0);
      expect(r.movementsTotal).toBe(0);
    }
  });

  it('partial reverse — 1 fail içerir', async () => {
    const db = makeMockDb({
      stocktakeRow: { id: STOCKTAKE, status: 'completed', branchId: BRANCH },
      candidateMovements: [{ id: 'm1' }, { id: 'fail-mov' }, { id: 'm3' }],
    });
    const r = await rollbackStocktake(COMPANY, SUPERADMIN, { stocktakeId: STOCKTAKE }, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.movementsReversed).toBe(2);
      expect(r.movementsTotal).toBe(3);
    }
  });

  it('not_found — başka tenant veya yok', async () => {
    const db = makeMockDb({ stocktakeRow: null });
    const r = await rollbackStocktake(COMPANY, SUPERADMIN, { stocktakeId: STOCKTAKE }, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('not_completed — in_progress sayım reddedilir', async () => {
    const db = makeMockDb({
      stocktakeRow: { id: STOCKTAKE, status: 'in_progress', branchId: BRANCH },
    });
    const r = await rollbackStocktake(COMPANY, SUPERADMIN, { stocktakeId: STOCKTAKE }, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'not_completed') {
      expect(r.currentStatus).toBe('in_progress');
    }
  });

  it('not_completed — cancelled sayım reddedilir', async () => {
    const db = makeMockDb({
      stocktakeRow: { id: STOCKTAKE, status: 'cancelled', branchId: BRANCH },
    });
    const r = await rollbackStocktake(COMPANY, SUPERADMIN, { stocktakeId: STOCKTAKE }, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'not_completed') {
      expect(r.currentStatus).toBe('cancelled');
    }
  });

  it('invalid_input Zod fail', async () => {
    const db = makeMockDb({});
    const r = await rollbackStocktake(COMPANY, SUPERADMIN, { stocktakeId: 'bad' }, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_input');
  });

  it('unknown error — update throw', async () => {
    const db = makeMockDb({
      stocktakeRow: { id: STOCKTAKE, status: 'completed', branchId: BRANCH },
      candidateMovements: [],
      updateShouldThrow: true,
    });
    const r = await rollbackStocktake(COMPANY, SUPERADMIN, { stocktakeId: STOCKTAKE }, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown');
  });
});
