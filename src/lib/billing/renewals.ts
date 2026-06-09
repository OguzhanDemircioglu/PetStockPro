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

import { and, eq, lte, isNull, isNotNull, or, inArray } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { subscriptions, companies, users } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit/log';
import { createNilveraInvoice } from '@/lib/nilvera/invoice';
import { chargeSavedCard, listSavedCards } from '@/lib/paytr/client';
import { processPaytrCallback } from './orchestrator';
import { makeMerchantOid } from './paytr-checkout';

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
}

interface DueRow {
  id: string;
  companyId: string;
  amountTry: string;
  paytrUtoken: string | null;
  paytrCtoken: string | null;
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
  const due = await findDueSubscriptions(deps.db, now);
  let renewed = 0;
  let failed = 0;
  let waitCallback = 0;
  let errors = 0;

  for (const sub of due) {
    try {
      const merchantOid = makeMerchantOid();
      const amountKurus = Math.round(Number(sub.amountTry) * 100);

      // pending_merchant_oid ata (callback / processCallback lookup için)
      await deps.db
        .update(subscriptions)
        .set({ pendingMerchantOid: merchantOid, updatedAt: now })
        .where(eq(subscriptions.id, sub.id));

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

  return { due: due.length, renewed, failed, waitCallback, expired, errors };
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

    const ownerId = await findCompanyOwner(db, row.companyId);
    if (ownerId) {
      await writeAuditLog(
        {
          companyId: row.companyId,
          userId: ownerId,
          action: 'subscription.expired',
          entityType: 'subscription',
          entityId: row.id,
          afterState: { status: 'expired', companyPlan: 'FREE' },
        },
        db,
        now,
      );
    }
  }
  return rows.length;
}

// ══════════════════════════════════════════════════════════════
// DUE (renew / retry)
// ══════════════════════════════════════════════════════════════

async function findDueSubscriptions(db: DbClient, now: Date): Promise<DueRow[]> {
  const rows = await db
    .select({
      id: subscriptions.id,
      companyId: subscriptions.companyId,
      amountTry: subscriptions.amountTry,
      paytrUtoken: subscriptions.paytrUtoken,
      paytrCtoken: subscriptions.paytrCtoken,
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
    );
  return rows as DueRow[];
}

async function findCompanyOwner(db: DbClient, companyId: string): Promise<string | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, 'BAYI_SAHIBI')))
    .limit(1);
  return rows[0]?.id ?? null;
}
