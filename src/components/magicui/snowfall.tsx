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

/**
 * Snowfall — yumuşak kar yağışı efekti (hero background).
 *
 * Hero'nun pointer-events-none overlay'i. Dikey düşüş + hafif yan sallanma
 * (CSS keyframe `snow-fall`). Server snapshot null → hydration mismatch yok.
 *
 * Mockup uyumlu: 40 tane çeşitli boyut/hız/opacity ile sıcak gradient
 * hero üstünde belirgin görünür.
 */
export function Snowfall({ number = 40 }: Props) {
  const items = useSyncExternalStore<Flake[] | null>(
    subscribeNoop,
    () => makeFlakesCached(number),
    () => null,
  );
  if (!items) return null;
  return (
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
            // CSS custom prop ile drift mesafesi keyframe içinde okunur
            ['--snow-drift' as string]: f.drift,
            boxShadow: '0 0 4px rgba(255,255,255,0.6)',
          }}
        />
      ))}
    </div>
  );
}
