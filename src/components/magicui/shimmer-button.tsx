'use client';

import { type CSSProperties, type PropsWithChildren, type ButtonHTMLAttributes } from 'react';

interface Props
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    PropsWithChildren {
  shimmerColor?: string;
  shimmerSize?: string;
  shimmerDuration?: string;
  borderRadius?: string;
  background?: string;
  textColor?: string;
  className?: string;
}

/**
 * ShimmerButton — perimeter shimmer (magicui port).
 *
 * Pure CSS animation (no motion lib needed for this one). Server-safe.
 */
export function ShimmerButton({
  children,
  className,
  shimmerColor = '#ffffff',
  shimmerSize = '0.05em',
  shimmerDuration = '3s',
  borderRadius = '12px',
  background = '#ffffff',
  textColor,
  ...rest
}: Props) {
  const style: CSSProperties & Record<string, string> = {
    '--mui-shimmer-color': shimmerColor,
    '--mui-radius': borderRadius,
    '--mui-speed': shimmerDuration,
    '--mui-cut': shimmerSize,
    '--mui-bg': background,
    color: textColor ?? '#d44a14',
    borderRadius,
    background,
  };
  return (
    <button
      style={style}
      className={[
        'group relative z-0 inline-flex cursor-pointer items-center justify-center overflow-hidden border border-white/10 px-5 py-2.5 whitespace-nowrap font-bold text-sm',
        'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px',
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      <div
        className="absolute inset-0 overflow-visible blur-[2px] -z-30"
        style={{ containerType: 'size' }}
      >
        <div
          className="absolute inset-0 animate-shimmer-slide"
          style={{ aspectRatio: '1', height: '100%' }}
        >
          <div
            className="absolute -inset-full w-auto animate-spin-around"
            style={{
              background: `conic-gradient(from calc(270deg - (90deg * 0.5)), transparent 0, ${shimmerColor} 90deg, transparent 90deg)`,
            }}
          />
        </div>
      </div>
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_-6px_10px_#ffffff1f] group-hover:shadow-[inset_0_-8px_12px_#ffffff3f] transition-shadow duration-300" />
      <div
        className="absolute inset-[0.05em] -z-20 rounded-[inherit]"
        style={{ background }}
      />
    </button>
  );
}
