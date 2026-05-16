'use client';

import { useActionState, useState } from 'react';
import {
  flagFeedbackAction,
  resolveReportAction,
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

export function ResolveReportButton({ reportId }: { reportId: string }) {
  const [state, formAction, pending] = useActionState<
    ModerationActionState | null,
    FormData
  >(resolveReportAction, null);
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<'resolved' | 'dismissed'>(
    'resolved',
  );
  const [note, setNote] = useState('');

  if (state?.ok) {
    return (
      <span
        data-resolve-success={state.action}
        className="inline-flex rounded-lg bg-arrow-soft px-2 py-1 text-[10px] font-bold text-arrow-7"
      >
        ✓ {state.action === 'report_resolved' ? 'Çözüldü' : 'Geçersiz'}
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-resolve-trigger={reportId}
        className="rounded-lg border border-cat/40 bg-white px-2 py-1 text-[10.5px] font-bold text-cart hover:bg-cat hover:text-white transition-colors"
      >
        ⚖ Ele al
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col items-end gap-1.5"
      data-resolve-form
    >
      <input type="hidden" name="reportId" value={reportId} />
      <select
        name="resolution"
        value={resolution}
        onChange={(e) =>
          setResolution(e.target.value as 'resolved' | 'dismissed')
        }
        disabled={pending}
        data-resolve-resolution
        className="w-32 rounded-lg border-[1.5px] border-line bg-white px-2 py-1 text-[11px] focus:border-cat focus:outline-none"
      >
        <option value="resolved">✓ Çözüldü</option>
        <option value="dismissed">× Geçersiz</option>
      </select>
      <textarea
        name="resolutionNote"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Not (opsiyonel)"
        disabled={pending}
        data-resolve-note
        className="w-48 rounded-lg border-[1.5px] border-line bg-white px-2 py-1 text-[11px] focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
      />
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={pending}
          data-resolve-submit
          className="rounded-lg bg-cat px-2 py-1 text-[10.5px] font-bold text-white disabled:opacity-40"
        >
          {pending ? '...' : '⚖ Uygula'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setNote('');
          }}
          disabled={pending}
          className="rounded-lg border border-line bg-white px-2 py-1 text-[10.5px] font-bold text-ink-3"
        >
          Vazgeç
        </button>
      </div>
      {state?.error && (
        <div role="alert" className="text-[10px] font-bold text-danger-7">
          ✕ {state.error}
        </div>
      )}
    </form>
  );
}
