/**
 * Fatura mutabakat cron — C2.
 *
 * Ödeme alınıp Nilvera best-effort başarısız olduğu için `status='pending'` kalan
 * faturaları bulur ve yeniden dener (idempotent). Master cron (run-all) günlük tetikler.
 *
 * Auth: CRON_SECRET Bearer (Vercel cron otomatik ekler). GET + POST ikisi de.
 */
import { db } from '@/lib/db/client';
import { runInvoiceReconcile } from '@/lib/billing/invoice-reconcile';
import { resolveAndIssueInvoice } from '@/lib/nilvera/invoice';
import { isNilveraConfigured } from '@/lib/nilvera/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel Cron GET gönderir → POST iş mantığına yönlendir.
export const GET = (req: Request) => POST(req);

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ ok: false, reason: 'cron_disabled', hint: 'CRON_SECRET env yok' }, { status: 503 });
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runInvoiceReconcile({
      db,
      nilvera: isNilveraConfigured() ? { issueInvoice: resolveAndIssueInvoice } : undefined,
    });
    return Response.json({ ok: true, ...summary }, { status: 200 });
  } catch (err) {
    console.error('[cron:invoice-reconcile] failed:', err);
    return Response.json({ ok: false, reason: 'execution_failed' }, { status: 500 });
  }
}
