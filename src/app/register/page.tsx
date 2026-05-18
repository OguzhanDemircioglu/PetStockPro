'use client';

import { useActionState } from 'react';
import Image from 'next/image';
import { registerAction, type RegisterState } from './actions';

/**
 * Register Page — Sprint 2.2
 *
 * Tasarım: Login page ile aynı hero + form panel (DRY refactor Sprint 2.4'te
 * AuthHero shared component'e geçirilecek).
 *
 * Form:
 *   - Pet shop adı
 *   - E-posta
 *   - Şifre (HIBP + strength check server-side)
 *   - KVKK Aydınlatma (Md.10) checkbox — zorunlu
 *   - AB veri lokasyonu (KVKK Md.9 açık rıza) checkbox — zorunlu
 *   - Submit → registerAction → /verify-email redirect
 *
 * Sprint 2.3+: Turnstile widget (zorunlu), email verification flow.
 */
export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<RegisterState | null, FormData>(
    registerAction,
    null,
  );

  return (
    <div className="grid h-screen w-screen grid-cols-1 overflow-hidden md:grid-cols-2">
      {/* ============ SOL HERO PANEL ============ */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#d44a14] via-[#ed6a2c] to-[#c25510] px-14 py-14 text-white">
        {/* Logo watermark — sağ-alt (eski paw pattern + mascot SVG yerine) */}
        <div className="pointer-events-none absolute -bottom-12 -right-12 z-0 h-72 w-72 rotate-[-8deg] opacity-[0.08]">
          <Image
            src="/logo.webp"
            alt=""
            aria-hidden="true"
            width={288}
            height={288}
            className="h-full w-full object-contain"
          />
        </div>
        <span className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] h-1.5 bg-gradient-to-r from-cart via-bars via-arrow to-cat-7" />

        <div className="relative z-10 flex items-center gap-5">
          <div className="grid h-[104px] w-[104px] flex-shrink-0 -rotate-3 place-items-center overflow-hidden rounded-3xl bg-white/95 p-2.5 shadow-2xl ring-1 ring-white/60 transition-transform duration-300 hover:rotate-0 hover:scale-105">
            <Image
              src="/logo.webp"
              alt="PetStockPro"
              width={88}
              height={88}
              className="h-[88px] w-[88px] object-contain"
              priority
            />
          </div>
          <div className="leading-tight">
            <div className="text-[27.5px] font-bold tracking-tight leading-none">PetStockPro</div>
            <div className="mt-2 text-xs font-bold opacity-90">
              Pet shop&apos;unun her şeyi tek panelde
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-12">
          <h1 className="text-[45.5px] font-bold leading-[1.06] tracking-tight">
            Stoktan satışa,
            <br />
            vitrinden{' '}
            <span className="bg-gradient-to-br from-[#ffd9c2] to-white bg-clip-text text-transparent">
              rapora.
            </span>
          </h1>
          <p className="mt-4 max-w-[480px] text-[16.5px] leading-relaxed opacity-95">
            FREE 50 ürün ile <strong className="rounded bg-white/20 px-2 py-0.5 font-bold">ücretsiz başla</strong>.
            Kredi kartı gerekmez, 2 dakikada hazır.
          </p>
        </div>

        <div className="relative z-10 mt-10 grid grid-cols-2 gap-3">
          {[
            { ic: '📦', title: 'Stok Takip', sub: 'Çoklu şube, sayım, immutable ledger' },
            { ic: '🏪', title: 'Vitrin', sub: 'Müşteri bul, WhatsApp ile sat' },
            { ic: '📊', title: '6 Rapor', sub: 'Kâr-zarar, KDV, en çok satan' },
            { ic: '🤖', title: 'PetPro Asistan', sub: 'Sipariş + transfer + indirim önerisi' },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15"
            >
              <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl border border-white/20 bg-white/20 text-lg">
                {f.ic}
              </div>
              <div className="text-sm font-bold leading-tight">{f.title}</div>
              <div className="mt-1 text-[13px] leading-snug opacity-80">{f.sub}</div>
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-auto flex items-center gap-3 pt-6 text-[12.5px] font-bold uppercase tracking-wider opacity-80">
          <span>⚡ Cloudflare Workers</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span>🔒 KVKK uyumlu</span>
        </div>
      </aside>

      {/* ============ SAĞ FORM PANELİ ============ */}
      <section className="relative flex items-center justify-center overflow-hidden bg-[#fafaf7] p-10">
        <div className="relative z-10 w-full max-w-[440px]">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-cat">
            Pet shop ekle
          </div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink">
            Ücretsiz başla
          </h2>
          <p className="mt-2 text-[15px] leading-normal text-ink-3">
            FREE 50 ürün · kredi kartı gerekmez · 2 dakikada hazır.
          </p>

          {state?.error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
            >
              {state.error}
            </div>
          )}

          <form action={formAction} className="mt-7 flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="shopName">
                Pet shop adı
              </label>
              <input
                id="shopName"
                name="shopName"
                type="text"
                placeholder="Mavi Pet Shop"
                autoComplete="organization"
                required
                disabled={pending}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="email">
                E-posta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="ornek@petshop.com"
                autoComplete="email"
                required
                disabled={pending}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="password">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="En az 8 karakter, 1 büyük + 1 rakam"
                autoComplete="new-password"
                required
                disabled={pending}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            {/* KVKK çift checkbox — 2026-05-14 zorunlu (Madde 10 + Madde 9) */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-line-soft px-3.5 py-3 text-xs leading-relaxed text-ink-2">
              <input
                type="checkbox"
                name="kvkkConsent"
                required
                className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-cat"
              />
              <span>
                <strong className="text-cart">KVKK Aydınlatma Metni</strong>&apos;ni okudum, kişisel verilerimin işlenmesini onaylıyorum (Md. 10).{' '}
                <a href="/legal/kvkk" className="font-bold text-cat hover:underline">
                  Detay
                </a>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-line-soft px-3.5 py-3 text-xs leading-relaxed text-ink-2">
              <input
                type="checkbox"
                name="dataLocationConsent"
                required
                className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-cat"
              />
              <span>
                Verilerin <strong className="text-cart">Avrupa Birliği bölgesinde</strong>{' '}
                işlenmesine açık rıza veriyorum (KVKK Md. 9).{' '}
                <a href="/legal/eu-data" className="font-bold text-cat hover:underline">
                  Detay
                </a>
              </span>
            </label>

            <button
              type="submit"
              disabled={pending}
              className="mt-1.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(212,74,20,0.34)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(212,74,20,0.38)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {pending ? (
                <span className="text-xs tracking-wider">Hesap oluşturuluyor...</span>
              ) : (
                <>
                  Pet shop&apos;umu oluştur
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center text-[14.5px] text-ink-3">
            Zaten hesabın var mı?{' '}
            <a
              href="/login"
              className="border-b border-dashed border-cart font-bold text-cart hover:border-cat hover:text-cat"
            >
              Giriş yap
            </a>
          </div>

          <div className="mt-5 rounded-lg border border-line bg-paper px-3 py-2.5 text-[12px] leading-snug text-ink-4 text-center">
            <strong className="text-cart">Cloudflare Turnstile</strong> bot koruması +{' '}
            <strong className="text-cart">HIBP</strong> şifre sızıntı kontrolü Sprint 2.3&apos;te aktif olacak.
          </div>
        </div>
      </section>
    </div>
  );
}
