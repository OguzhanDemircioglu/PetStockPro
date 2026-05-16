'use client';

import { useActionState, useState } from 'react';
import {
  flagFeedbackAction,
  unflagFeedbackAction,
  type ModerationActionState,
} from './actions';

export function FlagButton({ feedbackId }: { feedbackId: string }) {
  const [state, formAction, pending] = useActionState<
    ModerationActionState | null,
    FormData
  >(flagFeedbackAction, null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (state?.ok && state.action === 'flagged') {
    return (
      <span
        className="inline-flex rounded-lg bg-arrow-soft px-2 py-1 text-[10px] font-bold text-arrow-7"
        data-flag-success
      >
        ✓ Flagged
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-flag-trigger={feedbackId}
        className="rounded-lg border border-danger/40 bg-white px-2 py-1 text-[10.5px] font-bold text-danger-7 hover:bg-danger hover:text-white transition-colors"
      >
        🚩 Flag
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <textarea
        name="reason"
        required
        minLength={3}
        maxLength={500}
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Spam / küfür / yalan…"
        disabled={pending}
        data-flag-reason
        className="w-48 rounded-lg border-[1.5px] border-line bg-white px-2 py-1 text-[11px] focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/15"
      />
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={pending || reason.trim().length < 3}
          data-flag-submit
          className="rounded-lg bg-danger px-2 py-1 text-[10.5px] font-bold text-white disabled:opacity-40"
        >
          {pending ? '...' : '🚩 Flag'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason('');
          }}
          disabled={pending}
          className="rounded-lg border border-line bg-white px-2 py-1 text-[10.5px] font-bold text-ink-3"
        >
          Vazgeç
        </button>
      </div>
      {state?.error && (
        <div
          role="alert"
          data-flag-error
          className="text-[10px] font-bold text-danger-7"
        >
          ✕ {state.error}
        </div>
      )}
    </form>
  );
}

export function UnflagButton({ feedbackId }: { feedbackId: string }) {
  const [state, formAction, pending] = useActionState<
    ModerationActionState | null,
    FormData
  >(unflagFeedbackAction, null);

  if (state?.ok && state.action === 'unflagged') {
    return (
      <span
        className="inline-flex rounded-lg bg-arrow-soft px-2 py-1 text-[10px] font-bold text-arrow-7"
        data-unflag-success
      >
        ✓ Temizlendi
      </span>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Bu feedback'in flag'ını kaldır?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="feedbackId" value={feedbackId} />
      <button
        type="submit"
        disabled={pending}
        data-unflag-trigger={feedbackId}
        className="rounded-lg border border-arrow/40 bg-white px-2 py-1 text-[10.5px] font-bold text-arrow-7 hover:bg-arrow hover:text-white transition-colors disabled:opacity-40"
      >
        {pending ? '...' : '↶ Flag kaldır'}
      </button>
      {state?.error && (
        <div
          role="alert"
          className="mt-1 text-[10px] font-bold text-danger-7"
        >
          ✕ {state.error}
        </div>
      )}
    </form>
  );
}
