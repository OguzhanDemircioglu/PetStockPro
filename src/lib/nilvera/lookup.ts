/**
 * Nilvera Genel API — Mükellef (VKN) sorgu + satıcı firma bilgisi
 *
 *  - checkTaxpayer(vkn): GET /general/GlobalCompany/Check/TaxNumber/{vkn}?globalUserType=Invoice
 *      → müşteri e-Fatura mükellefi mi? Fatura tipi yönlendirme (e-Fatura / e-Arşiv) +
 *        resmi ünvan doğrulama. "Doğru VKN mi girilmiş" kontrolünün canlı tarafı.
 *  - getNilveraSellerCompany(): GET /general/Company → bizim (satıcı) Nilvera hesabımızın
 *      profili (canlı anahtar + serie + hesap kurulumu doğrulama; süperadmin diagnostic).
 *
 * Docs:
 *   https://developer.nilvera.com/api/genel-api/mukellef-islemleri/vkn-ile-sorgular
 *   https://developer.nilvera.com/api/genel-api/firma-islemleri/firma-bilgileri-getirir
 */

import { z } from 'zod';
import { nilveraRequest, NilveraApiError } from './client';
import { isValidVatNo } from '@/lib/validation/vatNo';

/**
 * Nihai tüketici (final consumer) e-Arşiv VKN konvansiyonu — GİB standardı.
 * Vergi no vermeyen bireysel müşteriye e-Arşiv keserken CustomerInfo.TaxNumber bu olur.
 */
export const NIHAI_TUKETICI_TAX_NUMBER = '11111111111';

/** Müşteriye kesilecek fatura tipi. */
export type TaxpayerKind = 'efatura' | 'earsiv' | 'invalid';

export interface TaxpayerCheckResult {
  /**
   * efatura = e-Fatura mükellefi (faturası etikete/alias'a gönderilir);
   * earsiv  = e-Fatura mükellefi değil → e-Arşiv;
   * invalid = geçersiz VKN/TCKN (checksum veya Nilvera 400).
   */
  kind: TaxpayerKind;
  /** GİB'de kayıtlı resmi ünvan (yalnız e-Fatura mükellefinde dolu). */
  title: string | null;
  /** e-Fatura etiketi (urn:mail:...) — e-Fatura gönderiminde CustomerAlias olarak kullanılır. */
  alias: string | null;
  /** Ham Nilvera yanıtı (debug/log). */
  raw?: unknown;
}

// GlobalCompany/Check 200 yanıtı: her eleman bir e-Fatura etiketi kaydı.
const globalCompanyRecordSchema = z
  .object({
    TaxNumber: z.string().nullish(),
    Title: z.string().nullish(), // firma resmi ünvanı
    Name: z.string().nullish(), // e-Fatura etiketi (urn:mail:...)
    Type: z.string().nullish(), // PK / GB
    DocumentType: z.string().nullish(),
  })
  .passthrough();

// Nilvera dizi döndürür; defansif olarak tek obje / null da toparlanır.
const globalCompanyCheckSchema = z.preprocess(
  (v) => (Array.isArray(v) ? v : v == null ? [] : [v]),
  z.array(globalCompanyRecordSchema),
);

type GlobalCompanyRecord = z.infer<typeof globalCompanyRecordSchema>;

/**
 * VKN/TCKN sorgula → fatura tipi + ünvan + e-Fatura etiketi.
 *
 * Mantık (kullanıcı kararı 2026-06-19):
 *   - Yerel checksum geçersiz → 'invalid' (Nilvera çağrısı yapılmaz)
 *   - 11 hane TCKN → bireysel/şahıs, e-Fatura mükellefi olamaz → 'earsiv' (çağrı yok)
 *   - 10 hane VKN → Nilvera GlobalCompany/Check:
 *       dizi dolu     → 'efatura' (alias = Name, title = Title)
 *       dizi boş / 404 → 'earsiv'  (kayıtlı e-Fatura mükellefi değil)
 *       400           → 'invalid'
 *
 * @throws NilveraNetworkError / 5xx — ağ/sunucu hatası. Caller best-effort ele almalı
 *   (settings doğrulama: kullanıcıya "şu an doğrulanamadı" göster; fatura: pending bırak).
 */
export async function checkTaxpayer(taxNumber: string): Promise<TaxpayerCheckResult> {
  const clean = (taxNumber ?? '').replace(/\D/g, '');

  if (!isValidVatNo(clean)) {
    return { kind: 'invalid', title: null, alias: null };
  }

  // TCKN (11 hane) → bireysel/şahıs; e-Fatura mükellefi olamaz → doğrudan e-Arşiv.
  if (clean.length === 11) {
    return { kind: 'earsiv', title: null, alias: null };
  }

  try {
    const raw = await nilveraRequest<unknown>({
      method: 'GET',
      path: `/general/GlobalCompany/Check/TaxNumber/${encodeURIComponent(clean)}?globalUserType=Invoice`,
    });
    const list = globalCompanyCheckSchema.parse(raw);
    if (list.length === 0) {
      return { kind: 'earsiv', title: null, alias: null, raw };
    }
    const pick = pickAlias(list);
    return { kind: 'efatura', title: pick.Title ?? null, alias: pick.Name ?? null, raw };
  } catch (err) {
    if (err instanceof NilveraApiError) {
      if (err.status === 404) return { kind: 'earsiv', title: null, alias: null }; // mükellef değil
      if (err.status === 400) return { kind: 'invalid', title: null, alias: null };
    }
    throw err; // network / 5xx → caller handle
  }
}

/**
 * Birden çok e-Fatura etiketi dönerse hangisine gönderileceği seçilir.
 * PK (posta kutusu) tipi tercih edilir; yoksa Name'i dolu ilk kayıt; o da yoksa ilk eleman.
 */
function pickAlias(list: GlobalCompanyRecord[]): GlobalCompanyRecord {
  const pk = list.find((r) => (r.Type ?? '').toUpperCase() === 'PK' && r.Name);
  return pk ?? list.find((r) => r.Name) ?? list[0];
}

// ── Satıcı (bizim) firma profili — süperadmin diagnostic ───────────────

export const nilveraSellerCompanySchema = z
  .object({
    Name: z.string().nullish(),
    TaxNumber: z.string().nullish(),
    TaxOffice: z.string().nullish(),
    Address: z.string().nullish(),
    District: z.string().nullish(),
    City: z.string().nullish(),
    Country: z.string().nullish(),
    Email: z.string().nullish(),
    PhoneNumber: z.string().nullish(),
    IsActive: z.boolean().nullish(),
  })
  .passthrough();

export type NilveraSellerCompany = z.infer<typeof nilveraSellerCompanySchema>;

/**
 * Satıcı (PetStockPro) Nilvera hesabının firma profili (GET /general/Company).
 * Canlı anahtar + hesap kurulumunu doğrulamak için (süperadmin "Nilvera Bağlantı Testi").
 *
 * @throws NilveraApiError (401 → anahtar yanlış/eksik) / NilveraNetworkError
 */
export async function getNilveraSellerCompany(): Promise<NilveraSellerCompany> {
  const raw = await nilveraRequest<unknown>({ method: 'GET', path: '/general/Company' });
  return nilveraSellerCompanySchema.parse(raw);
}
