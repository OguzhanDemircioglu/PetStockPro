import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getNilveraConfig,
  isNilveraConfigured,
  _resetNilveraConfigCache,
} from './config';

describe('nilvera config', () => {
  beforeEach(() => {
    _resetNilveraConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetNilveraConfigCache();
  });

  describe('getNilveraConfig', () => {
    it('default base URL production (env yoksa)', () => {
      vi.stubEnv('NILVERA_BASE_URL', '');
      _resetNilveraConfigCache();
      const cfg = getNilveraConfig();
      expect(cfg.NILVERA_BASE_URL).toBe('https://api.nilvera.com');
    });

    it('API key + seller VKN env\'den okur', () => {
      vi.stubEnv('NILVERA_API_KEY', 'nv-test-key');
      vi.stubEnv('NILVERA_SELLER_VKN', '1234567890');
      vi.stubEnv('NILVERA_SELLER_TITLE', 'PetStockPro Yazılım A.Ş.');
      _resetNilveraConfigCache();
      const cfg = getNilveraConfig();
      expect(cfg.NILVERA_API_KEY).toBe('nv-test-key');
      expect(cfg.NILVERA_SELLER_VKN).toBe('1234567890');
      expect(cfg.NILVERA_SELLER_TITLE).toBe('PetStockPro Yazılım A.Ş.');
    });

    it('cache: ikinci çağrı aynı objeyi döner', () => {
      vi.stubEnv('NILVERA_API_KEY', 'cached');
      _resetNilveraConfigCache();
      expect(getNilveraConfig()).toBe(getNilveraConfig());
    });

    it('VKN 10 hane (tüzel kişi VKN) kabul', () => {
      vi.stubEnv('NILVERA_SELLER_VKN', '1234567890');
      _resetNilveraConfigCache();
      expect(getNilveraConfig().NILVERA_SELLER_VKN).toBe('1234567890');
    });

    it('VKN 11 hane (şahıs şirketi TCKN) kabul', () => {
      vi.stubEnv('NILVERA_SELLER_VKN', '12345678901');
      _resetNilveraConfigCache();
      expect(getNilveraConfig().NILVERA_SELLER_VKN).toBe('12345678901');
    });

    it('VKN 9 hane → reject', () => {
      vi.stubEnv('NILVERA_SELLER_VKN', '123456789');
      _resetNilveraConfigCache();
      expect(() => getNilveraConfig()).toThrow(/geçersiz/i);
    });

    it('VKN 12 hane → reject', () => {
      vi.stubEnv('NILVERA_SELLER_VKN', '123456789012');
      _resetNilveraConfigCache();
      expect(() => getNilveraConfig()).toThrow(/geçersiz/i);
    });

    it('VKN harf içerir → reject', () => {
      vi.stubEnv('NILVERA_SELLER_VKN', '12345678AB');
      _resetNilveraConfigCache();
      expect(() => getNilveraConfig()).toThrow(/geçersiz/i);
    });

    it('geçersiz URL → reject', () => {
      vi.stubEnv('NILVERA_BASE_URL', 'not-a-url');
      _resetNilveraConfigCache();
      expect(() => getNilveraConfig()).toThrow(/geçersiz/i);
    });
  });

  describe('isNilveraConfigured', () => {
    it('API key + VKN varsa true', () => {
      vi.stubEnv('NILVERA_API_KEY', 'key');
      vi.stubEnv('NILVERA_SELLER_VKN', '1234567890');
      _resetNilveraConfigCache();
      expect(isNilveraConfigured()).toBe(true);
    });

    it('API key yoksa false', () => {
      vi.stubEnv('NILVERA_API_KEY', '');
      vi.stubEnv('NILVERA_SELLER_VKN', '1234567890');
      _resetNilveraConfigCache();
      expect(isNilveraConfigured()).toBe(false);
    });

    it('VKN yoksa false', () => {
      vi.stubEnv('NILVERA_API_KEY', 'key');
      vi.stubEnv('NILVERA_SELLER_VKN', '');
      _resetNilveraConfigCache();
      expect(isNilveraConfigured()).toBe(false);
    });
  });
});
