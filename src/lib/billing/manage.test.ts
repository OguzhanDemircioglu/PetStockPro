import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/audit/log', () => ({ writeAuditLog: vi.fn(), writeAuditLogAsync: vi.fn() }));

import { cancelSubscription, reactivateSubscription } from './manage';
import { subscriptions, users } from '@/db/schema';

const NOW = new Date('2026-06-10T12:00:00.000Z');
const now = NOW;

function makeDb(config: { sub?: { id: string } | null }) {
  const calls = { updates: [] as Record<string, unknown>[] };
  function selectBuilder() {
    let fromTable: unknown = null;
    const b: Record<string, unknown> = {
      from(t: unknown) {
        fromTable = t;
        return b;
      },
      where() {
        return b;
      },
      orderBy() {
        return b;
      },
      limit() {
        if (fromTable === users) return Promise.resolve([{ id: 'owner-1' }]);
        if (fromTable === subscriptions) return Promise.resolve(config.sub ? [config.sub] : []);
        return Promise.resolve([]);
      },
    };
    return b;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: () => selectBuilder(),
    update() {
      return {
        set(vals: Record<string, unknown>) {
          return {
            where() {
              calls.updates.push(vals);
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
  return { db, calls };
}

describe('cancelSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('happy → cancelAtPeriodEnd=true + cancelledAt', async () => {
    const { db, calls } = makeDb({ sub: { id: 'sub-1' } });
    const res = await cancelSubscription('comp-1', db, { now });
    expect(res.ok).toBe(true);
    expect(calls.updates[0].cancelAtPeriodEnd).toBe(true);
    expect(calls.updates[0].cancelledAt).toEqual(NOW);
  });

  it('abonelik yok → not_found, update yok', async () => {
    const { db, calls } = makeDb({ sub: null });
    const res = await cancelSubscription('comp-1', db, { now });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
    expect(calls.updates).toHaveLength(0);
  });
});

describe('reactivateSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('happy → cancelAtPeriodEnd=false + cancelledAt null', async () => {
    const { db, calls } = makeDb({ sub: { id: 'sub-1' } });
    const res = await reactivateSubscription('comp-1', db, { now });
    expect(res.ok).toBe(true);
    expect(calls.updates[0].cancelAtPeriodEnd).toBe(false);
    expect(calls.updates[0].cancelledAt).toBeNull();
  });

  it('iptal edilmiş abonelik yok → not_found', async () => {
    const { db } = makeDb({ sub: null });
    const res = await reactivateSubscription('comp-1', db, { now });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });
});
