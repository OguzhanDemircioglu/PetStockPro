import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/db/schema';
import { verifyEmailToken } from '@/lib/auth/email-verification';
import { claimPromoSlot } from '@/lib/promo/first-100';

/**
 * Verify Email Token Handler — Server Component
 *
 * URL: /verify-email/[token]
 * Flow:
 *   1. DB'den user bul (emailVerificationToken = token)
 *   2. verifyEmailToken (timing-safe + expiry)
 *   3. Başarılı → emailVerifiedAt = now + token alanlarını temizle
 *   4. UI: success/expired/invalid göster
 *
 * Next.js 16: params async (await gerek)
 */
export default async function VerifyEmailTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // DB lookup
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.emailVerificationToken, token))
    .limit(1);
  const user = rows[0];

  // Token bulunamadı veya zaten kullanıldı
  if (!user) {
    return <VerifyResult status="invalid" />;
  }

  // Daha önce verify edilmiş kontrolü
  if (user.emailVerifiedAt) {
    return <VerifyResult status="already_verified" email={user.email} />;
  }

  // Token + expiry kontrol
  const result = verifyEmailToken(
    {
      emailVerificationToken: user.emailVerificationToken,
      emailVerificationExpiresAt: user.emailVerificationExpiresAt,
      emailVerificationResendCount: user.emailVerificationResendCount,
      emailVerificationLastSentAt: user.emailVerificationLastSentAt,
    },
    token,
  );

  if (!result.ok) {
    return <VerifyResult status={result.reason} email={user.email} />;
  }

  // Başarılı — DB'de verify state
  await db
    .update(users)
    .set({
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
    })
    .where(eq(users.id, user.id));

  // İlk 100 Promo — sadece BAYI_SAHIBI (tenant sahibi) verify olunca claim et.
  // Atomik UPDATE, idempotent (zaten claim edilmişse no-op).
  if (user.companyId && user.role === 'BAYI_SAHIBI') {
    try {
      await claimPromoSlot(db, user.companyId);
    } catch (e) {
      // Promo claim hatası verify akışını bozmamalı (silent fail, log).
      console.error('[verify-email] claimPromoSlot failed:', (e as Error).message);
    }
  }

  return <VerifyResult status="success" email={user.email} />;
}

// ─────────────────────────────────────────────────────────────────

type VerifyStatus = 'success' | 'expired' | 'invalid_token' | 'invalid' | 'already_verified';

function VerifyResult({ status, email }: { status: VerifyStatus; email?: string }) {
  const config: Record<VerifyStatus, { emoji: string; title: string; body: string; cta: string }> = {
    success: {
      emoji: '✅',
      title: 'E-posta doğrulandı',
      body: `${email ?? 'Hesabın'} aktive edildi. Şimdi giriş yapabilirsin.`,
      cta: 'Giriş yap →',
    },
    already_verified: {
      emoji: '✓',
      title: 'Zaten doğrulanmış',
      body: `${email ?? 'Hesabın'} daha önce doğrulanmış. Direkt giriş yapabilirsin.`,
      cta: 'Giriş yap →',
    },
    expired: {
      emoji: '⏰',
      title: 'Linkin süresi dolmuş',
      body: 'Doğrulama linki 24 saat geçerliydi. Tekrar gönderim için "Yeniden gönder" (Sprint 2.4) butonunu kullan.',
      cta: 'Giriş ekranına dön',
    },
    invalid_token: {
      emoji: '❌',
      title: 'Geçersiz link',
      body: 'Bu link geçerli değil ya da daha önce kullanıldı. Yeni bir doğrulama maili iste.',
      cta: 'Giriş ekranına dön',
    },
    invalid: {
      emoji: '❌',
      title: 'Link bulunamadı',
      body: 'Bu doğrulama linki bulunamadı veya iptal edildi. Tekrar kaydolmayı dene.',
      cta: 'Kayıt sayfasına dön',
    },
  };

  const c = config[status];
  const isSuccess = status === 'success' || status === 'already_verified';
  const ctaHref = isSuccess ? '/login' : status === 'invalid' ? '/register' : '/login';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        <div className="mb-6 flex justify-center">
          <div
            className={`grid h-16 w-16 place-items-center rounded-2xl text-3xl ${
              isSuccess ? 'bg-arrow-soft' : 'bg-danger-soft'
            }`}
          >
            {c.emoji}
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-cart">
          {c.title}
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-ink-3">{c.body}</p>

        <div className="mt-8 text-center">
          <Link
            href={ctaHref as never}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] transition-transform hover:-translate-y-0.5"
          >
            {c.cta}
          </Link>
        </div>
      </div>
    </main>
  );
}
