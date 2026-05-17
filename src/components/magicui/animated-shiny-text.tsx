import type { PropsWithChildren } from 'react';

interface Props extends PropsWithChildren {
  className?: string;
}

/**
 * AnimatedShinyText — shimmer gradient text (pure CSS).
 * Uses brand gradient (cart → cat → cart) keyframe defined in globals.
 */
export function AnimatedShinyText({ children, className }: Props) {
  return (
    <span className={`inline-block animate-shiny-text ${className ?? ''}`}>
      {children}
    </span>
  );
}
