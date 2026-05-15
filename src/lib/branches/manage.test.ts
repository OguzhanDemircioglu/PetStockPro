import { describe, it, expect, vi } from 'vitest';
import {
  addBranch,
  updateBranch,
  setBranchActive,
  branchSchema,
} from './manage';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const BRANCH = '11111111-1111-1111-1111-111111111111';
const DISTRICT = '22222222-2222-2222-2222-222222222222';

function makeSelectChain(responses: unknown[][]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const data = responses[i++] ?? [];
    const makeNode = (): {
      from: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
    } => {
      const node: ReturnType<typeof makeNode> = {
        from: vi.fn(() => makeNode()),
        where: vi.fn(() => makeNode()),
        orderBy: vi.fn(() => makeNode()),
        limit: vi.fn(() => makeNode()),
        then: (cb) => Promise.resolve(data).then(cb),
      };
      return node;
    };
    return makeNode();
  });
}

// ─────────────────────────────────────────────────────────────────
// branchSchema
// ─────────────────────────────────────────────────────────────────

describe('branchSchema', () => {
  it('zorunlu alanlar', () => {
    const r = branchSchema.safeParse({
      name: 'Kadıköy',
      cityId: 34,
      districtId: DISTRICT,
    });
    expect(r.success).toBe(true);
  });

  it('isim < 2 reddedilir', () => {
    const r = branchSchema.safeParse({
      name: 'K',
      cityId: 34,
      districtId: DISTRICT,
    });
    expect(r.success).toBe(false);
  });

  it('cityId 82 reddedilir (TR 81 il)', () => {
    const r = branchSchema.safeParse({
      name: 'Test',
      cityId: 82,
      districtId: DISTRICT,
    });
    expect(r.success).toBe(false);
  });

  it('whatsappPhone format reddedilir', () => {
    const r = branchSchema.safeParse({
      name: 'Test',
      cityId: 34,
      districtId: DISTRICT,
      whatsappPhone: 'abc',
    });
    expect(r.success).toBe(false);
  });

  it('whatsappPhone boş string → null normalize', () => {
    const r = branchSchema.safeParse({
      name: 'Test',
      cityId: 34,
      districtId: DISTRICT,
      whatsappPhone: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.whatsappPhone).toBeNull();
  });

  it('whatsappPhone +90 prefix geçerli', () => {
    const r = branchSchema.safeParse({
      name: 'Test',
      cityId: 34,
      districtId: DISTRICT,
      whatsappPhone: '+905321234567',
    });
    expect(r.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// addBranch
// ─────────────────────────────────────────────────────────────────

describe('addBranch', () => {
  it('happy path — il + ilçe FK doğru, insert', async () => {
    const select = makeSelectChain([
      [{ id: 34 }], // city
      [{ id: DISTRICT }], // district
    ]);
    const returning = vi.fn().mockResolvedValue([{ id: 'new-branch' }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { select, insert } as unknown as DbClient;

    const result = await addBranch(
      COMPANY,
      {
        name: 'Kadıköy Şubesi',
        cityId: 34,
        districtId: DISTRICT,
      },
      db,
    );

    expect(result).toEqual({ ok: true, branchId: 'new-branch' });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('il bulunamaz → city_not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await addBranch(
      COMPANY,
      { name: 'Test', cityId: 34, districtId: DISTRICT },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('city_not_found');
  });

  it('ilçe il\'e ait değil → district_mismatch', async () => {
    const select = makeSelectChain([
      [{ id: 34 }],
      [], // district yok
    ]);
    const db = { select } as unknown as DbClient;

    const result = await addBranch(
      COMPANY,
      { name: 'Test', cityId: 34, districtId: DISTRICT },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('district_mismatch');
  });

  it('Zod fail → invalid_input', async () => {
    const db = { select: vi.fn() } as unknown as DbClient;
    const result = await addBranch(
      COMPANY,
      { name: 'X', cityId: 34, districtId: DISTRICT },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_input');
  });
});

// ─────────────────────────────────────────────────────────────────
// updateBranch
// ─────────────────────────────────────────────────────────────────

describe('updateBranch', () => {
  it('happy path', async () => {
    const select = makeSelectChain([
      [{ id: BRANCH }], // existing branch
      [{ id: 34 }], // city
      [{ id: DISTRICT }], // district
    ]);
    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;

    const result = await updateBranch(
      COMPANY,
      BRANCH,
      { name: 'Yeni İsim', cityId: 34, districtId: DISTRICT },
      db,
    );
    expect(result).toEqual({ ok: true });
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await updateBranch(
      COMPANY,
      BRANCH,
      { name: 'Test', cityId: 34, districtId: DISTRICT },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});

// ─────────────────────────────────────────────────────────────────
// setBranchActive
// ─────────────────────────────────────────────────────────────────

describe('setBranchActive', () => {
  it('aktif → pasif — birden fazla aktif var', async () => {
    const select = makeSelectChain([
      [{ id: BRANCH, isActive: true }],
      [{ c: 3 }], // 3 aktif var
    ]);
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const db = { select, update } as unknown as DbClient;

    const result = await setBranchActive(COMPANY, BRANCH, false, db);
    expect(result).toEqual({ ok: true, isActive: false });
  });

  it('aktif → pasif — son aktif şube → last_active_branch', async () => {
    const select = makeSelectChain([
      [{ id: BRANCH, isActive: true }],
      [{ c: 1 }],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await setBranchActive(COMPANY, BRANCH, false, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('last_active_branch');
  });

  it('pasif → aktif — last_active check yok', async () => {
    const select = makeSelectChain([
      [{ id: BRANCH, isActive: false }],
    ]);
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const db = { select, update } as unknown as DbClient;

    const result = await setBranchActive(COMPANY, BRANCH, true, db);
    expect(result).toEqual({ ok: true, isActive: true });
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await setBranchActive(COMPANY, BRANCH, false, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});
