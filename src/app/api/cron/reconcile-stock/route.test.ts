import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({ db: {} as unknown }));

vi.mock('@/lib/stock/reconcile', () => ({ reconcileStock: vi.fn() }));

const sendTelegramAlertMock = vi.fn();
vi.mock('@/lib/telegram/client', () => ({
  sendTelegramAlert: (...args: unknown[]) => sendTelegramAlertMock(...args),
}));

const trackErrorMock = vi.fn();
vi.mock('@/lib/errors/track', () => ({
  trackError: (...args: unknown[]) => trackErrorMock(...args),
}));

import { POST } from './route';
import { reconcileStock } from '@/lib/stock/reconcile';

const mockedReconcile = vi.mocked(reconcileStock);
const originalSecret = process.env.CRON_SECRET;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

function req(auth?: string): Request {
  const headers = new Headers();
  if (auth) headers.set('authorization', auth);
  return new Request('http://localhost:3000/api/cron/reconcile-stock', { method: 'POST', headers });
}

const CLEAN = {
  ok: true,
  stockDriftCount: 0,
  counterDriftCount: 0,
  stockDriftSample: [],
  counterDriftSample: [],
};
const DRIFT = {
  ok: false,
  stockDriftCount: 2,
  counterDriftCount: 1,
  stockDriftSample: [
    { companyId: 'c1', branchId: 'b1', variantId: 'v1', cached: 10, ledgerSum: 7, diff: 3 },
    { companyId: 'c1', branchId: 'b2', variantId: 'v2', cached: 5, ledgerSum: 8, diff: -3 },
  ],
  counterDriftSample: [{ companyId: 'c1', productId: 'p1', cached: 15, computed: 12, diff: 3 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  sendTelegramAlertMock.mockResolvedValue(undefined);
  trackErrorMock.mockResolvedValue({ ok: true, id: 'e1' });
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe('POST /api/cron/reconcile-stock', () => {
  it('503 — CRON_SECRET yoksa', async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req('Bearer x'));
    expect(res.status).toBe(503);
  });

  it('401 — yanlış Bearer', async () => {
    process.env.CRON_SECRET = 'correct';
    const res = await POST(req('Bearer wrong'));
    expect(res.status).toBe(401);
  });

  it('200 — drift yoksa alert/trackError YOK', async () => {
    process.env.CRON_SECRET = 'secret';
    mockedReconcile.mockResolvedValue(CLEAN);
    const res = await POST(req('Bearer secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.drift).toBe(false);
    expect(body.stockDriftCount).toBe(0);
    expect(sendTelegramAlertMock).not.toHaveBeenCalled();
    expect(trackErrorMock).not.toHaveBeenCalled();
  });

  it('200 — drift varsa trackError(critical) + Telegram alert', async () => {
    process.env.CRON_SECRET = 'secret';
    mockedReconcile.mockResolvedValue(DRIFT);
    const res = await POST(req('Bearer secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.drift).toBe(true);
    expect(body.stockDriftCount).toBe(2);
    expect(body.counterDriftCount).toBe(1);
    expect(trackErrorMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramAlertMock).toHaveBeenCalledTimes(1);
    expect(trackErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object),
      expect.anything(),
      expect.objectContaining({ severity: 'critical', errorTypeOverride: 'StockReconcileDrift' }),
    );
  });

  it('200 — drift var ama Telegram fail → yine 200 (best-effort), trackError yine çağrılır', async () => {
    process.env.CRON_SECRET = 'secret';
    mockedReconcile.mockResolvedValue(DRIFT);
    sendTelegramAlertMock.mockRejectedValue(new Error('Telegram down'));
    const res = await POST(req('Bearer secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.drift).toBe(true);
    expect(trackErrorMock).toHaveBeenCalledTimes(1);
  });

  it('500 — reconcileStock throw ederse execution_failed', async () => {
    process.env.CRON_SECRET = 'secret';
    mockedReconcile.mockRejectedValue(new Error('DB down'));
    const res = await POST(req('Bearer secret'));
    expect(res.status).toBe(500);
  });
});
