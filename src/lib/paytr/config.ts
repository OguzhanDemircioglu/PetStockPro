/**
 * PayTR Environment Configuration
 *
 * PayTR Mağaza Paneli → "Bilgi" sayfasından alınan 3 kimlik bilgisi
 * (merchant_id / merchant_key / merchant_salt) + test_mode flag.
 *
 * Test ↔ canlı geçişi PAYTR_TEST_MODE ile yapılır — PayTR iyzico/Nilvera gibi
 * ayrı bir base URL kullanmaz; aynı endpoint'e `test_mode=1` parametresi gönderilir.
 *
 * Callback (ödeme bildirimi) imzası merchant_key + merchant_salt ile
 * HMAC-SHA256 doğrulanır — ayrı webhook secret YOK.
 *
 * Anahtarlar kullanıcı tarafından verilir (CLAUDE.md notu — lansman bloker).
 */

import { z } from 'zod';

const paytrEnvSchema = z.object({
  PAYTR_MERCHANT_ID: z.string().optional(),
  PAYTR_MERCHANT_KEY: z.string().optional(),
  PAYTR_MERCHANT_SALT: z.string().optional(),
  // '1' = test ortamı, '0' = canlı. Env'den string gelir; aşağıda 0|1'e normalize edilir.
  PAYTR_TEST_MODE: z.enum(['0', '1']).default('1'),
  PAYTR_BASE_URL: z.string().url().default('https://www.paytr.com'),
});

export interface PaytrConfig {
  merchantId?: string;
  merchantKey?: string;
  merchantSalt?: string;
  testMode: 0 | 1;
  baseUrl: string;
}

let cachedConfig: PaytrConfig | null = null;

/**
 * Boş env değişkeni undefined'a normalize (vi.stubEnv '' ile setler — Zod optional'a uyum).
 */
function emptyToUndefined(v: string | undefined): string | undefined {
  return v === '' ? undefined : v;
}

export function getPaytrConfig(): PaytrConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = paytrEnvSchema.safeParse({
    PAYTR_MERCHANT_ID: emptyToUndefined(process.env.PAYTR_MERCHANT_ID),
    PAYTR_MERCHANT_KEY: emptyToUndefined(process.env.PAYTR_MERCHANT_KEY),
    PAYTR_MERCHANT_SALT: emptyToUndefined(process.env.PAYTR_MERCHANT_SALT),
    PAYTR_TEST_MODE: emptyToUndefined(process.env.PAYTR_TEST_MODE),
    PAYTR_BASE_URL: emptyToUndefined(process.env.PAYTR_BASE_URL),
  });

  if (!parsed.success) {
    throw new Error(`PayTR env config geçersiz: ${parsed.error.message}`);
  }

  cachedConfig = {
    merchantId: parsed.data.PAYTR_MERCHANT_ID,
    merchantKey: parsed.data.PAYTR_MERCHANT_KEY,
    merchantSalt: parsed.data.PAYTR_MERCHANT_SALT,
    testMode: parsed.data.PAYTR_TEST_MODE === '1' ? 1 : 0,
    baseUrl: parsed.data.PAYTR_BASE_URL,
  };
  return cachedConfig;
}

/**
 * 3 kimlik bilgisi de env'de var mı? `false` ise PayTR operasyonları çalışmaz
 * (token alma / recurring charge) — testler mock ile yapılmalı.
 */
export function isPaytrConfigured(): boolean {
  const cfg = getPaytrConfig();
  return !!(cfg.merchantId && cfg.merchantKey && cfg.merchantSalt);
}

/**
 * Canlı ortamda mıyız (test_mode=0)?
 * Callback hash doğrulama + log redaction için kritik.
 */
export function isPaytrProduction(): boolean {
  return getPaytrConfig().testMode === 0;
}

/**
 * Test'lerde cache reset için.
 */
export function _resetPaytrConfigCache(): void {
  cachedConfig = null;
}
