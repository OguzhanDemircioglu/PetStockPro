import type { MetadataRoute } from 'next';
import { db } from '@/lib/db/client';
import {
  collectSitemapEntries,
  getPublicBaseUrl,
} from '@/lib/vitrin/sitemap-data';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1 saat cache (DB değişikliğinin SEO'ya yansıması)

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
