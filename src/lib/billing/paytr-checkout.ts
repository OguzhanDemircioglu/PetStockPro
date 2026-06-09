/**
 * PayTR Checkout — ilk ödeme akışı başlatma (Faz 2)
 *
 * Akış:
 *   1. Aktif abonelik var mı? (varsa block — upgrade/downgrade Faz 4)
 *   2. Önceki 'incomplete' checkout'ları temizle (birikmesin)
 *   3. Yeni 'incomplete' subscription oluştur (pending_merchant_oid + utoken)
 *   4. createPaytrIframeToken (store_card=1 + utoken) → iframe token
 *
 * Callback (success) geldiğinde orchestrator bu satırı 'active' yapar + kartı saklar.
 */

import { eq, and } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { subscriptions } from '@/db/schema';
import { createPaytrIframeToken, paytrIframeUrl } from '@/lib/paytr/client';
import type { PaytrBasketItem } from '@/lib/paytr/types';
import { PLAN_LIMITS } from '@/lib/constants/plan-limits';
import { addMonths } from './totals';

export type PaidPlan = 'PRO' | 'PRO_PLUS';

export class CheckoutError extends Error {
  readonly code: 'already_subscribed' | 'invalid_plan';
  constructor(code: 'already_subscribed' | 'invalid_plan', message?: string) {
    super(message ?? code);
    this.name = 'CheckoutError';
    this.code = code;
  }
}

export interface StartCheckoutParams {
  db: DbClient;
  companyId: string;
  targetPlan: PaidPlan;
  companyName: string;
  ownerEmail: string;
  userIp: string;
  userPhone?: string;
  userAddress?: string;
  /** Ödeme başarılı/başarısız dönüş URL'leri (merchant_ok_url / merchant_fail_url). */
  okUrl: string;
  failUrl: string;
  now?: () => Date;
}

export interface StartCheckoutResult {
  token: string;
  iframeUrl: string;
  merchantOid: string;
}

/** Benzersiz, yalnızca alfanümerik merchant_oid (PayTR kısıtı). */
export function makeMerchantOid(nowMs: number = Date.now()): string {
  return 'PSP' + nowMs.toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Şirkete sabit utoken — saklı kartlar bu kullanıcı altında gruplanır. */
export function deriveUtoken(companyId: string): string {
  return 'u' + companyId.replace(/-/g, '');
}

export async function startPaytrCheckout(params: StartCheckoutParams): Promise<StartCheckoutResult> {
  const now = params.now?.() ?? new Date();

  const price = PLAN_LIMITS[params.targetPlan]?.priceMonthlyTry;
  if (!price || price <= 0) {
    throw new CheckoutError('invalid_plan', `Geçersiz plan: ${params.targetPlan}`);
  }

  // 1. Zaten aktif abonelik varsa block (upgrade/downgrade Faz 4 — proration kapsam dışı).
  const active = await params.db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.companyId, params.companyId), eq(subscriptions.status, 'active')))
    .limit(1);
  if (active.length > 0) {
    throw new CheckoutError('already_subscribed', 'Zaten aktif aboneliğiniz var.');
  }

  const merchantOid = makeMerchantOid();
  const utoken = deriveUtoken(params.companyId);
  const amountKurus = Math.round(price * 100);

  // 2. Eski tamamlanmamış checkout'ları temizle.
  await params.db
    .delete(subscriptions)
    .where(and(eq(subscriptions.companyId, params.companyId), eq(subscriptions.status, 'incomplete')));

  // 3. Yeni incomplete subscription.
  await params.db.insert(subscriptions).values({
    companyId: params.companyId,
    plan: params.targetPlan,
    status: 'incomplete',
    amountTry: price.toFixed(2),
    pendingMerchantOid: merchantOid,
    paytrUtoken: utoken,
    currentPeriodStart: now,
    currentPeriodEnd: addMonths(now, 1),
  });

  // 4. PayTR iframe token (kart saklamalı).
  const basket: PaytrBasketItem[] = [[`PetStockPro ${params.targetPlan} (aylık abonelik)`, price.toFixed(2), 1]];
  const token = await createPaytrIframeToken({
    merchantOid,
    email: params.ownerEmail,
    paymentAmount: amountKurus,
    userIp: params.userIp,
    userName: params.companyName,
    userAddress: params.userAddress ?? '—',
    userPhone: params.userPhone ?? '—',
    basket,
    okUrl: params.okUrl,
    failUrl: params.failUrl,
    storeCard: 1,
    utoken,
    noInstallment: 1,
  });

  return { token, iframeUrl: paytrIframeUrl(token), merchantOid };
}
