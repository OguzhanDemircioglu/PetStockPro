'use server';

/**
 * Admin > Security Server Actions — Sprint 2.8
 *
 * 2FA disable + recovery codes regenerate.
 * Auth gate: session yoksa redirect /login.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  disableTwoFactor,
  regenerateRecoveryCodes,
} from '@/lib/auth/two-factor-setup';

export interface DisableState {
  ok: boolean;
  error: string | null;
}

export async function disable2faAction(
  _prevState: DisableState | null,
  formData: FormData,
): Promise<DisableState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  const totp = formData.get('totp');
  if (typeof totp !== 'string') {
    return { ok: false, error: '2FA kodu zorunlu' };
  }

  const result = await disableTwoFactor(session.user.id, totp, db);
  if (!result.ok) {
    const msg = {
      not_enabled: '2FA aktif değil.',
      invalid_code: 'Doğrulama kodu hatalı. Authenticator app\'ten güncel kodu gir.',
    }[result.reason];
    return { ok: false, error: msg };
  }

  redirect('/admin/account?2fa=disabled' as never);
}

export interface RegenerateState {
  recoveryCodes: string[];
  error: string | null;
}

export async function regenerate2faRecoveryAction(
  _prevState: RegenerateState | null,
  formData: FormData,
): Promise<RegenerateState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  const totp = formData.get('totp');
  if (typeof totp !== 'string') {
    return { recoveryCodes: [], error: '2FA kodu zorunlu' };
  }

  const result = await regenerateRecoveryCodes(session.user.id, totp, db);
  if (!result.ok) {
    const msg = {
      not_enabled: '2FA aktif değil.',
      invalid_code: 'Doğrulama kodu hatalı.',
    }[result.reason];
    return { recoveryCodes: [], error: msg };
  }

  return { recoveryCodes: result.recoveryCodes, error: null };
}
