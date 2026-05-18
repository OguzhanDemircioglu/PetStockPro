'use client';

import { useActionState } from 'react';
import Image from 'next/image';
import { loginAction, type LoginState } from './actions';

/**
 * Login Page — Sprint 2.1
 *
 * Tasarım: preview/login.html'den port (2 sütun split + paw pattern + mascot watermark)
 * Logic: Auth.js v5 Credentials provider + bcryptjs + brute-force lock state
 *
 * Sprint 2.2'de eklenecek:
 *   - Register state + slide animation (login ↔ register)
 *   - KVKK çift checkbox
 *   - Cloudflare Turnstile widget
 *
 * Sprint 2.3+:
 *   - Email verification flow
 *   - Forgot password / reset
 *   - 2FA TOTP step (twoFactorEnabled=true ise)
 *   - Account locked screen + countdown
 */
export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState | null, FormData>(
    loginAction,
    null,
  );

  return (
    <div className="grid h-screen w-screen grid-cols-1 overflow-hidden md:grid-cols-2">
      {/* ============ SOL HERO PANEL ============ */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#d44a14] via-[#ed6a2c] to-[#c25510] px-14 py-14 text-white">
        {/* Paw pattern background */}
        <span
          className="pointer-events-none absolute inset-[-20%] z-0 animate-[paw-rotate_90s_linear_infinite]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><g fill='%23ffffff' fill-opacity='0.06'><ellipse cx='44' cy='62' rx='11' ry='14'/><ellipse cx='70' cy='46' rx='8' ry='11'/><ellipse cx='20' cy='46' rx='8' ry='11'/><ellipse cx='30' cy='24' rx='7' ry='9'/><ellipse cx='60' cy='24' rx='7' ry='9'/></g></svg>\")",
            backgroundSize: '320px 320px',
          }}
        />

        {/* Mascot watermark — sağ-alt */}
        <span
          className="pointer-events-none absolute -bottom-8 -right-12 z-0 h-80 w-80 rotate-[-8deg] opacity-10"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 200'><ellipse cx='80' cy='130' rx='52' ry='56' fill='%23fff'/><circle cx='66' cy='124' r='5' fill='%23d44a14'/><circle cx='94' cy='124' r='5' fill='%23d44a14'/><ellipse cx='170' cy='135' rx='52' ry='52' fill='%23fff'/><circle cx='156' cy='130' r='5' fill='%23d44a14'/><circle cx='184' cy='130' r='5' fill='%23d44a14'/></svg>\")",
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Bottom gradient bar */}
        <span className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] h-1.5 bg-gradient-to-r from-cart via-bars via-arrow to-cat-7" />

        {/* TOP: Logo + tagline */}
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

        {/* MID: Slogan */}
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
            Pet shop&apos;unun envanteri, satışı, vitrini ve raporları —{' '}
            <strong className="rounded bg-white/20 px-2 py-0.5 font-bold">tek panelde, sade</strong>.
            Cloudflare edge altyapısında çalışır.
          </p>
        </div>

        {/* FEATURE GRID — 4 kart */}
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

        {/* BOTTOM: Tech credibility */}
        <div className="relative z-10 mt-auto flex items-center gap-3 pt-6 text-[12.5px] font-bold uppercase tracking-wider opacity-80">
          <span>⚡ Cloudflare Workers</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span>🔒 KVKK uyumlu</span>
        </div>
      </aside>

      {/* ============ SAĞ FORM PANELİ ============ */}
      <section className="relative flex items-center justify-center overflow-hidden bg-[#fafaf7] p-10">
        <div className="relative z-10 w-full max-w-[440px]">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-cat">Giriş</div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink">
            Hesabına giriş yap
          </h2>
          <p className="mt-2 text-[15px] leading-normal text-ink-3">
            Pet shop&apos;unu yönet — stok, satış, vitrin tek panelde.
          </p>

          {/* 2FA prompt banner */}
          {state?.requires2fa && !state.error && (
            <div className="mt-6 rounded-xl border border-cat/30 bg-cat-soft px-4 py-3 text-sm text-cart">
              🛡 <strong>Hesabında 2FA aktif.</strong> Authenticator app&apos;ten 6 haneli kodu gir
              ya da yedek kodlardan birini kullan (ABCD-EFGH).
            </div>
          )}

          {/* Sprint 2.7 — Kalan hak banner (EKRAN-AUTH §2.3) */}
          {state?.remainingAttempts !== null &&
            state?.remainingAttempts !== undefined &&
            state.remainingAttempts <= 3 && (
              <div
                role="alert"
                className={
                  state.remainingAttempts === 1
                    ? 'mt-6 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7'
                    : state.remainingAttempts === 2
                      ? 'mt-6 rounded-xl border border-cat/40 bg-cat-soft px-4 py-3 text-sm font-bold text-cart'
                      : 'mt-6 rounded-xl border border-bars/30 bg-bars-soft px-4 py-3 text-sm font-bold text-bars'
                }
              >
                {state.remainingAttempts === 1 ? (
                  <>
                    ⚠ <strong>1 hakkın kaldı.</strong> Bir sonraki yanlışta hesabın{' '}
                    <strong>1 saat kilitlenecek</strong>.{' '}
                    <a href="/forgot-password" className="underline">
                      Şifremi unuttum →
                    </a>
                  </>
                ) : state.remainingAttempts === 2 ? (
                  <>
                    ⚠ <strong>2 hakkın kaldı.</strong> Şifreni unuttun mu?{' '}
                    <a href="/forgot-password" className="underline">
                      Şifremi unuttum →
                    </a>
                  </>
                ) : (
                  <>
                    🟡 <strong>{state.remainingAttempts} hakkın kaldı.</strong>
                  </>
                )}
              </div>
            )}

          {/* Error banner (kalan hak yoksa veya 4+ ise gösterilir) */}
          {state?.error &&
            (state.remainingAttempts === null ||
              state.remainingAttempts === undefined ||
              state.remainingAttempts > 3) && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
              >
                {state.error}
              </div>
            )}

          {/* Form */}
          <form action={formAction} className="mt-7 flex flex-col gap-3.5">
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
                readOnly={state?.requires2fa}
                defaultValue={state?.email ?? ''}
                disabled={pending}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15 read-only:bg-line-soft"
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
                placeholder="••••••••"
                autoComplete="current-password"
                required
                defaultValue={state?.password ?? ''}
                disabled={pending}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            {state?.requires2fa && (
              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="totp"
                >
                  2FA Kodu
                </label>
                <input
                  id="totp"
                  name="totp"
                  type="text"
                  inputMode="text"
                  placeholder="123456 veya ABCD-EFGH"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  disabled={pending}
                  maxLength={20}
                  className="w-full rounded-xl border-[1.5px] border-cat bg-white px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-ink transition-all focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
                <p className="mt-1.5 text-[12.5px] text-ink-4">
                  Authenticator app&apos;teki 6 haneli kod ya da yedek kod (ABCD-EFGH).
                </p>
              </div>
            )}

            <div className="mt-0.5 flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-[14px] text-ink-2">
                <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-cat" />
                Beni hatırla
              </label>
              <a
                href="/forgot-password"
                className="border-b border-dashed border-transparent text-[14px] font-bold text-cart transition-colors hover:border-cart"
              >
                Şifremi unuttum?
              </a>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="mt-1.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(212,74,20,0.34)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(212,74,20,0.38)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {pending ? (
                <span className="text-xs tracking-wider">Bağlanılıyor...</span>
              ) : (
                <>
                  Hesabıma giriş yap
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center text-[14.5px] text-ink-3">
            Hesabın yok mu?{' '}
            <a
              href="/register"
              className="border-b border-dashed border-cart font-bold text-cart hover:border-cat hover:text-cat"
            >
              Pet shop&apos;unu ücretsiz ekle
            </a>
          </div>

          {/* Trust strip */}
          <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-line-soft pt-4 text-[12px] tracking-wide text-ink-4">
            <span className="font-bold">🔒 Cloudflare Turnstile</span>
            <span className="font-bold">✓ KVKK uyumlu</span>
            <span className="font-bold">🆓 FREE 50 ürün</span>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes paw-rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
