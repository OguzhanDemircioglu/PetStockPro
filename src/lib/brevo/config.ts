/**
 * Brevo (Sendinblue) Configuration
 *
 * Transactional email sender (Sprint 2.3+: verify email, reset password, invoices).
 * Production'da API key gerek. Sandbox/dev'de mock mode (console.log).
 */

import { z } from 'zod';

const brevoEnvSchema = z.object({
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().email().default('info@petstockpro.com'),
  BREVO_SENDER_NAME: z.string().default('PetStockPro'),
});

export type BrevoConfig = z.infer<typeof brevoEnvSchema>;

let cachedConfig: BrevoConfig | null = null;

function emptyToUndefined(v: string | undefined): string | undefined {
  return v === '' ? undefined : v;
}

export function getBrevoConfig(): BrevoConfig {
  if (cachedConfig) return cachedConfig;
  const parsed = brevoEnvSchema.safeParse({
    BREVO_API_KEY: emptyToUndefined(process.env.BREVO_API_KEY),
    BREVO_SENDER_EMAIL: emptyToUndefined(process.env.BREVO_SENDER_EMAIL),
    BREVO_SENDER_NAME: emptyToUndefined(process.env.BREVO_SENDER_NAME),
  });
  if (!parsed.success) {
    throw new Error(`Brevo env config geçersiz: ${parsed.error.message}`);
  }
  cachedConfig = parsed.data;
  return cachedConfig;
}

/**
 * API key var mı? Yoksa send fn console.log fallback'e geçer.
 */
export function isBrevoConfigured(): boolean {
  return !!getBrevoConfig().BREVO_API_KEY;
}

export function _resetBrevoConfigCache(): void {
  cachedConfig = null;
}
