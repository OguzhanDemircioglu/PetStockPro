import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  nilveraRequest,
  NilveraApiError,
  NilveraNetworkError,
  _setBackoffForTesting,
} from './client';
import { _resetNilveraConfigCache } from './config';

function makeMockResponse(status: number, body: unknown): Response {
  const text = body === null ? '' : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('nilveraRequest', () => {
  beforeEach(() => {
    vi.stubEnv('NILVERA_API_KEY', 'test-api-key');
    vi.stubEnv('NILVERA_SELLER_VKN', '1234567890');
    vi.stubEnv('NILVERA_BASE_URL', 'https://api.nilvera.com');
    _resetNilveraConfigCache();
    // 1ms backoff — retry test'leri real-timer'da hızlı geçer (fake timer pattern'inin fragility'sini bypass)
    _setBackoffForTesting(() => 1);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    _resetNilveraConfigCache();
    _setBackoffForTesting(null);
  });

  describe('happy path (2xx)', () => {
    it('200 OK → parsed JSON body döner', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, { invoiceId: 'nv_123', status: 'PENDING' }),
      );

      const result = await nilveraRequest<{ invoiceId: string }>({
        method: 'POST',
        path: '/api/v1/invoices',
        body: { externalRef: 'ext-1' },
      });

      expect(result).toEqual({ invoiceId: 'nv_123', status: 'PENDING' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('Bearer header + JSON content-type set edilir', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeMockResponse(200, {}));

      await nilveraRequest({ method: 'GET', path: '/api/v1/invoices/x' });

      const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const init = callArgs[1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-api-key');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers.Accept).toBe('application/json');
    });

    it('204 No Content → null döner (parse hatası yok)', async () => {
      // 204 spec: body olmamalı, Response constructor null/undefined ister
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, { status: 204 }),
      );

      const result = await nilveraRequest({ method: 'DELETE', path: '/x' });
      expect(result).toBeNull();
    });

    it('body verilirse JSON.stringify edilir', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeMockResponse(200, {}));

      await nilveraRequest({ method: 'POST', path: '/x', body: { foo: 'bar' } });

      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(init.body).toBe('{"foo":"bar"}');
    });
  });

  describe('4xx (no retry)', () => {
    it('400 Bad Request → NilveraApiError, tek deneme', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(400, { error: 'externalRef missing' }),
      );

      await expect(
        nilveraRequest({ method: 'POST', path: '/x', body: {} }),
      ).rejects.toBeInstanceOf(NilveraApiError);

      expect(fetchSpy).toHaveBeenCalledTimes(1); // NO retry
    });

    it('401 Unauthorized → NilveraApiError + status 401 + responseBody', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(401, { error: 'invalid token' }),
      );

      try {
        await nilveraRequest({ method: 'GET', path: '/x' });
        expect.fail('throw etmedi');
      } catch (err) {
        expect(err).toBeInstanceOf(NilveraApiError);
        expect((err as NilveraApiError).status).toBe(401);
        expect((err as NilveraApiError).responseBody).toMatchObject({ error: 'invalid token' });
      }
    });

    it('422 Validation → NilveraApiError, retry yok', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(422, { error: 'invalid VKN' }),
      );

      await expect(nilveraRequest({ method: 'POST', path: '/x', body: {} })).rejects.toBeInstanceOf(NilveraApiError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('5xx (retry exponential backoff)', () => {
    it('500 → retry 3x → fail with NilveraApiError', async () => {
      // mockImplementation: her çağrıda yeni Response (body stream tek seferlik consumable)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(makeMockResponse(500, { error: 'server' })),
      );

      await expect(
        nilveraRequest({ method: 'GET', path: '/x', retries: 3 }),
      ).rejects.toBeInstanceOf(NilveraApiError);
      expect(fetchSpy).toHaveBeenCalledTimes(4); // 1 ilk + 3 retry
    });

    it('500 → 500 → 200 (3. attempt success)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(makeMockResponse(500, { error: 'temp' }))
        .mockResolvedValueOnce(makeMockResponse(503, { error: 'temp' }))
        .mockResolvedValueOnce(makeMockResponse(200, { ok: true }));

      const result = await nilveraRequest<{ ok: boolean }>({ method: 'GET', path: '/x' });

      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('502 Bad Gateway → retry', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(makeMockResponse(502, null))
        .mockResolvedValueOnce(makeMockResponse(200, {}));

      await nilveraRequest({ method: 'GET', path: '/x' });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('retries=0 → 5xx single attempt, no retry', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(makeMockResponse(500, {})),
      );

      await expect(nilveraRequest({ method: 'GET', path: '/x', retries: 0 })).rejects.toBeInstanceOf(NilveraApiError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('network errors (retry)', () => {
    it('fetch reject → NilveraNetworkError, retry yapar, sonra success', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(makeMockResponse(200, { ok: true }));

      const result = await nilveraRequest<{ ok: boolean }>({ method: 'GET', path: '/x' });

      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('max retry sonrası NilveraNetworkError', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('ENOTFOUND'),
      );

      await expect(
        nilveraRequest({ method: 'GET', path: '/x', retries: 2 }),
      ).rejects.toBeInstanceOf(NilveraNetworkError);
      expect(fetchSpy).toHaveBeenCalledTimes(3); // 1 + 2 retry
    });
  });

  describe('config validation', () => {
    it('API key yoksa → erken throw (fetch çağrısı yok)', async () => {
      vi.stubEnv('NILVERA_API_KEY', '');
      _resetNilveraConfigCache();
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await expect(
        nilveraRequest({ method: 'GET', path: '/x' }),
      ).rejects.toThrow(/NILVERA_API_KEY/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('error classes', () => {
    it('NilveraApiError fields', () => {
      const err = new NilveraApiError('POST /x', 400, { msg: 'bad' });
      expect(err.name).toBe('NilveraApiError');
      expect(err.status).toBe(400);
      expect(err.operation).toBe('POST /x');
      expect(err.responseBody).toEqual({ msg: 'bad' });
      expect(err).toBeInstanceOf(Error);
    });

    it('NilveraNetworkError fields', () => {
      const inner = new Error('ECONNRESET');
      const err = new NilveraNetworkError('GET /x', inner);
      expect(err.name).toBe('NilveraNetworkError');
      expect(err.operation).toBe('GET /x');
      expect(err.originalError).toBe(inner);
    });
  });
});
