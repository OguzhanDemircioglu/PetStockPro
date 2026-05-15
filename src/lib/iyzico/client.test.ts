import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type Iyzipay from 'iyzipay';
import {
  getIyzicoClient,
  callIyzico,
  setIyzicoClientForTesting,
  _resetIyzicoClientCache,
} from './client';
import { _resetIyzicoConfigCache } from './config';

describe('iyzico client', () => {
  beforeEach(() => {
    _resetIyzicoClientCache();
    _resetIyzicoConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    setIyzicoClientForTesting(null);
    _resetIyzicoClientCache();
    _resetIyzicoConfigCache();
  });

  describe('getIyzicoClient', () => {
    it('env eksikse anlaşılır hata fırlatır', () => {
      vi.stubEnv('IYZICO_API_KEY', '');
      vi.stubEnv('IYZICO_SECRET_KEY', '');
      _resetIyzicoClientCache();
      _resetIyzicoConfigCache();
      expect(() => getIyzicoClient()).toThrow(/IYZICO_API_KEY/);
    });

    it('mock client inject edildiğinde onu döner', () => {
      const mockClient = { subscription: {} } as unknown as Iyzipay;
      setIyzicoClientForTesting(mockClient);
      expect(getIyzicoClient()).toBe(mockClient);
    });

    it('cache: ikinci çağrı aynı instance', () => {
      vi.stubEnv('IYZICO_API_KEY', 'test-key');
      vi.stubEnv('IYZICO_SECRET_KEY', 'test-secret');
      _resetIyzicoClientCache();
      _resetIyzicoConfigCache();
      const a = getIyzicoClient();
      const b = getIyzicoClient();
      expect(a).toBe(b);
    });
  });

  describe('callIyzico (Promise wrapper)', () => {
    it('callback başarılı sonuçla çağrılırsa resolve eder', async () => {
      const expected = { status: 'success', referenceCode: 'sub_123' };
      const result = await callIyzico<typeof expected>((cb) => {
        cb(null, expected);
      });
      expect(result).toEqual(expected);
    });

    it('callback Error ile çağrılırsa reject eder', async () => {
      const err = new Error('iyzico API down');
      await expect(
        callIyzico((cb) => {
          cb(err, null as never);
        })
      ).rejects.toThrow('iyzico API down');
    });

    it('async callback (setTimeout simülasyonu) ile resolve', async () => {
      const result = await callIyzico<string>((cb) => {
        setTimeout(() => cb(null, 'done'), 1);
      });
      expect(result).toBe('done');
    });

    it('iyzico failure response (err=null, status=failure) resolve eder — caller ayırt eder', async () => {
      // iyzico convention: err=null + result.status='failure' bir başarısız işlem demek
      // (network hatası değil, application hatası). callIyzico bunu resolve eder,
      // business logic status'u kontrol eder.
      const failureResponse = {
        status: 'failure',
        errorCode: '5001',
        errorMessage: 'Geçersiz kart',
      };
      const result = await callIyzico<typeof failureResponse>((cb) => {
        cb(null, failureResponse);
      });
      expect(result.status).toBe('failure');
      expect(result.errorCode).toBe('5001');
    });
  });

  describe('setIyzicoClientForTesting', () => {
    it('null geçildiğinde cache temizler', () => {
      const mockClient = { subscription: {} } as unknown as Iyzipay;
      setIyzicoClientForTesting(mockClient);
      expect(getIyzicoClient()).toBe(mockClient);

      setIyzicoClientForTesting(null);
      // null geçince cache reset; gerçek client deneyecek; env eksik → throw
      vi.stubEnv('IYZICO_API_KEY', '');
      vi.stubEnv('IYZICO_SECRET_KEY', '');
      _resetIyzicoConfigCache();
      expect(() => getIyzicoClient()).toThrow();
    });
  });
});
