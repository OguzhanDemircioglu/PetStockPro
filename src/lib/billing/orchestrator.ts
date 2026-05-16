/**
 * Billing Orchestrator — Sprint 14 finale
 *
 * iyzico webhook payload'unu işler:
 *   1. Idempotency: processed_webhooks.event_id PK ile çift işleme YOK
 *   2. Subscription lookup: iyzicoSubscriptionRef → tenant
 *   3. Event-type dispatch:
 *      - SUBSCRIPTION_ORDER_SUCCESS / RENEWAL_SUCCESS → period extend + invoice + Nilvera
 *      - RENEWAL_FAILURE → past_due
 *      - CANCELED → cancelled + cancelAtPeriodEnd
 *      - EXPIRED → expired + company plan FREE
 *      - UPGRADED → updatedAt sadece (plan ref mapping Faz 2)
 *   4. Audit log: BAYI_SAHIBI user_id ile sistem aksiyonu izi
 *
 * Nilvera invoice creation best-effort: hata olursa invoice 'pending' kalır,
 * background job ileride retry eder. Orchestration yine ok döner (webhook 200 OK
 * dönmeli — yoksa iyzico retry spam'i başlar).
 *
 * Tüm DB yazımı transaction içinde olabilir (caller dispatch eder).
 * Nilvera çağrısı transaction DIŞINDA (external network — uzun süreceği için
 * DB locks tutamayız).
 */

import { eq, and } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/log';
import { createNilveraInvoice } from '@/lib/nilvera/invoice';
import { deriveWebhookEventId } from '@/lib/iyzico/webhook';
import type { IyzicoWebhookPayload } from '@/lib/iyzico/types';
import type { NilveraInvoiceResponse } from '@/lib/nilvera/types';
import {
  processedWebhooks,
  subscriptions,
  invoices,
  companies,
  users,
} from '@/db/schema';
import { addMonths, computeInvoiceTotals } from './totals';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export type OrchestrationOutcome =
  | 'duplicate'              // event_id zaten işlenmiş, skip
  | 'processed'              // event başarıyla işlendi
  | 'subscription_not_found' // iyzico ref ile eşleşen subscription yok (orphan)
  | 'company_user_missing'   // company'nin BAYI_SAHIBI yok (data tutarsızlık)
  | 'unsupported_event';     // event_type handler'ı yok (UPGRADED dahil)

export interface OrchestrationResult {
  outcome: OrchestrationOutcome;
  eventId: string;
  subscriptionId?: string;
  invoiceId?: string;
  nilveraInvoiceId?: string;
  nilveraError?: string;
}

export interface OrchestratorDeps {
  db: DbClient;
  /** Nilvera invoice helper — testlerde mock geçirilebilir. */
  nilvera?: {
    createInvoice: typeof createNilveraInvoice;
  };
  /** Zaman injection (testlerde deterministic kullanım). */
  now?: () => Date;
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

/**
 * iyzico webhook event'ini orchestrate eder.
 *
 * Caller pattern (Sprint 13 webhook route handler):
 *   if (!verifyIyzicoSignature(rawBody, sig)) → 401
 *   const payload = parseIyzicoWebhookPayload(rawBody);
 *   const result = await processIyzicoWebhookEvent(payload, { db });
 *   → 200 OK her zaman (iyzico retry spam önleme); result.outcome'u logla
 */
export async function processIyzicoWebhookEvent(
  payload: IyzicoWebhookPayload,
  deps: OrchestratorDeps,
): Promise<OrchestrationResult> {
  const eventId = deriveWebhookEventId(payload);
  const db = deps.db;
  const now = deps.now?.() ?? new Date();

  // 1. Idempotency — eventId PK çakışırsa zaten işlenmiş demek.
  const persisted = await persistWebhookEvent(db, eventId, payload, now);
  if (!persisted) {
    return { outcome: 'duplicate', eventId };
  }

  // 2. Subscription lookup
  const sub = await findSubscriptionByIyzicoRef(db, payload.subscriptionReferenceCode);
  if (!sub) {
    return { outcome: 'subscription_not_found', eventId };
  }

  // 3. Audit author: company'nin BAYI_SAHIBI (subscription owner)
  const ownerUserId = await findCompanyOwner(db, sub.companyId);
  if (!ownerUserId) {
    return { outcome: 'company_user_missing', eventId, subscriptionId: sub.id };
  }

  // 4. Dispatch
  switch (payload.eventType) {
    case 'SUBSCRIPTION_ORDER_SUCCESS':
    case 'SUBSCRIPTION_RENEWAL_SUCCESS':
      return await handlePaymentSuccess(payload, sub, ownerUserId, eventId, deps, now);
    case 'SUBSCRIPTION_RENEWAL_FAILURE':
      return await handlePaymentFailure(sub, ownerUserId, eventId, deps, now);
    case 'SUBSCRIPTION_CANCELED':
      return await handleCancellation(sub, ownerUserId, eventId, deps, now);
    case 'SUBSCRIPTION_EXPIRED':
      return await handleExpiration(sub, ownerUserId, eventId, deps, now);
    case 'SUBSCRIPTION_UPGRADED':
      // Plan değişimi: pricing plan ref mapping Faz 2 (şu an sadece audit + timestamp).
      await db
        .update(subscriptions)
        .set({ updatedAt: now })
        .where(eq(subscriptions.id, sub.id));
      await writeAuditLog(
        {
          companyId: sub.companyId,
          userId: ownerUserId,
          action: 'subscription.upgraded',
          entityType: 'subscription',
          entityId: sub.id,
          afterState: { eventTime: payload.eventTime },
        },
        db,
        now,
      );
      return { outcome: 'processed', eventId, subscriptionId: sub.id };
    default:
      return { outcome: 'unsupported_event', eventId, subscriptionId: sub.id };
  }
}

// ══════════════════════════════════════════════════════════════
// Step helpers (export edilmez — internal)
// ══════════════════════════════════════════════════════════════

interface SubscriptionRow {
  id: string;
  companyId: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  amountTry: string;
}

/** processed_webhooks INSERT — duplicate'da false döner. */
async function persistWebhookEvent(
  db: DbClient,
  eventId: string,
  payload: IyzicoWebhookPayload,
  now: Date,
): Promise<boolean> {
  try {
    await db.insert(processedWebhooks).values({
      eventId,
      source: 'iyzico',
      eventType: payload.eventType,
      payload: payload as unknown as Record<string, unknown>,
      processedAt: now,
    });
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) {
      return false;
    }
    throw err;
  }
}

async function findSubscriptionByIyzicoRef(
  db: DbClient,
  iyzicoRef: string,
): Promise<SubscriptionRow | null> {
  const rows = await db
    .select({
      id: subscriptions.id,
      companyId: subscriptions.companyId,
      plan: subscriptions.plan,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      amountTry: subscriptions.amountTry,
    })
    .from(subscriptions)
    .where(eq(subscriptions.iyzicoSubscriptionRef, iyzicoRef))
    .limit(1);
  return rows[0] ?? null;
}

async function findCompanyOwner(db: DbClient, companyId: string): Promise<string | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, 'BAYI_SAHIBI')))
    .limit(1);
  return rows[0]?.id ?? null;
}

// ── Event handlers ─────────────────────────────────────────────

async function handlePaymentSuccess(
  payload: IyzicoWebhookPayload,
  sub: SubscriptionRow,
  ownerUserId: string,
  eventId: string,
  deps: OrchestratorDeps,
  now: Date,
): Promise<OrchestrationResult> {
  const db = deps.db;

  // Period extend: yeni period = mevcut periodEnd → +1 ay (aylık abonelik)
  // İlk ödeme (ORDER_SUCCESS) için subscription.currentPeriodStart=now olabilir,
  // RENEWAL_SUCCESS için eski periodEnd start olur.
  const isFirstPayment = payload.eventType === 'SUBSCRIPTION_ORDER_SUCCESS';
  const newPeriodStart = isFirstPayment ? now : sub.currentPeriodEnd;
  const newPeriodEnd = addMonths(newPeriodStart, 1);

  await db
    .update(subscriptions)
    .set({
      status: 'active',
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));

  // Invoice oluştur (pending — Nilvera onayı sonrası issued olur)
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
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: invoices.id });
  const invoiceId = invRows[0]?.id;

  // Nilvera invoice — best-effort (network fail → invoice 'pending' kalır)
  let nilveraInvoiceId: string | undefined;
  let nilveraError: string | undefined;

  if (deps.nilvera?.createInvoice && invoiceId) {
    try {
      const nilveraResp = await issueNilveraInvoice({
        deps,
        invoiceId,
        companyId: sub.companyId,
        plan: sub.plan,
        totals,
        now,
      });
      if (nilveraResp) {
        nilveraInvoiceId = nilveraResp.invoiceId;
        await db
          .update(invoices)
          .set({
            nilveraInvoiceId: nilveraResp.invoiceId,
            nilveraInvoiceNumber: nilveraResp.invoiceNumber ?? null,
            pdfUrl: nilveraResp.pdfUrl ?? null,
            status: 'issued',
            issuedAt: now,
            updatedAt: now,
          })
          .where(eq(invoices.id, invoiceId));
      }
    } catch (err) {
      nilveraError = err instanceof Error ? err.message : String(err);
      // Invoice 'pending' kalır — background retry için işaret
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
      },
    },
    db,
    now,
  );

  return {
    outcome: 'processed',
    eventId,
    subscriptionId: sub.id,
    invoiceId,
    nilveraInvoiceId,
    nilveraError,
  };
}

async function handlePaymentFailure(
  sub: SubscriptionRow,
  ownerUserId: string,
  eventId: string,
  deps: OrchestratorDeps,
  now: Date,
): Promise<OrchestrationResult> {
  const db = deps.db;

  await db
    .update(subscriptions)
    .set({ status: 'past_due', updatedAt: now })
    .where(eq(subscriptions.id, sub.id));

  await writeAuditLog(
    {
      companyId: sub.companyId,
      userId: ownerUserId,
      action: 'subscription.payment_failed',
      entityType: 'subscription',
      entityId: sub.id,
      afterState: { status: 'past_due' },
    },
    db,
    now,
  );

  return { outcome: 'processed', eventId, subscriptionId: sub.id };
}

async function handleCancellation(
  sub: SubscriptionRow,
  ownerUserId: string,
  eventId: string,
  deps: OrchestratorDeps,
  now: Date,
): Promise<OrchestrationResult> {
  const db = deps.db;

  await db
    .update(subscriptions)
    .set({
      status: 'cancelled',
      cancelAtPeriodEnd: true,
      cancelledAt: now,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));

  await writeAuditLog(
    {
      companyId: sub.companyId,
      userId: ownerUserId,
      action: 'subscription.cancelled',
      entityType: 'subscription',
      entityId: sub.id,
      afterState: { status: 'cancelled', cancelAtPeriodEnd: true },
    },
    db,
    now,
  );

  return { outcome: 'processed', eventId, subscriptionId: sub.id };
}

async function handleExpiration(
  sub: SubscriptionRow,
  ownerUserId: string,
  eventId: string,
  deps: OrchestratorDeps,
  now: Date,
): Promise<OrchestrationResult> {
  const db = deps.db;

  await db
    .update(subscriptions)
    .set({ status: 'expired', updatedAt: now })
    .where(eq(subscriptions.id, sub.id));

  // Plan FREE'ye revert — şirket aboneliği bitti, ücretsiz seviyeye düşer
  await db
    .update(companies)
    .set({ plan: 'FREE', updatedAt: now })
    .where(eq(companies.id, sub.companyId));

  await writeAuditLog(
    {
      companyId: sub.companyId,
      userId: ownerUserId,
      action: 'subscription.expired',
      entityType: 'subscription',
      entityId: sub.id,
      afterState: { status: 'expired', companyPlan: 'FREE' },
    },
    db,
    now,
  );

  return { outcome: 'processed', eventId, subscriptionId: sub.id };
}

// ── Nilvera helper ─────────────────────────────────────────────

async function issueNilveraInvoice(params: {
  deps: OrchestratorDeps;
  invoiceId: string;
  companyId: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  totals: { matrah: number; vat: number; total: number };
  now: Date;
}): Promise<NilveraInvoiceResponse | null> {
  const { deps, invoiceId, companyId, plan, totals, now } = params;
  if (!deps.nilvera) return null;

  const compRows = await deps.db
    .select({
      name: companies.name,
      vatNo: companies.vatNo,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const company = compRows[0];

  // VKN yoksa fatura kesilmez — invoice 'pending' kalır, kullanıcı VKN ekleyince
  // background job retry edebilir. Bu durumda exception fırlat ki caller "pending" tutsun.
  if (!company?.vatNo) {
    throw new Error(`Şirket VKN eksik (companyId=${companyId}) — Nilvera fatura atlandı`);
  }

  return await deps.nilvera.createInvoice({
    externalRef: invoiceId,
    invoiceDate: now.toISOString(),
    customer: {
      taxNumber: company.vatNo,
      title: company.name,
      address: '—', // MVP: detaylı adres Faz 2 (companies tablosunda yok şu an)
      city: '—',
    },
    lines: [
      {
        name: `PetStockPro ${plan} planı (aylık abonelik)`,
        quantity: 1,
        unitPrice: totals.matrah,
        vatRate: 20,
      },
    ],
    currency: 'TRY',
  });
}

// ══════════════════════════════════════════════════════════════
// Utils
// ══════════════════════════════════════════════════════════════

/**
 * Postgres unique constraint violation = SQLSTATE 23505.
 * postgres-js driver hata objesini `code` field'ı ile expose eder.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}
