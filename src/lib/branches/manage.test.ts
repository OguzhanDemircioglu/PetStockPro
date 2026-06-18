import { describe, it, expect, vi } from 'vitest';
import {
  addBranch,
  updateBranch,
  setBranchActive,
  removeBranchManager,
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
  // 2026-05-22 Karar A revize — addBranch artık plan + branch count check yapar.
  // Test mock'larında companies (plan + override) + branch count chain'i eklendi.
  const COMPANY_PRO_NO_OVERRIDE = {
    plan: 'PRO',
    temporaryVitrinLimitOverride: null,
    temporaryVitrinLimitOverrideUntil: null,
    temporaryBranchLimitOverride: null,
    temporaryBranchLimitOverrideUntil: null,
  };
  const COMPANY_FREE_NO_OVERRIDE = {
    plan: 'FREE',
    temporaryVitrinLimitOverride: null,
    temporaryVitrinLimitOverrideUntil: null,
    temporaryBranchLimitOverride: null,
    temporaryBranchLimitOverrideUntil: null,
  };

  it('happy path — il + ilçe FK doğru, insert (PRO ∞ şube)', async () => {
    const select = makeSelectChain([
      [COMPANY_PRO_NO_OVERRIDE], // plan
      [{ count: 5 }], // activeBranchCount (PRO ∞)
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

  it('FREE plan 1/1 şube dolu → branch_limit_exceeded reject', async () => {
    const select = makeSelectChain([
      [COMPANY_FREE_NO_OVERRIDE], // plan FREE
      [{ count: 1 }], // activeBranchCount = limit
    ]);
    const insert = vi.fn();
    const db = { select, insert } as unknown as DbClient;

    const result = await addBranch(
      COMPANY,
      { name: 'İkinci Şube', cityId: 34, districtId: DISTRICT },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'branch_limit_exceeded') {
      expect(result.limit).toBe(1);
      expect(result.count).toBe(1);
    } else {
      expect.fail('Expected branch_limit_exceeded reason');
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it('il bulunamaz → city_not_found', async () => {
    const select = makeSelectChain([
      [COMPANY_PRO_NO_OVERRIDE], // plan
      [{ count: 0 }], // activeBranchCount
      [], // city not found
    ]);
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
      [COMPANY_PRO_NO_OVERRIDE], // plan
      [{ count: 0 }], // activeBranchCount
      [{ id: 34 }], // city
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
    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;

    const result = await setBranchActive(COMPANY, BRANCH, false, db);
    expect(result).toEqual({ ok: true, isActive: false });
    // Faz 5A — is_active generated; tek kaynak status'a yazılır (is_active DEĞİL).
    expect(setFn).toHaveBeenCalledWith({ status: 'inactive' });
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
    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;

    const result = await setBranchActive(COMPANY, BRANCH, true, db);
    expect(result).toEqual({ ok: true, isActive: true });
    // Faz 5A — pasif→aktif status='active' yazar (is_active generated).
    expect(setFn).toHaveBeenCalledWith({ status: 'active' });
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await setBranchActive(COMPANY, BRANCH, false, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});

// ─────────────────────────────────────────────────────────────────
// removeBranchManager
// ─────────────────────────────────────────────────────────────────

describe('removeBranchManager', () => {
  const MANAGER_ID = '99999999-9999-9999-9999-999999999999';

  it('happy path — müdür branchId=null güncellenir', async () => {
    const select = makeSelectChain([
      [{ id: BRANCH }], // branch ownership
      [{ id: MANAGER_ID, email: 'mudur@petshop.test' }],
    ]);
    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;

    const result = await removeBranchManager(COMPANY, BRANCH, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe(MANAGER_ID);
      expect(result.email).toBe('mudur@petshop.test');
    }
    expect(update).toHaveBeenCalledTimes(1);
    // set çağrısı branchId=null içeriyor mu?
    expect(setFn).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: null }),
    );
  });

  it('branch tenant\'a ait değil → branch_not_found', async () => {
    const select = makeSelectChain([[]]); // branch ownership fail
    const db = { select } as unknown as DbClient;

    const result = await removeBranchManager(COMPANY, BRANCH, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('branch_not_found');
  });

  it('şubede atanmış müdür yok → no_manager_assigned', async () => {
    const select = makeSelectChain([
      [{ id: BRANCH }], // branch ownership OK
      [], // manager yok
    ]);
    const db = { select } as unknown as DbClient;

    const result = await removeBranchManager(COMPANY, BRANCH, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_manager_assigned');
  });

  it('update throw → unknown', async () => {
    const select = makeSelectChain([
      [{ id: BRANCH }],
      [{ id: MANAGER_ID, email: 'mudur@petshop.test' }],
    ]);
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('db down')),
      }),
    });
    const db = { select, update } as unknown as DbClient;

    const result = await removeBranchManager(COMPANY, BRANCH, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });
});
