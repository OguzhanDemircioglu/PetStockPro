'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelSubscriptionAction, reactivateSubscriptionAction } from './actions';

export function SubscriptionActions({ cancelScheduled }: { cancelScheduled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function doCancel() {
    if (
      !window.confirm(
        'Aboneliğini iptal etmek istediğine emin misin? Dönem sonuna kadar aktif kalır, sonra FREE plana düşersin.',
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await cancelSubscriptionAction();
      if (res.ok) router.refresh();
      else setError(res.error ?? 'İşlem başarısız.');
    });
  }

  function doReactivate() {
    setError(null);
    startTransition(async () => {
      const res = await reactivateSubscriptionAction();
      if (res.ok) router.refresh();
      else setError(res.error ?? 'İşlem başarısız.');
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {error && (
        <p role="alert" data-testid="manage-error" className="text-sm text-danger-7">
          ⚠ {error}
        </p>
      )}
      {cancelScheduled ? (
        <button
          type="button"
          disabled={pending}
          onClick={doReactivate}
          data-testid="reactivate-sub"
          className="inline-flex items-center rounded-xl bg-cat px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '…' : 'Aboneliği sürdür'}
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={doCancel}
          data-testid="cancel-sub"
          className="text-sm text-danger-7 underline underline-offset-2 hover:no-underline disabled:opacity-50"
        >
          {pending ? '…' : 'Aboneliği iptal et'}
        </button>
      )}
    </div>
  );
}
