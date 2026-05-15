import { describe, it, expect, vi } from 'vitest';
import {
  recordStockIn,
  recordStockOut,
  recordTransfer,
  recordStocktakeAdjustment,
  reverseStockMovement,
  InsufficientStockError,
  stockInSchema,
  stockOutSchema,
  transferSchema,
  stocktakeAdjustmentSchema,
  REVERSAL_WINDOW_MS,
} from './movements';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const USER = 'user-uuid';
const BRANCH = '11111111-1111-1111-1111-111111111111';
const BRANCH_2 = '22222222-2222-2222-2222-222222222222';
const VARIANT = '33333333-3333-3333-3333-333333333333';
const PRODUCT = '44444444-4444-4444-4444-444444444444';
const NOW = new Date('2026-05-15T12:00:00Z');

// ─────────────────────────────────────────────────────────────────
// Thenable + chainable select mock
// ─────────────────────────────────────────────────────────────────

function makeSelectChain(responses: unknown[][]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const data = responses[i++] ?? [];
    const makeNode = (): {
      from: ReturnType<typeof vi.fn>;
      innerJoin: ReturnType<typeof vi.fn>;
      leftJoin: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
    } => {
      const node: ReturnType<typeof makeNode> = {
        from: vi.fn(() => makeNode()),
        innerJoin: vi.fn(() => makeNode()),
        leftJoin: vi.fn(() => makeNode()),
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
// Transaction mock — applyInventoryChange içindeki tx.update/insert
// ─────────────────────────────────────────────────────────────────

function makeTxMock() {
  const movementInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'new-movement-id' }]),
    }),
  });
  const inventoryInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
  const inventoryUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
  // Tek insert mock — her iki tablo için aynı çağrı. values return chain'i
  // movement için returning() döner, inventory için sadece values await edilir.
  const insertImpl = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockResolvedValue([{ id: 'new-movement-id' }]),
      then: (cb: (v: undefined) => unknown) => Promise.resolve(undefined).then(cb),
    })),
  }));
  const updateImpl = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });

  return {
    tx: { insert: insertImpl, update: updateImpl },
    movementInsert,
    inventoryInsert,
    inventoryUpdate,
    insertImpl,
    updateImpl,
  };
}

// ─────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────

describe('stockInSchema', () => {
  it('zorunlu alanlar', () => {
    const res = stockInSchema.safeParse({
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: 10,
    });
    expect(res.success).toBe(true);
  });

  it('miktar 0 reddedilir', () => {
    const res = stockInSchema.safeParse({
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: 0,
    });
    expect(res.success).toBe(false);
  });

  it('negatif miktar reddedilir', () => {
    const res = stockInSchema.safeParse({
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: -5,
    });
    expect(res.success).toBe(false);
  });

  it('expiryDate format', () => {
    const res = stockInSchema.safeParse({
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: 10,
      expiryDate: '15.05.2026', // yanlış format
    });
    expect(res.success).toBe(false);
  });
});

describe('stockOutSchema', () => {
  it('subtype zorunlu', () => {
    const res = stockOutSchema.safeParse({
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: 1,
    });
    expect(res.success).toBe(false);
  });

  it('paymentMethod enum', () => {
    const res = stockOutSchema.safeParse({
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: 1,
      subtype: 'sale',
      paymentMethod: 'crypto', // YOK
    });
    expect(res.success).toBe(false);
  });
});

describe('transferSchema', () => {
  it('aynı kaynak+hedef reddedilir', () => {
    const res = transferSchema.safeParse({
      sourceBranchId: BRANCH,
      targetBranchId: BRANCH,
      variantId: VARIANT,
      quantity: 5,
    });
    expect(res.success).toBe(false);
  });

  it('farklı şubeler kabul edilir', () => {
    const res = transferSchema.safeParse({
      sourceBranchId: BRANCH,
      targetBranchId: BRANCH_2,
      variantId: VARIANT,
      quantity: 5,
    });
    expect(res.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// recordStockIn
// ─────────────────────────────────────────────────────────────────

describe('recordStockIn', () => {
  it('happy path — yeni inventory satırı (ilk giriş)', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: null,
          inventoryRowId: null,
        },
      ],
    ]);
    const { tx, insertImpl, updateImpl } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await recordStockIn(
      COMPANY,
      USER,
      { branchId: BRANCH, variantId: VARIANT, quantity: 50, unitCost: '120.00' },
      db,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.afterQty).toBe(50);
      expect(result.movementId).toBe('new-movement-id');
    }
    // 1 movement insert + 1 inventory insert
    expect(insertImpl).toHaveBeenCalledTimes(2);
    // 1 product.totalStockQty update (vitrin auto-unpublish stock-in'de tetiklenmez)
    expect(updateImpl).toHaveBeenCalledTimes(1);
  });

  it('happy path — mevcut inventory satırı (UPDATE)', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 30,
          inventoryRowId: 'inv-row-1',
        },
      ],
    ]);
    const { tx, insertImpl, updateImpl } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await recordStockIn(
      COMPANY,
      USER,
      { branchId: BRANCH, variantId: VARIANT, quantity: 20 },
      db,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.afterQty).toBe(50);
    // Sadece movement insert (inventory UPDATE, INSERT yok)
    expect(insertImpl).toHaveBeenCalledTimes(1);
    // inventory.update + product.totalStockQty update
    expect(updateImpl).toHaveBeenCalledTimes(2);
  });

  it('variant başka tenant\'tan → not_found', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: 'other-tenant',
          branchCompanyId: COMPANY,
          currentQty: 0,
          inventoryRowId: null,
        },
      ],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await recordStockIn(
      COMPANY,
      USER,
      { branchId: BRANCH, variantId: VARIANT, quantity: 10 },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('Zod fail → invalid_input + issues', async () => {
    const db = { select: vi.fn() } as unknown as DbClient;
    const result = await recordStockIn(
      COMPANY,
      USER,
      { branchId: 'not-uuid', variantId: VARIANT, quantity: 10 },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_input');
  });
});

// ─────────────────────────────────────────────────────────────────
// recordStockOut
// ─────────────────────────────────────────────────────────────────

describe('recordStockOut', () => {
  it('happy path — sale + cash', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 25,
          inventoryRowId: 'inv-row-1',
        },
      ],
    ]);
    const { tx, insertImpl, updateImpl } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await recordStockOut(
      COMPANY,
      USER,
      {
        branchId: BRANCH,
        variantId: VARIANT,
        quantity: 3,
        subtype: 'sale',
        unitPrice: '180.50',
        paymentMethod: 'cash',
      },
      db,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.afterQty).toBe(22);
    expect(insertImpl).toHaveBeenCalledTimes(1); // sadece movement
    // update'ler: inventory + product.totalStockQty + auto-unpublish branch
    expect(updateImpl).toHaveBeenCalledTimes(3);
  });

  it('yetersiz stok → insufficient_stock + meta', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 2,
          inventoryRowId: 'inv-row-1',
        },
      ],
    ]);
    const db = { select, transaction: vi.fn() } as unknown as DbClient;

    const result = await recordStockOut(
      COMPANY,
      USER,
      {
        branchId: BRANCH,
        variantId: VARIANT,
        quantity: 10,
        subtype: 'sale',
      },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient_stock');
      expect(result.meta?.available).toBe(2);
      expect(result.meta?.requested).toBe(10);
    }
  });

  it('credit + customerRef eksik → invalid_state', async () => {
    const db = { select: vi.fn() } as unknown as DbClient;

    const result = await recordStockOut(
      COMPANY,
      USER,
      {
        branchId: BRANCH,
        variantId: VARIANT,
        quantity: 1,
        subtype: 'sale',
        paymentMethod: 'credit',
        customerRef: '',
      },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_state');
      expect(result.issues?.[0]).toMatch(/veresiye/i);
    }
  });

  it('credit + customerRef dolu → akış devam', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 10,
          inventoryRowId: 'inv-row-1',
        },
      ],
    ]);
    const { tx } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await recordStockOut(
      COMPANY,
      USER,
      {
        branchId: BRANCH,
        variantId: VARIANT,
        quantity: 1,
        subtype: 'sale',
        paymentMethod: 'credit',
        customerRef: 'Ahmet B. 0532...',
      },
      db,
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  it('subtype waste — fire kaydı OK', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 5,
          inventoryRowId: 'inv-row-1',
        },
      ],
    ]);
    const { tx } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await recordStockOut(
      COMPANY,
      USER,
      {
        branchId: BRANCH,
        variantId: VARIANT,
        quantity: 2,
        subtype: 'waste',
        reason: 'SKT geçti',
      },
      db,
      NOW,
    );
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// recordTransfer
// ─────────────────────────────────────────────────────────────────

describe('recordTransfer', () => {
  it('happy path — iki insert + iki applyInventoryChange', async () => {
    const select = makeSelectChain([
      [
        // sourceInfo
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 20,
          inventoryRowId: 'inv-source',
        },
      ],
      [
        // targetInfo
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 5,
          inventoryRowId: 'inv-target',
        },
      ],
    ]);
    const { tx, insertImpl, updateImpl } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await recordTransfer(
      COMPANY,
      USER,
      {
        sourceBranchId: BRANCH,
        targetBranchId: BRANCH_2,
        variantId: VARIANT,
        quantity: 8,
      },
      db,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sourceAfterQty).toBe(12);
      expect(result.targetAfterQty).toBe(13);
      expect(result.transferGroupId).toBeTruthy();
    }
    // 2 movement insert (kaynak + hedef)
    expect(insertImpl).toHaveBeenCalledTimes(2);
    // updates: kaynak inventory + product.totalStockQty + auto-unpublish check (kaynak)
    //         + hedef inventory + product.totalStockQty
    // = 5 update (auto-unpublish kaynak için, hedef için yok)
    expect(updateImpl.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('kaynak yetersiz → insufficient_stock', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 3,
          inventoryRowId: 'inv-source',
        },
      ],
    ]);
    const db = { select, transaction: vi.fn() } as unknown as DbClient;

    const result = await recordTransfer(
      COMPANY,
      USER,
      {
        sourceBranchId: BRANCH,
        targetBranchId: BRANCH_2,
        variantId: VARIANT,
        quantity: 10,
      },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient_stock');
      expect(result.meta?.available).toBe(3);
    }
  });

  it('hedef şube tenant\'a ait değil → not_found', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 20,
          inventoryRowId: 'inv-source',
        },
      ],
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: 'other-tenant',
          currentQty: 0,
          inventoryRowId: null,
        },
      ],
    ]);
    const db = { select, transaction: vi.fn() } as unknown as DbClient;

    const result = await recordTransfer(
      COMPANY,
      USER,
      {
        sourceBranchId: BRANCH,
        targetBranchId: BRANCH_2,
        variantId: VARIANT,
        quantity: 5,
      },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});

// ─────────────────────────────────────────────────────────────────
// recordStocktakeAdjustment
// ─────────────────────────────────────────────────────────────────

describe('stocktakeAdjustmentSchema', () => {
  it('countedQty 0 kabul', () => {
    const res = stocktakeAdjustmentSchema.safeParse({
      branchId: BRANCH,
      variantId: VARIANT,
      countedQty: 0,
    });
    expect(res.success).toBe(true);
  });

  it('countedQty negatif reddedilir', () => {
    const res = stocktakeAdjustmentSchema.safeParse({
      branchId: BRANCH,
      variantId: VARIANT,
      countedQty: -1,
    });
    expect(res.success).toBe(false);
  });
});

describe('recordStocktakeAdjustment', () => {
  it('eksik sayım (delta +) → stock_in yönlü düzeltme', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 8,
          inventoryRowId: 'inv-1',
        },
      ],
    ]);
    const { tx, insertImpl, updateImpl } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await recordStocktakeAdjustment(
      COMPANY,
      USER,
      { branchId: BRANCH, variantId: VARIANT, countedQty: 10 },
      db,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.delta).toBe(2);
      expect(result.afterQty).toBe(10);
    }
    expect(insertImpl).toHaveBeenCalledTimes(1);
    expect(updateImpl).toHaveBeenCalledTimes(2); // inventory + product totalStockQty
  });

  it('fazla sayım (delta -) → stock_out yönlü, auto-unpublish tetiklenebilir', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 5,
          inventoryRowId: 'inv-1',
        },
      ],
    ]);
    const { tx, updateImpl } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await recordStocktakeAdjustment(
      COMPANY,
      USER,
      {
        branchId: BRANCH,
        variantId: VARIANT,
        countedQty: 3,
        reason: 'Sayımda 3 bulundu',
      },
      db,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delta).toBe(-2);
    // 3 update: inventory + totalStockQty + auto-unpublish kontrolü
    expect(updateImpl).toHaveBeenCalledTimes(3);
  });

  it('delta 0 → no_change (kayıt yok)', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 10,
          inventoryRowId: 'inv-1',
        },
      ],
    ]);
    const db = { select, transaction: vi.fn() } as unknown as DbClient;

    const result = await recordStocktakeAdjustment(
      COMPANY,
      USER,
      { branchId: BRANCH, variantId: VARIANT, countedQty: 10 },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_change');
  });

  it('variant başka tenant → not_found', async () => {
    const select = makeSelectChain([
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: 'other',
          branchCompanyId: COMPANY,
          currentQty: 5,
          inventoryRowId: null,
        },
      ],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await recordStocktakeAdjustment(
      COMPANY,
      USER,
      { branchId: BRANCH, variantId: VARIANT, countedQty: 7 },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});

// ─────────────────────────────────────────────────────────────────
// reverseStockMovement
// ─────────────────────────────────────────────────────────────────

const MOVEMENT_ID = '55555555-5555-5555-5555-555555555555';

describe('reverseStockMovement', () => {
  it('happy path — stok-in geri al (1 saat eski, içeride)', async () => {
    const original = {
      id: MOVEMENT_ID,
      type: 'stock_in',
      subtype: null,
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: 10,
      beforeQty: 0,
      afterQty: 10,
      createdAt: new Date(NOW.getTime() - 60 * 60 * 1000), // 1 saat önce
      reversedById: null,
      reversesId: null,
    };
    const select = makeSelectChain([
      [original],
      [
        // fetchVariantStockInfo
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 10,
          inventoryRowId: 'inv-1',
        },
      ],
    ]);
    const { tx, insertImpl, updateImpl } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
      {},
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reversalMovementId).toBe('new-movement-id');
    // 1 movement insert (reversal kaydı)
    expect(insertImpl).toHaveBeenCalledTimes(1);
    // updates: orijinali işaretle + inventory + product totalStockQty +
    //         auto-unpublish (stock-in geri alındığı için -10 → 0, isOutgoing=true)
    expect(updateImpl.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('25 saat eski → window_expired', async () => {
    const original = {
      id: MOVEMENT_ID,
      type: 'stock_in',
      subtype: null,
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: 5,
      beforeQty: 0,
      afterQty: 5,
      createdAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
      reversedById: null,
      reversesId: null,
    };
    const select = makeSelectChain([[original]]);
    const db = { select } as unknown as DbClient;

    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
      {},
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('window_expired');
  });

  it('25 saat eski + isSuperadmin → bypass, geri alınır', async () => {
    const original = {
      id: MOVEMENT_ID,
      type: 'stock_in',
      subtype: null,
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: 5,
      beforeQty: 0,
      afterQty: 5,
      createdAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
      reversedById: null,
      reversesId: null,
    };
    const select = makeSelectChain([
      [original],
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 5,
          inventoryRowId: 'inv-1',
        },
      ],
    ]);
    const { tx } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
      { isSuperadmin: true },
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  it('zaten geri alınmış → already_reversed', async () => {
    const original = {
      id: MOVEMENT_ID,
      type: 'stock_in',
      subtype: null,
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: 10,
      beforeQty: 0,
      afterQty: 10,
      createdAt: new Date(NOW.getTime() - 60 * 1000),
      reversedById: 'some-reversal-id',
      reversesId: null,
    };
    const select = makeSelectChain([[original]]);
    const db = { select } as unknown as DbClient;

    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
      {},
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_reversed');
  });

  it('reversal kaydının kendisi geri alınamaz → is_reversal', async () => {
    const original = {
      id: MOVEMENT_ID,
      type: 'stock_in',
      subtype: null,
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: -10,
      beforeQty: 10,
      afterQty: 0,
      createdAt: new Date(NOW.getTime() - 60 * 1000),
      reversedById: null,
      reversesId: 'original-id',
    };
    const select = makeSelectChain([[original]]);
    const db = { select } as unknown as DbClient;

    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
      {},
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('is_reversal');
  });

  it('transfer pair eşi yoksa → transfer_pair_missing', async () => {
    const original = {
      id: MOVEMENT_ID,
      type: 'transfer',
      subtype: null,
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: -5,
      beforeQty: 10,
      afterQty: 5,
      createdAt: new Date(NOW.getTime() - 60 * 1000),
      reversedById: null,
      reversesId: null,
      transferGroupId: 'tg-1',
    };
    const select = makeSelectChain([
      [original],
      [], // pair bulunamadı
    ]);
    const db = { select } as unknown as DbClient;

    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
      {},
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('transfer_pair_missing');
  });

  it('transfer pair geri alma — iki entry reversed + iki şube restore', async () => {
    const original = {
      id: MOVEMENT_ID,
      type: 'transfer',
      subtype: null,
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: -10, // kaynak çıkış
      beforeQty: 20,
      afterQty: 10,
      createdAt: new Date(NOW.getTime() - 30 * 60 * 1000),
      reversedById: null,
      reversesId: null,
      transferGroupId: 'tg-pair-1',
    };
    const pair = {
      id: 'pair-id',
      branchId: BRANCH_2,
      variantId: VARIANT,
      quantity: 10, // hedef giriş
      reversedById: null,
      reversesId: null,
    };
    const select = makeSelectChain([
      [original],
      [pair],
      // originalInfo
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 10,
          inventoryRowId: 'inv-source',
        },
      ],
      // pairInfo (hedef şubede 10 var)
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 10,
          inventoryRowId: 'inv-target',
        },
      ],
    ]);
    const { tx, insertImpl, updateImpl } = makeTxMock();
    const transaction = vi
      .fn()
      .mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx));
    const db = { select, transaction } as unknown as DbClient;

    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
      {},
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reversalMovementId).toBe('new-movement-id');
      expect(result.reversalPairId).toBe('new-movement-id');
    }
    // 2 insert (orig reversal + pair reversal)
    expect(insertImpl).toHaveBeenCalledTimes(2);
    // updates: 2 orijinali işaretle + 2 applyInventoryChange (her biri
    //   inventory update + product totalStockQty + olası auto-unpublish)
    expect(updateImpl.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('transfer reversal — hedef şube yetersiz (zaten satıldı) → insufficient_stock', async () => {
    const original = {
      id: MOVEMENT_ID,
      type: 'transfer',
      subtype: null,
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: -10,
      beforeQty: 20,
      afterQty: 10,
      createdAt: new Date(NOW.getTime() - 30 * 60 * 1000),
      reversedById: null,
      reversesId: null,
      transferGroupId: 'tg-2',
    };
    const pair = {
      id: 'pair-id',
      branchId: BRANCH_2,
      variantId: VARIANT,
      quantity: 10,
      reversedById: null,
      reversesId: null,
    };
    const select = makeSelectChain([
      [original],
      [pair],
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 5, // kaynak şu an 5
          inventoryRowId: 'inv-source',
        },
      ],
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 3, // hedefte 3 kaldı, ama 10 çıkarmaya çalışacağız → fail
          inventoryRowId: 'inv-target',
        },
      ],
    ]);
    const db = { select, transaction: vi.fn() } as unknown as DbClient;

    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
      {},
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient_stock');
      expect(result.meta?.available).toBe(3);
      expect(result.meta?.requested).toBe(10);
    }
  });

  it('transfer pair zaten reversed → already_reversed', async () => {
    const original = {
      id: MOVEMENT_ID,
      type: 'transfer',
      subtype: null,
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: -5,
      beforeQty: 10,
      afterQty: 5,
      createdAt: new Date(NOW.getTime() - 60 * 1000),
      reversedById: null,
      reversesId: null,
      transferGroupId: 'tg-3',
    };
    const pair = {
      id: 'pair-id',
      branchId: BRANCH_2,
      variantId: VARIANT,
      quantity: 5,
      reversedById: 'someone-reversed',
      reversesId: null,
    };
    const select = makeSelectChain([[original], [pair]]);
    const db = { select } as unknown as DbClient;

    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
      {},
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_reversed');
  });

  it('stok-in geri al — şube yetersiz (satılmış) → insufficient_stock', async () => {
    // Şube'de 10 girdi → 8 satıldı → şu an 2 var. Stok-in geri almaya çalışırsak
    // 10 çıkartmak isteriz; mevcut 2 yetersiz.
    const original = {
      id: MOVEMENT_ID,
      type: 'stock_in',
      subtype: null,
      branchId: BRANCH,
      variantId: VARIANT,
      quantity: 10,
      beforeQty: 0,
      afterQty: 10,
      createdAt: new Date(NOW.getTime() - 60 * 1000),
      reversedById: null,
      reversesId: null,
    };
    const select = makeSelectChain([
      [original],
      [
        {
          variantId: VARIANT,
          productId: PRODUCT,
          variantCompanyId: COMPANY,
          branchCompanyId: COMPANY,
          currentQty: 2,
          inventoryRowId: 'inv-1',
        },
      ],
    ]);
    const db = { select, transaction: vi.fn() } as unknown as DbClient;

    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
      {},
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient_stock');
      expect(result.meta?.available).toBe(2);
    }
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await reverseStockMovement(
      COMPANY,
      MOVEMENT_ID,
      USER,
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('REVERSAL_WINDOW_MS = 24 saat', () => {
    expect(REVERSAL_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────────────
// InsufficientStockError
// ─────────────────────────────────────────────────────────────────

describe('InsufficientStockError', () => {
  it('available/requested alanları + Türkçe mesaj', () => {
    const err = new InsufficientStockError(5, 10);
    expect(err.available).toBe(5);
    expect(err.requested).toBe(10);
    expect(err.message).toMatch(/yetersiz/i);
    expect(err.code).toBe('insufficient_stock');
  });
});
