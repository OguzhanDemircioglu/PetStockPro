'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useSwalOnErrorString } from '@/lib/ui/use-swal-on-error';
import { forgotPasswordAction, type ForgotPasswordState } from './actions';

/**
 * Forgot Password Page — Sprint 2.4
 *
 * EKRAN-AUTH §5.1 — sade tek-kart layout (verify-email pattern).
 * Submit sonrası kullanıcı her durumda aynı "kontrol et" ekranını görür
 * (enumeration koruma).
 *
 * Sprint 2.5+ eklenecek: Cloudflare Turnstile widget (zorunlu).
 */
export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<ForgotPasswordState | null, FormData>(
    forgotPasswordAction,
    null,
  );
  // ForgotPasswordState yalnızca validationError üzerinden hata raporlar;
  // generic enumeration-safe message her durumda submitted ekranında gösterilir.
  useSwalOnErrorString(state?.validationError, 'Geçersiz email');
  // Field-level kızartma — validationError varsa email input'una aria-invalid set et.
  const hasError = !!state?.validationError;

  // Submitted → bilgi ekranı
  if (state?.submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-16">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
          <div className="mb-6 flex justify-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cat-soft text-3xl">
              📬
            </div>
          </div>

          <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-cart">
            E-postanı kontrol et
          </h1>

          <p className="mt-3 text-center text-sm leading-relaxed text-ink-3">
            {state.message}
          </p>

          <div className="mt-6 space-y-2 rounded-xl bg-line-soft px-4 py-3 text-xs leading-relaxed text-ink-2">
            <div className="flex items-start gap-2">
              <span className="text-cat">⏰</span>
              <span>
                Link <strong>30 dakika</strong> geçerli, sadece <strong>1 kez</strong> kullanılabilir.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-cat">📬</span>
              <span>
                E-posta gelmediyse <strong>Spam/Junk</strong> klasörüne bak.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-cat">🔒</span>
              <span>
                Şifren değiştiğinde tüm açık oturumların kapanır (Sprint 9&apos;da aktif).
              </span>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-ink-4">
            <Link
              href={'/login' as never}
              className="border-b border-dashed border-cart font-bold text-cart hover:text-cat hover:border-cat"
            >
              Giriş ekranına dön
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // İlk form ekranı
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        <div className="mb-6 flex justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cat-soft text-3xl">
            🔑
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-cart">
          Şifremi unuttum
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-ink-3">
          Hesap e-postanı gir, sana 30 dakika geçerli bir sıfırlama bağlantısı göndereceğiz.
        </p>


        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <div>
            <label
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
              htmlFor="email"
            >
              E-posta
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="ornek@petshop.com"
              autoComplete="email"
              required
              disabled={pending}
              defaultValue={state?.email ?? ''}
              aria-invalid={hasError || undefined}
              className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(212,74,20,0.34)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {pending ? (
              <span className="text-xs tracking-wider">Gönderiliyor...</span>
            ) : (
              <>Sıfırlama bağlantısı gönder →</>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-ink-4">
          Şifren aklına geldi mi?{' '}
          <Link
            href={'/login' as never}
            className="border-b border-dashed border-cart font-bold text-cart hover:text-cat hover:border-cat"
          >
            Giriş yap
          </Link>
        </div>

        <div className="mt-5 rounded-lg border border-line bg-paper px-3 py-2.5 text-[12px] leading-snug text-ink-4 text-center">
          <strong className="text-cart">Cloudflare Turnstile</strong> bot koruması Sprint 2.5&apos;te
          aktif olacak.
        </div>
      </div>
    </main>
  );
}
