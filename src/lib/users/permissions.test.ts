import { describe, it, expect, vi } from 'vitest';
import {
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  setPermission,
  setBulkPermissions,
  applyStaffDefaults,
  clearAllPermissions,
} from './permissions';
import { PERMISSION_KEYS, ALL_PERMISSION_KEYS } from './permission-keys';
import type { DbClient } from '@/lib/db/client';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const GRANTER = '99999999-9999-9999-9999-999999999999';

/**
 * Mock builder — db.select() / db.insert() / db.delete() chain'lerini ardışık
 * çağrı sırasına göre fake'ler.
 *
 * fetchUserRole helper'ı her zaman ilk SELECT'i tüketir; sonraki SELECT'ler
 * permission tablosuna gider.
 */
function makeMock(opts: {
  role?: string | null;
  permissionRows?: Array<{ key?: string; enabled?: boolean }>;
  insertWillThrow?: boolean;
  deleteRows?: Array<{ id: string }>;
}) {
  const role = opts.role ?? 'STAFF';

  // SELECT chain — ilk çağrı role lookup, sonrakiler permission rows
  let selectCallCount = 0;
  const select = vi.fn(() => {
    selectCallCount += 1;
    const isFirstCall = selectCallCount === 1;
    const node: Record<string, unknown> = {
      from: vi.fn(() => node),
      where: vi.fn(() => node),
      limit: vi.fn(() => node),
      then: (cb: (rows: unknown[]) => unknown) => {
        if (isFirstCall) {
          // role lookup
          return Promise.resolve(role === null ? [] : [{ role }]).then(cb);
        }
        return Promise.resolve(opts.permissionRows ?? []).then(cb);
      },
    };
    return node;
  });

  const insert = vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => {
        if (opts.insertWillThrow) throw new Error('boom');
        return Promise.resolve();
      }),
      onConflictDoNothing: vi.fn(() => {
        if (opts.insertWillThrow) throw new Error('boom');
        return Promise.resolve();
      }),
    })),
  }));

  const del = vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve(opts.deleteRows ?? [])),
    })),
  }));

  return { select, insert, delete: del } as unknown as DbClient;
}

describe('getUserPermissions', () => {
  it('BAYI_SAHIBI → ALL_PERMISSION_KEYS (implicit bypass)', async () => {
    const db = makeMock({ role: 'BAYI_SAHIBI' });
    const result = await getUserPermissions(USER_ID, db);
    expect(result).toEqual(ALL_PERMISSION_KEYS);
  });

  it('SUPERADMIN → ALL_PERMISSION_KEYS', async () => {
    const db = makeMock({ role: 'SUPERADMIN' });
    const result = await getUserPermissions(USER_ID, db);
    expect(result).toEqual(ALL_PERMISSION_KEYS);
  });

  it('OBSERVER → boş dizi (mutation yok)', async () => {
    const db = makeMock({ role: 'OBSERVER' });
    const result = await getUserPermissions(USER_ID, db);
    expect(result).toEqual([]);
  });

  it('STAFF → user_permissions tablosundan enabled=true key listesi', async () => {
    const db = makeMock({
      role: 'STAFF',
      permissionRows: [
        { key: 'sale.create' },
        { key: 'variant.view' },
        { key: 'transfer.create' },
      ],
    });
    const result = await getUserPermissions(USER_ID, db);
    expect(result).toEqual(['sale.create', 'variant.view', 'transfer.create']);
  });

  it('User bulunamadı → boş dizi', async () => {
    const db = makeMock({ role: null });
    const result = await getUserPermissions(USER_ID, db);
    expect(result).toEqual([]);
  });

  it('STAFF — geçersiz key (eski schema kalıntısı) sessizce filtrelenir', async () => {
    const db = makeMock({
      role: 'STAFF',
      permissionRows: [
        { key: 'sale.create' },
        { key: 'deprecated.old_key' }, // whitelist'te yok → drop
      ],
    });
    const result = await getUserPermissions(USER_ID, db);
    expect(result).toEqual(['sale.create']);
  });
});

describe('hasPermission', () => {
  it('BAYI_SAHIBI tüm yetkiler → true (DB query yok)', async () => {
    const db = makeMock({ role: 'BAYI_SAHIBI' });
    const result = await hasPermission(USER_ID, PERMISSION_KEYS.STOCK_IN_CREATE, db);
    expect(result).toBe(true);
  });

  it('OBSERVER hiçbir yetki → false', async () => {
    const db = makeMock({ role: 'OBSERVER' });
    const result = await hasPermission(USER_ID, PERMISSION_KEYS.SALE_CREATE, db);
    expect(result).toBe(false);
  });

  it('STAFF + permission row enabled=true → true', async () => {
    const db = makeMock({
      role: 'STAFF',
      permissionRows: [{ enabled: true }],
    });
    const result = await hasPermission(USER_ID, PERMISSION_KEYS.SALE_CREATE, db);
    expect(result).toBe(true);
  });

  it('STAFF + permission row yok → false (default OFF)', async () => {
    const db = makeMock({ role: 'STAFF', permissionRows: [] });
    const result = await hasPermission(USER_ID, PERMISSION_KEYS.TRANSFER_CREATE, db);
    expect(result).toBe(false);
  });

  it('STAFF + permission row enabled=false → false', async () => {
    const db = makeMock({
      role: 'STAFF',
      permissionRows: [{ enabled: false }],
    });
    const result = await hasPermission(USER_ID, PERMISSION_KEYS.STOCK_OUT_WASTE, db);
    expect(result).toBe(false);
  });
});

describe('setPermission', () => {
  it('valid key + STAFF user → ok=true, upsert çağrıldı', async () => {
    const db = makeMock({ role: 'STAFF' });
    const result = await setPermission(
      USER_ID,
      PERMISSION_KEYS.STOCK_IN_CREATE,
      true,
      GRANTER,
      db,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.permissionKey).toBe('stock_in.create');
      expect(result.enabled).toBe(true);
    }
    expect(db.insert).toHaveBeenCalled();
  });

  it('insert throw → ok=false reason=unknown', async () => {
    const db = makeMock({ role: 'STAFF', insertWillThrow: true });
    const result = await setPermission(
      USER_ID,
      PERMISSION_KEYS.SALE_CREATE,
      false,
      GRANTER,
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unknown');
    }
  });
});

describe('setBulkPermissions', () => {
  it('5 valid key + 1 invalid → 5 upsert, invalidKeys raporlanır', async () => {
    const db = makeMock({ role: 'STAFF' });
    const result = await setBulkPermissions(
      USER_ID,
      {
        'sale.create': true,
        'stock_in.create': true,
        'stock_out.waste': false,
        'transfer.create': true,
        'vitrin.manage': true,
        'unknown.action': true, // invalid
      },
      GRANTER,
      db,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updatedCount).toBe(5);
      expect(result.invalidKeys).toEqual(['unknown.action']);
    }
  });

  it('Tüm key geçersiz → updatedCount=0, insert atılmaz', async () => {
    const db = makeMock({ role: 'STAFF' });
    const result = await setBulkPermissions(
      USER_ID,
      { 'bad.key': true, 'another.bad': false },
      GRANTER,
      db,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updatedCount).toBe(0);
      expect(result.invalidKeys).toHaveLength(2);
    }
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('applyStaffDefaults', () => {
  it('3 default ON kayıt insert eder (onConflictDoNothing)', async () => {
    const db = makeMock({ role: 'STAFF' });
    const result = await applyStaffDefaults(USER_ID, GRANTER, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.inserted).toBe(3);
    }
    expect(db.insert).toHaveBeenCalled();
  });

  it('insert hata → ok=false reason=unknown', async () => {
    const db = makeMock({ role: 'STAFF', insertWillThrow: true });
    const result = await applyStaffDefaults(USER_ID, GRANTER, db);
    expect(result.ok).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('BAYI_SAHIBI → her zaman true', async () => {
    const db = makeMock({ role: 'BAYI_SAHIBI' });
    const result = await hasAnyPermission(
      USER_ID,
      [PERMISSION_KEYS.STOCK_OUT_WASTE, PERMISSION_KEYS.STOCK_OUT_GIFT],
      db,
    );
    expect(result).toBe(true);
  });

  it('OBSERVER → false', async () => {
    const db = makeMock({ role: 'OBSERVER' });
    const result = await hasAnyPermission(USER_ID, [PERMISSION_KEYS.SALE_CREATE], db);
    expect(result).toBe(false);
  });

  it('STAFF + en az 1 match → true', async () => {
    const db = makeMock({
      role: 'STAFF',
      permissionRows: [{ key: 'sale.create' }],
    });
    const result = await hasAnyPermission(
      USER_ID,
      [PERMISSION_KEYS.SALE_CREATE, PERMISSION_KEYS.STOCK_OUT_WASTE],
      db,
    );
    expect(result).toBe(true);
  });

  it('Empty keys → false (defensive)', async () => {
    const db = makeMock({ role: 'STAFF' });
    const result = await hasAnyPermission(USER_ID, [], db);
    expect(result).toBe(false);
  });
});

describe('clearAllPermissions', () => {
  it('cascade silinen satırları döner', async () => {
    const db = makeMock({
      role: 'STAFF',
      deleteRows: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    });
    const result = await clearAllPermissions(USER_ID, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deletedCount).toBe(3);
    }
  });
});
