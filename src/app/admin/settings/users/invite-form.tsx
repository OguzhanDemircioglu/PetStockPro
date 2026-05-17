'use client';

import { useActionState, useState } from 'react';
import { inviteUserAction, type InviteUserState } from './actions';

function InviteResult({ state }: { state: InviteUserState }) {
  const [copied, setCopied] = useState(false);
  if (!state.ok || !state.method) return null;

  return (
    <div className="mt-3 rounded-xl border border-arrow/40 bg-arrow-soft p-4">
      <h3 className="text-sm font-bold text-arrow-7">
        ✓ {state.email} davet edildi
      </h3>
      {state.method === 'email' ? (
        <p className="mt-1 text-[13px] text-ink-2">
          📧 Email gönderildi (
          {state.emailSent ? '✓ Brevo OK' : '⚠ Brevo fail — link aşağıda, elden ilet'}
          ). 7 gün geçerli.
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-ink-2">
          🔗 Link yöntemi seçildi — aşağıdaki URL&apos;yi kullanıcıya
          WhatsApp/SMS ile gönder. 24 saat geçerli.
        </p>
      )}
      {(state.method === 'link' || !state.emailSent) && state.acceptUrl && (
        <div className="mt-3 flex items-stretch gap-1">
          <code
            className="flex-1 truncate rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[12.5px] text-ink-2"
            data-testid="invite-accept-url"
          >
            {state.acceptUrl}
          </code>
          <button
            type="button"
            onClick={async () => {
              if (state.acceptUrl) {
                await navigator.clipboard.writeText(state.acceptUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
            className="rounded-lg border border-cat bg-cat px-3 py-2 text-[12.5px] font-bold text-white hover:-translate-y-0.5 transition-transform"
          >
            {copied ? '✓' : '📋'} {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
        </div>
      )}
      <p className="mt-2 text-[12px] text-ink-4">
        Süresi:{' '}
        {state.expiresAt
          ? new Date(state.expiresAt).toLocaleString('tr-TR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
          : '—'}
      </p>
    </div>
  );
}

export function InviteUserForm() {
  const [state, formAction, pending] = useActionState<InviteUserState | null, FormData>(
    inviteUserAction,
    null,
  );

  return (
    <form action={formAction} className="rounded-2xl border border-line bg-paper p-5">
      <h2 className="text-sm font-bold text-cart">➕ Yeni kullanıcı davet et</h2>
      <p className="mt-1 text-[12.5px] text-ink-3">
        Davet methodunu seç: 📧 email (Brevo gönderir, 7 gün) ya da 🔗 link (URL döner,
        24 saat, elden ilet).
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="invite-email" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
            Email *
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            disabled={pending}
            data-testid="invite-email"
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
          />
        </div>
        <div>
          <label htmlFor="invite-name" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
            İsim (opsiyonel)
          </label>
          <input
            id="invite-name"
            name="name"
            type="text"
            maxLength={120}
            disabled={pending}
            data-testid="invite-name"
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
            Rol *
          </label>
          <select
            id="invite-role"
            name="role"
            required
            disabled={pending}
            defaultValue="STAFF"
            data-testid="invite-role"
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
          >
            <option value="SUBE_MUDURU">🏪 Şube Müdürü</option>
            <option value="STAFF">💼 Kasiyer (STAFF)</option>
          </select>
        </div>
        <div>
          <label htmlFor="invite-method" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
            Davet yöntemi *
          </label>
          <select
            id="invite-method"
            name="method"
            required
            disabled={pending}
            defaultValue="link"
            data-testid="invite-method"
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
          >
            <option value="email">📧 Email (Brevo, 7 gün)</option>
            <option value="link">🔗 Link (24 saat, elden ilet)</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[12px] text-ink-4">
          Audit log&apos;a yazılır. Şube Müdürü tüm modüllere erişir; STAFF sadece
          satış kaydı + sayıma katılır.
        </p>
        <button
          type="submit"
          disabled={pending}
          data-testid="invite-submit"
          className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:-translate-y-0.5 transition-transform disabled:opacity-60"
        >
          {pending ? '⏳ Davet hazırlanıyor...' : '➕ Davet et'}
        </button>
      </div>

      {state?.error && (
        <div
          role="alert"
          data-testid="invite-error"
          className="mt-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-bold text-danger-7"
        >
          ✕ {state.error}
          {state.issues && state.issues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[12.5px] font-normal">
              {state.issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state?.ok && <InviteResult state={state} />}
    </form>
  );
}
