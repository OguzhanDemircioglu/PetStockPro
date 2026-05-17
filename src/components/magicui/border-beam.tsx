'use client';

import { motion } from 'motion/react';

interface Props {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  reverse?: boolean;
  borderWidth?: number;
  className?: string;
}

/**
 * BorderBeam — animated gradient along element border (magicui port).
 *
 * Uses CSS offset-path. Falls back gracefully via @supports in globals.
 */
export function BorderBeam({
  size = 80,
  duration = 6,
  delay = 0,
  colorFrom = '#ffaa40',
  colorTo = '#d44a14',
  reverse = false,
  borderWidth = 1,
  className,
}: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
      style={{ borderWidth: `${borderWidth}px`, borderColor: 'transparent' }}
    >
      <motion.div
        className={`absolute ${className ?? ''}`}
        style={{
          width: size,
          height: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
          borderRadius: size,
        }}
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: reverse ? ['100%', '0%'] : ['0%', '100%'] }}
        transition={{ repeat: Infinity, ease: 'linear', duration, delay: -delay }}
      />
    </div>
  );
}
