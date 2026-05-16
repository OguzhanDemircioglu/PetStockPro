/**
 * Cloudflare Workers — Worker Entry (skeleton)
 *
 * ⚠ Bu dosya Sprint 14'te OpenNext (@opennextjs/cloudflare) aktive olduktan SONRA
 * aktif hale gelir. Şu an iskelet — wrangler.toml `main` alanı buraya işaret eder
 * ama OpenNext build'i olmadan deploy yapılamaz.
 *
 * Yapısı:
 *   - fetch handler: OpenNext'in ürettiği Worker'a delegate eder
 *   - scheduled handler: wrangler.toml `[triggers]` `crons` tetikleyicilerini
 *     dispatchScheduledCron'a yönlendirir (saf fonksiyon, lib/cron'da test edilir)
 *
 * Sprint 14 wiring adımları:
 *   1. `npm i -D @opennextjs/cloudflare` (devDep)
 *   2. `open-next.config.ts` oluştur (defaults)
 *   3. `npm run build && npx opennextjs-cloudflare` → .open-next/ üretir
 *   4. Aşağıdaki openNextHandler import'unu yorumdan çıkar
 *   5. `npx wrangler deploy` ile yayına al
 *
 * Ref: docs/DEPLOYMENT.md §3.3
 */

import { dispatchScheduledCron, type ScheduledEnv } from '@/lib/cron/scheduled-handler';

// OpenNext build çıktısı — Sprint 14'te aktive edilecek.
// Şu an placeholder; build/typecheck error'unu önlemek için inline stub.
// import openNextHandler from '../../.open-next/worker.js';

interface CloudflareScheduledEvent {
  cron: string;
  scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type WorkerEnv = ScheduledEnv & Record<string, unknown>;

const workerEntry = {
  /**
   * HTTP fetch → OpenNext'e delegate.
   * Sprint 14'te openNextHandler.fetch(...) ile değiştirilecek.
   */
  async fetch(_request: Request, _env: WorkerEnv, _ctx: ExecutionContext): Promise<Response> {
    // Sprint 14 wiring: return openNextHandler.fetch(_request, _env, _ctx);
    return new Response('OpenNext not wired yet — Sprint 14', { status: 503 });
  },

  /**
   * Workers scheduled event → ilgili /api/cron/* endpoint'ine self-invoke.
   * dispatchScheduledCron pure fonksiyon → test edilebilir, side-effect izole.
   */
  async scheduled(
    event: CloudflareScheduledEvent,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      dispatchScheduledCron(event.cron, env, { fetch }).then((result) => {
        if (result.outcome !== 'dispatched') {
          console.warn('[cf-cron]', JSON.stringify(result));
        } else {
          console.log('[cf-cron] dispatched', result.endpoint, 'status', result.status);
        }
      }),
    );
  },
};

export default workerEntry;
