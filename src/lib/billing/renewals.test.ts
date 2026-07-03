import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/audit/log', () => ({ writeAuditLog: vi.fn(), writeAuditLogAsync: vi.fn() }));

import { runBillingRenewals } from './renewals';
import { subscriptions, companies, users } from '@/db/schema';
import { PLAN_LIMITS } from '@/lib/constants/plan-limits';

interface DueRow {
  id: string;
  companyId: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  pendingPlan: 'FREE' | 'PRO' | 'PRO_PLUS' | null;
  amountTry: string;
  paytrUtoken: string | null;
  paytrCtoken: string | null;
  pendingMerchantOid: string | null;
  ownerEmail: string | null;
  companyName: string | null;
  whatsappPhone: string | null;
}

function dueRow(over: Partial<DueRow> = {}): DueRow {
  return {
    id: 'sub-1',
    companyId: 'comp-1',
    plan: 'PRO',
    pendingPlan: null,
    amountTry: '1000.00',
    paytrUtoken: 'utok-1',
    paytrCtoken: 'ctok-1',
    pendingMerchantOid: null,
    ownerEmail: 'owner@pet.com',
    companyName: 'Pet A',
    whatsappPhone: '+905551112233',
    ...over,
  };
}

function makeDb(config: { dueRows?: DueRow[]; expireRows?: { id: string; companyId: string }[] }) {
  const calls = { updates: [] as { table: string; vals: Record<string, unknown> }[] };
  function tableLabel(t: unknown): string {
    return t === subscriptions ? 'subscriptions' : t === companies ? 'companies' : 'other';
  }
  function selectBuilder() {
    let fromTable: unknown = null;
    // Due-query ile expire-query'i ayırt et: yalnızca findDueSubscriptions `.for('update')`
    // çağırır. (Her ikisi de artık companies leftJoin'ler — deletedAt guard — bu yüzden
    // join varlığı ayırt edici DEĞİL.)
    let usedFor = false;
    const b: Record<string, unknown> = {
      from(t: unknown) {
        fromTable = t;
        return b;
      },
      leftJoin() {
        return b;
      },
      innerJoin() {
        return b;
      },
      where() {
        return b;
      },
      orderBy() {
        return b;
      },
      for() {
        usedFor = true;
        return b;
      },
      limit() {
        if (fromTable === users) {
          return Promise.resolve([{ userId: 'owner-1', email: 'owner@pet.com', companyName: 'Pet A' }]);
        }
        return Promise.resolve([]);
      },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
        let result: unknown[] = [];
        if (fromTable === subscriptions) {
          result = usedFor ? (config.dueRows ?? []) : (config.expireRows ?? []);
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return b;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: () => selectBuilder(),
    update(table: unknown) {
      return {
        set(vals: Record<string, unknown>) {
          return {
            where() {
              calls.updates.push({ table: tableLabel(table), vals });
              return Promise.resolve();
            },
          };
        },
      };
    },
    // H1: claim transaction — aynı mock db'yi tx olarak geçir (select/update aynı).
    transaction<T>(cb: (tx: unknown) => Promise<T>): Promise<T> {
      return cb(db);
    },
  };
  return { db, calls };
}

const now = () => new Date('2026-06-10T12:00:00.000Z');

describe('runBillingRenewals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('due + expire yoksa → hepsi 0', async () => {
    const { db } = makeDb({});
    const summary = await runBillingRenewals({ db, now });
    expect(summary).toEqual({
      due: 0,
      renewed: 0,
      failed: 0,
      waitCallback: 0,
      expired: 0,
      errors: 0,
      skippedInFlight: 0,
    });
  });

  it('C4: pendingMerchantOid set (in-flight) → çekme atlanır, skippedInFlight 1', async () => {
    const { db } = makeDb({ dueRows: [dueRow({ pendingMerchantOid: 'PSP-inflight' })] });
    const charge = vi.fn();
    const processCallback = vi.fn();

    const summary = await runBillingRenewals({ db, charge, processCallback, now });

    expect(summary.skippedInFlight).toBe(1);
    expect(summary.due).toBe(0); // claim edilmedi
    expect(charge).not.toHaveBeenCalled();
  });

  it('H2: pendingPlan set → yeni plan fiyatı çekilir (snapshot DEĞİL, PLAN_LIMITS)', async () => {
    // amountTry eski plan snapshot'ı AMA pendingPlan=PRO_PLUS → PLAN_LIMITS.PRO_PLUS fiyatı kullanılır.
    const { db } = makeDb({ dueRows: [dueRow({ plan: 'PRO', pendingPlan: 'PRO_PLUS', amountTry: '500.00' })] });
    const charge = vi.fn().mockResolvedValue({ status: 'success' });
    const processCallback = vi.fn().mockResolvedValue({ outcome: 'payment_succeeded' });

    await runBillingRenewals({ db, charge, processCallback, now });

    // Fiyat-agnostik: PLAN_LIMITS.PRO_PLUS.priceMonthlyTry × 100 kuruş — amountTry snapshot'ı DEĞİL.
    expect(charge.mock.calls[0][0].paymentAmount).toBe(Math.round(PLAN_LIMITS.PRO_PLUS.priceMonthlyTry * 100));
  });

  it('active due + charge success → renewed 1 + processCallback success', async () => {
    const { db } = makeDb({ dueRows: [dueRow()] });
    const charge = vi.fn().mockResolvedValue({ status: 'success' });
    const processCallback = vi.fn().mockResolvedValue({ outcome: 'payment_succeeded' });

    const summary = await runBillingRenewals({ db, charge, processCallback, now });

    expect(summary.renewed).toBe(1);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(charge.mock.calls[0][0].ctoken).toBe('ctok-1');
    expect(charge.mock.calls[0][0].paymentAmount).toBe(100000);
    expect(processCallback.mock.calls[0][0].status).toBe('success');
    expect(processCallback.mock.calls[0][0].totalAmount).toBe('100000');
  });

  it('charge failed → failed 1 + processCallback failed', async () => {
    const { db } = makeDb({ dueRows: [dueRow()] });
    const charge = vi.fn().mockResolvedValue({ status: 'failed', err_msg: 'yetersiz bakiye' });
    const processCallback = vi.fn().mockResolvedValue({ outcome: 'payment_failed' });

    const summary = await runBillingRenewals({ db, charge, processCallback, now });

    expect(summary.failed).toBe(1);
    expect(processCallback.mock.calls[0][0].status).toBe('failed');
    expect(processCallback.mock.calls[0][0].failedReason).toBe('yetersiz bakiye');
  });

  it('wait_callback → waitCallback 1, processCallback çağrılmaz', async () => {
    const { db } = makeDb({ dueRows: [dueRow()] });
    const charge = vi.fn().mockResolvedValue({ status: 'wait_callback' });
    const processCallback = vi.fn();

    const summary = await runBillingRenewals({ db, charge, processCallback, now });

    expect(summary.waitCallback).toBe(1);
    expect(processCallback).not.toHaveBeenCalled();
  });

  it('ctoken yok + utoken yok → saklı kart yok → failed (charge çağrılmaz)', async () => {
    const { db } = makeDb({ dueRows: [dueRow({ paytrCtoken: null, paytrUtoken: null })] });
    const charge = vi.fn();
    const listCards = vi.fn();
    const processCallback = vi.fn().mockResolvedValue({ outcome: 'payment_failed' });

    const summary = await runBillingRenewals({ db, charge, listCards, processCallback, now });

    expect(summary.failed).toBe(1);
    expect(charge).not.toHaveBeenCalled();
    expect(processCallback.mock.calls[0][0].failedReason).toBe('no_saved_card');
  });

  it('ctoken yok ama utoken var → listSavedCards ile ctoken çekilir', async () => {
    const { db } = makeDb({ dueRows: [dueRow({ paytrCtoken: null, paytrUtoken: 'utok-9' })] });
    const listCards = vi.fn().mockResolvedValue([{ ctoken: 'ctok-fetched' }]);
    const charge = vi.fn().mockResolvedValue({ status: 'success' });
    const processCallback = vi.fn().mockResolvedValue({ outcome: 'payment_succeeded' });

    const summary = await runBillingRenewals({ db, charge, listCards, processCallback, now });

    expect(listCards).toHaveBeenCalledWith('utok-9');
    expect(charge.mock.calls[0][0].ctoken).toBe('ctok-fetched');
    expect(summary.renewed).toBe(1);
  });

  it('expire: süresi dolan abonelik → expired + company FREE', async () => {
    const { db, calls } = makeDb({ expireRows: [{ id: 'sub-e', companyId: 'comp-e' }] });
    const summary = await runBillingRenewals({ db, now });

    expect(summary.expired).toBe(1);
    const subUpd = calls.updates.find((u) => u.table === 'subscriptions');
    expect(subUpd?.vals.status).toBe('expired');
    const compUpd = calls.updates.find((u) => u.table === 'companies');
    expect(compUpd?.vals.plan).toBe('FREE');
  });

  it('bir abonelik hata verse diğerleri devam eder (errors izole)', async () => {
    const { db } = makeDb({ dueRows: [dueRow({ id: 'sub-a' }), dueRow({ id: 'sub-b' })] });
    const charge = vi
      .fn()
      .mockRejectedValueOnce(new Error('PayTR down'))
      .mockResolvedValueOnce({ status: 'success' });
    const processCallback = vi.fn().mockResolvedValue({ outcome: 'payment_succeeded' });

    const summary = await runBillingRenewals({ db, charge, processCallback, now });

    expect(summary.due).toBe(2);
    expect(summary.errors).toBe(1);
    expect(summary.renewed).toBe(1);
  });
});
