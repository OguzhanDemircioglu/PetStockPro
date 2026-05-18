'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root layout throw'ları için global error boundary.
 *
 * `error.tsx` sadece RootLayout'tan SONRA render edilen alt route'ların
 * hatalarını yakalar. RootLayout'un kendisi throw ederse (layout.tsx içindeki
 * provider hatası vs.) bu sayfa devreye girer ve `<html>` + `<body>` dahil
 * ÖZEL HTML render eder (çünkü layout zaten kırılmış olabilir).
 *
 * Stil inline tutulur (Tailwind CSS bile RootLayout üzerinden yüklendiği için
 * burada kullanılamaz garantisi yok). Mümkün olan en sade fallback.
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          fontFamily: 'Verdana, system-ui, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          backgroundColor: '#fafaf9',
          color: '#1c1917',
        }}
      >
        <div style={{ maxWidth: '420px', textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.webp"
            alt="PetStockPro"
            width={96}
            height={96}
            style={{ width: '96px', height: '96px', objectFit: 'contain', margin: '0 auto' }}
          />
          <h1
            style={{
              marginTop: '24px',
              fontSize: '28px',
              fontWeight: 700,
              color: '#312e81',
            }}
          >
            Uygulama hatası
          </h1>
          <p
            style={{
              marginTop: '12px',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#57534e',
            }}
          >
            Beklenmedik bir kritik hata oluştu. Lütfen sayfayı yenile veya
            destek ekibimizle iletişime geç.
          </p>

          {error.digest && (
            <div
              data-testid="global-error-digest"
              style={{
                display: 'inline-block',
                marginTop: '16px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                fontFamily: 'monospace',
                fontSize: '11px',
              }}
            >
              Hata kodu: {error.digest}
            </div>
          )}

          <div
            style={{
              marginTop: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={reset}
              data-testid="global-error-retry"
              style={{
                padding: '8px 20px',
                borderRadius: '12px',
                backgroundColor: '#f97316',
                color: 'white',
                fontWeight: 700,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ↻ Tekrar dene
            </button>
          </div>

          <p
            style={{
              marginTop: '32px',
              fontSize: '11px',
              color: '#78716c',
            }}
          >
            Destek:{' '}
            <a
              href="mailto:destek@petstockpro.com"
              style={{ color: '#f97316', textDecoration: 'underline' }}
            >
              destek@petstockpro.com
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
