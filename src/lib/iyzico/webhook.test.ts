import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  verifyIyzicoSignature,
  parseIyzicoWebhookPayload,
  deriveWebhookEventId,
} from './webhook';
import { _resetIyzicoConfigCache } from './config';
import type { IyzicoWebhookPayload } from './types';

/**
 * Test helper: gerçek HMAC-SHA256 base64 signature üretir (verify'ı doğrulamak için).
 */
function makeSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

const TEST_SECRET = 'test-webhook-secret-key-32chars!!';
const SAMPLE_BODY = JSON.stringify({
  eventType: 'SUBSCRIPTION_RENEWAL_SUCCESS',
  eventTime: 1715789432000,
  subscriptionReferenceCode: 'sub_xyz_123',
  customerReferenceCode: 'cust_abc',
  pricingPlanReferenceCode: 'plan_pro_monthly',
  paymentId: 'pay_456',
});

describe('verifyIyzicoSignature', () => {
  beforeEach(() => {
    vi.stubEnv('IYZICO_WEBHOOK_SECRET', TEST_SECRET);
    _resetIyzicoConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetIyzicoConfigCache();
  });

  it('doğru signature → true', () => {
    const sig = makeSignature(SAMPLE_BODY, TEST_SECRET);
    expect(verifyIyzicoSignature(SAMPLE_BODY, sig)).toBe(true);
  });

  it('yanlış signature → false (forge attempt)', () => {
    expect(verifyIyzicoSignature(SAMPLE_BODY, 'forged-signature-base64')).toBe(false);
  });

  it('signature null → false (header eksik)', () => {
    expect(verifyIyzicoSignature(SAMPLE_BODY, null)).toBe(false);
  });

  it('signature undefined → false', () => {
    expect(verifyIyzicoSignature(SAMPLE_BODY, undefined)).toBe(false);
  });

  it('signature boş string → false', () => {
    expect(verifyIyzicoSignature(SAMPLE_BODY, '')).toBe(false);
  });

  it('body değiştirildiyse → false (tamper detection)', () => {
    const sig = makeSignature(SAMPLE_BODY, TEST_SECRET);
    const tamperedBody = SAMPLE_BODY.replace('SUCCESS', 'FAILURE');
    expect(verifyIyzicoSignature(tamperedBody, sig)).toBe(false);
  });

  it('whitespace farkı → false (raw body önemli, parse-stringify değil)', () => {
    const sig = makeSignature(SAMPLE_BODY, TEST_SECRET);
    const reformattedBody = JSON.stringify(JSON.parse(SAMPLE_BODY), null, 2);
    expect(verifyIyzicoSignature(reformattedBody, sig)).toBe(false);
  });

  it('farklı secret ile imzalanmış → false', () => {
    const sig = makeSignature(SAMPLE_BODY, 'different-secret');
    expect(verifyIyzicoSignature(SAMPLE_BODY, sig)).toBe(false);
  });

  it('webhookSecret param override env', () => {
    const customSecret = 'custom-test-secret';
    const sig = makeSignature(SAMPLE_BODY, customSecret);
    expect(verifyIyzicoSignature(SAMPLE_BODY, sig, customSecret)).toBe(true);
    // env'deki secret ile aynı body false vermeli (override edildi)
    const envSig = makeSignature(SAMPLE_BODY, TEST_SECRET);
    expect(verifyIyzicoSignature(SAMPLE_BODY, envSig, customSecret)).toBe(false);
  });

  it('IYZICO_WEBHOOK_SECRET env yok ve param da yok → throw (fail-fast)', () => {
    vi.stubEnv('IYZICO_WEBHOOK_SECRET', '');
    _resetIyzicoConfigCache();
    expect(() => verifyIyzicoSignature(SAMPLE_BODY, 'any-sig')).toThrow(
      /IYZICO_WEBHOOK_SECRET/,
    );
  });

  it('timing-safe: kısa signature → false, throw yok', () => {
    // Buffer length mismatch — timingSafeEqual throw eder, biz catch edip false döneriz
    expect(verifyIyzicoSignature(SAMPLE_BODY, 'short')).toBe(false);
  });

  it('timing-safe: uzun signature → false', () => {
    const sig = makeSignature(SAMPLE_BODY, TEST_SECRET);
    const longSig = sig + 'extra-bytes';
    expect(verifyIyzicoSignature(SAMPLE_BODY, longSig)).toBe(false);
  });
});

describe('parseIyzicoWebhookPayload', () => {
  it('geçerli JSON + schema → IyzicoWebhookPayload', () => {
    const result = parseIyzicoWebhookPayload(SAMPLE_BODY);
    expect(result.eventType).toBe('SUBSCRIPTION_RENEWAL_SUCCESS');
    expect(result.subscriptionReferenceCode).toBe('sub_xyz_123');
    expect(result.eventTime).toBe(1715789432000);
  });

  it('passthrough: bilinmeyen field korunur (passthrough mode)', () => {
    const body = JSON.stringify({
      eventType: 'SUBSCRIPTION_CANCELED',
      eventTime: 1715789432000,
      subscriptionReferenceCode: 'sub_x',
      newIyzicoFieldFutureCompat: 'preserve-me',
    });
    const result = parseIyzicoWebhookPayload(body);
    expect((result as Record<string, unknown>).newIyzicoFieldFutureCompat).toBe('preserve-me');
  });

  it('geçersiz JSON → SyntaxError', () => {
    expect(() => parseIyzicoWebhookPayload('{not json')).toThrow(SyntaxError);
  });

  it('eksik required field (eventType yok) → ZodError', () => {
    const body = JSON.stringify({
      eventTime: 1715789432000,
      subscriptionReferenceCode: 'sub_x',
    });
    expect(() => parseIyzicoWebhookPayload(body)).toThrow();
  });

  it('bilinmeyen eventType → ZodError (whitelist enforce)', () => {
    const body = JSON.stringify({
      eventType: 'SUBSCRIPTION_QUANTUM_TELEPORTED', // 🚀 değil
      eventTime: 1715789432000,
      subscriptionReferenceCode: 'sub_x',
    });
    expect(() => parseIyzicoWebhookPayload(body)).toThrow();
  });

  it('eventTime number değil string → ZodError', () => {
    const body = JSON.stringify({
      eventType: 'SUBSCRIPTION_RENEWAL_SUCCESS',
      eventTime: '1715789432000',
      subscriptionReferenceCode: 'sub_x',
    });
    expect(() => parseIyzicoWebhookPayload(body)).toThrow();
  });
});

describe('deriveWebhookEventId', () => {
  it('iyzico_<subRef>_<eventType>_<eventTime> formatı', () => {
    const payload: IyzicoWebhookPayload = {
      eventType: 'SUBSCRIPTION_RENEWAL_SUCCESS',
      eventTime: 1715789432000,
      subscriptionReferenceCode: 'sub_xyz_123',
    };
    expect(deriveWebhookEventId(payload)).toBe(
      'iyzico_sub_xyz_123_SUBSCRIPTION_RENEWAL_SUCCESS_1715789432000',
    );
  });

  it('aynı event → aynı eventId (idempotency key)', () => {
    const p1: IyzicoWebhookPayload = {
      eventType: 'SUBSCRIPTION_CANCELED',
      eventTime: 1715789432000,
      subscriptionReferenceCode: 'sub_x',
    };
    const p2 = { ...p1 };
    expect(deriveWebhookEventId(p1)).toBe(deriveWebhookEventId(p2));
  });

  it('farklı eventType → farklı eventId (same sub renewal+cancel race yok)', () => {
    const renewal: IyzicoWebhookPayload = {
      eventType: 'SUBSCRIPTION_RENEWAL_SUCCESS',
      eventTime: 1715789432000,
      subscriptionReferenceCode: 'sub_x',
    };
    const cancel: IyzicoWebhookPayload = {
      ...renewal,
      eventType: 'SUBSCRIPTION_CANCELED',
    };
    expect(deriveWebhookEventId(renewal)).not.toBe(deriveWebhookEventId(cancel));
  });

  it("farklı eventTime → farklı eventId (replay'lerde tek instance)", () => {
    const p1: IyzicoWebhookPayload = {
      eventType: 'SUBSCRIPTION_RENEWAL_SUCCESS',
      eventTime: 1715789432000,
      subscriptionReferenceCode: 'sub_x',
    };
    const p2: IyzicoWebhookPayload = { ...p1, eventTime: 1715789432001 };
    expect(deriveWebhookEventId(p1)).not.toBe(deriveWebhookEventId(p2));
  });
});
