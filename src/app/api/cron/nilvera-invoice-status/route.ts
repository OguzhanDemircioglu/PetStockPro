/**
 * Nilvera fatura durum sorgusu — manuel tanı aracı (zamanlanmış cron DEĞİL,
 * CRON_SECRET pattern'i sadece auth için invoice-reconcile ile paylaşılır).
 *
 * Kesilen (issued) bir e-Arşiv faturanın Nilvera tarafında gerçek durumunu
 * (GİB raporlama, e-posta teslim) sorgular — Send/Model çağrısı UUID döndürse
 * bile asıl işleme (PDF üretimi + e-posta gönderimi) Nilvera'da asenkron olabilir.
 *
 * GET ?uuid=<nilvera_invoice_id>
 */
import { retrieveNilveraInvoice } from '@/lib/nilvera/invoice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ ok: false, reason: 'cron_disabled', hint: 'CRON_SECRET env yok' }, { status: 503 });
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const uuid = url.searchParams.get('uuid');
  if (!uuid) {
    return Response.json({ ok: false, reason: 'uuid_required' }, { status: 400 });
  }

  try {
    const status = await retrieveNilveraInvoice(uuid);
    return Response.json({ ok: true, status }, { status: 200 });
  } catch (err) {
    return Response.json(
      { ok: false, reason: 'lookup_failed', message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
