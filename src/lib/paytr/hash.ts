/**
 * PayTR Hash — pure functions (token hash + callback doğrulama)
 *
 * PayTR resmi SDK yok. İki kritik hash noktası var, ikisi de HMAC-SHA256 + base64
 * ama FARKLI girdi sırası kullanır (PayTR dokümanı birebir):
 *
 *   1. get-token isteği (Adım 1):
 *      paytr_token = base64( HMAC_SHA256(
 *        merchant_id + user_ip + merchant_oid + email + payment_amount +
 *        user_basket + no_installment + max_installment + currency + test_mode
 *        + merchant_salt,                 ← mesaja salt EKLENİR
 *        key = merchant_key
 *      ))
 *
 *   2. Callback (Adım 2) doğrulama:
 *      hash = base64( HMAC_SHA256(
 *        merchant_oid + merchant_salt + status + total_amount,
 *        key = merchant_key
 *      ))
 *      Eşleşmezse istek PayTR'dan gelmemiştir → reddet (asla "OK" dönme).
 *
 * Bu modül DB'ye yazmaz / env okumaz (caller config'i geçer) — saf + kolay test.
 * Workers uyumu: node:crypto (nodejs_compat). iyzico/webhook.ts ile aynı desen.
 *
 * Docs: https://dev.paytr.com/en/iframe-api/iframe-api-1-adim
 *       https://dev.paytr.com/en/iframe-api/iframe-api-2-adim
 */

import crypto from 'node:crypto';

/**
 * get-token isteği için paytr_token üretir.
 *
 * @param input — PayTR'a gönderilecek alanların TAM string hali. user_basket
 *   base64'lenmiş JSON, payment_amount kuruş (×100) string olmalı — hash, ağ
 *   üzerinden giden değerlerle birebir aynı string'i kullanmalı.
 * @param merchantKey — HMAC anahtarı (Mağaza Parola)
 * @param merchantSalt — mesaja eklenen tuz (Mağaza Gizli Anahtarı)
 */
export interface PaytrTokenHashInput {
  merchantId: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: string; // kuruş, ör. '12000' = 120,00 ₺
  userBasket: string; // base64(JSON.stringify(basket))
  noInstallment: string; // '0' | '1'
  maxInstallment: string; // '0' = sınır yok
  currency: string; // 'TL'
  testMode: string; // '0' | '1'
}

export function buildPaytrTokenHash(
  input: PaytrTokenHashInput,
  merchantKey: string,
  merchantSalt: string,
): string {
  if (!merchantKey || !merchantSalt) {
    throw new Error(
      'PayTR token hash üretilemiyor — merchant_key + merchant_salt gerekli (PAYTR_MERCHANT_KEY / PAYTR_MERCHANT_SALT).',
    );
  }

  const hashStr =
    input.merchantId +
    input.userIp +
    input.merchantOid +
    input.email +
    input.paymentAmount +
    input.userBasket +
    input.noInstallment +
    input.maxInstallment +
    input.currency +
    input.testMode;

  // PayTR: hash_hmac('sha256', hash_str + merchant_salt, merchant_key) → base64
  return crypto
    .createHmac('sha256', merchantKey)
    .update(hashStr + merchantSalt, 'utf8')
    .digest('base64');
}

/**
 * Recurring (kayıtlı kart / Non3D) charge için paytr_token üretir.
 *
 * DİKKAT: get-token'dan FARKLI alan sırası (PayTR dokümanı):
 *   hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount +
 *              payment_type + installment_count + currency + test_mode + non_3d
 *   token = base64( HMAC_SHA256(hash_str + merchant_salt, merchant_key) )
 *
 * Docs: https://dev.paytr.com/en/direkt-api/kart-saklama-api/kayitli-kart-tekrarlayan-odeme
 */
export interface PaytrRecurringHashInput {
  merchantId: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: string; // kuruş
  paymentType: string; // 'card'
  installmentCount: string; // '0'
  currency: string; // 'TL'
  testMode: string; // '0' | '1'
  non3d: string; // '1'
}

export function buildPaytrRecurringHash(
  input: PaytrRecurringHashInput,
  merchantKey: string,
  merchantSalt: string,
): string {
  if (!merchantKey || !merchantSalt) {
    throw new Error(
      'PayTR recurring hash üretilemiyor — merchant_key + merchant_salt gerekli (PAYTR_MERCHANT_KEY / PAYTR_MERCHANT_SALT).',
    );
  }

  const hashStr =
    input.merchantId +
    input.userIp +
    input.merchantOid +
    input.email +
    input.paymentAmount +
    input.paymentType +
    input.installmentCount +
    input.currency +
    input.testMode +
    input.non3d;

  return crypto
    .createHmac('sha256', merchantKey)
    .update(hashStr + merchantSalt, 'utf8')
    .digest('base64');
}

/**
 * Callback'in PayTR'dan geldiğini doğrular (timing-safe).
 *
 * @param params — PayTR callback POST gövdesinden gelen alanlar
 * @returns true ise hash geçerli → işle + "OK" dön; false ise SAHTE → reddet
 */
export interface PaytrCallbackHashInput {
  merchantOid: string;
  status: string; // 'success' | 'failed'
  totalAmount: string; // PayTR'ın gönderdiği total_amount (kuruş string)
  receivedHash: string; // callback'teki `hash` alanı
}

export function verifyPaytrCallbackHash(
  params: PaytrCallbackHashInput,
  merchantKey: string,
  merchantSalt: string,
): boolean {
  if (!merchantKey || !merchantSalt) {
    throw new Error(
      'PayTR callback doğrulanamıyor — merchant_key + merchant_salt gerekli (PAYTR_MERCHANT_KEY / PAYTR_MERCHANT_SALT).',
    );
  }

  if (!params.receivedHash || params.receivedHash.length === 0) {
    return false;
  }

  const hashStr =
    params.merchantOid + merchantSalt + params.status + params.totalAmount;

  const expected = crypto
    .createHmac('sha256', merchantKey)
    .update(hashStr, 'utf8')
    .digest('base64');

  // Timing-safe compare — uzunluk farklıysa timingSafeEqual throw eder, önce kontrol.
  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(params.receivedHash, 'utf8');
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
