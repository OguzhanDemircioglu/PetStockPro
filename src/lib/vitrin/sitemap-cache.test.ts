import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildSitemapXml,
  getSitemapCacheStore,
  InMemorySitemapCacheStore,
  R2SitemapCacheStore,
  _resetSitemapCacheStoreForTest,
  type R2BucketLike,
  SITEMAP_CACHE_KEY,
} from './sitemap-cache';

describe('InMemorySitemapCacheStore', () => {
  it('source = "memory"', () => {
    expect(new InMemorySitemapCacheStore().source).toBe('memory');
  });

  it('get bilinmeyen key → null', async () => {
    const store = new InMemorySitemapCacheStore();
    expect(await store.get('foo')).toBeNull();
  });

  it('put + get round-trip', async () => {
    const store = new InMemorySitemapCacheStore({ now: () => 1_000_000 });
    await store.put('foo', '<xml>hi</xml>');
    const got = await store.get('foo');
    expect(got).not.toBeNull();
    expect(got?.xml).toBe('<xml>hi</xml>');
    expect(got?.cachedAt).toEqual(new Date(1_000_000));
  });

  it('TTL süresince korunur, sonra silinir (lazy)', async () => {
    let fakeNow = 1_000_000;
    const store = new InMemorySitemapCacheStore({ now: () => fakeNow });
    await store.put('foo', '<xml/>', { ttlSeconds: 10 });
    fakeNow = 1_009_999;
    expect(await store.get('foo')).not.toBeNull();
    fakeNow = 1_010_001;
    expect(await store.get('foo')).toBeNull();
    expect(store._size()).toBe(0); // lazy evict
  });

  it('ttlSeconds yoksa süresiz', async () => {
    let fakeNow = 1_000_000;
    const store = new InMemorySitemapCacheStore({ now: () => fakeNow });
    await store.put('foo', '<xml/>');
    fakeNow = 999_999_999_999;
    expect(await store.get('foo')).not.toBeNull();
  });

  it('put aynı key → üzerine yazar', async () => {
    const store = new InMemorySitemapCacheStore();
    await store.put('foo', '<xml>v1</xml>');
    await store.put('foo', '<xml>v2</xml>');
    expect((await store.get('foo'))?.xml).toBe('<xml>v2</xml>');
  });
});

describe('R2SitemapCacheStore', () => {
  function makeFakeR2(): R2BucketLike & {
    _puts: Array<{ key: string; value: string; contentType?: string }>;
    _objs: Map<string, { value: string; uploaded: Date }>;
  } {
    const objs = new Map<string, { value: string; uploaded: Date }>();
    const puts: Array<{ key: string; value: string; contentType?: string }> = [];
    return {
      _puts: puts,
      _objs: objs,
      async get(key) {
        const obj = objs.get(key);
        if (!obj) return null;
        return {
          body: new ReadableStream(),
          async text() {
            return obj.value;
          },
          uploaded: obj.uploaded,
        };
      },
      async put(key, value, opts) {
        objs.set(key, { value, uploaded: new Date('2026-05-17T03:00:00Z') });
        puts.push({
          key,
          value,
          contentType: opts?.httpMetadata?.contentType,
        });
      },
    };
  }

  it('source = "r2"', () => {
    expect(new R2SitemapCacheStore(makeFakeR2()).source).toBe('r2');
  });

  it('get bilinmeyen → null', async () => {
    const store = new R2SitemapCacheStore(makeFakeR2());
    expect(await store.get('foo')).toBeNull();
  });

  it('put + get round-trip', async () => {
    const r2 = makeFakeR2();
    const store = new R2SitemapCacheStore(r2);
    await store.put('sitemap.xml', '<xml>hi</xml>');
    const got = await store.get('sitemap.xml');
    expect(got?.xml).toBe('<xml>hi</xml>');
    expect(got?.cachedAt).toEqual(new Date('2026-05-17T03:00:00Z'));
  });

  it('put content-type XML olarak yazar', async () => {
    const r2 = makeFakeR2();
    const store = new R2SitemapCacheStore(r2);
    await store.put('sitemap.xml', '<xml/>');
    expect(r2._puts[0].contentType).toBe('application/xml; charset=utf-8');
  });
});

describe('getSitemapCacheStore factory', () => {
  beforeEach(() => {
    _resetSitemapCacheStoreForTest();
    delete (globalThis as Record<string, unknown>).SITEMAP_R2;
  });
  afterEach(() => {
    _resetSitemapCacheStoreForTest();
    delete (globalThis as Record<string, unknown>).SITEMAP_R2;
  });

  it('R2 binding YOKsa → InMemorySitemapCacheStore', () => {
    const store = getSitemapCacheStore();
    expect(store.source).toBe('memory');
    expect(store).toBeInstanceOf(InMemorySitemapCacheStore);
  });

  it('R2 binding VARsa → R2SitemapCacheStore', () => {
    (globalThis as Record<string, unknown>).SITEMAP_R2 = {
      async get() {
        return null;
      },
      async put() {},
    };
    const store = getSitemapCacheStore();
    expect(store.source).toBe('r2');
    expect(store).toBeInstanceOf(R2SitemapCacheStore);
  });

  it('memory store singleton', () => {
    const a = getSitemapCacheStore();
    const b = getSitemapCacheStore();
    expect(a).toBe(b);
  });
});

describe('buildSitemapXml', () => {
  it('boş → empty urlset', () => {
    const xml = buildSitemapXml([]);
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
    );
  });

  it('tek entry → loc + opsiyonel field\'lar', () => {
    const xml = buildSitemapXml([
      {
        loc: 'https://petstockpro.com/',
        lastModified: new Date('2026-05-17T00:00:00Z'),
        changeFrequency: 'weekly',
        priority: 1.0,
      },
    ]);
    expect(xml).toContain('<loc>https://petstockpro.com/</loc>');
    expect(xml).toContain('<lastmod>2026-05-17T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>1.0</priority>');
  });

  it('XML special char escape', () => {
    const xml = buildSitemapXml([
      { loc: 'https://petstockpro.com/vitrin?q=a&b=c<>"\'' },
    ]);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
    expect(xml).toContain('&apos;');
  });

  it('lastModified string olarak verilirse de çalışır', () => {
    const xml = buildSitemapXml([
      { loc: 'https://x.test', lastModified: '2026-01-01' },
    ]);
    expect(xml).toContain('<lastmod>2026-01-01</lastmod>');
  });

  it('priority opsiyonel — atlanırsa <priority> yok', () => {
    const xml = buildSitemapXml([{ loc: 'https://x.test' }]);
    expect(xml).not.toContain('<priority>');
    expect(xml).not.toContain('<lastmod>');
    expect(xml).not.toContain('<changefreq>');
  });

  it('iki entry → iki <url>', () => {
    const xml = buildSitemapXml([{ loc: 'https://a' }, { loc: 'https://b' }]);
    expect((xml.match(/<url>/g) || []).length).toBe(2);
  });
});

describe('SITEMAP_CACHE_KEY', () => {
  it('= "sitemap.xml"', () => {
    expect(SITEMAP_CACHE_KEY).toBe('sitemap.xml');
  });
});
