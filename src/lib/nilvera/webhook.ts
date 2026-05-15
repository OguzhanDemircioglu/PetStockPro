/**
 * Nilvera Webhook — pure functions (signature + parse + event ID)
 *
 * iyzico webhook ile aynı pattern (timing-safe HMAC-SHA256 + Zod parse + idempotency key).
 * DB write Sprint 14 billing orchestrator'da bağlanır.
 *
 * Webhook header: `x-nilvera-signature`
 * Algoritma: HMAC-SHA256(NILVERA_WEBHOOK_SECRET, rawBody) → base64
 */

import crypto from 'node:crypto';
import { getNilveraConfig } from './config';
import { nilveraWebhookPayloadSchema, type NilveraWebhookPayload } from './types';

/**
 * Nilvera webhook signature doğrulama (HMAC-SHA256 base64 + timing-safe).
 */
export function verifyNilveraSignature(
  rawBody: string,
  providedSignature: string | null | undefined,
  webhookSecret?: string,
): boolean {
  const secret = webhookSecret ?? getNilveraConfig().NILVERA_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      'NILVERA_WEBHOOK_SECRET yapılandırılmadı — webhook endpoint güvensiz. ' +
      'Production öncesi Nilvera Developer Panel → Webhook Secret env\'e ekle.',
    );
  }

  if (!providedSignature || providedSignature.length === 0) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(providedSignature, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Raw webhook body'sini Nilvera webhook payload'una parse + validate.
 *
 * @throws SyntaxError if body geçerli JSON değil
 * @throws ZodError if payload schema'ya uymuyor
 */
export function parseNilveraWebhookPayload(rawBody: string): NilveraWebhookPayload {
  const parsed = JSON.parse(rawBody);
  return nilveraWebhookPayloadSchema.parse(parsed);
}

/**
 * processed_webhooks tablosu için idempotency key.
 *
 * Convention: nilvera_<invoiceId>_<eventType>_<eventTime>
 * — invoiceId Nilvera'nın UUID'si (unique)
 * — eventType ile renewal vs cancel race koşulu yok
 * — eventTime ms duplicate'ları ayırır
 */
export function deriveNilveraWebhookEventId(payload: NilveraWebhookPayload): string {
  return `nilvera_${payload.invoiceId}_${payload.eventType}_${payload.eventTime}`;
}
