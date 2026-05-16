/**
 * Cloudflare Workers KV RateLimitStore.
 *
 * KV API: put(key, value, { expirationTtl }) — TTL saniye cinsinden.
 * KV eventual consistency: <60sn yayılır (rate-limit için tolere edilir).
 *
 * Atomic değil — race condition'da küçük over-count olabilir. Strict semantik için
 * Workers Durable Objects gerekir (Faz 2 — şu an ihtiyaç yok).
 */

import type { RateLimitStore } from './store';

/** Minimal Cloudflare KVNamespace shape — wrangler type'ı yerine local interface. */
export interface KVNamespaceLike {
  get(key: string, options?: { type: 'text' }): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

export class KvRateLimitStore implements RateLimitStore {
  readonly source = 'kv' as const;
  constructor(private readonly kv: KVNamespaceLike) {}

  async get(key: string): Promise<number> {
    const raw = await this.kv.get(key);
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }

  async increment(key: string, windowSeconds: number): Promise<number> {
    const current = await this.get(key);
    const next = current + 1;
    // KV TTL minimum 60 sn — daha küçük değerler reddedilir. Rate-limit window'ları
    // genelde dakikalar/saatler düzeyinde, ama corner case için clamp uygulayalım.
    const ttl = Math.max(60, Math.floor(windowSeconds));
    await this.kv.put(key, String(next), { expirationTtl: ttl });
    return next;
  }
}
