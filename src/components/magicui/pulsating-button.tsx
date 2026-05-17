'use client';

import { type ButtonHTMLAttributes, type CSSProperties, type PropsWithChildren } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  pulseColor?: string;
  duration?: string;
}

/**
 * PulsatingButton — attention-grabbing button with radial pulse.
 * Pure CSS (animate-pulse-soft keyframe).
 */
export function PulsatingButton({
  children,
  className,
  pulseColor = 'rgba(196,69,58,.45)',
  duration = '1.6s',
  ...rest
}: Props) {
  const style: CSSProperties & Record<string, string> = {
    '--pulse-color': pulseColor,
    '--duration': duration,
  };
  return (
    <button
      style={style}
      className={[
        'relative inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-bold text-sm text-white cursor-pointer',
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] animate-pulse-soft"
      />
    </button>
  );
}
