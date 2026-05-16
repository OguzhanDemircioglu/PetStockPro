/**
 * Günlük vitrin şikayet özeti cron endpoint — Sprint 12 ext.
 *
 * Workers cron veya pg_cron tarafından günlük 09:00 TR (06:00 UTC) çağrılır.
 * Bearer auth: env CRON_SECRET ile match. Production'da bu secret Workers
 * cron binding'inde set edilir.
 *
 * Manuel test (dev):
 *   curl -X POST http://localhost:3000/api/cron/daily-summary \
 *     -H "Authorization: Bearer dev-cron-secret"
 *
 * .env: CRON_SECRET=dev-cron-secret (yoksa 503 disabled)
 */

import { db } from '@/lib/db/client';
import { buildDailyReportSummary } from '@/lib/vitrin/summary';
import { buildDailyReportSummaryAlert } from '@/lib/telegram/messages';
import { sendTelegramAlert } from '@/lib/telegram/client';

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
    return Response.json(
      { ok: false, reason: 'unauthorized' },
      { status: 401 },
    );
  }

  try {
    const summary = await buildDailyReportSummary(db, 24);
    const alert = buildDailyReportSummaryAlert({
      ...summary,
      panelUrl: '/admin/superadmin/vitrin-moderation?tab=reports',
    });
    const result = await sendTelegramAlert(alert);
    return Response.json(
      {
        ok: true,
        summary: {
          total: summary.totalReports,
          pending: summary.pendingCount,
          resolved: summary.resolvedCount,
          dismissed: summary.dismissedCount,
          topCount: summary.topTenants.length,
        },
        alertResult: result,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[cron:daily-summary] failed:', err);
    return Response.json(
      { ok: false, reason: 'execution_failed' },
      { status: 500 },
    );
  }
}
