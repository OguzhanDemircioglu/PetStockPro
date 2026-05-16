import type { MetadataRoute } from 'next';
import { db } from '@/lib/db/client';
import {
  collectSitemapEntries,
  getPublicBaseUrl,
} from '@/lib/vitrin/sitemap-data';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1 saat cache (DB değişikliğinin SEO'ya yansıması)

/**
 * Next.js MetadataRoute.Sitemap default flow.
 *
 * NOT: Cache-first serve etmek istiyorsak doğrudan XML response döndüren ayrı bir
 * route handler gerekir (Next.js sitemap() helper'ı XML formatlamayı kendisi yapar).
 * Pre-build R2 cache şu an pasif — `/api/cron/sitemap-rebuild` ile populate edilir,
 * `/sitemap.xml` hâlâ dynamic SSR. 50K+ URL'e ulaştığında bu file'ın yerini
 * `/sitemap.xml/route.ts` handler alacak (cache GET → 200 XML, miss → dynamic).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getPublicBaseUrl();
  const entries = await collectSitemapEntries(baseUrl, db);
  return entries.map((e) => ({
    url: e.loc,
    lastModified: e.lastModified,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}
