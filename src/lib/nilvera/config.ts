/**
 * Nilvera Environment Configuration
 *
 * Nilvera e-Arşiv API entegrasyonu için env config.
 * PetStockPro'nun kendi mali mühür sertifikası + Nilvera kurumsal hesabı kullanılır
 * (Sprint 14 MVP — Sprint 13 iyzico subscription webhook'undan tetiklenir).
 *
 * Sandbox + production switch için NILVERA_BASE_URL env değişkeniyle yapılır.
 * Anahtarlar kullanıcı tarafından canlıya çıkmadan önce verilir.
 */

import { z } from 'zod';

const nilveraEnvSchema = z.object({
  NILVERA_API_KEY: z.string().optional(),
  NILVERA_BASE_URL: z.string().url().default('https://api.nilvera.com'),
  NILVERA_WEBHOOK_SECRET: z.string().optional(),

  // PetStockPro tax info (e-Arşiv faturalarında "satıcı" tarafı)
  // Lansman öncesi şirket kuruluş tamamlanınca env'e eklenir
  NILVERA_SELLER_VKN: z.string().length(10).optional(),
  NILVERA_SELLER_TITLE: z.string().optional(), // "PetStockPro Yazılım A.Ş." vs.
});

export type NilveraConfig = z.infer<typeof nilveraEnvSchema>;

let cachedConfig: NilveraConfig | null = null;

/**
 * Boş env değişkeni undefined'a normalize (vi.stubEnv '' ile setler — Zod boş string'i reject eder)
 */
function emptyToUndefined(v: string | undefined): string | undefined {
  return v === '' ? undefined : v;
}

export function getNilveraConfig(): NilveraConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = nilveraEnvSchema.safeParse({
    NILVERA_API_KEY: emptyToUndefined(process.env.NILVERA_API_KEY),
    NILVERA_BASE_URL: emptyToUndefined(process.env.NILVERA_BASE_URL),
    NILVERA_WEBHOOK_SECRET: emptyToUndefined(process.env.NILVERA_WEBHOOK_SECRET),
    NILVERA_SELLER_VKN: emptyToUndefined(process.env.NILVERA_SELLER_VKN),
    NILVERA_SELLER_TITLE: emptyToUndefined(process.env.NILVERA_SELLER_TITLE),
  });

  if (!parsed.success) {
    throw new Error(`Nilvera env config geçersiz: ${parsed.error.message}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

/**
 * Nilvera API key + seller VKN env'de var mı?
 * Production fatura kesimi için her ikisi de zorunlu.
 */
export function isNilveraConfigured(): boolean {
  const cfg = getNilveraConfig();
  return !!(cfg.NILVERA_API_KEY && cfg.NILVERA_SELLER_VKN);
}

/**
 * Test'lerde cache reset
 */
export function _resetNilveraConfigCache(): void {
  cachedConfig = null;
}
