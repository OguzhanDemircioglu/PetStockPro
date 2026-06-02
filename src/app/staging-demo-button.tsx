'use client';

import { useTransition, type ReactNode } from 'react';
import { stagingDemoLoginAction } from './staging-demo-actions';

interface Props {
  className: string;
  children: ReactNode;
  pendingText?: string;
  /** "data-testid" forward */
  testId?: string;
}

/**
 * Demo bayi auto-login butonu — server action submit + loading state.
 * Kullanıcı tıkladığı anda button disable + "Yükleniyor..." metni, server
 * action arkada signIn + impersonate + redirect /admin yapar.
 */
export function StagingDemoButton({ className, children, pendingText = 'Yükleniyor…', testId }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      data-testid={testId}
      onClick={() => {
        startTransition(async () => {
          await stagingDemoLoginAction();
        });
      }}
      className={className}
      aria-busy={isPending}
    >
      {isPending ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            aria-hidden
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path
              d="M22 12a10 10 0 0 0-10-10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
