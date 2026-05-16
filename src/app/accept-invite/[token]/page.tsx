import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, companies } from '@/db/schema';
import { verifyResetToken } from '@/lib/auth/password-reset';
import { AcceptInviteForm } from './accept-form';

/**
 * Davet kabul sayfası — passwordResetToken reuse.
 *
 * /admin/settings/users sayfasından gönderilen davet linki buraya gelir.
 * Token /reset-password ile aynı field (passwordResetToken) — ama UX
 * farklı: "şifre belirle + ekibe katıl" mesajı.
 *
 * Server-side token doğrulama + AcceptInviteForm render. Form submit
 * /reset-password action'ına gider (aynı completePasswordReset helper +
 * emailVerifiedAt COALESCE NULL → now).
 */
export default async function AcceptInviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 20) return <InviteError status="invalid" />;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      passwordResetToken: users.passwordResetToken,
      passwordResetExpiresAt: users.passwordResetExpiresAt,
      companyId: users.companyId,
      companyName: companies.name,
    })
    .from(users)
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.passwordResetToken, token))
    .limit(1);
  const user = rows[0];
  if (!user) return <InviteError status="invalid_token" />;

  const verifyResult = verifyResetToken(
    {
      passwordResetToken: user.passwordResetToken,
      passwordResetExpiresAt: user.passwordResetExpiresAt,
    },
    token,
  );
  if (!verifyResult.ok) return <InviteError status={verifyResult.reason} />;

  // Zaten passwordHash varsa: bu kullanıcı zaten hesabını aktive etmiş. Login'e yönlendir.
  if (user.passwordHash) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-arrow-soft via-bg to-cat-soft px-6 py-16">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)] text-center">
          <div className="mb-4 text-4xl">✓</div>
          <h1 className="text-2xl font-bold text-cart">Hesap zaten aktif</h1>
          <p className="mt-3 text-sm text-ink-3">
            Bu davet zaten kullanılmış — {user.email} için hesap aktif. Giriş yap.
          </p>
          <Link
            href={'/login' as never}
            className="mt-6 inline-flex rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white"
          >
            Giriş ekranı →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AcceptInviteForm
      token={token}
      email={user.email}
      companyName={user.companyName ?? 'Pet shop'}
    />
  );
}

type InviteStatus = 'expired' | 'invalid_token' | 'invalid';

function InviteError({ status }: { status: InviteStatus }) {
  const config: Record<InviteStatus, { emoji: string; title: string; body: string }> = {
    expired: {
      emoji: '⏰',
      title: 'Davetin süresi dolmuş',
      body: 'Davet linki artık geçerli değil. Yönetici tekrar davet göndermeli.',
    },
    invalid_token: {
      emoji: '❌',
      title: 'Geçersiz davet linki',
      body: 'Bu davet linki tanınmıyor ya da daha önce kullanılmış.',
    },
    invalid: {
      emoji: '❌',
      title: 'Bağlantı hatalı',
      body: 'Davet linki tanınmıyor. URL\'yi doğru kopyaladığından emin ol.',
    },
  };
  const c = config[status];

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)] text-center">
        <div className="mb-6 text-4xl">{c.emoji}</div>
        <h1 className="text-2xl font-bold text-cart">{c.title}</h1>
        <p className="mt-3 text-sm text-ink-3">{c.body}</p>
        <Link
          href={'/login' as never}
          className="mt-6 inline-flex rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink-2"
        >
          Giriş ekranına dön
        </Link>
      </div>
    </main>
  );
}
