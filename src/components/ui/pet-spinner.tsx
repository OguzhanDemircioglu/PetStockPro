/**
 * PetSpinner — site temalı yükleme göstergesi (PLAN-BETA-PERFORMANCE FAZ 3).
 *
 * 3 boyut:
 *   - `sm`  (12px) — buton içi pending state, sade dönen daire
 *   - `md`  (28px) — kart/section loading, paw + dönüş
 *   - `lg`  (48px) — page-level overlay, paw + dönüş + scale pulse
 *
 * A11y (WCAG 2.2 Level AA):
 *   - role="status" + aria-live="polite" + aria-busy="true"
 *   - sr-only label ("Yükleniyor…" default, prop override)
 *   - prefers-reduced-motion → CSS @media animation:none
 *     (paw SVG statik gösterilir, semantik kayıp yok)
 *
 * Tema renkleri: tone='cat' (varsayılan, --cat turuncu) | 'cart' (mavi) |
 * 'arrow' (yeşil). Brand paletinden seçilir.
 */
import type { CSSProperties } from 'react';

export type PetSpinnerSize = 'sm' | 'md' | 'lg';
export type PetSpinnerTone = 'cat' | 'cart' | 'arrow';

export interface PetSpinnerProps {
  size?: PetSpinnerSize;
  /** true → display:inline-block (button içi); false → flex (block) */
  inline?: boolean;
  /** sr-only screen reader label. Default "Yükleniyor…" */
  label?: string;
  /** lg variant'ta paw altında visible label; sm/md → her zaman sr-only */
  showLabel?: boolean;
  /** Brand tone — paw + ring rengi */
  tone?: PetSpinnerTone;
  className?: string;
}

const TONE_COLOR: Record<PetSpinnerTone, string> = {
  cat: 'var(--cat)',
  cart: 'var(--cart)',
  arrow: 'var(--arrow)',
};

const SIZE_PX: Record<PetSpinnerSize, number> = { sm: 12, md: 28, lg: 48 };

export function PetSpinner({
  size = 'md',
  inline = false,
  label = 'Yükleniyor…',
  showLabel = false,
  tone = 'cat',
  className,
}: PetSpinnerProps) {
  const px = SIZE_PX[size];
  const wrapClass = [
    inline ? 'inline-block align-middle' : 'inline-flex flex-col items-center justify-center gap-2',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const color = TONE_COLOR[tone];

  if (size === 'sm') {
    // Buton içi pending — sade dönen circle, paw yok (boyut yetmez)
    return (
      <span
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={wrapClass}
        data-spinner-size={size}
        data-spinner-tone={tone}
      >
        <span
          aria-hidden="true"
          className="inline-block animate-spin rounded-full border-2"
          style={
            {
              width: px,
              height: px,
              borderColor: `${color}33`, // ~20% opacity ring
              borderTopColor: color,
            } as CSSProperties
          }
        />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  // md + lg — paw SVG, optional scale pulse (lg)
  const animateClass = size === 'lg' ? 'animate-paw-pulse' : 'animate-spin';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={wrapClass}
      data-spinner-size={size}
      data-spinner-tone={tone}
    >
      <PawIcon size={px} color={color} className={animateClass} />
      {showLabel && size === 'lg' && (
        <span className="text-[12.5px] font-bold text-ink-3">{label}</span>
      )}
      {(!showLabel || size !== 'lg') && (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}

interface PawIconProps {
  size: number;
  color: string;
  className?: string;
}

/** Pet shop temalı paw print — 4 toe + 1 pad, gradient fill. */
function PawIcon({ size, color, className }: PawIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ color }}
    >
      <ellipse cx="6" cy="9" rx="2" ry="2.5" fill="currentColor" />
      <ellipse cx="11" cy="6" rx="2" ry="2.5" fill="currentColor" />
      <ellipse cx="16" cy="9" rx="2" ry="2.5" fill="currentColor" />
      <ellipse cx="12" cy="13" rx="2" ry="2.5" fill="currentColor" />
      <path
        d="M 7 17 Q 7 21 11 21 L 13 21 Q 17 21 17 17 Q 17 14 12 14 Q 7 14 7 17 Z"
        fill="currentColor"
      />
    </svg>
  );
}
