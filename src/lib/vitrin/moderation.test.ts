import { describe, it, expect, vi } from 'vitest';
import {
  flagFeedback,
  flagFeedbackSchema,
  unflagFeedback,
} from './moderation';
import type { DbClient } from '@/lib/db/client';

const FEEDBACK_ID = '00000000-0000-0000-0000-000000000001';
const SUPERADMIN_ID = '00000000-0000-0000-0000-000000000002';

function makeMockDb(opts: {
  existing?: { status: string; companyId?: string } | null;
  updateThrows?: boolean;
}) {
  const calls = {
    selected: 0,
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
  const update = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation((v) => {
      calls.updated++;
      calls.updateSet = v;
      return {
        where: vi.fn().mockImplementation(() =>
          opts.updateThrows
            ? Promise.reject(new Error('fail'))
            : Promise.resolve(undefined),
        ),
      };
    }),
  }));

  return {
    db: { select, update } as unknown as DbClient,
    calls,
  };
}

describe('flagFeedbackSchema', () => {
  it('valid input → success', () => {
    const r = flagFeedbackSchema.safeParse({
      feedbackId: FEEDBACK_ID,
      superadminUserId: SUPERADMIN_ID,
      reason: 'Spam içerik',
    });
    expect(r.success).toBe(true);
  });

  it('feedbackId UUID değil → reject', () => {
    const r = flagFeedbackSchema.safeParse({
      feedbackId: 'not-uuid',
      superadminUserId: SUPERADMIN_ID,
      reason: 'Spam',
    });
    expect(r.success).toBe(false);
  });

  it('reason çok kısa (<3) → reject', () => {
    const r = flagFeedbackSchema.safeParse({
      feedbackId: FEEDBACK_ID,
      superadminUserId: SUPERADMIN_ID,
      reason: 'no',
    });
    expect(r.success).toBe(false);
  });

  it('reason 500+ → reject', () => {
    const r = flagFeedbackSchema.safeParse({
      feedbackId: FEEDBACK_ID,
      superadminUserId: SUPERADMIN_ID,
      reason: 'x'.repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe('flagFeedback', () => {
  it('happy — submitted → flagged update', async () => {
    const COMPANY = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const { db, calls } = makeMockDb({
      existing: { status: 'submitted', companyId: COMPANY },
    });
    const result = await flagFeedback(
      {
        feedbackId: FEEDBACK_ID,
        superadminUserId: SUPERADMIN_ID,
        reason: 'Spam içerik',
      },
      db,
    );
    expect(result).toEqual({
      ok: true,
      feedbackId: FEEDBACK_ID,
      companyId: COMPANY,
    });
    expect(calls.updated).toBe(1);
    expect(calls.updateSet?.status).toBe('flagged');
    expect(calls.updateSet?.flaggedById).toBe(SUPERADMIN_ID);
    expect(calls.updateSet?.flagReason).toBe('Spam içerik');
  });

  it('not_found — feedback yoksa', async () => {
    const { db, calls } = makeMockDb({ existing: null });
    const result = await flagFeedback(
      {
        feedbackId: FEEDBACK_ID,
        superadminUserId: SUPERADMIN_ID,
        reason: 'Spam',
      },
      db,
    );
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(calls.updated).toBe(0);
  });

  it('already_flagged — zaten flagged ise UPDATE çalışmaz', async () => {
    const { db, calls } = makeMockDb({ existing: { status: 'flagged' } });
    const result = await flagFeedback(
      {
        feedbackId: FEEDBACK_ID,
        superadminUserId: SUPERADMIN_ID,
        reason: 'Spam',
      },
      db,
    );
    expect(result).toEqual({ ok: false, reason: 'already_flagged' });
    expect(calls.updated).toBe(0);
  });

  it('invalid_input — UUID hatası → erken reject (select bile yok)', async () => {
    const { db, calls } = makeMockDb({ existing: { status: 'submitted' } });
    const result = await flagFeedback(
      {
        feedbackId: 'not-uuid',
        superadminUserId: SUPERADMIN_ID,
        reason: 'Spam',
      },
      db,
    );
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(calls.selected).toBe(0);
    expect(calls.updated).toBe(0);
  });
});

describe('unflagFeedback', () => {
  it('happy — flagged → submitted restore', async () => {
    const COMPANY = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const { db, calls } = makeMockDb({
      existing: { status: 'flagged', companyId: COMPANY },
    });
    const result = await unflagFeedback(FEEDBACK_ID, db);
    expect(result).toEqual({
      ok: true,
      feedbackId: FEEDBACK_ID,
      companyId: COMPANY,
    });
    expect(calls.updated).toBe(1);
    expect(calls.updateSet?.status).toBe('submitted');
    expect(calls.updateSet?.flaggedById).toBeNull();
    expect(calls.updateSet?.flagReason).toBeNull();
  });

  it('restoreToStatus override → custom', async () => {
    const { db, calls } = makeMockDb({ existing: { status: 'flagged' } });
    await unflagFeedback(FEEDBACK_ID, db, { restoreToStatus: 'dismissed' });
    expect(calls.updateSet?.status).toBe('dismissed');
  });

  it('not_found — yoksa', async () => {
    const { db, calls } = makeMockDb({ existing: null });
    const result = await unflagFeedback(FEEDBACK_ID, db);
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(calls.updated).toBe(0);
  });

  it('not_flagged — zaten unflagged ise → reject', async () => {
    const { db, calls } = makeMockDb({ existing: { status: 'submitted' } });
    const result = await unflagFeedback(FEEDBACK_ID, db);
    expect(result).toEqual({ ok: false, reason: 'not_flagged' });
    expect(calls.updated).toBe(0);
  });
});
