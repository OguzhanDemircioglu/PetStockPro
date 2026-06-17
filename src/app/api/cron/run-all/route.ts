/**
 * Master Cron — tüm günlük cron job'larını tek çağrıda çalıştırır (Vercel Hobby/Free).
 *
 * Neden: Vercel Hobby planı en fazla 2 cron + günde 1 tetikleme destekler.
 * 6 ayrı cron yerine bu tek endpoint hepsini paralel çalıştırır → vercel.json'da 1 cron.
 * (Pro plana geçilirse vercel.json'da 6 ayrı cron'a bölünebilir; route'lar zaten ayrı.)
 *
 * Auth: CRON_SECRET Bearer (Vercel cron otomatik ekler). GET + POST ikisi de.
 */
import { POST as sitemapRebuild } from '../sitemap-rebuild/route';
import { POST as errorsThreshold } from '../errors-threshold-check/route';
import { POST as cleanupLogs } from '../cleanup-old-logs/route';
import { POST as billingRenew } from '../billing-renew/route';
import { POST as invoiceReconcile } from '../invoice-reconcile/route';
import { POST as dailySummary } from '../daily-summary/route';
import { POST as reconcileStock } from '../reconcile-stock/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Hobby üst sınırı — tüm job'lar paralel çalışsın

const JOBS: ReadonlyArray<readonly [string, (req: Request) => Promise<Response>]> = [
  ['billing-renew', billingRenew],
  ['invoice-reconcile', invoiceReconcile],
  ['cleanup-old-logs', cleanupLogs],
  ['errors-threshold-check', errorsThreshold],
  ['daily-summary', dailySummary],
  ['sitemap-rebuild', sitemapRebuild],
  ['reconcile-stock', reconcileStock],
];

async function handler(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ ok: false, reason: 'cron_disabled' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const authHeaders = { authorization: `Bearer ${cronSecret}` };
  const settled = await Promise.allSettled(
    JOBS.map(async ([name, job]) => {
      const res = await job(new Request('http://internal/cron', { method: 'POST', headers: authHeaders }));
      return { job: name, status: res.status };
    }),
  );

  const jobs = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { job: JOBS[i][0], error: r.reason instanceof Error ? r.reason.message : String(r.reason) },
  );

  return Response.json({ ok: true, ranAt: new Date().toISOString(), jobs }, { status: 200 });
}

export const GET = handler;
export const POST = handler;
