'use client';

import { useEffect } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  testid?: string;
}

/**
 * Slide-in drawer shell — sağdan kayan panel + backdrop.
 * Escape ile kapatılır. Form içeriği children olarak gelir.
 */
export function DrawerShell({ title, subtitle, onClose, children, testid }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      data-testid={testid}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="flex-1 bg-ink/40 backdrop-blur-sm"
      />
      {/* Panel */}
      <aside className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-paper shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-paper px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-cart">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-3 hover:bg-line-soft hover:text-cart"
            aria-label="Kapat"
            data-testid="drawer-close"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}
