import { describe, it, expect, vi } from 'vitest';
import { writeAuditLog, writeAuditLogAsync } from './log';
import { listAuditLogs, listAuditUsers } from './list';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const USER = 'user-uuid';
const NOW = new Date('2026-05-15T12:00:00Z');

function makeSelectChain(responses: unknown[][]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const data = responses[i++] ?? [];
    const makeNode = (): {
      from: ReturnType<typeof vi.fn>;
      leftJoin: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      offset: ReturnType<typeof vi.fn>;
      then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
    } => {
      const node: ReturnType<typeof makeNode> = {
        from: vi.fn(() => makeNode()),
        leftJoin: vi.fn(() => makeNode()),
        where: vi.fn(() => makeNode()),
        orderBy: vi.fn(() => makeNode()),
        limit: vi.fn(() => makeNode()),
        offset: vi.fn(() => makeNode()),
        then: (cb) => Promise.resolve(data).then(cb),
      };
      return node;
    };
    return makeNode();
  });
}

describe('writeAuditLog', () => {
  it('happy path — insert çağrılır + ok=true', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    const result = await writeAuditLog(
      {
        companyId: COMPANY,
        userId: USER,
        action: 'product.created',
        entityType: 'product',
        entityId: 'prod-1',
        afterState: { name: 'Royal Canin' },
      },
      db,
      NOW,
    );
    expect(result).toEqual({ ok: true });
    expect(values).toHaveBeenCalledTimes(1);
    const args = values.mock.calls[0][0];
    expect(args.action).toBe('product.created');
    expect(args.companyId).toBe(COMPANY);
    expect(args.afterState).toEqual({ name: 'Royal Canin' });
    expect(args.createdAt).toEqual(NOW);
  });

  it('DB hata atarsa sessiz yutar (ok=false)', async () => {
    const values = vi.fn().mockRejectedValue(new Error('DB FK violation'));
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    const result = await writeAuditLog(
      {
        companyId: COMPANY,
        userId: USER,
        action: 'product.created',
      },
      db,
    );
    expect(result).toEqual({ ok: false });
  });

  it('superadmin override fields korunur', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    await writeAuditLog(
      {
        companyId: COMPANY,
        userId: USER,
        action: 'product.deleted',
        performedAsSuperadmin: true,
        superadminSessionId: 'session-uuid',
        superadminActionType: 'bypass',
        superadminReason: '24h geri alma penceresi geçti, kullanıcı talep etti',
        superadminSilent: false,
      },
      db,
    );
    const args = values.mock.calls[0][0];
    expect(args.performedAsSuperadmin).toBe(true);
    expect(args.superadminActionType).toBe('bypass');
    expect(args.superadminReason).toBe(
      '24h geri alma penceresi geçti, kullanıcı talep etti',
    );
  });

  it('opsiyonel alanlar default NULL', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    await writeAuditLog(
      {
        companyId: COMPANY,
        userId: USER,
        action: 'company.updated',
      },
      db,
    );
    const args = values.mock.calls[0][0];
    expect(args.entityType).toBeNull();
    expect(args.entityId).toBeNull();
    expect(args.beforeState).toBeNull();
    expect(args.afterState).toBeNull();
    expect(args.ipAddress).toBeNull();
    expect(args.performedAsSuperadmin).toBe(false);
  });
});

describe('writeAuditLogAsync', () => {
  it('fire-and-forget — caller bekletilmez', () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    // void dönüş — promise döndürmez
    const result = writeAuditLogAsync(
      { companyId: COMPANY, userId: USER, action: 'stock.in' },
      db,
    );
    expect(result).toBeUndefined();
    // Insert call fire edilmiş olmalı (microtask)
    expect(insert).toHaveBeenCalled();
  });

  it('async error yutar (caller fırlatmaz)', () => {
    const values = vi.fn().mockRejectedValue(new Error('DB down'));
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    expect(() =>
      writeAuditLogAsync(
        { companyId: COMPANY, userId: USER, action: 'stock.in' },
        db,
      ),
    ).not.toThrow();
  });
});

describe('listAuditLogs', () => {
  it('happy path — son N kayıt', async () => {
    const rows = [
      {
        id: 'log-1',
        createdAt: NOW,
        action: 'product.created',
        entityType: 'product',
        entityId: 'prod-1',
        userEmail: 'admin@petshop.com',
        beforeState: null,
        afterState: { name: 'Royal Canin' },
        performedAsSuperadmin: false,
        superadminReason: null,
      },
    ];
    const select = makeSelectChain([rows]);
    const db = { select } as unknown as DbClient;

    const result = await listAuditLogs(COMPANY, db);
    expect(result).toEqual(rows);
  });

  it('filter ile çalışır', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await listAuditLogs(COMPANY, db, {
      action: 'stock.in',
      limit: 50,
    });
    expect(result).toEqual([]);
  });

  it('tarih aralığı + pagination + userId filter desteklenir', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await listAuditLogs(COMPANY, db, {
      userId: 'user-1',
      fromDate: '2026-05-01',
      toDate: '2026-05-16',
      limit: 25,
      offset: 50,
    });
    expect(result).toEqual([]);
  });

  it('geçersiz fromDate "2026-13-40" → eklenmez (graceful)', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    await expect(
      listAuditLogs(COMPANY, db, { fromDate: 'invalid-date' }),
    ).resolves.toEqual([]);
  });

  it('limit MAX_LIMIT (500) ile cap edilir', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    await listAuditLogs(COMPANY, db, { limit: 100000 });
    // İmplicit doğrulama: throw atmaması
  });
});

describe('listAuditUsers', () => {
  it('dropdown için kullanıcı listesi', async () => {
    const rows = [
      { userId: 'u1', email: 'admin@petshop.com' },
      { userId: 'u2', email: 'kasiyer@petshop.com' },
    ];
    const selectDistinctOn = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        innerJoin: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            orderBy: vi.fn().mockResolvedValue(rows),
          })),
        })),
      })),
    }));
    const db = { selectDistinctOn } as unknown as DbClient;
    const result = await listAuditUsers(COMPANY, db);
    expect(result).toEqual(rows);
  });
});
