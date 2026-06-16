import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { StagingDemoButton } from '../staging-demo-button';

export const metadata: Metadata = {
  title: 'Yapım Aşamasında — PetStockPro',
  description:
    "PetStockPro yakında! Pet shop hesap oluşturma henüz açık değil. Şimdilik bayi panelini ve vitrin'i önizleyebilirsin.",
  robots: { index: false, follow: false },
};

export default function YapimAsamasindaPage() {
  // Staging kapalıyken (lansman/production) "yapım aşamasında" sayfası erişilmez —
  // ziyaretçi /login'e yönlenir. Yalnızca NEXT_PUBLIC_STAGING_MODE=true iken
  // (lansman öncesi mockup önizleme) görünür.
  if (process.env.NEXT_PUBLIC_STAGING_MODE !== 'true') {
    redirect('/login' as never);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-paper to-cat-soft/30">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
        <Image
          src="/logo.webp"
          alt="PetStockPro"
          width={140}
          height={140}
          className="h-32 w-32 object-contain"
          priority
        />

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-cat-soft px-4 py-1.5 text-[12.5px] font-bold uppercase tracking-wider text-cart">
          <span aria-hidden>🛠</span>
          Yapım aşamasında
        </div>

        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-cart sm:text-5xl">
          Yakında <span className="text-cat">canlıda</span>
        </h1>

        <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-2">
          PetStockPro pet shop&apos;lar için <strong>stok takip + bayi
          yönetim</strong> platformudur. Hesap oluşturma henüz açık değil — son
          hazırlıkları tamamlıyoruz. Şimdilik bayi panelini ve vitrin&apos;i
          önizleyebilirsin.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <StagingDemoButton
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-[15px] font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform disabled:opacity-70 disabled:cursor-progress"
            pendingText="Bayi paneline yönlendiriliyorsun…"
          >
            <span aria-hidden>🛡</span>
            Bayi panelini önizle
          </StagingDemoButton>
          <Link
            href={'/vitrin' as never}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-6 py-3 text-[15px] font-bold text-cart hover:bg-cat-soft"
          >
            <span aria-hidden>🏪</span>
            Vitrin&apos;i önizle
          </Link>
        </div>

        <div className="mt-12 grid w-full max-w-lg gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-paper p-4 text-left">
            <div className="text-[11px] font-bold uppercase tracking-wider text-cat">
              🛡 Pet shop sahibiysen
            </div>
            <p className="mt-1.5 text-[13px] text-ink-2">
              Stok takibi, çoklu şube, sayım, raporlar — pet shop&apos;unun tüm
              operasyonu tek panelde. <strong>FREE plan</strong> ile 50 ürün
              ücretsiz.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-4 text-left">
            <div className="text-[11px] font-bold uppercase tracking-wider text-cat">
              🏪 Vitrin (müşteri bul)
            </div>
            <p className="mt-1.5 text-[13px] text-ink-2">
              Pet shop&apos;un Türkiye dizinine eklenir, müşteri WhatsApp&apos;tan
              sana yazar. Online sipariş yok — direkt iletişim.
            </p>
          </div>
        </div>

        <p className="mt-8 text-[11.5px] text-ink-4">
          © 2026 PetStockPro · KVKK uyumlu · Cloudflare Workers altyapısı
        </p>
      </div>
    </main>
  );
}
