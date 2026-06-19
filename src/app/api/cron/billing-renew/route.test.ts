import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/lib/nilvera/invoice', () => ({ resolveAndIssueInvoice: vi.fn() }));
vi.mock('@/lib/nilvera/config', () => ({ isNilveraConfigured: vi.fn(() => true) }));
vi.mock('@/lib/billing/renewals', () => ({
  runBillingRenewals: vi.fn(async () => ({ due: 1, renewed: 1, failed: 0, waitCallback: 0, expired: 0, errors: 0 })),
}));

import { POST } from './route';
import { runBillingRenewals } from '@/lib/billing/renewals';

function req(auth?: string): Request {
  return new Request('http://localhost/api/cron/billing-renew', {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
  });
}

describe('POST /api/cron/billing-renew', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'secret-x');
    vi.mocked(runBillingRenewals).mockResolvedValue({ due: 1, renewed: 1, failed: 0, waitCallback: 0, expired: 0, errors: 0, skippedInFlight: 0 });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('CRON_SECRET yok → 503, job çalışmaz', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = await POST(req('Bearer secret-x'));
    expect(res.status).toBe(503);
    expect(runBillingRenewals).not.toHaveBeenCalled();
  });

  it('yanlış auth → 401', async () => {
    const res = await POST(req('Bearer wrong'));
    expect(res.status).toBe(401);
    expect(runBillingRenewals).not.toHaveBeenCalled();
  });

  it('auth yok → 401', async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('doğru auth → 200 + özet', async () => {
    const res = await POST(req('Bearer secret-x'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.renewed).toBe(1);
    expect(runBillingRenewals).toHaveBeenCalledTimes(1);
  });

  it('job throw → 500', async () => {
    vi.mocked(runBillingRenewals).mockRejectedValue(new Error('DB down'));
    const res = await POST(req('Bearer secret-x'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
