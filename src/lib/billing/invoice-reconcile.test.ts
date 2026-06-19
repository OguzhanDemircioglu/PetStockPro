import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./alerts', () => ({ alertInvoiceFailed: vi.fn() }));

import { runInvoiceReconcile, INVOICE_RECONCILE_MAX_RETRIES } from './invoice-reconcile';
import { alertInvoiceFailed } from './alerts';

interface InvRow {
  id: string;
  companyId: string;
  amountMatrah: string;
  retryCount: number;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  vatNo: string | null;
  companyName: string;
  billingAddress: string | null;
  cityName: string | null;
  districtName: string | null;
}

function invRow(over: Partial<InvRow> = {}): InvRow {
  return {
    id: 'inv-1',
    companyId: 'c1',
    amountMatrah: '8.33',
    retryCount: 0,
    plan: 'PRO',
    vatNo: '1234567890',
    companyName: 'Pet A',
    billingAddress: 'Üsküdar Mah. No 1',
    cityName: 'İstanbul',
    districtName: 'Üsküdar',
    ...over,
  };
}

function makeDb(rows: InvRow[]) {
  const calls = { updates: [] as Record<string, unknown>[] };
  // select chain: from/innerJoin/leftJoin chainable, where → rows (gerçek sorgu join sayısı önemli değil).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: () => Promise.resolve(rows),
      };
      return chain;
    },
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          calls.updates.push(vals);
          return Promise.resolve();
        },
      }),
    }),
  };
  return { db, calls };
}

const now = () => new Date('2026-06-11T12:00:00.000Z');

describe('runInvoiceReconcile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('nilvera dep yok → no-op (faturalar pending bekler)', async () => {
    const { db } = makeDb([invRow()]);
    const s = await runInvoiceReconcile({ db, now });
    expect(s).toEqual({ pending: 0, issued: 0, failed: 0, skipped: 0, alerted: 0 });
  });

  it('pending fatura → Nilvera başarılı → issued (externalRef idempotent)', async () => {
    const { db, calls } = makeDb([invRow()]);
    const nilvera = { issueInvoice: vi.fn().mockResolvedValue({ invoiceId: 'nv-1', invoiceNumber: 'N1', kind: 'earsiv', pdfUrl: 'u' }) };
    const s = await runInvoiceReconcile({ db, nilvera, now });

    expect(s.issued).toBe(1);
    expect(nilvera.issueInvoice).toHaveBeenCalledWith(expect.objectContaining({ externalRef: 'inv-1' }));
    expect(calls.updates[0].status).toBe('issued');
    expect(calls.updates[0].nilveraInvoiceId).toBe('nv-1');
    expect(calls.updates[0].invoiceKind).toBe('earsiv');
  });

  it('Nilvera fail → retry++ + lastNilveraError; MAX denemede alert', async () => {
    const { db, calls } = makeDb([invRow({ retryCount: INVOICE_RECONCILE_MAX_RETRIES - 1 })]);
    const nilvera = { issueInvoice: vi.fn().mockRejectedValue(new Error('boom')) };
    const s = await runInvoiceReconcile({ db, nilvera, now });

    expect(s.failed).toBe(1);
    expect(s.alerted).toBe(1);
    expect(calls.updates[0].nilveraRetryCount).toBe(INVOICE_RECONCILE_MAX_RETRIES);
    expect(calls.updates[0].lastNilveraError).toContain('boom');
    expect(alertInvoiceFailed).toHaveBeenCalledTimes(1);
  });

  it('VKN yok → nihai tüketici e-Arşiv kesilir (skip değil)', async () => {
    const { db, calls } = makeDb([invRow({ vatNo: null })]);
    const nilvera = { issueInvoice: vi.fn().mockResolvedValue({ invoiceId: 'nv-nt', kind: 'earsiv' }) };
    const s = await runInvoiceReconcile({ db, nilvera, now });

    expect(s.issued).toBe(1);
    expect(s.skipped).toBe(0);
    expect(nilvera.issueInvoice).toHaveBeenCalledTimes(1);
    expect(
      (nilvera.issueInvoice.mock.calls[0][0] as { customer: { taxNumber: unknown } }).customer.taxNumber,
    ).toBeNull();
    expect(calls.updates[0].status).toBe('issued');
  });
});
