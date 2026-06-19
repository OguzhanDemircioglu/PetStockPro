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
import { resolveAndIssueInvoice } from '@/lib/nilvera/invoice';
import { loadInvoiceCustomer } from './invoice-customer';
import { processedWebhooks, subscriptions, invoices, companies, users } from '@/db/schema';
import { addMonths, computeInvoiceTotals, type InvoiceTotals } from './totals';
import { alertPaymentAnomaly, alertDunning, type PaymentAnomalyInput } from './alerts';
import { sendDunningEmail } from './emails';
import { unpublishVitrinOverLimit } from './downgrade-reconcile';
import { PLAN_LIMITS, planVitrinLimit } from '@/lib/constants/plan-limits';

/**
 * Bir abonelik için bu dönem geçerli plan + KDV-dahil tutar (₺).
 * pendingPlan (dönem-sonu değişim) set ise YENİ plan + güncel fiyat geçerli olur (H2),
 * aksi halde abonelik snapshot'ı (amountTry) korunur (grandfather).
 */
export function effectivePlanAndAmount(sub: {
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  pendingPlan: 'FREE' | 'PRO' | 'PRO_PLUS' | null;
  amountTry: string;
}): { plan: 'FREE' | 'PRO' | 'PRO_PLUS'; amountTry: string } {
  if (sub.pendingPlan && sub.pendingPlan !== 'FREE') {
    return { plan: sub.pendingPlan, amountTry: PLAN_LIMITS[sub.pendingPlan].priceMonthlyTry.toFixed(2) };
  }
  return { plan: sub.plan, amountTry: sub.amountTry };
}

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
  nilvera?: { issueInvoice: typeof resolveAndIssueInvoice };
  now?: () => Date;
}

interface SubscriptionRow {
  id: string;
  companyId: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  pendingPlan: 'FREE' | 'PRO' | 'PRO_PLUS' | null;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  amountTry: string;
  paymentRetryCount: number;
}

/** Transaction içinden dönen sonuç + (varsa) post-tx Nilvera bağlamı + post-tx alert. */
interface TxOutcome {
  result: PaytrCallbackResult;
  nilveraCtx?: { invoiceId: string; companyId: string; plan: 'FREE' | 'PRO' | 'PRO_PLUS'; totals: InvoiceTotals };
  /** Tx commit sonrası gönderilecek süperadmin alert (network çağrısı tx DIŞINDA). */
  alert?: PaymentAnomalyInput;
  /** Tx commit sonrası dunning bildirimi (yenileme başarısız) — Telegram + kullanıcı e-postası. */
  dunning?: { companyId: string; subscriptionId: string; retryCount: number; exhausted: boolean };
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

  // Post-tx: anomali alert (network — tx DIŞINDA, fire-and-forget)
  if (txOut.alert) {
    alertPaymentAnomaly(txOut.alert);
  }

  // Post-tx: dunning (yenileme başarısız) → Telegram alert + kullanıcı e-postası
  if (txOut.dunning) {
    await notifyDunning(deps, txOut.dunning);
  }

  // Post-tx: Nilvera best-effort (yalnız başarılı ödeme + nilvera dep varsa)
  if (txOut.nilveraCtx && deps.nilvera?.issueInvoice) {
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
    return {
      result: { outcome: 'subscription_not_found', merchantOid: input.merchantOid },
      alert: { kind: 'subscription_not_found', merchantOid: input.merchantOid },
    };
  }

  // 3. Audit author (opsiyonel). C1: owner null olsa BİLE ödeme uygulanır — "para
  //    alındı, plan açılmadı" durumunu önler. Eksikse post-tx alert ile işaretlenir.
  const ownerUserId = await findCompanyOwner(tx, sub.companyId);
  const ownerMissingAlert: PaymentAnomalyInput | undefined = ownerUserId
    ? undefined
    : { kind: 'owner_missing', merchantOid: input.merchantOid, companyId: sub.companyId, subscriptionId: sub.id };

  // 4. Dispatch
  if (input.status === 'failed') {
    const fail = await applyFailure(input, sub, ownerUserId, tx, now);
    return { result: fail.result, alert: ownerMissingAlert, dunning: fail.dunning };
  }

  // success → tutar doğrula (manipülasyon koruması). Uyuşmazsa plan AÇILMAZ + alert.
  // pendingPlan (dönem-sonu plan değişimi) set ise beklenen tutar YENİ plan fiyatıdır (H2).
  const effective = effectivePlanAndAmount(sub);
  const expectedKurus = Math.round(Number(effective.amountTry) * 100);
  if (!Number.isFinite(Number(input.totalAmount)) || Number(input.totalAmount) !== expectedKurus) {
    if (ownerUserId) {
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
    }
    return {
      result: { outcome: 'amount_mismatch', merchantOid: input.merchantOid, subscriptionId: sub.id },
      alert: {
        kind: 'amount_mismatch',
        merchantOid: input.merchantOid,
        companyId: sub.companyId,
        subscriptionId: sub.id,
        detail: `beklenen ${expectedKurus} kuruş, gelen ${input.totalAmount}`,
      },
    };
  }

  const txOut = await applySuccess(input, sub, ownerUserId, tx, now);
  return { ...txOut, alert: ownerMissingAlert };
}

// ── DB reads ───────────────────────────────────────────────────

async function findSubscriptionByPendingOid(tx: Tx, merchantOid: string): Promise<SubscriptionRow | null> {
  const rows = await tx
    .select({
      id: subscriptions.id,
      companyId: subscriptions.companyId,
      plan: subscriptions.plan,
      pendingPlan: subscriptions.pendingPlan,
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
  // Audit yazarı: önce tenant sahibi (BAYI_SAHIBI), yoksa şirketin herhangi bir
  // kullanıcısı. Hiç kullanıcı yoksa (patolojik) null — ödeme yine uygulanır,
  // audit atlanır + owner_missing alert gönderilir (C1).
  const owner = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, 'BAYI_SAHIBI')))
    .limit(1);
  if (owner[0]?.id) return owner[0].id;

  const anyUser = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.companyId, companyId))
    .limit(1);
  return anyUser[0]?.id ?? null;
}

// ── Success (tx içi) ───────────────────────────────────────────

async function applySuccess(
  input: PaytrCallbackInput,
  sub: SubscriptionRow,
  ownerUserId: string | null,
  tx: Tx,
  now: Date,
): Promise<TxOutcome> {
  const isFirstPayment = sub.status === 'incomplete';
  const newPeriodStart = isFirstPayment ? now : sub.currentPeriodEnd;
  const newPeriodEnd = addMonths(newPeriodStart, 1);

  // H2: pendingPlan (dönem-sonu plan değişimi) set ise bu dönemden itibaren YENİ plan
  // + güncel fiyat geçerli; aksi halde mevcut plan/snapshot korunur. pendingPlan temizlenir.
  const effective = effectivePlanAndAmount(sub);
  const planChanged = effective.plan !== sub.plan;

  await tx
    .update(subscriptions)
    .set({
      status: 'active',
      plan: effective.plan,
      amountTry: effective.amountTry,
      pendingPlan: null,
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

  await tx.update(companies).set({ plan: effective.plan, updatedAt: now }).where(eq(companies.id, sub.companyId));

  // (b) Plan düşüşünde (örn. PRO+ → PRO) yeni planın vitrin limitini aşan ürünleri
  // otomatik vitrin'den çek (FREE expire ile aynı davranış). Upgrade'de ∞ → no-op.
  if (planChanged) {
    await unpublishVitrinOverLimit(tx as unknown as DbClient, sub.companyId, planVitrinLimit(effective.plan), now);
  }

  const totals = computeInvoiceTotals(effective.amountTry);
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

  if (ownerUserId) {
    await writeAuditLog(
      {
        companyId: sub.companyId,
        userId: ownerUserId,
        action: isFirstPayment
          ? 'subscription.payment_succeeded'
          : planChanged
            ? 'subscription.plan_changed'
            : 'subscription.renewed',
        entityType: 'subscription',
        entityId: sub.id,
        afterState: {
          plan: effective.plan,
          previousPlan: planChanged ? sub.plan : undefined,
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
  }

  return {
    result: { outcome: 'payment_succeeded', merchantOid: input.merchantOid, subscriptionId: sub.id, invoiceId },
    nilveraCtx: { invoiceId, companyId: sub.companyId, plan: effective.plan, totals },
  };
}

// ── Failure (tx içi) ───────────────────────────────────────────

async function applyFailure(
  input: PaytrCallbackInput,
  sub: SubscriptionRow,
  ownerUserId: string | null,
  tx: Tx,
  now: Date,
): Promise<{ result: PaytrCallbackResult; dunning?: TxOutcome['dunning'] }> {
  const isFirstPayment = sub.status === 'incomplete';

  if (isFirstPayment) {
    await tx
      .update(subscriptions)
      .set({ pendingMerchantOid: null, updatedAt: now })
      .where(eq(subscriptions.id, sub.id));
    if (ownerUserId) {
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
    }
    // İlk ödeme (checkout) başarısız — dunning YOK (henüz aktif abonelik değil).
    return { result: { outcome: 'payment_failed', merchantOid: input.merchantOid, subscriptionId: sub.id } };
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

  if (ownerUserId) {
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
  }

  return {
    result: { outcome: 'payment_failed', merchantOid: input.merchantOid, subscriptionId: sub.id },
    dunning: {
      companyId: sub.companyId,
      subscriptionId: sub.id,
      retryCount: newRetryCount,
      exhausted: nextRetryAt === null,
    },
  };
}

// ── Nilvera (post-tx, best-effort) ─────────────────────────────

async function issueAndRecordNilvera(
  deps: OrchestratorDeps,
  ctx: { invoiceId: string; companyId: string; plan: 'FREE' | 'PRO' | 'PRO_PLUS'; totals: InvoiceTotals },
  now: Date,
): Promise<{ nilveraInvoiceId?: string; nilveraError?: string }> {
  try {
    // Müşteri bilgisi (il/ilçe adı join + fatura adresi). vatNo null → nihai tüketici.
    const customer = await loadInvoiceCustomer(deps.db, ctx.companyId);
    if (!customer) {
      throw new Error(`Şirket bulunamadı (companyId=${ctx.companyId}) — Nilvera fatura atlandı`);
    }

    // resolveAndIssueInvoice: VKN'ye göre e-Fatura / e-Arşiv / nihai tüketici yönlendirir.
    const resp = await deps.nilvera!.issueInvoice({
      externalRef: ctx.invoiceId,
      invoiceDate: now.toISOString(),
      customer,
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
        invoiceKind: resp.kind, // 'efatura' | 'earsiv'
        pdfUrl: resp.pdfUrl ?? null,
        status: 'issued',
        issuedAt: now,
        lastNilveraError: null, // başarıda eski hata kalıntısını temizle
        updatedAt: now,
      })
      .where(eq(invoices.id, ctx.invoiceId));

    return { nilveraInvoiceId: resp.invoiceId };
  } catch (err) {
    // Invoice 'pending' kalır — invoice-reconcile cron (C2) yeniden dener. Akış bozulmaz.
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await deps.db
        .update(invoices)
        .set({ lastNilveraError: msg.slice(0, 500), updatedAt: now })
        .where(eq(invoices.id, ctx.invoiceId));
    } catch {
      // log yazımı da başarısızsa yut — pending durumu reconcile yakalar
    }
    return { nilveraError: msg };
  }
}

// ── Dunning (post-tx, fire-and-forget) ─────────────────────────

async function notifyDunning(
  deps: OrchestratorDeps,
  dunning: NonNullable<TxOutcome['dunning']>,
): Promise<void> {
  alertDunning(dunning); // süperadmin Telegram (fire-and-forget)
  try {
    const rows = await deps.db
      .select({ email: users.email, companyName: companies.name })
      .from(users)
      .innerJoin(companies, eq(companies.id, users.companyId))
      .where(and(eq(users.companyId, dunning.companyId), eq(users.role, 'BAYI_SAHIBI')))
      .limit(1);
    const owner = rows[0];
    if (owner?.email) {
      sendDunningEmail({
        to: owner.email,
        companyName: owner.companyName ?? 'PetStockPro',
        retryCount: dunning.retryCount,
      });
    }
  } catch {
    // owner lookup başarısızsa yut — Telegram alert zaten gönderildi
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
