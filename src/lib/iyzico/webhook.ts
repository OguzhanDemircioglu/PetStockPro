/**
 * iyzico Webhook — pure functions (signature + parse + event ID)
 *
 * Bu modül DB'ye yazmaz. Caller (Sprint 14 billing orchestrator) sırasıyla:
 *   1. verifyIyzicoSignature(body, sig) → reject if invalid
 *   2. parseIyzicoWebhookPayload(body) → typed payload
 *   3. deriveWebhookEventId(payload) → idempotency key
 *   4. db.insert(processedWebhooks).onConflictDoNothing() → idempotent persist
 *   5. business logic dispatch (subscription update + invoice create + audit + notify)
 *
 * Bu separation pure functions'ı test etmeyi kolaylaştırır + DB Sprint 14'te
 * transaction içinde tek noktadan yönetilir.
 *
 * Webhook docs: https://dev.iyzipay.com/en/products/subscription/webhooks
 */

import crypto from 'node:crypto';
import { getIyzicoConfig } from './config';
import { iyzicoWebhookPayloadSchema, type IyzicoWebhookPayload } from './types';

/**
 * HMAC-SHA256 base64 signature doğrulama.
 *
 * iyzico:
 *   Header: `X-IYZ-SIGNATURE` (case-insensitive: x-iyz-signature)
 *   Algoritma: HMAC-SHA256(webhookSecret, rawBody) → base64
 *
 * Timing-safe comparison kullanır (side-channel attack koruma).
 *
 * @param rawBody — request body string (parse edilmemiş! whitespace dahil)
 * @param providedSignature — header'dan gelen signature (null veya boş ise false)
 * @param webhookSecret — opsiyonel override (test için); yoksa env'den okunur
 */
export function verifyIyzicoSignature(
  rawBody: string,
  providedSignature: string | null | undefined,
  webhookSecret?: string,
): boolean {
  const secret = webhookSecret ?? getIyzicoConfig().IYZICO_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      'IYZICO_WEBHOOK_SECRET yapılandırılmadı — webhook endpoint güvensiz. ' +
      'Production öncesi iyzico Merchant Panel → Webhook → Secret değerini env\'e ekle.',
    );
  }

  if (!providedSignature || providedSignature.length === 0) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  // Timing-safe comparison — string length farklıysa Buffer.from throw etmez
  // ama timingSafeEqual length farklılığında hata verir, try/catch ile false döneriz.
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(providedSignature, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Raw webhook body'sini typed payload'a parse eder + Zod ile validate.
 *
 * @throws SyntaxError if body geçerli JSON değil
 * @throws ZodError if payload schema'ya uymuyor (eksik field, yanlış tip, vs.)
 */
export function parseIyzicoWebhookPayload(rawBody: string): IyzicoWebhookPayload {
  const parsed = JSON.parse(rawBody); // SyntaxError caller'a bubble up
  return iyzicoWebhookPayloadSchema.parse(parsed);
}

/**
 * processed_webhooks tablosu için idempotency key üret.
 *
 * iyzico standart eventId field göndermiyor, bizim convention:
 *   iyzico_{subscriptionRef}_{eventType}_{eventTime}
 *
 * Bu key:
 * - Aynı event tekrar gelirse (network retry, manual replay) aynı key → skip
 * - Aynı subscription + farklı event (renewal vs cancel) → ayrı key (race condition yok)
 * - eventTime millisaniye → çok hızlı duplicate'lar bile tek key
 *
 * processed_webhooks.event_id varchar(200) — kapasitesi bol.
 */
export function deriveWebhookEventId(payload: IyzicoWebhookPayload): string {
  return `iyzico_${payload.subscriptionReferenceCode}_${payload.eventType}_${payload.eventTime}`;
}
