/**
 * Error burst threshold check cron — PLAN-BETA-PERFORMANCE FAZ 2.B.
 *
 * Cloudflare Workers cron `55 3 * * *` (03:55 UTC / 06:55 TR) tetikler.
 * Her cron tetiklemesinde:
 *   1. system_errors son 60 dk içinde error_type başına COUNT >= 5
 *   2. Son 6 saat içinde aynı tip için alert atılmamış (dedup)
 *   3. Her burst için Telegram critical alert + son satıra alert_sent_at set
 *
 * Bearer auth CRON_SECRET.
 */
import { db } from '@/lib/db/client';
import {
  findActiveBursts,
  markErrorAlerted,
} from '@/lib/errors/threshold';
import { sendTelegramAlert } from '@/lib/telegram/client';
import { buildErrorBurstAlert } from '@/lib/telegram/messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { ok: false, reason: 'cron_disabled', hint: 'CRON_SECRET env yok' },
      { status: 503 },
    );
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  try {
    const bursts = await findActiveBursts(db);
    const panelBase = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/superadmin/errors`
      : undefined;

    let alertsSent = 0;
    for (const b of bursts) {
      const panelUrl = panelBase
        ? `${panelBase}?errorType=${encodeURIComponent(b.errorType)}`
        : undefined;
      try {
        await sendTelegramAlert(
          buildErrorBurstAlert({
            errorType: b.errorType,
            count: b.count,
            windowMinutes: b.windowMinutes,
            firstOccurredAt: b.firstOccurredAt,
            lastSampleMessage: b.lastSampleMessage,
            panelUrl,
          }),
        );
        await markErrorAlerted(db, b.lastSampleId);
        alertsSent++;
      } catch (err) {
        console.error('[cron:errors-threshold-check] alert fail:', err);
      }
    }

    return Response.json(
      {
        ok: true,
        burstsFound: bursts.length,
        alertsSent,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[cron:errors-threshold-check] failed:', err);
    return Response.json(
      { ok: false, reason: 'execution_failed' },
      { status: 500 },
    );
  }
}
