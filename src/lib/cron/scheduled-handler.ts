/**
 * Cloudflare Workers — Scheduled Event Dispatcher
 *
 * `wrangler.toml` `[triggers]` `crons` her tetiklendiğinde Cloudflare Workers
 * runtime `scheduled(event, env, ctx)` çağırır. Bu modül, scheduled event'lerin
 * cron expression'ına göre hangi endpoint'e iç HTTP isteği atılacağını yönetir.
 *
 * Neden HTTP self-invocation:
 *   - /api/cron/* endpoint'leri zaten Bearer auth + business logic içeriyor (dev manuel test
 *     için)
 *   - Aynı code path production'da kullanılır → test sürprizleri azalır
 *   - Scheduled handler thin wrapper kalır, OpenNext re-export'unu bozmaz
 *
 * Test edilebilirlik için saf fonksiyon: fetch + env enjekte edilir, side-effect yok.
 *
 * Production wiring (Sprint 14 OpenNext aktive olunca):
 *   src/cf/worker-entry.ts içinden import edilir.
 */

export interface ScheduledEnv {
  CRON_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

export interface ScheduledDispatchDeps {
  /** Çağrı için kullanılacak fetch implementasyonu (Workers fetch / global fetch / test mock). */
  fetch: typeof fetch;
}

export interface ScheduledDispatchResult {
  outcome: 'dispatched' | 'unknown_cron' | 'cron_secret_missing' | 'http_error';
  cron: string;
  endpoint?: string;
  status?: number;
  body?: unknown;
  error?: string;
}

/**
 * Cron expression → endpoint path eşlemesi.
 * Yeni cron eklemek için: wrangler.toml `[triggers]` `crons` listesine ekle + buraya satır ekle.
 */
export const CRON_ENDPOINT_MAP: Record<string, string> = {
  '0 6 * * *': '/api/cron/daily-summary',
};

/**
 * Scheduled event'i alır, eşleşen endpoint'e Bearer auth ile POST atar.
 *
 * Workers runtime `scheduled()` handler'ı bu fonksiyonu `ctx.waitUntil(...)` ile çağırır:
 * cron tetiklendi → scheduled handler → bu dispatcher → /api/cron/* endpoint → iş mantığı.
 *
 * @param cron Cloudflare scheduled event'inden `event.cron` (örn "0 6 * * *")
 * @param env  Workers env (CRON_SECRET + NEXT_PUBLIC_APP_URL)
 * @param deps fetch (test için inject edilebilir)
 */
export async function dispatchScheduledCron(
  cron: string,
  env: ScheduledEnv,
  deps: ScheduledDispatchDeps,
): Promise<ScheduledDispatchResult> {
  const endpoint = CRON_ENDPOINT_MAP[cron];
  if (!endpoint) {
    return { outcome: 'unknown_cron', cron };
  }

  if (!env.CRON_SECRET) {
    return { outcome: 'cron_secret_missing', cron, endpoint };
  }

  // Self-invocation: production'da Workers' kendi origin'i (env.NEXT_PUBLIC_APP_URL),
  // dev'de override edilebilir. Test'te http://localhost:3000 default.
  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${baseUrl}${endpoint}`;

  try {
    const res = await deps.fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.CRON_SECRET}`,
        'content-type': 'application/json',
      },
    });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      return { outcome: 'http_error', cron, endpoint, status: res.status, body };
    }
    return { outcome: 'dispatched', cron, endpoint, status: res.status, body };
  } catch (err) {
    return {
      outcome: 'http_error',
      cron,
      endpoint,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
