import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sayfa bulunamadı — PetStockPro',
  description: 'Aradığınız sayfa mevcut değil veya taşınmış olabilir.',
  robots: { index: false, follow: false },
};

/**
 * Global 404 sayfası — eşleşmeyen tüm route'lar buraya düşer.
 * Next.js varsayılan İngilizce sayfası yerine TR + marka uyumlu UI.
 *
 * Tasarım: minimal, paw mascot + tek CTA. SaaS landing yokken /admin (auth gate)
 * veya /vitrin (public) en güvenli yönlendirme.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-6 py-16">
      <div className="max-w-md text-center">
        <div className="text-7xl" aria-hidden>
          🐾
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-cart">
          Sayfa bulunamadı
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">
          Aradığın sayfa mevcut değil veya taşınmış olabilir. Aşağıdaki
          linklerden birine geçebilirsin.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <Link
            href={'/vitrin' as never}
            data-testid="not-found-vitrin-link"
            className="rounded-xl bg-cat px-4 py-2 font-bold text-white shadow-sm"
          >
            📍 Pet shop dizinine git
          </Link>
          <Link
            href={'/admin' as never}
            data-testid="not-found-admin-link"
            className="rounded-xl border border-line bg-white px-4 py-2 font-bold text-ink-2 hover:bg-line-soft"
          >
            🏠 Admin paneline dön
          </Link>
        </div>
        <p className="mt-8 text-[12px] text-ink-4">
          Bağlantı bozuk gibiyse{' '}
          <a
            href="mailto:destek@petstockpro.com"
            className="text-cat hover:underline"
          >
            destek@petstockpro.com
          </a>{' '}
          adresine bildirebilirsin.
        </p>
      </div>
    </main>
  );
}
