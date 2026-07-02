'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { withTenant } from '@/lib/db/with-tenant';
import { getCompanyProfile } from '@/lib/company/settings';
import { startPaytrCheckout, CheckoutError, type PaidPlan } from '@/lib/billing/paytr-checkout';
import {
  cancelSubscription,
  reactivateSubscription,
  schedulePlanChange,
  cancelScheduledPlanChange,
} from '@/lib/billing/manage';
import { previewUpgradeNow, upgradeSubscriptionNow } from '@/lib/billing/upgrade-now';
import { resolveAndIssueInvoice } from '@/lib/nilvera/invoice';
import { isNilveraConfigured } from '@/lib/nilvera/config';
import { isPaytrConfigured } from '@/lib/paytr/config';
import { revalidatePath } from 'next/cache';

export interface CheckoutActionState {
  ok: boolean;
  iframeUrl?: string;
  error?: string;
}

/**
 * Checkout başlat — PRO/PRO+ iframe ödeme token'ı döner.
 * Client doğrudan çağırır (form değil); başarılıysa iframeUrl ile iframe açılır.
 *
 * ⚠ FAZ 4B retrofit BORCU: Bu akış BİLEREK `withTenant` ile sarılmadı. `startPaytrCheckout`
 *   DB yazımlarından (subscriptions select/delete/insert) SONRA harici PayTR HTTP çağrısı
 *   (createPaytrIframeToken) yapar. Naif `withTenant` sarması transaction'ı HTTP boyunca
 *   açık tutardı (pooled max=1 → Fluid Compute instance reuse'da eşzamanlı istekleri bloklar).
 *   Phase 2 (app_user RLS) ÖNCESİ doğru çözüm: `startPaytrCheckout`'u (a) tenant-tx içindeki
 *   DB-rezervasyon + (b) tx DIŞINDA HTTP-token diye ikiye böl. O zamana dek checkout DB yolu
 *   bütünüyle owner `db` üzerinde tutarlı kalır (getCompanyProfile dahil). Bkz. PLAN-FAZ-4B-RLS.md.
 */
export async function startCheckoutAction(plan: PaidPlan): Promise<CheckoutActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.email) {
    return { ok: false, error: 'Oturum bulunamadı, tekrar giriş yapın.' };
  }

  if (plan !== 'PRO' && plan !== 'PRO_PLUS') {
    return { ok: false, error: 'Geçersiz plan.' };
  }

  if (!isPaytrConfigured()) {
    return { ok: false, error: 'Ödeme altyapısı henüz yapılandırılmadı (PayTR anahtarları eksik).' };
  }

  const profile = await getCompanyProfile(session.user.companyId, db);
  if (!profile) {
    return { ok: false, error: 'Firma bulunamadı.' };
  }

  const hdrs = await headers();
  const userIp = (hdrs.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1').trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const res = await startPaytrCheckout({
      db,
      companyId: session.user.companyId,
      targetPlan: plan,
      companyName: profile.name,
      ownerEmail: session.user.email,
      userIp,
      userPhone: profile.whatsappPhone ?? undefined,
      okUrl: `${appUrl}/admin/settings/billing?paytr=ok`,
      failUrl: `${appUrl}/admin/settings/billing?paytr=fail`,
    });
    return { ok: true, iframeUrl: res.iframeUrl };
  } catch (err) {
    if (err instanceof CheckoutError && err.code === 'already_subscribed') {
      return { ok: false, error: 'Zaten aktif aboneliğiniz var.' };
    }
    const msg = err instanceof Error ? err.message : 'Ödeme başlatılamadı.';
    return { ok: false, error: msg };
  }
}

export async function cancelSubscriptionAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.companyId) return { ok: false, error: 'Oturum bulunamadı.' };
  const companyId = session.user.companyId;
  const res = await withTenant(companyId, (tx) => cancelSubscription(companyId, tx));
  if (!res.ok) return { ok: false, error: 'Aktif abonelik bulunamadı.' };
  revalidatePath('/admin/settings/billing');
  return { ok: true };
}

export async function reactivateSubscriptionAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.companyId) return { ok: false, error: 'Oturum bulunamadı.' };
  const companyId = session.user.companyId;
  const res = await withTenant(companyId, (tx) => reactivateSubscription(companyId, tx));
  if (!res.ok) return { ok: false, error: 'İptal edilmiş abonelik bulunamadı.' };
  revalidatePath('/admin/settings/billing');
  return { ok: true };
}

/**
 * Dönem-sonu plan değişimi planla (PRO↔PRO+) — H2. Anlık tahsilat YOK; yeni fiyat
 * bir sonraki yenilemede geçerli olur.
 */
export async function schedulePlanChangeAction(
  targetPlan: 'PRO' | 'PRO_PLUS',
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.companyId) return { ok: false, error: 'Oturum bulunamadı.' };
  const companyId = session.user.companyId;
  const res = await withTenant(companyId, (tx) => schedulePlanChange(companyId, targetPlan, tx));
  if (!res.ok) {
    const msg =
      res.reason === 'same_plan'
        ? 'Zaten bu plandasınız.'
        : res.reason === 'not_found'
          ? 'Aktif abonelik bulunamadı.'
          : 'Geçersiz plan.';
    return { ok: false, error: msg };
  }
  revalidatePath('/admin/settings/billing');
  return { ok: true };
}

/** Bekleyen plan değişimini iptal et — H2. */
export async function cancelScheduledPlanChangeAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.companyId) return { ok: false, error: 'Oturum bulunamadı.' };
  const companyId = session.user.companyId;
  const res = await withTenant(companyId, (tx) => cancelScheduledPlanChange(companyId, tx));
  if (!res.ok) return { ok: false, error: 'Bekleyen plan değişikliği yok.' };
  revalidatePath('/admin/settings/billing');
  return { ok: true };
}

const UPGRADE_REASON_MESSAGES: Record<string, string> = {
  not_found: 'Aktif abonelik bulunamadı.',
  same_plan: 'Zaten bu plandasınız.',
  not_upgrade: 'Bu bir yükseltme değil — dönem sonu plan değişikliğini kullan.',
  no_saved_card: 'Kayıtlı kart bulunamadı — kartını yeniden gir.',
  charge_failed: 'Kart çekimi başarısız oldu.',
  charge_pending: 'Ödeme bankada onay bekliyor, birkaç dakika sonra tekrar dene.',
};

export interface UpgradePreviewState {
  ok: boolean;
  proratedAmount?: number;
  daysRemaining?: number;
  error?: string;
}

/** PRO→PRO+ anlık yükseltmede çekilecek prorated tutarı önizle (kart ÇEKMEZ). */
export async function previewUpgradeNowAction(targetPlan: PaidPlan): Promise<UpgradePreviewState> {
  const session = await auth();
  if (!session?.user?.companyId) return { ok: false, error: 'Oturum bulunamadı.' };
  const res = await previewUpgradeNow(session.user.companyId, targetPlan, db);
  if (!res.ok) return { ok: false, error: UPGRADE_REASON_MESSAGES[res.reason ?? ''] ?? 'İşlem yapılamadı.' };
  return { ok: true, proratedAmount: res.proratedAmount, daysRemaining: res.daysRemaining };
}

/**
 * PRO→PRO+ ANINDA yükselt — kayıtlı karttan prorated farkı çeker, başarılıysa plan
 * hemen açılır (dönem tarihleri değişmez). Kullanıcı kararı (2026-07-02).
 */
export async function upgradeNowAction(targetPlan: PaidPlan): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.companyId) return { ok: false, error: 'Oturum bulunamadı.' };

  const res = await upgradeSubscriptionNow(session.user.companyId, targetPlan, db, {
    nilvera: isNilveraConfigured() ? { issueInvoice: resolveAndIssueInvoice } : undefined,
  });
  if (!res.ok) return { ok: false, error: UPGRADE_REASON_MESSAGES[res.reason ?? ''] ?? 'İşlem yapılamadı.' };
  revalidatePath('/admin/settings/billing');
  return { ok: true };
}
