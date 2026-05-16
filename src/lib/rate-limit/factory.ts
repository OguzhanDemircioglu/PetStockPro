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
}

let memoryStore: InMemoryRateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  const g = globalThis as unknown as GlobalWithKv;
  if (g.RATE_LIMIT_KV) {
    return new KvRateLimitStore(g.RATE_LIMIT_KV);
  }
  if (!memoryStore) {
    memoryStore = new InMemoryRateLimitStore();
  }
  return memoryStore;
}

/** Test yardımcısı — singleton'ı resetler (vitest beforeEach). */
export function _resetRateLimitStoreForTest(): void {
  memoryStore = null;
}
