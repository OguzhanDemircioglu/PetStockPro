/**
 * /api/ai/chat route handler — auth + RAG + audit/usage wire-up testleri.
 * Business logic askWithContext (rag.test.ts) ve usage helper'lar ayrı test edildi;
 * burada HTTP semantiği + persist çağrı sırası kontrol edilir.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {} as unknown,
}));

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/ai/rag', () => ({
  askWithContext: vi.fn(),
}));

vi.mock('@/lib/ai/usage', () => ({
  recordUserMessage: vi.fn(),
  recordAssistantMessage: vi.fn(),
  incrementDailyUsage: vi.fn(),
}));

vi.mock('@/lib/ai/plan-gate', () => ({
  checkAiDailyQuota: vi.fn(),
  checkAiRateLimit: vi.fn(),
}));

vi.mock('@/lib/cache/request-scoped', () => ({
  getCompanyById: vi.fn(),
}));

import { POST } from './route';
import * as authMod from '@/lib/auth/auth';
import * as ragMod from '@/lib/ai/rag';
import * as usageMod from '@/lib/ai/usage';
import * as gateMod from '@/lib/ai/plan-gate';
import * as cacheMod from '@/lib/cache/request-scoped';

const authMock = vi.mocked(authMod.auth);
const ragMock = vi.mocked(ragMod.askWithContext);
const userMsgMock = vi.mocked(usageMod.recordUserMessage);
const asstMsgMock = vi.mocked(usageMod.recordAssistantMessage);
const usageMock = vi.mocked(usageMod.incrementDailyUsage);
const quotaMock = vi.mocked(gateMod.checkAiDailyQuota);
const rateMock = vi.mocked(gateMod.checkAiRateLimit);
const companyMock = vi.mocked(cacheMod.getCompanyById);

function makeReq(body: unknown): Request {
  return new Request('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function fakeSession(overrides: Partial<{ id: string; companyId: string; role: string }> = {}): unknown {
  return {
    user: {
      id: overrides.id ?? 'u-1',
      companyId: overrides.companyId ?? 'co-1',
      role: overrides.role ?? 'BAYI_SAHIBI',
      email: 'test@example.com',
    },
  };
}

function fakeRagResult(overrides: Partial<{ answer: string; lowConfidence: boolean }> = {}) {
  return {
    answer: overrides.answer ?? 'Cevap',
    retrievedChunks: [
      {
        id: 'c-001',
        score: 0.7,
        breadcrumb: 'Ürünler > Yeni',
        title: 'Yeni',
        section: 'Ürünler',
        content: 'içerik',
        sourceStartLine: 1,
        sourceEndLine: 10,
      },
    ],
    lowConfidence: overrides.lowConfidence ?? false,
    inputTokens: 100,
    outputTokens: 50,
    modelUsed: '@cf/meta/llama-3.1-8b-instruct',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CF_VECTORIZE_INDEX = 'test-index';
  // Default: rate-limit + quota allowed
  rateMock.mockResolvedValue({
    allowed: true,
    currentCount: 1,
    limit: 5,
    retryAfterSeconds: 60,
  });
  quotaMock.mockResolvedValue({
    allowed: true,
    plan: 'FREE',
    used: 0,
    limit: 10,
    remaining: 10,
  });
  companyMock.mockResolvedValue({ id: 'co-1', plan: 'FREE', name: 'Test', slug: 'test', vatNo: null, storefrontStatus: 'disabled' } as never);
});

describe('POST /api/ai/chat', () => {
  it('auth yok → 401 unauthorized', async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ question: 'soru' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('unauthorized');
    expect(ragMock).not.toHaveBeenCalled();
  });

  it('companyId yok → 401 unauthorized', async () => {
    authMock.mockResolvedValueOnce({
      user: { id: 'u-1', companyId: null, role: 'STAFF' },
    } as never);
    const res = await POST(makeReq({ question: 'soru' }));
    expect(res.status).toBe(401);
  });

  it('invalid JSON → 400 invalid_json', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    const res = await POST(makeReq('not-json{'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });

  it('question yok → 400 invalid_input', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_input');
  });

  it('question 2 char altı → 400 invalid_input', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    const res = await POST(makeReq({ question: 'a' }));
    expect(res.status).toBe(400);
  });

  it('question 500 char üstü → 400 invalid_input', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    const res = await POST(makeReq({ question: 'x'.repeat(501) }));
    expect(res.status).toBe(400);
  });

  it('happy path: 200 + answer + chunks + persist çağrı zinciri', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    ragMock.mockResolvedValueOnce(fakeRagResult());
    userMsgMock.mockResolvedValueOnce({ id: 'msg-u', createdAt: new Date() });
    asstMsgMock.mockResolvedValueOnce({ id: 'msg-a', createdAt: new Date() });
    usageMock.mockResolvedValueOnce(undefined);

    const res = await POST(makeReq({ question: 'Vitrin urun nasil cikaririm?' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.answer).toBe('Cevap');
    expect(body.retrievedChunks).toHaveLength(1);
    expect(body.retrievedChunks[0]).toEqual({ id: 'c-001', breadcrumb: 'Ürünler > Yeni', score: 0.7 });
    expect(body.lowConfidence).toBe(false);
    expect(body.modelUsed).toBe('@cf/meta/llama-3.1-8b-instruct');

    expect(ragMock).toHaveBeenCalledWith('test-index', 'Vitrin urun nasil cikaririm?');
    expect(userMsgMock).toHaveBeenCalled();
    expect(asstMsgMock).toHaveBeenCalled();
    expect(usageMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId: 'co-1',
        userId: 'u-1',
        inputTokens: 100,
        outputTokens: 50,
      }),
    );
  });

  it('RAG throw → 503 ai_unavailable', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    ragMock.mockRejectedValueOnce(new Error('CF API 401 Authentication error'));
    const res = await POST(makeReq({ question: 'soru' }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('ai_unavailable');
    expect(body.detail).toContain('Authentication');
    expect(userMsgMock).not.toHaveBeenCalled();
  });

  it('audit DB hatası cevabı boğmaz (best-effort) → 200', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    ragMock.mockResolvedValueOnce(fakeRagResult());
    userMsgMock.mockRejectedValueOnce(new Error('db down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(makeReq({ question: 'soru ne' }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('question trim edilir (whitespace strip)', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    ragMock.mockResolvedValueOnce(fakeRagResult());
    userMsgMock.mockResolvedValueOnce({ id: 'm', createdAt: new Date() });
    asstMsgMock.mockResolvedValueOnce({ id: 'm', createdAt: new Date() });
    usageMock.mockResolvedValueOnce(undefined);

    await POST(makeReq({ question: '  Stok 0 olunca  ' }));
    expect(ragMock).toHaveBeenCalledWith('test-index', 'Stok 0 olunca');
  });

  it('rate-limit aşıldı → 429 rate_limited + retry-after header', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    rateMock.mockResolvedValueOnce({
      allowed: false,
      currentCount: 5,
      limit: 5,
      retryAfterSeconds: 60,
    });
    const res = await POST(makeReq({ question: 'soru' }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
    expect(body.retryAfterSeconds).toBe(60);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(ragMock).not.toHaveBeenCalled();
  });

  it('daily quota aşıldı (FREE 10/gün) → 429 daily_quota_exceeded', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    quotaMock.mockResolvedValueOnce({
      allowed: false,
      plan: 'FREE',
      used: 10,
      limit: 10,
      remaining: 0,
    });
    const res = await POST(makeReq({ question: 'soru' }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('daily_quota_exceeded');
    expect(body.plan).toBe('FREE');
    expect(body.used).toBe(10);
    expect(body.limit).toBe(10);
    expect(ragMock).not.toHaveBeenCalled();
  });

  it('PRO plan → cap kontrolü pass, RAG çağrılır', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    companyMock.mockResolvedValueOnce({ id: 'co-1', plan: 'PRO' } as never);
    quotaMock.mockResolvedValueOnce({
      allowed: true,
      plan: 'PRO',
      used: 0,
      limit: Infinity,
      remaining: Infinity,
    });
    ragMock.mockResolvedValueOnce(fakeRagResult());
    userMsgMock.mockResolvedValueOnce({ id: 'm', createdAt: new Date() });
    asstMsgMock.mockResolvedValueOnce({ id: 'm', createdAt: new Date() });
    usageMock.mockResolvedValueOnce(undefined);

    const res = await POST(makeReq({ question: 'soru' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quota.plan).toBe('PRO');
    expect(body.quota.limit).toBeNull(); // Infinity → null
    expect(body.quota.remaining).toBeNull();
  });

  it('happy response: quota usage+1 + remaining-1 döner', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    quotaMock.mockResolvedValueOnce({
      allowed: true,
      plan: 'FREE',
      used: 3,
      limit: 10,
      remaining: 7,
    });
    ragMock.mockResolvedValueOnce(fakeRagResult());
    userMsgMock.mockResolvedValueOnce({ id: 'm', createdAt: new Date() });
    asstMsgMock.mockResolvedValueOnce({ id: 'm', createdAt: new Date() });
    usageMock.mockResolvedValueOnce(undefined);

    const res = await POST(makeReq({ question: 'soru' }));
    const body = await res.json();
    expect(body.quota.used).toBe(4); // 3 + 1
    expect(body.quota.remaining).toBe(6); // 7 - 1
  });

  it('lowConfidence true geçer', async () => {
    authMock.mockResolvedValueOnce(fakeSession() as never);
    ragMock.mockResolvedValueOnce(fakeRagResult({ lowConfidence: true }));
    userMsgMock.mockResolvedValueOnce({ id: 'm', createdAt: new Date() });
    asstMsgMock.mockResolvedValueOnce({ id: 'm', createdAt: new Date() });
    usageMock.mockResolvedValueOnce(undefined);

    const res = await POST(makeReq({ question: 'kapsam disi' }));
    expect((await res.json()).lowConfidence).toBe(true);
  });
});
