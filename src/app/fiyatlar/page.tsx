import Link from 'next/link';
import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/header';
import { MarketingFooter } from '@/components/marketing/footer';

export const metadata: Metadata = {
  title: 'Fiyatlar — PetStockPro',
  description:
    'PetStockPro plan kademeleri: FREE 50 ürün ücretsiz · PRO 500 ürün 1.000₺/ay · PRO+ Sınırsız 2.000₺/ay. KDV dahil, TR yerleşik pet shop\'lara özel.',
};

interface Plan {
  key: 'FREE' | 'PRO' | 'PRO_PLUS';
  name: string;
  price: string;
  priceNote: string;
  limit: string;
  highlight?: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    key: 'FREE',
    name: 'FREE',
    price: '0 ₺',
    priceNote: 'Her zaman ücretsiz',
    limit: '50 ürüne kadar',
    features: [
      'Sınırsız şube + kullanıcı',
      'Vitrin (cross-tenant dizin)',
      'Stok hareketleri + sayım',
      'Audit log + 2FA',
      'PetPro Asistan',
      'Nilvera e-Arşiv fatura',
      '6 rapor + KVKK veri indirme',
    ],
  },
  {
    key: 'PRO',
    name: 'PRO',
    price: '1.000 ₺',
    priceNote: 'aylık, KDV dahil',
    limit: '500 ürüne kadar',
    highlight: true,
    features: [
      'FREE plandaki tüm özellikler',
      '10× daha fazla ürün kapasitesi',
      'Orta segment pet shop için ideal',
      'Tüm vitrin özellikleri',
      'Öncelikli kayıt güvenliği (otomatik backup)',
    ],
  },
  {
    key: 'PRO_PLUS',
    name: 'PRO+',
    price: '2.000 ₺',
    priceNote: 'aylık, KDV dahil',
    limit: 'Sınırsız ürün',
    features: [
      'PRO plandaki tüm özellikler',
      'Büyük pet shop zincirleri için',
      'Sınırsız stok takibi',
      'Yüksek hacimli satış desteği',
    ],
  },
];

export default function FiyatlarPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-cat-soft px-3 py-1 text-[11.5px] font-bold uppercase tracking-wider text-cat-7">
              💳 Şeffaf fiyatlandırma
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-cart sm:text-5xl">
              Tek farklılaşma: <span className="text-cat">stok limiti</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">
              Diğer her şey eşit — vitrin, çoklu şube, audit, 2FA, asistan,
              raporlar, e-Arşiv. Sadece kataloğundaki ürün sayısına göre seç.
              KDV dahil fiyatlar, gizli ücret yok.
            </p>
          </div>

          <ul className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <li
                key={p.key}
                data-testid={`plan-${p.key}`}
                className={
                  p.highlight
                    ? 'flex flex-col gap-4 rounded-2xl border-2 border-cat bg-paper p-6 shadow-[var(--shadow-cat)]'
                    : 'flex flex-col gap-4 rounded-2xl border border-line bg-paper p-6'
                }
              >
                {p.highlight && (
                  <span className="self-start rounded-full bg-cat px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
                    ★ En popüler
                  </span>
                )}
                <div>
                  <h2 className="text-[20px] font-bold text-cart">{p.name}</h2>
                  <p className="mt-1 text-[12.5px] text-ink-3">{p.limit}</p>
                </div>
                <div>
                  <div className="text-4xl font-bold text-cart">{p.price}</div>
                  <div className="text-[12px] text-ink-3">{p.priceNote}</div>
                </div>
                <ul className="flex flex-col gap-2 text-[13.5px] text-ink-2">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 text-arrow-7">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={
                    p.highlight
                      ? 'mt-auto inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-cat to-cat-2 px-4 py-3 text-[14px] font-bold text-white shadow-sm hover:-translate-y-px transition-transform'
                      : 'mt-auto inline-flex items-center justify-center rounded-xl border border-line bg-paper px-4 py-3 text-[14px] font-bold text-cart hover:border-cat'
                  }
                >
                  {p.key === 'FREE' ? 'Ücretsiz başla' : 'PRO ile başla'}
                </Link>
              </li>
            ))}
          </ul>

          <section className="mt-16 rounded-2xl border border-line bg-paper p-6 md:p-8">
            <h2 className="text-[20px] font-bold text-cart">
              📋 Sıkça sorulanlar
            </h2>
            <dl className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <dt className="font-bold text-ink-2">
                  Aylık abonelik nasıl iptal edilir?
                </dt>
                <dd className="mt-1 text-[13.5px] text-ink-3 leading-relaxed">
                  Paneldeki <strong>Ayarlar → Plan</strong> sayfasından
                  tek tıklamayla iptal edebilirsin. Dönem sonuna kadar mevcut
                  planın çalışmaya devam eder, otomatik FREE plana düşersin.
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-2">
                  Cayma hakkı var mı?
                </dt>
                <dd className="mt-1 text-[13.5px] text-ink-3 leading-relaxed">
                  6502 sayılı Tüketici Kanunu kapsamında dijital içerik/hizmet
                  abonelikleri için 14 günlük cayma hakkı geçerlidir; ilk
                  kullanım sonrası cayma hakkı düşer (Mesafeli Satış
                  Sözleşmesi Madde 5).
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-2">Faturalandırma nasıl?</dt>
                <dd className="mt-1 text-[13.5px] text-ink-3 leading-relaxed">
                  Her dönem başında otomatik e-Arşiv faturası kesilir
                  (Nilvera entegrasyonu) ve panel + email ile iletilir.
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink-2">
                  FREE&apos;den PRO&apos;ya geçişte veri kaybı olur mu?
                </dt>
                <dd className="mt-1 text-[13.5px] text-ink-3 leading-relaxed">
                  Hayır. Tüm ürünler, şubeler, hareketler, vitrin profili —
                  hepsi planlar arası taşınır. Sadece ürün limiti açılır.
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
