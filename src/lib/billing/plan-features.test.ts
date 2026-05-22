import { describe, it, expect } from 'vitest';
import {
  getEffectiveVitrinLimit,
  getEffectiveBranchLimit,
  hasExcelImport,
  hasAdvancedReports,
  canPublishToVitrin,
  canAddBranch,
} from './plan-features';

function makeCompany(
  plan: string,
  overrides: {
    vitrinOverride?: number | null;
    vitrinUntil?: Date | null;
    branchOverride?: number | null;
    branchUntil?: Date | null;
  } = {},
) {
  return {
    plan,
    temporaryVitrinLimitOverride: overrides.vitrinOverride ?? null,
    temporaryVitrinLimitOverrideUntil: overrides.vitrinUntil ?? null,
    temporaryBranchLimitOverride: overrides.branchOverride ?? null,
    temporaryBranchLimitOverrideUntil: overrides.branchUntil ?? null,
  };
}

const NOW = new Date('2026-05-22T12:00:00Z');
const FUTURE = new Date('2026-05-29T12:00:00Z');
const PAST = new Date('2026-05-15T12:00:00Z');

describe('getEffectiveVitrinLimit', () => {
  it('FREE override yok → plan defaultu 10', () => {
    expect(getEffectiveVitrinLimit(makeCompany('FREE'), NOW)).toBe(10);
  });
  it('PRO override yok → plan defaultu 500', () => {
    expect(getEffectiveVitrinLimit(makeCompany('PRO'), NOW)).toBe(500);
  });
  it('PRO_PLUS override yok → Infinity', () => {
    expect(getEffectiveVitrinLimit(makeCompany('PRO_PLUS'), NOW)).toBe(Infinity);
  });
  it('FREE + kalıcı override 25 → 25', () => {
    expect(
      getEffectiveVitrinLimit(
        makeCompany('FREE', { vitrinOverride: 25, vitrinUntil: null }),
        NOW,
      ),
    ).toBe(25);
  });
  it('FREE + future TTL override 20 → 20', () => {
    expect(
      getEffectiveVitrinLimit(
        makeCompany('FREE', { vitrinOverride: 20, vitrinUntil: FUTURE }),
        NOW,
      ),
    ).toBe(20);
  });
  it('FREE + geçmiş TTL override → plan defaultu 10', () => {
    expect(
      getEffectiveVitrinLimit(
        makeCompany('FREE', { vitrinOverride: 20, vitrinUntil: PAST }),
        NOW,
      ),
    ).toBe(10);
  });
});

describe('getEffectiveBranchLimit', () => {
  it('FREE → 1', () => expect(getEffectiveBranchLimit(makeCompany('FREE'), NOW)).toBe(1));
  it('PRO → Infinity', () =>
    expect(getEffectiveBranchLimit(makeCompany('PRO'), NOW)).toBe(Infinity));
  it('FREE + override 3 (kalıcı) → 3', () => {
    expect(
      getEffectiveBranchLimit(
        makeCompany('FREE', { branchOverride: 3, branchUntil: null }),
        NOW,
      ),
    ).toBe(3);
  });
});

describe('hasExcelImport', () => {
  it('FREE = false', () => expect(hasExcelImport('FREE')).toBe(false));
  it('PRO = true', () => expect(hasExcelImport('PRO')).toBe(true));
  it('PRO_PLUS = true', () => expect(hasExcelImport('PRO_PLUS')).toBe(true));
});

describe('hasAdvancedReports', () => {
  it('FREE = false', () => expect(hasAdvancedReports('FREE')).toBe(false));
  it('PRO = true', () => expect(hasAdvancedReports('PRO')).toBe(true));
});

describe('canPublishToVitrin', () => {
  it('FREE 9/10 → ok', () => {
    expect(canPublishToVitrin(makeCompany('FREE'), 9, NOW)).toEqual({ ok: true });
  });
  it('FREE 10/10 → reject vitrin_limit_exceeded', () => {
    expect(canPublishToVitrin(makeCompany('FREE'), 10, NOW)).toEqual({
      ok: false,
      limit: 10,
      count: 10,
      reason: 'vitrin_limit_exceeded',
    });
  });
  it('FREE 0/10 → ok', () => {
    expect(canPublishToVitrin(makeCompany('FREE'), 0, NOW)).toEqual({ ok: true });
  });
  it('PRO_PLUS 9999/∞ → ok', () => {
    expect(canPublishToVitrin(makeCompany('PRO_PLUS'), 9999, NOW)).toEqual({ ok: true });
  });
  it('FREE 14/10 + override 20 (kalıcı) → ok', () => {
    expect(
      canPublishToVitrin(
        makeCompany('FREE', { vitrinOverride: 20, vitrinUntil: null }),
        14,
        NOW,
      ),
    ).toEqual({ ok: true });
  });
  it('FREE 25/10 + override 20 → reject (override aşıldı)', () => {
    expect(
      canPublishToVitrin(
        makeCompany('FREE', { vitrinOverride: 20, vitrinUntil: null }),
        25,
        NOW,
      ),
    ).toEqual({
      ok: false,
      limit: 20,
      count: 25,
      reason: 'vitrin_limit_exceeded',
    });
  });
});

describe('canAddBranch', () => {
  it('FREE 0/1 → ok', () => {
    expect(canAddBranch(makeCompany('FREE'), 0, NOW)).toEqual({ ok: true });
  });
  it('FREE 1/1 → reject branch_limit_exceeded', () => {
    expect(canAddBranch(makeCompany('FREE'), 1, NOW)).toEqual({
      ok: false,
      limit: 1,
      count: 1,
      reason: 'branch_limit_exceeded',
    });
  });
  it('PRO 999/∞ → ok', () => {
    expect(canAddBranch(makeCompany('PRO'), 999, NOW)).toEqual({ ok: true });
  });
});
