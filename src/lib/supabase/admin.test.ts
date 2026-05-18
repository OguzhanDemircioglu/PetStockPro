import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

describe('getSupabaseAdminClient', () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) original[k] = process.env[k];
    // Singleton testler arası leak etmesin — module cache reset
    vi.resetModules();
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY varsa client döner', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-jwt';
    const { getSupabaseAdminClient } = await import('./admin');
    const client = getSupabaseAdminClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
    expect(typeof client.storage).toBe('object');
  });

  it('SUPABASE_URL yoksa açıklayıcı hata fırlatır', async () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
    const { getSupabaseAdminClient } = await import('./admin');
    expect(() => getSupabaseAdminClient()).toThrow(/SUPABASE_URL/);
  });

  it('SUPABASE_SERVICE_ROLE_KEY yoksa açıklayıcı hata fırlatır', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getSupabaseAdminClient } = await import('./admin');
    expect(() => getSupabaseAdminClient()).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it('İkinci çağrı aynı instance döner (singleton)', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
    const { getSupabaseAdminClient } = await import('./admin');
    const c1 = getSupabaseAdminClient();
    const c2 = getSupabaseAdminClient();
    expect(c1).toBe(c2);
  });
});
