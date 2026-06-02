import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { users } from '@/db/schema';
import { MarketingHeader } from '@/components/marketing/header';
import { MarketingFooter } from '@/components/marketing/footer';
import { StagingDemoButton } from './staging-demo-button';

interface Feature {
  icon: string;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: '📦',
    title: 'Stok takip',
    body: 'Çoklu şube, immutable ledger, sayım oturumu, düşük stok uyarısı + transfer önerisi.',
  },
  {
    icon: '🏪',
    title: 'Vitrin',
    body: 'petstockpro.com/vitrin dizininde görünür ol; müşteri WhatsApp ile direkt sana yazsın.',
  },
  {
    icon: '📊',
    title: '6 Rapor',
    body: 'Günlük satış, en çok satan ürünler, KDV özeti, audit aktivitesi, sayım geçmişi.',
  },
];

interface PlanCard {
  name: string;
  price: string;
  limit: string;
  highlight?: boolean;
}

const PLAN_CARDS: PlanCard[] = [
  { name: 'FREE', price: '0 ₺', limit: '50 ürün' },
  { name: 'PRO', price: '1.000 ₺/ay', limit: '500 ürün', highlight: true },
  { name: 'PRO+', price: '2.000 ₺/ay', limit: 'Sınırsız' },
];

export default async function Home() {
  const session = await auth();

  if (session?.user?.id) {
    if (session.user.role === 'SUPERADMIN') {
      redirect('/admin/superadmin' as never);
    }
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

  // Staging mockup landing — anonim ziyaretçiye direkt 2-button önizleme ekranı
  if (process.env.NEXT_PUBLIC_STAGING_MODE === 'true') {
    return <StagingDemoLanding />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-cat-soft/40 via-paper to-arrow-soft/30" />
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.2fr_1fr] md:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-cat-soft px-3 py-1 text-[11.5px] font-bold uppercase tracking-wider text-cat-7">
                🇹🇷 Türkiye&apos;deki pet shop&apos;lar için
              </div>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-cart sm:text-5xl">
                Stoktan satışa,
                <br />
                <span className="text-cat">vitrinden rapora.</span>
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
                Pet shop&apos;unun envanteri, satışı, vitrini ve raporları —
                tek panelde, sade. Cloudflare edge altyapısında, KVKK
                uyumlu, Nilvera e-Arşiv ile fatura entegrasyonlu.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-3 text-[14.5px] font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
                >
                  Pet shop&apos;unu ücretsiz ekle →
                </Link>
                <Link
                  href="/fiyatlar"
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-[14.5px] font-bold text-cart hover:border-cat"
                >
                  Fiyatları gör
                </Link>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
                <span>🆓 FREE plan 50 ürüne kadar ücretsiz</span>
                <span>✓ Kredi kartı istemiyoruz</span>
              </div>
            </div>

            {/* Feature grid önizleme — sağ kolon */}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-line bg-paper p-4 shadow-sm"
                >
                  <div className="text-2xl">{f.icon}</div>
                  <h3 className="mt-2 text-[14.5px] font-bold text-cart">
                    {f.title}
                  </h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING TEASER */}
        <section className="border-b border-line bg-line-soft/30 px-6 py-14">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-cat-soft px-3 py-1 text-[11.5px] font-bold uppercase tracking-wider text-cat-7">
                💳 3 plan
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-cart">
                Tek farklılaşma: stok limiti
              </h2>
              <p className="mt-2 text-[14px] text-ink-3">
                Diğer her şey eşit — vitrin, çoklu şube, audit, asistan,
                raporlar.
              </p>
            </div>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {PLAN_CARDS.map((p) => (
                <li
                  key={p.name}
                  className={
                    p.highlight
                      ? 'rounded-2xl border-2 border-cat bg-paper p-5 shadow-[var(--shadow-cat)]'
                      : 'rounded-2xl border border-line bg-paper p-5'
                  }
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[16px] font-bold text-cart">
                      {p.name}
                    </span>
                    {p.highlight && (
                      <span className="rounded-full bg-cat px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Popüler
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-3xl font-bold text-cart">
                    {p.price}
                  </div>
                  <div className="text-[12.5px] text-ink-3">{p.limit}</div>
                </li>
              ))}
            </ul>
            <div className="mt-6 text-center">
              <Link
                href="/fiyatlar"
                className="inline-flex items-center gap-2 text-[14px] font-bold text-cat-7 hover:underline"
              >
                Detaylı karşılaştırma →
              </Link>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="px-6 py-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
            <span>⚡ Cloudflare Workers</span>
            <span>🔒 KVKK uyumlu</span>
            <span>📜 Nilvera e-Arşiv</span>
            <span>💳 iyzico güvenli ödeme</span>
            <span>🇹🇷 TR yerleşik</span>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="border-t border-line bg-gradient-to-br from-cat-soft/40 to-arrow-soft/30 px-6 py-14">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-cart">
              Pet shop&apos;unu 5 dakikada kur
            </h2>
            <p className="mt-3 text-[14px] text-ink-2">
              FREE planla başla, 50 ürünü dene. Hazır olduğunda PRO&apos;ya
              geçersin.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-3 text-[14.5px] font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
              >
                Ücretsiz başla →
              </Link>
              <Link
                href="/iletisim"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-[14.5px] font-bold text-cart hover:border-cat"
              >
                Soru sor
              </Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

/**
 * Staging-only landing — mockup ziyaretçisine 2 büyük önizleme butonu sunar.
 * Production'da render edilmez (NEXT_PUBLIC_STAGING_MODE flag gate).
 */
function StagingDemoLanding() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-paper to-cat-soft/30">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
        <Image
          src="/logo.webp"
          alt="PetStockPro"
          width={160}
          height={160}
          className="h-36 w-36 object-contain"
          priority
        />

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-cat-soft px-4 py-1.5 text-[12.5px] font-bold uppercase tracking-wider text-cart">
          <span aria-hidden>🛠</span>
          Önizleme / Staging
        </div>

        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-cart sm:text-5xl">
          PetStockPro&apos;ya hoş geldin
        </h1>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-2">
          Pet shop&apos;lar için <strong>stok takip + bayi yönetim</strong>{' '}
          platformu. E-ticaret değil — sahibi WhatsApp&apos;tan müşteriyle
          buluşturan dizin. Aşağıdaki iki sekmeden önizleyebilirsin.
        </p>

        <div className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          {/* Bayi Yönetim Paneli Önizle */}
          <StagingDemoButton
            testId="staging-admin-preview"
            className="group flex w-full flex-col items-start gap-3 rounded-2xl border-2 border-cat/40 bg-gradient-to-br from-cat to-cat-2 p-6 text-left text-white shadow-[var(--shadow-cat)] transition-transform hover:-translate-y-1 disabled:opacity-80 disabled:cursor-progress disabled:translate-y-0"
            pendingText="Bayi paneline yönlendiriliyorsun…"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/20 text-2xl">
              🛡
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                Pet shop sahipleri için
              </div>
              <div className="mt-1 text-xl font-bold leading-tight">
                Bayi panelini önizle →
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-white/90">
              Stok takip, çoklu şube, sayım, raporlar — pet shop&apos;un tüm
              operasyonu tek panelde. Demo mock data ile gez.
            </p>
          </StagingDemoButton>

          {/* Vitrin Önizle */}
          <Link
            href={'/vitrin' as never}
            data-testid="staging-vitrin-preview"
            className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-arrow/40 bg-gradient-to-br from-arrow to-arrow-7 p-6 text-left text-white shadow-[var(--shadow-arrow)] transition-transform hover:-translate-y-1"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/20 text-2xl">
              🏪
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                Müşteriler için
              </div>
              <div className="mt-1 text-xl font-bold leading-tight">
                Vitrin&apos;i önizle →
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-white/90">
              Pet shop dizini — müşteri yakınındaki shop&apos;u bulur,
              WhatsApp&apos;tan direkt satıcıya yazar. Online sipariş yok,
              ödeme yok, biz aracı değiliz.
            </p>
          </Link>
        </div>

        <p className="mt-10 max-w-md text-[12.5px] text-ink-3">
          ℹ Gerçek hesap açma + ödeme akışı henüz aktif değil. Lansman için son
          hazırlıklar yapılıyor.
        </p>

        <p className="mt-6 text-[11.5px] text-ink-4">
          © 2026 PetStockPro · KVKK uyumlu · Cloudflare Workers altyapısı
        </p>
      </div>
    </main>
  );
}
