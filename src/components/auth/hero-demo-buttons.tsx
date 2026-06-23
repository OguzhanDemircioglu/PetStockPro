'use client';

import Link from 'next/link';
import { LayoutDashboard, Store } from 'lucide-react';

/**
 * Login + register hero — "kayıt olmadan dene" demo önizleme.
 *
 *   - Yönetim paneli → demo bayi auto-login (/admin)   — açık-siyah (logo dog)
 *   - Vitrin         → herkese açık dizin (/vitrin)     — turkuaz (logo arrow)
 *
 * Lucide ikonlar (özellik kartlarıyla aynı stil) + dolu logo-renk gradientleri
 * → güçlü, dikkat çeken CTA. Özellik kartlarının ÜSTÜNE konur.
 */
export function HeroDemoButtons() {
  return (
    <div className="relative z-10 mt-6 grid grid-cols-2 gap-3">
      <Link
        href={'/panel-onizleme' as never}
        data-testid="hero-demo-admin"
        className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#4a4a4a] to-[#222222] px-4 py-3.5 text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.32)] ring-1 ring-white/15 transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(0,0,0,0.40)]"
      >
        <LayoutDashboard className="h-[18px] w-[18px] shrink-0 drop-shadow" strokeWidth={2.2} />
        Paneli önizle
      </Link>
      <Link
        href={'/vitrin' as never}
        data-testid="hero-demo-vitrin"
        className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#16a08a] to-[#0d7a68] px-4 py-3.5 text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(22,160,138,0.36)] ring-1 ring-white/20 transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(22,160,138,0.44)]"
      >
        <Store className="h-[18px] w-[18px] shrink-0 drop-shadow" strokeWidth={2.2} />
        Vitrini önizle
      </Link>
    </div>
  );
}
