'use server';

/**
 * 2FA Setup Server Actions
 *
 * Wizard adımları:
 *   1. initAction (POST) → secret + QR data URL + otpauth URI
 *   2. verifyAction (POST) → totp doğrula + recovery codes üret
 *   3. enableAction (POST) → "Kaydettim" ack + 2FA aktif
 *
 * Auth required — session yoksa redirect /login.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  initTwoFactorSetup,
  verifyTwoFactorSetup,
  enableTwoFactor,
} from '@/lib/auth/two-factor-setup';

export interface InitState {
  secret: string;
  otpAuthUri: string;
  qrCodeDataUrl: string;
  error: string | null;
}

export async function initSetupAction(): Promise<InitState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  try {
    const result = await initTwoFactorSetup(session.user.id, db);
    return {
      secret: result.secret,
      otpAuthUri: result.otpAuthUri,
      qrCodeDataUrl: result.qrCodeDataUrl,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '2FA başlatılamadı';
    return {
      secret: '',
      otpAuthUri: '',
      qrCodeDataUrl: '',
      error: message,
    };
  }
}

export interface VerifyState {
  recoveryCodes: string[];
  error: string | null;
}

export async function verifySetupAction(
  _prevState: VerifyState | null,
  formData: FormData,
): Promise<VerifyState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  const totpCode = formData.get('totpCode');
  if (typeof totpCode !== 'string') {
    return { recoveryCodes: [], error: 'TOTP kodu zorunlu' };
  }

  const result = await verifyTwoFactorSetup(session.user.id, totpCode, db);
  if (!result.ok) {
    const message = {
      no_setup: '2FA setup başlatılmamış — sayfayı yenile.',
      expired: 'Setup süresi doldu (10 dakika). Tekrar başlat.',
      invalid_code: 'Kod hatalı. Authenticator app\'ten güncel kodu gir.',
    }[result.reason];
    return { recoveryCodes: [], error: message };
  }

  return { recoveryCodes: result.recoveryCodes, error: null };
}

export interface EnableState {
  ok: boolean;
  error: string | null;
}

export async function enableSetupAction(
  _prevState: EnableState | null,
  formData: FormData,
): Promise<EnableState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  const acknowledged = formData.get('acknowledged') === 'on';
  const result = await enableTwoFactor(session.user.id, acknowledged, db);

  if (!result.ok) {
    const message = {
      no_setup: '2FA setup başlatılmamış.',
      no_recovery_codes: 'Önce yedek kodları kaydettiğini onayla.',
      expired: 'Setup süresi doldu.',
    }[result.reason];
    return { ok: false, error: message };
  }

  redirect('/?2fa=enabled' as never);
}
