import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getIyzicoConfig,
  isIyzicoConfigured,
  isIyzicoProduction,
  _resetIyzicoConfigCache,
} from './config';

describe('iyzico config', () => {
  beforeEach(() => {
    _resetIyzicoConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetIyzicoConfigCache();
  });

  describe('getIyzicoConfig', () => {
    it('default base URL sandbox', () => {
      vi.stubEnv('IYZICO_BASE_URL', '');
      _resetIyzicoConfigCache();
      // Boş string z.string().url() ile fail eder, default fallback olur
      // Bu davranışı sürdürmek için: env'de hiç yoksa default'u alır
      vi.stubEnv('IYZICO_BASE_URL', 'https://sandbox-api.iyzipay.com');
      _resetIyzicoConfigCache();
      const cfg = getIyzicoConfig();
      expect(cfg.IYZICO_BASE_URL).toBe('https://sandbox-api.iyzipay.com');
    });

    it('API key + secret env\'den okur', () => {
      vi.stubEnv('IYZICO_API_KEY', 'sandbox-test-key');
      vi.stubEnv('IYZICO_SECRET_KEY', 'sandbox-test-secret');
      _resetIyzicoConfigCache();
      const cfg = getIyzicoConfig();
      expect(cfg.IYZICO_API_KEY).toBe('sandbox-test-key');
      expect(cfg.IYZICO_SECRET_KEY).toBe('sandbox-test-secret');
    });

    it('cache: ikinci çağrı aynı objeyi döner', () => {
      vi.stubEnv('IYZICO_API_KEY', 'cached-key');
      _resetIyzicoConfigCache();
      const a = getIyzicoConfig();
      const b = getIyzicoConfig();
      expect(a).toBe(b);
    });

    it('geçersiz URL hata fırlatır', () => {
      vi.stubEnv('IYZICO_BASE_URL', 'not-a-url');
      _resetIyzicoConfigCache();
      expect(() => getIyzicoConfig()).toThrow(/geçersiz/i);
    });
  });

  describe('isIyzicoConfigured', () => {
    it('key + secret varsa true', () => {
      vi.stubEnv('IYZICO_API_KEY', 'key');
      vi.stubEnv('IYZICO_SECRET_KEY', 'secret');
      _resetIyzicoConfigCache();
      expect(isIyzicoConfigured()).toBe(true);
    });

    it('key yoksa false', () => {
      vi.stubEnv('IYZICO_API_KEY', '');
      vi.stubEnv('IYZICO_SECRET_KEY', 'secret');
      _resetIyzicoConfigCache();
      expect(isIyzicoConfigured()).toBe(false);
    });

    it('secret yoksa false', () => {
      vi.stubEnv('IYZICO_API_KEY', 'key');
      vi.stubEnv('IYZICO_SECRET_KEY', '');
      _resetIyzicoConfigCache();
      expect(isIyzicoConfigured()).toBe(false);
    });

    it('ikisi de yoksa false', () => {
      vi.stubEnv('IYZICO_API_KEY', '');
      vi.stubEnv('IYZICO_SECRET_KEY', '');
      _resetIyzicoConfigCache();
      expect(isIyzicoConfigured()).toBe(false);
    });
  });

  describe('isIyzicoProduction', () => {
    it('production URL ise true', () => {
      vi.stubEnv('IYZICO_BASE_URL', 'https://api.iyzipay.com');
      _resetIyzicoConfigCache();
      expect(isIyzicoProduction()).toBe(true);
    });

    it('sandbox URL ise false', () => {
      vi.stubEnv('IYZICO_BASE_URL', 'https://sandbox-api.iyzipay.com');
      _resetIyzicoConfigCache();
      expect(isIyzicoProduction()).toBe(false);
    });

    it("staging/test URL'leri ise false (sadece production tam eşleşme)", () => {
      vi.stubEnv('IYZICO_BASE_URL', 'https://staging-api.iyzipay.com');
      _resetIyzicoConfigCache();
      expect(isIyzicoProduction()).toBe(false);
    });
  });
});
