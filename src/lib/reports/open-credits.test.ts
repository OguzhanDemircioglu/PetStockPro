import { describe, it, expect, vi } from 'vitest';
import {
  listOpenCredits,
  getOpenCreditsSummary,
  settleCredit,
} from './open-credits';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const USER = 'user-uuid';
const MOVEMENT = 'movement-uuid';
const NOW = new Date('2026-05-15T12:00:00Z');

// ─────────────────────────────────────────────────────────────────
// Mock helpers — thenable + chainable
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

function makeUpdateChain() {
  const setWhere = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: setWhere });
  const update = vi.fn().mockReturnValue({ set: setFn });
  return { update, setFn, setWhere };
}

function makeInsertChain() {
  const valuesFn = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values: valuesFn });
  return { insert, valuesFn };
}

// ─────────────────────────────────────────────────────────────────
// listOpenCredits
// ─────────────────────────────────────────────────────────────────

describe('listOpenCredits', () => {
  it('boş — boş array', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await listOpenCredits(COMPANY, db, { now: NOW });
    expect(result).toEqual([]);
  });

  it('happy — kayıtlar döner', async () => {
    const rows = [
      {
        movementId: 'm1',
        createdAt: new Date('2026-04-30T10:00:00Z'),
        daysOpen: 15,
        customerRef: 'Ayşe T. · 0532***1234',
        quantity: 2,
        unitPrice: '125.00',
        amount: '250.00',
        productName: 'Royal Canin',
        variantLabel: '2kg',
        sku: 'RC-2KG',
        branchId: 'b1',
        branchName: 'Merkez Şube',
      },
    ];
    const select = makeSelectChain([rows]);
    const db = { select } as unknown as DbClient;
    const result = await listOpenCredits(COMPANY, db, { now: NOW, limit: 10 });
    expect(result).toEqual(rows);
  });

  it('branchId filter chain çalışır', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await listOpenCredits(COMPANY, db, {
      now: NOW,
      branchId: 'branch-1',
    });
    expect(result).toEqual([]);
    expect(select).toHaveBeenCalled();
  });

  it('customerRef filter chain çalışır', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    await listOpenCredits(COMPANY, db, {
      now: NOW,
      customerRef: 'Mehmet',
    });
    expect(select).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────
// getOpenCreditsSummary
// ─────────────────────────────────────────────────────────────────

describe('getOpenCreditsSummary', () => {
  it('boş — sıfır default', async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const db = { execute } as unknown as DbClient;
    const result = await getOpenCreditsSummary(COMPANY, db, NOW);
    expect(result.totalCount).toBe(0);
    expect(result.totalAmount).toBe('0');
    expect(result.oldestDays).toBe(0);
    expect(result.byBand).toEqual([
      { label: '0-15', count: 0, amount: '0' },
      { label: '16-30', count: 0, amount: '0' },
      { label: '31-60', count: 0, amount: '0' },
      { label: '60+', count: 0, amount: '0' },
    ]);
  });

  it('dolu — band\'lara dağıtım', async () => {
    const execute = vi.fn().mockResolvedValue([
      {
        total_count: 12,
        total_amount: '3420.00',
        oldest_days: 47,
        band_0_15_count: 3,
        band_0_15_amount: '520.00',
        band_16_30_count: 4,
        band_16_30_amount: '1450.00',
        band_31_60_count: 4,
        band_31_60_amount: '1250.00',
        band_60_plus_count: 1,
        band_60_plus_amount: '200.00',
      },
    ]);
    const db = { execute } as unknown as DbClient;
    const result = await getOpenCreditsSummary(COMPANY, db, NOW);
    expect(result.totalCount).toBe(12);
    expect(result.totalAmount).toBe('3420.00');
    expect(result.oldestDays).toBe(47);
    expect(result.byBand).toEqual([
      { label: '0-15', count: 3, amount: '520.00' },
      { label: '16-30', count: 4, amount: '1450.00' },
      { label: '31-60', count: 4, amount: '1250.00' },
      { label: '60+', count: 1, amount: '200.00' },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────
// settleCredit
// ─────────────────────────────────────────────────────────────────

describe('settleCredit', () => {
  it('not_found — hareket yok', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await settleCredit(COMPANY, USER, MOVEMENT, db, { now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('not_credit — payment_method credit değil', async () => {
    const select = makeSelectChain([
      [
        {
          id: MOVEMENT,
          paymentMethod: 'cash',
          creditPaidAt: null,
          reversedById: null,
          reversesId: null,
          customerRef: 'Ali',
          quantity: -1,
          unitPrice: '100.00',
        },
      ],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await settleCredit(COMPANY, USER, MOVEMENT, db, { now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_credit');
  });

  it('already_settled — creditPaidAt dolu', async () => {
    const select = makeSelectChain([
      [
        {
          id: MOVEMENT,
          paymentMethod: 'credit',
          creditPaidAt: new Date('2026-05-10'),
          reversedById: null,
          reversesId: null,
          customerRef: 'Ali',
          quantity: -1,
          unitPrice: '100.00',
        },
      ],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await settleCredit(COMPANY, USER, MOVEMENT, db, { now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_settled');
  });

  it('reversed — reversedById set', async () => {
    const select = makeSelectChain([
      [
        {
          id: MOVEMENT,
          paymentMethod: 'credit',
          creditPaidAt: null,
          reversedById: 'rev-mov-id',
          reversesId: null,
          customerRef: 'Ali',
          quantity: -1,
          unitPrice: '100.00',
        },
      ],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await settleCredit(COMPANY, USER, MOVEMENT, db, { now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('reversed');
  });

  it('reversal kaydı — kapatılamaz', async () => {
    const select = makeSelectChain([
      [
        {
          id: MOVEMENT,
          paymentMethod: 'credit',
          creditPaidAt: null,
          reversedById: null,
          reversesId: 'orig-mov-id',
          customerRef: 'Ali',
          quantity: 1,
          unitPrice: '100.00',
        },
      ],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await settleCredit(COMPANY, USER, MOVEMENT, db, { now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('reversed');
  });

  it('happy — UPDATE + audit insert + paidAt=now', async () => {
    const select = makeSelectChain([
      [
        {
          id: MOVEMENT,
          paymentMethod: 'credit',
          creditPaidAt: null,
          reversedById: null,
          reversesId: null,
          customerRef: 'Ayşe T.',
          quantity: -2,
          unitPrice: '125.00',
        },
      ],
    ]);
    const upd = makeUpdateChain();
    const ins = makeInsertChain();
    const db = {
      select,
      update: upd.update,
      insert: ins.insert,
    } as unknown as DbClient;

    const result = await settleCredit(COMPANY, USER, MOVEMENT, db, {
      now: NOW,
      ipAddress: '127.0.0.1',
      userAgent: 'browser',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.movementId).toBe(MOVEMENT);
      expect(result.paidAt).toBe(NOW);
    }
    expect(upd.update).toHaveBeenCalledTimes(1);
    expect(upd.setFn).toHaveBeenCalledWith({ creditPaidAt: NOW });
    expect(ins.insert).toHaveBeenCalled(); // audit log
    const auditCall = ins.valuesFn.mock.calls[0][0];
    expect(auditCall.action).toBe('sale.credit_settled');
    expect(auditCall.entityType).toBe('stock_movement');
    expect(auditCall.entityId).toBe(MOVEMENT);
    expect(auditCall.ipAddress).toBe('127.0.0.1');
    expect(auditCall.userAgent).toBe('browser');
    const after = auditCall.afterState as Record<string, unknown>;
    expect(after.customerRef).toBe('Ayşe T.');
    expect(after.quantity).toBe(2); // ABS
    expect(after.unitPrice).toBe('125.00');
  });

  it('audit log fail sessiz — caller hâlâ ok=true', async () => {
    const select = makeSelectChain([
      [
        {
          id: MOVEMENT,
          paymentMethod: 'credit',
          creditPaidAt: null,
          reversedById: null,
          reversesId: null,
          customerRef: 'Ali',
          quantity: -1,
          unitPrice: '50.00',
        },
      ],
    ]);
    const upd = makeUpdateChain();
    // insert throw — audit log fail
    const insert = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('db down')),
    });
    const db = {
      select,
      update: upd.update,
      insert,
    } as unknown as DbClient;

    const result = await settleCredit(COMPANY, USER, MOVEMENT, db, { now: NOW });
    expect(result.ok).toBe(true);
  });

  it('select throw — unknown reason', async () => {
    const select = vi.fn().mockImplementation(() => {
      throw new Error('connection lost');
    });
    const db = { select } as unknown as DbClient;
    const result = await settleCredit(COMPANY, USER, MOVEMENT, db, { now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });
});
