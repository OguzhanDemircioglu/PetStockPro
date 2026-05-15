import Link from 'next/link';
import { db } from '@/lib/db/client';
import { cancelEmailChange } from '@/lib/auth/change-email';

/**
 * /cancel-email-change/[token] — eski email tıklama hedefi (Sprint 2.9)
 *
 * Server component:
 *   1. pendingEmail*=NULL (token bulunduysa)
 *   2. Telegram süperadmin alert (saldırı şüphesi)
 *   3. UI: iptal edildi / geçersiz
 */
export default async function CancelEmailChangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await cancelEmailChange(token, db);

  const isOk = result.ok;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        <div className="mb-6 flex justify-center">
          <div
            className={`grid h-16 w-16 place-items-center rounded-2xl text-3xl ${
              isOk ? 'bg-arrow-soft' : 'bg-danger-soft'
            }`}
          >
            {isOk ? '🚫' : '❌'}
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-cart">
          {isOk ? 'E-posta değişikliği iptal edildi' : 'Geçersiz bağlantı'}
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-ink-3">
          {isOk ? (
            <>
              Hesabın e-postası değiştirilmedi —{' '}
              <strong>{result.ok ? result.email : ''}</strong> olarak kaldı.
              Süperadmin de uyarıldı; hesap güvenliği için
              <strong> şifreni hemen değiştir</strong>.
            </>
          ) : (
            'Bu bağlantı geçerli değil ya da değişiklik isteği zaten iptal edildi.'
          )}
        </p>

        {isOk && (
          <div className="mt-6 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs leading-relaxed text-danger-7">
            ⚠ <strong>Hesabına saldırı şüphesi:</strong> Birisi e-postanı değiştirmeye
            çalıştı. Hemen şifreni sıfırla + 2FA aktif et.
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {isOk && (
            <Link
              href={'/forgot-password' as never}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] transition-transform hover:-translate-y-0.5"
            >
              🔑 Şifremi sıfırla →
            </Link>
          )}
          <Link
            href={'/login' as never}
            className="text-center text-xs text-ink-4 hover:text-cart"
          >
            Giriş ekranına dön
          </Link>
        </div>
      </div>
    </main>
  );
}
