/**
 * In-memory RateLimitStore — dev / test fallback.
 *
 * Process restart'ta sayaç sıfırlanır. Workers production'da KV store kullanılır.
 * Map memory leak engellemek için bayat anahtarlar lazy-evict (her get/increment'ta
 * tek anahtar süresi geçtiyse silinir + opportunistic full sweep her N işlemde bir).
 */

import type { RateLimitStore } from './store';

interface Entry {
  count: number;
  expiresAt: number; // ms epoch
}

export class InMemoryRateLimitStore implements RateLimitStore {
  readonly source = 'memory' as const;
  private readonly map = new Map<string, Entry>();
  private operationCount = 0;
  private readonly sweepInterval: number;
  private readonly now: () => number;

  constructor(opts: { sweepInterval?: number; now?: () => number } = {}) {
    this.sweepInterval = opts.sweepInterval ?? 100;
    this.now = opts.now ?? Date.now;
  }

  async get(key: string): Promise<number> {
    const entry = this.map.get(key);
    if (!entry) return 0;
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key);
      return 0;
    }
    return entry.count;
  }

  async increment(key: string, windowSeconds: number): Promise<number> {
    this.maybeSweep();
    const now = this.now();
    const existing = this.map.get(key);
    if (!existing || existing.expiresAt <= now) {
      // Yeni window — TTL bilgisi şimdi set edilir
      this.map.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }

  private maybeSweep(): void {
    this.operationCount += 1;
    if (this.operationCount % this.sweepInterval !== 0) return;
    const now = this.now();
    for (const [k, v] of this.map) {
      if (v.expiresAt <= now) this.map.delete(k);
    }
  }

  /** Test yardımcısı. */
  _size(): number {
    return this.map.size;
  }
}
