/**
 * /api/webhooks/iyzico route handler — E2E mock flow tests (Sprint 14 finale).
 *
 * Modülleri vi.mock ile değiştirip route'un her code path'ini test eder:
 *   - Missing IYZICO_WEBHOOK_SECRET → 500
 *   - Invalid signature → 401
 *   - Invalid JSON / schema → 400
 *   - Orchestrator throws → 200 OK (iyzico retry spam'ı önle)
 *   - Orchestrator success → 200 OK + outcome
 *
 * Route handler thin wrapper — business logic orchestrator.test.ts'te kapsamlı test edildi.
 * Bu test wire-up doğru mu ve HTTP semantikleri tutarlı mı diye doğrular.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @/lib/db/client — route import time'da DATABASE_URL env okuma engellenir
vi.mock('@/lib/db/client', () => ({
  db: {} as unknown,
}));

// Mock orchestrator + nilvera helper + iyzico webhook fonksiyonları
vi.mock('@/lib/iyzico/webhook', () => ({
  verifyIyzicoSignature: vi.fn(),
  parseIyzicoWebhookPayload: vi.fn(),
}));
vi.mock('@/lib/billing/orchestrator', () => ({
  processIyzicoWebhookEvent: vi.fn(),
}));
vi.mock('@/lib/nilvera/invoice', () => ({
  createNilveraInvoice: vi.fn(),
}));

import { POST } from './route';
import * as iyzicoWebhook from '@/lib/iyzico/webhook';
import * as orchestrator from '@/lib/billing/orchestrator';

const verifyMock = vi.mocked(iyzicoWebhook.verifyIyzicoSignature);
const parseMock = vi.mocked(iyzicoWebhook.parseIyzicoWebhookPayload);
const processMock = vi.mocked(orchestrator.processIyzicoWebhookEvent);

function makeRequest(body: string, signature: string | null = 'fake-sig'): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (signature) headers.set('x-iyz-signature', signature);
  return new Request('http://localhost:3000/api/webhooks/iyzico', {
    method: 'POST',
    headers,
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/webhooks/iyzico', () => {
  it('IYZICO_WEBHOOK_SECRET eksik → 500 webhook_secret_missing', async () => {
    verifyMock.mockImplementation(() => {
      throw new Error('IYZICO_WEBHOOK_SECRET yapılandırılmadı');
    });

    const res = await POST(makeRequest('{}') as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('webhook_secret_missing');
  });

  it('Invalid signature → 401 invalid_signature', async () => {
    verifyMock.mockReturnValue(false);

    const res = await POST(makeRequest('{}', 'wrong-sig') as never);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid_signature');
    expect(processMock).not.toHaveBeenCalled();
  });

  it('Eksik signature header (null) → 401', async () => {
    verifyMock.mockReturnValue(false);

    const res = await POST(makeRequest('{}', null) as never);
    expect(res.status).toBe(401);
  });

  it('Geçersiz JSON payload → 400 invalid_payload', async () => {
    verifyMock.mockReturnValue(true);
    parseMock.mockImplementation(() => {
      throw new SyntaxError('Unexpected token');
    });

    const res = await POST(makeRequest('not-json') as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_payload');
    expect(processMock).not.toHaveBeenCalled();
  });

  it('Orchestrator throw → 200 OK (iyzico retry spam koruma)', async () => {
    verifyMock.mockReturnValue(true);
    parseMock.mockReturnValue({
      eventType: 'SUBSCRIPTION_RENEWAL_SUCCESS',
      eventTime: 1747396800000,
      subscriptionReferenceCode: 'iyz-sub-1',
    } as never);
    processMock.mockRejectedValue(new Error('DB connection lost'));

    const res = await POST(makeRequest('{}') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('orchestration_failed');
  });

  it('Happy path — orchestration success → 200 OK + outcome', async () => {
    verifyMock.mockReturnValue(true);
    parseMock.mockReturnValue({
      eventType: 'SUBSCRIPTION_RENEWAL_SUCCESS',
      eventTime: 1747396800000,
      subscriptionReferenceCode: 'iyz-sub-1',
    } as never);
    processMock.mockResolvedValue({
      outcome: 'processed',
      eventId: 'iyzico_iyz-sub-1_SUBSCRIPTION_RENEWAL_SUCCESS_1747396800000',
      subscriptionId: 'sub-uuid-1',
      invoiceId: 'inv-uuid-1',
      nilveraInvoiceId: 'nilvera-99',
    });

    const res = await POST(makeRequest('{"eventType":"SUBSCRIPTION_RENEWAL_SUCCESS"}') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.outcome).toBe('processed');

    // Orchestrator çağrıldı + nilvera helper geçildi
    expect(processMock).toHaveBeenCalledTimes(1);
    const [payload, deps] = processMock.mock.calls[0];
    expect(payload.eventType).toBe('SUBSCRIPTION_RENEWAL_SUCCESS');
    expect(deps.db).toBeDefined();
    expect(deps.nilvera?.createInvoice).toBeDefined();
  });

  it('Duplicate event → 200 OK + outcome=duplicate (iyzico retry idempotent)', async () => {
    verifyMock.mockReturnValue(true);
    parseMock.mockReturnValue({
      eventType: 'SUBSCRIPTION_RENEWAL_SUCCESS',
      eventTime: 1747396800000,
      subscriptionReferenceCode: 'iyz-sub-1',
    } as never);
    processMock.mockResolvedValue({
      outcome: 'duplicate',
      eventId: 'iyzico_iyz-sub-1_SUBSCRIPTION_RENEWAL_SUCCESS_1747396800000',
    });

    const res = await POST(makeRequest('{}') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('duplicate');
  });

  it('Subscription bulunamadı → 200 OK + outcome=subscription_not_found (orphan event)', async () => {
    verifyMock.mockReturnValue(true);
    parseMock.mockReturnValue({
      eventType: 'SUBSCRIPTION_CANCELED',
      eventTime: 1747396800000,
      subscriptionReferenceCode: 'iyz-sub-orphan',
    } as never);
    processMock.mockResolvedValue({
      outcome: 'subscription_not_found',
      eventId: 'iyzico_iyz-sub-orphan_SUBSCRIPTION_CANCELED_1747396800000',
    });

    const res = await POST(makeRequest('{}') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('subscription_not_found');
  });
});
