'use client';

import Script from 'next/script';

/**
 * PayTR güvenli ödeme iframe'i (modal). Hem ilk checkout (BillingCheckout) hem saklı-kart
 * YOKKEN dönem-içi yükseltme (SubscriptionActions) buradan gösterir — tek kaynak.
 *
 * Aynı sayfada iki modal ASLA aynı anda açılmaz (FREE→BillingCheckout, PRO/PRO+→
 * SubscriptionActions birbirini dışlar), o yüzden #paytriframe id çakışması olmaz.
 */
export function PaytrIframeModal({ iframeUrl, onClose }: { iframeUrl: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-6"
      data-testid="paytr-modal"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white p-3 shadow-xl sm:p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-bold text-cart">Güvenli ödeme · PayTR</h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-ink-3 hover:bg-paper"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>
        {/* Yükseklik: iframeResizer çalışırsa içeriğe göre büyür; çalışmazsa bu
            viewport-bağlı yükseklik + iç scroll ile kart alanlarına her zaman ulaşılır. */}
        <iframe
          src={iframeUrl}
          id="paytriframe"
          title="PayTR ödeme"
          frameBorder={0}
          className="w-full rounded-lg"
          style={{ height: 'min(82vh, 760px)', width: '100%' }}
        />
        <Script
          src="https://www.paytr.com/js/iframeResizer.min.js"
          strategy="afterInteractive"
          onLoad={() => {
            const w = window as unknown as {
              iFrameResize?: (opts: object, sel: string) => void;
            };
            // checkOrigin:false — PayTR cross-origin; varsayılan origin kontrolü
            // resize mesajlarını reddedip iframe'i küçük bırakabiliyor.
            if (typeof w.iFrameResize === 'function') {
              w.iFrameResize({ checkOrigin: false }, '#paytriframe');
            }
          }}
        />
      </div>
    </div>
  );
}
