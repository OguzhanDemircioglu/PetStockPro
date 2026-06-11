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

import { processPaytrCallback, RETRY_SCHEDULE_DAYS, type PaytrCallbackInput } from './orchestrator';
import { writeAuditLog } from '@/lib/audit/log';
import { alertPaymentAnomaly, alertDunning } from './alerts';
import { PLAN_LIMITS } from '@/lib/constants/plan-limits';
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

interface DbConfig {
  subRow?: SubRow | null;
  ownerId?: string | null;
  company?: { name: string; vatNo: string | null } | null;
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
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  if (table === subscriptions) return Promise.resolve(config.subRow ? [config.subRow] : []);
                  if (table === users) return Promise.resolve(ownerId ? [{ id: ownerId }] : []);
                  if (table === companies) return Promise.resolve(config.company ? [config.company] : []);
                  return Promise.resolve([]);
                },
              };
            },
          };
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
    const { db, calls } = makeDb({ subRow: subRow(), company: { name: 'Pet A', vatNo: '1234567890' } });
    const nilvera = { createInvoice: vi.fn().mockResolvedValue({ invoiceId: 'nv-1', invoiceNumber: 'N1', pdfUrl: 'u' }) };

    const res = await processPaytrCallback(baseInput, { db, nilvera, now });

    expect(res.outcome).toBe('payment_succeeded');
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
    expect(nilvera.createInvoice).toHaveBeenCalledTimes(1);
    const invUpd = calls.updates.find((u) => u.table === 'invoices')!;
    expect(invUpd.vals.status).toBe('issued');
    expect(invUpd.vals.nilveraInvoiceId).toBe('nv-1');
    expect(auditAction()).toBe('subscription.payment_succeeded');
    expect(res.nilveraInvoiceId).toBe('nv-1');
  });

  it('yenileme success → period currentPeriodEnd+1ay + audit renewed', async () => {
    const periodEnd = new Date('2026-07-10T12:00:00.000Z');
    const { db, calls } = makeDb({
      subRow: subRow({ status: 'active', currentPeriodEnd: periodEnd }),
      company: { name: 'Pet A', vatNo: '1234567890' },
    });
    const nilvera = { createInvoice: vi.fn().mockResolvedValue({ invoiceId: 'nv-2' }) };

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

  it('Nilvera hata → success ama invoice pending + nilveraError', async () => {
    const { db, calls } = makeDb({ subRow: subRow(), company: { name: 'Pet A', vatNo: '1234567890' } });
    const nilvera = { createInvoice: vi.fn().mockRejectedValue(new Error('Nilvera 502')) };
    const res = await processPaytrCallback(baseInput, { db, nilvera, now });

    expect(res.outcome).toBe('payment_succeeded');
    expect(res.nilveraError).toContain('Nilvera 502');
    // Nilvera fail → invoice 'issued'a güncellenmedi (pending kaldı); sadece lastNilveraError kaydedildi (C2 reconcile için)
    const invUpd = calls.updates.find((u) => u.table === 'invoices');
    expect(invUpd?.vals.status).toBeUndefined();
    expect(invUpd?.vals.lastNilveraError).toContain('Nilvera 502');
  });

  it('şirket VKN yok → Nilvera atlanır, invoice pending, yine success', async () => {
    const { db } = makeDb({ subRow: subRow(), company: { name: 'Pet A', vatNo: null } });
    const nilvera = { createInvoice: vi.fn() };
    const res = await processPaytrCallback(baseInput, { db, nilvera, now });

    expect(res.outcome).toBe('payment_succeeded');
    expect(nilvera.createInvoice).not.toHaveBeenCalled();
    expect(res.nilveraError).toContain('VKN eksik');
  });

  it('nilvera dep yok → invoice pending, success', async () => {
    const { db, calls } = makeDb({ subRow: subRow() });
    const res = await processPaytrCallback(baseInput, { db, now });

    expect(res.outcome).toBe('payment_succeeded');
    expect(calls.invoiceInsert).toHaveLength(1);
    expect(res.nilveraInvoiceId).toBeUndefined();
  });
});
