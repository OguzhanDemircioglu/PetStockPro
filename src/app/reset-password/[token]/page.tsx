import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/db/schema';
import { verifyResetToken } from '@/lib/auth/password-reset';
import { ResetForm } from './reset-form';

/**
 * Reset Password Token Handler — Server Component
 *
 * URL: /reset-password/[token]
 * Flow:
 *   1. DB'den user bul (passwordResetToken = token)
 *   2. verifyResetToken (timing-safe + expiry)
 *   3. Token geçerli → ResetForm render (client component)
 *   4. Token invalid/expired → error UI
 *
 * Bu sayfa form'u render etmek ile geçersiz token'ı erkenden filtrelemek
 * arasındaki UX trade-off için bölündü. verify-email/[token] pattern'ı.
 */
export default async function ResetPasswordTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!token || token.length < 20) {
    return <ResetResult status="invalid" />;
  }

  // DB lookup
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordResetToken: users.passwordResetToken,
      passwordResetExpiresAt: users.passwordResetExpiresAt,
    })
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);
  const user = rows[0];

  if (!user) {
    return <ResetResult status="invalid_token" />;
  }

  // Token validity check (timing-safe + expiry)
  const verifyResult = verifyResetToken(
    {
      passwordResetToken: user.passwordResetToken,
      passwordResetExpiresAt: user.passwordResetExpiresAt,
    },
    token,
  );

  if (!verifyResult.ok) {
    return <ResetResult status={verifyResult.reason} />;
  }

  // Token geçerli — form render
  return <ResetForm token={token} email={user.email} />;
}

// ─────────────────────────────────────────────────────────────────

type ResetStatus = 'expired' | 'invalid_token' | 'invalid';

function ResetResult({ status }: { status: ResetStatus }) {
  const config: Record<ResetStatus, { emoji: string; title: string; body: string }> = {
    expired: {
      emoji: '⏰',
      title: 'Bağlantının süresi dolmuş',
      body: 'Sıfırlama bağlantısı 30 dakika geçerliydi. Yeni bir sıfırlama isteği oluştur.',
    },
    invalid_token: {
      emoji: '❌',
      title: 'Geçersiz bağlantı',
      body: 'Bu sıfırlama bağlantısı geçerli değil ya da daha önce kullanılmış. Yeni bir bağlantı iste.',
    },
    invalid: {
      emoji: '❌',
      title: 'Bağlantı hatalı',
      body: 'Sıfırlama bağlantısı tanınmıyor. Lütfen e-postandan tıklayarak gel.',
    },
  };

  const c = config[status];

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        <div className="mb-6 flex justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-danger-soft text-3xl">
            {c.emoji}
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-cart">
          {c.title}
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-ink-3">{c.body}</p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href={'/forgot-password' as never}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] transition-transform hover:-translate-y-0.5"
          >
            Yeni sıfırlama bağlantısı iste
          </Link>
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
