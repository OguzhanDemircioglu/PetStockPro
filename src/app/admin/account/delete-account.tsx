'use client';

import { useActionState, useState } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import { deleteAccountAction, type DeleteAccountState } from './actions';

interface DeleteAccountProps {
  /** Tenant'ın canlı (ödenen) aboneliği var mı? → ek uyarı göster. */
  hasActiveSubscription: boolean;
}

/**
 * Tehlikeli bölge — "Hesabımı sil" (yalnızca BAYI_SAHIBI render edilir, page.tsx gate'ler).
 *
 * Onay = şifre re-auth (karar 2026-06-30). Aktif abonelik varsa "hemen iptal, iade yok"
 * uyarısı koşullu. Başarıda action signOut + /login?deleted=1'e yönlendirir.
 */
export function DeleteAccount({ hasActiveSubscription }: DeleteAccountProps) {
  const [state, formAction, pending] = useActionState<DeleteAccountState | null, FormData>(
    deleteAccountAction,
    null,
  );
  useSwalOnError(state);
  const [open, setOpen] = useState(false);

  const hasError = !!(state && state.ok === false && state.error);

  return (
    <section className="max-w-2xl rounded-2xl border border-danger/30 bg-paper p-6">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-danger-7">🗑 Hesabımı sil</h2>
        <p className="mt-1 text-xs text-ink-3">
          İşletme hesabını kapatır. <strong>Ürünler, stok, şubeler ve vitrin</strong> erişime
          kapanır ve giriş yapılamaz. Bu işlem geri alınamaz.
        </p>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-danger/40 bg-paper px-4 py-2 text-xs font-bold text-danger-7 hover:bg-danger-soft"
        >
          Hesabımı sil
        </button>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed text-danger-7">
            <strong>Bu işlem geri alınamaz.</strong> Hesabını kapatınca tüm verilerine erişim
            kesilir ve tekrar giriş yapamazsın.
            {hasActiveSubscription && (
              <span className="mt-2 block">
                ⚠ Aktif aboneliğin <strong>hemen iptal edilir</strong>, bir daha tahsilat
                yapılmaz. Kalan süre için <strong>iade yapılmaz</strong>.
              </span>
            )}
          </div>

          <div>
            <label
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
              htmlFor="delete-password"
            >
              Şifren (onay)
            </label>
            <input
              id="delete-password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={pending}
              aria-invalid={hasError || undefined}
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-danger focus:outline-none focus:ring-4 focus:ring-danger/15"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-white hover:bg-danger-7 disabled:opacity-60"
            >
              {pending ? 'Siliniyor...' : 'Onaylıyorum, hesabımı sil'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-bold text-ink-3 hover:bg-line-soft"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
