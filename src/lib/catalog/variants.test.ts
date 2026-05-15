import { describe, it, expect, vi } from 'vitest';
import {
  createVariant,
  updateVariant,
  deleteVariant,
  setDefaultVariant,
  reorderVariants,
  listVariants,
  createVariantSchema,
  updateVariantSchema,
} from './variants';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const PRODUCT = 'product-uuid';
const VARIANT = 'variant-uuid';
const VALID_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// ─────────────────────────────────────────────────────────────────
// SCHEMA — pure unit (DB lazım değil)
// ─────────────────────────────────────────────────────────────────

describe('createVariantSchema', () => {
  it('default değerler — axisLabel "Boyut", threshold 5', () => {
    const parsed = createVariantSchema.parse({
      valueLabel: '2kg',
      sku: 'ROY-2KG',
      salePrice: '180.50',
    });
    expect(parsed.axisLabel).toBe('Boyut');
    expect(parsed.threshold).toBe(5);
    expect(parsed.costPrice).toBe('0');
  });

  it('salePrice format reddedilir', () => {
    const res = createVariantSchema.safeParse({
      valueLabel: '2kg',
      sku: 'ROY-2KG',
      salePrice: '180,50', // virgül — reddedilmeli
    });
    expect(res.success).toBe(false);
  });

  it('valueLabel boş reddedilir', () => {
    const res = createVariantSchema.safeParse({
      valueLabel: '',
      sku: 'X',
      salePrice: '10',
    });
    expect(res.success).toBe(false);
  });

  it('branchThresholds — branchId uuid değilse reddedilir', () => {
    const res = createVariantSchema.safeParse({
      valueLabel: '2kg',
      sku: 'X',
      salePrice: '10',
      branchThresholds: { 'not-a-uuid': 5 },
    });
    expect(res.success).toBe(false);
  });

  it('branchThresholds — geçerli uuid kabul edilir', () => {
    const res = createVariantSchema.safeParse({
      valueLabel: '2kg',
      sku: 'X',
      salePrice: '10',
      branchThresholds: { [VALID_UUID]: 10 },
    });
    expect(res.success).toBe(true);
  });
});

describe('updateVariantSchema', () => {
  it('threshold negatif reddedilir', () => {
    const res = updateVariantSchema.safeParse({
      valueLabel: '2kg',
      sku: 'X',
      costPrice: '10',
      salePrice: '20',
      threshold: -1,
    });
    expect(res.success).toBe(false);
  });

  it('isActive boolean opsiyonel', () => {
    const res = updateVariantSchema.safeParse({
      valueLabel: '2kg',
      sku: 'X',
      costPrice: '10',
      salePrice: '20',
      threshold: 5,
      isActive: false,
    });
    expect(res.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// DB mock helper
// ─────────────────────────────────────────────────────────────────

/**
 * Sırayla cevap dönen select mock. Her select() çağrısı için yeni bir
 * "ucu" tüketir. Sonu boş [] döner (test paranoyası için).
 *
 * Drizzle chain'i await edilebilir herhangi bir noktada — where() bazen
 * direkt await edilir, bazen limit()/orderBy() ile devam eder. Bu yüzden
 * her chain düğümü hem chainable hem Promise-like (thenable) yapılır.
 */
function makeSelectChain(responses: unknown[][]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const data = responses[i++] ?? [];
    // Thenable + chainable node — herhangi bir aşamada await OK
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

// ─────────────────────────────────────────────────────────────────
// createVariant
// ─────────────────────────────────────────────────────────────────

describe('createVariant', () => {
  it('happy path — ürün bulundu, SKU temiz → insert eder', async () => {
    const select = makeSelectChain([
      [{ id: PRODUCT }], // product ownership
      [], // SKU conflict
      [{ max: 4 }], // displayOrder max
    ]);
    const returning = vi.fn().mockResolvedValue([{ id: 'new-variant' }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { select, insert } as unknown as DbClient;

    const result = await createVariant(
      COMPANY,
      PRODUCT,
      { valueLabel: '2kg', sku: 'ROY-2KG', salePrice: '180.50' },
      db,
    );

    expect(result).toEqual({ ok: true, variantId: 'new-variant' });
    expect(insert).toHaveBeenCalledTimes(1);
    // displayOrder = max+1 = 5
    const inserted = values.mock.calls[0][0];
    expect(inserted.displayOrder).toBe(5);
    expect(inserted.isDefault).toBe(false);
    expect(inserted.isActive).toBe(true);
  });

  it('ürün bulunamadı → product_not_found', async () => {
    const select = makeSelectChain([[]]); // boş product
    const db = { select } as unknown as DbClient;

    const result = await createVariant(
      COMPANY,
      PRODUCT,
      { valueLabel: '2kg', sku: 'X', salePrice: '10' },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('product_not_found');
  });

  it('SKU çakışırsa sku_taken', async () => {
    const select = makeSelectChain([
      [{ id: PRODUCT }],
      [{ id: 'other-variant' }],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await createVariant(
      COMPANY,
      PRODUCT,
      { valueLabel: '2kg', sku: 'TAKEN', salePrice: '10' },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('sku_taken');
  });

  it('Zod hata → invalid_input + issues döner', async () => {
    const select = vi.fn();
    const db = { select } as unknown as DbClient;
    const result = await createVariant(
      COMPANY,
      PRODUCT,
      { valueLabel: '', sku: '', salePrice: 'abc' },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_input');
      expect(result.issues?.length ?? 0).toBeGreaterThan(0);
    }
    // DB hiç çağrılmadı — Zod gate
    expect(select).not.toHaveBeenCalled();
  });

  it('displayOrder max=null → 0 olarak insert eder', async () => {
    const select = makeSelectChain([
      [{ id: PRODUCT }],
      [],
      [{ max: null }], // henüz hiç variant yok
    ]);
    const returning = vi.fn().mockResolvedValue([{ id: 'new-variant' }]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { select, insert } as unknown as DbClient;

    await createVariant(
      COMPANY,
      PRODUCT,
      { valueLabel: '2kg', sku: 'X', salePrice: '10' },
      db,
    );
    const inserted = values.mock.calls[0][0];
    expect(inserted.displayOrder).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// updateVariant
// ─────────────────────────────────────────────────────────────────

describe('updateVariant', () => {
  it('happy path — bulundu, SKU temiz → update', async () => {
    const select = makeSelectChain([
      [{ id: VARIANT, productId: PRODUCT, isActive: true }],
      [], // SKU conflict (aktif değişmeyince active count gerekmez)
    ]);
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const db = { select, update } as unknown as DbClient;

    const result = await updateVariant(
      COMPANY,
      VARIANT,
      {
        valueLabel: '2kg revize',
        sku: 'NEW-SKU',
        costPrice: '100',
        salePrice: '200',
        threshold: 8,
      },
      db,
    );

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('not_found döner', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await updateVariant(
      COMPANY,
      VARIANT,
      {
        valueLabel: '2kg',
        sku: 'X',
        costPrice: '10',
        salePrice: '20',
        threshold: 5,
      },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('son aktif variant pasifleştirilemez → last_active', async () => {
    const select = makeSelectChain([
      [{ id: VARIANT, productId: PRODUCT, isActive: true }],
      [{ c: 1 }], // tek aktif variant
    ]);
    const db = { select } as unknown as DbClient;

    const result = await updateVariant(
      COMPANY,
      VARIANT,
      {
        valueLabel: '2kg',
        sku: 'X',
        costPrice: '10',
        salePrice: '20',
        threshold: 5,
        isActive: false, // pasifleştirmeye çalış
      },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('last_active');
  });

  it('birden fazla aktif varsa pasifleşebilir', async () => {
    const select = makeSelectChain([
      [{ id: VARIANT, productId: PRODUCT, isActive: true }],
      [{ c: 2 }], // 2 aktif → birini pasifleştirebiliriz
      [], // SKU conflict yok
    ]);
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const db = { select, update } as unknown as DbClient;

    const result = await updateVariant(
      COMPANY,
      VARIANT,
      {
        valueLabel: '2kg',
        sku: 'X',
        costPrice: '10',
        salePrice: '20',
        threshold: 5,
        isActive: false,
      },
      db,
    );
    expect(result.ok).toBe(true);
  });

  it('SKU başka variant tarafından kullanılıyor → sku_taken', async () => {
    const select = makeSelectChain([
      [{ id: VARIANT, productId: PRODUCT, isActive: true }],
      [{ id: 'other-variant' }],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await updateVariant(
      COMPANY,
      VARIANT,
      {
        valueLabel: '2kg',
        sku: 'TAKEN',
        costPrice: '10',
        salePrice: '20',
        threshold: 5,
      },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('sku_taken');
  });
});

// ─────────────────────────────────────────────────────────────────
// deleteVariant
// ─────────────────────────────────────────────────────────────────

describe('deleteVariant', () => {
  it('happy path — default değil + birden fazla aktif → delete', async () => {
    const select = makeSelectChain([
      [{ id: VARIANT, productId: PRODUCT, isActive: true, isDefault: false }],
      [{ c: 3 }],
    ]);
    const del = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const db = { select, delete: del } as unknown as DbClient;

    const result = await deleteVariant(COMPANY, VARIANT, db);
    expect(result).toEqual({ ok: true });
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('default variant silinemez → is_default', async () => {
    const select = makeSelectChain([
      [{ id: VARIANT, productId: PRODUCT, isActive: true, isDefault: true }],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await deleteVariant(COMPANY, VARIANT, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('is_default');
  });

  it('son aktif variant silinemez → last_active', async () => {
    const select = makeSelectChain([
      [{ id: VARIANT, productId: PRODUCT, isActive: true, isDefault: false }],
      [{ c: 1 }],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await deleteVariant(COMPANY, VARIANT, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('last_active');
  });

  it('pasif variant silinebilir (active count check atlanır)', async () => {
    const select = makeSelectChain([
      [{ id: VARIANT, productId: PRODUCT, isActive: false, isDefault: false }],
    ]);
    const del = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const db = { select, delete: del } as unknown as DbClient;

    const result = await deleteVariant(COMPANY, VARIANT, db);
    expect(result.ok).toBe(true);
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('not_found döner', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await deleteVariant(COMPANY, VARIANT, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});

// ─────────────────────────────────────────────────────────────────
// setDefaultVariant
// ─────────────────────────────────────────────────────────────────

describe('setDefaultVariant', () => {
  it('aktif variant default yapılır — transaction iki update çağrısı', async () => {
    const select = makeSelectChain([
      [{ id: VARIANT, productId: PRODUCT, isActive: true }],
    ]);
    const txUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ update: txUpdate }),
      );
    const db = { select, transaction } as unknown as DbClient;

    const result = await setDefaultVariant(COMPANY, VARIANT, db);
    expect(result).toEqual({ ok: true });
    // İki update çağrısı: önce hepsini false yap, sonra hedefi true yap
    expect(txUpdate).toHaveBeenCalledTimes(2);
  });

  it('pasif variant default yapılamaz → not_active', async () => {
    const select = makeSelectChain([
      [{ id: VARIANT, productId: PRODUCT, isActive: false }],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await setDefaultVariant(COMPANY, VARIANT, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_active');
  });

  it('not_found döner', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await setDefaultVariant(COMPANY, VARIANT, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});

// ─────────────────────────────────────────────────────────────────
// reorderVariants
// ─────────────────────────────────────────────────────────────────

describe('reorderVariants', () => {
  it('happy path — sırayla update', async () => {
    const ordered = ['v1', 'v2', 'v3'];
    const select = makeSelectChain([
      [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }],
    ]);
    const txUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ update: txUpdate }),
      );
    const db = { select, transaction } as unknown as DbClient;

    const result = await reorderVariants(COMPANY, PRODUCT, ordered, db);
    expect(result).toEqual({ ok: true });
    expect(txUpdate).toHaveBeenCalledTimes(3);
  });

  it('boş liste → invalid_input', async () => {
    const db = { select: vi.fn() } as unknown as DbClient;
    const result = await reorderVariants(COMPANY, PRODUCT, [], db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_input');
  });

  it('liste DB sonucu eşleşmiyor → mismatch (yetki/sahip kontrolü)', async () => {
    const ordered = ['v1', 'v2', 'v3'];
    const select = makeSelectChain([
      [{ id: 'v1' }, { id: 'v2' }], // sadece 2 found
    ]);
    const db = { select } as unknown as DbClient;

    const result = await reorderVariants(COMPANY, PRODUCT, ordered, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('mismatch');
  });
});

// ─────────────────────────────────────────────────────────────────
// listVariants
// ─────────────────────────────────────────────────────────────────

describe('listVariants', () => {
  it('orderBy ile döner', async () => {
    const variants = [
      {
        id: 'v1',
        valueLabel: '2kg',
        axisLabel: 'Boyut',
        sku: 'X1',
        barcode: null,
        costPrice: '50.00',
        salePrice: '100.00',
        threshold: 5,
        branchThresholds: null,
        isActive: true,
        isDefault: true,
        displayOrder: 0,
      },
    ];
    const select = makeSelectChain([variants]);
    const db = { select } as unknown as DbClient;

    const result = await listVariants(COMPANY, PRODUCT, db);
    expect(result).toEqual(variants);
  });
});
