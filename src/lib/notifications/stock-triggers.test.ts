import { describe, it, expect, vi } from 'vitest';
import { checkAndNotifyStockChange } from './stock-triggers';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const BRANCH = '22222222-2222-2222-2222-222222222222';
const VARIANT = '33333333-3333-3333-3333-333333333333';

function makeMockDb(variantInfo: {
  productName: string;
  variantLabel: string;
  threshold: number;
  branchThresholds?: Record<string, number> | null;
  branchName: string | null;
} | null) {
  const insertedNotifications: Record<string, unknown>[] = [];

  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      innerJoin: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(variantInfo ? [variantInfo] : []),
    };
    return chain;
  });

  const insert = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      insertedNotifications.push(vals);
      const promise = Promise.resolve();
      return Object.assign(promise, {
        returning: vi.fn().mockResolvedValue([{ id: 'notif-id' }]),
      });
    }),
  }));

  return {
    db: { select, insert } as unknown as DbClient,
    insertedNotifications,
  };
}

describe('checkAndNotifyStockChange — out_of_stock', () => {
  it('beforeQty > 0 & afterQty == 0 → out_of_stock notif tetiklenir', async () => {
    const { db, insertedNotifications } = makeMockDb({
      productName: 'Royal Canin',
      variantLabel: '2kg',
      threshold: 5,
      branchName: 'Merkez',
    });

    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 3,
      afterQty: 0,
      db,
    });
    // Async fire-and-forget — wait microtask
    await new Promise((r) => setTimeout(r, 50));

    expect(insertedNotifications).toHaveLength(1);
    expect(insertedNotifications[0]).toMatchObject({
      companyId: COMPANY,
      type: 'out_of_stock',
    });
    const content = insertedNotifications[0].content as Record<string, unknown>;
    expect(content.title).toContain('Stok bitti');
    expect(content.title).toContain('Royal Canin');
    expect(content.link).toBe('/admin/low-stock');
  });

  it('zaten 0 ise (beforeQty 0 → afterQty 0) → notif yok', async () => {
    const { db, insertedNotifications } = makeMockDb({
      productName: 'X',
      variantLabel: 'Y',
      threshold: 5,
      branchName: 'M',
    });
    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 0,
      afterQty: 0,
      db,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(insertedNotifications).toHaveLength(0);
  });
});

describe('checkAndNotifyStockChange — low_stock_critical', () => {
  it('threshold geçişi → low_stock_critical notif', async () => {
    const { db, insertedNotifications } = makeMockDb({
      productName: 'Whiskas',
      variantLabel: '400g',
      threshold: 5,
      branchName: 'Şube 2',
    });
    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 8,
      afterQty: 3,
      db,
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(insertedNotifications).toHaveLength(1);
    expect(insertedNotifications[0]).toMatchObject({ type: 'low_stock_critical' });
    const content = insertedNotifications[0].content as Record<string, unknown>;
    expect(content.title).toContain('Düşük stok');
    expect(content.body).toContain('3/5');
  });

  it('threshold zaten altıdaysa → notif yok (transition yok)', async () => {
    const { db, insertedNotifications } = makeMockDb({
      productName: 'X',
      variantLabel: 'Y',
      threshold: 5,
      branchName: 'M',
    });
    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 4,
      afterQty: 3,
      db,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(insertedNotifications).toHaveLength(0);
  });

  it('threshold üstünde kaldıysa → notif yok', async () => {
    const { db, insertedNotifications } = makeMockDb({
      productName: 'X',
      variantLabel: 'Y',
      threshold: 5,
      branchName: 'M',
    });
    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 10,
      afterQty: 8,
      db,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(insertedNotifications).toHaveLength(0);
  });

  it('branchThresholds[branchId] varsa o şubenin özel threshold\'u kullanılır', async () => {
    const { db, insertedNotifications } = makeMockDb({
      productName: 'X',
      variantLabel: 'Y',
      threshold: 5,
      branchThresholds: { [BRANCH]: 20 }, // özel threshold = 20
      branchName: 'Premium',
    });
    // beforeQty 25 > 20, afterQty 18 <= 20 → trigger
    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 25,
      afterQty: 18,
      db,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(insertedNotifications).toHaveLength(1);
    expect(insertedNotifications[0].type).toBe('low_stock_critical');
  });
});

describe('checkAndNotifyStockChange — vitrin_auto_unpublished', () => {
  it('out_of_stock + product.vitrinAutoUnpublishedAt set → 2 notif (out_of_stock + vitrin_auto_unpublished)', async () => {
    // Bu kompleks senaryo iki ayrı DB lookup yapar: variant info + product
    // auto-unpublish. Mock DB iki sequential select yanıtlayacak.
    const movementTime = new Date('2026-05-16T10:00:00Z');
    const variantInfo = {
      productName: 'Test Ürün',
      variantLabel: '2kg',
      threshold: 5,
      branchThresholds: null,
      branchName: 'Merkez',
    };
    const autoUnpubInfo = {
      productId: 'prod-1',
      productName: 'Test Ürün',
      vitrinAutoUnpublishedAt: movementTime,
      vitrinAutoUnpublishedReason: 'stock_zero',
    };
    const inserted: Record<string, unknown>[] = [];
    let selectCount = 0;
    const select = vi.fn().mockImplementation(() => {
      const chain = {
        from: vi.fn().mockImplementation(() => chain),
        innerJoin: vi.fn().mockImplementation(() => chain),
        where: vi.fn().mockImplementation(() => chain),
        limit: vi.fn().mockImplementation(() => {
          selectCount++;
          return Promise.resolve(selectCount === 1 ? [variantInfo] : [autoUnpubInfo]);
        }),
      };
      return chain;
    });
    const insert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        inserted.push(v);
        const p = Promise.resolve();
        return Object.assign(p, { returning: vi.fn().mockResolvedValue([{ id: 'n' }]) });
      }),
    }));
    const db = { select, insert } as unknown as DbClient;

    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 3,
      afterQty: 0,
      movementCreatedAt: movementTime,
      db,
    });
    await new Promise((r) => setTimeout(r, 100));

    const types = inserted.map((i) => i.type);
    expect(types).toContain('out_of_stock');
    expect(types).toContain('vitrin_auto_unpublished');
    const vitrinNotif = inserted.find((i) => i.type === 'vitrin_auto_unpublished');
    expect((vitrinNotif?.content as Record<string, unknown>).title).toContain("Vitrin'den çekildi");
    expect((vitrinNotif?.content as Record<string, unknown>).link).toBe('/admin/products/prod-1');
  });

  it('out_of_stock ama product auto-unpublish yok → sadece out_of_stock notif', async () => {
    const variantInfo = {
      productName: 'X',
      variantLabel: 'Y',
      threshold: 5,
      branchName: 'M',
    };
    const inserted: Record<string, unknown>[] = [];
    let selectCount = 0;
    const select = vi.fn().mockImplementation(() => {
      const chain = {
        from: vi.fn().mockImplementation(() => chain),
        innerJoin: vi.fn().mockImplementation(() => chain),
        where: vi.fn().mockImplementation(() => chain),
        limit: vi.fn().mockImplementation(() => {
          selectCount++;
          return Promise.resolve(selectCount === 1 ? [variantInfo] : []);
        }),
      };
      return chain;
    });
    const insert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        inserted.push(v);
        return Object.assign(Promise.resolve(), {
          returning: vi.fn().mockResolvedValue([{ id: 'n' }]),
        });
      }),
    }));
    const db = { select, insert } as unknown as DbClient;

    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 3,
      afterQty: 0,
      movementCreatedAt: new Date(),
      db,
    });
    await new Promise((r) => setTimeout(r, 100));

    const types = inserted.map((i) => i.type);
    expect(types).toContain('out_of_stock');
    expect(types).not.toContain('vitrin_auto_unpublished');
  });
});

describe('checkAndNotifyStockChange — guards', () => {
  it('artış yönlü hareket → notif yok', async () => {
    const { db, insertedNotifications } = makeMockDb({
      productName: 'X',
      variantLabel: 'Y',
      threshold: 5,
      branchName: 'M',
    });
    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 3,
      afterQty: 10,
      db,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(insertedNotifications).toHaveLength(0);
  });

  it('variant tenant\'a ait değil (lookup null) → notif yok', async () => {
    const { db, insertedNotifications } = makeMockDb(null);
    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 5,
      afterQty: 0,
      db,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(insertedNotifications).toHaveLength(0);
  });

  it('threshold 0 → low_stock notif atılmaz (variant takip dışı)', async () => {
    const { db, insertedNotifications } = makeMockDb({
      productName: 'X',
      variantLabel: 'Y',
      threshold: 0,
      branchName: 'M',
    });
    await checkAndNotifyStockChange({
      companyId: COMPANY,
      branchId: BRANCH,
      variantId: VARIANT,
      beforeQty: 5,
      afterQty: 1,
      db,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(insertedNotifications).toHaveLength(0);
  });
});
