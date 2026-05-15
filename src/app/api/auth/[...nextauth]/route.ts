/**
 * Auth.js v5 catch-all route handler.
 *
 * Auth.js'in tüm endpoint'lerini (/api/auth/signin, /signout, /session, /csrf, /callback, ...)
 * tek dosya ile handle eder.
 *
 * Konfigürasyon: src/lib/auth/auth.ts
 */

import { handlers } from '@/lib/auth/auth';

export const { GET, POST } = handlers;
