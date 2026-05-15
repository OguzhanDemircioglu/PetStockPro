/**
 * Credentials provider input schema (email + password)
 *
 * Auth.js Credentials provider raw input alır (Record<string, unknown>),
 * Zod ile parse edip type-safe halde authorize fn'e geçiriyoruz.
 */

import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().email('Geçersiz e-posta adresi').toLowerCase(),
  password: z.string().min(1, 'Şifre zorunlu'),
  // 2FA: 6 haneli TOTP veya recovery code (ABCD-EFGH). Sprint 2.5'te eklendi.
  // Boş string'i undefined'a çevir — frontend ilk login form'da bu alanı göndermez.
  totp: z.preprocess(
    (val) => (typeof val === 'string' && val.length === 0 ? undefined : val),
    z.string().optional(),
  ),
});

export type Credentials = z.infer<typeof credentialsSchema>;
