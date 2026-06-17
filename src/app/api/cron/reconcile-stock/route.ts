/**
 * Stok bütünlüğü reconcile cron — Faz 3 (PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE §FAZ 3).
 *
 * Gece master cron (run-all) tarafından çağrılır. Ledger ↔ cache (branch_inventory +
 * products.totalStockQty) uyumunu kontrol eder. Sapma bulunursa:
 *   1. system_errors'a critical kayıt (süperadmin /admin/superadmin/errors görür)
 *   2. Telegram critical alert (best-effort)
 * AUTO-REPAIR YOK — sapma bir bug sinyali, maskeleme; süperadmin inceler.
 *
 * Bearer auth CRON_SECRET.
 */
import { db } from '@/lib/db/client';
import { reconcileStock } from '@/lib/stock/reconcile';
import { sendTelegramAlert } from '@/lib/telegram/client';
import { buildStockDriftAlert } from '@/lib/telegram/messages';
import { trackError } from '@/lib/errors/track';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel Cron GET gönderir → aynı POST iş mantığı (CRON_SECRET auth aynı).
export const GET = (req: Request) => POST(req);

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { ok: false, reason: 'cron_disabled', hint: 'CRON_SECRET env yok' },
      { status: 503 },
    );
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await reconcileStock(db);

    if (!result.ok) {
      const triggeredAt = new Date().toISOString();

      // 1) system_errors — süperadmin paneli + burst threshold ile görünür
      await trackError(
        new Error(
          `Stok reconcile sapması: ${result.stockDriftCount} ledger satırı + ${result.counterDriftCount} sayaç ürünü`,
        ),
        {
          action: 'reconcile-stock',
          metadata: {
            stockDriftCount: result.stockDriftCount,
            counterDriftCount: result.counterDriftCount,
          },
        },
        db,
        { severity: 'critical', errorTypeOverride: 'StockReconcileDrift' },
      );

      // 2) Telegram critical alert (best-effort — fail cron'u bozmaz)
      try {
        const panelUrl = process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/superadmin`
          : undefined;
        await sendTelegramAlert(
          buildStockDriftAlert({
            stockDriftCount: result.stockDriftCount,
            counterDriftCount: result.counterDriftCount,
            stockDriftSample: result.stockDriftSample,
            triggeredAt,
            panelUrl,
          }),
        );
      } catch (err) {
        console.error('[cron:reconcile-stock] alert fail:', err);
      }
    }

    return Response.json(
      {
        ok: true,
        drift: !result.ok,
        stockDriftCount: result.stockDriftCount,
        counterDriftCount: result.counterDriftCount,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[cron:reconcile-stock] failed:', err);
    return Response.json({ ok: false, reason: 'execution_failed' }, { status: 500 });
  }
}
