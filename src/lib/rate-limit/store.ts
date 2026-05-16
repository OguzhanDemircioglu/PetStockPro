/**
 * RateLimitStore — sayaç tabanlı sliding-window rate-limit soyutlaması.
 *
 * Production: Cloudflare Workers KV (`env.RATE_LIMIT_KV`) ~5ms latency.
 * Dev: in-memory Map fallback (process restart'ta sıfırlanır, browser test için yeter).
 *
 * Defense in depth: DB-level COUNT (vitrinReports tablosu) hâlâ yedek olarak çalışır
 * — KV cache miss / down olsa bile şikayet eklenirken DB rate-limit COUNT'u devreye girer.
 *
 * Sliding-window approximation: TTL-based KV/in-memory. Yeni window'da counter yeniden
 * 0'dan başlar. Strict sliding window (Redis ZADD vb.) MVP'de gereksiz karmaşıklık.
 */

export interface RateLimitCheckResult {
  /** True ise eylem izin verilir (counter artmadı henüz). False ise rate-limit aşıldı. */
  allowed: boolean;
  /** Mevcut counter değeri (artırma öncesi). */
  currentCount: number;
  /** Hangi backend kullanıldı (gözlemleme / debug için). */
  source: 'kv' | 'memory' | 'noop';
}

export interface RateLimitStore {
  /**
   * Anahtara göre sayaç oku. Artırmaz.
   * @param key Birleşik anahtar (örn "report:companyId:ipHash")
   */
  get(key: string): Promise<number>;

  /**
   * Sayaç artır + TTL ayarla (yoksa). currentCount > 0 ise mevcut TTL korunur.
   * Atomic değil — race condition'da küçük over-count olabilir (kabul edilebilir).
   * @param key Birleşik anahtar
   * @param windowSeconds TTL (saniye)
   * @returns Artırma sonrası yeni değer
   */
  increment(key: string, windowSeconds: number): Promise<number>;

  /** Backend tipi (debug + observability için). */
  readonly source: 'kv' | 'memory' | 'noop';
}
