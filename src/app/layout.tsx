import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { Providers } from './providers';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'PetStockPro — Pet shop yönetim platformu',
    template: '%s · PetStockPro',
  },
  description:
    'Pet shop\'unun envanteri, satışı, vitrini ve raporları tek panelde. Cloudflare edge altyapısında çalışır, KVKK uyumlu.',
  keywords: ['pet shop', 'stok takip', 'envanter', 'satış kaydı', 'vitrin', 'PetStockPro', 'pet shop yazılımı'],
  authors: [{ name: 'PetStockPro' }],
  creator: 'PetStockPro',
  publisher: 'PetStockPro',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://petstockpro.com'),
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: '/',
    siteName: 'PetStockPro',
    title: 'PetStockPro — Pet shop yönetim platformu',
    description: 'Stoktan satışa, vitrinden rapora — tek panelde.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#1a2530' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-side theme resolve from cookie (no flash, no inline script).
  // Client toggle yazarken hem `document.cookie` hem localStorage'a yazar.
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('pp-theme')?.value;
  const isDark = themeCookie === 'dark';
  const htmlClass = `h-full antialiased${isDark ? ' dark' : ''}`;

  return (
    <html lang="tr" className={htmlClass} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider initialTheme={isDark ? 'dark' : 'light'}>
          {/* TanStack Query — client component'lerde useQuery/useMutation
              (FAZ 4 + FAZ 5 — 5 kritik CRUD optimistic). Theme dış, Query iç:
              theme cookie-driven SSR, query client-only. */}
          <Providers>{children}</Providers>
        </ThemeProvider>
        {/* Vercel Web Vitals + trafik analizi (performans izleme) */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
