/**
 * Sitemap pre-build cache durum bilgisi — süperadmin paneli için.
 *
 * 2026-05-21 — Plan B (CLAUDE.md "Sıradaki olası işler #16"). Süperadmin
 * sistem ayarları paneline cache izleme kartı + Telegram alert (rebuild fail
 * veya stale cache durumunda).
 *
 * Veri kaynakları:
 *   - SitemapCacheStore (R2 production veya in-memory dev) → cached XML + cachedAt
 *   - process.env → CRON_SECRET / R2_BUCKET / NEXT_PUBLIC_APP_URL
 *
 * "stale" threshold: 25 saat (cron 24h aralık + 1h tolerans, sitemap-rebuild
 * route'unda TTL ile aynı).
 */

import {
  getSitemapCacheStore,
  SITEMAP_CACHE_KEY,
  type SitemapCacheStore,
} from './sitemap-cache';

/** "stale" eşiği — 25 saat. Cron 24h + 1h tolerans. */
export const SITEMAP_STALE_THRESHOLD_HOURS = 25;

export interface SitemapStatus {
  /** Cache backend tipi. 'r2' → production binding aktif; 'memory' → dev fallback. */
  cacheBackend: SitemapCacheStore['source'];
  /** Cache satırı bulundu mu? */
  cached: boolean;
  /** Son rebuild zamanı (ISO string, JSON-safe). */
  cachedAt: string | null;
  /** Cache yaşı — saat olarak. null → cache yok. */
  ageHours: number | null;
  /** Cached XML boyutu (byte). null → cache yok. */
  xmlBytes: number | null;
  /** Yaklaşık URL adedi (XML `<loc>` sayısı). null → cache yok. */
  urlCount: number | null;
  /** Cron tetikleyicisi configure edilmiş mi? (CRON_SECRET set). */
  cronConfigured: boolean;
  /** R2 binding configure edilmiş mi? (R2_BUCKET env set). */
  r2Configured: boolean;
  /** Cache 25h+ eski mi? (rebuild başarısız veya cron çalışmıyor olabilir.) */
  stale: boolean;
  /** Cache yoksa veya stale ise UI'da kırmızı banner. */
  healthy: boolean;
}

/**
 * Singleton store'dan cache durumunu çek + env değerleri ile birleştir.
 *
 * Süperadmin SystemSettingsPage'de çağrılır (server-side). 1-2 round-trip
 * (R2 GET); diğer panel sorgularıyla `Promise.all` ile paralel.
 */
export async function getSitemapStatus(
  now: Date = new Date(),
): Promise<SitemapStatus> {
  const store = getSitemapCacheStore();
  const entry = await store.get(SITEMAP_CACHE_KEY).catch(() => null);

  const cronConfigured = !!process.env.CRON_SECRET;
  const r2Configured = !!process.env.R2_BUCKET;

  if (!entry) {
    return {
      cacheBackend: store.source,
      cached: false,
      cachedAt: null,
      ageHours: null,
      xmlBytes: null,
      urlCount: null,
      cronConfigured,
      r2Configured,
      stale: false, // cache yok = "fresh build bekliyor", stale kavramı uygulanmaz
      healthy: false, // ama cron çalışıyorsa cache yokluğu yine sağlıksız
    };
  }

  const ageMs = now.getTime() - entry.cachedAt.getTime();
  const ageHours = Math.max(0, ageMs / (60 * 60 * 1000));
  const stale = ageHours > SITEMAP_STALE_THRESHOLD_HOURS;
  const urlCount = countLocTags(entry.xml);

  return {
    cacheBackend: store.source,
    cached: true,
    cachedAt: entry.cachedAt.toISOString(),
    ageHours,
    xmlBytes: entry.xml.length,
    urlCount,
    cronConfigured,
    r2Configured,
    stale,
    healthy: !stale,
  };
}

/**
 * XML içinde `<loc>` etiketi sayısı — kabaca URL adedi.
 * Regex tabanlı (XML parse'a gerek yok, hız öncelikli).
 */
export function countLocTags(xml: string): number {
  const matches = xml.match(/<loc>/g);
  return matches ? matches.length : 0;
}
