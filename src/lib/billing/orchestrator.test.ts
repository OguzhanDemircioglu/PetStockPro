import { describe, it, expect, vi } from 'vitest';
import { processIyzicoWebhookEvent } from './orchestrator';
import type { DbClient } from '@/lib/db/client';
import type { IyzicoWebhookPayload, IyzicoWebhookEventType } from '@/lib/iyzico/types';

const NOW = new Date('2026-05-16T12:00:00.000Z');
const fixedNow = () => NOW;

const SUB_ROW = {
  id: 'sub-uuid-1',
  companyId: 'comp-uuid-1',
  plan: 'PRO' as const,
  currentPeriodStart: new Date('2026-04-16T12:00:00.000Z'),
  currentPeriodEnd: new Date('2026-05-16T12:00:00.000Z'),
  amountTry: '750.00',
};

const OWNER_ROW = { id: 'user-owner-1' };

const COMPANY_ROW = {
  name: 'Mavi Pet Shop',
  vatNo: '1234567890',
};

/**
 * Mock DB builder — orchestrator'ın yaptığı select/insert/update zincirini sırayla
 * cevaplar. Test başına queue konfigüre edilir.
 */
function makeMockDb(config: {
  /** persistWebhookEvent insert sonucu — 'ok' | 'duplicate' | error. */
  webhookInsert: 'ok' | 'duplicate' | Error;
  /** Subscription lookup sonucu. */
  subscriptionRow?: typeof SUB_ROW | null;
  /** Company owner lookup sonucu. */
  ownerRow?: typeof OWNER_ROW | null;
  /** payment_success path için invoice .returning() yanıtı. */
  invoiceReturning?: { id: string }[];
  /** payment_success path için company lookup (Nilvera helper içinde). */
  companyRow?: { name: string; vatNo: string | null } | null;
}) {
  const selectQueue: unknown[][] = [];
  if (config.subscriptionRow !== undefined) selectQueue.push(config.subscriptionRow ? [config.subscriptionRow] : []);
  if (config.ownerRow !== undefined) selectQueue.push(config.ownerRow ? [config.ownerRow] : []);
  if (config.companyRow !== undefined) selectQueue.push(config.companyRow ? [config.companyRow] : []);

  const calls = {
    insert: [] as { table: unknown; values: Record<string, unknown> }[],
    update: [] as { table: unknown; set: Record<string, unknown> }[],
    selects: 0,
  };

  const insert = vi.fn().mockImplementation((table: unknown) => {
    return {
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        calls.insert.push({ table, values: vals });
        // Webhook insert için: ilk insert call processedWebhooks
        if (calls.insert.length === 1) {
          if (config.webhookInsert === 'duplicate') {
            const err = new Error('duplicate key') as Error & { code: string };
            err.code = '23505';
            return Promise.reject(err);
          }
          if (config.webhookInsert instanceof Error) {
            return Promise.reject(config.webhookInsert);
          }
          return Promise.resolve();
        }
        // Invoice insert (payment success path) — returning desteklemeli
        const promise = Promise.resolve();
        const chainable = Object.assign(promise, {
          returning: vi.fn().mockResolvedValue(config.invoiceReturning ?? [{ id: 'inv-uuid-1' }]),
        });
        return chainable;
      }),
    };
  });

  const select = vi.fn().mockImplementation(() => {
    return {
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => {
            const result = selectQueue[calls.selects++] ?? [];
            return Promise.resolve(result);
          }),
        })),
      })),
    };
  });

  const update = vi.fn().mockImplementation((table: unknown) => ({
    set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      calls.update.push({ table, set: vals });
      return {
        where: vi.fn().mockResolvedValue(undefined),
      };
    }),
  }));

  return {
    db: { insert, select, update } as unknown as DbClient,
    calls,
  };
}

function makePayload(eventType: IyzicoWebhookEventType): IyzicoWebhookPayload {
  return {
    eventType,
    eventTime: 1747396800000,
    subscriptionReferenceCode: 'iyz-sub-ref-1',
    customerReferenceCode: 'iyz-cust-1',
    pricingPlanReferenceCode: 'plan_pro_monthly',
    paymentId: 'pay-123',
  } as IyzicoWebhookPayload;
}

// ══════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════

describe('processIyzicoWebhookEvent — idempotency', () => {
  it('duplicate event (eventId zaten DB\'de) → outcome=duplicate, hiçbir yan etki yok', async () => {
    const { db, calls } = makeMockDb({ webhookInsert: 'duplicate' });
    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_RENEWAL_SUCCESS'),
      { db, now: fixedNow },
    );

    expect(result.outcome).toBe('duplicate');
    expect(result.eventId).toMatch(/^iyzico_iyz-sub-ref-1_SUBSCRIPTION_RENEWAL_SUCCESS_/);
    // Hiç update çağrılmadı
    expect(calls.update).toHaveLength(0);
    // Subscription lookup hiç yapılmadı (early return)
    expect(calls.selects).toBe(0);
  });
});

describe('processIyzicoWebhookEvent — error paths', () => {
  it('subscription bulunamazsa outcome=subscription_not_found', async () => {
    const { db } = makeMockDb({
      webhookInsert: 'ok',
      subscriptionRow: null,
    });
    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_RENEWAL_SUCCESS'),
      { db, now: fixedNow },
    );
    expect(result.outcome).toBe('subscription_not_found');
    expect(result.subscriptionId).toBeUndefined();
  });

  it('company BAYI_SAHIBI yoksa outcome=company_user_missing', async () => {
    const { db } = makeMockDb({
      webhookInsert: 'ok',
      subscriptionRow: SUB_ROW,
      ownerRow: null,
    });
    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_RENEWAL_SUCCESS'),
      { db, now: fixedNow },
    );
    expect(result.outcome).toBe('company_user_missing');
    expect(result.subscriptionId).toBe(SUB_ROW.id);
  });
});

describe('processIyzicoWebhookEvent — RENEWAL_SUCCESS happy path', () => {
  it('subscription period extend + invoice insert + Nilvera çağrısı + audit', async () => {
    const nilveraResponse = {
      invoiceId: 'nilvera-inv-99',
      invoiceNumber: 'PSP-2026-000147',
      externalRef: 'inv-uuid-1',
      status: 'ACCEPTED' as const,
      pdfUrl: 'https://nilvera.example/inv/99.pdf',
      createdAt: '2026-05-16T12:00:00Z',
      totalAmount: 750,
      vatTotal: 125,
    };
    const createInvoice = vi.fn().mockResolvedValue(nilveraResponse);

    const { db, calls } = makeMockDb({
      webhookInsert: 'ok',
      subscriptionRow: SUB_ROW,
      ownerRow: OWNER_ROW,
      companyRow: COMPANY_ROW,
      invoiceReturning: [{ id: 'inv-uuid-1' }],
    });

    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_RENEWAL_SUCCESS'),
      { db, nilvera: { createInvoice }, now: fixedNow },
    );

    expect(result.outcome).toBe('processed');
    expect(result.subscriptionId).toBe(SUB_ROW.id);
    expect(result.invoiceId).toBe('inv-uuid-1');
    expect(result.nilveraInvoiceId).toBe('nilvera-inv-99');
    expect(result.nilveraError).toBeUndefined();

    // Subscription periodEnd extend: eski end (16 May) + 1 month → 16 Jun
    const subUpdate = calls.update.find((u) => u.set.status === 'active');
    expect(subUpdate).toBeDefined();
    const newEnd = subUpdate?.set.currentPeriodEnd as Date;
    expect(newEnd.toISOString().slice(0, 10)).toBe('2026-06-16');

    // Invoice insert — matrah 625 + vat 125 + total 750
    const invoiceInsert = calls.insert.find((i) => (i.values as { amountMatrah?: string }).amountMatrah !== undefined);
    expect(invoiceInsert?.values).toMatchObject({
      companyId: SUB_ROW.companyId,
      subscriptionId: SUB_ROW.id,
      amountMatrah: '625.00',
      vatAmount: '125.00',
      amountTotal: '750.00',
      status: 'pending',
    });

    // Nilvera çağrısı: doğru externalRef + müşteri + line
    expect(createInvoice).toHaveBeenCalledTimes(1);
    const nilveraCall = createInvoice.mock.calls[0][0];
    expect(nilveraCall.externalRef).toBe('inv-uuid-1');
    expect(nilveraCall.customer.taxNumber).toBe('1234567890');
    expect(nilveraCall.customer.title).toBe('Mavi Pet Shop');
    expect(nilveraCall.lines[0].name).toBe('PetStockPro PRO planı (aylık abonelik)');
    expect(nilveraCall.lines[0].unitPrice).toBe(625);
    expect(nilveraCall.lines[0].vatRate).toBe(20);

    // Nilvera response → invoice update issued
    const issuedUpdate = calls.update.find((u) => u.set.status === 'issued');
    expect(issuedUpdate?.set).toMatchObject({
      nilveraInvoiceId: 'nilvera-inv-99',
      nilveraInvoiceNumber: 'PSP-2026-000147',
      pdfUrl: 'https://nilvera.example/inv/99.pdf',
      status: 'issued',
    });

    // Audit log — subscription.renewed
    const auditInsert = calls.insert.find((i) => (i.values as { action?: string }).action === 'subscription.renewed');
    expect(auditInsert?.values).toMatchObject({
      companyId: SUB_ROW.companyId,
      userId: OWNER_ROW.id,
      action: 'subscription.renewed',
      entityType: 'subscription',
      entityId: SUB_ROW.id,
    });
  });
});

describe('processIyzicoWebhookEvent — ORDER_SUCCESS (ilk ödeme)', () => {
  it('action=subscription.payment_succeeded + periodStart=now', async () => {
    const createInvoice = vi.fn().mockResolvedValue({
      invoiceId: 'nilvera-99',
      externalRef: 'inv-uuid-1',
      status: 'PENDING' as const,
      createdAt: NOW.toISOString(),
      totalAmount: 750,
      vatTotal: 125,
    });

    const { db, calls } = makeMockDb({
      webhookInsert: 'ok',
      subscriptionRow: SUB_ROW,
      ownerRow: OWNER_ROW,
      companyRow: COMPANY_ROW,
    });

    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_ORDER_SUCCESS'),
      { db, nilvera: { createInvoice }, now: fixedNow },
    );

    expect(result.outcome).toBe('processed');

    // İlk ödeme: periodStart = now (16 May), periodEnd = now + 1 month (16 Jun)
    const subUpdate = calls.update.find((u) => u.set.status === 'active');
    const newStart = subUpdate?.set.currentPeriodStart as Date;
    expect(newStart.toISOString()).toBe(NOW.toISOString());

    // Audit action farklı
    const auditInsert = calls.insert.find((i) => (i.values as { action?: string }).action?.startsWith('subscription.'));
    expect(auditInsert?.values.action).toBe('subscription.payment_succeeded');
  });
});

describe('processIyzicoWebhookEvent — Nilvera failure', () => {
  it('Nilvera throw → invoice pending kalır + nilveraError döner + audit yine yazılır', async () => {
    const createInvoice = vi.fn().mockRejectedValue(new Error('Nilvera 502 Bad Gateway'));

    const { db, calls } = makeMockDb({
      webhookInsert: 'ok',
      subscriptionRow: SUB_ROW,
      ownerRow: OWNER_ROW,
      companyRow: COMPANY_ROW,
    });

    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_RENEWAL_SUCCESS'),
      { db, nilvera: { createInvoice }, now: fixedNow },
    );

    expect(result.outcome).toBe('processed'); // Orchestration yine başarılı
    expect(result.invoiceId).toBe('inv-uuid-1');
    expect(result.nilveraInvoiceId).toBeUndefined();
    expect(result.nilveraError).toBe('Nilvera 502 Bad Gateway');

    // Invoice 'issued'a güncellenmedi
    const issuedUpdate = calls.update.find((u) => u.set.status === 'issued');
    expect(issuedUpdate).toBeUndefined();

    // Audit yine yazıldı, afterState.nilveraError populated
    const auditInsert = calls.insert.find((i) => (i.values as { action?: string }).action === 'subscription.renewed');
    expect((auditInsert?.values.afterState as Record<string, unknown>).nilveraError).toBe(
      'Nilvera 502 Bad Gateway',
    );
  });

  it('VKN eksikse Nilvera atlanır (invoice pending) + nilveraError set edilir', async () => {
    const createInvoice = vi.fn();

    const { db, calls } = makeMockDb({
      webhookInsert: 'ok',
      subscriptionRow: SUB_ROW,
      ownerRow: OWNER_ROW,
      companyRow: { name: 'No-VAT Co', vatNo: null },
    });

    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_RENEWAL_SUCCESS'),
      { db, nilvera: { createInvoice }, now: fixedNow },
    );

    expect(result.outcome).toBe('processed');
    expect(result.nilveraInvoiceId).toBeUndefined();
    expect(result.nilveraError).toContain('VKN eksik');
    expect(createInvoice).not.toHaveBeenCalled();
    // Invoice 'pending' kaldı
    const issuedUpdate = calls.update.find((u) => u.set.status === 'issued');
    expect(issuedUpdate).toBeUndefined();
  });
});

describe('processIyzicoWebhookEvent — RENEWAL_FAILURE', () => {
  it('subscription → past_due + audit subscription.payment_failed', async () => {
    const { db, calls } = makeMockDb({
      webhookInsert: 'ok',
      subscriptionRow: SUB_ROW,
      ownerRow: OWNER_ROW,
    });

    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_RENEWAL_FAILURE'),
      { db, now: fixedNow },
    );

    expect(result.outcome).toBe('processed');
    expect(calls.update[0]?.set).toMatchObject({ status: 'past_due' });
    const auditInsert = calls.insert.find((i) => (i.values as { action?: string }).action === 'subscription.payment_failed');
    expect(auditInsert).toBeDefined();
  });
});

describe('processIyzicoWebhookEvent — CANCELED', () => {
  it('subscription → cancelled + cancelAtPeriodEnd=true + cancelledAt set + audit', async () => {
    const { db, calls } = makeMockDb({
      webhookInsert: 'ok',
      subscriptionRow: SUB_ROW,
      ownerRow: OWNER_ROW,
    });

    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_CANCELED'),
      { db, now: fixedNow },
    );

    expect(result.outcome).toBe('processed');
    expect(calls.update[0]?.set).toMatchObject({
      status: 'cancelled',
      cancelAtPeriodEnd: true,
      cancelledAt: NOW,
    });
    const auditInsert = calls.insert.find((i) => (i.values as { action?: string }).action === 'subscription.cancelled');
    expect(auditInsert).toBeDefined();
  });
});

describe('processIyzicoWebhookEvent — EXPIRED', () => {
  it('subscription → expired + company.plan → FREE + audit', async () => {
    const { db, calls } = makeMockDb({
      webhookInsert: 'ok',
      subscriptionRow: SUB_ROW,
      ownerRow: OWNER_ROW,
    });

    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_EXPIRED'),
      { db, now: fixedNow },
    );

    expect(result.outcome).toBe('processed');
    // 2 update: subscription + company
    expect(calls.update).toHaveLength(2);
    expect(calls.update[0]?.set).toMatchObject({ status: 'expired' });
    expect(calls.update[1]?.set).toMatchObject({ plan: 'FREE' });
    const auditInsert = calls.insert.find((i) => (i.values as { action?: string }).action === 'subscription.expired');
    expect((auditInsert?.values.afterState as Record<string, unknown>).companyPlan).toBe('FREE');
  });
});

describe('processIyzicoWebhookEvent — UPGRADED', () => {
  it('updatedAt güncellenir + audit subscription.upgraded (plan ref mapping Faz 2)', async () => {
    const { db, calls } = makeMockDb({
      webhookInsert: 'ok',
      subscriptionRow: SUB_ROW,
      ownerRow: OWNER_ROW,
    });

    const result = await processIyzicoWebhookEvent(
      makePayload('SUBSCRIPTION_UPGRADED'),
      { db, now: fixedNow },
    );

    expect(result.outcome).toBe('processed');
    expect(calls.update[0]?.set).toMatchObject({ updatedAt: NOW });
    const auditInsert = calls.insert.find((i) => (i.values as { action?: string }).action === 'subscription.upgraded');
    expect(auditInsert).toBeDefined();
  });
});
