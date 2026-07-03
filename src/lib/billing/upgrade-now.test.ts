import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/audit/log', () => ({ writeAuditLog: vi.fn(), writeAuditLogAsync: vi.fn() }));

import { previewUpgradeNow, upgradeSubscriptionNow, startUpgradeCheckout } from './upgrade-now';
import { subscriptions, companies, users, invoices } from '@/db/schema';
import { PLAN_LIMITS } from '@/lib/constants/plan-limits';
import type { PaytrChargeResponse } from '@/lib/paytr/types';

// Fiyatlar PLAN_LIMITS'ten canlı okunur — şu an geçici test fiyatları (10/20₺, bkz.
// plan-limits.ts yorumları); "gerçek" fiyatlara (1000/2000) dönünce test kırılmaz.
const PRO_PRICE = PLAN_LIMITS.PRO.priceMonthlyTry;
const PRO_PLUS_PRICE = PLAN_LIMITS.PRO_PLUS.priceMonthlyTry;
const DIFF = PRO_PLUS_PRICE - PRO_PRICE;

const NOW = new Date('2026-07-16T00:00:00.000Z'); // 15 gün kaldı (30 günlük dönem, tam yarı)
const now = () => NOW;
// (PRO_PLUS-PRO) * (15/30) — dönemin tam ortasında farkın yarısı
const HALF_PRORATION = Math.round(DIFF * 0.5 * 100) / 100;

interface SubRow {
  id: string;
  plan: 'PRO' | 'PRO_PLUS';
  amountTry: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  paytrUtoken: string | null;
  paytrCtoken: string | null;
  companyName: string | null;
  whatsappPhone: string | null;
  ownerEmail: string | null;
}

function subRow(over: Partial<SubRow> = {}): SubRow {
  return {
    id: 'sub-1',
    plan: 'PRO',
    amountTry: PRO_PRICE.toFixed(2),
    currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-07-31T00:00:00.000Z'),
    paytrUtoken: 'utok-1',
    paytrCtoken: 'ctok-1',
    companyName: 'Pati Shop',
    whatsappPhone: '+905551112233',
    ownerEmail: 'owner@pati.com',
    ...over,
  };
}

interface DbConfig {
  subRow?: SubRow | null;
  invoiceId?: string;
  /** loadInvoiceCustomer'ın select'inin döneceği satır — undefined ise boş (customer null). */
  companyRow?: { name: string; vatNo: string | null; billingAddress: null; cityName: null; districtName: null; email: string | null } | null;
}

function makeDb(config: DbConfig) {
  const calls = {
    subUpdates: [] as Record<string, unknown>[],
    companyUpdates: [] as Record<string, unknown>[],
    invoiceUpdates: [] as Record<string, unknown>[],
    invoiceInserts: [] as Record<string, unknown>[],
  };

  function selectChain(table: unknown) {
    const chain: Record<string, unknown> = {
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit() {
        if (table === subscriptions) return Promise.resolve(config.subRow ? [config.subRow] : []);
        if (table === users) return Promise.resolve([{ id: 'owner-1' }]);
        if (table === companies) return Promise.resolve(config.companyRow ? [config.companyRow] : []);
        return Promise.resolve([]);
      },
    };
    return chain;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: () => ({ from: (table: unknown) => selectChain(table) }),
    update(table: unknown) {
      return {
        set(vals: Record<string, unknown>) {
          return {
            where() {
              if (table === subscriptions) calls.subUpdates.push(vals);
              else if (table === companies) calls.companyUpdates.push(vals);
              else if (table === invoices) calls.invoiceUpdates.push(vals);
              return Promise.resolve();
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(vals: Record<string, unknown>) {
          if (table === invoices) {
            calls.invoiceInserts.push(vals);
            return { returning: () => Promise.resolve([{ id: config.invoiceId ?? 'inv-1' }]) };
          }
          return Promise.resolve();
        },
      };
    },
  };
  db.transaction = (fn: (tx: unknown) => unknown) => fn(db);
  return { db, calls };
}

function chargeResp(over: Partial<PaytrChargeResponse> = {}): PaytrChargeResponse {
  return { status: 'success', ...over };
}

describe('previewUpgradeNow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aktif abonelik yoksa → not_found', async () => {
    const { db } = makeDb({ subRow: null });
    const res = await previewUpgradeNow('comp-1', 'PRO_PLUS', db, { now });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });

  it('zaten hedef plandaysa → same_plan', async () => {
    const { db } = makeDb({ subRow: subRow({ plan: 'PRO_PLUS' }) });
    const res = await previewUpgradeNow('comp-1', 'PRO_PLUS', db, { now });
    expect(res).toEqual({ ok: false, reason: 'same_plan' });
  });

  it('hedef fiyat mevcuttan düşük/eşitse (downgrade) → not_upgrade', async () => {
    const { db } = makeDb({ subRow: subRow({ plan: 'PRO_PLUS', amountTry: PRO_PLUS_PRICE.toFixed(2) }) });
    const res = await previewUpgradeNow('comp-1', 'PRO', db, { now });
    expect(res).toEqual({ ok: false, reason: 'not_upgrade' });
  });

  it('dönemin tam ortasında → farkın yarısı prorated', async () => {
    const { db } = makeDb({ subRow: subRow() });
    const res = await previewUpgradeNow('comp-1', 'PRO_PLUS', db, { now });
    expect(res.ok).toBe(true);
    expect(res.proratedAmount).toBe(HALF_PRORATION);
    expect(res.daysRemaining).toBe(15);
  });
});

describe('upgradeSubscriptionNow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kayıtlı kart yoksa (ctoken/utoken ikisi de yok) → no_saved_card, charge çağrılmaz', async () => {
    const { db } = makeDb({ subRow: subRow({ paytrCtoken: null, paytrUtoken: null }) });
    const charge = vi.fn();
    const res = await upgradeSubscriptionNow('comp-1', 'PRO_PLUS', db, { charge, now });
    expect(res).toEqual({ ok: false, reason: 'no_saved_card' });
    expect(charge).not.toHaveBeenCalled();
  });

  it('ctoken yok ama utoken varsa listCards ile bulunur', async () => {
    const { db } = makeDb({ subRow: subRow({ paytrCtoken: null }) });
    const charge = vi.fn().mockResolvedValue(chargeResp());
    const listCards = vi.fn().mockResolvedValue([{ ctoken: 'found-ctok' }]);
    await upgradeSubscriptionNow('comp-1', 'PRO_PLUS', db, { charge, listCards, now });
    expect(listCards).toHaveBeenCalledWith('utok-1');
    expect(charge).toHaveBeenCalledWith(expect.objectContaining({ ctoken: 'found-ctok' }));
  });

  it('kart çekimi başarısız → charge_failed, hiçbir şey değişmez', async () => {
    const { db, calls } = makeDb({ subRow: subRow() });
    const charge = vi.fn().mockResolvedValue(chargeResp({ status: 'failed', err_msg: 'kart reddedildi' }));
    const res = await upgradeSubscriptionNow('comp-1', 'PRO_PLUS', db, { charge, now });
    expect(res).toEqual({
      ok: false,
      reason: 'charge_failed',
      proratedAmount: HALF_PRORATION,
      message: 'kart reddedildi',
    });
    expect(calls.subUpdates).toHaveLength(0);
    expect(calls.companyUpdates).toHaveLength(0);
  });

  it('wait_callback → charge_pending, hiçbir şey değişmez (fail-safe)', async () => {
    const { db, calls } = makeDb({ subRow: subRow() });
    const charge = vi.fn().mockResolvedValue(chargeResp({ status: 'wait_callback' }));
    const res = await upgradeSubscriptionNow('comp-1', 'PRO_PLUS', db, { charge, now });
    expect(res).toEqual({ ok: false, reason: 'charge_pending', proratedAmount: HALF_PRORATION });
    expect(calls.subUpdates).toHaveLength(0);
  });

  it('başarılı çekim → plan/fiyat hemen güncellenir, dönem tarihleri DOKUNULMAZ', async () => {
    const { db, calls } = makeDb({ subRow: subRow() });
    const charge = vi.fn().mockResolvedValue(chargeResp());
    const res = await upgradeSubscriptionNow('comp-1', 'PRO_PLUS', db, { charge, now });

    expect(res.ok).toBe(true);
    expect(res.proratedAmount).toBe(HALF_PRORATION);
    expect(charge).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentAmount: Math.round(HALF_PRORATION * 100),
        ctoken: 'ctok-1',
        utoken: 'utok-1',
      }),
    );

    expect(calls.subUpdates[0]).toMatchObject({
      plan: 'PRO_PLUS',
      amountTry: PRO_PLUS_PRICE.toFixed(2),
      pendingPlan: null,
    });
    expect(calls.subUpdates[0]).not.toHaveProperty('currentPeriodStart');
    expect(calls.subUpdates[0]).not.toHaveProperty('currentPeriodEnd');
    expect(calls.companyUpdates[0]).toMatchObject({ plan: 'PRO_PLUS' });
    expect(calls.invoiceInserts[0]).toMatchObject({ amountTotal: HALF_PRORATION.toFixed(2), companyId: 'comp-1' });
  });

  it('prorated tutar 0 ise (dönem sonuna saniyeler kala) kart çekilmez, sadece plan uygulanır', async () => {
    const periodEnd = new Date('2026-07-31T00:00:00.000Z');
    const { db, calls } = makeDb({ subRow: subRow({ currentPeriodEnd: periodEnd }) });
    const charge = vi.fn();
    const res = await upgradeSubscriptionNow('comp-1', 'PRO_PLUS', db, { charge, now: () => periodEnd });

    expect(charge).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
    expect(res.proratedAmount).toBe(0);
    expect(calls.subUpdates[0]).toMatchObject({ plan: 'PRO_PLUS' });
    expect(calls.invoiceInserts).toHaveLength(0); // 0₺ fatura oluşturulmaz
  });

  it('Nilvera başarılı → invoice issued olarak işaretlenir', async () => {
    const { db, calls } = makeDb({
      subRow: subRow(),
      companyRow: { name: 'Pati Shop', vatNo: null, billingAddress: null, cityName: null, districtName: null, email: 'owner@pati.com' },
    });
    const charge = vi.fn().mockResolvedValue(chargeResp());
    const issueInvoice = vi.fn().mockResolvedValue({ invoiceId: 'nv-1', invoiceNumber: 'YDA001', kind: 'earsiv' });
    const res = await upgradeSubscriptionNow('comp-1', 'PRO_PLUS', db, {
      charge,
      nilvera: { issueInvoice },
      now,
    });
    expect(res.ok).toBe(true);
    expect(issueInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ externalRef: 'inv-1', lines: [expect.objectContaining({ unitPrice: expect.any(Number) })] }),
    );
    expect(calls.invoiceUpdates[0]).toMatchObject({ status: 'issued', nilveraInvoiceId: 'nv-1' });
  });

  it('Nilvera hata verirse invoice pending kalır, lastNilveraError yazılır (akış kırılmaz)', async () => {
    const { db, calls } = makeDb({
      subRow: subRow(),
      companyRow: { name: 'Pati Shop', vatNo: null, billingAddress: null, cityName: null, districtName: null, email: 'owner@pati.com' },
    });
    const charge = vi.fn().mockResolvedValue(chargeResp());
    const issueInvoice = vi.fn().mockRejectedValue(new Error('Nilvera 500'));
    const res = await upgradeSubscriptionNow('comp-1', 'PRO_PLUS', db, {
      charge,
      nilvera: { issueInvoice },
      now,
    });
    expect(res.ok).toBe(true); // ödeme + plan değişimi zaten başarılı — Nilvera best-effort
    expect(calls.invoiceUpdates[0]).toMatchObject({ lastNilveraError: 'Nilvera 500' });
  });
});

describe('startUpgradeCheckout (saklı kart yokken iframe)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prorated>0 → iframeUrl + pending_upgrade set + createToken prorated tutar/store_card ile', async () => {
    const { db, calls } = makeDb({ subRow: subRow({ paytrUtoken: 'utok-1' }) });
    const createToken = vi.fn().mockResolvedValue('tok-abc');
    const res = await startUpgradeCheckout('comp-1', 'PRO_PLUS', db, { createToken, now, userIp: '9.9.9.9' });

    expect(res.ok).toBe(true);
    expect(res.iframeUrl).toContain('tok-abc');
    expect(res.proratedAmount).toBe(HALF_PRORATION);
    // pending_upgrade set (callback bu oid'i tanır; pending_merchant_oid'e DOKUNMAZ → yenileme etkilenmez)
    expect(calls.subUpdates[0]).toMatchObject({ pendingUpgradeAmountTry: HALF_PRORATION.toFixed(2) });
    expect(calls.subUpdates[0].pendingUpgradeOid).toBeTruthy();
    expect(calls.subUpdates[0]).not.toHaveProperty('pendingMerchantOid');
    expect(createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentAmount: Math.round(HALF_PRORATION * 100),
        storeCard: 1,
        userIp: '9.9.9.9',
      }),
    );
  });

  it('prorated<=0 (dönem sonu) → applied, plan hemen uygulanır, createToken çağrılmaz', async () => {
    const periodEnd = new Date('2026-07-31T00:00:00.000Z');
    const { db, calls } = makeDb({ subRow: subRow({ currentPeriodEnd: periodEnd, paytrUtoken: 'utok-1' }) });
    const createToken = vi.fn();
    const res = await startUpgradeCheckout('comp-1', 'PRO_PLUS', db, { createToken, now: () => periodEnd });

    expect(res).toMatchObject({ ok: true, applied: true, proratedAmount: 0 });
    expect(createToken).not.toHaveBeenCalled();
    expect(calls.subUpdates[0]).toMatchObject({ plan: 'PRO_PLUS' }); // applyUpgradeInTx uyguladı
    expect(calls.invoiceInserts).toHaveLength(0);
  });

  it('aktif abonelik yoksa → not_found, createToken çağrılmaz', async () => {
    const { db } = makeDb({ subRow: null });
    const createToken = vi.fn();
    const res = await startUpgradeCheckout('comp-1', 'PRO_PLUS', db, { createToken, now });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
    expect(createToken).not.toHaveBeenCalled();
  });

  it('downgrade (hedef fiyat düşük) → not_upgrade', async () => {
    const { db } = makeDb({ subRow: subRow({ plan: 'PRO_PLUS', amountTry: PRO_PLUS_PRICE.toFixed(2) }) });
    const createToken = vi.fn();
    const res = await startUpgradeCheckout('comp-1', 'PRO', db, { createToken, now });
    expect(res).toEqual({ ok: false, reason: 'not_upgrade' });
  });
});
