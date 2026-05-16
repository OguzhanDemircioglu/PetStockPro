import type { MetadataRoute } from 'next';
import { getPublicBaseUrl } from '@/lib/vitrin/sitemap-data';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicBaseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/vitrin'],
        // Admin + auth + API endpoint'leri arama motorlarına kapalı
        disallow: [
          '/admin',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/verify-email',
          '/2fa-setup',
          '/onboarding',
          '/account-locked',
          '/accept-invite',
          '/api',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
