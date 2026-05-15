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
import {
  isLocked,
  processFailedLogin,
  processSuccessfulLogin,
  type UserAuthState,
} from './brute-force';
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
  const { email, password } = parsed.data;

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
  };
  if (isLocked(state, now)) {
    return null; // UI route handler lockedUntil'i ayrıca okur (countdown için)
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
      })
      .where(eq(users.id, user.id));
    return null;
  }

  // 6. Success — reset failed count + lock
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
