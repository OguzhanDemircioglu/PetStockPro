/**
 * Billing Renewals — yenileme cron çekirdeği (Faz 3)
 *
 * Günlük cron (/api/cron/billing-renew) çağırır:
 *   1. EXPIRE: süresi dolan abonelikleri kapat (FREE'ye düşür)
 *        - cancelAtPeriodEnd=true + dönem bitti  → expired + plan FREE
 *        - past_due + retry tükendi (nextRetryAt NULL) + dönem bitti → expired + FREE
 *   2. RENEW/RETRY: saklı kartla otomatik çek
 *        - active (iptal değil) + dönem bitti      → çek
 *        - past_due + nextRetryAt <= now           → retry çek
 *      Çekim sonucu (success/failed) processPaytrCallback ile işlenir (idempotent).
 *      Async PayTR callback de gelirse 'duplicate' olur (çift işleme yok).
 *
 * ctoken: subscription'da saklıysa kullanılır; yoksa listSavedCards(utoken) ile çekilir.
 * Saklı kart yoksa → dunning (failed) — kullanıcı kartını yeniden girmeli.
 *
 * Bağımlılıklar (charge/listCards/processCallback) inject edilebilir → kolay test.
 */

import { and, eq, lte, isNull, isNotNull, or, inArray, desc } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { subscriptions, companies, users, products } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit/log';
import { createNilveraInvoice } from '@/lib/nilvera/invoice';
import { chargeSavedCard, listSavedCards } from '@/lib/paytr/client';
import { PLAN_LIMITS } from '@/lib/constants/plan-limits';
import { processPaytrCallback, effectivePlanAndAmount } from './orchestrator';
import { makeMerchantOid } from './paytr-checkout';
import { sendPlanDowngradedEmail } from './emails';

export interface RenewalDeps {
  db: DbClient;
  charge?: typeof chargeSavedCard;
  listCards?: typeof listSavedCards;
  processCallback?: typeof processPaytrCallback;
  nilvera?: { createInvoice: typeof createNilveraInvoice };
  now?: () => Date;
  appUrl?: string;
}

export interface RenewalSummary {
  due: number;
  renewed: number;
  failed: number;
  waitCallback: number;
  expired: number;
  errors: number;
  /** C4: önceki çekimi çözülmemiş (in-flight) olduğu için atlanan abonelikler — çift çekim koruması. */
  skippedInFlight: number;
}

interface DueRow {
  id: string;
  companyId: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  pendingPlan: 'FREE' | 'PRO' | 'PRO_PLUS' | null;
  amountTry: string;
  paytrUtoken: string | null;
  paytrCtoken: string | null;
  pendingMerchantOid: string | null;
  ownerEmail: string | null;
  companyName: string | null;
  whatsappPhone: string | null;
}

export async function runBillingRenewals(deps: RenewalDeps): Promise<RenewalSummary> {
  const now = deps.now?.() ?? new Date();
  const charge = deps.charge ?? chargeSavedCard;
  const listCards = deps.listCards ?? listSavedCards;
  const processCallback = deps.processCallback ?? processPaytrCallback;
  const appUrl = deps.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // 1. EXPIRE
  const expired = await expireDueSubscriptions(deps.db, now);

  // 2. RENEW / RETRY
  let renewed = 0;
  let failed = 0;
  let waitCallback = 0;
  let errors = 0;
  let skippedInFlight = 0;

  // H1 (concurrency): "claim" transaction — due abonelikleri FOR UPDATE OF subscriptions
  // SKIP LOCKED ile seç + pendingMerchantOid ata (atomik). Eşzamanlı cron çalışması
  // kilitli satırları atlar → aynı abonelik iki kez çekilmez.
  // C4: pendingMerchantOid zaten set ise (önceki çekim çözülmemiş) claim ETME, atla.
  const claimed = await deps.db.transaction(async (tx) => {
    const dueRows = await findDueSubscriptions(tx as unknown as DbClient, now);
    const out: Array<DueRow & { merchantOid: string }> = [];
    for (const sub of dueRows) {
      if (sub.pendingMerchantOid) {
        skippedInFlight++;
        continue;
      }
      const merchantOid = makeMerchantOid();
      await tx
        .update(subscriptions)
        .set({ pendingMerchantOid: merchantOid, updatedAt: now })
        .where(eq(subscriptions.id, sub.id));
      out.push({ ...sub, merchantOid });
    }
    return out;
  });

  for (const sub of claimed) {
    try {
      const merchantOid = sub.merchantOid;
      // H2: pendingPlan set ise yeni plan fiyatı çekilir (dönem-sonu plan değişimi).
      const amountKurus = Math.round(Number(effectivePlanAndAmount(sub).amountTry) * 100);

      // ctoken bul
      let ctoken = sub.paytrCtoken;
      if (!ctoken && sub.paytrUtoken) {
        const cards = await listCards(sub.paytrUtoken);
        ctoken = cards[0]?.ctoken ?? null;
      }

      // Saklı kart yok → dunning (failed)
      if (!ctoken || !sub.paytrUtoken) {
        await processCallback(
          {
            merchantOid,
            status: 'failed',
            totalAmount: String(amountKurus),
            failedReason: 'no_saved_card',
          },
          { db: deps.db, nilvera: deps.nilvera, now: () => now },
        );
        failed++;
        continue;
      }

      const res = await charge({
        merchantOid,
        email: sub.ownerEmail ?? 'billing@petstockpro.com',
        paymentAmount: amountKurus,
        userIp: '127.0.0.1',
        utoken: sub.paytrUtoken,
        ctoken,
        userName: sub.companyName ?? 'PetStockPro',
        userAddress: '—',
        userPhone: sub.whatsappPhone ?? '—',
        okUrl: `${appUrl}/admin/settings/billing?paytr=ok`,
        failUrl: `${appUrl}/admin/settings/billing?paytr=fail`,
      });

      if (res.status === 'wait_callback') {
        // PayTR doğruluyor → sonuç async callback ile gelecek.
        waitCallback++;
        continue;
      }

      await processCallback(
        {
          merchantOid,
          status: res.status === 'success' ? 'success' : 'failed',
          totalAmount: String(amountKurus),
          failedReason: res.status === 'failed' ? res.err_msg ?? res.reason : undefined,
        },
        { db: deps.db, nilvera: deps.nilvera, now: () => now },
      );

      if (res.status === 'success') renewed++;
      else failed++;
    } catch {
      // Bir abonelik hata verse diğerleri devam etsin.
      errors++;
    }
  }

  return { due: claimed.length, renewed, failed, waitCallback, expired, errors, skippedInFlight };
}

// ══════════════════════════════════════════════════════════════
// EXPIRE
// ══════════════════════════════════════════════════════════════

async function expireDueSubscriptions(db: DbClient, now: Date): Promise<number> {
  const rows = await db
    .select({ id: subscriptions.id, companyId: subscriptions.companyId })
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.status, ['active', 'past_due', 'cancelled']),
        lte(subscriptions.currentPeriodEnd, now),
        or(
          eq(subscriptions.cancelAtPeriodEnd, true),
          and(eq(subscriptions.status, 'past_due'), isNull(subscriptions.nextRetryAt)),
        ),
      ),
    );

  for (const row of rows) {
    await db
      .update(subscriptions)
      .set({ status: 'expired', pendingMerchantOid: null, updatedAt: now })
      .where(eq(subscriptions.id, row.id));
    await db.update(companies).set({ plan: 'FREE', updatedAt: now }).where(eq(companies.id, row.companyId));

    // I2: FREE vitrin limitini aşan ürünleri otomatik vitrin'den çek (plan_downgrade).
    const unpublishedCount = await unpublishVitrinOverFreeLimit(db, row.companyId, now);

    // Owner (audit yazarı + I1 downgrade e-postası alıcısı)
    const ownerRows = await db
      .select({ userId: users.id, email: users.email, companyName: companies.name })
      .from(users)
      .innerJoin(companies, eq(companies.id, users.companyId))
      .where(and(eq(users.companyId, row.companyId), eq(users.role, 'BAYI_SAHIBI')))
      .limit(1);
    const owner = ownerRows[0];

    // I1: downgrade e-postası — abonelik sona erdi, FREE plan + (varsa) vitrin bilgisi.
    if (owner?.email) {
      sendPlanDowngradedEmail({
        to: owner.email,
        companyName: owner.companyName ?? 'PetStockPro',
        unpublishedCount,
      });
    }

    if (owner?.userId) {
      await writeAuditLog(
        {
          companyId: row.companyId,
          userId: owner.userId,
          action: 'subscription.expired',
          entityType: 'subscription',
          entityId: row.id,
          afterState: { status: 'expired', companyPlan: 'FREE', vitrinUnpublished: unpublishedCount },
        },
        db,
        now,
      );
    }
  }
  return rows.length;
}

/**
 * I2: Plan FREE'ye düştüğünde FREE vitrin limitini aşan ürünleri otomatik vitrin'den
 * çeker (en eski yayınlananlar). Ürünler SİLİNMEZ — sadece vitrinPublished=false +
 * reason='plan_downgrade'. En yeni `limit` ürün vitrin'de kalır.
 *
 * @returns vitrin'den çekilen ürün sayısı
 */
async function unpublishVitrinOverFreeLimit(db: DbClient, companyId: string, now: Date): Promise<number> {
  const limit = PLAN_LIMITS.FREE.vitrinLimit;
  const published = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.companyId, companyId), eq(products.vitrinPublished, true)))
    .orderBy(desc(products.vitrinPublishedAt));
  if (published.length <= limit) return 0;

  const toUnpublish = published.slice(limit).map((p) => p.id);
  await db
    .update(products)
    .set({
      vitrinPublished: false,
      vitrinAutoUnpublishedAt: now,
      vitrinAutoUnpublishedReason: 'plan_downgrade',
      updatedAt: now,
    })
    .where(inArray(products.id, toUnpublish));
  return toUnpublish.length;
}

// ══════════════════════════════════════════════════════════════
// DUE (renew / retry)
// ══════════════════════════════════════════════════════════════

async function findDueSubscriptions(db: DbClient, now: Date): Promise<DueRow[]> {
  const rows = await db
    .select({
      id: subscriptions.id,
      companyId: subscriptions.companyId,
      plan: subscriptions.plan,
      pendingPlan: subscriptions.pendingPlan,
      amountTry: subscriptions.amountTry,
      paytrUtoken: subscriptions.paytrUtoken,
      paytrCtoken: subscriptions.paytrCtoken,
      pendingMerchantOid: subscriptions.pendingMerchantOid,
      ownerEmail: users.email,
      companyName: companies.name,
      whatsappPhone: companies.whatsappPhone,
    })
    .from(subscriptions)
    .leftJoin(companies, eq(companies.id, subscriptions.companyId))
    .leftJoin(
      users,
      and(eq(users.companyId, subscriptions.companyId), eq(users.role, 'BAYI_SAHIBI')),
    )
    .where(
      or(
        and(
          eq(subscriptions.status, 'active'),
          eq(subscriptions.cancelAtPeriodEnd, false),
          lte(subscriptions.currentPeriodEnd, now),
        ),
        and(
          eq(subscriptions.status, 'past_due'),
          isNotNull(subscriptions.nextRetryAt),
          lte(subscriptions.nextRetryAt, now),
        ),
      ),
    )
    // H1: yalnız subscriptions satırlarını kilitle (leftJoin nullable tarafı FOR UPDATE
    // hatası vermesin) + kilitli satırları atla (eşzamanlı cron çift çekim koruması).
    .for('update', { of: subscriptions, skipLocked: true });
  return rows as DueRow[];
}
