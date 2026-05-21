import { describe, it, expect, vi } from 'vitest';
import {
  validateForStorefront,
  publishProduct,
  unpublishProduct,
} from './storefront';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const PRODUCT = 'product-uuid';
const USER = 'user-uuid';
const NOW = new Date('2026-05-15T12:00:00Z');

// ─────────────────────────────────────────────────────────────────
// Thenable + chainable select mock (Drizzle pattern)
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

const VALID_ROW = {
  productId: PRODUCT,
  isActive: true,
  categoryId: 'cat-1',
  vitrinPublished: false,
  companyVatNo: '1234567890',
  activeVariantCount: 2,
  minSalePrice: '180.50',
  maxSalePrice: '3499.00',
  // Sprint 3.3 — image upload aktif, default requireImage=true.
  // VALID_ROW her testte happy path için en az 1 görsel olmalı.
  imageCount: 1,
};

// ─────────────────────────────────────────────────────────────────
// validateForStorefront
// ─────────────────────────────────────────────────────────────────

describe('validateForStorefront', () => {
  it('happy path — tüm kriterler tamam, ok=true', async () => {
    const select = makeSelectChain([[VALID_ROW]]);
    const db = { select } as unknown as DbClient;

    const result = await validateForStorefront(COMPANY, PRODUCT, db);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.meta.hasVatNo).toBe(true);
    expect(result.meta.activeVariantCount).toBe(2);
  });

  it('ürün yoksa product_inactive issue + meta zero', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await validateForStorefront(COMPANY, PRODUCT, db);
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe('product_inactive');
    expect(result.meta.activeVariantCount).toBe(0);
    expect(result.meta.imageCount).toBe(0);
  });

  it('vergi no eksikse missing_vat_no', async () => {
    const select = makeSelectChain([[{ ...VALID_ROW, companyVatNo: null }]]);
    const db = { select } as unknown as DbClient;

    const result = await validateForStorefront(COMPANY, PRODUCT, db);
    expect(result.issues.some((i) => i.code === 'missing_vat_no')).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('vergi no <10 hane reddedilir (kısa hatalı VKN)', async () => {
    const select = makeSelectChain([[{ ...VALID_ROW, companyVatNo: '123' }]]);
    const db = { select } as unknown as DbClient;

    const result = await validateForStorefront(COMPANY, PRODUCT, db);
    expect(result.issues.some((i) => i.code === 'missing_vat_no')).toBe(true);
  });

  it('ürün pasifse product_inactive', async () => {
    const select = makeSelectChain([[{ ...VALID_ROW, isActive: false }]]);
    const db = { select } as unknown as DbClient;

    const result = await validateForStorefront(COMPANY, PRODUCT, db);
    expect(result.issues.some((i) => i.code === 'product_inactive')).toBe(true);
  });

  it('kategori yoksa missing_category', async () => {
    const select = makeSelectChain([[{ ...VALID_ROW, categoryId: null }]]);
    const db = { select } as unknown as DbClient;

    const result = await validateForStorefront(COMPANY, PRODUCT, db);
    expect(result.issues.some((i) => i.code === 'missing_category')).toBe(true);
  });

  it('aktif variant yoksa no_active_variant + invalid_sale_price tetiklenmez', async () => {
    const select = makeSelectChain([
      [
        {
          ...VALID_ROW,
          activeVariantCount: 0,
          minSalePrice: null,
          maxSalePrice: null,
        },
      ],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await validateForStorefront(COMPANY, PRODUCT, db);
    expect(result.issues.some((i) => i.code === 'no_active_variant')).toBe(true);
    expect(result.issues.some((i) => i.code === 'invalid_sale_price')).toBe(false);
  });

  it('fiyat 1₺ altında ise invalid_sale_price', async () => {
    const select = makeSelectChain([
      [{ ...VALID_ROW, minSalePrice: '0.50', maxSalePrice: '0.99' }],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await validateForStorefront(COMPANY, PRODUCT, db);
    expect(result.issues.some((i) => i.code === 'invalid_sale_price')).toBe(true);
  });

  it('fiyat 50000₺ üstündeyse invalid_sale_price', async () => {
    const select = makeSelectChain([
      [{ ...VALID_ROW, minSalePrice: '60000', maxSalePrice: '70000' }],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await validateForStorefront(COMPANY, PRODUCT, db);
    expect(result.issues.some((i) => i.code === 'invalid_sale_price')).toBe(true);
  });

  it('requireImage true (default) + imageCount 0 → missing_image issue', async () => {
    const select = makeSelectChain([[{ ...VALID_ROW, imageCount: 0 }]]);
    const db = { select } as unknown as DbClient;

    // Sprint 3.3 — default requireImage=true (opts geçmeden).
    const result = await validateForStorefront(COMPANY, PRODUCT, db);
    expect(result.issues.some((i) => i.code === 'missing_image')).toBe(true);
  });

  it('requireImage false override + imageCount 0 → missing_image YOK', async () => {
    const select = makeSelectChain([[{ ...VALID_ROW, imageCount: 0 }]]);
    const db = { select } as unknown as DbClient;

    // Explicit false override — test/önizleme senaryosu.
    const result = await validateForStorefront(COMPANY, PRODUCT, db, {
      requireImage: false,
    });
    expect(result.issues.some((i) => i.code === 'missing_image')).toBe(false);
  });

  it('opts.minSalePrice/maxSalePrice override edilebilir', async () => {
    const select = makeSelectChain([
      [{ ...VALID_ROW, minSalePrice: '500', maxSalePrice: '500' }],
    ]);
    const db = { select } as unknown as DbClient;

    // min 1000 zorunlu — 500 fail
    const result = await validateForStorefront(COMPANY, PRODUCT, db, {
      minSalePrice: 1000,
    });
    expect(result.issues.some((i) => i.code === 'invalid_sale_price')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// publishProduct
// ─────────────────────────────────────────────────────────────────

describe('publishProduct', () => {
  it('happy path — validation pass + zaten yayında değil → update', async () => {
    const select = makeSelectChain([
      [VALID_ROW], // validate
      [{ vitrinPublished: false }], // current check
    ]);
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const db = { select, update } as unknown as DbClient;

    const result = await publishProduct(COMPANY, PRODUCT, USER, db, {}, NOW);
    expect(result).toEqual({ ok: true, alreadyPublished: false });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('zaten yayında → idempotent alreadyPublished=true, update çağrılmaz', async () => {
    const select = makeSelectChain([
      [VALID_ROW],
      [{ vitrinPublished: true }],
    ]);
    const update = vi.fn();
    const db = { select, update } as unknown as DbClient;

    const result = await publishProduct(COMPANY, PRODUCT, USER, db);
    expect(result).toEqual({ ok: true, alreadyPublished: true });
    expect(update).not.toHaveBeenCalled();
  });

  it('validation fail → validation_failed + issues', async () => {
    const select = makeSelectChain([
      [{ ...VALID_ROW, companyVatNo: null }],
    ]);
    const db = { select } as unknown as DbClient;

    const result = await publishProduct(COMPANY, PRODUCT, USER, db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('validation_failed');
      expect(result.issues?.some((i) => i.code === 'missing_vat_no')).toBe(true);
    }
  });

  it('ürün yoksa not_found döner', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await publishProduct(COMPANY, PRODUCT, USER, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});

// ─────────────────────────────────────────────────────────────────
// unpublishProduct
// ─────────────────────────────────────────────────────────────────

describe('unpublishProduct', () => {
  it('happy path — yayında → kapatılır + reason=manual', async () => {
    const select = makeSelectChain([
      [{ id: PRODUCT, vitrinPublished: true }],
    ]);
    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;

    const result = await unpublishProduct(COMPANY, PRODUCT, db, NOW);
    expect(result).toEqual({ ok: true, alreadyUnpublished: false });
    expect(update).toHaveBeenCalledTimes(1);
    const setArgs = setFn.mock.calls[0][0];
    expect(setArgs.vitrinPublished).toBe(false);
    expect(setArgs.vitrinAutoUnpublishedReason).toBe('manual');
    expect(setArgs.vitrinAutoUnpublishedAt).toEqual(NOW);
  });

  it('zaten kapalıysa idempotent alreadyUnpublished=true', async () => {
    const select = makeSelectChain([
      [{ id: PRODUCT, vitrinPublished: false }],
    ]);
    const update = vi.fn();
    const db = { select, update } as unknown as DbClient;

    const result = await unpublishProduct(COMPANY, PRODUCT, db);
    expect(result).toEqual({ ok: true, alreadyUnpublished: true });
    expect(update).not.toHaveBeenCalled();
  });

  it('ürün yoksa not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;

    const result = await unpublishProduct(COMPANY, PRODUCT, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });
});
