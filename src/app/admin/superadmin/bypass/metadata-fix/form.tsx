'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { metadataFixAction, type MetadataFixState } from './actions';

const FIELD_LABELS: Record<string, string> = {
  reason: 'Sebep',
  note: 'Not',
  customerRef: 'Müşteri ref / Vitrin kodu',
  documentNo: 'Doküman no',
};

export function MetadataFixForm() {
  const [state, formAction, pending] = useActionState<MetadataFixState | null, FormData>(
    metadataFixAction,
    null,
  );

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-arrow/40 bg-arrow-soft p-6">
        <h2 className="text-xl font-bold text-arrow-7">✓ Metadata düzeltildi</h2>
        <p className="mt-2 text-sm text-ink-2">
          Movement <code className="text-[11px]">{state.movementId?.slice(0, 8)}…</code>
          {' '}— {state.changedFields?.length ?? 0} alan değişti
        </p>
        {state.changedFields && state.before && state.after && (() => {
          const before = state.before;
          const after = state.after;
          return (
            <ul className="mt-3 flex flex-col gap-2 text-[12px]">
              {state.changedFields.map((f) => (
                <li key={f} className="rounded-lg border border-line bg-white p-2">
                  <div className="text-[10.5px] font-bold uppercase text-ink-3">
                    {FIELD_LABELS[f] ?? f}
                  </div>
                  <div className="mt-0.5 grid grid-cols-2 gap-2">
                    <div className="text-danger-7">
                      <span className="text-[9.5px] opacity-60">ÖNCE</span>{' '}
                      <span className="font-mono text-[11.5px]">
                        {before[f] ?? '(boş)'}
                      </span>
                    </div>
                    <div className="text-arrow-7">
                      <span className="text-[9.5px] opacity-60">SONRA</span>{' '}
                      <span className="font-mono text-[11.5px]">
                        {after[f] ?? '(boş)'}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          );
        })()}
        <div className="mt-4 flex gap-2">
          <Link
            href={'/admin/stock-movements' as never}
            className="rounded-xl bg-cat px-4 py-2 text-xs font-bold text-white"
          >
            Ledger
          </Link>
          <Link
            href={'/admin/audit-log' as never}
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink-2"
          >
            Audit log
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <div>
        <label htmlFor="movementId" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
          Movement UUID *
        </label>
        <input
          id="movementId"
          name="movementId"
          type="text"
          required
          disabled={pending}
          data-testid="movement-id"
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2 font-mono text-[11px] focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
        <p className="mt-1 text-[10.5px] text-ink-4">
          Ledger&apos;dan hareketin id&apos;sini kopyala. Sadece metadata
          (reason/note/customerRef/documentNo) düzeltilebilir — quantity ASLA.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-paper p-3">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-cart">
          Düzeltilecek alanlar (boş bırakırsan o alan dokunulmaz)
        </div>
        <div>
          <label htmlFor="reason" className="mb-1 block text-[11px] font-bold text-ink-3">
            Sebep
          </label>
          <input
            id="reason"
            name="reason"
            type="text"
            maxLength={500}
            disabled={pending}
            data-testid="reason"
            placeholder="Yeni sebep (boş → değişmez, boşaltmak için tek boşluk + sil)"
            className="w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-[12.5px] focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
          />
        </div>
        <div>
          <label htmlFor="note" className="mb-1 block text-[11px] font-bold text-ink-3">
            Not
          </label>
          <textarea
            id="note"
            name="note"
            maxLength={1000}
            rows={2}
            disabled={pending}
            data-testid="note"
            placeholder="Yeni not"
            className="w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-[12.5px] focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="customerRef" className="mb-1 block text-[11px] font-bold text-ink-3">
              Müşteri ref
            </label>
            <input
              id="customerRef"
              name="customerRef"
              type="text"
              maxLength={100}
              disabled={pending}
              data-testid="customer-ref"
              className="w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 font-mono text-[12px] focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
            />
          </div>
          <div>
            <label htmlFor="documentNo" className="mb-1 block text-[11px] font-bold text-ink-3">
              Doküman no
            </label>
            <input
              id="documentNo"
              name="documentNo"
              type="text"
              maxLength={100}
              disabled={pending}
              data-testid="document-no"
              className="w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 font-mono text-[12px] focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="bypassReason" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
          Süperadmin sebebi * (min 10 karakter, audit&apos;e yazılır)
        </label>
        <textarea
          id="bypassReason"
          name="bypassReason"
          required
          minLength={10}
          maxLength={500}
          rows={2}
          placeholder="Örn: Doküman no FAT-0023 yazılmış olmalıydı, kullanıcı yanlışlıkla boş bırakmış — düzeltiliyor"
          disabled={pending}
          data-testid="bypass-reason"
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-2.5 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      <div>
        <label htmlFor="superadminPassword" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
          Süperadmin şifren * (re-auth)
        </label>
        <input
          id="superadminPassword"
          name="superadminPassword"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={pending}
          data-testid="superadmin-password"
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-2.5 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
        >
          ✕ {state.error}
          {state.issues && state.issues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[11px] font-normal">
              {state.issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        data-testid="submit"
        className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-3 text-sm font-bold text-white shadow-lg hover:-translate-y-0.5 transition-transform disabled:opacity-60"
      >
        {pending ? '⏳ İşleniyor...' : '✎ Metadata düzelt'}
      </button>
    </form>
  );
}
