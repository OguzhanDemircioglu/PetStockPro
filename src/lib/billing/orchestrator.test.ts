import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/audit/log', () => ({
  writeAuditLog: vi.fn(),
  writeAuditLogAsync: vi.fn(),
}));

import { processPaytrCallback, RETRY_SCHEDULE_DAYS, type PaytrCallbackInput } from './orchestrator';
import { writeAuditLog } from '@/lib/audit/log';
import { processedWebhooks, subscriptions, invoices, companies, users } from '@/db/schema';

const NOW = new Date('2026-06-10T12:00:00.000Z');
const now = () => NOW;
const DAY = 86_400_000;

interface SubRow {
  id: string;
  companyId: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
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

  it('BAYI_SAHIBI yok → company_user_missing', async () => {
    const { db } = makeDb({ subRow: subRow(), ownerId: null });
    const res = await processPaytrCallback(baseInput, { db, now });
    expect(res.outcome).toBe('company_user_missing');
  });

  it('Nilvera hata → success ama invoice pending + nilveraError', async () => {
    const { db, calls } = makeDb({ subRow: subRow(), company: { name: 'Pet A', vatNo: '1234567890' } });
    const nilvera = { createInvoice: vi.fn().mockRejectedValue(new Error('Nilvera 502')) };
    const res = await processPaytrCallback(baseInput, { db, nilvera, now });

    expect(res.outcome).toBe('payment_succeeded');
    expect(res.nilveraError).toContain('Nilvera 502');
    expect(calls.updates.find((u) => u.table === 'invoices')).toBeUndefined(); // issued'a güncellenmedi
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
