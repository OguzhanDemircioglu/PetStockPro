/**
 * Billing view helpers — abonelik durumu + fatura geçmişi (UI için read-only).
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import type { TenantDb } from '@/lib/db/with-tenant';
import { subscriptions, invoices } from '@/db/schema';

export interface BillingSubscription {
  id: string;
  status: string; // active | past_due | incomplete | cancelled | expired
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  /** Dönem sonunda geçilecek plan (H2). NULL = bekleyen değişiklik yok. */
  pendingPlan: 'FREE' | 'PRO' | 'PRO_PLUS' | null;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cardMasked: string | null;
  cardBrand: string | null;
  paymentRetryCount: number;
}

/**
 * Tenant'ın yürürlükteki aboneliği (active / past_due / incomplete).
 * Yoksa null (FREE).
 */
export async function getCurrentSubscription(
  companyId: string,
  db: TenantDb,
): Promise<BillingSubscription | null> {
  const rows = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      plan: subscriptions.plan,
      pendingPlan: subscriptions.pendingPlan,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      cardMasked: subscriptions.paytrCardMasked,
      cardBrand: subscriptions.paytrCardBrand,
      paymentRetryCount: subscriptions.paymentRetryCount,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.companyId, companyId),
        inArray(subscriptions.status, ['active', 'past_due', 'incomplete']),
      ),
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return (rows[0] as BillingSubscription) ?? null;
}

export interface BillingInvoice {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  amountTotal: string;
  status: string;
  pdfUrl: string | null;
  nilveraInvoiceNumber: string | null;
  createdAt: Date;
}

/** Tenant fatura geçmişi (yeni → eski). */
export async function listInvoices(
  companyId: string,
  db: TenantDb,
  limit = 24,
): Promise<BillingInvoice[]> {
  return db
    .select({
      id: invoices.id,
      periodStart: invoices.periodStart,
      periodEnd: invoices.periodEnd,
      amountTotal: invoices.amountTotal,
      status: invoices.status,
      pdfUrl: invoices.pdfUrl,
      nilveraInvoiceNumber: invoices.nilveraInvoiceNumber,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(eq(invoices.companyId, companyId))
    .orderBy(desc(invoices.createdAt))
    .limit(limit);
}
