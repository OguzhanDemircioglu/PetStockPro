'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'vitrin-cookie-banner-dismissed-at';
/** Kullanıcının seçimi — accepted / rejected (ileride non-essential cookie gate'i için). */
const CONSENT_KEY = 'vitrin-cookie-consent';
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

function markChoice(accepted: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    window.localStorage.setItem(CONSENT_KEY, accepted ? 'accepted' : 'rejected');
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
      className="fixed bottom-2 left-1/2 z-50 w-[calc(100%-1rem)] max-w-[540px] -translate-x-1/2 rounded-2xl border border-line bg-paper px-3.5 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,.20)] backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-cat-soft text-base">
          🍪
        </span>
        <p
          id="cookie-banner-title"
          className="min-w-[160px] flex-1 text-[12.5px] leading-snug text-ink-2"
        >
          Sitenin temel işlevleri için çerez kullanıyoruz.{' '}
          <Link
            href="/privacy-policy"
            className="font-bold text-cat hover:underline"
          >
            Detay
          </Link>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="cookie-reject"
            onClick={() => markChoice(false)}
            className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-bold text-ink-2 transition-colors hover:bg-line-soft"
          >
            Reddet
          </button>
          <button
            type="button"
            data-testid="cookie-accept"
            onClick={() => markChoice(true)}
            className="rounded-lg bg-gradient-to-br from-cat to-cat-2 px-3.5 py-1.5 text-[12.5px] font-bold text-white shadow-sm transition-transform hover:-translate-y-px"
          >
            Çerezlere izin ver
          </button>
        </div>
      </div>
    </div>
  );
}
