'use client';

import { useSyncExternalStore } from 'react';

interface Props {
  /** Tane sayısı kar için (default 40). Yağmur 1.5× yoğunluk. */
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

type Drop = {
  left: string;
  delay: string;
  duration: string;
  height: string;
  drift: string;
  opacity: string;
};

type Star = {
  left: string;
  delay: string;
  duration: string;
  size: string;
  drift: string;
  opacity: string;
  hue: 'gold' | 'amber';
};

type Meteor = {
  left: string;         // Başlangıç yatay: %0-100 random
  delay: string;
  duration: string;
  tailLength: string;
};

function makeFlakes(count: number): Flake[] {
  return Array.from({ length: count }, () => ({
    left: Math.floor(Math.random() * 100) + '%',
    delay: (Math.random() * 8).toFixed(2) + 's',
    duration: (Math.random() * 6 + 6).toFixed(2) + 's',
    size: (Math.random() * 3 + 2).toFixed(1) + 'px',
    drift: (Math.random() * 60 - 30).toFixed(0) + 'px',
    opacity: (Math.random() * 0.5 + 0.5).toFixed(2),
  }));
}

function makeDrops(count: number): Drop[] {
  return Array.from({ length: count }, () => ({
    left: Math.floor(Math.random() * 100) + '%',
    delay: (Math.random() * 1.5).toFixed(2) + 's',
    // Yağmur kardan hızlı: 0.9-1.8 saniye
    duration: (Math.random() * 0.9 + 0.9).toFixed(2) + 's',
    // Damla uzunluğu 10-22px (uzun damla = hızlı düşüşün izlenimi)
    height: (Math.random() * 12 + 10).toFixed(0) + 'px',
    // Hafif eğim (rüzgar): -8..+8 px
    drift: (Math.random() * 16 - 8).toFixed(0) + 'px',
    opacity: (Math.random() * 0.3 + 0.55).toFixed(2),
  }));
}

function makeStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    left: Math.floor(Math.random() * 100) + '%',
    delay: (Math.random() * 10).toFixed(2) + 's',
    // Yıldız kar gibi yavaş + dönerek: 7-12 saniye
    duration: (Math.random() * 5 + 7).toFixed(2) + 's',
    // Yıldız boyutu 8-16px (kar 2-5'ten büyük, daha gösterişli)
    size: (Math.random() * 8 + 8).toFixed(0) + 'px',
    // Yan sallanma -40..40px
    drift: (Math.random() * 80 - 40).toFixed(0) + 'px',
    opacity: (Math.random() * 0.3 + 0.7).toFixed(2),
    // %60 altın (warm yellow), %40 amber (orange-tinted) — çeşitlilik
    hue: Math.random() < 0.6 ? 'gold' : 'amber',
  }));
}

function makeMeteors(count: number): Meteor[] {
  // Yumuşak + yoğun gökyüzü hissi: 24 meteor, delay 0-12s spread, duration 14-22s.
  return Array.from({ length: count }, () => ({
    left: Math.floor(Math.random() * 100) + '%',
    delay: (Math.random() * 12).toFixed(2) + 's',
    duration: (Math.random() * 8 + 14).toFixed(2) + 's',
    tailLength: (Math.floor(Math.random() * 40) + 60) + 'px',
  }));
}

let cachedSnowCount: number | null = null;
let cachedFlakes: Flake[] | null = null;
function makeFlakesCached(count: number): Flake[] {
  if (cachedSnowCount !== count || !cachedFlakes) {
    cachedSnowCount = count;
    cachedFlakes = makeFlakes(count);
  }
  return cachedFlakes;
}

let cachedRainCount: number | null = null;
let cachedDrops: Drop[] | null = null;
function makeDropsCached(count: number): Drop[] {
  if (cachedRainCount !== count || !cachedDrops) {
    cachedRainCount = count;
    cachedDrops = makeDrops(count);
  }
  return cachedDrops;
}

let cachedStarCount: number | null = null;
let cachedStars: Star[] | null = null;
function makeStarsCached(count: number): Star[] {
  if (cachedStarCount !== count || !cachedStars) {
    cachedStarCount = count;
    cachedStars = makeStars(count);
  }
  return cachedStars;
}

let cachedMeteorCount: number | null = null;
let cachedMeteors: Meteor[] | null = null;
function makeMeteorsCached(count: number): Meteor[] {
  if (cachedMeteorCount !== count || !cachedMeteors) {
    cachedMeteorCount = count;
    cachedMeteors = makeMeteors(count);
  }
  return cachedMeteors;
}

function subscribeNoop(): () => void {
  return () => undefined;
}

const STORAGE_KEY = 'pp-weather-mode';
type WeatherMode = 'snow' | 'rain' | 'star' | 'meteor' | 'off';

const modeListeners = new Set<() => void>();
function getModeSnapshot(): WeatherMode {
  if (typeof window === 'undefined') return 'snow';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'snow' || v === 'rain' || v === 'star' || v === 'meteor' || v === 'off') {
      return v;
    }
    // Backwards compat: eski 'pp-snowfall-enabled' true/false
    const legacy = window.localStorage.getItem('pp-snowfall-enabled');
    if (legacy === 'false') return 'off';
    return 'snow';
  } catch {
    return 'snow';
  }
}
function getModeServerSnapshot(): WeatherMode {
  return 'snow';
}
function subscribeMode(cb: () => void): () => void {
  modeListeners.add(cb);
  return () => modeListeners.delete(cb);
}
function setModePersistent(value: WeatherMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* localStorage unavailable */
  }
  modeListeners.forEach((cb) => cb());
}

/**
 * Snowfall — kar/yağmur/kapalı 3-state weather efekti + sağ alt 3 toggle.
 *
 * Hero'nun pointer-events-none overlay'i; toggle butonları sağ alt köşede
 * pointer-events alır. localStorage 'pp-weather-mode' = 'snow'|'rain'|'off'
 * (default 'snow' — yeni kullanıcı için kar aktif). Eski 'pp-snowfall-enabled'
 * legacy key migrate edilir.
 *
 * useSyncExternalStore SSR-safe: server snapshot 'snow' (default) → DOM'da kar
 * render edilir → client mount sonrası localStorage'dan mode okunup yansır.
 */
export function Snowfall({ number = 40 }: Props) {
  const flakes = useSyncExternalStore<Flake[] | null>(
    subscribeNoop,
    () => makeFlakesCached(number),
    () => null,
  );
  const drops = useSyncExternalStore<Drop[] | null>(
    subscribeNoop,
    () => makeDropsCached(Math.round(number * 1.5)),
    () => null,
  );
  const stars = useSyncExternalStore<Star[] | null>(
    subscribeNoop,
    // Yıldız büyük + parlak, kardan az: number×0.6 (örn snow 40 → star 24)
    () => makeStarsCached(Math.round(number * 0.6)),
    () => null,
  );
  const meteors = useSyncExternalStore<Meteor[] | null>(
    subscribeNoop,
    // Yoğun gökyüzü: 24 meteor + spread delay (her zaman birkaç tanesi düşer)
    () => makeMeteorsCached(24),
    () => null,
  );
  const mode = useSyncExternalStore<WeatherMode>(
    subscribeMode,
    getModeSnapshot,
    getModeServerSnapshot,
  );

  return (
    <>
      {mode === 'snow' && flakes && (
        <div
          aria-hidden
          data-testid="snow-overlay"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {flakes.map((f, i) => (
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

      {mode === 'rain' && drops && (
        <div
          aria-hidden
          data-testid="rain-overlay"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {drops.map((d, i) => (
            <span
              key={i}
              className="absolute top-[-20px] animate-rain-fall"
              style={{
                left: d.left,
                width: '1.5px',
                height: d.height,
                opacity: d.opacity,
                animationDelay: d.delay,
                animationDuration: d.duration,
                ['--rain-drift' as string]: d.drift,
                background:
                  'linear-gradient(to bottom, rgba(220,235,255,0) 0%, rgba(220,235,255,0.85) 60%, rgba(220,235,255,0.95) 100%)',
                borderRadius: '999px',
              }}
            />
          ))}
        </div>
      )}

      {mode === 'star' && stars && (
        <div
          aria-hidden
          data-testid="star-overlay"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {stars.map((s, i) => (
            <span
              key={i}
              className="absolute top-[-12px] animate-star-fall inline-flex"
              style={{
                left: s.left,
                width: s.size,
                height: s.size,
                opacity: s.opacity,
                animationDelay: s.delay,
                animationDuration: s.duration,
                ['--star-drift' as string]: s.drift,
                filter: `drop-shadow(0 0 6px ${s.hue === 'gold' ? 'rgba(253,224,71,0.9)' : 'rgba(251,191,36,0.85)'})`,
              }}
            >
              <StarShape color={s.hue === 'gold' ? '#fde047' : '#fbbf24'} />
            </span>
          ))}
        </div>
      )}

      {mode === 'meteor' && meteors && (
        <div
          aria-hidden
          data-testid="meteor-overlay"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {meteors.map((m, i) => (
            <span
              key={i}
              className="pointer-events-none absolute h-0.5 w-0.5 rounded-full bg-white shadow-[0_0_0_1px_#ffffff10] rotate-[215deg] animate-meteor"
              style={{
                top: -2,
                left: m.left,
                animationDelay: m.delay,
                animationDuration: m.duration,
              }}
            >
              {/* Kuyruk: head'in ARKASINDA olmalı (head önde down-left'e gider).
                  Outer rotate(215deg) altında inner'ın sağ kenarı head yanında,
                  sol kenarı world'de up-right'ta (tail uçu). */}
              <span
                className="absolute right-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-l from-white to-transparent"
                style={{ width: m.tailLength }}
              />
            </span>
          ))}
        </div>
      )}

      {/* Sağ alt köşedeki 5-state weather toggle */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
        <ToggleButton
          active={mode === 'snow'}
          onClick={() => setModePersistent('snow')}
          title="Kar yağışı"
          testId="weather-snow"
          icon={<SnowIcon size={14} />}
        />
        <ToggleButton
          active={mode === 'rain'}
          onClick={() => setModePersistent('rain')}
          title="Yağmur"
          testId="weather-rain"
          icon={<RainIcon size={14} />}
        />
        <ToggleButton
          active={mode === 'star'}
          onClick={() => setModePersistent('star')}
          title="Yıldız yağmuru"
          testId="weather-star"
          icon={<StarIcon size={14} />}
        />
        <ToggleButton
          active={mode === 'meteor'}
          onClick={() => setModePersistent('meteor')}
          title="Kuyruklu yıldız (meteor)"
          testId="weather-meteor"
          icon={<MeteorIcon size={14} />}
        />
        <ToggleButton
          active={mode === 'off'}
          onClick={() => setModePersistent('off')}
          title="Hava efektini kapat"
          testId="weather-off"
          icon={<CancelIcon size={14} />}
        />
      </div>
    </>
  );
}

/** SVG 5-pointed solid star — animate-star-fall içinde dönen yıldızlar için. */
function StarShape({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={color} stroke="none" aria-hidden="true" className="h-full w-full">
      <path d="M12 2 14.59 8.41 21 9.27l-4.91 4.79L17.18 21 12 17.77 6.82 21l1.09-6.94L3 9.27l6.41-.86Z" />
    </svg>
  );
}

function ToggleButton({
  active,
  onClick,
  title,
  testId,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  testId: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-full border backdrop-blur-sm transition-all ${
        active
          ? 'border-white bg-white/30 text-white shadow-sm'
          : 'border-white/40 bg-white/12 text-white/75 hover:bg-white/22'
      }`}
    >
      {icon}
    </button>
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

function MeteorIcon({ size }: { size: number }) {
  // Kuyruklu yıldız — eğik çizgi (tail) + parlak yıldız baş
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
      {/* Tail diagonal */}
      <line x1="3" y1="21" x2="14" y2="10" />
      {/* Yıldız baş — 4 ışın */}
      <line x1="14" y1="10" x2="17" y2="7" />
      <line x1="14" y1="10" x2="11" y2="7" />
      <line x1="14" y1="10" x2="17" y2="13" />
      <line x1="14" y1="10" x2="11" y2="13" />
      {/* Merkez ışıltı */}
      <circle cx="14" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}

function StarIcon({ size }: { size: number }) {
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
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function RainIcon({ size }: { size: number }) {
  // Bulut + 3 damla
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
      <path d="M16 13a4 4 0 0 0-3.5-3.95A6 6 0 0 0 4 11h-.5A3.5 3.5 0 0 0 3 18h12a4 4 0 0 0 1-7.92Z" />
      <line x1="8" y1="20" x2="7" y2="22" />
      <line x1="12" y1="20" x2="11" y2="22" />
      <line x1="16" y1="20" x2="15" y2="22" />
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
