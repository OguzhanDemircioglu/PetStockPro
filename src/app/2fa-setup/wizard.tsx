'use client';

import { useState, useActionState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RecoveryCodesActions } from '@/components/auth/recovery-codes-actions';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import {
  verifySetupAction,
  enableSetupAction,
  type VerifyState,
  type EnableState,
} from './actions';

interface TwoFactorWizardProps {
  secret: string;
  qrCodeDataUrl: string;
  userEmail: string;
}

/**
 * 2FA Setup 3-step Wizard — Client Component
 *
 * State: step (1=QR | 2=Verify | 3=Recovery)
 *
 * Step 1: QR + manual secret
 * Step 2: 6-digit verify → backend → recovery codes
 * Step 3: Show recovery codes + "Kaydettim" checkbox → enable
 */
export function TwoFactorWizard({
  secret,
  qrCodeDataUrl,
  userEmail,
}: TwoFactorWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const [verifyState, verifyAction, verifyPending] = useActionState<VerifyState | null, FormData>(
    async (prev, formData) => {
      const result = await verifySetupAction(prev, formData);
      if (result.error === null) {
        setRecoveryCodes(result.recoveryCodes);
        setStep(3);
      }
      return result;
    },
    null,
  );

  const [enableState, enableAction, enablePending] = useActionState<EnableState | null, FormData>(
    enableSetupAction,
    null,
  );
  useSwalOnError(verifyState);
  useSwalOnError(enableState);
  // Field-level kızartma — Step 2 TOTP input hata zinciri.
  const hasVerifyError = !!verifyState?.error;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-12">
      <div className="w-full max-w-xl rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-1 items-center">
              <div
                className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition-colors ${
                  step >= s ? 'bg-cat text-white' : 'bg-line-soft text-ink-4'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 flex-1 transition-colors ${
                    step > s ? 'bg-cat' : 'bg-line-soft'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* STEP 1: QR */}
        {step === 1 && (
          <div>
            <div className="mb-2 text-[13px] font-bold uppercase tracking-wider text-cat">
              Adım 1 / 3
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-cart">
              QR kodu Authenticator app&apos;ine ekle
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-3">
              Google Authenticator, Authy veya 1Password gibi bir uygulama aç,{' '}
              <strong className="text-cart">{userEmail}</strong> hesabın için QR&apos;ı tara.
            </p>

            <div className="mt-6 flex justify-center rounded-2xl bg-paper p-6">
              <Image
                src={qrCodeDataUrl}
                alt="2FA QR kodu"
                width={240}
                height={240}
                unoptimized
                className="rounded-lg"
              />
            </div>

            <details className="mt-4 rounded-xl bg-line-soft px-4 py-3 text-sm text-ink-3">
              <summary className="cursor-pointer font-bold">
                QR kod taranamıyorsa manuel anahtarı kopyala
              </summary>
              <div className="mt-3 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs">
                {secret}
              </div>
              <div className="mt-2 text-[12.5px] text-ink-4">
                Account: <strong>{userEmail}</strong> · Issuer:{' '}
                <strong>PetStockPro</strong> · Algorithm: SHA1 · Digits: 6 · Period: 30s
              </div>
            </details>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(212,74,20,0.34)] transition-all hover:-translate-y-0.5"
            >
              QR&apos;ı taradım, devam et →
            </button>

            <div className="mt-4 text-center">
              <Link
                href={'/' as never}
                className="text-xs text-ink-4 hover:text-cart"
              >
                Vazgeç ve panele dön
              </Link>
            </div>
          </div>
        )}

        {/* STEP 2: 6-digit verify */}
        {step === 2 && (
          <div>
            <div className="mb-2 text-[13px] font-bold uppercase tracking-wider text-cat">
              Adım 2 / 3
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-cart">
              6 haneli doğrulama kodunu gir
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-3">
              Authenticator app&apos;inde PetStockPro hesabının altındaki 6 haneli kodu gir.
              Kod her 30 saniyede bir yenilenir.
            </p>

            <form action={verifyAction} className="mt-6 flex flex-col gap-4">
              <input
                name="totpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="- - - - - -"
                autoComplete="one-time-code"
                required
                disabled={verifyPending}
                maxLength={7}
                aria-invalid={hasVerifyError || undefined}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-4 text-center font-mono text-2xl tracking-[0.4em] text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />

              <button
                type="submit"
                disabled={verifyPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(212,74,20,0.34)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {verifyPending ? 'Doğrulanıyor...' : 'Doğrula ve devam et →'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-center text-xs text-ink-4 hover:text-cart"
              >
                ← QR&apos;a geri dön
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: Recovery codes */}
        {step === 3 && (
          <div>
            <div className="mb-2 text-[13px] font-bold uppercase tracking-wider text-cat">
              Adım 3 / 3
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-cart">
              Yedek kodları sakla
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-3">
              Telefonunu kaybedersen veya Authenticator app&apos;in çalışmazsa bu kodlardan
              birini kullanarak giriş yapabilirsin. <strong>Her kod tek kullanımlık</strong>.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-paper p-6 font-mono text-sm">
              {recoveryCodes.map((code) => (
                <div key={code} className="rounded-lg bg-white px-3 py-2 text-center">
                  {code}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <RecoveryCodesActions codes={recoveryCodes} email={userEmail} />
            </div>

            <div className="mt-4 rounded-xl border border-cat/20 bg-cat-soft px-4 py-3 text-xs leading-relaxed text-cart">
              ⚠ Bu kodlar bir daha gösterilmeyecek — DB&apos;de SHA-256 hash olarak saklanır.
              Mutlaka güvenli bir yere kaydet (şifre yöneticin, kasada bir kâğıt, vs.).
            </div>

            <form action={enableAction} className="mt-6">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-line-soft px-3.5 py-3 text-xs leading-relaxed text-ink-2">
                <input
                  type="checkbox"
                  name="acknowledged"
                  required
                  className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-cat"
                />
                <span>
                  Yedek kodları <strong>güvenli bir yere kaydettim</strong>. Bunların
                  bir daha gösterilmeyeceğini biliyorum.
                </span>
              </label>

              <button
                type="submit"
                disabled={enablePending}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(212,74,20,0.34)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {enablePending ? 'Aktive ediliyor...' : '🛡 2FA\'yı aktive et'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
