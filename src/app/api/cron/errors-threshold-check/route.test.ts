import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {} as unknown,
}));

vi.mock('@/lib/errors/threshold', () => ({
  findActiveBursts: vi.fn(),
  markErrorAlerted: vi.fn(),
}));

const sendTelegramAlertMock = vi.fn();
vi.mock('@/lib/telegram/client', () => ({
  sendTelegramAlert: (...args: unknown[]) => sendTelegramAlertMock(...args),
}));

import { POST } from './route';
import { findActiveBursts, markErrorAlerted } from '@/lib/errors/threshold';

const mockedFind = vi.mocked(findActiveBursts);
const mockedMark = vi.mocked(markErrorAlerted);
const originalSecret = process.env.CRON_SECRET;

function req(auth?: string): Request {
  const headers = new Headers();
  if (auth) headers.set('authorization', auth);
  return new Request('http://localhost:3000/api/cron/errors-threshold-check', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sendTelegramAlertMock.mockResolvedValue(undefined);
  mockedMark.mockResolvedValue(true);
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

describe('POST /api/cron/errors-threshold-check', () => {
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

  it('200 — burst yoksa alertsSent=0', async () => {
    process.env.CRON_SECRET = 'secret';
    mockedFind.mockResolvedValue([]);
    const res = await POST(req('Bearer secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.burstsFound).toBe(0);
    expect(body.alertsSent).toBe(0);
    expect(sendTelegramAlertMock).not.toHaveBeenCalled();
  });

  it('200 — bursts varsa her biri için Telegram alert + markAlerted', async () => {
    process.env.CRON_SECRET = 'secret';
    mockedFind.mockResolvedValue([
      {
        errorType: 'PaymentValidationError',
        count: 7,
        windowMinutes: 60,
        firstOccurredAt: '2026-05-21T03:00:00Z',
        lastOccurredAt: '2026-05-21T03:50:00Z',
        lastSampleMessage: 'Invalid card token',
        lastSampleId: 'err-7',
      },
      {
        errorType: 'IyzicoWebhookOrchestrationError',
        count: 5,
        windowMinutes: 60,
        firstOccurredAt: '2026-05-21T03:10:00Z',
        lastOccurredAt: '2026-05-21T03:50:00Z',
        lastSampleMessage: 'orchestration failed',
        lastSampleId: 'err-8',
      },
    ]);
    const res = await POST(req('Bearer secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.burstsFound).toBe(2);
    expect(body.alertsSent).toBe(2);
    expect(sendTelegramAlertMock).toHaveBeenCalledTimes(2);
    expect(mockedMark).toHaveBeenCalledWith(expect.any(Object), 'err-7');
    expect(mockedMark).toHaveBeenCalledWith(expect.any(Object), 'err-8');
  });

  it('Telegram fail tek bir burst için diğerleri devam eder', async () => {
    process.env.CRON_SECRET = 'secret';
    mockedFind.mockResolvedValue([
      {
        errorType: 'A',
        count: 5,
        windowMinutes: 60,
        firstOccurredAt: '2026-05-21T03:00:00Z',
        lastOccurredAt: '2026-05-21T03:50:00Z',
        lastSampleMessage: 'x',
        lastSampleId: 'a-1',
      },
      {
        errorType: 'B',
        count: 6,
        windowMinutes: 60,
        firstOccurredAt: '2026-05-21T03:05:00Z',
        lastOccurredAt: '2026-05-21T03:55:00Z',
        lastSampleMessage: 'y',
        lastSampleId: 'b-1',
      },
    ]);
    sendTelegramAlertMock
      .mockRejectedValueOnce(new Error('Telegram down'))
      .mockResolvedValueOnce(undefined);
    const res = await POST(req('Bearer secret'));
    const body = await res.json();
    expect(body.burstsFound).toBe(2);
    expect(body.alertsSent).toBe(1); // sadece B başarılı
  });

  it('500 — findActiveBursts throw ederse execution_failed', async () => {
    process.env.CRON_SECRET = 'secret';
    mockedFind.mockRejectedValue(new Error('DB down'));
    const res = await POST(req('Bearer secret'));
    expect(res.status).toBe(500);
  });
});
