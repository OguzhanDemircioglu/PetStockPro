/**
 * Nilvera HTTP Client — Bearer auth + retry + structured errors
 *
 * Resmi SDK yok, custom HTTP client. Sandbox + production base URL switch
 * NILVERA_BASE_URL env değişkeniyle.
 *
 * Retry stratejisi:
 *   - 2xx → success
 *   - 4xx → NilveraApiError (no retry, business logic'ın handle etmesi gerekli)
 *   - 5xx → retry exponential backoff (1s, 2s, 4s) — max 3 retry
 *   - Network/timeout → retry (aynı backoff)
 *
 * Test'lerde global fetch vitest ile mock'lanır.
 */

import { getNilveraConfig, isNilveraConfigured } from './config';

/**
 * Nilvera API döndüğü hata response (4xx, 5xx)
 */
export class NilveraApiError extends Error {
  readonly status: number;
  readonly operation: string;
  readonly responseBody: unknown;

  constructor(operation: string, status: number, responseBody: unknown, message?: string) {
    super(message ?? `Nilvera API ${operation} → HTTP ${status}`);
    this.name = 'NilveraApiError';
    this.operation = operation;
    this.status = status;
    this.responseBody = responseBody;
  }
}

/**
 * Network/timeout/connection failure
 */
export class NilveraNetworkError extends Error {
  readonly operation: string;
  readonly originalError: unknown;

  constructor(operation: string, originalError: unknown) {
    const detail = originalError instanceof Error ? originalError.message : 'unknown';
    super(`Nilvera network hatası — ${operation}: ${detail}`);
    this.name = 'NilveraNetworkError';
    this.operation = operation;
    this.originalError = originalError;
  }
}

export interface NilveraRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;                          // örn '/api/v1/invoices'
  body?: unknown;
  headers?: Record<string, string>;
  retries?: number;                       // default 3
  timeoutMs?: number;                     // default 10000
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test'lerde fake timer + fetch mock kombinasyonu trickier — backoff'ı doğrudan
 * override edebilmek daha güvenilir (1ms backoff ile testler real-timer'da hızlı geçer).
 */
let _backoffOverride: ((attempt: number) => number) | null = null;

export function _setBackoffForTesting(fn: ((attempt: number) => number) | null): void {
  _backoffOverride = fn;
}

/**
 * Exponential backoff: 1s → 2s → 4s → 8s (max)
 */
function backoffDelay(attempt: number): number {
  if (_backoffOverride) return _backoffOverride(attempt);
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

/**
 * Nilvera REST API'sine generic HTTP request.
 *
 * @param opts request konfigürasyonu
 * @returns parsed JSON response body
 * @throws NilveraApiError (4xx) — caller bunu catch edip business logic uygulamalı
 * @throws NilveraNetworkError (5xx + network + timeout, max retry sonrası)
 *
 * @example
 * const invoice = await nilveraRequest<NilveraInvoiceResponse>({
 *   method: 'POST',
 *   path: '/api/v1/invoices',
 *   body: invoiceData,
 * });
 */
export async function nilveraRequest<T>(opts: NilveraRequestOptions): Promise<T> {
  if (!isNilveraConfigured()) {
    throw new Error(
      'Nilvera yapılandırılmadı — NILVERA_API_KEY + NILVERA_SELLER_VKN env değişkenleri gerekli. ' +
      'Sandbox key için Nilvera Developer Panel.',
    );
  }

  const cfg = getNilveraConfig();
  const url = new URL(opts.path, cfg.NILVERA_BASE_URL).toString();
  const maxRetries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 10000;
  const operation = `${opts.method} ${opts.path}`;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(backoffDelay(attempt));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: opts.method,
        headers: {
          Authorization: `Bearer ${cfg.NILVERA_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...opts.headers,
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Response body parse (boş 204 No Content da olabilir). JSON dışı yanıt
      // (ör. yanlış endpoint'te "default backend - 404" düz metni) status koduyla
      // birlikte NilveraApiError'a sarılır — sessizce network hatası gibi maskelenmez.
      const text = await response.text();
      let responseBody: unknown = null;
      if (text.length > 0) {
        try {
          responseBody = JSON.parse(text);
        } catch {
          responseBody = text; // ham metin koru (4xx/5xx tanı için kritik)
        }
      }

      if (response.ok) {
        return responseBody as T;
      }

      // 4xx — business logic hata, retry yok
      if (response.status >= 400 && response.status < 500) {
        throw new NilveraApiError(operation, response.status, responseBody);
      }

      // 5xx — retry
      lastError = new NilveraApiError(operation, response.status, responseBody);
      continue;
    } catch (err) {
      clearTimeout(timeoutId);

      // 4xx API error — propagate, retry etme
      if (err instanceof NilveraApiError) {
        throw err;
      }

      // AbortError = timeout
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new NilveraNetworkError(`${operation} (timeout ${timeoutMs}ms)`, err);
        continue;
      }

      // Network error / DNS / fetch reject
      lastError = new NilveraNetworkError(operation, err);
      continue;
    }
  }

  // All retries exhausted → throw last error
  throw lastError;
}
