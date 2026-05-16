/**
 * Sitemap cache — pre-built XML için R2 storage abstraction.
 *
 * MVP'de `/sitemap.xml` dynamic SSR (Next.js MetadataRoute.Sitemap). 50K+ URL
 * sınırına yaklaşırsa pre-build pattern aktive olur:
 *
 *   pg_cron veya Workers cron 03:00 UTC → /api/cron/sitemap-rebuild →
 *   collectSitemapEntries → XML serialize → R2 PUT → /sitemap.xml R2 GET
 *
 * Production: Cloudflare R2 binding (`env.SITEMAP_R2`).
 * Dev: in-memory Map fallback (process restart'ta sıfırlanır, test için yeter).
 *
 * Üç adımlı build/serve flow:
 *   1. /api/cron/sitemap-rebuild → buildSitemapXml + saveSitemap
 *   2. /sitemap.xml → loadSitemap (R2 cache miss → dynamic fallback)
 *   3. Workers cron tetikler, tetikleyici Bearer CRON_SECRET ile auth
 */

export interface SitemapCacheStore {
  /** Anahtara göre cached XML oku. Yoksa null. */
  get(key: string): Promise<{ xml: string; cachedAt: Date } | null>;

  /** XML cache'le. TTL opsiyonel (R2 lifecycle rule ile yönetilebilir). */
  put(key: string, xml: string, opts?: { ttlSeconds?: number }): Promise<void>;

  /** Backend tipi. */
  readonly source: 'r2' | 'memory' | 'noop';
}

/** Cloudflare R2 binding shape — minimal. */
export interface R2BucketLike {
  get(key: string): Promise<{ body: ReadableStream; text(): Promise<string>; uploaded: Date } | null>;
  put(key: string, value: string, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

export class R2SitemapCacheStore implements SitemapCacheStore {
  readonly source = 'r2' as const;
  constructor(private readonly r2: R2BucketLike) {}

  async get(key: string): Promise<{ xml: string; cachedAt: Date } | null> {
    const obj = await this.r2.get(key);
    if (!obj) return null;
    const xml = await obj.text();
    return { xml, cachedAt: obj.uploaded };
  }

  async put(key: string, xml: string): Promise<void> {
    await this.r2.put(key, xml, {
      httpMetadata: { contentType: 'application/xml; charset=utf-8' },
    });
  }
}

interface MemEntry {
  xml: string;
  cachedAt: Date;
  expiresAt: number | null;
}

export class InMemorySitemapCacheStore implements SitemapCacheStore {
  readonly source = 'memory' as const;
  private readonly map = new Map<string, MemEntry>();
  private readonly now: () => number;

  constructor(opts: { now?: () => number } = {}) {
    this.now = opts.now ?? Date.now;
  }

  async get(key: string): Promise<{ xml: string; cachedAt: Date } | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.map.delete(key);
      return null;
    }
    return { xml: entry.xml, cachedAt: entry.cachedAt };
  }

  async put(
    key: string,
    xml: string,
    opts?: { ttlSeconds?: number },
  ): Promise<void> {
    const now = this.now();
    const expiresAt =
      opts?.ttlSeconds && opts.ttlSeconds > 0
        ? now + opts.ttlSeconds * 1000
        : null;
    this.map.set(key, { xml, cachedAt: new Date(now), expiresAt });
  }

  _size(): number {
    return this.map.size;
  }
}

interface GlobalWithR2 {
  SITEMAP_R2?: R2BucketLike;
}

let memoryCache: InMemorySitemapCacheStore | null = null;

export function getSitemapCacheStore(): SitemapCacheStore {
  const g = globalThis as unknown as GlobalWithR2;
  if (g.SITEMAP_R2) {
    return new R2SitemapCacheStore(g.SITEMAP_R2);
  }
  if (!memoryCache) {
    memoryCache = new InMemorySitemapCacheStore();
  }
  return memoryCache;
}

/** Test yardımcısı. */
export function _resetSitemapCacheStoreForTest(): void {
  memoryCache = null;
}

/** Standart sitemap anahtarı. */
export const SITEMAP_CACHE_KEY = 'sitemap.xml';

/**
 * SitemapEntry[] → XML serialize.
 *
 * Next.js MetadataRoute.Sitemap default'ı protocol XML üretir; pre-build için
 * aynı format manuel olarak burada hazırlanır (Workers'ta XML serializer yok).
 */
export interface SitemapXmlEntry {
  loc: string;
  lastModified?: Date | string;
  changeFrequency?: string;
  priority?: number;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&apos;';
      default:
        return c;
    }
  });
}

export function buildSitemapXml(entries: SitemapXmlEntry[]): string {
  const urls = entries
    .map((e) => {
      const parts = [`<loc>${escapeXml(e.loc)}</loc>`];
      if (e.lastModified) {
        const iso =
          e.lastModified instanceof Date
            ? e.lastModified.toISOString()
            : String(e.lastModified);
        parts.push(`<lastmod>${escapeXml(iso)}</lastmod>`);
      }
      if (e.changeFrequency) {
        parts.push(`<changefreq>${escapeXml(e.changeFrequency)}</changefreq>`);
      }
      if (typeof e.priority === 'number') {
        parts.push(`<priority>${e.priority.toFixed(1)}</priority>`);
      }
      return `<url>${parts.join('')}</url>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
