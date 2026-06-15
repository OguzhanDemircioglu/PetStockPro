/**
 * Fatura Mutabakatı (invoice-reconcile cron) — C2
 *
 * Sorun: ödeme alınır (orchestrator success), ama Nilvera e-Arşiv best-effort
 * çağrısı başarısız olursa invoice `status='pending'` kalır → para alındı,
 * yasal fatura HİÇ kesilmez, kimse fark etmez.
 *
 * Çözüm: günlük cron `status='pending'` + yeterince eski faturaları bulur,
 * Nilvera'ya yeniden gönderir (createNilveraInvoice externalRef=invoice.id ile
 * idempotent → çift fatura olmaz). Her başarısızlıkta nilvera_retry_count++ +
 * last_nilvera_error. MAX denemeye ulaşınca süperadmin'e kritik alert.
 *
 * Bağımlılıklar (nilvera) inject edilebilir → kolay test.
 */

import { and, eq, lt } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { invoices, companies, subscriptions } from '@/db/schema';
import { createNilveraInvoice } from '@/lib/nilvera/invoice';
import { SUBSCRIPTION_VAT_RATE } from './totals';
import { alertInvoiceFailed } from './alerts';

/** Bu kadar denemeden sonra otomatik retry durur + süperadmin alert. */
export const INVOICE_RECONCILE_MAX_RETRIES = 5;
/** Yeni kesilen faturayı (orchestrator best-effort henüz dönmemiş olabilir) yakalamamak için min yaş. */
const RECONCILE_MIN_AGE_MS = 10 * 60 * 1000; // 10 dk

export interface InvoiceReconcileDeps {
  db: DbClient;
  nilvera?: { createInvoice: typeof createNilveraInvoice };
  now?: () => Date;
}

export interface InvoiceReconcileSummary {
  /** İncelenen pending fatura sayısı. */
  pending: number;
  /** Bu turda başarıyla kesilen. */
  issued: number;
  /** Bu turda hâlâ başarısız (retry < max). */
  failed: number;
  /** VKN eksik vb. nedeniyle kesilmeyen. */
  skipped: number;
  /** MAX retry'a ulaşıp süperadmin'e alert atılan. */
  alerted: number;
}

export async function runInvoiceReconcile(
  deps: InvoiceReconcileDeps,
): Promise<InvoiceReconcileSummary> {
  const now = deps.now?.() ?? new Date();
  const summary: InvoiceReconcileSummary = { pending: 0, issued: 0, failed: 0, skipped: 0, alerted: 0 };

  // Nilvera yapılandırılmamışsa hiçbir şey yapma (faturalar pending bekler).
  if (!deps.nilvera?.createInvoice) return summary;

  const cutoff = new Date(now.getTime() - RECONCILE_MIN_AGE_MS);

  const rows = await deps.db
    .select({
      id: invoices.id,
      companyId: invoices.companyId,
      amountMatrah: invoices.amountMatrah,
      retryCount: invoices.nilveraRetryCount,
      plan: subscriptions.plan,
      vatNo: companies.vatNo,
      companyName: companies.name,
    })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .innerJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
    .where(
      and(
        eq(invoices.status, 'pending'),
        lt(invoices.createdAt, cutoff),
        lt(invoices.nilveraRetryCount, INVOICE_RECONCILE_MAX_RETRIES),
      ),
    );

  summary.pending = rows.length;

  for (const inv of rows) {
    const newCount = inv.retryCount + 1;

    // VKN yoksa Nilvera kesilemez — sayaç artar, max'ta alert.
    if (!inv.vatNo) {
      await deps.db
        .update(invoices)
        .set({ nilveraRetryCount: newCount, lastNilveraError: 'company VKN/TCKN eksik', updatedAt: now })
        .where(eq(invoices.id, inv.id));
      summary.skipped++;
      if (newCount >= INVOICE_RECONCILE_MAX_RETRIES) {
        alertInvoiceFailed({ invoiceId: inv.id, companyId: inv.companyId, retryCount: newCount, error: 'company VKN/TCKN eksik' });
        summary.alerted++;
      }
      continue;
    }

    try {
      const resp = await deps.nilvera.createInvoice({
        externalRef: inv.id, // idempotent — aynı invoice.id ile çift fatura olmaz
        invoiceDate: now.toISOString(),
        customer: { taxNumber: inv.vatNo, title: inv.companyName, address: '—', city: '—' },
        lines: [
          {
            name: `PetStockPro ${inv.plan} planı (aylık abonelik)`,
            quantity: 1,
            unitPrice: Number(inv.amountMatrah),
            vatRate: SUBSCRIPTION_VAT_RATE,
          },
        ],
        currency: 'TRY',
      });

      await deps.db
        .update(invoices)
        .set({
          nilveraInvoiceId: resp.invoiceId,
          nilveraInvoiceNumber: resp.invoiceNumber ?? null,
          pdfUrl: resp.pdfUrl ?? null,
          status: 'issued',
          issuedAt: now,
          lastNilveraError: null, // başarıda eski hata kalıntısını temizle
          updatedAt: now,
        })
        .where(eq(invoices.id, inv.id));
      summary.issued++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await deps.db
        .update(invoices)
        .set({ nilveraRetryCount: newCount, lastNilveraError: msg.slice(0, 500), updatedAt: now })
        .where(eq(invoices.id, inv.id));
      summary.failed++;
      if (newCount >= INVOICE_RECONCILE_MAX_RETRIES) {
        alertInvoiceFailed({ invoiceId: inv.id, companyId: inv.companyId, retryCount: newCount, error: msg });
        summary.alerted++;
      }
    }
  }

  return summary;
}
