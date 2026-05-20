'use client';

import { useActionState, useMemo, useTransition } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import { settleCreditAction, type SettleCreditActionState } from './actions';

const INITIAL: SettleCreditActionState = { ok: false };

export function SettleCreditButton({ movementId }: { movementId: string }) {
  const [state, formAction] = useActionState(settleCreditAction, INITIAL);
  const [pending, startTransition] = useTransition();
  // Sadece bu satırla ilgili hatayı SWAL toast'a yönlendir.
  const errorState = useMemo(
    () =>
      state.movementId === movementId && !state.ok && state.message
        ? { error: state.message }
        : null,
    [state, movementId],
  );
  useSwalOnError(errorState);

  return (
    <form
      action={(fd) => {
        if (!confirm('Bu krediyi kapatmak istediğine emin misin? (Müşteri ödedi mi?)'))
          return;
        startTransition(() => formAction(fd));
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="movementId" value={movementId} />
      <button
        type="submit"
        disabled={pending}
        data-testid={`settle-${movementId}`}
        className="rounded-xl border border-arrow/40 bg-arrow-soft px-3 py-1.5 text-[12.5px] font-bold text-arrow-7 transition hover:bg-arrow hover:text-white disabled:opacity-50"
      >
        {pending ? '...' : '✓ Krediyi kapat'}
      </button>
      {state.movementId === movementId && state.ok && state.message && (
        <span
          role="status"
          className="text-[11.5px] text-arrow-7"
        >
          ✓ {state.message}
        </span>
      )}
    </form>
  );
}
