import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme/theme-provider';
import './globals.css';

/**
 * Theme flash prevention — runs before React hydrates.
 * Reads localStorage pp-theme (or matchMedia prefers-color-scheme) and
 * applies html.dark synchronously so first paint matches user pref.
 */
const themeBootScript = `
(function() {
  try {
    var t = localStorage.getItem('pp-theme');
    if (t !== 'dark' && t !== 'light') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {/* React 19 hoisted script — React, server-renderlandığında bu <script>
            etiketini `<head>` 'e otomatik taşır. beforeInteractive davranış sağlar,
            ek paket gereksiz. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
