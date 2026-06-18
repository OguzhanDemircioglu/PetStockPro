import { describe, it, expect, vi } from 'vitest';
import type { DbClient } from '@/lib/db/client';
import {
  softDeleteCompany,
  restoreCompany,
  isPurgeEligible,
  COMPANY_SOFT_DELETE_GRACE_MS,
} from './company-lifecycle';

const COMPANY = '00000000-0000-0000-0000-0000000000c1';
const ACTOR = '00000000-0000-0000-0000-0000000000a1';

function makeDb(selectRows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(selectRows);
  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit }),
    }),
  });
  const setFn = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  const update = vi.fn().mockReturnValue({ set: setFn });
  const valuesFn = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values: valuesFn });
  const db = { select, update, insert } as unknown as DbClient;
  return { db, setFn, valuesFn, update };
}

describe('softDeleteCompany', () => {
  it('happy — deletedAt set + audit yazılır', async () => {
    const now = new Date('2026-06-18T10:00:00Z');
    const { db, setFn, valuesFn } = makeDb([{ id: COMPANY, deletedAt: null }]);

    const res = await softDeleteCompany(COMPANY, ACTOR, db, now);

    expect(res).toEqual({ ok: true, companyId: COMPANY });
    expect(setFn).toHaveBeenCalledWith({ deletedAt: now, updatedAt: now });
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'company.soft_deleted', companyId: COMPANY }),
    );
  });

  it('not_found — şirket yok', async () => {
    const { db } = makeDb([]);
    const res = await softDeleteCompany(COMPANY, ACTOR, db);
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });

  it('already_deleted — deletedAt zaten set', async () => {
    const { db, setFn } = makeDb([{ id: COMPANY, deletedAt: new Date('2026-06-01T00:00:00Z') }]);
    const res = await softDeleteCompany(COMPANY, ACTOR, db);
    expect(res).toEqual({ ok: false, reason: 'already_deleted' });
    expect(setFn).not.toHaveBeenCalled();
  });
});

describe('restoreCompany', () => {
  it('happy — deletedAt NULL\'a çekilir + audit', async () => {
    const now = new Date('2026-06-18T12:00:00Z');
    const { db, setFn, valuesFn } = makeDb([
      { id: COMPANY, deletedAt: new Date('2026-06-10T00:00:00Z') },
    ]);

    const res = await restoreCompany(COMPANY, ACTOR, db, now);

    expect(res).toEqual({ ok: true, companyId: COMPANY });
    expect(setFn).toHaveBeenCalledWith({ deletedAt: null, updatedAt: now });
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'company.restored', companyId: COMPANY }),
    );
  });

  it('not_found', async () => {
    const { db } = makeDb([]);
    const res = await restoreCompany(COMPANY, ACTOR, db);
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });

  it('not_deleted — zaten aktif', async () => {
    const { db, setFn } = makeDb([{ id: COMPANY, deletedAt: null }]);
    const res = await restoreCompany(COMPANY, ACTOR, db);
    expect(res).toEqual({ ok: false, reason: 'not_deleted' });
    expect(setFn).not.toHaveBeenCalled();
  });
});

describe('isPurgeEligible', () => {
  it('deletedAt null → false', () => {
    expect(isPurgeEligible(null)).toBe(false);
  });

  it('grace içinde (3 gün) → false', () => {
    const now = new Date('2026-06-18T00:00:00Z');
    const deletedAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(isPurgeEligible(deletedAt, now)).toBe(false);
  });

  it('grace doldu (8 gün) → true', () => {
    const now = new Date('2026-06-18T00:00:00Z');
    const deletedAt = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    expect(isPurgeEligible(deletedAt, now)).toBe(true);
  });

  it('tam sınır (7 gün) → true (>=)', () => {
    const now = new Date('2026-06-18T00:00:00Z');
    const deletedAt = new Date(now.getTime() - COMPANY_SOFT_DELETE_GRACE_MS);
    expect(isPurgeEligible(deletedAt, now)).toBe(true);
  });
});
