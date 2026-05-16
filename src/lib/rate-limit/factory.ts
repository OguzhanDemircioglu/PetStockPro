/**
 * RateLimitStore factory — runtime'a göre KV / in-memory seçer.
 *
 * Production (Cloudflare Workers): `globalThis.RATE_LIMIT_KV` binding üzerinden KV.
 * Dev (Next.js dev server / vitest): InMemoryRateLimitStore singleton.
 *
 * `globalThis.RATE_LIMIT_KV` wrangler.toml `[[kv_namespaces]]` binding'i ile inject edilir.
 * OpenNext aktive edilince Workers runtime'da `env.RATE_LIMIT_KV` → `globalThis` taşınır.
 */

import { InMemoryRateLimitStore } from './in-memory';
import { KvRateLimitStore, type KVNamespaceLike } from './kv';
import type { RateLimitStore } from './store';

interface GlobalWithKv {
  RATE_LIMIT_KV?: KVNamespaceLike;
  __petstockproRateLimitMemoryStore?: InMemoryRateLimitStore;
}

/**
 * Singleton'ı `globalThis`'te tut — Next.js dev hot-reload sırasında module-level
 * `let memoryStore` sıfırlanabilir (cache MISS verir, rate-limit sayacı
 * sıfırlanır). `globalThis` Node.js process boyunca tek instance garanti eder.
 */
export function getRateLimitStore(): RateLimitStore {
  const g = globalThis as unknown as GlobalWithKv;
  if (g.RATE_LIMIT_KV) {
    return new KvRateLimitStore(g.RATE_LIMIT_KV);
  }
  if (!g.__petstockproRateLimitMemoryStore) {
    g.__petstockproRateLimitMemoryStore = new InMemoryRateLimitStore();
  }
  return g.__petstockproRateLimitMemoryStore;
}

/** Test yardımcısı — singleton'ı resetler (vitest beforeEach). */
export function _resetRateLimitStoreForTest(): void {
  const g = globalThis as unknown as GlobalWithKv;
  delete g.__petstockproRateLimitMemoryStore;
}
