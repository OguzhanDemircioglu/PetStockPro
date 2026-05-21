/**
 * Server action / route handler wrapper — beklenmeyen exception'ı
 * trackError'a yönlendirir (FAZ 2.B Sentry replacement).
 *
 * 3 örnek path retrofit edildi (stock-movements + product edit + iyzico
 * webhook); diğer action'lar zamanla yayılır.
 *
 * Pattern:
 *   return trackUnexpected({ route, action, companyId }, async () => {
 *     // mevcut logic — throw etse bile trackError fire-and-forget,
 *     // hata yine yeniden fırlatılır.
 *   });
 */
import { db } from '@/lib/db/client';
import { trackErrorAsync } from './track';
import type { ErrorContext, ErrorSeverity } from './track';

export interface TrackUnexpectedOptions extends ErrorContext {
  severity?: ErrorSeverity;
  errorTypeOverride?: string;
}

export async function trackUnexpected<T>(
  context: TrackUnexpectedOptions,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    trackErrorAsync(
      err,
      {
        companyId: context.companyId ?? null,
        userId: context.userId ?? null,
        route: context.route ?? null,
        action: context.action ?? null,
        metadata: context.metadata,
      },
      db,
      {
        severity: context.severity ?? 'error',
        errorTypeOverride: context.errorTypeOverride,
      },
    );
    throw err;
  }
}
