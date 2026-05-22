'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary — render veya server action sırasında throw edilen
 * hataları yakalar. Next.js varsayılan İngilizce sayfası yerine TR + marka.
 *
 * useEffect ile hata log'lanır (production'da Sentry'ye düşer; dev'de console).
 * `digest` Next.js production build'lerinde stack trace yerine kullanılan
 * hash — destek talebinde referans verilir.
 *
 * NOT: bu sınır root layout'tan SONRAki tüm route'lar için geçerli.
 * Layout'un kendisi throw ederse global-error.tsx tetiklenir (Faz 2'de eklenir).
 */
export default function ErrorBoundary({ error, reset }: Props) {
  useEffect(() => {
    // Production'da Sentry init'liyse hata yakalanır; aksi halde console.
    console.error('[error-boundary]', error);

    // Next.js dev RSC payload fetch hatası — server action redirect sonrası
    // client router cache miss. Hard navigation ile auto-recover.
    if (error?.message?.includes('Failed to fetch')) {
      window.location.reload();
    }
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center px-6 py-16">
      <div className="max-w-md text-center">
        <Image
          src="/logo.webp"
          alt="PetStockPro"
          width={96}
          height={96}
          priority
          className="mx-auto h-24 w-24 object-contain"
        />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-cart">
          Bir şeyler ters gitti
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">
          Beklenmedik bir hata oluştu. Tekrar denemek için aşağıdaki butonu
          kullanabilirsin. Sorun devam ederse destekle iletişime geç.
        </p>

        {error.digest && (
          <div
            data-testid="error-digest"
            className="mt-4 inline-block rounded-lg bg-danger-soft px-3 py-1.5 text-[12.5px] font-mono text-danger-7"
          >
            Hata kodu: {error.digest}
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <button
            type="button"
            onClick={reset}
            data-testid="error-retry-button"
            className="rounded-xl bg-cat px-4 py-2 font-bold text-white shadow-sm"
          >
            ↻ Tekrar dene
          </button>
          <Link
            href={'/admin' as never}
            data-testid="error-admin-link"
            className="rounded-xl border border-line bg-white px-4 py-2 font-bold text-ink-2 hover:bg-line-soft"
          >
            🏠 Admin paneline dön
          </Link>
        </div>

        <p className="mt-8 text-[12px] text-ink-4">
          Destek:{' '}
          <a
            href="mailto:destek@petstockpro.com"
            className="text-cat hover:underline"
          >
            destek@petstockpro.com
          </a>
        </p>
      </div>
    </main>
  );
}
