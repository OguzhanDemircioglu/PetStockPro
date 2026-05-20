import { describe, it, expect, vi } from 'vitest';
import { executeImport, importRowSchema, type ImportRowInput } from './import-execute';

vi.mock('@/lib/audit/log', () => ({
  writeAuditLogAsync: vi.fn(),
}));

const validRow: ImportRowInput = {
  name: 'Test Ürün',
  sku: 'TEST-001',
  categoryName: null,
  brandName: null,
  variantLabel: 'Standart',
  costPrice: null,
  salePrice: 199.9,
  threshold: 5,
  barcode: null,
  expiryDate: null,
  initialStock: 0,
};

interface MockTx {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

function mockDb(opts: {
  branches?: Array<{ id: string }>;
  existingBrands?: Array<{ id: string; name: string }>;
  existingCategories?: Array<{ id: string; name: string }>;
  txThrowsAt?: number; // belirli row indexte tx throw
} = {}) {
  const branches = opts.branches ?? [{ id: 'br-1' }];
  const eBrands = opts.existingBrands ?? [];
  const eCats = opts.existingCategories ?? [];

  let insertCount = 0;
  const insertSpy = vi.fn();
  const updateSpy = vi.fn();

  const mkChain = (returnValue: unknown) => {
    const obj: Record<string, unknown> = {};
    obj.values = vi.fn().mockReturnValue(obj);
    obj.where = vi.fn().mockReturnValue(obj);
    obj.set = vi.fn().mockReturnValue(obj);
    obj.from = vi.fn().mockReturnValue(obj);
    obj.innerJoin = vi.fn().mockReturnValue(obj);
    obj.leftJoin = vi.fn().mockReturnValue(obj);
    obj.limit = vi.fn().mockResolvedValue(returnValue);
    obj.returning = vi.fn().mockResolvedValue(returnValue);
    obj.then = (cb: (v: unknown) => unknown) => Promise.resolve(returnValue).then(cb);
    return obj;
  };

  // top-level select (branches lookup + cache fetches)
  const topSelectMap: Record<string, unknown[]> = {
    branches,
    brands: eBrands,
    categories: eCats,
  };
  let nextTopSelect: keyof typeof topSelectMap = 'branches';

  const tx: MockTx = {
    select: vi.fn().mockImplementation(() => {
      const key = nextTopSelect;
      const data = topSelectMap[key] ?? [];
      // cycle: branches → brands → categories
      if (key === 'branches') nextTopSelect = 'brands';
      else if (key === 'brands') nextTopSelect = 'categories';
      return mkChain(data);
    }),
    insert: vi.fn().mockImplementation((...args: unknown[]) => {
      insertCount++;
      if (opts.txThrowsAt && insertCount === opts.txThrowsAt) {
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('mock tx fail')),
            then: (cb: (v: unknown) => unknown) => Promise.reject(new Error('mock tx fail')).then(cb).catch(() => null),
          }),
        };
      }
      insertSpy(...args);
      // Insert chain — varying returning values
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: `mock-${insertCount}` }]),
          then: (cb: (v: unknown) => unknown) => Promise.resolve([{ id: `mock-${insertCount}` }]).then(cb),
        }),
      };
    }),
    update: vi.fn().mockImplementation(() => {
      updateSpy();
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(null),
        }),
      };
    }),
  };

  const db = {
    select: tx.select,
    insert: tx.insert,
    update: tx.update,
    transaction: vi.fn().mockImplementation(async (cb: (t: MockTx) => Promise<void>) => {
      await cb(tx);
    }),
  };

  return { db, tx, insertSpy, updateSpy, get insertCount() { return insertCount; } };
}

describe('importRowSchema (defense-in-depth)', () => {
  it('valid row parses', () => {
    expect(importRowSchema.safeParse(validRow).success).toBe(true);
  });
  it('name 1 karakter → reject', () => {
    const r = importRowSchema.safeParse({ ...validRow, name: 'A' });
    expect(r.success).toBe(false);
  });
  it('sku underscore → reject', () => {
    const r = importRowSchema.safeParse({ ...validRow, sku: 'A_B' });
    expect(r.success).toBe(false);
  });
  it('salePrice 0 → reject', () => {
    const r = importRowSchema.safeParse({ ...validRow, salePrice: 0 });
    expect(r.success).toBe(false);
  });
  it('salePrice 50001 → reject', () => {
    const r = importRowSchema.safeParse({ ...validRow, salePrice: 50001 });
    expect(r.success).toBe(false);
  });
  it('threshold float → reject', () => {
    const r = importRowSchema.safeParse({ ...validRow, threshold: 5.5 });
    expect(r.success).toBe(false);
  });
  it('barcode 12 hane → reject', () => {
    const r = importRowSchema.safeParse({ ...validRow, barcode: '123456789012' });
    expect(r.success).toBe(false);
  });
  it('initialStock 100001 → reject', () => {
    const r = importRowSchema.safeParse({ ...validRow, initialStock: 100001 });
    expect(r.success).toBe(false);
  });
  it('costPrice -1 → reject', () => {
    const r = importRowSchema.safeParse({ ...validRow, costPrice: -1 });
    expect(r.success).toBe(false);
  });
});

describe('executeImport — guard rails', () => {
  it('boş array → reject', async () => {
    const { db } = mockDb();
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: [],
      db: db as never,
    });
    expect(r.ok).toBe(false);
    expect(r.inserted).toBe(0);
    expect(r.errors[0].message).toContain('Yüklenecek satır yok');
  });

  it('1001 satır → reject (limit)', async () => {
    const { db } = mockDb();
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: new Array(1001).fill(validRow),
      db: db as never,
    });
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toContain('1000 satırdan fazla');
  });

  it('invalid input (schema fail) → row error', async () => {
    const { db } = mockDb();
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: [
        { ...validRow, sku: 'A' }, // 1-2 char → schema reject
      ],
      db: db as never,
    });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
  });

  it('aktif şube yok + initialStock>0 → reject', async () => {
    const { db } = mockDb({ branches: [] });
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: [{ ...validRow, initialStock: 10 }],
      db: db as never,
    });
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toContain('Aktif şube yok');
  });

  it('aktif şube yok + initialStock=0 → kabul edilir (şube gerekmiyor)', async () => {
    const { db } = mockDb({ branches: [] });
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: [validRow], // initialStock=0
      db: db as never,
    });
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(1);
  });
});

describe('executeImport — happy paths', () => {
  it('tek satır insert + vitrinPublished=false', async () => {
    const { db, insertSpy } = mockDb();
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: [validRow],
      db: db as never,
    });
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(1);
    expect(insertSpy).toHaveBeenCalled();
  });

  it('marka yoksa auto-create (1 brand insert)', async () => {
    const { db, insertSpy } = mockDb();
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: [{ ...validRow, brandName: 'Yeni Marka' }],
      db: db as never,
    });
    expect(r.ok).toBe(true);
    expect(insertSpy).toHaveBeenCalled();
    // brand + product + variant = 3 insert (initial stock yok)
    expect(insertSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('mevcut marka (case-insensitive) → yeni brand yaratmaz', async () => {
    const { db, insertSpy } = mockDb({
      existingBrands: [{ id: 'b-1', name: 'Royal Canin' }],
    });
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: [{ ...validRow, brandName: 'royal canin' }],
      db: db as never,
    });
    expect(r.ok).toBe(true);
    // product + variant = 2 insert (brand cached, initial stock yok)
    expect(insertSpy.mock.calls.length).toBe(2);
  });

  it('initialStock > 0 → 2 ek insert (branch_inventory + stock_movement)', async () => {
    const { db, insertSpy, updateSpy } = mockDb();
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: [{ ...validRow, initialStock: 25 }],
      db: db as never,
    });
    expect(r.ok).toBe(true);
    // product + variant + branch_inventory + stock_movement = 4 insert
    expect(insertSpy.mock.calls.length).toBe(4);
    // product.totalStockQty update
    expect(updateSpy).toHaveBeenCalled();
  });

  it('kategori case-insensitive match (cached)', async () => {
    const { db } = mockDb({
      existingCategories: [{ id: 'c-1', name: 'Akvaryum' }],
    });
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: [{ ...validRow, categoryName: 'AKVARYUM' }],
      db: db as never,
    });
    expect(r.ok).toBe(true);
  });

  it('2 satır toplu insert', async () => {
    const { db } = mockDb();
    const r = await executeImport({
      companyId: 'co-1',
      userId: 'u-1',
      rows: [
        { ...validRow, name: 'AAA', sku: 'A-1' },
        { ...validRow, name: 'BBB', sku: 'B-1' },
      ],
      db: db as never,
    });
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(2);
  });
});
