'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'pp-theme';
const COOKIE_KEY = 'pp-theme';
// 1 yıl — kullanıcı tercihi uzun süre kalsın.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  /** Cookie'den server-side okunan başlangıç teması. */
  initialTheme?: Theme;
}

/**
 * ThemeProvider — cookie + localStorage hibrit persist.
 *
 * Initial theme cookie üzerinden server-side gelir; client'ta toggle olunca
 * hem cookie hem localStorage güncellenir. Inline script gerek YOK → React 19
 * "script tag in component" uyarısı yok.
 */
export function ThemeProvider({ children, initialTheme = 'light' }: ProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // Sync html.dark on every change (idempotent).
  useEffect(() => {
    applyHtmlClass(theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyHtmlClass(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
      // 1 yıl ttl, Lax SameSite. Secure flag prod'da HTTPS'te otomatik gelir.
      document.cookie = `${COOKIE_KEY}=${t}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    } catch {
      /* localStorage/cookie unavailable */
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
