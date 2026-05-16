/**
 * dispatchScheduledCron unit testleri.
 *
 * Saf fonksiyon — fetch'i inject edip her code path'i kapsar.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  dispatchScheduledCron,
  CRON_ENDPOINT_MAP,
  type ScheduledEnv,
} from './scheduled-handler';

function makeFetch(response: { status?: number; ok?: boolean; _json?: unknown }) {
  const json = response._json ?? null;
  const status = response.status ?? 200;
  const ok = response.ok ?? (status >= 200 && status < 300);
  return vi.fn().mockResolvedValue({
    ok,
    status,
    async json() {
      return json;
    },
  } as unknown as Response);
}

describe('CRON_ENDPOINT_MAP', () => {
  it('günlük 06:00 UTC eşlemesi → /api/cron/daily-summary', () => {
    expect(CRON_ENDPOINT_MAP['0 6 * * *']).toBe('/api/cron/daily-summary');
  });

  it('gece 03:00 UTC eşlemesi → /api/cron/sitemap-rebuild', () => {
    expect(CRON_ENDPOINT_MAP['0 3 * * *']).toBe('/api/cron/sitemap-rebuild');
  });

  it('tüm endpoint path leading slash ile başlar', () => {
    for (const path of Object.values(CRON_ENDPOINT_MAP)) {
      expect(path.startsWith('/')).toBe(true);
    }
  });
});

describe('dispatchScheduledCron', () => {
  const baseEnv: ScheduledEnv = {
    CRON_SECRET: 'test-secret',
    NEXT_PUBLIC_APP_URL: 'https://example.test',
  };

  it('bilinmeyen cron expression → outcome=unknown_cron, fetch çağrılmaz', async () => {
    const fetchMock = makeFetch({ status: 200 });
    const result = await dispatchScheduledCron('*/5 * * * *', baseEnv, { fetch: fetchMock });

    expect(result.outcome).toBe('unknown_cron');
    expect(result.cron).toBe('*/5 * * * *');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('CRON_SECRET eksik → outcome=cron_secret_missing, fetch çağrılmaz', async () => {
    const fetchMock = makeFetch({ status: 200 });
    const result = await dispatchScheduledCron(
      '0 6 * * *',
      { NEXT_PUBLIC_APP_URL: 'https://example.test' },
      { fetch: fetchMock },
    );

    expect(result.outcome).toBe('cron_secret_missing');
    expect(result.endpoint).toBe('/api/cron/daily-summary');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('happy path → fetch çağrılır, doğru URL + Bearer header + outcome=dispatched', async () => {
    const fetchMock = makeFetch({
      status: 200,
      _json: { ok: true, summary: { total: 3, pending: 1 } },
    });
    const result = await dispatchScheduledCron('0 6 * * *', baseEnv, { fetch: fetchMock });

    expect(result.outcome).toBe('dispatched');
    expect(result.endpoint).toBe('/api/cron/daily-summary');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, summary: { total: 3, pending: 1 } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://example.test/api/cron/daily-summary');
    expect(calledInit.method).toBe('POST');
    expect(calledInit.headers.authorization).toBe('Bearer test-secret');
    expect(calledInit.headers['content-type']).toBe('application/json');
  });

  it('NEXT_PUBLIC_APP_URL eksik → localhost:3000 default', async () => {
    const fetchMock = makeFetch({ status: 200, _json: { ok: true } });
    await dispatchScheduledCron(
      '0 6 * * *',
      { CRON_SECRET: 'sekret' },
      { fetch: fetchMock },
    );

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('http://localhost:3000/api/cron/daily-summary');
  });

  it('endpoint 401 döndü → outcome=http_error + status korunur', async () => {
    const fetchMock = makeFetch({ status: 401, ok: false, _json: { error: 'unauthorized' } });
    const result = await dispatchScheduledCron('0 6 * * *', baseEnv, { fetch: fetchMock });

    expect(result.outcome).toBe('http_error');
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: 'unauthorized' });
  });

  it('endpoint 503 cron_disabled → outcome=http_error', async () => {
    const fetchMock = makeFetch({
      status: 503,
      ok: false,
      _json: { ok: false, reason: 'cron_disabled' },
    });
    const result = await dispatchScheduledCron('0 6 * * *', baseEnv, { fetch: fetchMock });

    expect(result.outcome).toBe('http_error');
    expect(result.status).toBe(503);
  });

  it('fetch throw → outcome=http_error + error mesajı yakalanır', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network refused'));
    const result = await dispatchScheduledCron('0 6 * * *', baseEnv, { fetch: fetchMock });

    expect(result.outcome).toBe('http_error');
    expect(result.error).toBe('network refused');
  });

  it('endpoint JSON parse fail (body boş) → outcome=dispatched, body=null', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      async json() {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    } as unknown as Response);
    const result = await dispatchScheduledCron('0 6 * * *', baseEnv, { fetch: fetchMock });

    expect(result.outcome).toBe('dispatched');
    expect(result.body).toBeNull();
  });

  it('non-Error throw (string) → error stringe çevrilir', async () => {
    const fetchMock = vi.fn().mockRejectedValue('plain string error');
    const result = await dispatchScheduledCron('0 6 * * *', baseEnv, { fetch: fetchMock });

    expect(result.outcome).toBe('http_error');
    expect(result.error).toBe('plain string error');
  });
});
