import { describe, it, expect, vi } from 'vitest';
import { overrideCompanyPlan, planOverrideSchema } from './plan-override';
import type { DbClient } from '@/lib/db/client';

const TARGET = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-05-16T10:00:00Z');

function makeMockDb(opts: {
  companyRow?: { id: string; name: string; plan: string } | null;
  updateShouldThrow?: boolean;
}) {
  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(opts.companyRow ? [opts.companyRow] : []),
    };
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

describe('planOverrideSchema', () => {
  it('valid input kabul', () => {
    expect(
      planOverrideSchema.safeParse({ targetCompanyId: TARGET, newPlan: 'PRO' }).success,
    ).toBe(true);
  });

  it('invalid UUID reject', () => {
    expect(
      planOverrideSchema.safeParse({ targetCompanyId: 'not-uuid', newPlan: 'PRO' }).success,
    ).toBe(false);
  });

  it('bilinmeyen plan reject', () => {
    const r = planOverrideSchema.safeParse({ targetCompanyId: TARGET, newPlan: 'PLATINUM' });
    expect(r.success).toBe(false);
  });

  it('FREE/PRO/PRO_PLUS tüm değerler kabul', () => {
    for (const p of ['FREE', 'PRO', 'PRO_PLUS']) {
      expect(planOverrideSchema.safeParse({ targetCompanyId: TARGET, newPlan: p }).success).toBe(
        true,
      );
    }
  });
});

describe('overrideCompanyPlan', () => {
  it('happy path — FREE → PRO', async () => {
    const db = makeMockDb({ companyRow: { id: TARGET, name: 'Mavi Pet', plan: 'FREE' } });
    const r = await overrideCompanyPlan({ targetCompanyId: TARGET, newPlan: 'PRO' }, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.beforePlan).toBe('FREE');
      expect(r.afterPlan).toBe('PRO');
      expect(r.targetCompanyName).toBe('Mavi Pet');
    }
  });

  it('not_found döner — şirket yoksa', async () => {
    const db = makeMockDb({ companyRow: null });
    const r = await overrideCompanyPlan({ targetCompanyId: TARGET, newPlan: 'PRO' }, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('same_plan idempotency reject', async () => {
    const db = makeMockDb({ companyRow: { id: TARGET, name: 'Mavi Pet', plan: 'PRO' } });
    const r = await overrideCompanyPlan({ targetCompanyId: TARGET, newPlan: 'PRO' }, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'same_plan') {
      expect(r.currentPlan).toBe('PRO');
    }
  });

  it('invalid_input Zod fail', async () => {
    const db = makeMockDb({ companyRow: { id: TARGET, name: 'Mavi Pet', plan: 'FREE' } });
    const r = await overrideCompanyPlan(
      { targetCompanyId: 'bad', newPlan: 'PRO' },
      db,
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_input');
  });

  it('unknown error — db update fail', async () => {
    const db = makeMockDb({
      companyRow: { id: TARGET, name: 'Mavi Pet', plan: 'FREE' },
      updateShouldThrow: true,
    });
    const r = await overrideCompanyPlan({ targetCompanyId: TARGET, newPlan: 'PRO' }, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown');
  });

  it('downgrade — PRO_PLUS → FREE', async () => {
    const db = makeMockDb({ companyRow: { id: TARGET, name: 'Zincir Pet', plan: 'PRO_PLUS' } });
    const r = await overrideCompanyPlan({ targetCompanyId: TARGET, newPlan: 'FREE' }, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.beforePlan).toBe('PRO_PLUS');
      expect(r.afterPlan).toBe('FREE');
    }
  });
});
