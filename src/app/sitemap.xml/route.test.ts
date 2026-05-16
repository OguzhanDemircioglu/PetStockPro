import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {} as unknown,
}));

vi.mock('@/lib/vitrin/sitemap-data', () => ({
  collectSitemapEntries: vi.fn(),
  getPublicBaseUrl: vi.fn(() => 'https://petstockpro.com'),
}));

const cacheStoreMock = {
  source: 'memory' as const,
  get: vi.fn(),
  put: vi.fn(),
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

import { GET } from './route';
import * as sitemapData from '@/lib/vitrin/sitemap-data';

const collectMock = vi.mocked(sitemapData.collectSitemapEntries);

beforeEach(() => {
  vi.clearAllMocks();
  collectMock.mockResolvedValue([
    { loc: 'https://petstockpro.com/', priority: 1.0 },
  ]);
});

describe('GET /sitemap.xml', () => {
  it('Cache hit → 200 + XML + X-Sitemap-Source: cache + cached-at header', async () => {
    const cachedAt = new Date('2026-05-17T03:00:00Z');
    cacheStoreMock.get.mockResolvedValue({
      xml: '<?xml version="1.0"?><urlset>cached</urlset>',
      cachedAt,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(
      'application/xml; charset=utf-8',
    );
    expect(res.headers.get('x-sitemap-source')).toBe('cache');
    expect(res.headers.get('x-sitemap-cached-at')).toBe(
      '2026-05-17T03:00:00.000Z',
    );
    const text = await res.text();
    expect(text).toContain('cached');

    expect(collectMock).not.toHaveBeenCalled(); // DB hiç sorgulanmadı (hızlı yol)
  });

  it('Cache miss → 200 + dynamic SSR fallback + X-Sitemap-Source: dynamic', async () => {
    cacheStoreMock.get.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('x-sitemap-source')).toBe('dynamic');
    expect(res.headers.get('x-sitemap-cached-at')).toBeNull();
    const text = await res.text();
    expect(text).toContain('<urlset');
    expect(text).toContain('<loc>https://petstockpro.com/</loc>');

    expect(collectMock).toHaveBeenCalledTimes(1);
  });

  it('Cache throw → dynamic SSR fallback (defense in depth)', async () => {
    cacheStoreMock.get.mockRejectedValue(new Error('R2 down'));

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('x-sitemap-source')).toBe('dynamic');
    expect(collectMock).toHaveBeenCalledTimes(1);
  });

  it('Cache hit XML body olduğu gibi serve eder (regenerate yok)', async () => {
    cacheStoreMock.get.mockResolvedValue({
      xml: 'MY-CUSTOM-XML-PAYLOAD',
      cachedAt: new Date(),
    });

    const res = await GET();
    const text = await res.text();
    expect(text).toBe('MY-CUSTOM-XML-PAYLOAD');
  });

  it('Cache hit Cache-Control: stale-while-revalidate header', async () => {
    cacheStoreMock.get.mockResolvedValue({
      xml: '<xml/>',
      cachedAt: new Date(),
    });
    const res = await GET();
    expect(res.headers.get('cache-control')).toContain('stale-while-revalidate');
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
  });

  it('Cache miss Cache-Control: kısa max-age (10dk) + SWR 1h', async () => {
    cacheStoreMock.get.mockResolvedValue(null);
    const res = await GET();
    expect(res.headers.get('cache-control')).toContain('max-age=600');
    expect(res.headers.get('cache-control')).toContain('stale-while-revalidate=3600');
  });
});
