/**
 * iyzico Environment Configuration
 *
 * Sandbox URL default — production switch için env'de IYZICO_BASE_URL=https://api.iyzipay.com.
 * Key'ler kullanıcı tarafından canlıya çıkmadan önce verilecek (CLAUDE.md notu).
 *
 * Sandbox key alma: https://merchant.iyzipay.com → Test Ortamı → API Anahtarı
 */

import { z } from 'zod';

const iyzicoEnvSchema = z.object({
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_BASE_URL: z.string().url().default('https://sandbox-api.iyzipay.com'),
  IYZICO_WEBHOOK_SECRET: z.string().optional(),
});

export type IyzicoConfig = z.infer<typeof iyzicoEnvSchema>;

let cachedConfig: IyzicoConfig | null = null;

export function getIyzicoConfig(): IyzicoConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = iyzicoEnvSchema.safeParse({
    IYZICO_API_KEY: process.env.IYZICO_API_KEY,
    IYZICO_SECRET_KEY: process.env.IYZICO_SECRET_KEY,
    IYZICO_BASE_URL: process.env.IYZICO_BASE_URL,
    IYZICO_WEBHOOK_SECRET: process.env.IYZICO_WEBHOOK_SECRET,
  });

  if (!parsed.success) {
    throw new Error(`iyzico env config geçersiz: ${parsed.error.message}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

/**
 * iyzico canlı API key + secret env'de var mı?
 * `false` ise iyzico operasyonları çalışmaz — sandbox testleri mock ile yapılmalı.
 */
export function isIyzicoConfigured(): boolean {
  const cfg = getIyzicoConfig();
  return !!(cfg.IYZICO_API_KEY && cfg.IYZICO_SECRET_KEY);
}

/**
 * Production'da mıyız (sandbox değil)?
 * Webhook signature verification + log redaction için kritik.
 */
export function isIyzicoProduction(): boolean {
  const cfg = getIyzicoConfig();
  return cfg.IYZICO_BASE_URL === 'https://api.iyzipay.com';
}

/**
 * Test'lerde cache reset için
 */
export function _resetIyzicoConfigCache(): void {
  cachedConfig = null;
}
