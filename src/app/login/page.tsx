'use client';

import { useActionState, useRef, useState } from 'react';
import Image from 'next/image';
import { Package, Store, BarChart3, type LucideIcon } from 'lucide-react';
import { extractRecoveryCodesFromText } from '@/lib/auth/recovery-codes';
import { useSwalOnError, useSwalOnErrorString } from '@/lib/ui/use-swal-on-error';
import { loginAction, type LoginState } from './actions';

const HERO_FEATURES: { title: string; sub: string; icon?: LucideIcon; img?: string }[] = [
  { icon: Package, title: 'Stok Takip', sub: 'Çoklu şube, sayım, immutable ledger' },
  { icon: Store, title: 'Vitrin', sub: 'Müşteri bul, WhatsApp ile sat' },
  { icon: BarChart3, title: '6 Rapor', sub: 'Kâr-zarar, KDV, en çok satan' },
  { img: '/chatbot.png', title: 'PetPro Asistan', sub: 'Sipariş + transfer + indirim önerisi' },
];

/**
 * Login Page — Sprint 2.1
 *
 * Tasarım: preview/login.html'den port (2 sütun split + logo watermark)
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
  // remainingAttempts banner'ları inline UX info olarak kalır (3/2/1 renkli),
  // sadece error mesajı SWAL'a taşınır (banner kaldırıldı).
  useSwalOnError(
    state &&
      (state.remainingAttempts === null ||
        state.remainingAttempts === undefined ||
        state.remainingAttempts > 3)
      ? state
      : null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  useSwalOnErrorString(uploadError, 'Yedek kod dosyası');
  // Field-level kızartma — error varsa email/password/totp input'una aria-invalid set et.
  const hasError = !!state?.error;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const totpInputRef = useRef<HTMLInputElement | null>(null);

  const handleRecoveryFile = async (file: File | null | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (file.size > 64 * 1024) {
      setUploadError('Dosya çok büyük (max 64 KB). Doğru yedek kod dosyasını seç.');
      return;
    }
    try {
      const text = await file.text();
      const found = extractRecoveryCodesFromText(text);
      if (found.length === 0) {
        setUploadError('Dosyada geçerli yedek kod bulunamadı (ABCD-EFGH formatı).');
        return;
      }
      setRecoveryCodes(found);
    } catch {
      setUploadError('Dosya okunamadı. Tekrar dene.');
    }
  };

  const selectRecoveryCode = (code: string) => {
    if (totpInputRef.current) {
      totpInputRef.current.value = code;
      totpInputRef.current.focus();
    }
    setRecoveryCodes(null);
    setUploadError(null);
  };

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
          {HERO_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-white/40 hover:bg-white/[0.16] hover:shadow-[0_16px_34px_rgba(0,0,0,0.22)]"
              >
                {/* hover glow */}
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/20 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative mb-2.5 grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-white/40 to-white/10 shadow-lg ring-1 ring-inset ring-white/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  {f.img ? (
                    <Image src={f.img} alt="" width={48} height={48} className="h-full w-full object-cover" />
                  ) : Icon ? (
                    <Icon className="h-[23px] w-[23px] text-white drop-shadow" strokeWidth={2.2} />
                  ) : null}
                </div>
                <div className="text-sm font-bold leading-tight">{f.title}</div>
                <div className="mt-1 text-[13px] leading-snug opacity-80">{f.sub}</div>
              </div>
            );
          })}
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
                aria-invalid={hasError || undefined}
                className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15 read-only:bg-line-soft"
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
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  defaultValue={state?.password ?? ''}
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
                  ref={totpInputRef}
                  name="totp"
                  type="text"
                  inputMode="text"
                  placeholder="- - - - - -"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  disabled={pending}
                  maxLength={20}
                  aria-invalid={hasError || undefined}
                  className="w-full rounded-xl border-[1.5px] border-cat bg-white px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-ink transition-all focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
                <p className="mt-1.5 text-[12.5px] text-ink-4">
                  Authenticator app&apos;teki 6 haneli kod ya da yedek kod (ABCD-EFGH).
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="sr-only"
                  data-testid="recovery-upload-input"
                  onChange={(e) => handleRecoveryFile(e.target.files?.[0])}
                />

                {!recoveryCodes && (
                  <button
                    type="button"
                    data-testid="recovery-upload-trigger"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={pending}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-cat/40 bg-cat-soft/40 px-3 py-1.5 text-[12.5px] font-bold text-cart hover:bg-cat-soft disabled:opacity-50"
                  >
                    📎 Yedek kod dosyası yükle (.txt)
                  </button>
                )}

                {recoveryCodes && recoveryCodes.length > 0 && (
                  <div
                    data-testid="recovery-picker"
                    className="mt-3 rounded-xl border border-cat/30 bg-cat-soft/30 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[12.5px] font-bold text-cart">
                        {recoveryCodes.length} kod bulundu — birini seç:
                      </div>
                      <button
                        type="button"
                        data-testid="recovery-picker-cancel"
                        onClick={() => setRecoveryCodes(null)}
                        className="text-[12px] text-ink-4 hover:text-cart"
                      >
                        İptal
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {recoveryCodes.map((code) => (
                        <button
                          type="button"
                          key={code}
                          data-testid="recovery-picker-option"
                          onClick={() => selectRecoveryCode(code)}
                          className="rounded-lg border border-line bg-white px-2 py-1.5 text-center font-mono text-[12.5px] text-ink-2 transition-colors hover:border-cat hover:bg-cat-soft hover:text-cart"
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11.5px] text-ink-4">
                      ⚠ Her kod tek kullanımlık — kullandığını dosyandan sil veya işaretle.
                    </p>
                  </div>
                )}
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
    </div>
  );
}
