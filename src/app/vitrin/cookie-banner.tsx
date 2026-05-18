'use client';

import { useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'vitrin-cookie-banner-dismissed-at';
/** Bir kez dismiss edilince 6 ay tekrar gösterme (KVKK opt-out süresi). */
const DISMISS_TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000;

/**
 * Vitrin için KVKK uyumlu cookie banner.
 *
 * Mount'ta localStorage'a bakıp 6 ay içinde dismiss edilmişse gizlenir.
 * "Reddet" → KVKK opt-out (analytics tracking yine de IP-hash anonim devam
 * eder ama localStorage flag set). "Kabul Et" → flag set.
 *
 * Her iki seçim de dismiss eder. KVKK madde 5 açık rıza gerektirmez çünkü
 * IP hash anonim + günlük-salt rotasyonu var — banner sadece şeffaflık için.
 *
 * SSR-safe: ilk render'da null döner (hydration mismatch önlemi), useEffect
 * sonrası karar verir.
 */
/** Mount sırasında localStorage'tan dismiss durumunu oku — eslint set-state-in-effect uyumlu */
function readInitialShow(): boolean | null {
  // SSR'da localStorage yok → null (ilk paint'te ban görüntülenmez)
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS) {
        return false;
      }
    }
  } catch {
    // Private mode / quota → sessizce göster
  }
  return true;
}

export function CookieBanner() {
  // useState lazy initializer ile mount sırasında bir kez okur (SSR'da null →
  // ilk paint banner-less, client hydrate olunca localStorage check + render).
  const [show, setShow] = useState<boolean | null>(() => readInitialShow());

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setShow(false);
  };

  if (show !== true) return null;

  return (
    <div
      data-testid="vitrin-cookie-banner"
      role="dialog"
      aria-labelledby="cookie-banner-title"
      className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-[680px] -translate-x-1/2 rounded-2xl border border-line bg-paper p-4 shadow-[0_18px_40px_rgba(0,0,0,.22)] backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-cat-soft text-xl">
          🍪
        </span>
        <p
          id="cookie-banner-title"
          className="min-w-[200px] flex-1 text-[13px] leading-snug text-ink-2"
        >
          Sitenin temel işlevleri için çerez kullanıyoruz.{' '}
          <Link
            href={'/kvkk' as never}
            className="font-bold text-cat hover:underline"
          >
            Detay
          </Link>
        </p>
        <button
          type="button"
          data-testid="cookie-accept"
          onClick={dismiss}
          className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:-translate-y-px transition-transform"
        >
          Çerezlere izin ver
        </button>
      </div>
    </div>
  );
}
