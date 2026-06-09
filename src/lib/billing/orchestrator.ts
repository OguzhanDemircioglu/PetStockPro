/**
 * Billing Orchestrator — PayTR callback işleyici (Faz 2/3)
 *
 * PayTR callback'ini (ödeme bildirimi) işler. Caller pattern (/api/webhooks/paytr):
 *   1. verifyPaytrCallbackHash(...) → reject if invalid (asla "OK" dönme)
 *   2. processPaytrCallback(input, { db, nilvera }) → outcome
 *   3. "OK" dön (PayTR retry spam önleme) — processing throw ederse non-OK dön (retry istenir)
 *
 * Atomiklik (kritik — "para alındı ama PRO açılmadı" önlemi):
 *   - processed_webhooks insert + subscription/company/invoice yazımı TEK transaction'da.
 *   - Hata → rollback (webhook kaydı da geri alınır) → PayTR retry'ı TEMİZ reprocess eder.
 *   - Duplicate (event_id 23505) → tx abort → 'duplicate' outcome (idempotent).
 *   - Nilvera (dış ağ) transaction DIŞINDA, best-effort: hata → invoice 'pending' kalır.
 *
 * Akış:
 *   - Subscription lookup: pending_merchant_oid → tenant
 *   - Tutar doğrulama: total_amount (kuruş) == plan tutarı (manipülasyon koruması)
 *   - success: ilk ödeme (incomplete) → active + kart token + company.plan + invoice
 *              yenileme (active/past_due) → period +1 ay + invoice + retry sıfırla
 *   - failed:  ilk ödeme → incomplete bırak; yenileme → past_due + dunning
 */

import { eq, and } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/log';
import { createNilveraInvoice } from '@/lib/nilvera/invoice';
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
  card?: { utoken?: string; ctoken?: string; masked?: string; brand?: string };
  /** processed_webhooks.payload için tam ham gövde (debug). */
  rawPayload?: Record<string, unknown>;
}

export type PaytrCallbackOutcome =
  | 'duplicate'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'subscription_not_found'
  | 'company_user_missing'
  | 'amount_mismatch';

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
  nilvera?: { createInvoice: typeof createNilveraInvoice };
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

/** Transaction içinden dönen sonuç + (varsa) post-tx Nilvera bağlamı. */
interface TxOutcome {
  result: PaytrCallbackResult;
  nilveraCtx?: { invoiceId: string; companyId: string; plan: 'FREE' | 'PRO' | 'PRO_PLUS'; totals: InvoiceTotals };
}

// Drizzle transaction callback'ine geçen client (db ile aynı arayüz).
type Tx = Parameters<Parameters<DbClient['transaction']>[0]>[0];

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

export async function processPaytrCallback(
  input: PaytrCallbackInput,
  deps: OrchestratorDeps,
): Promise<PaytrCallbackResult> {
  const now = deps.now?.() ?? new Date();

  let txOut: TxOutcome;
  try {
    txOut = await deps.db.transaction((tx) => processInTransaction(input, tx as unknown as Tx, now));
  } catch (err) {
    if (isUniqueViolation(err)) {
      // event_id zaten kayıtlı → ya gerçek duplicate ya da önceki başarılı işlem.
      return { outcome: 'duplicate', merchantOid: input.merchantOid };
    }
    throw err; // gerçek hata → route non-OK döner → PayTR retry → temiz reprocess
  }

  // Post-tx: Nilvera best-effort (yalnız başarılı ödeme + nilvera dep varsa)
  if (txOut.nilveraCtx && deps.nilvera?.createInvoice) {
    const { nilveraInvoiceId, nilveraError } = await issueAndRecordNilvera(deps, txOut.nilveraCtx, now);
    return { ...txOut.result, nilveraInvoiceId, nilveraError };
  }
  return txOut.result;
}

// ══════════════════════════════════════════════════════════════
// Transaction gövdesi
// ══════════════════════════════════════════════════════════════

async function processInTransaction(input: PaytrCallbackInput, tx: Tx, now: Date): Promise<TxOutcome> {
  // 1. Idempotency — duplicate ise 23505 fırlatır, tx abort olur, caller 'duplicate' döner.
  await tx.insert(processedWebhooks).values({
    eventId: input.merchantOid,
    source: 'paytr',
    eventType: `payment.${input.status}`,
    payload: (input.rawPayload ?? {}) as Record<string, unknown>,
    processedAt: now,
  });

  // 2. Subscription lookup
  const sub = await findSubscriptionByPendingOid(tx, input.merchantOid);
  if (!sub) {
    return { result: { outcome: 'subscription_not_found', merchantOid: input.merchantOid } };
  }

  // 3. Audit author
  const ownerUserId = await findCompanyOwner(tx, sub.companyId);
  if (!ownerUserId) {
    return { result: { outcome: 'company_user_missing', merchantOid: input.merchantOid, subscriptionId: sub.id } };
  }

  // 4. Dispatch
  if (input.status === 'failed') {
    return { result: await applyFailure(input, sub, ownerUserId, tx, now) };
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
      tx,
      now,
    );
    return { result: { outcome: 'amount_mismatch', merchantOid: input.merchantOid, subscriptionId: sub.id } };
  }

  return applySuccess(input, sub, ownerUserId, tx, now);
}

// ── DB reads ───────────────────────────────────────────────────

async function findSubscriptionByPendingOid(tx: Tx, merchantOid: string): Promise<SubscriptionRow | null> {
  const rows = await tx
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

async function findCompanyOwner(tx: Tx, companyId: string): Promise<string | null> {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, 'BAYI_SAHIBI')))
    .limit(1);
  return rows[0]?.id ?? null;
}

// ── Success (tx içi) ───────────────────────────────────────────

async function applySuccess(
  input: PaytrCallbackInput,
  sub: SubscriptionRow,
  ownerUserId: string,
  tx: Tx,
  now: Date,
): Promise<TxOutcome> {
  const isFirstPayment = sub.status === 'incomplete';
  const newPeriodStart = isFirstPayment ? now : sub.currentPeriodEnd;
  const newPeriodEnd = addMonths(newPeriodStart, 1);

  await tx
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

  await tx.update(companies).set({ plan: sub.plan, updatedAt: now }).where(eq(companies.id, sub.companyId));

  const totals = computeInvoiceTotals(sub.amountTry);
  const invRows = await tx
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
  const invoiceId = invRows[0]?.id as string;

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
        invoiceId,
        merchantOid: input.merchantOid,
      },
    },
    tx,
    now,
  );

  return {
    result: { outcome: 'payment_succeeded', merchantOid: input.merchantOid, subscriptionId: sub.id, invoiceId },
    nilveraCtx: { invoiceId, companyId: sub.companyId, plan: sub.plan, totals },
  };
}

// ── Failure (tx içi) ───────────────────────────────────────────

async function applyFailure(
  input: PaytrCallbackInput,
  sub: SubscriptionRow,
  ownerUserId: string,
  tx: Tx,
  now: Date,
): Promise<PaytrCallbackResult> {
  const isFirstPayment = sub.status === 'incomplete';

  if (isFirstPayment) {
    await tx
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
      tx,
      now,
    );
    return { outcome: 'payment_failed', merchantOid: input.merchantOid, subscriptionId: sub.id };
  }

  // Yenileme başarısız → past_due + dunning
  const newRetryCount = sub.paymentRetryCount + 1;
  const nextRetryAt =
    newRetryCount <= RETRY_SCHEDULE_DAYS.length
      ? new Date(now.getTime() + RETRY_SCHEDULE_DAYS[newRetryCount - 1] * DAY_MS)
      : null;

  await tx
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
    tx,
    now,
  );

  return { outcome: 'payment_failed', merchantOid: input.merchantOid, subscriptionId: sub.id };
}

// ── Nilvera (post-tx, best-effort) ─────────────────────────────

async function issueAndRecordNilvera(
  deps: OrchestratorDeps,
  ctx: { invoiceId: string; companyId: string; plan: 'FREE' | 'PRO' | 'PRO_PLUS'; totals: InvoiceTotals },
  now: Date,
): Promise<{ nilveraInvoiceId?: string; nilveraError?: string }> {
  try {
    const compRows = await deps.db
      .select({ name: companies.name, vatNo: companies.vatNo })
      .from(companies)
      .where(eq(companies.id, ctx.companyId))
      .limit(1);
    const company = compRows[0];
    if (!company?.vatNo) {
      throw new Error(`Şirket VKN eksik (companyId=${ctx.companyId}) — Nilvera fatura atlandı`);
    }

    const resp = await deps.nilvera!.createInvoice({
      externalRef: ctx.invoiceId,
      invoiceDate: now.toISOString(),
      customer: { taxNumber: company.vatNo, title: company.name, address: '—', city: '—' },
      lines: [
        { name: `PetStockPro ${ctx.plan} planı (aylık abonelik)`, quantity: 1, unitPrice: ctx.totals.matrah, vatRate: 20 },
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
        updatedAt: now,
      })
      .where(eq(invoices.id, ctx.invoiceId));

    return { nilveraInvoiceId: resp.invoiceId };
  } catch (err) {
    // Invoice 'pending' kalır — background retry için işaret. Akış bozulmaz.
    return { nilveraError: err instanceof Error ? err.message : String(err) };
  }
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
