'use client';

import { useActionState, useState } from 'react';
import { initChangeEmailAction, type ChangeEmailState } from './actions';

interface AccountFormProps {
  currentEmail: string;
  pendingEmail: string | null;
  pendingEmailExpiresAt: Date | null;
}

export function AccountForm({
  currentEmail,
  pendingEmail,
  pendingEmailExpiresAt,
}: AccountFormProps) {
  const [state, formAction, pending] = useActionState<ChangeEmailState | null, FormData>(
    initChangeEmailAction,
    null,
  );
  const [showForm, setShowForm] = useState(false);

  // Init success → confirm screen göster
  if (state?.ok && state.pendingEmail) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <div className="rounded-2xl border border-arrow/40 bg-arrow-soft p-6">
          <h2 className="text-xl font-bold text-arrow-7">📧 Doğrulama e-postası gönderildi</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            <strong>{state.pendingEmail}</strong> adresine doğrulama bağlantısı gönderildi.
            24 saat içinde linke tıklayarak yeni e-postanı doğrula.
          </p>
          <p className="mt-3 text-xs text-ink-3">
            ⚠ <strong>{currentEmail}</strong> adresine de bilgi gönderildi — sen
            başlatmadıysan &quot;İptal Et&quot; linkine tıklayabilirsin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="text-lg font-bold text-cart">📧 E-posta adresi</h2>
        <p className="mt-1 text-xs text-ink-3">Giriş yaparken kullandığın adres.</p>

        <div className="mt-4 rounded-xl bg-paper px-4 py-3 font-mono text-sm">
          {currentEmail}
        </div>

        {pendingEmail && (
          <div className="mt-3 rounded-xl border border-cat/30 bg-cat-soft px-4 py-3 text-xs text-cart">
            ⏱ <strong>{pendingEmail}</strong> bekleyen doğrulama
            {pendingEmailExpiresAt && (
              <span>
                {' '}
                — {pendingEmailExpiresAt.toLocaleDateString('tr-TR')} kadar geçerli
              </span>
            )}
          </div>
        )}

        {state?.error && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
          >
            {state.error}
          </div>
        )}

        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink-2 hover:bg-line-soft"
          >
            ✏ E-postayı değiştir
          </button>
        ) : (
          <form action={formAction} className="mt-5 flex flex-col gap-3">
            <div>
              <label
                className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="newEmail"
              >
                Yeni e-posta
              </label>
              <input
                id="newEmail"
                name="newEmail"
                type="email"
                placeholder="yeni@petshop.com"
                autoComplete="email"
                required
                disabled={pending}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="currentPassword"
              >
                Mevcut şifren (doğrulama)
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={pending}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div className="rounded-xl bg-paper px-4 py-3 text-[11.5px] text-ink-3">
              💡 İki email doğrulanır:
              <ul className="ml-4 mt-1 list-disc">
                <li>
                  <strong>Yeni e-postaya:</strong> doğrulama linki gelir
                </li>
                <li>
                  <strong>Mevcut e-postaya:</strong> &quot;değişiklik isteği başlatıldı&quot;
                  bildirimi + &quot;İptal Et&quot; CTA
                </li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-4 py-2.5 text-sm font-bold text-white hover:-translate-y-0.5 transition-transform disabled:opacity-60"
              >
                {pending ? 'Gönderiliyor...' : 'Değişiklik isteği gönder'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={pending}
                className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-3 hover:bg-line-soft"
              >
                Vazgeç
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
