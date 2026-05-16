/**
 * /sitemap.xml — cache-first handler.
 *
 * Akış:
 *   1. SitemapCacheStore.get(SITEMAP_CACHE_KEY) → cache hit varsa → serve XML (X-Sitemap-Source: cache)
 *   2. Cache miss veya store down → collectSitemapEntries + buildSitemapXml dynamic SSR (X-Sitemap-Source: dynamic)
 *
 * Defense in depth: cache.get throw olursa fallback dynamic. Cache populate
 * /api/cron/sitemap-rebuild ile (Workers cron 03:00 UTC) yapılır.
 *
 * Production'da R2 binding aktive olduğunda cache hit ~5ms (DB roundtrip yok).
 * Dev'de in-memory store (process restart'ta boşalır); rebuild endpoint manuel
 * çağrılırsa cache populate olur, sonraki istek hit verir.
 */

import { db } from '@/lib/db/client';
import {
  getSitemapCacheStore,
  SITEMAP_CACHE_KEY,
  buildSitemapXml,
} from '@/lib/vitrin/sitemap-cache';
import {
  collectSitemapEntries,
  getPublicBaseUrl,
} from '@/lib/vitrin/sitemap-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const XML_CONTENT_TYPE = 'application/xml; charset=utf-8';

export async function GET() {
  // 1) Cache-first
  try {
    const store = getSitemapCacheStore();
    const cached = await store.get(SITEMAP_CACHE_KEY);
    if (cached) {
      return new Response(cached.xml, {
        status: 200,
        headers: {
          'Content-Type': XML_CONTENT_TYPE,
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'X-Sitemap-Source': 'cache',
          'X-Sitemap-Cached-At': cached.cachedAt.toISOString(),
        },
      });
    }
  } catch (err) {
    console.warn('[sitemap.xml] cache.get failed, dynamic fallback:', err);
  }

  // 2) Cache miss / down → dynamic SSR fallback
  const baseUrl = getPublicBaseUrl();
  const entries = await collectSitemapEntries(baseUrl, db);
  const xml = buildSitemapXml(
    entries.map((e) => ({
      loc: e.loc,
      lastModified: e.lastModified,
      changeFrequency: e.changeFrequency,
      priority: e.priority,
    })),
  );
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': XML_CONTENT_TYPE,
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600',
      'X-Sitemap-Source': 'dynamic',
    },
  });
}
