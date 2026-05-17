'use client';

import { useState } from 'react';

interface Props {
  number?: number;
}

type Meteor = { left: string; delay: string; duration: string };

function makeMeteors(count: number): Meteor[] {
  return Array.from({ length: count }, () => ({
    left: Math.floor(Math.random() * 100) + '%',
    delay: (Math.random() * 1.6).toFixed(2) + 's',
    duration: (Math.random() * 4 + 4).toFixed(2) + 's',
  }));
}

/**
 * Meteors — falling streaks background (magicui port).
 *
 * Pure CSS animation (animate-meteor keyframe in globals). Position/duration
 * randomized via lazy useState initializer (client-only via 'use client').
 * No SSR/CSR mismatch because suppressHydrationWarning on the wrapper.
 */
export function Meteors({ number = 12 }: Props) {
  const [items] = useState<Meteor[]>(() => makeMeteors(number));
  if (items.length === 0) return null;
  return (
    <>
      {items.map((m, i) => (
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
          <span className="absolute top-1/2 -translate-y-1/2 h-px w-[60px] bg-gradient-to-r from-white to-transparent" />
        </span>
      ))}
    </>
  );
}
