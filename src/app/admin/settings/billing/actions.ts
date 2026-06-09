'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { getCompanyProfile } from '@/lib/company/settings';
import { startPaytrCheckout, CheckoutError, type PaidPlan } from '@/lib/billing/paytr-checkout';
import { cancelSubscription, reactivateSubscription } from '@/lib/billing/manage';
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
  const res = await cancelSubscription(session.user.companyId, db);
  if (!res.ok) return { ok: false, error: 'Aktif abonelik bulunamadı.' };
  revalidatePath('/admin/settings/billing');
  return { ok: true };
}

export async function reactivateSubscriptionAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.companyId) return { ok: false, error: 'Oturum bulunamadı.' };
  const res = await reactivateSubscription(session.user.companyId, db);
  if (!res.ok) return { ok: false, error: 'İptal edilmiş abonelik bulunamadı.' };
  revalidatePath('/admin/settings/billing');
  return { ok: true };
}
