import Link from 'next/link';

/**
 * Login placeholder — Sprint 0 iskelet
 *
 * Gerçek implementasyon Sprint 2'de:
 * - preview/login.html mockup baz alınır (2 sütun split + slide animation)
 * - Auth.js v5 Credentials provider + Cloudflare Turnstile
 * - 2 KVKK checkbox (Aydınlatma + EU bölgesi açık rıza)
 * - HIBP password check + brute-force lock (5 fail → 1 saat)
 */
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-cat-soft text-cat-7 text-xs font-bold uppercase tracking-wider">
          🚧 Sprint 0 — Placeholder
        </div>

        <h1 className="text-3xl font-bold text-cart tracking-tight">
          Hesabına giriş yap
        </h1>
        <p className="mt-3 text-sm text-ink-3 leading-relaxed">
          Login ekranı Sprint 2'de implement edilecek.<br />
          Şu an için mockup önizlemesi: <Link href={'/' as never} className="text-cart font-bold border-b border-dashed border-cart hover:text-cat">ana sayfa</Link>
        </p>

        <a
          href="/preview/login.html"
          className="mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-cat text-white font-bold shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
        >
          Mockup'ı aç →
        </a>
      </div>
    </main>
  );
}
