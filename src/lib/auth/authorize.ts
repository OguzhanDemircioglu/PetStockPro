/**
 * Authorize logic — Credentials provider'ın çağırdığı asıl iş.
 *
 * Akış (EKRAN-AUTH.md §2):
 *   1. Zod validate (email + password format)
 *   2. DB'den user çek (email ile) — yoksa null (enumeration koruma)
 *   3. Lock kontrol — locked ise null
 *   4. emailVerifiedAt kontrol — verify edilmediyse null (kullanıcıya "Doğrulama linkin geldi" gösterilir)
 *   5. Password verify (bcryptjs) — yanlışsa processFailedLogin + DB update + null
 *   6. Başarılı: processSuccessfulLogin + DB update + return AuthorizedUser
 *
 * Dependency injection: db + helpers parametre olarak verilir → test'lerde fake/mock geçilir.
 */

import { eq } from 'drizzle-orm';
import { credentialsSchema } from './credentials-schema';
import { verifyPassword } from './password';
import { verifyTotp, verifyRecoveryCode } from './two-factor';
import {
  isLocked,
  getLockRemainingSeconds,
  processFailedLogin,
  processSuccessfulLogin,
  type UserAuthState,
} from './brute-force';
import {
  TwoFactorRequiredError,
  TwoFactorInvalidError,
  AccountLockedError,
  InvalidCredentialsError,
} from './errors';
import { sendBrevoEmail } from '@/lib/brevo/client';
import { buildAccountLockedTemplate } from '@/lib/brevo/templates';
import type { DbClient } from '@/lib/db/client';
import { users } from '@/db/schema';

/**
 * Authorize başarılıysa Auth.js'in beklediği user shape.
 * id zorunlu (Auth.js JWT subject). Diğerleri JWT callback'inde inject edilir.
 */
export interface AuthorizedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  companyId: string | null;
}

/**
 * authorizeCredentials — tüm authorize iş akışı.
 *
 * @returns AuthorizedUser if başarılı, null herhangi bir hata durumunda (Auth.js
 *          null'ı "invalid credentials" olarak frontend'e döner, biz UX'ı route
 *          handler'da detaylandırırız)
 */
export async function authorizeCredentials(
  rawCredentials: unknown,
  db: DbClient,
  now: Date = new Date(),
): Promise<AuthorizedUser | null> {
  // 1. Validate input format
  const parsed = credentialsSchema.safeParse(rawCredentials);
  if (!parsed.success) {
    return null;
  }
  const { email, password, totp } = parsed.data;

  // 2. DB lookup
  const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = userRows[0];
  if (!user) {
    return null; // enumeration koruma — kullanıcı yok mesajı vermeyiz
  }

  // 3. Locked?
  const state: UserAuthState = {
    failedLoginCount: user.failedLoginCount,
    lockedUntil: user.lockedUntil,
    recentLockCount: user.recentLockCount,
    lastLockedAt: user.lastLockedAt,
  };
  if (isLocked(state, now)) {
    // Lock varsa AccountLockedError fırlat → frontend /account-locked'a yönlendirir
    throw new AccountLockedError(
      getLockRemainingSeconds(state, now),
      user.lockedReason ?? 'BRUTE_FORCE_1H',
    );
  }

  // 4. Email verified?
  if (!user.emailVerifiedAt) {
    return null; // UI "Email doğrulanmamış — link tekrar gönder" gösterir
  }

  // 5. Password verify
  if (!user.passwordHash) {
    return null; // password set edilmemiş (davet kabul edilmemiş kullanıcı?)
  }
  const passwordOk = await verifyPassword(password, user.passwordHash);

  if (!passwordOk) {
    // Failed login tracking
    const result = processFailedLogin(state, now);
    await db
      .update(users)
      .set({
        failedLoginCount: result.newFailedCount,
        lockedUntil: result.newLockedUntil,
        lockedReason: result.lockedReason,
        recentLockCount: result.newRecentLockCount,
        lastLockedAt: result.newLastLockedAt,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // Bu fail lock'u tetiklediyse AccountLockedError (frontend /account-locked'a yönlendirir);
    // değilse null (generic "şifre yanlış" — UI banner için remaining bilgisini bir sonraki
    // login attempt'inde DB'den okuruz).
    if (result.shouldLock && result.newLockedUntil && result.lockedReason) {
      // Bilgilendirme email'i (Brevo) — fire-and-forget, fail durumunda lock sürer
      const template = buildAccountLockedTemplate({
        userName: user.name,
        reason: result.lockedReason as 'BRUTE_FORCE_1H' | 'BRUTE_FORCE_24H',
        lockedUntil: result.newLockedUntil,
        ipAddress: null, // Sprint 2.7 minimal: IP capture login action'da (Auth.js authorize req'i geçmez)
        resetPasswordUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/forgot-password`,
      });
      try {
        await sendBrevoEmail({
          to: { email: user.email },
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          tags: ['account-locked', result.lockedReason.toLowerCase()],
        });
      } catch (err) {
        console.warn(`[authorize] Account locked email fail user=${user.id}:`, err);
      }

      throw new AccountLockedError(
        Math.ceil((result.newLockedUntil.getTime() - now.getTime()) / 1000),
        result.lockedReason,
      );
    }

    // Lock tetiklenmedi ama şifre yanlış — frontend banner için remaining hakkı iletilir.
    // EKRAN-AUTH §2.3: 3 ve daha az kalınca banner gösterilir (frontend filter).
    throw new InvalidCredentialsError(result.remainingAttempts);
  }

  // 6. 2FA check (Sprint 2.5)
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!totp) {
      // Şifre doğru ama TOTP gerekli — frontend 2FA input gösterir
      throw new TwoFactorRequiredError();
    }

    // Recovery code formatı (ABCD-EFGH veya ABCDEFGH 8+ char) önce dene
    const trimmed = totp.trim();
    const looksLikeRecovery = /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(trimmed);

    if (looksLikeRecovery && user.twoFactorRecoveryCodes) {
      const result = verifyRecoveryCode(user.twoFactorRecoveryCodes, trimmed, now);
      if (!result.ok) {
        throw new TwoFactorInvalidError();
      }
      // Recovery code kullanıldı → DB'de updatedCodes yaz
      await db
        .update(users)
        .set({ twoFactorRecoveryCodes: result.updatedCodes, updatedAt: now })
        .where(eq(users.id, user.id));
    } else {
      // TOTP olarak değerlendir
      if (!verifyTotp(user.twoFactorSecret, trimmed)) {
        // EKRAN-AUTH §2.3: TOTP yanlışı failedLoginCount'a SAYILMAZ — şifre doğruydu
        throw new TwoFactorInvalidError();
      }
    }
  }

  // 7. Success — reset failed count + lock
  const success = processSuccessfulLogin();
  await db
    .update(users)
    .set({
      failedLoginCount: success.newFailedCount,
      lockedUntil: success.newLockedUntil,
    })
    .where(eq(users.id, user.id));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
  };
}
