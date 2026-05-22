import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/header';
import { MarketingFooter } from '@/components/marketing/footer';
import { getLegalCompanyInfo } from '@/lib/company/legal-info';

export const metadata: Metadata = {
  title: 'İletişim — PetStockPro',
  description:
    'PetStockPro ile iletişim — destek e-postası, firma bilgileri, KVKK veri sorumlusu.',
};

export default function IletisimPage() {
  const company = getLegalCompanyInfo();

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1 px-6 py-12">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-cart">
            İletişim
          </h1>
          <p className="mt-2 text-[14px] text-ink-3">
            Sorularını veya geri bildirimini iletmenin en hızlı yolu e-posta.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-paper p-5">
              <div className="text-2xl">🤝</div>
              <h2 className="mt-2 text-[16px] font-bold text-cart">
                Destek &amp; soru
              </h2>
              <p className="mt-1 text-[13px] text-ink-3">
                Genel destek, fatura, abonelik, teknik sorun.
              </p>
              <a
                href="mailto:destek@petstockpro.com"
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cat/40 bg-cat-soft px-3 py-2 text-[13.5px] font-bold text-cat-7 hover:bg-cat hover:text-white"
              >
                ✉ destek@petstockpro.com
              </a>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-5">
              <div className="text-2xl">🔒</div>
              <h2 className="mt-2 text-[16px] font-bold text-cart">
                KVKK veri sorumlusu
              </h2>
              <p className="mt-1 text-[13px] text-ink-3">
                Veri taşıma, silme veya KVKK Madde 11 talepleri.
              </p>
              <a
                href="mailto:kvkk@petstockpro.com"
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cat/40 bg-cat-soft px-3 py-2 text-[13.5px] font-bold text-cat-7 hover:bg-cat hover:text-white"
              >
                ✉ kvkk@petstockpro.com
              </a>
            </div>
          </div>

          {company.hasRealInfo ? (
            <section className="mt-10 rounded-2xl border border-line bg-paper p-5">
              <h2 className="text-[16px] font-bold text-cart">🏢 Firma bilgileri</h2>
              <dl className="mt-4 grid gap-3 text-[13.5px] sm:grid-cols-2">
                <div>
                  <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                    Ticari Unvan
                  </dt>
                  <dd className="mt-0.5 font-bold text-ink-2">{company.legalName}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                    Marka
                  </dt>
                  <dd className="mt-0.5 font-bold text-ink-2">{company.brandName}</dd>
                </div>
                {company.mersisNo && (
                  <div>
                    <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                      MERSİS No
                    </dt>
                    <dd className="mt-0.5 text-ink-2">{company.mersisNo}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                    VKN
                  </dt>
                  <dd className="mt-0.5 text-ink-2">{company.vatNo}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                    Adres
                  </dt>
                  <dd className="mt-0.5 text-ink-2">{company.address}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                    Web
                  </dt>
                  <dd className="mt-0.5 text-ink-2">petstockpro.com</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                    E-posta
                  </dt>
                  <dd className="mt-0.5 text-ink-2">{company.supportEmail}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <section className="mt-10 rounded-2xl border border-cat/30 bg-cat-soft/40 p-5">
            <h2 className="text-[16px] font-bold text-cart">
              ⏱ Yanıt süresi
            </h2>
            <ul className="mt-3 flex flex-col gap-2 text-[13.5px] text-ink-2">
              <li>📨 <strong>Genel destek:</strong> Çalışma günleri 24 saat içinde</li>
              <li>🔐 <strong>KVKK talepleri:</strong> Yasal süre 30 gün</li>
              <li>🛡 <strong>Güvenlik açığı bildirimi:</strong> 72 saat içinde</li>
            </ul>
          </section>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
