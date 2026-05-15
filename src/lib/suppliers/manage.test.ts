import { describe, it, expect, vi } from 'vitest';
import {
  addSupplier,
  updateSupplier,
  setSupplierActive,
  supplierSchema,
} from './manage';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const SUPPLIER = '11111111-1111-1111-1111-111111111111';

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

describe('supplierSchema', () => {
  it('minimum alanlar — sadece name', () => {
    const r = supplierSchema.safeParse({ name: 'Royal Canin TR' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.leadTimeDays).toBe(7); // default
      expect(r.data.paymentTerms).toBe('net_30'); // default
    }
  });

  it('vatNo 10 hane OK', () => {
    const r = supplierSchema.safeParse({ name: 'Test Firma', vatNo: '1234567890' });
    expect(r.success).toBe(true);
  });

  it('vatNo 11 hane OK', () => {
    const r = supplierSchema.safeParse({ name: 'Test Firma', vatNo: '12345678901' });
    expect(r.success).toBe(true);
  });

  it('vatNo 9 hane reddedilir', () => {
    const r = supplierSchema.safeParse({ name: 'Test Firma', vatNo: '123456789' });
    expect(r.success).toBe(false);
  });

  it('boş vatNo → null normalize', () => {
    const r = supplierSchema.safeParse({ name: 'Test Firma', vatNo: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.vatNo).toBeNull();
  });

  it('email format', () => {
    const r = supplierSchema.safeParse({ name: 'Test Firma', email: 'invalid' });
    expect(r.success).toBe(false);
  });

  it('IBAN TR + 24 hane OK', () => {
    const r = supplierSchema.safeParse({
      name: 'Test Firma',
      iban: 'TR320010009999901234567890',
    });
    expect(r.success).toBe(true);
  });

  it('IBAN wrong format reddedilir', () => {
    const r = supplierSchema.safeParse({ name: 'Test Firma', iban: 'DE320010009999901234567890' });
    expect(r.success).toBe(false);
  });

  it('paymentTerms enum invalid', () => {
    const r = supplierSchema.safeParse({
      name: 'Test Firma',
      paymentTerms: 'net_90',
    });
    expect(r.success).toBe(false);
  });

  it('leadTimeDays 366 reddedilir', () => {
    const r = supplierSchema.safeParse({ name: 'Test Firma', leadTimeDays: 366 });
    expect(r.success).toBe(false);
  });
});

describe('addSupplier', () => {
  it('happy path', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'new-supplier' }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    const result = await addSupplier(
      COMPANY,
      { name: 'Royal Canin', vatNo: '1234567890' },
      db,
    );
    expect(result).toEqual({ ok: true, supplierId: 'new-supplier' });
  });

  it('Zod fail — name 1 karakter', async () => {
    const db = { insert: vi.fn() } as unknown as DbClient;
    const result = await addSupplier(COMPANY, { name: 'X' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_input');
  });
});

describe('updateSupplier', () => {
  it('happy', async () => {
    const select = makeSelectChain([[{ id: SUPPLIER }]]);
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const db = { select, update } as unknown as DbClient;

    const result = await updateSupplier(
      COMPANY,
      SUPPLIER,
      { name: 'Royal Canin v2' },
      db,
    );
    expect(result).toEqual({ ok: true });
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await updateSupplier(COMPANY, SUPPLIER, { name: 'Test Firma' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});

describe('setSupplierActive', () => {
  it('aktif → pasif', async () => {
    const select = makeSelectChain([[{ id: SUPPLIER }]]);
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const db = { select, update } as unknown as DbClient;
    const result = await setSupplierActive(COMPANY, SUPPLIER, false, db);
    expect(result).toEqual({ ok: true, isActive: false });
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await setSupplierActive(COMPANY, SUPPLIER, false, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});
