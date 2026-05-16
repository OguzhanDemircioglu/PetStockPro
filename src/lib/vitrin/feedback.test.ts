import { describe, it, expect, vi } from 'vitest';
import {
  feedbackInputSchema,
  submitFeedback,
  type SubmitFeedbackContext,
} from './feedback';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '00000000-0000-0000-0000-000000000001';
const NOW = new Date('2026-05-17T12:00:00Z');
const CTX: SubmitFeedbackContext = {
  ipAddress: '203.0.113.42',
  userAgent: 'Mozilla/5.0',
  countryCode: 'TR',
};

function makeMockDb(opts: {
  existing?: { id: string; status: string } | null;
  inserted?: { id: string };
  shouldThrow?: boolean;
}) {
  const calls = {
    selected: 0,
    inserted: 0,
    insertedValues: null as Record<string, unknown> | null,
    updated: 0,
    updateSet: null as Record<string, unknown> | null,
  };
  const select = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockImplementation(() => {
          calls.selected++;
          return Promise.resolve(opts.existing ? [opts.existing] : []);
        }),
      })),
    })),
  }));
  const insert = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((v) => {
      calls.inserted++;
      calls.insertedValues = v;
      if (opts.shouldThrow) {
        return Object.assign(Promise.reject(new Error('fail')), {
          returning: vi.fn().mockRejectedValue(new Error('fail')),
        });
      }
      return Object.assign(Promise.resolve(), {
        returning: vi
          .fn()
          .mockResolvedValue([opts.inserted ?? { id: 'new-feedback-id' }]),
      });
    }),
  }));
  const update = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation((v) => {
      calls.updated++;
      calls.updateSet = v;
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
  }));
  return { db: { select, insert, update } as unknown as DbClient, calls };
}

describe('feedbackInputSchema', () => {
  it('valid input', () => {
    const r = feedbackInputSchema.safeParse({
      companyId: COMPANY,
      status: 'submitted',
      rating: 'very_good',
    });
    expect(r.success).toBe(true);
  });

  it('companyId UUID değil → reject', () => {
    const r = feedbackInputSchema.safeParse({
      companyId: 'not-uuid',
      status: 'submitted',
      rating: 'good',
    });
    expect(r.success).toBe(false);
  });

  it('status enum dışı → reject', () => {
    const r = feedbackInputSchema.safeParse({
      companyId: COMPANY,
      status: 'foo',
    });
    expect(r.success).toBe(false);
  });

  it('rating boş ok (closed_manually + dismissed)', () => {
    const r = feedbackInputSchema.safeParse({
      companyId: COMPANY,
      status: 'closed_manually',
    });
    expect(r.success).toBe(true);
  });
});

describe('submitFeedback', () => {
  it('happy — submitted + rating → INSERT', async () => {
    const { db, calls } = makeMockDb({ existing: null });
    const result = await submitFeedback(
      { companyId: COMPANY, status: 'submitted', rating: 'very_good' },
      CTX,
      db,
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      id: 'new-feedback-id',
      created: true,
      upgraded: false,
    });
    expect(calls.inserted).toBe(1);
    expect(calls.insertedValues?.rating).toBe('very_good');
    expect(calls.insertedValues?.status).toBe('submitted');
    expect(calls.insertedValues?.reporterIpHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('closed_manually — rating null normalize', async () => {
    const { db, calls } = makeMockDb({ existing: null });
    await submitFeedback(
      { companyId: COMPANY, status: 'closed_manually', rating: 'very_good' },
      CTX,
      db,
      NOW,
    );
    expect(calls.insertedValues?.rating).toBeNull();
  });

  it('submitted + rating yok → inconsistent reject', async () => {
    const { db } = makeMockDb({});
    const result = await submitFeedback(
      { companyId: COMPANY, status: 'submitted' },
      CTX,
      db,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('inconsistent');
  });

  it('aynı IP 24h içinde tekrar submit → rate_limit', async () => {
    const { db } = makeMockDb({
      existing: { id: 'old-feedback', status: 'submitted' },
    });
    const result = await submitFeedback(
      { companyId: COMPANY, status: 'submitted', rating: 'good' },
      CTX,
      db,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('rate_limit_24h');
  });

  it('dismissed → closed_manually upgrade', async () => {
    const { db, calls } = makeMockDb({
      existing: { id: 'old-feedback', status: 'dismissed' },
    });
    const result = await submitFeedback(
      { companyId: COMPANY, status: 'closed_manually' },
      CTX,
      db,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.upgraded).toBe(true);
      expect(result.created).toBe(false);
    }
    expect(calls.updated).toBe(1);
    expect(calls.updateSet?.status).toBe('closed_manually');
  });

  it('dismissed → submitted upgrade', async () => {
    const { db, calls } = makeMockDb({
      existing: { id: 'old-feedback', status: 'dismissed' },
    });
    const result = await submitFeedback(
      { companyId: COMPANY, status: 'submitted', rating: 'bad' },
      CTX,
      db,
      NOW,
    );
    expect(result.ok).toBe(true);
    expect(calls.updateSet?.rating).toBe('bad');
  });

  it('closed_manually → dismissed downgrade → reject', async () => {
    const { db } = makeMockDb({
      existing: { id: 'old-feedback', status: 'closed_manually' },
    });
    const result = await submitFeedback(
      { companyId: COMPANY, status: 'dismissed' },
      CTX,
      db,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('rate_limit_24h');
  });

  it('DB hata → unknown', async () => {
    const { db } = makeMockDb({ existing: null, shouldThrow: true });
    const result = await submitFeedback(
      { companyId: COMPANY, status: 'submitted', rating: 'good' },
      CTX,
      db,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });

  it('aynı IP + gün → aynı hash (anti-spam doğrulama)', async () => {
    const { db, calls } = makeMockDb({ existing: null });
    await submitFeedback(
      { companyId: COMPANY, status: 'submitted', rating: 'very_good' },
      CTX,
      db,
      NOW,
    );
    const hash1 = calls.insertedValues?.reporterIpHash;
    const { db: db2, calls: calls2 } = makeMockDb({ existing: null });
    await submitFeedback(
      { companyId: COMPANY, status: 'submitted', rating: 'good' },
      CTX,
      db2,
      NOW,
    );
    expect(calls2.insertedValues?.reporterIpHash).toBe(hash1);
  });
});
