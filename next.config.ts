import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Bundle analyzer — `ANALYZE=true npm run build` ile aktive olur.
 * Production build sonrası `.next/analyze/client.html` + `nodejs.html`
 * + `edge.html` raporlarını yazar. Route bazlı bundle size + tree-shaking
 * incelemesi için. MVP'de opsiyonel; lansman öncesi performance audit
 * için kullanılır (SPRINT-PLAN §18.2).
 */
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

/**
 * Content-Security-Policy — 2026-05-17 production hazırlık.
 *
 * Beklenen dış kaynaklar:
 *   - Supabase: REST + Realtime (https/wss *.supabase.co)
 *   - Brevo: SMTP webhook (https *.brevo.com — server-side)
 *   - PayTR: ödeme iframe (https://www.paytr.com/odeme/guvenli/<token>) — BROWSER-SIDE,
 *     frame-src + script-src (iframeResizer.min.js) izin gerekir.
 *   - 3D Secure (CANLI mod): PayTR iframe içinden kartın BANKASINA göre değişen bir ACS
 *     domaininde frame açılır (BKM, VakıfBank, Garanti, İş, Akbank... her biri farklı,
 *     öngörülemez). TEST modunda PayTR içinde simüle olduğu için fark edilmedi; canlıda
 *     bankaya göre ERR_BLOCKED_BY_CSP verdi (2026-06-30). Allowlist sürdürülemez → frame-src
 *     ve form-action tüm HTTPS'e açıldı (aşağıda gerekçe).
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
/**
 * @param opts.paymentPage true ise YALNIZ ödeme sayfası (/admin/settings/billing) için profil:
 *   frame-src + form-action `https:` (PayTR iframe'inin 3DS adımında kartın bankasına göre
 *   ÖNGÖRÜLEMEZ ACS/acquirer domaine — BKM, VakıfBank gateway, Garanti/İş/Akbank... — navigate
 *   etmesine izin). PayTR iframe'i bizim DOĞRUDAN çocuğumuz olduğu için onu banka domainine
 *   götüren navigasyonu BİZİM frame-src'imiz yönetir; tek tek allowlist sürdürülemez.
 *   Diğer tüm sayfalarda frame-src yalnız Turnstile, form-action 'self' (SIKI).
 *   Detaylı gerekçe: docs/PLAN-PAYTR-3DS-CSP.md.
 */
function buildCsp(opts: { paymentPage?: boolean } = {}): string {
  const isPayment = opts.paymentPage === true;
  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com https://www.paytr.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.r2.cloudflarestorage.com https://*.r2.dev https://imagedelivery.net https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://challenges.cloudflare.com',
      'https://*.ingest.sentry.io',
      'https://*.r2.cloudflarestorage.com',
      'https://*.r2.dev',
      // Ödeme sayfası: PayTR iframeResizer.min.js sourcemap (.map) fetch'i (devtools açıkken
      // konsol hatası vermesin). Fonksiyonel değil ama "detay atlanmasın" temizliği.
      ...(isPayment ? ['https://www.paytr.com'] : []),
    ].join(' '),
    isPayment
      ? "frame-src 'self' https:"
      : "frame-src 'self' https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    isPayment ? "form-action 'self' https:" : "form-action 'self'",
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

  // Tur 6 (P1-5): Tree-shake büyük paket import'ları — sadece kullanılan export'lar
  // bundle'a dahil. 928K chunk küçültmek hedefli, modüler import barrel'ları optimize.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@tanstack/react-query',
      '@tanstack/react-query-devtools',
      'date-fns',
      'recharts',
    ],
  },

  // Auto-bootstrap (PLAN-BETA-PERFORMANCE.md FAZ 1) — src/instrumentation.ts'i çalıştırır.
  // Next.js 16'da instrumentation hook stable (default-on); explicit dokümantasyon niyetiyle yazılır.
  // BOOTSTRAP_SKIP=1 ile devre dışı bırakılabilir (production CI/CD migration önceden çalıştırırsa).
  // Not: Next.js 16 ile experimental.instrumentationHook kaldırıldı, sadece dosyanın varlığı yeter.

  images: {
    remotePatterns: [
      // Supabase Storage (Frankfurt) — e-Arşiv PDF
      { protocol: 'https', hostname: '*.supabase.co' },
      // Cloudflare R2 — ürün görselleri (2026-05-21 R2 strategy)
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: 'imagedelivery.net' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Eski Türkçe yasal URL'ler → yeni İngilizce URL'ler (kalıcı redirect).
  // PayTR/Google'a verilmiş eski linkler kırılmasın diye 301/308 yönlendirilir.
  async redirects() {
    return [
      { source: '/kvkk', destination: '/privacy-policy', permanent: true },
      { source: '/cerez-politikasi', destination: '/cookie-policy', permanent: true },
      { source: '/uyelik-sozlesmesi', destination: '/terms-of-service', permanent: true },
      {
        source: '/mesafeli-satis-sozlesmesi',
        destination: '/distance-sales-agreement',
        permanent: true,
      },
      { source: '/iletisim', destination: '/contact', permanent: true },
    ];
  },

  // Güvenlik header'ları. CSP iki profil (docs/PLAN-PAYTR-3DS-CSP.md):
  //   - /admin/settings/billing (ödeme): frame-src/form-action gevşek (3DS banka frame'leri)
  //   - diğer her yer: sıkı
  // Kurallar KARŞILIKLI DIŞLAYAN (negatif lookahead) — aynı path birden çok CSP header alırsa
  // tarayıcı KESİŞİMİ uygular (en katı kazanır) → gevşetme işe yaramazdı. Bu yüzden ödeme
  // path'i strict kuralının dışında bırakılır → her path tam olarak BİR CSP header alır.
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
    ];
    const csp = (paymentPage: boolean) => ({
      key: 'Content-Security-Policy',
      value: buildCsp({ paymentPage }),
    });
    return [
      // Ödeme sayfası (tam yol) — gevşek frame-src/form-action
      { source: '/admin/settings/billing', headers: [...securityHeaders, csp(true)] },
      // Ödeme alt-yolları + trailing slash — aynı gevşek profil
      { source: '/admin/settings/billing/:path*', headers: [...securityHeaders, csp(true)] },
      // Diğer her şey — sıkı (billing prefix'i hariç → çift CSP header önlenir)
      { source: '/((?!admin/settings/billing).*)', headers: [...securityHeaders, csp(false)] },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
