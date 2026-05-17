'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'pp-theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Read initial theme synchronously from DOM (set by themeBootScript in <head>)
// to avoid cascading setState-in-effect. Falls back to light during SSR.
function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer pulls from the html.dark class the boot script already set.
  // No setState in effect → no cascading renders.
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  // Sync html.dark class on every change (idempotent).
  useEffect(() => {
    applyHtmlClass(theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyHtmlClass(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* localStorage unavailable */
    }
  };
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyHtmlClass(t: Theme) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (t === 'dark') html.classList.add('dark');
  else html.classList.remove('dark');
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { theme: 'light', setTheme: () => {}, toggle: () => {} };
  }
  return ctx;
}
