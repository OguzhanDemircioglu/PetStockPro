import { describe, it, expect, vi } from 'vitest';
import {
  addCategory,
  updateCategory,
  deleteCategory,
  categorySchema,
} from './manage';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const CAT = '11111111-1111-1111-1111-111111111111';

function makeSelectChain(responses: unknown[][]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const data = responses[i++] ?? [];
    const makeNode = (): {
      from: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
    } => {
      const node: ReturnType<typeof makeNode> = {
        from: vi.fn(() => makeNode()),
        where: vi.fn(() => makeNode()),
        orderBy: vi.fn(() => makeNode()),
        limit: vi.fn(() => makeNode()),
        then: (cb) => Promise.resolve(data).then(cb),
      };
      return node;
    };
    return makeNode();
  });
}

describe('categorySchema', () => {
  it('minimum — name', () => {
    const r = categorySchema.safeParse({ name: 'Kedi Maması' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.displayOrder).toBe(100);
      expect(r.data.sktRequired).toBe(false);
    }
  });

  it('emoji boş → null', () => {
    const r = categorySchema.safeParse({ name: 'X', emoji: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.emoji).toBeNull();
  });

  it('displayOrder>999 reddedilir', () => {
    const r = categorySchema.safeParse({ name: 'X', displayOrder: 1000 });
    expect(r.success).toBe(false);
  });
});

describe('addCategory', () => {
  it('happy path', async () => {
    const select = makeSelectChain([[]]);
    const returning = vi.fn().mockResolvedValue([{ id: 'new-cat' }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { select, insert } as unknown as DbClient;

    const result = await addCategory(
      COMPANY,
      { name: 'Kedi Maması', emoji: '🐱', sktRequired: true },
      db,
    );
    expect(result).toEqual({ ok: true, categoryId: 'new-cat' });
  });

  it('slug_taken', async () => {
    const select = makeSelectChain([[{ id: 'existing' }]]);
    const db = { select } as unknown as DbClient;
    const result = await addCategory(COMPANY, { name: 'Köpek Maması' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('slug_taken');
  });

  it('Zod fail', async () => {
    const db = { select: vi.fn() } as unknown as DbClient;
    const result = await addCategory(COMPANY, { name: '' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_input');
  });
});

describe('updateCategory', () => {
  it('happy', async () => {
    const select = makeSelectChain([
      [{ id: CAT }],
      [], // slug çakışma yok
    ]);
    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;

    const result = await updateCategory(
      COMPANY,
      CAT,
      { name: 'Premium Kedi' },
      db,
    );
    expect(result).toEqual({ ok: true });
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await updateCategory(COMPANY, CAT, { name: 'X' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});

describe('deleteCategory', () => {
  it('happy + affectedProductCount', async () => {
    const select = makeSelectChain([[{ id: CAT, productCount: 5 }]]);
    const del = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const db = { select, delete: del } as unknown as DbClient;

    const result = await deleteCategory(COMPANY, CAT, db);
    expect(result).toEqual({ ok: true, affectedProductCount: 5 });
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await deleteCategory(COMPANY, CAT, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});
