'use client';

import { useTheme } from './theme-provider';

/**
 * Topbar theme toggle — sun/moon, localStorage persist via ThemeProvider.
 *
 * Hydration safety: server renders default light icon; client useEffect syncs
 * from localStorage/system preference. Mismatch only on first paint, no flash
 * because pp-theme-script (in layout) flips html.dark before React mounts.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      data-testid="theme-toggle"
      aria-label={isDark ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'}
      title={isDark ? 'Aydınlık tema' : 'Karanlık tema'}
      className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-paper text-ink-3 transition-colors hover:border-cat hover:text-cat"
    >
      {isDark ? (
        // Sun
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
