import { describe, it, expect, vi } from 'vitest';
import {
  createNotification,
  createNotificationAsync,
  listForUser,
  unreadCountForUser,
  markAsRead,
  markAllAsRead,
} from './manage';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const NOTIF = '33333333-3333-3333-3333-333333333333';
const NOW = new Date('2026-05-16T12:00:00Z');

function makeMockDb(opts: {
  insertReturning?: { id: string }[];
  insertShouldThrow?: boolean;
  selectResponse?: unknown[];
  updateShouldThrow?: boolean;
}) {
  const calls = {
    insertedValues: null as Record<string, unknown> | null,
    updateValues: null as Record<string, unknown> | null,
  };

  const insert = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      calls.insertedValues = vals;
      if (opts.insertShouldThrow) {
        const promise = Promise.reject(new Error('DB down'));
        return Object.assign(promise, {
          returning: vi.fn().mockRejectedValue(new Error('DB down')),
        });
      }
      const promise = Promise.resolve();
      return Object.assign(promise, {
        returning: vi.fn().mockResolvedValue(opts.insertReturning ?? [{ id: NOTIF }]),
      });
    }),
  }));

  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      orderBy: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(opts.selectResponse ?? []),
      then: (cb: (rows: unknown[]) => unknown) =>
        Promise.resolve(opts.selectResponse ?? []).then(cb),
    };
    return chain;
  });

  const update = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      calls.updateValues = vals;
      return {
        where: vi
          .fn()
          .mockImplementation(() =>
            opts.updateShouldThrow ? Promise.reject(new Error('fail')) : Promise.resolve(),
          ),
      };
    }),
  }));

  return {
    db: { insert, select, update } as unknown as DbClient,
    calls,
  };
}

describe('createNotification', () => {
  it('happy path → ok=true + id döner', async () => {
    const { db, calls } = makeMockDb({ insertReturning: [{ id: 'notif-1' }] });
    const result = await createNotification(
      {
        companyId: COMPANY,
        userId: USER,
        type: 'stocktake_completed',
        content: { title: 'Sayım tamamlandı', emoji: '✅', link: '/admin/stocktake/x' },
      },
      db,
      NOW,
    );
    expect(result.ok).toBe(true);
    expect(result.id).toBe('notif-1');
    expect(calls.insertedValues).toMatchObject({
      companyId: COMPANY,
      userId: USER,
      type: 'stocktake_completed',
      channel: 'screen',
      createdAt: NOW,
    });
  });

  it('userId null → tenant-wide insert (NULL kalır)', async () => {
    const { db, calls } = makeMockDb({});
    await createNotification(
      {
        companyId: COMPANY,
        type: 'vitrin_auto_unpublished',
        content: { title: 'Vitrin kapatıldı', body: 'Stok 0 düştü' },
      },
      db,
      NOW,
    );
    expect(calls.insertedValues?.userId).toBeNull();
  });

  it('DB hata → ok=false (sessiz yutar)', async () => {
    const { db } = makeMockDb({ insertShouldThrow: true });
    const result = await createNotification(
      {
        companyId: COMPANY,
        type: 'high_sale',
        content: { title: 'Yüksek satış' },
      },
      db,
    );
    expect(result.ok).toBe(false);
    expect(result.id).toBeUndefined();
  });

  it('channel default = screen', async () => {
    const { db, calls } = makeMockDb({});
    await createNotification(
      { companyId: COMPANY, type: 'invoice_issued', content: { title: 'Fatura kesildi' } },
      db,
    );
    expect(calls.insertedValues?.channel).toBe('screen');
  });

  it('channel override (telegram)', async () => {
    const { db, calls } = makeMockDb({});
    await createNotification(
      {
        companyId: COMPANY,
        type: 'subscription_renewed',
        content: { title: 'Abonelik yenilendi' },
        channel: 'telegram',
      },
      db,
    );
    expect(calls.insertedValues?.channel).toBe('telegram');
  });
});

describe('createNotificationAsync', () => {
  it('void döner — caller bekletilmez', () => {
    const { db } = makeMockDb({});
    const result = createNotificationAsync(
      { companyId: COMPANY, type: 'daily_summary', content: { title: 'Özet' } },
      db,
    );
    expect(result).toBeUndefined();
  });

  it('async DB hata throw etmez', () => {
    const { db } = makeMockDb({ insertShouldThrow: true });
    expect(() =>
      createNotificationAsync(
        { companyId: COMPANY, type: 'daily_summary', content: { title: 'x' } },
        db,
      ),
    ).not.toThrow();
  });
});

describe('listForUser', () => {
  it('happy path — bildirim listesi döner', async () => {
    const rows = [
      {
        id: 'n1',
        type: 'stocktake_completed',
        channel: 'screen',
        content: { title: 'Sayım tamam', emoji: '✅' },
        readAt: null,
        createdAt: NOW,
      },
    ];
    const { db } = makeMockDb({ selectResponse: rows });
    const result = await listForUser(COMPANY, USER, db);
    expect(result).toEqual(rows);
  });

  it('boş array kabul', async () => {
    const { db } = makeMockDb({ selectResponse: [] });
    const result = await listForUser(COMPANY, USER, db);
    expect(result).toEqual([]);
  });
});

describe('unreadCountForUser', () => {
  it('count döner', async () => {
    const { db } = makeMockDb({ selectResponse: [{ count: 5 }] });
    const count = await unreadCountForUser(COMPANY, USER, db);
    expect(count).toBe(5);
  });

  it('empty response → 0', async () => {
    const { db } = makeMockDb({ selectResponse: [] });
    const count = await unreadCountForUser(COMPANY, USER, db);
    expect(count).toBe(0);
  });
});

describe('markAsRead', () => {
  it('happy path → readAt set + ok true', async () => {
    const { db, calls } = makeMockDb({});
    const result = await markAsRead(COMPANY, USER, NOTIF, db, NOW);
    expect(result.ok).toBe(true);
    expect(calls.updateValues).toEqual({ readAt: NOW });
  });

  it('update fail → ok false', async () => {
    const { db } = makeMockDb({ updateShouldThrow: true });
    const result = await markAsRead(COMPANY, USER, NOTIF, db);
    expect(result.ok).toBe(false);
  });
});

describe('markAllAsRead', () => {
  it('happy path → tüm okunmamışlar readAt=now', async () => {
    const { db, calls } = makeMockDb({});
    const result = await markAllAsRead(COMPANY, USER, db, NOW);
    expect(result.ok).toBe(true);
    expect(calls.updateValues).toEqual({ readAt: NOW });
  });
});
