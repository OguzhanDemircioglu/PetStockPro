'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { RecoveryCodesActions } from '@/components/auth/recovery-codes-actions';
import {
  disable2faAction,
  regenerate2faRecoveryAction,
  type DisableState,
  type RegenerateState,
} from './actions';

interface SecurityFormsProps {
  email: string;
  twoFactorEnabled: boolean;
  twoFactorEnabledAt: Date | null;
  remainingRecoveryCount: number;
  just2faDisabled: boolean;
}

/**
 * /admin/security UI — Sprint 2.8
 *
 * 3 panel:
 *   1. 2FA status — enabled mi, ne zaman aktive, kaç recovery kaldı
 *   2. Disable 2FA — TOTP doğrulamayla
 *   3. Regenerate recovery codes — TOTP doğrulamayla + 8 yeni kod ekranı
 */
export function SecurityForms({
  email,
  twoFactorEnabled,
  twoFactorEnabledAt,
  remainingRecoveryCount,
  just2faDisabled,
}: SecurityFormsProps) {
  const [disableState, disableFormAction, disablePending] = useActionState<
    DisableState | null,
    FormData
  >(disable2faAction, null);

  const [regenState, regenFormAction, regenPending] = useActionState<
    RegenerateState | null,
    FormData
  >(regenerate2faRecoveryAction, null);

  const [showDisable, setShowDisable] = useState(false);
  const [showRegen, setShowRegen] = useState(false);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <p className="text-sm text-ink-3">
        <strong className="text-cart">{email}</strong> hesabının 2FA ve recovery code
        ayarları.
      </p>

      {just2faDisabled && (
        <div
          role="alert"
          className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7"
        >
          ✅ 2FA başarıyla kapatıldı. Hesabın artık sadece şifreyle korunuyor.
        </div>
      )}

      {/* PANEL 1: 2FA Durum */}
      <section className="rounded-2xl border border-line bg-paper p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-cart">🛡 İki faktörlü kimlik doğrulama</h2>
            <p className="mt-1 text-xs text-ink-3">
              Hesabını authenticator app + telefonla koru.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-lg px-3 py-1 text-[12.5px] font-bold uppercase tracking-wider ${
              twoFactorEnabled
                ? 'bg-arrow-soft text-arrow-7'
                : 'bg-line-soft text-ink-4'
            }`}
          >
            {twoFactorEnabled ? '✓ Aktif' : 'Pasif'}
          </span>
        </div>

        {twoFactorEnabled ? (
          <div className="space-y-2 text-xs text-ink-3">
            <div>
              <span className="font-bold text-ink-2">Aktive edildi:</span>{' '}
              {twoFactorEnabledAt?.toLocaleDateString('tr-TR') ?? '—'}
            </div>
            <div>
              <span className="font-bold text-ink-2">Yedek kodlar:</span>{' '}
              {remainingRecoveryCount} / 8 kullanılmamış
              {remainingRecoveryCount <= 2 && remainingRecoveryCount > 0 && (
                <span className="ml-2 rounded bg-cat-soft px-2 py-0.5 text-[11.5px] font-bold text-cart">
                  ⚠ Az kaldı — yenilemen önerilir
                </span>
              )}
              {remainingRecoveryCount === 0 && (
                <span className="ml-2 rounded bg-danger-soft px-2 py-0.5 text-[11.5px] font-bold text-danger-7">
                  🔴 Hepsi kullanıldı — hemen yenile
                </span>
              )}
            </div>
          </div>
        ) : (
          <Link
            href={'/2fa-setup' as never}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
          >
            🛡 2FA&apos;yı aktif et →
          </Link>
        )}
      </section>

      {/* PANEL 2: Disable 2FA */}
      {twoFactorEnabled && (
        <section className="rounded-2xl border border-danger/30 bg-paper p-6">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-danger-7">🔓 2FA&apos;yı kapat</h2>
            <p className="mt-1 text-xs text-ink-3">
              Authenticator app&apos;ten güncel 6 haneli kodu gir — 2FA tamamen kapanır,
              hesabın sadece şifreyle korunur.
            </p>
          </div>

          {disableState?.error && (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
            >
              {disableState.error}
            </div>
          )}

          {!showDisable ? (
            <button
              type="button"
              onClick={() => setShowDisable(true)}
              className="rounded-xl border border-danger/40 bg-paper px-4 py-2 text-xs font-bold text-danger-7 hover:bg-danger-soft"
            >
              2FA&apos;yı kapat
            </button>
          ) : (
            <form action={disableFormAction} className="flex flex-col gap-3">
              <input
                name="totp"
                type="text"
                inputMode="numeric"
                placeholder="6 haneli kod"
                autoComplete="one-time-code"
                required
                disabled={disablePending}
                maxLength={7}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-ink focus:border-danger focus:outline-none focus:ring-4 focus:ring-danger/15"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={disablePending}
                  className="flex-1 rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-white hover:bg-danger-7 disabled:opacity-60"
                >
                  {disablePending ? 'İşleniyor...' : 'Onaylıyorum, 2FA\'yı kapat'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisable(false)}
                  disabled={disablePending}
                  className="rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-bold text-ink-3 hover:bg-line-soft"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* PANEL 3: Regenerate recovery codes */}
      {twoFactorEnabled && (
        <section className="rounded-2xl border border-line bg-paper p-6">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-cart">🔑 Yedek kodları yenile</h2>
            <p className="mt-1 text-xs text-ink-3">
              Yeni 8 yedek kod üret. <strong>Mevcut kodlar geçersiz olur</strong>.
              Authenticator&apos;ından güncel 6 haneli kodu gir.
            </p>
          </div>

          {regenState?.error && (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
            >
              {regenState.error}
            </div>
          )}

          {regenState?.recoveryCodes.length ? (
            <div>
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-paper p-4 font-mono text-sm">
                {regenState.recoveryCodes.map((c) => (
                  <div key={c} className="rounded-lg bg-paper px-3 py-2 text-center">
                    {c}
                  </div>
                ))}
              </div>
              <RecoveryCodesActions codes={regenState.recoveryCodes} email={email} />
              <div className="mt-3 rounded-xl border border-cat/20 bg-cat-soft px-4 py-3 text-xs text-cart">
                ⚠ Bu kodlar bir daha gösterilmeyecek — güvenli yere kaydet.
              </div>
            </div>
          ) : !showRegen ? (
            <button
              type="button"
              onClick={() => setShowRegen(true)}
              className="rounded-xl border border-line bg-paper px-4 py-2 text-xs font-bold text-ink-2 hover:bg-line-soft"
            >
              🔄 Yedek kodları yenile
            </button>
          ) : (
            <form action={regenFormAction} className="flex flex-col gap-3">
              <input
                name="totp"
                type="text"
                inputMode="numeric"
                placeholder="6 haneli kod"
                autoComplete="one-time-code"
                required
                disabled={regenPending}
                maxLength={7}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={regenPending}
                  className="flex-1 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-4 py-2.5 text-sm font-bold text-white hover:-translate-y-0.5 transition-transform disabled:opacity-60"
                >
                  {regenPending ? 'Üretiliyor...' : 'Yeni kodları üret'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegen(false)}
                  disabled={regenPending}
                  className="rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-bold text-ink-3 hover:bg-line-soft"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          )}
        </section>
      )}

    </div>
  );
}
