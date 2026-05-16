import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {} as unknown,
}));

vi.mock('@/lib/vitrin/sitemap-data', () => ({
  collectSitemapEntries: vi.fn(),
  getPublicBaseUrl: vi.fn(() => 'https://petstockpro.com'),
}));

const putMock = vi.fn();
const cacheStoreMock = {
  source: 'memory' as const,
  get: vi.fn(),
  put: putMock,
};

vi.mock('@/lib/vitrin/sitemap-cache', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/vitrin/sitemap-cache')>(
      '@/lib/vitrin/sitemap-cache',
    );
  return {
    ...actual,
    getSitemapCacheStore: vi.fn(() => cacheStoreMock),
  };
});

import { POST } from './route';
import * as sitemapData from '@/lib/vitrin/sitemap-data';

const collectMock = vi.mocked(sitemapData.collectSitemapEntries);
const originalSecret = process.env.CRON_SECRET;

function req(auth?: string): Request {
  const headers = new Headers();
  if (auth) headers.set('authorization', auth);
  return new Request('http://localhost:3000/api/cron/sitemap-rebuild', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  collectMock.mockResolvedValue([
    { loc: 'https://petstockpro.com/', priority: 1.0 },
    { loc: 'https://petstockpro.com/vitrin', priority: 0.9 },
  ]);
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

describe('POST /api/cron/sitemap-rebuild', () => {
  it('CRON_SECRET yok → 503 cron_disabled', async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req('Bearer anything'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.reason).toBe('cron_disabled');
    expect(collectMock).not.toHaveBeenCalled();
  });

  it('Authorization yanlış → 401', async () => {
    process.env.CRON_SECRET = 'sek';
    const res = await POST(req('Bearer wrong'));
    expect(res.status).toBe(401);
    expect(collectMock).not.toHaveBeenCalled();
  });

  it('Authorization header eksik → 401', async () => {
    process.env.CRON_SECRET = 'sek';
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('Happy path — XML build + cache put + 200', async () => {
    process.env.CRON_SECRET = 'sek';
    const res = await POST(req('Bearer sek'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.entriesCount).toBe(2);
    expect(body.xmlBytes).toBeGreaterThan(0);
    expect(body.cacheSource).toBe('memory');

    expect(collectMock).toHaveBeenCalledTimes(1);
    expect(putMock).toHaveBeenCalledTimes(1);
    const [key, xml, opts] = putMock.mock.calls[0];
    expect(key).toBe('sitemap.xml');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('<loc>https://petstockpro.com/</loc>');
    expect(opts?.ttlSeconds).toBe(25 * 60 * 60);
  });

  it('collectSitemapEntries throw → 500 execution_failed', async () => {
    process.env.CRON_SECRET = 'sek';
    collectMock.mockRejectedValue(new Error('DB down'));
    const res = await POST(req('Bearer sek'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.reason).toBe('execution_failed');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('cache.put throw → 500 execution_failed', async () => {
    process.env.CRON_SECRET = 'sek';
    putMock.mockRejectedValue(new Error('R2 down'));
    const res = await POST(req('Bearer sek'));
    expect(res.status).toBe(500);
  });
});
