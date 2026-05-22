'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'vitrin-cookie-banner-dismissed-at';
/** Bir kez dismiss edilince 6 ay tekrar gösterme (KVKK opt-out süresi). */
const DISMISS_TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000;

/**
 * Vitrin için KVKK uyumlu cookie banner.
 *
 * useSyncExternalStore ile SSR-safe: server snapshot + ilk hydration banner
 * gizli (dismissed=true) — server HTML ile client DOM eşleşir. Hydration
 * sonrası client snapshot çağrılır, localStorage'a bakılır, banner
 * gerekiyorsa görünür hale gelir.
 *
 * Dismiss tıklanınca localStorage flag set + subscribers notified.
 */
const subscribers = new Set<() => void>();
let cachedDismissed: boolean | null = null;

function readDismissedFromStorage(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS) {
        return true;
      }
    }
  } catch {
    /* Private mode / quota — banner göster */
  }
  return false;
}

function getDismissedSnapshot(): boolean {
  if (cachedDismissed === null) {
    cachedDismissed = readDismissedFromStorage();
  }
  return cachedDismissed;
}

/** Server + ilk hydration: banner gizli (dismissed=true). */
function getDismissedServerSnapshot(): boolean {
  return true;
}

function subscribeDismissed(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function markDismissed(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
  cachedDismissed = true;
  subscribers.forEach((cb) => cb());
}

export function CookieBanner() {
  const dismissed = useSyncExternalStore<boolean>(
    subscribeDismissed,
    getDismissedSnapshot,
    getDismissedServerSnapshot,
  );

  if (dismissed) return null;

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
          onClick={markDismissed}
          className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:-translate-y-px transition-transform"
        >
          Çerezlere izin ver
        </button>
      </div>
    </div>
  );
}
