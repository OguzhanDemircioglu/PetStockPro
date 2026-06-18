import { describe, it, expect, vi } from 'vitest';
import {
  setBranchStatus,
  assertBranchOperational,
  isBranchOperational,
  BranchNotOperationalError,
  BRANCH_STATUS_VALUES,
  BRANCH_STATUS_LABELS,
  type BranchStatus,
} from './status';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '00000000-0000-0000-0000-00000000c001';
const BRANCH = '11111111-1111-1111-1111-111111111111';

/**
 * Mock builder for setBranchStatus — ardışık SELECT'ler:
 *   1. existing branch lookup (status)
 *   2. (opsiyonel) operational count check
 */
function mockSetStatus(opts: {
  existingStatus?: BranchStatus | null;
  operationalCount?: number;
  updateWillThrow?: boolean;
}) {
  let selectCall = 0;
  const select = vi.fn(() => {
    selectCall += 1;
    const isFirst = selectCall === 1;
    const node: Record<string, unknown> = {
      from: vi.fn(() => node),
      where: vi.fn(() => node),
      limit: vi.fn(() => node),
      then: (cb: (rows: unknown[]) => unknown) => {
        if (isFirst) {
          return Promise.resolve(
            opts.existingStatus === null
              ? []
              : [{ id: BRANCH, status: opts.existingStatus ?? 'active' }],
          ).then(cb);
        }
        return Promise.resolve([{ c: opts.operationalCount ?? 5 }]).then(cb);
      },
    };
    return node;
  });

  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => {
        if (opts.updateWillThrow) throw new Error('boom');
        return Promise.resolve();
      }),
    })),
  }));

  return { select, update } as unknown as DbClient;
}

function mockAssert(status: BranchStatus | null) {
  const select = vi.fn(() => {
    const node: Record<string, unknown> = {
      from: vi.fn(() => node),
      where: vi.fn(() => node),
      limit: vi.fn(() => node),
      then: (cb: (rows: unknown[]) => unknown) =>
        Promise.resolve(status === null ? [] : [{ status }]).then(cb),
    };
    return node;
  });
  return { select } as unknown as DbClient;
}

describe('setBranchStatus', () => {
  it('active → holiday: serbest (last_operational check yok)', async () => {
    const db = mockSetStatus({ existingStatus: 'active', operationalCount: 1 });
    const result = await setBranchStatus(COMPANY, BRANCH, 'holiday', db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.previousStatus).toBe('active');
      expect(result.newStatus).toBe('holiday');
    }
  });

  it('active → inactive: tek operasyonel şube → last_operational_branch reject', async () => {
    const db = mockSetStatus({ existingStatus: 'active', operationalCount: 1 });
    const result = await setBranchStatus(COMPANY, BRANCH, 'inactive', db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('last_operational_branch');
    }
  });

  it('active → inactive: 3 operasyonel şube var → başarılı', async () => {
    const db = mockSetStatus({ existingStatus: 'active', operationalCount: 3 });
    const result = await setBranchStatus(COMPANY, BRANCH, 'inactive', db);
    expect(result.ok).toBe(true);
  });

  it('holiday → inactive: son operasyonel ise reject', async () => {
    const db = mockSetStatus({ existingStatus: 'holiday', operationalCount: 1 });
    const result = await setBranchStatus(COMPANY, BRANCH, 'inactive', db);
    expect(result.ok).toBe(false);
  });

  it('inactive → active: re-activate, last_operational check yok', async () => {
    const db = mockSetStatus({ existingStatus: 'inactive', operationalCount: 0 });
    const result = await setBranchStatus(COMPANY, BRANCH, 'active', db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.previousStatus).toBe('inactive');
    }
  });

  it('aynı status → no_change (idempotent)', async () => {
    const db = mockSetStatus({ existingStatus: 'holiday', operationalCount: 5 });
    const result = await setBranchStatus(COMPANY, BRANCH, 'holiday', db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no_change');
    }
  });

  it('not found → not_found', async () => {
    const db = mockSetStatus({ existingStatus: null });
    const result = await setBranchStatus(COMPANY, BRANCH, 'active', db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not_found');
    }
  });

  it('invalid status değeri → invalid_status', async () => {
    const db = mockSetStatus({ existingStatus: 'active', operationalCount: 5 });
    const result = await setBranchStatus(
      COMPANY,
      BRANCH,
      'archived' as unknown as BranchStatus,
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_status');
    }
  });
});

describe('assertBranchOperational', () => {
  it("default (holiday OK): 'active' → pass", async () => {
    const db = mockAssert('active');
    await expect(assertBranchOperational(COMPANY, BRANCH, db)).resolves.toBeUndefined();
  });

  it("default (holiday OK): 'holiday' → pass", async () => {
    const db = mockAssert('holiday');
    await expect(assertBranchOperational(COMPANY, BRANCH, db)).resolves.toBeUndefined();
  });

  it("default: 'inactive' → throw BranchNotOperationalError", async () => {
    const db = mockAssert('inactive');
    await expect(assertBranchOperational(COMPANY, BRANCH, db)).rejects.toBeInstanceOf(
      BranchNotOperationalError,
    );
  });

  it("requireActive=true: 'holiday' → throw (vitrin için tatilde de yasak)", async () => {
    const db = mockAssert('holiday');
    await expect(
      assertBranchOperational(COMPANY, BRANCH, db, { requireActive: true }),
    ).rejects.toBeInstanceOf(BranchNotOperationalError);
  });

  it('Şube bulunamadı → throw', async () => {
    const db = mockAssert(null);
    await expect(assertBranchOperational(COMPANY, BRANCH, db)).rejects.toBeInstanceOf(
      BranchNotOperationalError,
    );
  });

  it('isBranchOperational: throw yerine boolean döner', async () => {
    const dbInactive = mockAssert('inactive');
    expect(await isBranchOperational(COMPANY, BRANCH, dbInactive)).toBe(false);
    const dbActive = mockAssert('active');
    expect(await isBranchOperational(COMPANY, BRANCH, dbActive)).toBe(true);
  });
});

describe('Status sabitleri', () => {
  it('BRANCH_STATUS_VALUES = 3 değer', () => {
    expect(BRANCH_STATUS_VALUES).toEqual(['active', 'holiday', 'inactive']);
  });

  it('BRANCH_STATUS_LABELS Türkçe', () => {
    expect(BRANCH_STATUS_LABELS.active).toBe('Aktif');
    expect(BRANCH_STATUS_LABELS.holiday).toBe('Tatilde');
    expect(BRANCH_STATUS_LABELS.inactive).toBe('Pasif');
  });
});
