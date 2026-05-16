import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getRateLimitStore, _resetRateLimitStoreForTest } from './factory';
import { InMemoryRateLimitStore } from './in-memory';
import { KvRateLimitStore, type KVNamespaceLike } from './kv';

const originalGlobal = (globalThis as Record<string, unknown>).RATE_LIMIT_KV;

beforeEach(() => {
  _resetRateLimitStoreForTest();
  delete (globalThis as Record<string, unknown>).RATE_LIMIT_KV;
});

afterEach(() => {
  _resetRateLimitStoreForTest();
  if (originalGlobal !== undefined) {
    (globalThis as Record<string, unknown>).RATE_LIMIT_KV = originalGlobal;
  } else {
    delete (globalThis as Record<string, unknown>).RATE_LIMIT_KV;
  }
});

describe('getRateLimitStore', () => {
  it('KV binding YOKsa → InMemoryRateLimitStore', () => {
    const store = getRateLimitStore();
    expect(store).toBeInstanceOf(InMemoryRateLimitStore);
    expect(store.source).toBe('memory');
  });

  it('KV binding VARsa → KvRateLimitStore', () => {
    const fakeKv: KVNamespaceLike = {
      async get() {
        return null;
      },
      async put() {},
    };
    (globalThis as Record<string, unknown>).RATE_LIMIT_KV = fakeKv;

    const store = getRateLimitStore();
    expect(store).toBeInstanceOf(KvRateLimitStore);
    expect(store.source).toBe('kv');
  });

  it('memory store singleton — ikinci çağrı aynı instance', () => {
    const a = getRateLimitStore();
    const b = getRateLimitStore();
    expect(a).toBe(b);
  });

  it('reset sonrası yeni instance', () => {
    const a = getRateLimitStore();
    _resetRateLimitStoreForTest();
    const b = getRateLimitStore();
    expect(a).not.toBe(b);
    expect(b.source).toBe('memory');
  });
});
