'use client';

import { useEffect, useState } from 'react';

interface LockedCountdownProps {
  initialSeconds: number;
}

function formatSeconds(s: number): string {
  if (s <= 0) return '00:00:00';
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Geri sayım UI — her saniye günceller. 00:00:00'a ulaşınca "Giriş yapabilirsin" mesajı.
 */
export function LockedCountdown({ initialSeconds }: LockedCountdownProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  const isExpired = secondsRemaining <= 0;

  return (
    <div
      className={`mt-6 rounded-2xl px-6 py-5 text-center ${
        isExpired ? 'bg-arrow-soft' : 'bg-line-soft'
      }`}
    >
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-4">
        {isExpired ? '✅ Kilit kalktı' : '⏱ Geri sayım'}
      </div>
      <div
        className={`mt-1 font-mono text-3xl font-bold tracking-wider ${
          isExpired ? 'text-arrow-7' : 'text-cart'
        }`}
      >
        {formatSeconds(secondsRemaining)}
      </div>
      {isExpired && (
        <a
          href="/login"
          className="mt-3 inline-block border-b border-dashed border-arrow-7 text-xs font-bold text-arrow-7 hover:text-arrow"
        >
          Şimdi giriş yap →
        </a>
      )}
    </div>
  );
}
