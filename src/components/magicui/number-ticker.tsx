'use client';

import { useEffect, useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring } from 'motion/react';

interface Props {
  value: number;
  startValue?: number;
  direction?: 'up' | 'down';
  delay?: number;
  className?: string;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
  /** Optional formatter override (e.g. tr-TR currency). Receives the latest numeric value. */
  formatter?: (n: number) => string;
}

/**
 * NumberTicker — count-up/down via motion spring.
 *
 * Server-safe: renders the START value initially, animates after mount + inView.
 * Avoids hydration mismatch by mounting the live value into a ref.
 */
export function NumberTicker({
  value,
  startValue = 0,
  direction = 'up',
  delay = 0,
  className,
  decimalPlaces = 0,
  prefix = '',
  suffix = '',
  formatter,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const initial = direction === 'down' ? value : startValue;
  const motionValue = useMotionValue(initial);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: '0px' });

  useEffect(() => {
    if (!isInView) return;
    const t = window.setTimeout(() => {
      motionValue.set(direction === 'down' ? startValue : value);
    }, delay * 1000);
    return () => window.clearTimeout(t);
  }, [isInView, motionValue, delay, value, direction, startValue]);

  useEffect(() => {
    return springValue.on('change', (latest: number) => {
      if (!ref.current) return;
      const num = Number(latest.toFixed(decimalPlaces));
      const formatted = formatter
        ? formatter(num)
        : new Intl.NumberFormat('tr-TR', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(num);
      ref.current.textContent = prefix + formatted + suffix;
    });
  }, [springValue, decimalPlaces, prefix, suffix, formatter]);

  // Server-rendered text: start value formatted same way as final (no animation yet).
  // The 'change' effect above replaces textContent imperatively once motion runs,
  // so no hydration mismatch from React's perspective.
  const serverText = (() => {
    const num = Number(initial.toFixed(decimalPlaces));
    const formatted = formatter
      ? formatter(num)
      : new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        }).format(num);
    return prefix + formatted + suffix;
  })();

  return (
    <motion.span
      ref={ref}
      suppressHydrationWarning
      className={`inline-block tabular-nums ${className ?? ''}`}
    >
      {serverText}
    </motion.span>
  );
}
