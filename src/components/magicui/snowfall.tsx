'use client';

import { useSyncExternalStore } from 'react';

interface Props {
  /** Tane sayısı (default 40). */
  number?: number;
}

type Flake = {
  left: string;
  delay: string;
  duration: string;
  size: string;
  drift: string;
  opacity: string;
};

function makeFlakes(count: number): Flake[] {
  return Array.from({ length: count }, () => ({
    left: Math.floor(Math.random() * 100) + '%',
    delay: (Math.random() * 8).toFixed(2) + 's',
    // Yavaş kar gibi düşüş: 6-12 saniye arası
    duration: (Math.random() * 6 + 6).toFixed(2) + 's',
    // Çeşitlilik için 2-5px boyut karışımı
    size: (Math.random() * 3 + 2).toFixed(1) + 'px',
    // Yan sallanma genliği -30..30px
    drift: (Math.random() * 60 - 30).toFixed(0) + 'px',
    // Opacity 0.5-1.0 arası — bazı taneler daha sönük
    opacity: (Math.random() * 0.5 + 0.5).toFixed(2),
  }));
}

let cachedNumber: number | null = null;
let cachedItems: Flake[] | null = null;
function makeFlakesCached(count: number): Flake[] {
  if (cachedNumber !== count || !cachedItems) {
    cachedNumber = count;
    cachedItems = makeFlakes(count);
  }
  return cachedItems;
}

function subscribeNoop(): () => void {
  return () => undefined;
}

const STORAGE_KEY = 'pp-snowfall-enabled';

/**
 * useSyncExternalStore wiring — server snapshot=true (default kar), client
 * snapshot=localStorage. Mutate olduğunda listener'ları tetikler.
 */
const enabledListeners = new Set<() => void>();
function getEnabledSnapshot(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}
function getEnabledServerSnapshot(): boolean {
  return true;
}
function subscribeEnabled(cb: () => void): () => void {
  enabledListeners.add(cb);
  return () => enabledListeners.delete(cb);
}
function setEnabledPersistent(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    /* localStorage unavailable */
  }
  enabledListeners.forEach((cb) => cb());
}

/**
 * Snowfall — yumuşak kar yağışı + toggle (kar aç/kapat butonları).
 *
 * Hero'nun pointer-events-none overlay'i; toggle butonları sağ alt köşede
 * pointer-events alır. localStorage 'pp-snowfall-enabled' ile persist eder
 * (default: 'true' — yeni kullanıcı için kar aktif).
 *
 * useSyncExternalStore SSR-safe: server snapshot null → DOM'da kar yok →
 * hydration mismatch yok. Client'ta cached flakes render eder.
 */
export function Snowfall({ number = 40 }: Props) {
  const items = useSyncExternalStore<Flake[] | null>(
    subscribeNoop,
    () => makeFlakesCached(number),
    () => null,
  );
  // useSyncExternalStore — server snapshot true, client localStorage. Hydration
  // sırasında server HTML'i ile client'ın ilk render'ı aynı (true), client
  // mount sonrası sub'lar fire eder ve localStorage değeri yansır.
  const enabled = useSyncExternalStore<boolean>(
    subscribeEnabled,
    getEnabledSnapshot,
    getEnabledServerSnapshot,
  );

  return (
    <>
      {enabled && items && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {items.map((f, i) => (
            <span
              key={i}
              className="absolute top-[-8px] rounded-full bg-white animate-snow-fall"
              style={{
                left: f.left,
                width: f.size,
                height: f.size,
                opacity: f.opacity,
                animationDelay: f.delay,
                animationDuration: f.duration,
                ['--snow-drift' as string]: f.drift,
                boxShadow: '0 0 4px rgba(255,255,255,0.6)',
              }}
            />
          ))}
        </div>
      )}

      {/* Sağ alt köşedeki toggle butonları — pointer-events alır */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
        <button
          type="button"
          data-testid="snow-on"
          onClick={() => setEnabledPersistent(true)}
          title="Kar yağmasını başlat"
          aria-pressed={enabled}
          className={`grid h-8 w-8 place-items-center rounded-full border backdrop-blur-sm transition-all ${
            enabled
              ? 'border-white bg-white/30 text-white shadow-sm'
              : 'border-white/40 bg-white/12 text-white/75 hover:bg-white/22'
          }`}
        >
          <SnowIcon size={14} />
        </button>
        <button
          type="button"
          data-testid="snow-off"
          onClick={() => setEnabledPersistent(false)}
          title="Kar yağmasını durdur"
          aria-pressed={!enabled}
          className={`grid h-8 w-8 place-items-center rounded-full border backdrop-blur-sm transition-all ${
            !enabled
              ? 'border-white bg-white/30 text-white shadow-sm'
              : 'border-white/40 bg-white/12 text-white/75 hover:bg-white/22'
          }`}
        >
          <CancelIcon size={14} />
        </button>
      </div>
    </>
  );
}

function SnowIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      <line x1="4.93" y1="19.07" x2="19.07" y2="4.93" />
      <line x1="7" y1="2" x2="12" y2="7" />
      <line x1="17" y1="2" x2="12" y2="7" />
      <line x1="7" y1="22" x2="12" y2="17" />
      <line x1="17" y1="22" x2="12" y2="17" />
    </svg>
  );
}

function CancelIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
