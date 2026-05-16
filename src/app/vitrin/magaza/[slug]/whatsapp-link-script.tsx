'use client';

import { useEffect } from 'react';

/**
 * Sayfadaki <a href="https://wa.me/..."> linklerine click listener attach eder.
 * Her tıklamada window'a `pp:whatsapp-clicked` event yayar — feedback balonu
 * 5 sn sonra açılır. Yan etkisi: link açılışı engellenmez (preventDefault yok).
 */
export function WhatsappLinkScript() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest('a[href*="wa.me/"]');
      if (link) {
        window.dispatchEvent(new Event('pp:whatsapp-clicked'));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);
  return null;
}
