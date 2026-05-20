'use client';

import { useActionState } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import {
  forcePasswordResetAction,
  resetTwoFactorAction,
  lockAccountActionForm,
  unlockAccountActionForm,
  type RemoteUserActionState,
} from './actions';

function StateBanner({ state }: { state: RemoteUserActionState | null }) {
  if (!state) return null;
  if (state.ok && state.message) {
    return (
      <div className="mt-3 rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-2.5 text-[13.5px] font-bold text-arrow-7">
        ✓ {state.message}
      </div>
    );
  }
  // Error case → SWAL ile gösterilir (form içinde useSwalOnError çağrılıyor)
  return null;
}

interface BaseProps {
  targetUserId: string;
}

const inputClass =
  'w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15';
const labelClass =
  'mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3';
const buttonClass =
  'rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-md hover:-translate-y-0.5 transition-transform disabled:opacity-60';

// ══════════════════════════════════════════════════════════════
// 1. Force password reset
// ══════════════════════════════════════════════════════════════

export function ForcePasswordResetForm({ targetUserId }: BaseProps) {
  const [state, formAction, pending] = useActionState<RemoteUserActionState | null, FormData>(
    forcePasswordResetAction,
    null,
  );
  useSwalOnError(state);
  const hasError = !!state?.error;

  return (
    <form action={formAction} className="rounded-xl border border-line bg-paper p-4">
      <h3 className="text-sm font-bold text-cart">🔑 Şifre sıfırlama linki gönder</h3>
      <p className="mt-1 text-[12.5px] text-ink-3">
        Brevo email + 30 dakika TTL token. Kullanıcı linke tıklayıp yeni şifre belirler.
      </p>
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <div className="mt-3 grid gap-3">
        <div>
          <label htmlFor="pr-reason" className={labelClass}>
            Sebep (min 10 karakter)
          </label>
          <textarea
            id="pr-reason"
            name="reason"
            required
            minLength={10}
            maxLength={500}
            rows={2}
            disabled={pending}
            data-testid="pr-reason"
            placeholder="Örn: Kullanıcı destek üzerinden talep etti, email'i değişmiş, kendi /forgot ile ulaşamıyor"
            aria-invalid={hasError || undefined}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="pr-password" className={labelClass}>
            Süperadmin şifresi
          </label>
          <input
            id="pr-password"
            name="superadminPassword"
            type="password"
            required
            autoComplete="current-password"
            disabled={pending}
            data-testid="pr-password"
            aria-invalid={hasError || undefined}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          data-testid="pr-submit"
          className={`${buttonClass} bg-gradient-to-br from-cat to-cat-2`}
        >
          {pending ? '⏳' : '🔑 Sıfırlama linkini gönder'}
        </button>
      </div>
      <StateBanner state={state} />
    </form>
  );
}

// ══════════════════════════════════════════════════════════════
// 2. Reset 2FA
// ══════════════════════════════════════════════════════════════

export function ResetTwoFactorForm({ targetUserId, isEnabled }: BaseProps & { isEnabled: boolean }) {
  const [state, formAction, pending] = useActionState<RemoteUserActionState | null, FormData>(
    resetTwoFactorAction,
    null,
  );
  useSwalOnError(state);
  const hasError = !!state?.error;

  return (
    <form action={formAction} className="rounded-xl border border-line bg-paper p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-cart">🛡 2FA sıfırla (uzaktan)</h3>
        {isEnabled ? (
          <span className="rounded-full bg-arrow-soft px-2 py-0.5 text-[11.5px] font-bold text-arrow-7">
            Aktif
          </span>
        ) : (
          <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11.5px] font-bold text-ink-3">
            Kapalı
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-ink-3">
        2FA secret + recovery codes silinir. Kullanıcı bir sonraki login&apos;de TOTP istenmez,
        kendisi yeniden setup yapmalı. <strong>Telegram alert critical severity</strong>.
      </p>
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <fieldset disabled={!isEnabled} className="disabled:opacity-50">
        <div className="mt-3 grid gap-3">
          <div>
            <label htmlFor="tfa-reason" className={labelClass}>
              Sebep (min 10 karakter)
            </label>
            <textarea
              id="tfa-reason"
              name="reason"
              required={isEnabled}
              minLength={10}
              maxLength={500}
              rows={2}
              data-testid="tfa-reason"
              placeholder="Örn: Telefonunu kaybetti, recovery code'ları da bulamıyor, kimlik doğrulandı"
              aria-invalid={hasError || undefined}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="tfa-password" className={labelClass}>
              Süperadmin şifresi
            </label>
            <input
              id="tfa-password"
              name="superadminPassword"
              type="password"
              required={isEnabled}
              autoComplete="current-password"
              data-testid="tfa-password"
              aria-invalid={hasError || undefined}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={pending || !isEnabled}
            data-testid="tfa-submit"
            className={`${buttonClass} bg-gradient-to-br from-danger to-danger-2`}
          >
            {pending ? '⏳' : '🛡 2FA sıfırla'}
          </button>
        </div>
      </fieldset>
      <StateBanner state={state} />
    </form>
  );
}

// ══════════════════════════════════════════════════════════════
// 3a. Lock account
// ══════════════════════════════════════════════════════════════

export function LockAccountForm({ targetUserId, isLocked }: BaseProps & { isLocked: boolean }) {
  const [state, formAction, pending] = useActionState<RemoteUserActionState | null, FormData>(
    lockAccountActionForm,
    null,
  );
  useSwalOnError(state);
  const hasError = !!state?.error;

  return (
    <form action={formAction} className="rounded-xl border border-danger/40 bg-danger-soft/30 p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-danger-7">🔒 Hesabı kilitle</h3>
        {isLocked && (
          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11.5px] font-bold text-danger-7">
            Şu an kilitli
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-ink-3">
        lockedUntil + lockedReason=&apos;SUPERADMIN&apos;. Kullanıcı sadece bu süre sonra login olabilir.
        1 saat - 30 gün (720 saat).
      </p>
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <div className="mt-3 grid gap-3">
        <div>
          <label htmlFor="lock-hours" className={labelClass}>
            Süre (saat) — 1..720
          </label>
          <input
            id="lock-hours"
            name="hours"
            type="number"
            min={1}
            max={720}
            defaultValue={24}
            required
            disabled={pending}
            data-testid="lock-hours"
            aria-invalid={hasError || undefined}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="lock-reason" className={labelClass}>
            Sebep (min 10 karakter)
          </label>
          <textarea
            id="lock-reason"
            name="reason"
            required
            minLength={10}
            maxLength={500}
            rows={2}
            disabled={pending}
            data-testid="lock-reason"
            placeholder="Örn: Şüpheli aktivite, müşteri talebi üzerine geçici askıya alma"
            aria-invalid={hasError || undefined}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="lock-password" className={labelClass}>
            Süperadmin şifresi
          </label>
          <input
            id="lock-password"
            name="superadminPassword"
            type="password"
            required
            autoComplete="current-password"
            disabled={pending}
            data-testid="lock-password"
            aria-invalid={hasError || undefined}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          data-testid="lock-submit"
          className={`${buttonClass} bg-gradient-to-br from-danger to-danger-2`}
        >
          {pending ? '⏳' : '🔒 Hesabı kilitle'}
        </button>
      </div>
      <StateBanner state={state} />
    </form>
  );
}

// ══════════════════════════════════════════════════════════════
// 3b. Unlock account
// ══════════════════════════════════════════════════════════════

export function UnlockAccountForm({ targetUserId, isLocked }: BaseProps & { isLocked: boolean }) {
  const [state, formAction, pending] = useActionState<RemoteUserActionState | null, FormData>(
    unlockAccountActionForm,
    null,
  );
  useSwalOnError(state);
  const hasError = !!state?.error;

  return (
    <form action={formAction} className="rounded-xl border border-arrow/40 bg-arrow-soft/40 p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-arrow-7">🔓 Hesap kilidini aç</h3>
        {!isLocked && (
          <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11.5px] font-bold text-ink-3">
            Kilitli değil
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-ink-3">
        lockedUntil + lockedReason temizlenir. failed_login_count + recent_lock_count
        sıfırlanır. Kullanıcı tekrar login olabilir.
      </p>
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <div className="mt-3 grid gap-3">
        <div>
          <label htmlFor="unlock-reason" className={labelClass}>
            Sebep (min 10 karakter)
          </label>
          <textarea
            id="unlock-reason"
            name="reason"
            required
            minLength={10}
            maxLength={500}
            rows={2}
            disabled={pending}
            data-testid="unlock-reason"
            placeholder="Örn: Müşteri destek dosyası, doğrulama tamamlandı, hesap güvenli"
            aria-invalid={hasError || undefined}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="unlock-password" className={labelClass}>
            Süperadmin şifresi
          </label>
          <input
            id="unlock-password"
            name="superadminPassword"
            type="password"
            required
            autoComplete="current-password"
            disabled={pending}
            data-testid="unlock-password"
            aria-invalid={hasError || undefined}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          data-testid="unlock-submit"
          className={`${buttonClass} bg-gradient-to-br from-arrow to-arrow-2`}
        >
          {pending ? '⏳' : '🔓 Kilidi aç'}
        </button>
      </div>
      <StateBanner state={state} />
    </form>
  );
}
