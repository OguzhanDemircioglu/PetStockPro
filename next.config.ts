import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy — 2026-05-17 production hazırlık.
 *
 * Beklenen dış kaynaklar:
 *   - Supabase: REST + Realtime (https/wss *.supabase.co)
 *   - Brevo: SMTP webhook (https *.brevo.com — server-side)
 *   - iyzico: subscription/webhook (https sandbox/prod URL — server-side, browser değil)
 *   - Nilvera: e-Arşiv API (server-side, browser değil)
 *   - Telegram: bot API (server-side, browser değil)
 *   - Cloudflare Turnstile: bot koruma widget (https challenges.cloudflare.com)
 *   - Sentry: error reporting (https *.ingest.sentry.io)
 *   - Cloudflare R2: image/sitemap storage (https *.r2.cloudflarestorage.com)
 *   - Supabase Storage: ürün görselleri (https *.supabase.co)
 *   - WhatsApp deep link: wa.me (anchor href, fetch değil — connect-src'a gerek yok)
 *
 * Next.js inline script/style ihtiyacı:
 *   - script-src 'unsafe-inline' (Next.js __NEXT_DATA__ vs)
 *   - style-src 'unsafe-inline' (Tailwind inline styles, shadcn dynamic)
 *   - Dev: 'unsafe-eval' (HMR + React DevTools)
 *
 * Strict: frame-ancestors 'none' clickjacking koruması (X-Frame-Options'tan üstün).
 */
function buildCsp(): string {
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.r2.cloudflarestorage.com https://imagedelivery.net",
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://challenges.cloudflare.com',
      'https://*.ingest.sentry.io',
      'https://*.r2.cloudflarestorage.com',
    ].join(' '),
    "frame-src 'self' https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Cloudflare Workers (OpenNext) için hazırlık — Sprint 14'te @opennextjs/cloudflare aktive edilecek
  typedRoutes: true,

  images: {
    remotePatterns: [
      // Supabase Storage (Frankfurt)
      { protocol: 'https', hostname: '*.supabase.co' },
      // Cloudflare R2 / Images (gelecek için yer tutucu)
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'imagedelivery.net' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Güvenlik header'ları — CSP 2026-05-17 tightened
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Content-Security-Policy', value: buildCsp() },
        ],
      },
    ];
  },
};

export default nextConfig;
