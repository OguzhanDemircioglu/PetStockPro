/**
 * 2FA Setup Orchestration — Sprint 2.5
 *
 * EKRAN-AUTH §7.3 3-adım wizard:
 *   1. initTwoFactorSetup(userId) → secret üret + 10dk geçici sakla + QR data URL
 *   2. verifyTwoFactorSetup(userId, code) → speakeasy.totp.verify + recovery codes üret
 *   3. enableTwoFactor(userId, acknowledged) → twoFactorEnabled=true + secret kalıcı
 *
 * Disable: disableTwoFactor(userId, password) — şifre re-auth + clear
 *
 * Dependency injection: db parametre olarak verilir → test'lerde mock'lanır.
 */

import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import {
  generateTotpSecret,
  buildOtpAuthUri,
  verifyTotp,
  generateRecoveryCodes,
  TWO_FACTOR_SETUP_TTL_MS,
} from './two-factor';
import type { DbClient } from '@/lib/db/client';
import { users } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────
// 1. INIT — geçici secret + QR
// ─────────────────────────────────────────────────────────────────

export interface InitTwoFactorSetupResult {
  secret: string;        // base32 (kullanıcı manuel girebilir)
  otpAuthUri: string;    // otpauth:// URI
  qrCodeDataUrl: string; // data:image/png;base64,...
  expiresAt: Date;
}

export async function initTwoFactorSetup(
  userId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<InitTwoFactorSetupResult> {
  // User'ı çek (email QR label için gerekli)
  const rows = await db
    .select({ id: users.id, email: users.email, twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];

  if (!user) {
    throw new Error('Kullanıcı bulunamadı');
  }
  if (user.twoFactorEnabled) {
    throw new Error('2FA zaten aktif — önce mevcut 2FA\'yı kapat');
  }

  const secret = generateTotpSecret();
  const otpAuthUri = buildOtpAuthUri(user.email, secret);
  const expiresAt = new Date(now.getTime() + TWO_FACTOR_SETUP_TTL_MS);

  // Geçici secret'ı DB'ye yaz (10 dk TTL — verifySetup içinde okunur)
  await db
    .update(users)
    .set({
      twoFactorSetupSecret: secret,
      twoFactorSetupExpiresAt: expiresAt,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  // QR data URL — Authenticator app'ler için
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUri, {
    errorCorrectionLevel: 'M',
    width: 280,
    margin: 2,
    color: { dark: '#1a2530', light: '#ffffff' },
  });

  return { secret, otpAuthUri, qrCodeDataUrl, expiresAt };
}

// ─────────────────────────────────────────────────────────────────
// 2. VERIFY — 6 haneli kod kontrol + recovery codes üret
// ─────────────────────────────────────────────────────────────────

export type VerifyTwoFactorSetupResult =
  | { ok: true; recoveryCodes: string[] } // plain (sadece bu çağrıda gösterilir)
  | { ok: false; reason: 'expired' | 'no_setup' | 'invalid_code' };

export async function verifyTwoFactorSetup(
  userId: string,
  totpCode: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<VerifyTwoFactorSetupResult> {
  const rows = await db
    .select({
      twoFactorSetupSecret: users.twoFactorSetupSecret,
      twoFactorSetupExpiresAt: users.twoFactorSetupExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];

  if (!user || !user.twoFactorSetupSecret) {
    return { ok: false, reason: 'no_setup' };
  }
  if (user.twoFactorSetupExpiresAt && user.twoFactorSetupExpiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  if (!verifyTotp(user.twoFactorSetupSecret, totpCode)) {
    return { ok: false, reason: 'invalid_code' };
  }

  // Doğru — recovery codes üret + DB'ye yaz (henüz enable değil, "Kaydettim" onayı bekliyor)
  const { plain, hashed } = generateRecoveryCodes();

  await db
    .update(users)
    .set({
      twoFactorRecoveryCodes: hashed,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return { ok: true, recoveryCodes: plain };
}

// ─────────────────────────────────────────────────────────────────
// 3. ENABLE — recovery codes ack + finalize
// ─────────────────────────────────────────────────────────────────

export type EnableTwoFactorResult =
  | { ok: true }
  | { ok: false; reason: 'no_setup' | 'no_recovery_codes' | 'expired' };

export async function enableTwoFactor(
  userId: string,
  acknowledged: boolean,
  db: DbClient,
  now: Date = new Date(),
): Promise<EnableTwoFactorResult> {
  if (!acknowledged) {
    return { ok: false, reason: 'no_recovery_codes' };
  }

  const rows = await db
    .select({
      twoFactorSetupSecret: users.twoFactorSetupSecret,
      twoFactorSetupExpiresAt: users.twoFactorSetupExpiresAt,
      twoFactorRecoveryCodes: users.twoFactorRecoveryCodes,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];

  if (!user || !user.twoFactorSetupSecret) {
    return { ok: false, reason: 'no_setup' };
  }
  if (user.twoFactorSetupExpiresAt && user.twoFactorSetupExpiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: 'expired' };
  }
  if (!user.twoFactorRecoveryCodes || user.twoFactorRecoveryCodes.length === 0) {
    return { ok: false, reason: 'no_recovery_codes' };
  }

  // setup secret'ı kalıcı slot'a taşı + setup alanlarını temizle
  await db
    .update(users)
    .set({
      twoFactorEnabled: true,
      twoFactorSecret: user.twoFactorSetupSecret,
      twoFactorEnabledAt: now,
      twoFactorSetupSecret: null,
      twoFactorSetupExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// DISABLE — 2FA'yı kapat (Sprint 2.5 minimal; Sprint 9 settings'ten çağrılır)
// ─────────────────────────────────────────────────────────────────

export type DisableTwoFactorResult =
  | { ok: true }
  | { ok: false; reason: 'not_enabled' | 'invalid_code' };

/**
 * 2FA'yı kapat — son bir TOTP doğrulamasıyla.
 *
 * EKRAN-AUTH §7.4 ideal flow: şifre re-auth + TOTP. Bu Sprint 2.5'in
 * minimal scope'u sadece TOTP doğrulama ile kapama. Sprint 9 settings'te
 * şifre re-auth katmanı eklenir.
 */
export async function disableTwoFactor(
  userId: string,
  totpCode: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<DisableTwoFactorResult> {
  const rows = await db
    .select({
      twoFactorEnabled: users.twoFactorEnabled,
      twoFactorSecret: users.twoFactorSecret,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return { ok: false, reason: 'not_enabled' };
  }

  if (!verifyTotp(user.twoFactorSecret, totpCode)) {
    return { ok: false, reason: 'invalid_code' };
  }

  await db
    .update(users)
    .set({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: null,
      twoFactorEnabledAt: null,
      twoFactorSetupSecret: null,
      twoFactorSetupExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return { ok: true };
}
