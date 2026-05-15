import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { users } from '@/db/schema';

export default async function Home() {
  const session = await auth();

  // Auth'lı user:
  // - onboardingCompletedAt NULL → /onboarding redirect
  // - aksi halde /admin (Pano) redirect
  if (session?.user?.id) {
    const rows = await db
      .select({ onboardingCompletedAt: users.onboardingCompletedAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (rows[0] && !rows[0].onboardingCompletedAt) {
      redirect('/onboarding' as never);
    }
    redirect('/admin' as never);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-cat-soft text-cat-7 text-xs font-bold uppercase tracking-wider">
          🚧 Sprint 0 — Skeleton
        </div>

        <h1 className="text-5xl font-bold text-cart tracking-tight leading-tight">
          Stoktan satışa,<br />
          <span className="text-cat">vitrinden rapora.</span>
        </h1>

        <p className="mt-6 text-base text-ink-3 leading-relaxed max-w-lg mx-auto">
          PetStockPro Sprint 0 bootstrap aşamasında. Tasarım fazı tamamlandı —
          Next.js 16 + Drizzle + Auth.js + Supabase iskelet kuruluyor.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cat text-white font-bold shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
          >
            Giriş ekranına git →
          </Link>
          <a
            href="/preview/index.html"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-line bg-paper text-ink-2 font-bold hover:border-cart-2 hover:text-cart transition-colors"
          >
            Mockup önizlemeleri
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-line-soft text-xs text-ink-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-bold uppercase tracking-wide">
          <span>⚡ Cloudflare Workers</span>
          <span>·</span>
          <span>🔒 Supabase EU</span>
          <span>·</span>
          <span>✓ KVKK uyumlu</span>
          <span>·</span>
          <span>🆓 FREE 50 ürün</span>
        </div>
      </div>
    </main>
  );
}
