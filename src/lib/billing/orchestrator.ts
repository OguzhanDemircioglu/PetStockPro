/**
 * Billing Orchestrator — PayTR callback işleyici (Faz 2/3)
 *
 * PayTR callback'ini (ödeme bildirimi) işler. Caller pattern (/api/webhooks/paytr):
 *   1. verifyPaytrCallbackHash(...) → reject if invalid (asla "OK" dönme)
 *   2. processPaytrCallback(input, { db }) → outcome
 *   3. her durumda "OK" dön (PayTR retry spam önleme)
 *
 * Akış:
 *   - Idempotency: processed_webhooks.event_id = merchant_oid (PK çakışması = skip)
 *   - Subscription lookup: pending_merchant_oid → tenant
 *   - Tutar doğrulama: total_amount (kuruş) == plan tutarı (manipülasyon koruması)
 *   - status=success:
 *       ilk ödeme (incomplete) → active + kart token sakla + company.plan + invoice + Nilvera
 *       yenileme (active/past_due) → period +1 ay + invoice + Nilvera + retry sıfırla
 *   - status=failed:
 *       ilk ödeme → incomplete bırak (checkout tamamlanmadı)
 *       yenileme → past_due + dunning (retry sayacı + nextRetryAt)
 *
 * Nilvera best-effort: hata → invoice 'pending' kalır (background retry). Orchestration
 * yine başarı döner. DB yazımı caller transaction'ı dışında (Nilvera external network).
 */

import { eq, and } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/log';
import { createNilveraInvoice } from '@/lib/nilvera/invoice';
import type { NilveraInvoiceResponse } from '@/lib/nilvera/types';
import { processedWebhooks, subscriptions, invoices, companies, users } from '@/db/schema';
import { addMonths, computeInvoiceTotals, type InvoiceTotals } from './totals';

// ══════════════════════════════════════════════════════════════
// Dunning konfigürasyonu
// ══════════════════════════════════════════════════════════════

/** Yenileme başarısız olunca tekrar deneme aralıkları (gün). 1. fail → +1g, 2. → +3g, 3. → +5g. */
export const RETRY_SCHEDULE_DAYS = [1, 3, 5] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export interface PaytrCallbackInput {
  merchantOid: string;
  status: 'success' | 'failed';
  /** PayTR'ın gönderdiği total_amount — kuruş (×100) string. */
  totalAmount: string;
  paymentType?: string;
  failedReason?: string;
  /** İlk ödemede saklanan kart bilgileri (callback'ten normalize edilir). */
  card?: {
    utoken?: string;
    ctoken?: string;
    masked?: string;
    brand?: string;
  };
  /** processed_webhooks.payload için tam ham gövde (debug). */
  rawPayload?: Record<string, unknown>;
}

export type PaytrCallbackOutcome =
  | 'duplicate' // event zaten işlenmiş
  | 'payment_succeeded'
  | 'payment_failed'
  | 'subscription_not_found' // pending_merchant_oid eşleşmedi
  | 'company_user_missing' // BAYI_SAHIBI yok (data tutarsız)
  | 'amount_mismatch'; // total_amount plan tutarıyla uyuşmadı (manipülasyon)

export interface PaytrCallbackResult {
  outcome: PaytrCallbackOutcome;
  merchantOid: string;
  subscriptionId?: string;
  invoiceId?: string;
  nilveraInvoiceId?: string;
  nilveraError?: string;
}

export interface OrchestratorDeps {
  db: DbClient;
  /** Nilvera invoice helper — testlerde mock geçirilebilir; yoksa fatura atlanır. */
  nilvera?: { createInvoice: typeof createNilveraInvoice };
  /** Zaman injection (testlerde deterministic). */
  now?: () => Date;
}

interface SubscriptionRow {
  id: string;
  companyId: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  amountTry: string;
  paymentRetryCount: number;
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

export async function processPaytrCallback(
  input: PaytrCallbackInput,
  deps: OrchestratorDeps,
): Promise<PaytrCallbackResult> {
  const db = deps.db;
  const now = deps.now?.() ?? new Date();

  // 1. Idempotency
  const persisted = await persistWebhook(db, input, now);
  if (!persisted) {
    return { outcome: 'duplicate', merchantOid: input.merchantOid };
  }

  // 2. Subscription lookup (pending_merchant_oid)
  const sub = await findSubscriptionByPendingOid(db, input.merchantOid);
  if (!sub) {
    return { outcome: 'subscription_not_found', merchantOid: input.merchantOid };
  }

  // 3. Audit author (BAYI_SAHIBI)
  const ownerUserId = await findCompanyOwner(db, sub.companyId);
  if (!ownerUserId) {
    return { outcome: 'company_user_missing', merchantOid: input.merchantOid, subscriptionId: sub.id };
  }

  // 4. Dispatch
  if (input.status === 'failed') {
    return handleFailure(input, sub, ownerUserId, deps, now);
  }

  // success → tutar doğrula (manipülasyon koruması)
  const expectedKurus = Math.round(Number(sub.amountTry) * 100);
  if (!Number.isFinite(Number(input.totalAmount)) || Number(input.totalAmount) !== expectedKurus) {
    await writeAuditLog(
      {
        companyId: sub.companyId,
        userId: ownerUserId,
        action: 'subscription.amount_mismatch',
        entityType: 'subscription',
        entityId: sub.id,
        afterState: { expectedKurus, gotKurus: input.totalAmount, merchantOid: input.merchantOid },
      },
      db,
      now,
    );
    return { outcome: 'amount_mismatch', merchantOid: input.merchantOid, subscriptionId: sub.id };
  }

  return handleSuccess(input, sub, ownerUserId, deps, now);
}

// ══════════════════════════════════════════════════════════════
// Step helpers (internal)
// ══════════════════════════════════════════════════════════════

async function persistWebhook(
  db: DbClient,
  input: PaytrCallbackInput,
  now: Date,
): Promise<boolean> {
  try {
    await db.insert(processedWebhooks).values({
      eventId: input.merchantOid,
      source: 'paytr',
      eventType: `payment.${input.status}`,
      payload: (input.rawPayload ?? {}) as Record<string, unknown>,
      processedAt: now,
    });
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

async function findSubscriptionByPendingOid(
  db: DbClient,
  merchantOid: string,
): Promise<SubscriptionRow | null> {
  const rows = await db
    .select({
      id: subscriptions.id,
      companyId: subscriptions.companyId,
      plan: subscriptions.plan,
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      amountTry: subscriptions.amountTry,
      paymentRetryCount: subscriptions.paymentRetryCount,
    })
    .from(subscriptions)
    .where(eq(subscriptions.pendingMerchantOid, merchantOid))
    .limit(1);
  return (rows[0] as SubscriptionRow) ?? null;
}

async function findCompanyOwner(db: DbClient, companyId: string): Promise<string | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, 'BAYI_SAHIBI')))
    .limit(1);
  return rows[0]?.id ?? null;
}

// ── Success ────────────────────────────────────────────────────

async function handleSuccess(
  input: PaytrCallbackInput,
  sub: SubscriptionRow,
  ownerUserId: string,
  deps: OrchestratorDeps,
  now: Date,
): Promise<PaytrCallbackResult> {
  const db = deps.db;
  const isFirstPayment = sub.status === 'incomplete';
  const newPeriodStart = isFirstPayment ? now : sub.currentPeriodEnd;
  const newPeriodEnd = addMonths(newPeriodStart, 1);

  await db
    .update(subscriptions)
    .set({
      status: 'active',
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      pendingMerchantOid: null,
      paymentRetryCount: 0,
      nextRetryAt: null,
      ...(input.card?.utoken ? { paytrUtoken: input.card.utoken } : {}),
      ...(input.card?.ctoken ? { paytrCtoken: input.card.ctoken } : {}),
      ...(input.card?.masked ? { paytrCardMasked: input.card.masked } : {}),
      ...(input.card?.brand ? { paytrCardBrand: input.card.brand } : {}),
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));

  // company.plan = abonelik planı (ilk ödemede FREE → PRO/PRO_PLUS)
  await db.update(companies).set({ plan: sub.plan, updatedAt: now }).where(eq(companies.id, sub.companyId));

  // Invoice (pending → Nilvera onayı sonrası issued)
  const totals = computeInvoiceTotals(sub.amountTry);
  const invRows = await db
    .insert(invoices)
    .values({
      companyId: sub.companyId,
      subscriptionId: sub.id,
      periodStart: newPeriodStart,
      periodEnd: newPeriodEnd,
      amountMatrah: totals.matrah.toFixed(2),
      vatAmount: totals.vat.toFixed(2),
      amountTotal: totals.total.toFixed(2),
      merchantOid: input.merchantOid,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: invoices.id });
  const invoiceId = invRows[0]?.id;

  // Nilvera best-effort
  let nilveraInvoiceId: string | undefined;
  let nilveraError: string | undefined;
  if (deps.nilvera?.createInvoice && invoiceId) {
    try {
      const resp = await issueNilveraInvoice({ deps, companyId: sub.companyId, plan: sub.plan, totals, invoiceId, now });
      if (resp) {
        nilveraInvoiceId = resp.invoiceId;
        await db
          .update(invoices)
          .set({
            nilveraInvoiceId: resp.invoiceId,
            nilveraInvoiceNumber: resp.invoiceNumber ?? null,
            pdfUrl: resp.pdfUrl ?? null,
            status: 'issued',
            issuedAt: now,
            updatedAt: now,
          })
          .where(eq(invoices.id, invoiceId));
      }
    } catch (err) {
      nilveraError = err instanceof Error ? err.message : String(err);
    }
  }

  await writeAuditLog(
    {
      companyId: sub.companyId,
      userId: ownerUserId,
      action: isFirstPayment ? 'subscription.payment_succeeded' : 'subscription.renewed',
      entityType: 'subscription',
      entityId: sub.id,
      afterState: {
        plan: sub.plan,
        periodStart: newPeriodStart.toISOString(),
        periodEnd: newPeriodEnd.toISOString(),
        amountTotal: totals.total,
        invoiceId: invoiceId ?? null,
        nilveraInvoiceId: nilveraInvoiceId ?? null,
        nilveraError: nilveraError ?? null,
        merchantOid: input.merchantOid,
      },
    },
    db,
    now,
  );

  return {
    outcome: 'payment_succeeded',
    merchantOid: input.merchantOid,
    subscriptionId: sub.id,
    invoiceId,
    nilveraInvoiceId,
    nilveraError,
  };
}

// ── Failure ────────────────────────────────────────────────────

async function handleFailure(
  input: PaytrCallbackInput,
  sub: SubscriptionRow,
  ownerUserId: string,
  deps: OrchestratorDeps,
  now: Date,
): Promise<PaytrCallbackResult> {
  const db = deps.db;
  const isFirstPayment = sub.status === 'incomplete';

  if (isFirstPayment) {
    // Checkout tamamlanmadı — incomplete bırak, pending oid temizle.
    await db
      .update(subscriptions)
      .set({ pendingMerchantOid: null, updatedAt: now })
      .where(eq(subscriptions.id, sub.id));

    await writeAuditLog(
      {
        companyId: sub.companyId,
        userId: ownerUserId,
        action: 'subscription.checkout_failed',
        entityType: 'subscription',
        entityId: sub.id,
        afterState: { reason: input.failedReason ?? null, merchantOid: input.merchantOid },
      },
      db,
      now,
    );
    return { outcome: 'payment_failed', merchantOid: input.merchantOid, subscriptionId: sub.id };
  }

  // Yenileme başarısız → past_due + dunning
  const newRetryCount = sub.paymentRetryCount + 1;
  const nextRetryAt =
    newRetryCount <= RETRY_SCHEDULE_DAYS.length
      ? new Date(now.getTime() + RETRY_SCHEDULE_DAYS[newRetryCount - 1] * DAY_MS)
      : null; // retry tükendi → cron (Faz 3) expire eder

  await db
    .update(subscriptions)
    .set({
      status: 'past_due',
      paymentRetryCount: newRetryCount,
      nextRetryAt,
      pendingMerchantOid: null,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));

  await writeAuditLog(
    {
      companyId: sub.companyId,
      userId: ownerUserId,
      action: 'subscription.payment_failed',
      entityType: 'subscription',
      entityId: sub.id,
      afterState: {
        status: 'past_due',
        retryCount: newRetryCount,
        nextRetryAt: nextRetryAt?.toISOString() ?? null,
        reason: input.failedReason ?? null,
      },
    },
    db,
    now,
  );

  return { outcome: 'payment_failed', merchantOid: input.merchantOid, subscriptionId: sub.id };
}

// ── Nilvera helper ─────────────────────────────────────────────

async function issueNilveraInvoice(params: {
  deps: OrchestratorDeps;
  companyId: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  totals: InvoiceTotals;
  invoiceId: string;
  now: Date;
}): Promise<NilveraInvoiceResponse | null> {
  const { deps, companyId, plan, totals, invoiceId, now } = params;
  if (!deps.nilvera) return null;

  const compRows = await deps.db
    .select({ name: companies.name, vatNo: companies.vatNo })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const company = compRows[0];

  // VKN yoksa fatura kesilemez → invoice 'pending' kalsın (caller catch eder).
  if (!company?.vatNo) {
    throw new Error(`Şirket VKN eksik (companyId=${companyId}) — Nilvera fatura atlandı`);
  }

  return await deps.nilvera.createInvoice({
    externalRef: invoiceId,
    invoiceDate: now.toISOString(),
    customer: { taxNumber: company.vatNo, title: company.name, address: '—', city: '—' },
    lines: [
      { name: `PetStockPro ${plan} planı (aylık abonelik)`, quantity: 1, unitPrice: totals.matrah, vatRate: 20 },
    ],
    currency: 'TRY',
  });
}

// ══════════════════════════════════════════════════════════════
// Utils
// ══════════════════════════════════════════════════════════════

/** Postgres unique violation = SQLSTATE 23505. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}
