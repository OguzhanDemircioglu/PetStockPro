'use client';

import { type PropsWithChildren, type PointerEvent } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'motion/react';

interface Props extends PropsWithChildren {
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
  gradientFrom?: string;
  gradientTo?: string;
}

/**
 * MagicCard — spotlight hover follow (magicui port).
 *
 * Wraps children in a relative motion.div with a radial gradient that tracks
 * pointer position. Falls back to plain bg when motion is not initialized
 * (e.g. SSR — useMotionValue returns a sentinel value).
 */
export function MagicCard({
  children,
  className,
  gradientSize = 200,
  gradientColor = '#1a5588',
  gradientOpacity = 0.12,
  gradientFrom = '#d44a14',
  gradientTo = '#1a5588',
}: Props) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };
  const reset = () => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  };

  const borderBg = useMotionTemplate`
    linear-gradient(var(--paper) 0 0) padding-box,
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientFrom}, ${gradientTo}, var(--line) 100%) border-box
  `;

  const spotBg = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientColor}, transparent 100%)
  `;

  return (
    <motion.div
      onPointerMove={handleMove}
      onPointerLeave={reset}
      className={`group relative isolate overflow-hidden rounded-[inherit] border border-transparent ${className ?? ''}`}
      style={{ background: borderBg }}
    >
      <div className="absolute inset-px z-20 rounded-[inherit] bg-paper" />
      <motion.div
        className="pointer-events-none absolute inset-px z-30 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: spotBg, opacity: gradientOpacity }}
      />
      <div className="relative z-40">{children}</div>
    </motion.div>
  );
}
