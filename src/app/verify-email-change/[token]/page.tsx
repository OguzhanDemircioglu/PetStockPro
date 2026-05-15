import Link from 'next/link';
import { db } from '@/lib/db/client';
import { verifyEmailChange } from '@/lib/auth/change-email';

/**
 * /verify-email-change/[token] — yeni email tıklama hedefi (Sprint 2.9)
 *
 * Server component:
 *   1. Token validate + expiry check
 *   2. UPDATE users SET email=pendingEmail + pendingEmail*=NULL
 *   3. Brevo final notify eski email
 *   4. UI: success/expired/invalid
 */
export default async function VerifyEmailChangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyEmailChange(token, db);

  const config = result.ok
    ? {
        emoji: '✅',
        title: 'E-posta değiştirildi',
        body: (
          <>
            Yeni e-postan <strong>{result.newEmail}</strong> aktive edildi.
            Bundan sonra giriş için bu adresi kullan.
          </>
        ),
        cta: 'Giriş yap →',
        href: '/login',
        success: true,
      }
    : result.reason === 'expired'
      ? {
          emoji: '⏰',
          title: 'Bağlantının süresi dolmuş',
          body: '24 saat geçerliydi. /admin/account sayfasından tekrar değişiklik isteği başlat.',
          cta: 'Hesap sayfasına git',
          href: '/admin/account',
          success: false,
        }
      : {
          emoji: '❌',
          title: 'Geçersiz bağlantı',
          body: 'Bu bağlantı geçerli değil ya da daha önce kullanıldı.',
          cta: 'Hesap sayfasına git',
          href: '/admin/account',
          success: false,
        };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        <div className="mb-6 flex justify-center">
          <div
            className={`grid h-16 w-16 place-items-center rounded-2xl text-3xl ${
              config.success ? 'bg-arrow-soft' : 'bg-danger-soft'
            }`}
          >
            {config.emoji}
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-cart">
          {config.title}
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-ink-3">{config.body}</p>

        <div className="mt-8 text-center">
          <Link
            href={config.href as never}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] transition-transform hover:-translate-y-0.5"
          >
            {config.cta}
          </Link>
        </div>
      </div>
    </main>
  );
}
