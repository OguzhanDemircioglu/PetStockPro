/**
 * Abonelik yenileme cron — PayTR recurring (Faz 3).
 *
 * Cloudflare Workers cron tetikler (günlük). Akış:
 *   1. Bearer auth (CRON_SECRET)
 *   2. runBillingRenewals(db): süresi dolanları FREE'ye düşür + dönem biten/past_due
 *      abonelikleri saklı kartla otomatik çek (dunning dahil)
 *   3. JSON özet (due / renewed / failed / waitCallback / expired / errors)
 *
 * Manuel test (dev):
 *   curl -X POST http://localhost:3000/api/cron/billing-renew \
 *     -H "Authorization: Bearer dev-cron-secret-local"
 */
import { db } from '@/lib/db/client';
import { runBillingRenewals } from '@/lib/billing/renewals';
import { createNilveraInvoice } from '@/lib/nilvera/invoice';
import { isNilveraConfigured } from '@/lib/nilvera/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const summary = await runBillingRenewals({
      db,
      nilvera: isNilveraConfigured() ? { createInvoice: createNilveraInvoice } : undefined,
    });
    return Response.json({ ok: true, ...summary }, { status: 200 });
  } catch (err) {
    console.error('[cron:billing-renew] failed:', err);
    return Response.json({ ok: false, reason: 'execution_failed' }, { status: 500 });
  }
}
