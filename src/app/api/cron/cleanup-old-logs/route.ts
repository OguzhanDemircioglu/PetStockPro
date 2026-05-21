/**
 * Log retention cleanup cron endpoint — PLAN-BETA-PERFORMANCE FAZ 2.A.
 *
 * Cloudflare Workers cron `0 4 * * *` (04:00 UTC / 07:00 TR) tetikler.
 *
 * Akış:
 *   1. Bearer auth (CRON_SECRET env match)
 *   2. runRetentionCleanup(db) — 6 tablo için DELETE WHERE created_at < cutoff
 *   3. Telegram summary alert (info / critical) — fire-and-forget
 *   4. JSON response (rules + totalDeleted + executionMs)
 *
 * Manuel test (dev):
 *   curl -X POST http://localhost:3000/api/cron/cleanup-old-logs \
 *     -H "Authorization: Bearer dev-cron-secret-local"
 */
import { db } from '@/lib/db/client';
import { runRetentionCleanup } from '@/lib/cleanup/retention';
import { sendTelegramAlert } from '@/lib/telegram/client';
import { buildRetentionCleanupSummary } from '@/lib/telegram/messages';

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
    const report = await runRetentionCleanup(db);
    const panelUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/superadmin/system-settings`
      : undefined;
    void sendTelegramAlert(
      buildRetentionCleanupSummary({
        triggeredAt: report.startedAt,
        totalDeleted: report.totalDeleted,
        totalDurationMs: report.totalDurationMs,
        rules: report.rules.map((r) => ({
          table: r.table,
          ageDays: r.ageDays,
          deletedCount: r.deletedCount,
          error: r.error,
        })),
        panelUrl,
      }),
    ).catch(() => {
      // Telegram fail cron başarısını gölgelemesin.
    });
    return Response.json(
      {
        ok: true,
        startedAt: report.startedAt,
        finishedAt: report.finishedAt,
        totalDeleted: report.totalDeleted,
        totalDurationMs: report.totalDurationMs,
        hasErrors: report.hasErrors,
        rules: report.rules,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[cron:cleanup-old-logs] failed:', err);
    return Response.json(
      { ok: false, reason: 'execution_failed' },
      { status: 500 },
    );
  }
}
