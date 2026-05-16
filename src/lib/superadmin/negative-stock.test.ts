import { describe, it, expect, vi } from 'vitest';
import { forceNegativeStockOut, forceNegativeStockSchema } from './negative-stock';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const BRANCH = '33333333-3333-3333-3333-333333333333';
const VARIANT = '44444444-4444-4444-4444-444444444444';
const NOW = new Date('2026-05-16T10:00:00Z');

function makeMockDb(opts: {
  variantRow?: {
    variantId: string;
    productId: string;
    inventoryRowId: string | null;
    currentQty: number | null;
  } | null;
  txShouldThrow?: boolean;
  insertedMovementId?: string;
}) {
  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      innerJoin: vi.fn().mockImplementation(() => chain),
      leftJoin: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(opts.variantRow ? [opts.variantRow] : []),
    };
    return chain;
  });

  const transaction = vi.fn().mockImplementation(async (fn) => {
    if (opts.txShouldThrow) throw new Error('tx fail');
    const tx = {
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation(() => {
          const p = Promise.resolve();
          return Object.assign(p, {
            returning: vi.fn().mockResolvedValue([{ id: opts.insertedMovementId ?? 'mov-id' }]),
          });
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    };
    return await fn(tx as unknown as DbClient);
  });

  return { select, transaction } as unknown as DbClient;
}

describe('forceNegativeStockSchema', () => {
  it('valid input kabul', () => {
    expect(
      forceNegativeStockSchema.safeParse({
        branchId: BRANCH,
        variantId: VARIANT,
        quantity: 5,
      }).success,
    ).toBe(true);
  });

  it('quantity negatif/sıfır reject', () => {
    expect(
      forceNegativeStockSchema.safeParse({ branchId: BRANCH, variantId: VARIANT, quantity: 0 }).success,
    ).toBe(false);
    expect(
      forceNegativeStockSchema.safeParse({ branchId: BRANCH, variantId: VARIANT, quantity: -3 }).success,
    ).toBe(false);
  });

  it('branchId non-uuid reject', () => {
    expect(
      forceNegativeStockSchema.safeParse({ branchId: 'x', variantId: VARIANT, quantity: 1 }).success,
    ).toBe(false);
  });
});

describe('forceNegativeStockOut', () => {
  it('invalid input → invalid_input + issues', async () => {
    const db = makeMockDb({});
    const r = await forceNegativeStockOut(
      COMPANY,
      USER,
      { branchId: 'x', variantId: VARIANT, quantity: 1 },
      'test sebep yeterli uzunlukta',
      db,
    );
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'invalid_input') {
      expect(r.issues.length).toBeGreaterThan(0);
    } else throw new Error('expected invalid_input');
  });

  it('variant/branch bulunamadı (başka tenant) → not_found', async () => {
    const db = makeMockDb({ variantRow: null });
    const r = await forceNegativeStockOut(
      COMPANY,
      USER,
      { branchId: BRANCH, variantId: VARIANT, quantity: 5 },
      'test sebep yeterli uzunlukta',
      db,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('happy path — stock 3 ten -2 ye duser (5 quantity)', async () => {
    const db = makeMockDb({
      variantRow: {
        variantId: VARIANT,
        productId: 'prod-1',
        inventoryRowId: 'inv-1',
        currentQty: 3,
      },
    });
    const r = await forceNegativeStockOut(
      COMPANY,
      USER,
      { branchId: BRANCH, variantId: VARIANT, quantity: 5 },
      'Sayım sırasında kaybolan mama düzeltmesi — sistem kaydı düşürülmesi gerek',
      db,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.beforeQty).toBe(3);
      expect(r.afterQty).toBe(-2);
    }
  });

  it('inventoryRowId null (ilk hareket) → currentQty 0 → afterQty -5', async () => {
    const db = makeMockDb({
      variantRow: {
        variantId: VARIANT,
        productId: 'prod-1',
        inventoryRowId: null,
        currentQty: null,
      },
    });
    const r = await forceNegativeStockOut(
      COMPANY,
      USER,
      { branchId: BRANCH, variantId: VARIANT, quantity: 5 },
      'İlk inventory satırı negatif değerle oluşur',
      db,
      NOW,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.beforeQty).toBe(0);
      expect(r.afterQty).toBe(-5);
    }
  });

  it('transaction throw → unknown', async () => {
    const db = makeMockDb({
      variantRow: {
        variantId: VARIANT,
        productId: 'prod-1',
        inventoryRowId: 'inv-1',
        currentQty: 5,
      },
      txShouldThrow: true,
    });
    const r = await forceNegativeStockOut(
      COMPANY,
      USER,
      { branchId: BRANCH, variantId: VARIANT, quantity: 3 },
      'tx hata simülasyonu test sebep',
      db,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown');
  });
});
