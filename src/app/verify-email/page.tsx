import Link from 'next/link';

/**
 * Verify Email — bekleme ekranı (register redirect sonrası)
 *
 * Sprint 2.3b temel: kullanıcıya "e-posta gönderildi" bilgisi.
 * Sprint 2.4'te eklenecek: resend butonu (60sn cooldown countdown + max 5/24h).
 */
export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        <div className="mb-6 flex justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cat-soft text-3xl">
            📧
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-cart">
          E-postanı kontrol et
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-ink-3">
          Hesabını aktive etmek için e-posta adresine doğrulama linki gönderdik.
          Linke tıklayarak kayıt işlemini tamamla.
        </p>

        <div className="mt-6 space-y-2 rounded-xl bg-line-soft px-4 py-3 text-xs leading-relaxed text-ink-2">
          <div className="flex items-start gap-2">
            <span className="text-cat">⏰</span>
            <span>
              Link <strong>24 saat</strong> geçerli. Süre dolarsa &quot;Yeniden gönder&quot;
              diyebilirsin (Sprint 2.4&apos;te aktif olur).
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-cat">📬</span>
            <span>
              E-posta gelmediyse <strong>Spam/Junk</strong> klasörüne bak.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-cat">🔒</span>
            <span>
              Hesabını <strong>7 gün</strong> içinde doğrulamazsan otomatik kilitlenir.
            </span>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-ink-4">
          Yanlış adres mi?{' '}
          <Link
            href={'/register' as never}
            className="border-b border-dashed border-cart font-bold text-cart hover:text-cat hover:border-cat"
          >
            Tekrar kaydol
          </Link>
        </div>
      </div>
    </main>
  );
}
