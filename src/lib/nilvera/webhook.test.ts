import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  verifyNilveraSignature,
  parseNilveraWebhookPayload,
  deriveNilveraWebhookEventId,
} from './webhook';
import { _resetNilveraConfigCache } from './config';
import type { NilveraWebhookPayload } from './types';

function makeSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

const TEST_SECRET = 'nv-test-webhook-secret-32chars!!!';
const SAMPLE_BODY = JSON.stringify({
  eventType: 'invoice.accepted',
  eventTime: 1715789432000,
  invoiceId: 'nv_abc123',
  externalRef: 'sub_xyz_period_2026-05',
  status: 'ACCEPTED',
  invoiceNumber: 'PSP2026000147',
  pdfUrl: 'https://nilvera.com/invoices/nv_abc123.pdf',
});

describe('verifyNilveraSignature', () => {
  beforeEach(() => {
    vi.stubEnv('NILVERA_WEBHOOK_SECRET', TEST_SECRET);
    _resetNilveraConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetNilveraConfigCache();
  });

  it('doğru signature → true', () => {
    const sig = makeSignature(SAMPLE_BODY, TEST_SECRET);
    expect(verifyNilveraSignature(SAMPLE_BODY, sig)).toBe(true);
  });

  it('yanlış signature → false', () => {
    expect(verifyNilveraSignature(SAMPLE_BODY, 'forged-base64-sig')).toBe(false);
  });

  it('null signature → false', () => {
    expect(verifyNilveraSignature(SAMPLE_BODY, null)).toBe(false);
  });

  it('body tamper → false', () => {
    const sig = makeSignature(SAMPLE_BODY, TEST_SECRET);
    const tampered = SAMPLE_BODY.replace('ACCEPTED', 'REJECTED');
    expect(verifyNilveraSignature(tampered, sig)).toBe(false);
  });

  it('farklı secret → false', () => {
    const sig = makeSignature(SAMPLE_BODY, 'evil-secret');
    expect(verifyNilveraSignature(SAMPLE_BODY, sig)).toBe(false);
  });

  it('webhook secret env yok → throw (fail-fast)', () => {
    vi.stubEnv('NILVERA_WEBHOOK_SECRET', '');
    _resetNilveraConfigCache();
    expect(() => verifyNilveraSignature(SAMPLE_BODY, 'any')).toThrow(
      /NILVERA_WEBHOOK_SECRET/,
    );
  });

  it('override secret param ile env\'i geçersiz kılar', () => {
    const customSecret = 'custom';
    const sig = makeSignature(SAMPLE_BODY, customSecret);
    expect(verifyNilveraSignature(SAMPLE_BODY, sig, customSecret)).toBe(true);
  });

  it('length mismatch → false (timing-safe)', () => {
    expect(verifyNilveraSignature(SAMPLE_BODY, 'short')).toBe(false);
  });
});

describe('parseNilveraWebhookPayload', () => {
  it('geçerli JSON + schema → payload', () => {
    const result = parseNilveraWebhookPayload(SAMPLE_BODY);
    expect(result.eventType).toBe('invoice.accepted');
    expect(result.invoiceId).toBe('nv_abc123');
    expect(result.status).toBe('ACCEPTED');
  });

  it('geçersiz JSON → SyntaxError', () => {
    expect(() => parseNilveraWebhookPayload('{not json')).toThrow(SyntaxError);
  });

  it('bilinmeyen eventType → ZodError', () => {
    const body = JSON.stringify({
      eventType: 'invoice.quantum_teleported',
      eventTime: 1715789432000,
      invoiceId: 'nv_x',
      externalRef: 'sub_x',
      status: 'ACCEPTED',
    });
    expect(() => parseNilveraWebhookPayload(body)).toThrow();
  });

  it('eksik required (invoiceId yok) → ZodError', () => {
    const body = JSON.stringify({
      eventType: 'invoice.accepted',
      eventTime: 1715789432000,
      externalRef: 'sub_x',
      status: 'ACCEPTED',
    });
    expect(() => parseNilveraWebhookPayload(body)).toThrow();
  });

  it('rejected event with reason → parsed', () => {
    const body = JSON.stringify({
      eventType: 'invoice.rejected',
      eventTime: 1715789432000,
      invoiceId: 'nv_x',
      externalRef: 'sub_x',
      status: 'REJECTED',
      rejectionReason: 'Geçersiz VKN',
    });
    const result = parseNilveraWebhookPayload(body);
    expect(result.rejectionReason).toBe('Geçersiz VKN');
  });
});

describe('deriveNilveraWebhookEventId', () => {
  it('format: nilvera_<invoiceId>_<eventType>_<eventTime>', () => {
    const payload: NilveraWebhookPayload = {
      eventType: 'invoice.accepted',
      eventTime: 1715789432000,
      invoiceId: 'nv_abc123',
      externalRef: 'sub_xyz',
      status: 'ACCEPTED',
    };
    expect(deriveNilveraWebhookEventId(payload)).toBe(
      'nilvera_nv_abc123_invoice.accepted_1715789432000',
    );
  });

  it('aynı event → aynı eventId (idempotency)', () => {
    const p: NilveraWebhookPayload = {
      eventType: 'invoice.accepted',
      eventTime: 1715789432000,
      invoiceId: 'nv_x',
      externalRef: 'sub_x',
      status: 'ACCEPTED',
    };
    expect(deriveNilveraWebhookEventId(p)).toBe(deriveNilveraWebhookEventId({ ...p }));
  });

  it('farklı eventType (accepted vs rejected) → ayrı eventId', () => {
    const accepted: NilveraWebhookPayload = {
      eventType: 'invoice.accepted',
      eventTime: 1715789432000,
      invoiceId: 'nv_x',
      externalRef: 'sub_x',
      status: 'ACCEPTED',
    };
    const rejected: NilveraWebhookPayload = {
      ...accepted,
      eventType: 'invoice.rejected',
      status: 'REJECTED',
    };
    expect(deriveNilveraWebhookEventId(accepted)).not.toBe(deriveNilveraWebhookEventId(rejected));
  });
});
