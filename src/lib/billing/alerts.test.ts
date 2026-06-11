import { describe, it, expect } from 'vitest';
import { buildPaymentAnomalyAlert, buildInvoiceFailedAlert, buildDunningAlert } from './alerts';

describe('billing alert builders', () => {
  it('owner_missing → critical + merchantOid içerir', () => {
    const a = buildPaymentAnomalyAlert({ kind: 'owner_missing', merchantOid: 'PSP-1', companyId: 'c1' });
    expect(a.severity).toBe('critical');
    expect(a.text).toContain('PSP-1');
    expect(a.text).toContain('uygulandı'); // ödeme yine uygulandı notu
  });

  it('amount_mismatch → critical + iade uyarısı', () => {
    const a = buildPaymentAnomalyAlert({ kind: 'amount_mismatch', merchantOid: 'PSP-2', detail: 'beklenen 2000' });
    expect(a.severity).toBe('critical');
    expect(a.text).toContain('iade');
  });

  it('subscription_not_found → warning (kritik değil)', () => {
    const a = buildPaymentAnomalyAlert({ kind: 'subscription_not_found', merchantOid: 'PSP-3' });
    expect(a.severity).toBe('warning');
  });

  it('invoice failed → critical + fatura id', () => {
    const a = buildInvoiceFailedAlert({ invoiceId: 'inv-1', companyId: 'c1', retryCount: 5, error: 'Nilvera 502' });
    expect(a.severity).toBe('critical');
    expect(a.text).toContain('inv-1');
    expect(a.text).toContain('Nilvera 502');
  });

  it('dunning: sürüyor → warning, tükendi → critical', () => {
    expect(buildDunningAlert({ companyId: 'c', subscriptionId: 's', retryCount: 1, exhausted: false }).severity).toBe('warning');
    expect(buildDunningAlert({ companyId: 'c', subscriptionId: 's', retryCount: 4, exhausted: true }).severity).toBe('critical');
  });

  it('HTML injection temizlenir (< > strip)', () => {
    const a = buildPaymentAnomalyAlert({ kind: 'amount_mismatch', merchantOid: 'PSP-1', detail: '<script>x</script>' });
    expect(a.text).not.toContain('<script>');
  });
});
