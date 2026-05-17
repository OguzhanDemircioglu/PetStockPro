'use client';

import { Children, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface ItemProps {
  children: ReactNode;
}

function AnimatedListItem({ children }: ItemProps) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      layout
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

interface Props {
  children: ReactNode;
  className?: string;
  /** Delay between items in ms (default 600). */
  delay?: number;
}

/**
 * AnimatedList — staggered reveal (magicui port).
 *
 * Children are arrayed and revealed one-by-one with a spring animation.
 * Each child SHOULD have a stable React `key`.
 */
export function AnimatedList({ children, className, delay = 600 }: Props) {
  const [index, setIndex] = useState(0);
  const arr = useMemo(() => Children.toArray(children), [children]);
  useEffect(() => {
    if (index >= arr.length - 1) return;
    const t = window.setTimeout(() => setIndex((i) => i + 1), delay);
    return () => window.clearTimeout(t);
  }, [index, arr.length, delay]);
  const shown = arr.slice(0, index + 1);
  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ''}`}>
      <AnimatePresence>
        {shown.map((item, i) => {
          const child = item as { key?: string | number };
          return <AnimatedListItem key={child.key ?? i}>{item}</AnimatedListItem>;
        })}
      </AnimatePresence>
    </div>
  );
}
