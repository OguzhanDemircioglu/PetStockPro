import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/audit/log', () => ({ writeAuditLog: vi.fn(), writeAuditLogAsync: vi.fn() }));
vi.mock('@/lib/auth/password', () => ({ verifyPassword: vi.fn() }));

import { deleteOwnAccount, hasActivePaidSubscription } from './delete-account';
import { verifyPassword } from '@/lib/auth/password';
import { companies, subscriptions, users } from '@/db/schema';

const NOW = new Date('2026-06-30T10:00:00.000Z');

interface MockData {
  user?: { id: string; role: string; companyId: string | null; passwordHash: string | null } | null;
  company?: { id: string; deletedAt: Date | null } | null;
  subs?: Array<{ id: string }>;
}

function makeDb(data: MockData) {
  const calls = {
    txRan: false,
    subUpdates: [] as Record<string, unknown>[],
    companyUpdates: [] as Record<string, unknown>[],
  };
  function rowsFor(table: unknown): unknown[] {
    if (table === users) return data.user ? [data.user] : [];
    if (table === companies) return data.company ? [data.company] : [];
    if (table === subscriptions) return data.subs ?? [];
    return [];
  }
  function selectBuilder() {
    let table: unknown = null;
    const b: Record<string, unknown> = {
      from(t: unknown) {
        table = t;
        return b;
      },
      where() {
        return b;
      },
      limit() {
        return Promise.resolve(rowsFor(table));
      },
      // No-limit select (tx içi subscriptions) için thenable.
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
        return Promise.resolve(rowsFor(table)).then(resolve, reject);
      },
    };
    return b;
  }
  function updateBuilder(sink: Record<string, unknown>[]) {
    return {
      set(vals: Record<string, unknown>) {
        return {
          where() {
            sink.push(vals);
            return Promise.resolve();
          },
        };
      },
    };
  }
  const txClient = {
    select: () => selectBuilder(),
    update(table: unknown) {
      return updateBuilder(table === subscriptions ? calls.subUpdates : calls.companyUpdates);
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: () => selectBuilder(),
    transaction(fn: (tx: unknown) => unknown) {
      calls.txRan = true;
      return fn(txClient);
    },
  };
  return { db, calls };
}

const OWNER = { id: 'u-1', role: 'BAYI_SAHIBI', companyId: 'comp-1', passwordHash: 'hash' };

describe('deleteOwnAccount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kullanıcı yok → not_found', async () => {
    const { db, calls } = makeDb({ user: null });
    const res = await deleteOwnAccount({ userId: 'u-x', password: 'p' }, db, NOW);
    expect(res).toEqual({ ok: false, reason: 'not_found' });
    expect(calls.txRan).toBe(false);
  });

  it('STAFF → not_owner (şifre bile sorulmaz)', async () => {
    const { db } = makeDb({ user: { id: 'u-2', role: 'STAFF', companyId: 'comp-1', passwordHash: 'hash' } });
    const res = await deleteOwnAccount({ userId: 'u-2', password: 'p' }, db, NOW);
    expect(res).toEqual({ ok: false, reason: 'not_owner' });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('SUPERADMIN (companyId NULL) → not_owner', async () => {
    const { db } = makeDb({ user: { id: 'sa', role: 'SUPERADMIN', companyId: null, passwordHash: 'hash' } });
    const res = await deleteOwnAccount({ userId: 'sa', password: 'p' }, db, NOW);
    expect(res).toEqual({ ok: false, reason: 'not_owner' });
  });

  it('şifre yanlış → wrong_password, transaction çalışmaz', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const { db, calls } = makeDb({ user: OWNER, company: { id: 'comp-1', deletedAt: null } });
    const res = await deleteOwnAccount({ userId: 'u-1', password: 'wrong' }, db, NOW);
    expect(res).toEqual({ ok: false, reason: 'wrong_password' });
    expect(calls.txRan).toBe(false);
  });

  it('zaten silinmiş → already_deleted', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const { db, calls } = makeDb({ user: OWNER, company: { id: 'comp-1', deletedAt: new Date('2026-06-01') } });
    const res = await deleteOwnAccount({ userId: 'u-1', password: 'p' }, db, NOW);
    expect(res).toEqual({ ok: false, reason: 'already_deleted' });
    expect(calls.txRan).toBe(false);
  });

  it('happy (aktif abonelik) → abonelik expired + company soft-delete + plan FREE', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const { db, calls } = makeDb({
      user: OWNER,
      company: { id: 'comp-1', deletedAt: null },
      subs: [{ id: 'sub-1' }],
    });
    const res = await deleteOwnAccount({ userId: 'u-1', password: 'p' }, db, NOW);
    expect(res).toEqual({ ok: true, companyId: 'comp-1' });
    expect(calls.txRan).toBe(true);
    // Abonelik anında sonlandı (çekim imkânsız)
    expect(calls.subUpdates).toHaveLength(1);
    expect(calls.subUpdates[0].status).toBe('expired');
    expect(calls.subUpdates[0].cancelAtPeriodEnd).toBe(true);
    expect(calls.subUpdates[0].pendingMerchantOid).toBeNull();
    // Company soft-delete + plan FREE
    expect(calls.companyUpdates).toHaveLength(1);
    expect(calls.companyUpdates[0].deletedAt).toEqual(NOW);
    expect(calls.companyUpdates[0].plan).toBe('FREE');
  });

  it('happy (abonelik yok) → company soft-delete, abonelik update yok', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const { db, calls } = makeDb({
      user: OWNER,
      company: { id: 'comp-1', deletedAt: null },
      subs: [],
    });
    const res = await deleteOwnAccount({ userId: 'u-1', password: 'p' }, db, NOW);
    expect(res.ok).toBe(true);
    expect(calls.subUpdates).toHaveLength(0);
    expect(calls.companyUpdates[0].deletedAt).toEqual(NOW);
  });
});

describe('hasActivePaidSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('canlı abonelik var → true', async () => {
    const { db } = makeDb({ subs: [{ id: 'sub-1' }] });
    expect(await hasActivePaidSubscription('comp-1', db)).toBe(true);
  });

  it('abonelik yok → false', async () => {
    const { db } = makeDb({ subs: [] });
    expect(await hasActivePaidSubscription('comp-1', db)).toBe(false);
  });
});
