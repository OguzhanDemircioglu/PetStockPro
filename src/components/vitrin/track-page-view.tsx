'use client';

import { useEffect } from 'react';

/**
 * TrackPageView — client-side vitrin event tracker.
 *
 * Tur 1 (P0-1 performance fix): server-side `trackVitrinEventAsync` + `headers()`
 * çağrıları sayfaları force-dynamic'e zorluyordu. Client-side fetch ile aynı işi
 * yapar + sayfa fully cacheable (CDN cache hit).
 *
 * Mount sonrası `/api/vitrin/track` POST eder. Fire-and-forget — hata UX'i bozmaz.
 * IP + UA server'da extract edilir (KVKK uyumlu, IP daily-salt SHA-256 hash).
 *
 * sendBeacon kullanılmıyor (POST body sınırlı + tarayıcı destek farklı).
 * Plain fetch ile keepalive: true → sayfa kapanırken bile request iletilir.
 */
interface TrackProps {
  companyId: string;
  eventType:
    | 'home_view'
    | 'profile_view'
    | 'product_view'
    | 'whatsapp_click'
    | 'phone_click'
    | 'telegram_click'
    | 'directions_click'
    | 'listing_impression'
    | 'search'
    | 'category_view';
  branchId?: string;
  productId?: string;
  variantId?: string;
  searchQuery?: string;
}

export function TrackPageView({
  companyId,
  eventType,
  branchId,
  productId,
  variantId,
  searchQuery,
}: TrackProps) {
  useEffect(() => {
    const referrerUrl =
      typeof document !== 'undefined' && document.referrer
        ? document.referrer.slice(0, 500)
        : undefined;

    fetch('/api/vitrin/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        companyId,
        eventType,
        branchId,
        productId,
        variantId,
        searchQuery,
        referrerUrl,
      }),
    }).catch(() => {
      /* sessiz — tracking başarısızlığı UX bozmasın */
    });
  }, [companyId, eventType, branchId, productId, variantId, searchQuery]);

  return null;
}
