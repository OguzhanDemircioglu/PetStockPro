/**
 * Nilvera Environment Configuration
 *
 * Nilvera e-Arşiv API entegrasyonu için env config.
 * PetStockPro'nun kendi mali mühür sertifikası + Nilvera kurumsal hesabı kullanılır
 * (PayTR ödeme callback'i / billing orchestrator tarafından tetiklenir).
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
  // Satıcı (PetStockPro) vergi no: tüzel kişi VKN 10 hane VEYA şahıs şirketi TCKN 11 hane.
  NILVERA_SELLER_VKN: z.string().regex(/^\d{10,11}$/, 'VKN 10 hane veya TC 11 hane (sadece rakam)').optional(),
  NILVERA_SELLER_TITLE: z.string().optional(), // "PetStockPro Yazılım A.Ş." vs.

  // e-Arşiv fatura serisi (InvoiceSerieOrNumber). Nilvera Portal'da firmaya tanımlı
  // 3 karakterli seri (ör. "PSP"). Nilvera sıra numarasını otomatik üretir.
  // Test hesabında "ABC" gibi hazır seriler tanımlıdır; production'da kendi serimiz.
  NILVERA_SERIE: z.string().min(1).optional(),

  // e-Fatura serisi — Nilvera portalında e-Arşiv'den AYRI tanımlanır (2026-07-02 keşfi:
  // aynı hesapta iki farklı seri adı var). NILVERA_SERIE ile fallback YAPILMAZ — yanlış
  // seri Nilvera'dan aynı "Seri Firmaya Tanımlı Değil" hatasını üretir, bilinçli boş
  // bırakılıp createEInvoice net bir hata fırlatır (e-Fatura mükellefi resolveAndIssueInvoice
  // yönlendirmesinde daha az sık, ama satır çıkarsa fatura pending'te takılıp kalmasın diye
  // erken açık hata tercih edildi).
  NILVERA_SERIE_EFATURA: z.string().min(1).optional(),
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
    NILVERA_SERIE: emptyToUndefined(process.env.NILVERA_SERIE),
    NILVERA_SERIE_EFATURA: emptyToUndefined(process.env.NILVERA_SERIE_EFATURA),
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
