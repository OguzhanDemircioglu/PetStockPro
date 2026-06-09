import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/lib/nilvera/invoice', () => ({ createNilveraInvoice: vi.fn() }));
vi.mock('@/lib/nilvera/config', () => ({ isNilveraConfigured: vi.fn(() => true) }));
vi.mock('@/lib/paytr/config', () => ({
  getPaytrConfig: vi.fn(() => ({ merchantKey: 'k', merchantSalt: 's', testMode: 1, baseUrl: 'https://www.paytr.com' })),
}));
vi.mock('@/lib/paytr/hash', () => ({ verifyPaytrCallbackHash: vi.fn(() => true) }));
vi.mock('@/lib/billing/orchestrator', () => ({
  processPaytrCallback: vi.fn(async () => ({ outcome: 'payment_succeeded', merchantOid: 'PSP-1' })),
}));

import { POST } from './route';
import { getPaytrConfig } from '@/lib/paytr/config';
import { verifyPaytrCallbackHash } from '@/lib/paytr/hash';
import { processPaytrCallback } from '@/lib/billing/orchestrator';

function formRequest(fields: Record<string, string>): Request {
  return new Request('http://localhost/api/webhooks/paytr', {
    method: 'POST',
    body: new URLSearchParams(fields).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
}

const okFields = { merchant_oid: 'PSP-1', status: 'success', total_amount: '100000', hash: 'abc', payment_type: 'card' };

describe('POST /api/webhooks/paytr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPaytrConfig).mockReturnValue({ merchantKey: 'k', merchantSalt: 's', testMode: 1, baseUrl: 'https://www.paytr.com' });
    vi.mocked(verifyPaytrCallbackHash).mockReturnValue(true);
    vi.mocked(processPaytrCallback).mockResolvedValue({ outcome: 'payment_succeeded', merchantOid: 'PSP-1' });
  });

  it('geçerli hash + işlendi → "OK" 200 + doğru input', async () => {
    const res = await POST(formRequest(okFields));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
    expect(processPaytrCallback).toHaveBeenCalledTimes(1);
    const input = vi.mocked(processPaytrCallback).mock.calls[0][0];
    expect(input.merchantOid).toBe('PSP-1');
    expect(input.status).toBe('success');
    expect(input.totalAmount).toBe('100000');
  });

  it('eksik alan → 400, orchestrator çağrılmaz', async () => {
    const res = await POST(formRequest({ merchant_oid: 'PSP-1' }));
    expect(res.status).toBe(400);
    expect(processPaytrCallback).not.toHaveBeenCalled();
  });

  it('geçersiz hash → 400, "OK" DEĞİL, orchestrator çağrılmaz', async () => {
    vi.mocked(verifyPaytrCallbackHash).mockReturnValue(false);
    const res = await POST(formRequest(okFields));
    expect(res.status).toBe(400);
    expect(await res.text()).not.toBe('OK');
    expect(processPaytrCallback).not.toHaveBeenCalled();
  });

  it('yapılandırma eksik (merchant_key yok) → 500, orchestrator çağrılmaz', async () => {
    vi.mocked(getPaytrConfig).mockReturnValue({ merchantKey: undefined, merchantSalt: undefined, testMode: 1, baseUrl: 'https://www.paytr.com' });
    const res = await POST(formRequest(okFields));
    expect(res.status).toBe(500);
    expect(processPaytrCallback).not.toHaveBeenCalled();
  });

  it('orchestrator throw → 500 (PayTR retry istenir)', async () => {
    vi.mocked(processPaytrCallback).mockRejectedValue(new Error('DB down'));
    const res = await POST(formRequest(okFields));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toBe('OK');
  });

  it('duplicate outcome → yine "OK" 200 (retry spam önleme)', async () => {
    vi.mocked(processPaytrCallback).mockResolvedValue({ outcome: 'duplicate', merchantOid: 'PSP-1' });
    const res = await POST(formRequest(okFields));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
  });

  it('subscription_not_found → yine "OK" 200 (orphan, retry anlamsız)', async () => {
    vi.mocked(processPaytrCallback).mockResolvedValue({ outcome: 'subscription_not_found', merchantOid: 'PSP-1' });
    const res = await POST(formRequest(okFields));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
  });

  it('status=failed → input.status failed + failedReason', async () => {
    await POST(formRequest({ ...okFields, status: 'failed', failed_reason_msg: 'kart reddedildi' }));
    const input = vi.mocked(processPaytrCallback).mock.calls[0][0];
    expect(input.status).toBe('failed');
    expect(input.failedReason).toBe('kart reddedildi');
  });
});
