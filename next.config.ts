import type { NextConfig } from 'next';

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

  // Güvenlik header'ları — CSP Sprint 2'de Turnstile + Sentry için detaylanır
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
        ],
      },
    ];
  },
};

export default nextConfig;
