'use client';

import { useState, useTransition } from 'react';
import Script from 'next/script';
import { PLAN_LIMITS, PLAN_LABELS } from '@/lib/constants/plan-limits';
import { startCheckoutAction } from './actions';

const OFFER: ('PRO' | 'PRO_PLUS')[] = ['PRO', 'PRO_PLUS'];

function limitText(v: number): string {
  return v === Infinity ? '∞' : String(v);
}

export function BillingCheckout() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  function upgrade(plan: 'PRO' | 'PRO_PLUS') {
    setError(null);
    setLoadingPlan(plan);
    startTransition(async () => {
      const res = await startCheckoutAction(plan);
      setLoadingPlan(null);
      if (res.ok && res.iframeUrl) {
        setIframeUrl(res.iframeUrl);
      } else {
        setError(res.error ?? 'Bir hata oluştu.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          data-testid="checkout-error"
          className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger-7"
        >
          ⚠ {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {OFFER.map((plan) => {
          const f = PLAN_LIMITS[plan];
          return (
            <div
              key={plan}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-bold text-cart">{PLAN_LABELS[plan]}</h3>
                <div className="text-right">
                  <span className="text-2xl font-bold text-cart">
                    {f.priceMonthlyTry.toLocaleString('tr-TR')} ₺
                  </span>
                  <span className="text-xs text-ink-3"> /ay</span>
                </div>
              </div>
              <ul className="flex flex-col gap-1 text-sm text-ink-2">
                <li>📦 {limitText(f.productLimit)} ürün</li>
                <li>🌐 {limitText(f.vitrinLimit)} vitrin ürünü</li>
                <li>🏪 {limitText(f.branchLimit)} şube</li>
                <li>📊 Excel import + tam raporlar</li>
              </ul>
              <p className="text-[11px] text-ink-4">KDV dahil. İstediğin zaman iptal.</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => upgrade(plan)}
                data-testid={`upgrade-${plan}`}
                className="mt-auto inline-flex items-center justify-center rounded-xl bg-cat px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-sm)] transition hover:opacity-90 disabled:opacity-50"
              >
                {loadingPlan === plan ? 'Hazırlanıyor…' : `${PLAN_LABELS[plan]}'ya yükselt`}
              </button>
            </div>
          );
        })}
      </div>

      {iframeUrl && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
          data-testid="paytr-modal"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold text-cart">Güvenli ödeme · PayTR</h4>
              <button
                type="button"
                onClick={() => setIframeUrl(null)}
                className="rounded-lg px-2 py-1 text-sm text-ink-3 hover:bg-paper"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
            <iframe
              src={iframeUrl}
              id="paytriframe"
              title="PayTR ödeme"
              frameBorder={0}
              scrolling="no"
              className="w-full rounded-lg"
              style={{ minHeight: 540 }}
            />
            <Script
              src="https://www.paytr.com/js/iframeResizer.min.js"
              strategy="afterInteractive"
              onLoad={() => {
                const w = window as unknown as { iFrameResize?: (opts: object, sel: string) => void };
                if (typeof w.iFrameResize === 'function') w.iFrameResize({}, '#paytriframe');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
