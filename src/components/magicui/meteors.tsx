'use client';

import { useSyncExternalStore } from 'react';

interface Props {
  number?: number;
}

type Meteor = { left: string; delay: string; duration: string };

function makeMeteors(count: number): Meteor[] {
  return Array.from({ length: count }, () => ({
    // mockup ile uyumlu: tüm genişliğe yay (0-100%)
    left: Math.floor(Math.random() * 100) + '%',
    // delay: 0-5s arası — meteor'lar dağıtık görünür, sürekli yağar
    delay: (Math.random() * 5).toFixed(2) + 's',
    // duration: 3-6s arası — daha sık görünür için kısaltıldı
    duration: (Math.random() * 3 + 3).toFixed(2) + 's',
  }));
}

// useSyncExternalStore'un identity stability requirement'i — getSnapshot her
// renderlarda aynı referans dönmeli. number bazlı cache.
let cachedNumber: number | null = null;
let cachedItems: Meteor[] | null = null;
function makeMeteorsCached(count: number): Meteor[] {
  if (cachedNumber !== count || !cachedItems) {
    cachedNumber = count;
    cachedItems = makeMeteors(count);
  }
  return cachedItems;
}

function subscribeNoop(): () => void {
  // Server'da çağrılmaz. Client'ta tek seferlik (random sabitlendiği için).
  return () => undefined;
}

/**
 * Meteors — falling streaks background (magicui port).
 *
 * Pure CSS animation (animate-meteor keyframe in globals). Position/duration
 * randomized client-side only via useSyncExternalStore (server returns null,
 * client returns the random array after hydration). No SSR/CSR mismatch.
 */
export function Meteors({ number = 12 }: Props) {
  const items = useSyncExternalStore<Meteor[] | null>(
    subscribeNoop,
    () => makeMeteorsCached(number),
    () => null,
  );
  if (!items) return null;
  return (
    <>
      {items.map((m, i) => (
        <span
          key={i}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-white shadow-[0_0_2px_1px_rgba(255,255,255,.45)] rotate-[215deg] animate-meteor"
          style={{
            top: -4,
            left: m.left,
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        >
          {/* Daha uzun ve belirgin tail (kuyruk). Mockup uyumlu, dark gradient hero üstünde net kontrast. */}
          <span className="absolute top-1/2 -translate-y-1/2 h-[1.5px] w-[90px] bg-gradient-to-r from-white to-transparent" />
        </span>
      ))}
    </>
  );
}
