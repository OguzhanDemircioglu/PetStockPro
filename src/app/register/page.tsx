'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { Package, Store, BarChart3, Bot, type LucideIcon } from 'lucide-react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import { HeroDemoButtons } from '@/components/auth/hero-demo-buttons';
import { registerAction, type RegisterState } from './actions';

const HERO_FEATURES: { title: string; sub: string; icon: LucideIcon }[] = [
  { icon: Package, title: 'Stok Takibi', sub: 'Çoklu şube, canlı sayım, kaybolmayan kayıt' },
  { icon: Store, title: 'Dijital Vitrin', sub: 'Müşteriler seni bulsun, WhatsApp’tan sat' },
  { icon: BarChart3, title: '6 Canlı Rapor', sub: 'Kâr-zarar, KDV ve en çok satanlar' },
  { icon: Bot, title: 'AI Asistan', sub: 'Sipariş, transfer, indirimde akıllı öneri' },
];

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
 *   - (AB veri işleme açık rızası KVKK dokümanında belirtilir — ayrı checkbox YOK, 2026-06-10)
 *   - Submit → registerAction → /verify-email redirect
 */
export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<RegisterState | null, FormData>(
    registerAction,
    null,
  );
  useSwalOnError(state);
  // Field-level kızartma — error varsa shopName/email/password input'una aria-invalid set et.
  const hasError = !!state?.error;
  // Şifre göster/gizle — her iki alan bağımsız (login ile aynı desen).
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  return (
    <div className="grid h-screen w-screen grid-cols-1 overflow-hidden md:grid-cols-2">
      {/* ============ SOL HERO PANEL ============ */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#d44a14] via-[#ed6a2c] to-[#c25510] px-14 py-10 text-white">
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

        <div className="relative z-10 mt-8">
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

        {/* Demo önizleme — özellik kartlarının üstünde */}
        <HeroDemoButtons />

        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3">
          {HERO_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/40 hover:bg-white/[0.16] hover:shadow-[0_16px_34px_rgba(0,0,0,0.22)]"
              >
                {/* hover glow */}
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/20 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative mb-2.5 grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-white/40 to-white/10 shadow-lg ring-1 ring-inset ring-white/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  <Icon className="h-[23px] w-[23px] text-white drop-shadow" strokeWidth={2.2} />
                </div>
                <div className="text-[15px] font-bold leading-tight tracking-tight drop-shadow-sm">{f.title}</div>
                <div className="mt-1 text-[12.5px] font-medium leading-snug text-white/85">{f.sub}</div>
              </div>
            );
          })}
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
                aria-invalid={hasError || undefined}
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
                aria-invalid={hasError || undefined}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="password">
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="En az 8 karakter, 1 büyük + 1 rakam"
                  autoComplete="new-password"
                  required
                  disabled={pending}
                  aria-invalid={hasError || undefined}
                  className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 pr-12 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
                <button
                  type="button"
                  data-testid="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  tabIndex={-1}
                  disabled={pending}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-cat-soft hover:text-cat focus:outline-none focus:ring-2 focus:ring-cat/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="passwordConfirm">
                Şifre tekrar
              </label>
              <div className="relative">
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type={showPasswordConfirm ? 'text' : 'password'}
                  placeholder="Aynı şifreyi tekrar gir"
                  autoComplete="new-password"
                  required
                  disabled={pending}
                  aria-invalid={hasError || undefined}
                  className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 pr-12 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
                <button
                  type="button"
                  data-testid="password-confirm-toggle"
                  onClick={() => setShowPasswordConfirm((v) => !v)}
                  aria-label={showPasswordConfirm ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  aria-pressed={showPasswordConfirm}
                  title={showPasswordConfirm ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  tabIndex={-1}
                  disabled={pending}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-cat-soft hover:text-cat focus:outline-none focus:ring-2 focus:ring-cat/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showPasswordConfirm ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-[11.5px] text-ink-4">
                Yanlış yazımdan korunmak için ikinci kez gir — şifreler aynı olmalı.
              </p>
            </div>

            {/* KVKK Aydınlatma onayı (Madde 10) — zorunlu. AB veri işleme rızası KVKK dokümanında belirtilir. */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-line-soft px-3.5 py-3 text-xs leading-relaxed text-ink-2">
              <input
                type="checkbox"
                name="kvkkConsent"
                required
                className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 accent-cat"
              />
              <span>
                <strong className="text-cart">KVKK Aydınlatma Metni</strong>&apos;ni okudum, kişisel verilerimin işlenmesini onaylıyorum (Md. 10).{' '}
                <a href="/kvkk" className="font-bold text-cat hover:underline">
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
                  PetShop&apos;u oluştur
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
        </div>
      </section>
    </div>
  );
}
