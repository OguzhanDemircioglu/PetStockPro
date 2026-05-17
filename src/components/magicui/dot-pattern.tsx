interface Props {
  className?: string;
}

/**
 * DotPattern — subtle background dots (magicui port).
 *
 * Server-safe SVG, no motion. Use `text-*` class to color the dots
 * (fill="currentColor"). Position with parent's relative class.
 */
export function DotPattern({ className }: Props) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ''}`}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="dot-pat"
          x="0"
          y="0"
          width="22"
          height="22"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.2" cy="1.2" r="1.2" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-pat)" />
    </svg>
  );
}
