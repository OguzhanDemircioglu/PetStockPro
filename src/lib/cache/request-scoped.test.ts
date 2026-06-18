import { describe, it, expect, vi } from 'vitest';

// withTenant (Faz 4B) tx + set_config kullanır: db.transaction(cb) → cb(tx),
// tx.execute (GUC) + tx.select (sorgu) aynı select mock'unu paylaşır.
vi.mock('@/lib/db/client', () => {
  const select = vi.fn();
  const execute = vi.fn(() => Promise.resolve());
  const tx = { select, execute };
  return {
    db: {
      select,
      execute,
      transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
    },
  };
});

const COMPANY = '00000000-0000-0000-0000-00000000c001';
const USER = '00000000-0000-0000-0000-00000000a001';

function chainReturning(rows: unknown[]) {
  const node = {
    from: vi.fn(() => node),
    innerJoin: vi.fn(() => node),
    where: vi.fn(() => node),
    limit: vi.fn(() => Promise.resolve(rows)),
    then: (cb: (data: unknown[]) => unknown) => Promise.resolve(rows).then(cb),
  };
  return node;
}

describe('getCompanyById', () => {
  it('row var → company shape döner', async () => {
    const { db } = await import('@/lib/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      chainReturning([
        {
          id: COMPANY,
          name: 'Mavi Pet Shop',
          plan: 'PRO',
          slug: 'mavi-pet',
          vatNo: '1234567890',
          storefrontStatus: 'approved',
        },
      ]),
    );

    // React.cache memoize ettiği için ilk çağrı DB hit, sonraki cache (test scope)
    const { getCompanyById: fresh } = await import('./request-scoped');
    const result = await fresh(COMPANY);
    expect(result).toEqual({
      id: COMPANY,
      name: 'Mavi Pet Shop',
      plan: 'PRO',
      slug: 'mavi-pet',
      vatNo: '1234567890',
      storefrontStatus: 'approved',
    });
  });

  it('row yok → null döner', async () => {
    const { db } = await import('@/lib/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      chainReturning([]),
    );

    const { getCompanyById: fresh } = await import('./request-scoped');
    const result = await fresh('00000000-0000-0000-0000-00000000ffff');
    expect(result).toBeNull();
  });
});

describe('getProductCountForCompany', () => {
  it('count > 0 → number döner', async () => {
    const { db } = await import('@/lib/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      chainReturning([{ count: 42 }]),
    );

    const { getProductCountForCompany: fresh } = await import('./request-scoped');
    expect(await fresh(COMPANY)).toBe(42);
  });

  it('row yok → 0 döner (null guard)', async () => {
    const { db } = await import('@/lib/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      chainReturning([]),
    );

    const { getProductCountForCompany: fresh } = await import('./request-scoped');
    expect(await fresh('00000000-0000-0000-0000-00000000aaaa')).toBe(0);
  });
});

describe('getLowStockCountForCompany', () => {
  it('count > 0 → number döner', async () => {
    const { db } = await import('@/lib/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      chainReturning([{ count: 5 }]),
    );

    const { getLowStockCountForCompany: fresh } = await import('./request-scoped');
    expect(await fresh(COMPANY)).toBe(5);
  });

  it('empty → 0', async () => {
    const { db } = await import('@/lib/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      chainReturning([]),
    );

    const { getLowStockCountForCompany: fresh } = await import('./request-scoped');
    expect(await fresh('00000000-0000-0000-0000-00000000bbbb')).toBe(0);
  });
});

describe('getUnreadNotificationCount', () => {
  it('userId + companyId ile count döner', async () => {
    const { db } = await import('@/lib/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      chainReturning([{ count: 3 }]),
    );

    const { getUnreadNotificationCount: fresh } = await import('./request-scoped');
    expect(await fresh(COMPANY, USER)).toBe(3);
  });

  it('empty result → 0', async () => {
    const { db } = await import('@/lib/db/client');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      chainReturning([]),
    );

    const { getUnreadNotificationCount: fresh } = await import('./request-scoped');
    expect(
      await fresh(
        '00000000-0000-0000-0000-00000000cccc',
        '00000000-0000-0000-0000-00000000dddd',
      ),
    ).toBe(0);
  });
});

