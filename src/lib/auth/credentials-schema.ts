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
});

export type Credentials = z.infer<typeof credentialsSchema>;
