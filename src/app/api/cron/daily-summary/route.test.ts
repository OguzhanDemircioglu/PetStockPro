/**
 * POST /api/cron/daily-summary route handler unit tests.
 *
 * Cron endpoint Bearer auth + business helper (buildDailyReportSummary +
 * buildDailyReportSummaryAlert + sendTelegramAlert) wire-up'ı test eder.
 * İş mantığı kendi modüllerinde (summary.test.ts + messages.test.ts) ayrı test edilir.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {} as unknown,
}));

vi.mock('@/lib/vitrin/summary', () => ({
  buildDailyReportSummary: vi.fn(),
}));

vi.mock('@/lib/telegram/messages', () => ({
  buildDailyReportSummaryAlert: vi.fn(),
}));

vi.mock('@/lib/telegram/client', () => ({
  sendTelegramAlert: vi.fn(),
}));

import { POST } from './route';
import * as summaryMod from '@/lib/vitrin/summary';
import * as messagesMod from '@/lib/telegram/messages';
import * as telegramMod from '@/lib/telegram/client';

const buildSummaryMock = vi.mocked(summaryMod.buildDailyReportSummary);
const buildAlertMock = vi.mocked(messagesMod.buildDailyReportSummaryAlert);
const sendAlertMock = vi.mocked(telegramMod.sendTelegramAlert);

const originalCronSecret = process.env.CRON_SECRET;

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set('authorization', authHeader);
  return new Request('http://localhost:3000/api/cron/daily-summary', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // İşlevsel default — her test özelleştirebilir
  buildSummaryMock.mockResolvedValue({
    windowHours: 24,
    totalReports: 3,
    pendingCount: 2,
    resolvedCount: 1,
    dismissedCount: 0,
    topTenants: [{ companyName: 'Test Pet Shop', pendingCount: 2 }],
  });
  buildAlertMock.mockReturnValue({
    severity: 'info',
    text: 'mock alert',
  } as never);
  sendAlertMock.mockResolvedValue({ ok: true, mock: true });
});

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe('POST /api/cron/daily-summary', () => {
  it('CRON_SECRET env yok → 503 cron_disabled', async () => {
    delete process.env.CRON_SECRET;

    const res = await POST(makeRequest('Bearer anything'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('cron_disabled');
    expect(buildSummaryMock).not.toHaveBeenCalled();
  });

  it('Authorization header yanlış → 401 unauthorized', async () => {
    process.env.CRON_SECRET = 'production-secret';

    const res = await POST(makeRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.reason).toBe('unauthorized');
    expect(buildSummaryMock).not.toHaveBeenCalled();
  });

  it('Authorization header eksik (null) → 401', async () => {
    process.env.CRON_SECRET = 'production-secret';

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('Bearer prefix eksik (sadece secret) → 401', async () => {
    process.env.CRON_SECRET = 'production-secret';

    const res = await POST(makeRequest('production-secret'));
    expect(res.status).toBe(401);
  });

  it('Happy path — auth OK + summary build + alert send → 200 + özet', async () => {
    process.env.CRON_SECRET = 'production-secret';

    const res = await POST(makeRequest('Bearer production-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.summary).toEqual({
      total: 3,
      pending: 2,
      resolved: 1,
      dismissed: 0,
      topCount: 1,
    });

    expect(buildSummaryMock).toHaveBeenCalledTimes(1);
    expect(buildSummaryMock).toHaveBeenCalledWith(expect.anything(), 24);

    expect(buildAlertMock).toHaveBeenCalledTimes(1);
    const alertArg = buildAlertMock.mock.calls[0][0];
    expect(alertArg.totalReports).toBe(3);
    expect(alertArg.panelUrl).toBe('/admin/superadmin/vitrin-moderation?tab=reports');

    expect(sendAlertMock).toHaveBeenCalledTimes(1);
  });

  it('buildDailyReportSummary throw → 500 execution_failed', async () => {
    process.env.CRON_SECRET = 'production-secret';
    buildSummaryMock.mockRejectedValue(new Error('DB connection lost'));

    const res = await POST(makeRequest('Bearer production-secret'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('execution_failed');
    expect(sendAlertMock).not.toHaveBeenCalled();
  });

  it('sendTelegramAlert throw → 500 execution_failed (alert send aşaması)', async () => {
    process.env.CRON_SECRET = 'production-secret';
    sendAlertMock.mockRejectedValue(new Error('telegram api down'));

    const res = await POST(makeRequest('Bearer production-secret'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.reason).toBe('execution_failed');
  });
});
