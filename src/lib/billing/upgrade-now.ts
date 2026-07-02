/**
 * Anlık plan yükseltmesi (PRO → PRO+) + proration — kullanıcı kararı (2026-07-02):
 * upgrade dönem sonunu BEKLEMEZ. Kalan güne göre oranlı fark (computeProration,
 * totals.ts) saklı kartla ANINDA çekilir; başarılıysa plan + özellik limitleri hemen
 * açılır, dönem tarihleri DEĞİŞMEZ (yenileme aynı günde, artık yeni planın TAM
 * fiyatından). Downgrade (PRO+ → PRO) hâlâ dönem-sonu (schedulePlanChange, manage.ts)
 * — kullanıcı kararı sadece upgrade'i kapsıyor, proration downgrade'de anlamsız
 * (iade yapmıyoruz — PLAN-PAYTR-NILVERA §9.3 "iade yok" kararı korunuyor).
 *
 * Stil: orchestrator.ts/renewals.ts ile aynı — plain DbClient (TenantDb/withTenant
 * DEĞİL), companyId WHERE-clause ile scope edilir. Nilvera + PayTR dış ağ çağrıları
 * içerdiği için o dosyalardaki established pattern'e uyulur (manage.ts'in basit
 * CRUD'ları TenantDb kullanır ama dış-ağ side-effect'i yok).
 *
 * Kart çekimi başarısız/wait_callback ise HİÇBİR ŞEY değişmez (plan/dönem aynı
 * kalır, transaction açılmaz) — kullanıcı tekrar deneyebilir, çifte tahsilat riski yok.
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { subscriptions, companies, users, invoices } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit/log';
import { resolveAndIssueInvoice } from '@/lib/nilvera/invoice';
import { loadInvoiceCustomer } from './invoice-customer';
import { chargeSavedCard, listSavedCards } from '@/lib/paytr/client';
import { makeMerchantOid, toPaytrPhone } from './paytr-checkout';
import { computeProration, computeInvoiceTotals } from './totals';
import { PLAN_LIMITS } from '@/lib/constants/plan-limits';

type PaidPlan = 'PRO' | 'PRO_PLUS';

export type UpgradeNowReason =
  | 'not_found'
  | 'same_plan'
  | 'not_upgrade'
  | 'no_saved_card'
  | 'charge_failed'
  | 'charge_pending';

export interface UpgradePreview {
  ok: boolean;
  reason?: UpgradeNowReason;
  proratedAmount?: number;
  daysRemaining?: number;
}

export interface UpgradeNowResult {
  ok: boolean;
  reason?: UpgradeNowReason;
  proratedAmount?: number;
  invoiceId?: string;
  message?: string;
}

export interface UpgradeNowDeps {
  charge?: typeof chargeSavedCard;
  listCards?: typeof listSavedCards;
  nilvera?: { issueInvoice: typeof resolveAndIssueInvoice };
  now?: () => Date;
  appUrl?: string;
}

interface ActiveSubRow {
  id: string;
  plan: PaidPlan;
  amountTry: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  paytrUtoken: string | null;
  paytrCtoken: string | null;
  companyName: string | null;
  whatsappPhone: string | null;
  ownerEmail: string | null;
}

async function findActiveSub(db: DbClient, companyId: string): Promise<ActiveSubRow | null> {
  const rows = await db
    .select({
      id: subscriptions.id,
      plan: subscriptions.plan,
      amountTry: subscriptions.amountTry,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      paytrUtoken: subscriptions.paytrUtoken,
      paytrCtoken: subscriptions.paytrCtoken,
      companyName: companies.name,
      whatsappPhone: companies.whatsappPhone,
      ownerEmail: users.email,
    })
    .from(subscriptions)
    .innerJoin(companies, eq(companies.id, subscriptions.companyId))
    .leftJoin(users, and(eq(users.companyId, subscriptions.companyId), eq(users.role, 'BAYI_SAHIBI')))
    .where(and(eq(subscriptions.companyId, companyId), inArray(subscriptions.status, ['active', 'past_due'])))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return (rows[0] as ActiveSubRow) ?? null;
}

/** targetPlan geçerli bir upgrade mi (fiyatça mevcut plandan yüksek)? Değilse reason döner. */
function validateUpgrade(
  sub: ActiveSubRow | null,
  targetPlan: PaidPlan,
): { ok: true; currentAmount: number; targetAmount: number } | { ok: false; reason: UpgradeNowReason } {
  if (!sub) return { ok: false, reason: 'not_found' };
  if (sub.plan === targetPlan) return { ok: false, reason: 'same_plan' };
  const currentAmount = Number(sub.amountTry);
  const targetAmount = PLAN_LIMITS[targetPlan].priceMonthlyTry;
  if (targetAmount <= currentAmount) return { ok: false, reason: 'not_upgrade' };
  return { ok: true, currentAmount, targetAmount };
}

/** Kart çekmeden ÖNCE gösterilecek prorated tutar önizlemesi. */
export async function previewUpgradeNow(
  companyId: string,
  targetPlan: PaidPlan,
  db: DbClient,
  opts?: { now?: () => Date },
): Promise<UpgradePreview> {
  const now = opts?.now?.() ?? new Date();
  const sub = await findActiveSub(db, companyId);
  const v = validateUpgrade(sub, targetPlan);
  if (!v.ok) return { ok: false, reason: v.reason };

  const proratedAmount = computeProration(
    v.currentAmount,
    v.targetAmount,
    sub!.currentPeriodStart,
    sub!.currentPeriodEnd,
    now,
  );
  const daysRemaining = Math.ceil(
    Math.max(sub!.currentPeriodEnd.getTime() - now.getTime(), 0) / (24 * 60 * 60 * 1000),
  );
  return { ok: true, proratedAmount, daysRemaining };
}

/** Kartı ANINDA çek (prorated fark) + başarılıysa plan/limitleri hemen aç. */
export async function upgradeSubscriptionNow(
  companyId: string,
  targetPlan: PaidPlan,
  db: DbClient,
  deps: UpgradeNowDeps = {},
): Promise<UpgradeNowResult> {
  const now = deps.now?.() ?? new Date();
  const charge = deps.charge ?? chargeSavedCard;
  const listCards = deps.listCards ?? listSavedCards;
  const appUrl = deps.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const sub = await findActiveSub(db, companyId);
  const v = validateUpgrade(sub, targetPlan);
  if (!v.ok) return { ok: false, reason: v.reason };

  let ctoken = sub!.paytrCtoken;
  if (!ctoken && sub!.paytrUtoken) {
    const cards = await listCards(sub!.paytrUtoken);
    ctoken = cards[0]?.ctoken ?? null;
  }
  if (!ctoken || !sub!.paytrUtoken) return { ok: false, reason: 'no_saved_card' };

  const proratedAmount = computeProration(
    v.currentAmount,
    v.targetAmount,
    sub!.currentPeriodStart,
    sub!.currentPeriodEnd,
    now,
  );

  // Ödenecek gerçek bir fark yoksa (dönem sonuna saniyeler kala) çekim yapmadan uygula —
  // 0₺ kart çekimi PayTR'da anlamsız/reddedilir, fatura da gereksiz.
  if (proratedAmount > 0) {
    const merchantOid = makeMerchantOid();
    const res = await charge({
      merchantOid,
      email: sub!.ownerEmail ?? 'billing@petstockpro.com',
      paymentAmount: Math.round(proratedAmount * 100),
      userIp: '127.0.0.1',
      utoken: sub!.paytrUtoken,
      ctoken,
      userName: sub!.companyName ?? 'PetStockPro',
      userAddress: 'Türkiye',
      userPhone: toPaytrPhone(sub!.whatsappPhone),
      okUrl: `${appUrl}/admin/settings/billing?paytr=ok`,
      failUrl: `${appUrl}/admin/settings/billing?paytr=fail`,
    });

    // wait_callback: bu tek-seferlik ödeme pendingMerchantOid'e bağlanmıyor (renewal
    // claim akışından farklı) — non3d saklı kart çekiminde pratikte oluşmaz, oluşursa
    // güvenli taraf: HİÇBİR ŞEY uygulamadan kullanıcıya tekrar denemesini söyle.
    if (res.status === 'wait_callback') {
      return { ok: false, reason: 'charge_pending', proratedAmount };
    }
    if (res.status !== 'success') {
      return {
        ok: false,
        reason: 'charge_failed',
        proratedAmount,
        message: res.status === 'failed' ? (res.err_msg ?? res.reason) : undefined,
      };
    }
  }

  // Charge (varsa) başarılı — dönem tarihleri AYNI kalır, sadece plan + fiyat güncellenir.
  let invoiceId: string | undefined;
  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({
        plan: targetPlan,
        amountTry: v.targetAmount.toFixed(2),
        pendingPlan: null, // olası dönem-sonu planlanmış değişiklik artık gereksiz
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub!.id));

    await tx.update(companies).set({ plan: targetPlan, updatedAt: now }).where(eq(companies.id, companyId));

    if (proratedAmount > 0) {
      const totals = computeInvoiceTotals(proratedAmount);
      const invRows = await tx
        .insert(invoices)
        .values({
          companyId,
          subscriptionId: sub!.id,
          periodStart: now,
          periodEnd: sub!.currentPeriodEnd,
          amountMatrah: totals.matrah.toFixed(2),
          vatAmount: totals.vat.toFixed(2),
          amountTotal: totals.total.toFixed(2),
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: invoices.id });
      invoiceId = invRows[0]?.id as string;
    }

    const ownerRows = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.companyId, companyId), eq(users.role, 'BAYI_SAHIBI')))
      .limit(1);
    const ownerUserId = ownerRows[0]?.id;
    if (ownerUserId) {
      await writeAuditLog(
        {
          companyId,
          userId: ownerUserId,
          action: 'subscription.upgraded_immediate',
          entityType: 'subscription',
          entityId: sub!.id,
          afterState: {
            fromPlan: sub!.plan,
            toPlan: targetPlan,
            proratedAmount,
            invoiceId,
          },
        },
        tx,
        now,
      );
    }
  });

  // Nilvera — post-tx best-effort (dış ağ). Hata → invoice 'pending' kalır, invoice-reconcile
  // cron (C2) yeniden dener — aynı orchestrator.ts pattern'i.
  if (invoiceId && deps.nilvera?.issueInvoice) {
    try {
      const customer = await loadInvoiceCustomer(db, companyId);
      if (customer) {
        const totals = computeInvoiceTotals(proratedAmount);
        const resp = await deps.nilvera.issueInvoice({
          externalRef: invoiceId,
          invoiceDate: now.toISOString(),
          customer,
          lines: [
            {
              name: `PetStockPro ${targetPlan} planına yükseltme (dönem içi fark)`,
              quantity: 1,
              unitPrice: totals.matrah,
              vatRate: 20,
            },
          ],
          currency: 'TRY',
        });
        await db
          .update(invoices)
          .set({
            nilveraInvoiceId: resp.invoiceId,
            nilveraInvoiceNumber: resp.invoiceNumber ?? null,
            invoiceKind: resp.kind,
            pdfUrl: resp.pdfUrl ?? null,
            status: 'issued',
            issuedAt: now,
            lastNilveraError: null,
            updatedAt: now,
          })
          .where(eq(invoices.id, invoiceId));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(invoices)
        .set({ lastNilveraError: msg.slice(0, 500), updatedAt: now })
        .where(eq(invoices.id, invoiceId));
    }
  }

  return { ok: true, proratedAmount, invoiceId };
}
