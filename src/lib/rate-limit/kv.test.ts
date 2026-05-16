import { describe, it, expect, vi } from 'vitest';
import { KvRateLimitStore, type KVNamespaceLike } from './kv';

function makeFakeKv(initial: Record<string, string> = {}): KVNamespaceLike & {
  _store: Map<string, string>;
  _puts: Array<{ key: string; value: string; ttl?: number }>;
} {
  const store = new Map<string, string>(Object.entries(initial));
  const puts: Array<{ key: string; value: string; ttl?: number }> = [];
  return {
    _store: store,
    _puts: puts,
    async get(key, options) {
      // options.type='text' assumed
      void options;
      return store.get(key) ?? null;
    },
    async put(key, value, opts) {
      store.set(key, value);
      puts.push({ key, value, ttl: opts?.expirationTtl });
    },
  };
}

describe('KvRateLimitStore', () => {
  it('source = "kv"', () => {
    const store = new KvRateLimitStore(makeFakeKv());
    expect(store.source).toBe('kv');
  });

  it('get bilinmeyen key → 0', async () => {
    const store = new KvRateLimitStore(makeFakeKv());
    expect(await store.get('foo')).toBe(0);
  });

  it('get mevcut key → parsed int', async () => {
    const store = new KvRateLimitStore(makeFakeKv({ foo: '7' }));
    expect(await store.get('foo')).toBe(7);
  });

  it('get corrupted value (NaN) → 0', async () => {
    const store = new KvRateLimitStore(makeFakeKv({ foo: 'not-a-number' }));
    expect(await store.get('foo')).toBe(0);
  });

  it('increment 1× → counter=1 + put TTL', async () => {
    const kv = makeFakeKv();
    const store = new KvRateLimitStore(kv);
    expect(await store.increment('foo', 3600)).toBe(1);
    expect(kv._puts).toHaveLength(1);
    expect(kv._puts[0]).toMatchObject({ key: 'foo', value: '1', ttl: 3600 });
  });

  it('increment 3× → counter=3', async () => {
    const kv = makeFakeKv();
    const store = new KvRateLimitStore(kv);
    await store.increment('foo', 60);
    await store.increment('foo', 60);
    expect(await store.increment('foo', 60)).toBe(3);
  });

  it('TTL < 60sn → 60a clamp edilir (KV minimum)', async () => {
    const kv = makeFakeKv();
    const store = new KvRateLimitStore(kv);
    await store.increment('foo', 10);
    expect(kv._puts[0].ttl).toBe(60);
  });

  it('iki farklı key bağımsız', async () => {
    const kv = makeFakeKv();
    const store = new KvRateLimitStore(kv);
    await store.increment('foo', 60);
    await store.increment('bar', 60);
    await store.increment('foo', 60);
    expect(await store.get('foo')).toBe(2);
    expect(await store.get('bar')).toBe(1);
  });

  it('KV throw → exception propagate eder', async () => {
    const erroringKv: KVNamespaceLike = {
      async get() {
        throw new Error('KV down');
      },
      async put() {
        throw new Error('KV down');
      },
    };
    const store = new KvRateLimitStore(erroringKv);
    await expect(store.get('foo')).rejects.toThrow('KV down');
  });

  it('incrementta get throw → exception propagate eder', async () => {
    const erroringKv: KVNamespaceLike = {
      get: vi.fn().mockRejectedValue(new Error('KV get down')),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const store = new KvRateLimitStore(erroringKv);
    await expect(store.increment('foo', 60)).rejects.toThrow('KV get down');
  });
});
