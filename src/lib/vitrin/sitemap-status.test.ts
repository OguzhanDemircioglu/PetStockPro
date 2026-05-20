import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getSitemapStatus,
  countLocTags,
  SITEMAP_STALE_THRESHOLD_HOURS,
} from './sitemap-status';
import {
  getSitemapCacheStore,
  SITEMAP_CACHE_KEY,
  _resetSitemapCacheStoreForTest,
} from './sitemap-cache';

describe('countLocTags', () => {
  it('empty XML → 0', () => {
    expect(countLocTags('<urlset></urlset>')).toBe(0);
  });

  it('3 url → 3', () => {
    const xml = '<urlset><url><loc>a</loc></url><url><loc>b</loc></url><url><loc>c</loc></url></urlset>';
    expect(countLocTags(xml)).toBe(3);
  });

  it('garbage string → 0', () => {
    expect(countLocTags('no xml here')).toBe(0);
  });
});

describe('getSitemapStatus', () => {
  beforeEach(() => {
    _resetSitemapCacheStoreForTest();
    delete process.env.CRON_SECRET;
    delete process.env.R2_BUCKET;
  });

  afterEach(() => {
    _resetSitemapCacheStoreForTest();
  });

  it('cache yok → cached=false, stale=false, healthy=false', async () => {
    const status = await getSitemapStatus();
    expect(status.cached).toBe(false);
    expect(status.cachedAt).toBeNull();
    expect(status.ageHours).toBeNull();
    expect(status.xmlBytes).toBeNull();
    expect(status.urlCount).toBeNull();
    expect(status.stale).toBe(false);
    expect(status.healthy).toBe(false);
    expect(status.cacheBackend).toBe('memory');
  });

  it('fresh cache → healthy=true, stale=false, age<1h', async () => {
    const store = getSitemapCacheStore();
    const xml =
      '<?xml version="1.0"?><urlset><url><loc>https://x.com</loc></url><url><loc>https://y.com</loc></url></urlset>';
    await store.put(SITEMAP_CACHE_KEY, xml);

    const status = await getSitemapStatus();
    expect(status.cached).toBe(true);
    expect(status.urlCount).toBe(2);
    expect(status.xmlBytes).toBe(xml.length);
    expect(status.stale).toBe(false);
    expect(status.healthy).toBe(true);
    expect(status.ageHours).toBeLessThan(1);
    expect(status.cachedAt).not.toBeNull();
  });

  it('cache 26h eski → stale=true, healthy=false', async () => {
    const store = getSitemapCacheStore();
    const xml = '<urlset><url><loc>https://x.com</loc></url></urlset>';
    await store.put(SITEMAP_CACHE_KEY, xml);
    // 26 saat sonra now ile çağır
    const now = new Date(Date.now() + 26 * 60 * 60 * 1000);
    const status = await getSitemapStatus(now);
    expect(status.cached).toBe(true);
    expect(status.stale).toBe(true);
    expect(status.healthy).toBe(false);
    expect(status.ageHours).toBeGreaterThan(SITEMAP_STALE_THRESHOLD_HOURS);
  });

  it('cache tam stale threshold sınırında (25h) → stale=false', async () => {
    const store = getSitemapCacheStore();
    await store.put(SITEMAP_CACHE_KEY, '<urlset></urlset>');
    // 24 saat sonra → henüz stale değil
    const now = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const status = await getSitemapStatus(now);
    expect(status.stale).toBe(false);
    expect(status.healthy).toBe(true);
  });

  it('CRON_SECRET set ise cronConfigured=true', async () => {
    process.env.CRON_SECRET = 'shh';
    const status = await getSitemapStatus();
    expect(status.cronConfigured).toBe(true);
  });

  it('R2_BUCKET set ise r2Configured=true', async () => {
    process.env.R2_BUCKET = 'petstockpro-sitemap';
    const status = await getSitemapStatus();
    expect(status.r2Configured).toBe(true);
  });
});
