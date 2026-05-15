import { describe, it, expect, vi } from 'vitest';
import {
  addBrand,
  updateBrand,
  deleteBrand,
  brandSchema,
} from './manage';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const BRAND = '11111111-1111-1111-1111-111111111111';

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

describe('brandSchema', () => {
  it('isim zorunlu', () => {
    const r = brandSchema.safeParse({ name: 'Royal Canin' });
    expect(r.success).toBe(true);
  });

  it('boş isim reddedilir', () => {
    const r = brandSchema.safeParse({ name: '' });
    expect(r.success).toBe(false);
  });

  it('logoUrl URL format', () => {
    const r = brandSchema.safeParse({ name: 'X', logoUrl: 'not-a-url' });
    expect(r.success).toBe(false);
  });

  it('logoUrl boş → null', () => {
    const r = brandSchema.safeParse({ name: 'X', logoUrl: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.logoUrl).toBeNull();
  });
});

describe('addBrand', () => {
  it('happy path', async () => {
    const select = makeSelectChain([[]]); // slug çakışma yok
    const returning = vi.fn().mockResolvedValue([{ id: 'new-brand' }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { select, insert } as unknown as DbClient;

    const result = await addBrand(COMPANY, { name: 'Royal Canin' }, db);
    expect(result).toEqual({ ok: true, brandId: 'new-brand' });
  });

  it('slug_taken — çakışma', async () => {
    const select = makeSelectChain([[{ id: 'existing' }]]);
    const db = { select } as unknown as DbClient;
    const result = await addBrand(COMPANY, { name: 'Royal Canin' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('slug_taken');
  });

  it('Zod fail', async () => {
    const db = { select: vi.fn() } as unknown as DbClient;
    const result = await addBrand(COMPANY, { name: '' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_input');
  });
});

describe('updateBrand', () => {
  it('happy', async () => {
    const select = makeSelectChain([
      [{ id: BRAND }], // existing
      [], // slug çakışma yok
    ]);
    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;

    const result = await updateBrand(COMPANY, BRAND, { name: 'Yeni İsim' }, db);
    expect(result).toEqual({ ok: true });
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await updateBrand(COMPANY, BRAND, { name: 'X' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('slug_taken — başka marka aynı slug', async () => {
    const select = makeSelectChain([
      [{ id: BRAND }],
      [{ id: 'other-brand' }],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await updateBrand(COMPANY, BRAND, { name: 'Catit' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('slug_taken');
  });
});

describe('deleteBrand', () => {
  it('happy — productCount=0', async () => {
    const select = makeSelectChain([[{ id: BRAND, productCount: 0 }]]);
    const del = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const db = { select, delete: del } as unknown as DbClient;

    const result = await deleteBrand(COMPANY, BRAND, db);
    expect(result).toEqual({ ok: true, affectedProductCount: 0 });
  });

  it('happy — productCount>0 (warning context)', async () => {
    const select = makeSelectChain([[{ id: BRAND, productCount: 3 }]]);
    const del = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const db = { select, delete: del } as unknown as DbClient;

    const result = await deleteBrand(COMPANY, BRAND, db);
    expect(result).toEqual({ ok: true, affectedProductCount: 3 });
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await deleteBrand(COMPANY, BRAND, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});
