import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCfEnv,
  embedTexts,
  embedSingle,
  chatComplete,
  createVectorizeIndex,
  getVectorizeIndex,
  upsertVectors,
  queryVectorize,
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  TEXT_MODEL,
} from './cf-client';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.CF_ACCOUNT_ID = 'test-account-id';
  process.env.CF_API_TOKEN = 'test-token-1234';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

function mockFetchOnce(payload: unknown, init: { status?: number } = {}): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status: init.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function fetchCalls(): Array<[unknown, RequestInit | undefined]> {
  const mocked = vi.mocked(globalThis.fetch);
  return mocked.mock.calls.map((c) => [c[0], c[1]]);
}

describe('getCfEnv', () => {
  it('CF_ACCOUNT_ID yoksa throw eder', () => {
    delete process.env.CF_ACCOUNT_ID;
    expect(() => getCfEnv()).toThrow(/CF_ACCOUNT_ID/);
  });

  it('CF_API_TOKEN yoksa throw eder', () => {
    delete process.env.CF_API_TOKEN;
    expect(() => getCfEnv()).toThrow(/CF_API_TOKEN/);
  });

  it('iki env varsa nesne döner', () => {
    const env = getCfEnv();
    expect(env).toEqual({ accountId: 'test-account-id', apiToken: 'test-token-1234' });
  });
});

describe('embedTexts', () => {
  it('boş listede 0 fetch çağrısı yapar', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const result = await embedTexts([]);
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('doğru URL + body + Bearer auth ile çağırır', async () => {
    mockFetchOnce({
      result: { data: [[0.1, 0.2, 0.3]], shape: [1, 3] },
      success: true,
      errors: [],
      messages: [],
    });
    const vectors = await embedTexts(['merhaba']);
    expect(vectors).toEqual([[0.1, 0.2, 0.3]]);
    const [url, opts] = fetchCalls()[0];
    expect(String(url)).toBe(
      `https://api.cloudflare.com/client/v4/accounts/test-account-id/ai/run/${EMBEDDING_MODEL}`,
    );
    const init = opts as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token-1234');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ text: ['merhaba'] });
  });

  it('count mismatch durumunda throw eder', async () => {
    mockFetchOnce({
      result: { data: [[0.1]], shape: [1, 1] },
      success: true,
      errors: [],
      messages: [],
    });
    await expect(embedTexts(['a', 'b'])).rejects.toThrow(/Embedding count mismatch/);
  });

  it('CF success=false → error throw', async () => {
    mockFetchOnce({
      result: null,
      success: false,
      errors: [{ code: 10000, message: 'Authentication error' }],
      messages: [],
    });
    await expect(embedTexts(['x'])).rejects.toThrow(/\[10000\] Authentication error/);
  });

  it('embedSingle tek vektör döner', async () => {
    mockFetchOnce({
      result: { data: [[1, 2, 3, 4]], shape: [1, 4] },
      success: true,
      errors: [],
      messages: [],
    });
    const v = await embedSingle('x');
    expect(v).toEqual([1, 2, 3, 4]);
  });
});

describe('chatComplete', () => {
  it('TEXT_MODEL endpoint çağırır, max_tokens default 512', async () => {
    mockFetchOnce({
      result: { response: 'cevap', usage: { total_tokens: 50 } },
      success: true,
      errors: [],
      messages: [],
    });
    const res = await chatComplete([{ role: 'user', content: 'soru' }]);
    expect(res.response).toBe('cevap');
    const [url, opts] = fetchCalls()[0];
    expect(String(url)).toBe(
      `https://api.cloudflare.com/client/v4/accounts/test-account-id/ai/run/${TEXT_MODEL}`,
    );
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.max_tokens).toBe(512);
    expect(body.temperature).toBe(0.3);
    expect(body.messages).toEqual([{ role: 'user', content: 'soru' }]);
  });

  it('opts ile max_tokens + temperature override', async () => {
    mockFetchOnce({
      result: { response: 'x' },
      success: true,
      errors: [],
      messages: [],
    });
    await chatComplete([{ role: 'user', content: 'x' }], { maxTokens: 200, temperature: 0 });
    const body = JSON.parse((fetchCalls()[0][1] as RequestInit).body as string);
    expect(body.max_tokens).toBe(200);
    expect(body.temperature).toBe(0);
  });
});

describe('createVectorizeIndex', () => {
  it('POST /vectorize/v2/indexes ile config gönderir', async () => {
    mockFetchOnce({
      result: {
        name: 'petstockpro-user-manual',
        config: { dimensions: 1024, metric: 'cosine' },
      },
      success: true,
      errors: [],
      messages: [],
    });
    const idx = await createVectorizeIndex({
      name: 'petstockpro-user-manual',
      dimensions: 1024,
      metric: 'cosine',
      description: 'test',
    });
    expect(idx.name).toBe('petstockpro-user-manual');
    expect(idx.config?.dimensions).toBe(1024);
    const [url, opts] = fetchCalls()[0];
    expect(String(url)).toContain('/vectorize/v2/indexes');
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body).toEqual({
      name: 'petstockpro-user-manual',
      config: { dimensions: 1024, metric: 'cosine' },
      description: 'test',
    });
  });
});

describe('getVectorizeIndex', () => {
  it('mevcut index → describe döner', async () => {
    mockFetchOnce({
      result: {
        name: 'x',
        config: { dimensions: 1024, metric: 'cosine' },
      },
      success: true,
      errors: [],
      messages: [],
    });
    const idx = await getVectorizeIndex('x');
    expect(idx?.name).toBe('x');
  });

  it('404 / not_found → null döner', async () => {
    mockFetchOnce(
      {
        result: null,
        success: false,
        errors: [{ code: 1004, message: 'index not found' }],
        messages: [],
      },
      { status: 404 },
    );
    const idx = await getVectorizeIndex('yok');
    expect(idx).toBeNull();
  });

  it('500 / başka error → throw', async () => {
    mockFetchOnce(
      {
        result: null,
        success: false,
        errors: [{ code: 9999, message: 'internal server error' }],
        messages: [],
      },
      { status: 500 },
    );
    await expect(getVectorizeIndex('x')).rejects.toThrow(/9999/);
  });
});

describe('upsertVectors', () => {
  it('boş liste → noop, fetch çağrılmaz', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const result = await upsertVectors('x', []);
    expect(result.mutationId).toBe('noop');
    expect(spy).not.toHaveBeenCalled();
  });

  it('NDJSON body üretir + Content-Type x-ndjson', async () => {
    mockFetchOnce({
      result: { mutationId: 'mut-1', count: 2 },
      success: true,
      errors: [],
      messages: [],
    });
    await upsertVectors('idx', [
      { id: 'a', values: [1, 2], metadata: { x: 1 } },
      { id: 'b', values: [3, 4] },
    ]);
    const init = fetchCalls()[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-ndjson');
    const body = init.body as string;
    const lines = body.split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ id: 'a', values: [1, 2], metadata: { x: 1 } });
    expect(JSON.parse(lines[1])).toEqual({ id: 'b', values: [3, 4] });
  });
});

describe('queryVectorize', () => {
  it('top-K + returnMetadata gönderir, matches döner', async () => {
    mockFetchOnce({
      result: {
        matches: [
          { id: 'c-001', score: 0.95, metadata: { title: 'Vitrin' } },
          { id: 'c-002', score: 0.88, metadata: { title: 'Stok' } },
        ],
        count: 2,
      },
      success: true,
      errors: [],
      messages: [],
    });
    const res = await queryVectorize('idx', [0.1, 0.2, 0.3], 5, 'all');
    expect(res.matches).toHaveLength(2);
    expect(res.matches[0].score).toBe(0.95);
    const body = JSON.parse((fetchCalls()[0][1] as RequestInit).body as string);
    expect(body).toEqual({ vector: [0.1, 0.2, 0.3], topK: 5, returnMetadata: 'all' });
  });

  it('topK default 5, returnMetadata default all', async () => {
    mockFetchOnce({
      result: { matches: [], count: 0 },
      success: true,
      errors: [],
      messages: [],
    });
    await queryVectorize('idx', [0]);
    const body = JSON.parse((fetchCalls()[0][1] as RequestInit).body as string);
    expect(body.topK).toBe(5);
    expect(body.returnMetadata).toBe('all');
  });
});

describe('constants sanity', () => {
  it('EMBEDDING_DIM = 1024 (bge-m3)', () => {
    expect(EMBEDDING_DIM).toBe(1024);
  });

  it('EMBEDDING_MODEL = @cf/baai/bge-m3', () => {
    expect(EMBEDDING_MODEL).toBe('@cf/baai/bge-m3');
  });

  it('TEXT_MODEL = llama-3.1-8b-instruct', () => {
    expect(TEXT_MODEL).toBe('@cf/meta/llama-3.1-8b-instruct');
  });
});
