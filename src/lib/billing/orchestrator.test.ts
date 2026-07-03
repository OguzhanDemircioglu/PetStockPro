import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/audit/log', () => ({
  writeAuditLog: vi.fn(),
  writeAuditLogAsync: vi.fn(),
}));
vi.mock('./alerts', () => ({
  alertPaymentAnomaly: vi.fn(),
  alertDunning: vi.fn(),
}));
vi.mock('./emails', () => ({ sendDunningEmail: vi.fn() }));
vi.mock('./downgrade-reconcile', () => ({ unpublishVitrinOverLimit: vi.fn().mockResolvedValue(0) }));

import { processPaytrCallback, RETRY_SCHEDULE_DAYS, type PaytrCallbackInput } from './orchestrator';
import { writeAuditLog } from '@/lib/audit/log';
import { alertPaymentAnomaly, alertDunning } from './alerts';
import { unpublishVitrinOverLimit } from './downgrade-reconcile';
import { PLAN_LIMITS, planVitrinLimit } from '@/lib/constants/plan-limits';
import { processedWebhooks, subscriptions, invoices, companies, users } from '@/db/schema';

const NOW = new Date('2026-06-10T12:00:00.000Z');
const now = () => NOW;
const DAY = 86_400_000;

interface SubRow {
  id: string;
  companyId: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  pendingPlan: 'FREE' | 'PRO' | 'PRO_PLUS' | null;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  amountTry: string;
  paymentRetryCount: number;
}

function subRow(over: Partial<SubRow> = {}): SubRow {
  return {
    id: 'sub-1',
    companyId: 'comp-1',
    plan: 'PRO',
    pendingPlan: null,
    status: 'incomplete',
    currentPeriodStart: new Date('2026-06-10T12:00:00.000Z'),
    currentPeriodEnd: new Date('2026-07-10T12:00:00.000Z'),
    amountTry: '1000.00',
    paymentRetryCount: 0,
    ...over,
  };
}

interface UpgradeSubRow {
  id: string;
  companyId: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  currentPeriodEnd: Date;
  pendingUpgradeAmountTry: string | null;
}

interface DbConfig {
  subRow?: SubRow | null;
  /** pending_upgrade_oid lookup sonucu — set edilmezse null (upgrade dalı tetiklenmez). */
  upgradeSubRow?: UpgradeSubRow | null;
  ownerId?: string | null;
  company?: { name: string; vatNo: string | null; email?: string | null } | null;
  duplicateWebhook?: boolean;
  invoiceId?: string;
}

function makeDb(config: DbConfig) {
  const ownerId = config.ownerId === undefined ? 'owner-1' : config.ownerId;
  const calls = {
    webhook: [] as Record<string, unknown>[],
    invoiceInsert: [] as Record<string, unknown>[],
    updates: [] as { table: string; vals: Record<string, unknown> }[],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    insert(table: unknown) {
      return {
        values(vals: Record<string, unknown>) {
          if (table === processedWebhooks) {
            if (config.duplicateWebhook) {
              return Promise.reject(Object.assign(new Error('dup'), { code: '23505' }));
            }
            calls.webhook.push(vals);
            return Promise.resolve();
          }
          if (table === invoices) {
            calls.invoiceInsert.push(vals);
            return { returning: () => Promise.resolve([{ id: config.invoiceId ?? 'inv-1' }]) };
          }
          return Promise.resolve();
        },
      };
    },
    update(table: unknown) {
      const label =
        table === subscriptions ? 'subscriptions' : table === companies ? 'companies' : table === invoices ? 'invoices' : 'other';
      return {
        set(vals: Record<string, unknown>) {
          return {
            where() {
              calls.updates.push({ table: label, vals });
              return Promise.resolve();
            },
          };
        },
      };
    },
    select(projection?: Record<string, unknown>) {
      // subscriptions üzerinde iki ayrı lookup var: pending_upgrade_oid (yeni, izole) ve
      // pending_merchant_oid (yenileme/checkout). Projeksiyonda pendingUpgradeAmountTry varsa
      // upgrade lookup'tır → config.upgradeSubRow (set edilmezse null → dal tetiklenmez).
      const isUpgradeLookup = !!projection && 'pendingUpgradeAmountTry' in projection;
      return {
        from(table: unknown) {
          // leftJoin opsiyonel (loadInvoiceCustomer cities/districts join'ler) — chainable.
          const chain: Record<string, unknown> = {
            leftJoin: () => chain,
            where() {
              return {
                limit() {
                  if (table === subscriptions) {
                    if (isUpgradeLookup) {
                      return Promise.resolve(config.upgradeSubRow ? [config.upgradeSubRow] : []);
                    }
                    return Promise.resolve(config.subRow ? [config.subRow] : []);
                  }
                  if (table === users) return Promise.resolve(ownerId ? [{ id: ownerId }] : []);
                  if (table === companies) return Promise.resolve(config.company ? [config.company] : []);
                  return Promise.resolve([]);
                },
              };
            },
          };
          return chain;
        },
      };
    },
  };
  // tx === db (mock); fn fırlatırsa propagate olur (rollback/duplicate senaryoları).
  db.transaction = (fn: (tx: unknown) => unknown) => fn(db);
  return { db, calls };
}

const baseInput: PaytrCallbackInput = {
  merchantOid: 'PSP-OID-1',
  status: 'success',
  totalAmount: '100000', // 1000,00 ₺
  card: { utoken: 'utok', ctoken: 'ctok', masked: '•••• 1234', brand: 'visa' },
  rawPayload: { merchant_oid: 'PSP-OID-1' },
};

function auditAction(idx = 0): string {
  return (vi.mocked(writeAuditLog).mock.calls[idx][0] as { action: string }).action;
}

describe('processPaytrCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ilk ödeme success → active + kart sakla + company.plan + invoice + Nilvera + audit', async () => {
    const { db, calls } = makeDb({ subRow: subRow(), company: { name: 'Pet A', vatNo: '1234567890', email: 'owner@peta.com' } });
    const nilvera = { issueInvoice: vi.fn().mockResolvedValue({ invoiceId: 'nv-1', invoiceNumber: 'N1', kind: 'earsiv', pdfUrl: 'u' }) };

    const res = await processPaytrCallback(baseInput, { db, nilvera, now });

    expect(res.outcome).toBe('payment_succeeded');
    // owner e-postası loadInvoiceCustomer üzerinden faturaya geçer (alıcıya teslim)
    expect(
      (nilvera.issueInvoice.mock.calls[0][0] as { customer: { email?: string } }).customer.email,
    ).toBe('owner@peta.com');
    const subUpd = calls.updates.find((u) => u.table === 'subscriptions')!;
    expect(subUpd.vals.status).toBe('active');
    expect(subUpd.vals.pendingMerchantOid).toBeNull();
    expect(subUpd.vals.paymentRetryCount).toBe(0);
    expect(subUpd.vals.paytrUtoken).toBe('utok');
    expect(subUpd.vals.paytrCtoken).toBe('ctok');
    expect(subUpd.vals.paytrCardMasked).toBe('•••• 1234');
    expect(subUpd.vals.currentPeriodStart).toEqual(NOW); // ilk ödeme → şimdi başlar
    const compUpd = calls.updates.find((u) => u.table === 'companies')!;
    expect(compUpd.vals.plan).toBe('PRO');
    expect(calls.invoiceInsert[0].merchantOid).toBe('PSP-OID-1');
    expect(calls.invoiceInsert[0].amountTotal).toBe('1000.00');
    expect(nilvera.issueInvoice).toHaveBeenCalledTimes(1);
    const invUpd = calls.updates.find((u) => u.table === 'invoices')!;
    expect(invUpd.vals.status).toBe('issued');
    expect(invUpd.vals.nilveraInvoiceId).toBe('nv-1');
    expect(invUpd.vals.invoiceKind).toBe('earsiv');
    expect(auditAction()).toBe('subscription.payment_succeeded');
    expect(res.nilveraInvoiceId).toBe('nv-1');
  });

  it('yenileme success → period currentPeriodEnd+1ay + audit renewed', async () => {
    const periodEnd = new Date('2026-07-10T12:00:00.000Z');
    const { db, calls } = makeDb({
      subRow: subRow({ status: 'active', currentPeriodEnd: periodEnd }),
      company: { name: 'Pet A', vatNo: '1234567890' },
    });
    const nilvera = { issueInvoice: vi.fn().mockResolvedValue({ invoiceId: 'nv-2', kind: 'earsiv' }) };

    const res = await processPaytrCallback(baseInput, { db, nilvera, now });

    expect(res.outcome).toBe('payment_succeeded');
    const subUpd = calls.updates.find((u) => u.table === 'subscriptions')!;
    expect(subUpd.vals.currentPeriodStart).toEqual(periodEnd); // yenileme eski dönem sonundan başlar
    expect(auditAction()).toBe('subscription.renewed');
  });

  it('tutar uyuşmazlığı → amount_mismatch, aktivasyon YOK', async () => {
    const { db, calls } = makeDb({ subRow: subRow() });
    const res = await processPaytrCallback({ ...baseInput, totalAmount: '50000' }, { db, now });

    expect(res.outcome).toBe('amount_mismatch');
    expect(calls.updates.find((u) => u.table === 'subscriptions')).toBeUndefined();
    expect(calls.invoiceInsert).toHaveLength(0);
    expect(auditAction()).toBe('subscription.amount_mismatch');
    expect(alertPaymentAnomaly).toHaveBeenCalledWith(expect.objectContaining({ kind: 'amount_mismatch' }));
  });

  it('ilk ödeme failed → incomplete kalır, pending temizlenir', async () => {
    const { db, calls } = makeDb({ subRow: subRow({ status: 'incomplete' }) });
    const res = await processPaytrCallback(
      { ...baseInput, status: 'failed', failedReason: 'kart reddedildi' },
      { db, now },
    );

    expect(res.outcome).toBe('payment_failed');
    const subUpd = calls.updates.find((u) => u.table === 'subscriptions')!;
    expect(subUpd.vals.pendingMerchantOid).toBeNull();
    expect(subUpd.vals.status).toBeUndefined(); // status değişmedi → incomplete kaldı
    expect(auditAction()).toBe('subscription.checkout_failed');
  });

  it('yenileme failed → past_due + retryCount++ + nextRetryAt (+1 gün)', async () => {
    const { db, calls } = makeDb({ subRow: subRow({ status: 'active', paymentRetryCount: 0 }) });
    const res = await processPaytrCallback({ ...baseInput, status: 'failed' }, { db, now });

    expect(res.outcome).toBe('payment_failed');
    const subUpd = calls.updates.find((u) => u.table === 'subscriptions')!;
    expect(subUpd.vals.status).toBe('past_due');
    expect(subUpd.vals.paymentRetryCount).toBe(1);
    expect(subUpd.vals.nextRetryAt).toEqual(new Date(NOW.getTime() + RETRY_SCHEDULE_DAYS[0] * DAY));
    expect(auditAction()).toBe('subscription.payment_failed');
    // I1/C3: dunning alert (retry sürüyor → exhausted false)
    expect(alertDunning).toHaveBeenCalledWith(expect.objectContaining({ exhausted: false, retryCount: 1 }));
  });

  it('yenileme failed, retry tükendi (count=3) → nextRetryAt null', async () => {
    const { db, calls } = makeDb({ subRow: subRow({ status: 'past_due', paymentRetryCount: 3 }) });
    await processPaytrCallback({ ...baseInput, status: 'failed' }, { db, now });

    const subUpd = calls.updates.find((u) => u.table === 'subscriptions')!;
    expect(subUpd.vals.paymentRetryCount).toBe(4);
    expect(subUpd.vals.nextRetryAt).toBeNull();
  });

  it('duplicate merchant_oid → duplicate, başka işlem yok', async () => {
    const { db, calls } = makeDb({ subRow: subRow(), duplicateWebhook: true });
    const res = await processPaytrCallback(baseInput, { db, now });

    expect(res.outcome).toBe('duplicate');
    expect(calls.updates).toHaveLength(0);
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('pending_merchant_oid eşleşmedi → subscription_not_found', async () => {
    const { db } = makeDb({ subRow: null });
    const res = await processPaytrCallback(baseInput, { db, now });
    expect(res.outcome).toBe('subscription_not_found');
  });

  it('C1: owner yok → ödeme YİNE uygulanır (payment_succeeded) + owner_missing alert', async () => {
    const { db, calls } = makeDb({ subRow: subRow(), ownerId: null });
    const res = await processPaytrCallback(baseInput, { db, now });

    // Para alındı → plan + fatura yine yazıldı ("para alındı, plan açılmadı" önlendi)
    expect(res.outcome).toBe('payment_succeeded');
    expect(calls.updates.find((u) => u.table === 'companies')?.vals.plan).toBe('PRO');
    expect(calls.invoiceInsert).toHaveLength(1);
    // audit yazarı bulunamadı → audit atlandı (ama ödeme uygulandı)
    expect(writeAuditLog).not.toHaveBeenCalled();
    // süperadmin'e owner_missing alert gönderildi
    expect(alertPaymentAnomaly).toHaveBeenCalledWith(expect.objectContaining({ kind: 'owner_missing' }));
  });

  it('H2: pendingPlan set → yenilemede YENİ plan fiyatı beklenir + plan değişir, pendingPlan temizlenir', async () => {
    const newAmount = PLAN_LIMITS.PRO_PLUS.priceMonthlyTry.toFixed(2);
    const newKurus = String(Math.round(PLAN_LIMITS.PRO_PLUS.priceMonthlyTry * 100));
    const { db, calls } = makeDb({
      subRow: subRow({ status: 'active', plan: 'PRO', pendingPlan: 'PRO_PLUS', amountTry: '10.00' }),
      company: { name: 'Pet A', vatNo: '1234567890' },
    });

    const res = await processPaytrCallback({ ...baseInput, totalAmount: newKurus }, { db, now });

    expect(res.outcome).toBe('payment_succeeded');
    const subUpd = calls.updates.find((u) => u.table === 'subscriptions')!;
    expect(subUpd.vals.plan).toBe('PRO_PLUS'); // plan değişti
    expect(subUpd.vals.pendingPlan).toBeNull(); // temizlendi
    expect(subUpd.vals.amountTry).toBe(newAmount); // yeni fiyat snapshot
    expect(calls.updates.find((u) => u.table === 'companies')?.vals.plan).toBe('PRO_PLUS');
    expect(auditAction()).toBe('subscription.plan_changed');
  });

  it('H2: pendingPlan set ama callback ESKİ tutarla gelirse → amount_mismatch (yeni fiyat beklenir)', async () => {
    const oldKurus = '1000'; // eski PRO snapshot (10₺) — yeni plan fiyatı beklenirken gelirse reddedilir
    const { db } = makeDb({
      subRow: subRow({ status: 'active', plan: 'PRO', pendingPlan: 'PRO_PLUS', amountTry: '10.00' }),
    });
    const res = await processPaytrCallback({ ...baseInput, totalAmount: oldKurus }, { db, now });
    expect(res.outcome).toBe('amount_mismatch');
  });

  it('H2 downgrade: pendingPlan PRO → plan PRO + vitrin over-limit reconcile çağrılır', async () => {
    const proKurus = String(Math.round(PLAN_LIMITS.PRO.priceMonthlyTry * 100));
    const { db, calls } = makeDb({
      subRow: subRow({ status: 'active', plan: 'PRO_PLUS', pendingPlan: 'PRO', amountTry: '20.00' }),
      company: { name: 'Pet A', vatNo: '1234567890' },
    });

    const res = await processPaytrCallback({ ...baseInput, totalAmount: proKurus }, { db, now });

    expect(res.outcome).toBe('payment_succeeded');
    expect(calls.updates.find((u) => u.table === 'subscriptions')!.vals.plan).toBe('PRO');
    // Downgrade → yeni planın (PRO) vitrin limitine göre over-limit ürünler vitrin'den çekilir.
    expect(unpublishVitrinOverLimit).toHaveBeenCalledWith(expect.anything(), 'comp-1', planVitrinLimit('PRO'), NOW);
  });

  it('Nilvera hata → success ama invoice pending + nilveraError', async () => {
    const { db, calls } = makeDb({ subRow: subRow(), company: { name: 'Pet A', vatNo: '1234567890' } });
    const nilvera = { issueInvoice: vi.fn().mockRejectedValue(new Error('Nilvera 502')) };
    const res = await processPaytrCallback(baseInput, { db, nilvera, now });

    expect(res.outcome).toBe('payment_succeeded');
    expect(res.nilveraError).toContain('Nilvera 502');
    // Nilvera fail → invoice 'issued'a güncellenmedi (pending kaldı); sadece lastNilveraError kaydedildi (C2 reconcile için)
    const invUpd = calls.updates.find((u) => u.table === 'invoices');
    expect(invUpd?.vals.status).toBeUndefined();
    expect(invUpd?.vals.lastNilveraError).toContain('Nilvera 502');
  });

  it('şirket VKN yok → nihai tüketici e-Arşiv kesilir (atlanmaz)', async () => {
    const { db, calls } = makeDb({ subRow: subRow(), company: { name: 'Ahmet Yılmaz', vatNo: null } });
    const nilvera = { issueInvoice: vi.fn().mockResolvedValue({ invoiceId: 'nv-nt', kind: 'earsiv' }) };
    const res = await processPaytrCallback(baseInput, { db, nilvera, now });

    expect(res.outcome).toBe('payment_succeeded');
    // null VKN → router'a taxNumber null geçer (nihai tüketici); fatura yine kesilir.
    expect(nilvera.issueInvoice).toHaveBeenCalledTimes(1);
    expect((nilvera.issueInvoice.mock.calls[0][0] as { customer: { taxNumber: unknown } }).customer.taxNumber).toBeNull();
    expect(res.nilveraInvoiceId).toBe('nv-nt');
    expect(calls.updates.find((u) => u.table === 'invoices')!.vals.status).toBe('issued');
  });

  it('nilvera dep yok → invoice pending, success', async () => {
    const { db, calls } = makeDb({ subRow: subRow() });
    const res = await processPaytrCallback(baseInput, { db, now });

    expect(res.outcome).toBe('payment_succeeded');
    expect(calls.invoiceInsert).toHaveLength(1);
    expect(res.nilveraInvoiceId).toBeUndefined();
  });
});

// ── UPGRADE (iframe, saklı kart YOKKEN) — İZOLE yol ─────────────
describe('processPaytrCallback — upgrade (iframe, saklı kart yok)', () => {
  beforeEach(() => vi.clearAllMocks());

  function upgSub(over: Partial<UpgradeSubRow> = {}): UpgradeSubRow {
    return {
      id: 'sub-1',
      companyId: 'comp-1',
      plan: 'PRO',
      currentPeriodEnd: new Date('2026-07-10T12:00:00.000Z'),
      pendingUpgradeAmountTry: '500.00', // beklenen prorated = 50000 kuruş
      ...over,
    };
  }

  const upgInput: PaytrCallbackInput = {
    merchantOid: 'PSPUPG-OID',
    status: 'success',
    totalAmount: '50000', // 500,00₺ prorated fark
    card: { utoken: 'utok-up' },
    rawPayload: { merchant_oid: 'PSPUPG-OID' },
  };

  it('success → PRO_PLUS uygulanır, DÖNEM DEĞİŞMEZ, prorated invoice, kart saklanır, pending temizlenir', async () => {
    const { db, calls } = makeDb({ upgradeSubRow: upgSub() });
    const res = await processPaytrCallback(upgInput, { db, now });

    expect(res.outcome).toBe('payment_succeeded');
    const subUpd = calls.updates.find((u) => u.table === 'subscriptions')!;
    expect(subUpd.vals.plan).toBe('PRO_PLUS');
    expect(subUpd.vals.amountTry).toBe(PLAN_LIMITS.PRO_PLUS.priceMonthlyTry.toFixed(2));
    expect(subUpd.vals.pendingUpgradeOid).toBeNull();
    expect(subUpd.vals.pendingUpgradeAmountTry).toBeNull();
    expect(subUpd.vals.paytrUtoken).toBe('utok-up'); // kart saklandı (gelecek yenileme/upgrade için)
    // dönem tarihleri DOKUNULMADI (yükseltme dönem-içi)
    expect(subUpd.vals.currentPeriodStart).toBeUndefined();
    expect(subUpd.vals.currentPeriodEnd).toBeUndefined();
    expect(calls.updates.find((u) => u.table === 'companies')!.vals.plan).toBe('PRO_PLUS');
    expect(calls.invoiceInsert[0].merchantOid).toBe('PSPUPG-OID');
    expect(calls.invoiceInsert[0].amountTotal).toBe('500.00');
    expect(auditAction()).toBe('subscription.upgraded_immediate');
  });

  it('success + Nilvera → satır "yükseltme (dönem içi fark)" etiketiyle kesilir', async () => {
    const { db } = makeDb({ upgradeSubRow: upgSub(), company: { name: 'Pet A', vatNo: '1234567890' } });
    const nilvera = { issueInvoice: vi.fn().mockResolvedValue({ invoiceId: 'nv-up', kind: 'earsiv' }) };
    const res = await processPaytrCallback(upgInput, { db, nilvera, now });

    expect(res.outcome).toBe('payment_succeeded');
    const line = (nilvera.issueInvoice.mock.calls[0][0] as { lines: { name: string }[] }).lines[0];
    expect(line.name).toContain('yükseltme');
  });

  it('failed (kart reddedildi) → plan PRO kalır, pending temizlenir, dunning YOK, audit upgrade_failed', async () => {
    const { db, calls } = makeDb({ upgradeSubRow: upgSub() });
    const res = await processPaytrCallback(
      { ...upgInput, status: 'failed', failedReason: 'kart reddedildi' },
      { db, now },
    );

    expect(res.outcome).toBe('payment_failed');
    const subUpd = calls.updates.find((u) => u.table === 'subscriptions')!;
    expect(subUpd.vals.pendingUpgradeOid).toBeNull();
    expect(subUpd.vals.plan).toBeUndefined(); // plan DEĞİŞMEDİ (PRO kaldı)
    expect(calls.invoiceInsert).toHaveLength(0);
    expect(auditAction()).toBe('subscription.upgrade_failed');
    expect(alertDunning).not.toHaveBeenCalled(); // yenileme değil → dunning yok
  });

  it('tutar uyuşmazlığı → amount_mismatch, plan uygulanmaz, pending temizlenir + alert', async () => {
    const { db, calls } = makeDb({ upgradeSubRow: upgSub({ pendingUpgradeAmountTry: '500.00' }) });
    const res = await processPaytrCallback({ ...upgInput, totalAmount: '40000' }, { db, now }); // 400₺ geldi, 500 bekleniyordu

    expect(res.outcome).toBe('amount_mismatch');
    const subUpd = calls.updates.find((u) => u.table === 'subscriptions')!;
    expect(subUpd.vals.pendingUpgradeOid).toBeNull();
    expect(subUpd.vals.plan).toBeUndefined();
    expect(calls.invoiceInsert).toHaveLength(0);
    expect(alertPaymentAnomaly).toHaveBeenCalledWith(expect.objectContaining({ kind: 'amount_mismatch' }));
  });
});
