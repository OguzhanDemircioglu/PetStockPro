/**
 * PayTR HTTP Client — iframe get-token (Adım 1)
 *
 * İlk ödeme akışı: createPaytrIframeToken → token → iframe URL'i kullanıcıya göster.
 * Ödeme sonucu PayTR'dan callback ile gelir (Faz 2: /api/webhooks/paytr).
 *
 * Recurring (tekrarlayan) charge ayrı modülde (Faz 3 — kart saklama API'si).
 *
 * Workers uyumu: global fetch. Test'lerde vi.spyOn(globalThis,'fetch') ile mock.
 *
 * Docs: https://dev.paytr.com/en/iframe-api/iframe-api-1-adim
 */

import { getPaytrConfig } from './config';
import { buildPaytrTokenHash, buildPaytrRecurringHash, buildPaytrSavedCardsHash } from './hash';
import {
  paytrGetTokenResponseSchema,
  paytrChargeResponseSchema,
  paytrSavedCardSchema,
  type PaytrBasketItem,
  type PaytrChargeResponse,
  type PaytrSavedCard,
} from './types';

/**
 * PayTR get-token başarısız döndüğünde veya ağ/parse hatası.
 */
export class PaytrApiError extends Error {
  readonly reason?: string;
  readonly httpStatus?: number;

  constructor(message: string, opts?: { reason?: string; httpStatus?: number }) {
    super(message);
    this.name = 'PaytrApiError';
    this.reason = opts?.reason;
    this.httpStatus = opts?.httpStatus;
  }
}

export interface CreateIframeTokenParams {
  /** Benzersiz sipariş no — sadece a-zA-Z0-9 (PayTR kısıtı). Idempotency + callback eşleşme anahtarı. */
  merchantOid: string;
  email: string;
  /** Tutar KURUŞ cinsinden (×100). Ör. 120,00 ₺ → 12000. */
  paymentAmount: number;
  userIp: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  basket: PaytrBasketItem[];
  /** Ödeme başarılı dönüş URL'i (merchant_ok_url). */
  okUrl: string;
  /** Ödeme başarısız dönüş URL'i (merchant_fail_url). */
  failUrl: string;
  currency?: string; // default 'TL'
  /** 1 = taksit YOK (abonelik için varsayılan), 0 = taksit serbest. */
  noInstallment?: 0 | 1;
  maxInstallment?: number; // default 0 (sınır yok)
  timeoutLimit?: number; // dakika, default 30
  lang?: 'tr' | 'en'; // default 'tr'
  debugOn?: 0 | 1; // default: test modunda 1, canlıda 0
  /** 1 = kartı sakla (recurring için). get-token hash'ine GİRMEZ, sadece POST alanı. */
  storeCard?: 0 | 1;
  /** Saklı kartların sahibini tanımlayan kullanıcı token'ı (recurring için). */
  utoken?: string;
}

/**
 * iframe ödeme token'ı alır. Başarılıysa token string'i döner.
 *
 * @throws PaytrApiError — yapılandırma eksik / get-token failed / ağ / parse hatası
 */
export async function createPaytrIframeToken(
  params: CreateIframeTokenParams,
): Promise<string> {
  const cfg = getPaytrConfig();
  const { merchantId, merchantKey, merchantSalt } = cfg;
  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new PaytrApiError(
      'PayTR yapılandırılmadı — PAYTR_MERCHANT_ID + PAYTR_MERCHANT_KEY + PAYTR_MERCHANT_SALT gerekli.',
    );
  }

  const userBasket = Buffer.from(JSON.stringify(params.basket)).toString('base64');
  const paymentAmount = String(params.paymentAmount);
  const noInstallment = String(params.noInstallment ?? 1);
  const maxInstallment = String(params.maxInstallment ?? 0);
  const currency = params.currency ?? 'TL';
  const testMode = String(cfg.testMode);
  const debugOn = String(params.debugOn ?? (cfg.testMode === 1 ? 1 : 0));

  const paytrToken = buildPaytrTokenHash(
    {
      merchantId,
      userIp: params.userIp,
      merchantOid: params.merchantOid,
      email: params.email,
      paymentAmount,
      userBasket,
      noInstallment,
      maxInstallment,
      currency,
      testMode,
    },
    merchantKey,
    merchantSalt,
  );

  const form = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: params.userIp,
    merchant_oid: params.merchantOid,
    email: params.email,
    payment_amount: paymentAmount,
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: debugOn,
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: params.userName,
    user_address: params.userAddress,
    user_phone: params.userPhone,
    merchant_ok_url: params.okUrl,
    merchant_fail_url: params.failUrl,
    timeout_limit: String(params.timeoutLimit ?? 30),
    currency,
    test_mode: testMode,
    lang: params.lang ?? 'tr',
  });

  // Kart saklama (recurring için) — bu alanlar get-token hash'ine GİRMEZ.
  if (params.storeCard) form.set('store_card', String(params.storeCard));
  if (params.utoken) form.set('utoken', params.utoken);

  const url = `${cfg.baseUrl}/odeme/api/get-token`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    throw new PaytrApiError(`PayTR get-token ağ hatası: ${detail}`);
  }

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PaytrApiError(
      `PayTR get-token JSON dışı yanıt (HTTP ${response.status}): ${text.slice(0, 200)}`,
      { httpStatus: response.status },
    );
  }

  const parsed = paytrGetTokenResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new PaytrApiError(`PayTR get-token beklenmedik yanıt biçimi (HTTP ${response.status})`, {
      httpStatus: response.status,
    });
  }

  if (parsed.data.status !== 'success' || !parsed.data.token) {
    throw new PaytrApiError(
      `PayTR get-token başarısız: ${parsed.data.reason ?? 'bilinmeyen sebep'}`,
      { reason: parsed.data.reason, httpStatus: response.status },
    );
  }

  return parsed.data.token;
}

/**
 * Token'dan iframe URL'i üretir (kullanıcıya gösterilen güvenli ödeme sayfası).
 */
export function paytrIframeUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? getPaytrConfig().baseUrl;
  return `${base}/odeme/guvenli/${token}`;
}

export interface ChargeSavedCardParams {
  /** Benzersiz sipariş no (alfanümerik) — bu çekim için. */
  merchantOid: string;
  email: string;
  /** Tutar KURUŞ cinsinden (×100). */
  paymentAmount: number;
  userIp: string;
  /** İlk ödemede saklanan kullanıcı token'ı. */
  utoken: string;
  /** Saklı kart token'ı (Kayıtlı Kart Listesi'nden / ilk callback'ten). */
  ctoken: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  okUrl: string;
  failUrl: string;
  currency?: string; // 'TL'
  paymentType?: string; // 'card'
  installmentCount?: number; // 0
}

/**
 * Saklı kartla recurring (Non3D) tahsilat — yenileme cron'u çağırır.
 *
 * ⚠ PayTR hesabında "Direkt API" mağaza tipi + "Non3D ile ödeme" yetkisi açık olmalı.
 *
 * @returns PayTR yanıtı — status: 'success' | 'failed' | 'wait_callback'.
 *   'failed' EXCEPTION DEĞİL (dunning sinyali); sadece ağ/parse/config hatasında throw.
 * @throws PaytrApiError — config eksik / ağ / JSON dışı yanıt
 */
export async function chargeSavedCard(
  params: ChargeSavedCardParams,
): Promise<PaytrChargeResponse> {
  const cfg = getPaytrConfig();
  const { merchantId, merchantKey, merchantSalt } = cfg;
  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new PaytrApiError(
      'PayTR yapılandırılmadı — PAYTR_MERCHANT_ID + PAYTR_MERCHANT_KEY + PAYTR_MERCHANT_SALT gerekli.',
    );
  }

  const paymentAmount = String(params.paymentAmount);
  const paymentType = params.paymentType ?? 'card';
  const installmentCount = String(params.installmentCount ?? 0);
  const currency = params.currency ?? 'TL';
  const testMode = String(cfg.testMode);
  const non3d = '1';

  const paytrToken = buildPaytrRecurringHash(
    {
      merchantId,
      userIp: params.userIp,
      merchantOid: params.merchantOid,
      email: params.email,
      paymentAmount,
      paymentType,
      installmentCount,
      currency,
      testMode,
      non3d,
    },
    merchantKey,
    merchantSalt,
  );

  const form = new URLSearchParams({
    merchant_id: merchantId,
    paytr_token: paytrToken,
    user_ip: params.userIp,
    merchant_oid: params.merchantOid,
    email: params.email,
    payment_amount: paymentAmount,
    payment_type: paymentType,
    installment_count: installmentCount,
    currency,
    test_mode: testMode,
    non_3d: non3d,
    recurring_payment: '1',
    utoken: params.utoken,
    ctoken: params.ctoken,
    user_name: params.userName,
    user_address: params.userAddress,
    user_phone: params.userPhone,
    merchant_ok_url: params.okUrl,
    merchant_fail_url: params.failUrl,
  });

  const url = `${cfg.baseUrl}/odeme`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    throw new PaytrApiError(`PayTR recurring charge ağ hatası: ${detail}`);
  }

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PaytrApiError(
      `PayTR recurring charge JSON dışı yanıt (HTTP ${response.status}): ${text.slice(0, 200)}`,
      { httpStatus: response.status },
    );
  }

  const parsed = paytrChargeResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new PaytrApiError(
      `PayTR recurring charge beklenmedik yanıt biçimi (HTTP ${response.status})`,
      { httpStatus: response.status },
    );
  }

  return parsed.data;
}

/**
 * Kullanıcının saklı kartlarını listeler (utoken → ctoken).
 * Recurring charge için ctoken buradan alınır (ilk ödeme callback'i ctoken vermediyse).
 *
 * @returns saklı kart listesi (boş olabilir)
 * @throws PaytrApiError — config eksik / ağ / parse / status!=success
 */
export async function listSavedCards(utoken: string): Promise<PaytrSavedCard[]> {
  const cfg = getPaytrConfig();
  const { merchantId, merchantKey, merchantSalt } = cfg;
  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new PaytrApiError(
      'PayTR yapılandırılmadı — PAYTR_MERCHANT_ID + PAYTR_MERCHANT_KEY + PAYTR_MERCHANT_SALT gerekli.',
    );
  }

  const paytrToken = buildPaytrSavedCardsHash(utoken, merchantKey, merchantSalt);
  const form = new URLSearchParams({ merchant_id: merchantId, utoken, paytr_token: paytrToken });
  const url = `${cfg.baseUrl}/odeme/capi/list`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    throw new PaytrApiError(`PayTR saved-cards ağ hatası: ${detail}`);
  }

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PaytrApiError(
      `PayTR saved-cards JSON dışı yanıt (HTTP ${response.status}): ${text.slice(0, 150)}`,
      { httpStatus: response.status },
    );
  }

  // PayTR /odeme/capi/list yanıt biçimleri (resmi doc — kayitli-kart-listesi):
  //   • Başarı → kartların DÜZ DİZİSİ: [{ ctoken, last_4, ... }]  (üstte status YOK)
  //   • Boş    → {} veya []  ("eşleşme yoksa boş JSON")
  //   • Hata   → { status: 'error', err_msg }
  //   • (bazı sürümlerde { status:'success', cards:[...] } sarmalı da görülebilir)
  // Eski kod sadece { status, cards } OBJESİ bekliyordu → gerçek başarı DİZİSİNİ
  // reddedip "beklenmedik yanıt biçimi (HTTP 200)" throw ediyordu (prod bug 2026-07-03).

  // 1) Hata objesi → err_msg ile throw (utoken geçersiz, kart saklama kapalı, vb.)
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const status = (json as Record<string, unknown>).status;
    if (status === 'error' || status === 'failed') {
      const errMsg = (json as Record<string, unknown>).err_msg;
      throw new PaytrApiError(
        `PayTR saved-cards hatası: ${typeof errMsg === 'string' ? errMsg : String(status)}`,
        { httpStatus: response.status },
      );
    }
  }

  // 2) Ham kart listesini normalize et (düz dizi / {cards} sarmalı / tek kart objesi / boş)
  let rawCards: unknown[] = [];
  if (Array.isArray(json)) {
    rawCards = json;
  } else if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.cards)) rawCards = obj.cards;
    else if (typeof obj.ctoken === 'string') rawCards = [obj];
    // else: boş {} → kayıtlı kart yok → []
  }

  // 3) Her kartı gevşek doğrula; yalnızca ctoken'ı olanları döndür.
  const cards: PaytrSavedCard[] = [];
  for (const c of rawCards) {
    const r = paytrSavedCardSchema.safeParse(c);
    if (r.success) cards.push(r.data);
  }
  return cards;
}
