import { describe, it, expect, vi } from 'vitest';
import { listBranchAssignedUsers } from './detail';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '00000000-0000-0000-0000-00000000c001';
const BRANCH = '11111111-1111-1111-1111-111111111111';
const MANAGER = '22222222-2222-2222-2222-222222222222';
const STAFF_1 = '33333333-3333-3333-3333-333333333333';
const STAFF_2 = '44444444-4444-4444-4444-444444444444';

function makeSelectChain(rows: unknown[]) {
  return vi.fn().mockImplementation(() => {
    const node = {
      from: vi.fn(() => node),
      where: vi.fn(() => node),
      orderBy: vi.fn(() => node),
      then: (cb: (data: unknown[]) => unknown) => Promise.resolve(rows).then(cb),
    };
    return node;
  });
}

describe('listBranchAssignedUsers', () => {
  it('boş şube → manager null + staff []', async () => {
    const select = makeSelectChain([]);
    const db = { select } as unknown as DbClient;

    const result = await listBranchAssignedUsers(COMPANY, BRANCH, db);
    expect(result.manager).toBeNull();
    expect(result.staff).toEqual([]);
  });

  it('müdür + 2 staff → manager set + staff 2', async () => {
    const select = makeSelectChain([
      {
        id: MANAGER,
        email: 'mudur@petshop.test',
        name: 'Ahmet Müdür',
        role: 'SUBE_MUDURU',
        emailVerifiedAt: new Date('2026-05-19T10:00:00Z'),
        createdAt: new Date('2026-05-18T10:00:00Z'),
      },
      {
        id: STAFF_1,
        email: 'ali@petshop.test',
        name: 'Ali Kasiyer',
        role: 'STAFF',
        emailVerifiedAt: new Date('2026-05-19T11:00:00Z'),
        createdAt: new Date('2026-05-19T09:00:00Z'),
      },
      {
        id: STAFF_2,
        email: 'veli@petshop.test',
        name: null,
        role: 'STAFF',
        emailVerifiedAt: null,
        createdAt: new Date('2026-05-20T08:00:00Z'),
      },
    ]);
    const db = { select } as unknown as DbClient;

    const result = await listBranchAssignedUsers(COMPANY, BRANCH, db);
    expect(result.manager?.id).toBe(MANAGER);
    expect(result.manager?.email).toBe('mudur@petshop.test');
    expect(result.staff.length).toBe(2);
    expect(result.staff.map((s) => s.id)).toEqual([STAFF_1, STAFF_2]);
  });

  it('sadece staff (müdür atanmamış) → manager null', async () => {
    const select = makeSelectChain([
      {
        id: STAFF_1,
        email: 'ali@petshop.test',
        name: 'Ali',
        role: 'STAFF',
        emailVerifiedAt: null,
        createdAt: new Date('2026-05-19T09:00:00Z'),
      },
    ]);
    const db = { select } as unknown as DbClient;

    const result = await listBranchAssignedUsers(COMPANY, BRANCH, db);
    expect(result.manager).toBeNull();
    expect(result.staff.length).toBe(1);
    expect(result.staff[0].id).toBe(STAFF_1);
  });
});
