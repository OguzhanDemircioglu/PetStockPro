import { describe, it, expect } from 'vitest';
import { InMemoryRateLimitStore } from './in-memory';

describe('InMemoryRateLimitStore', () => {
  it('source = "memory"', () => {
    const store = new InMemoryRateLimitStore();
    expect(store.source).toBe('memory');
  });

  it('get bilinmeyen key → 0', async () => {
    const store = new InMemoryRateLimitStore();
    expect(await store.get('foo')).toBe(0);
  });

  it('increment 1× → counter=1, get=1', async () => {
    const store = new InMemoryRateLimitStore();
    expect(await store.increment('foo', 60)).toBe(1);
    expect(await store.get('foo')).toBe(1);
  });

  it('increment 3× → counter=3', async () => {
    const store = new InMemoryRateLimitStore();
    await store.increment('foo', 60);
    await store.increment('foo', 60);
    expect(await store.increment('foo', 60)).toBe(3);
    expect(await store.get('foo')).toBe(3);
  });

  it('TTL süresince counter korunur, sonra sıfırlanır', async () => {
    let fakeNow = 1_000_000;
    const store = new InMemoryRateLimitStore({ now: () => fakeNow });
    await store.increment('foo', 10); // expires 1_010_000
    fakeNow = 1_009_999;
    expect(await store.get('foo')).toBe(1);
    fakeNow = 1_010_001; // 10sn geçti
    expect(await store.get('foo')).toBe(0);
  });

  it('TTL geçtikten sonra increment yeni window → 1', async () => {
    let fakeNow = 1_000_000;
    const store = new InMemoryRateLimitStore({ now: () => fakeNow });
    await store.increment('foo', 10);
    fakeNow = 1_011_000;
    expect(await store.increment('foo', 10)).toBe(1);
  });

  it('iki farklı key bağımsız sayar', async () => {
    const store = new InMemoryRateLimitStore();
    await store.increment('foo', 60);
    await store.increment('bar', 60);
    await store.increment('foo', 60);
    expect(await store.get('foo')).toBe(2);
    expect(await store.get('bar')).toBe(1);
  });

  it('sweepInterval bayat anahtarları temizler', async () => {
    let fakeNow = 1_000_000;
    const store = new InMemoryRateLimitStore({
      sweepInterval: 2,
      now: () => fakeNow,
    });
    await store.increment('expired-1', 10);
    await store.increment('expired-2', 10);
    expect(store._size()).toBe(2);
    fakeNow = 1_020_000; // her ikisi süre dolmuş
    // 2. increment → sweepInterval=2 modulo 2 = 0 → sweep tetiklenir
    await store.increment('fresh', 60);
    await store.increment('fresh-2', 60);
    // expired-1/2 sweep ile silinir; fresh/fresh-2 kalır
    expect(store._size()).toBe(2);
  });

  it('increment TTL süresi geçmiş entry için yeni window başlatır', async () => {
    let fakeNow = 1_000_000;
    const store = new InMemoryRateLimitStore({ now: () => fakeNow });
    await store.increment('foo', 10);
    await store.increment('foo', 10);
    expect(await store.get('foo')).toBe(2);
    fakeNow = 1_011_000;
    // Süre dolmuş → increment yeni window → 1
    expect(await store.increment('foo', 10)).toBe(1);
  });
});
