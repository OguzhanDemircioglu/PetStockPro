import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {} as unknown,
}));

vi.mock('@/lib/cleanup/retention', () => ({
  runRetentionCleanup: vi.fn(),
}));

const sendTelegramAlertMock = vi.fn();
vi.mock('@/lib/telegram/client', () => ({
  sendTelegramAlert: (...args: unknown[]) => sendTelegramAlertMock(...args),
}));

import { POST } from './route';
import { runRetentionCleanup } from '@/lib/cleanup/retention';

const mockedCleanup = vi.mocked(runRetentionCleanup);
const originalSecret = process.env.CRON_SECRET;

function req(auth?: string): Request {
  const headers = new Headers();
  if (auth) headers.set('authorization', auth);
  return new Request('http://localhost:3000/api/cron/cleanup-old-logs', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sendTelegramAlertMock.mockResolvedValue(undefined);
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

describe('POST /api/cron/cleanup-old-logs', () => {
  it('503 — CRON_SECRET yoksa', async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req('Bearer x'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.reason).toBe('cron_disabled');
  });

  it('401 — yanlış Bearer', async () => {
    process.env.CRON_SECRET = 'correct';
    const res = await POST(req('Bearer wrong'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.reason).toBe('unauthorized');
  });

  it('200 — happy path + Telegram alert fire-and-forget', async () => {
    process.env.CRON_SECRET = 'secret';
    mockedCleanup.mockResolvedValue({
      startedAt: '2026-05-21T04:00:00.000Z',
      finishedAt: '2026-05-21T04:00:01.000Z',
      totalDeleted: 42,
      totalDurationMs: 1000,
      hasErrors: false,
      rules: [
        { table: 'system_errors', ageDays: 90, deletedCount: 12, durationMs: 100 },
      ],
    });
    const res = await POST(req('Bearer secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totalDeleted).toBe(42);
    expect(sendTelegramAlertMock).toHaveBeenCalledTimes(1);
  });

  it('500 — runRetentionCleanup throw ederse execution_failed döner', async () => {
    process.env.CRON_SECRET = 'secret';
    mockedCleanup.mockRejectedValue(new Error('DB down'));
    const res = await POST(req('Bearer secret'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.reason).toBe('execution_failed');
  });
});
