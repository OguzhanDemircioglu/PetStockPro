/**
 * Sitemap pre-build cron endpoint — Sprint 12 ext.
 *
 * Cloudflare Workers cron veya pg_cron 03:00 UTC (06:00 TR) ile günlük çalışır.
 * collectSitemapEntries → buildSitemapXml → SitemapCacheStore.put (R2 production
 * / in-memory dev).
 *
 * /sitemap.xml route bu cache'den serve eder (varsa); cache miss → dynamic SSR.
 *
 * Bearer auth: env CRON_SECRET ile match. Manuel test (dev):
 *   curl -X POST http://localhost:3000/api/cron/sitemap-rebuild \
 *     -H "Authorization: Bearer dev-cron-secret-local"
 */

import { db } from '@/lib/db/client';
import {
  buildSitemapXml,
  getSitemapCacheStore,
  SITEMAP_CACHE_KEY,
} from '@/lib/vitrin/sitemap-cache';
import {
  collectSitemapEntries,
  getPublicBaseUrl,
} from '@/lib/vitrin/sitemap-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { ok: false, reason: 'cron_disabled', hint: 'CRON_SECRET env yok' },
      { status: 503 },
    );
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  try {
    const baseUrl = getPublicBaseUrl();
    const entries = await collectSitemapEntries(baseUrl, db);
    const xml = buildSitemapXml(entries);
    const store = getSitemapCacheStore();
    // 25 saat TTL — günlük cron tetiklemesi başarısız olursa 1 saat tolerans
    await store.put(SITEMAP_CACHE_KEY, xml, { ttlSeconds: 25 * 60 * 60 });
    return Response.json(
      {
        ok: true,
        entriesCount: entries.length,
        xmlBytes: xml.length,
        cacheSource: store.source,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[cron:sitemap-rebuild] failed:', err);
    return Response.json(
      { ok: false, reason: 'execution_failed' },
      { status: 500 },
    );
  }
}
