import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/header';
import { MarketingFooter } from '@/components/marketing/footer';
import { getLegalCompanyInfo } from '@/lib/company/legal-info';

export const metadata: Metadata = {
  title: 'Teslimat Koşulları — PetStockPro',
  description:
    'PetStockPro PRO ve PRO+ abonelik planlarının elektronik teslimat şekli ve süresi.',
};

export default function DeliveryTermsPage() {
  const company = getLegalCompanyInfo();

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <article className="mx-auto max-w-3xl">
          {!company.hasRealInfo && (
            <div className="rounded-xl border border-arrow/30 bg-arrow-soft px-4 py-3 text-[12.5px] font-bold text-arrow-7">
              ℹ Bu sayfa lansman öncesi taslak metindir. Şirket kuruluşu
              tamamlandıktan sonra satıcı bilgileri yayınlanacaktır. Bu
              noktaya kadar ücretli abonelik satışı aktif değildir.
            </div>
          )}

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-cart">
            Teslimat Koşulları
          </h1>
          <p className="mt-2 text-[13px] text-ink-3">
            Yürürlük tarihi: {new Date().toLocaleDateString('tr-TR')}
          </p>

          <div className="mt-8 flex flex-col gap-6 text-[14px] leading-relaxed text-ink-2">
            <section>
              <h2 className="text-lg font-bold text-cart">
                1. Hizmetin Niteliği — Elektronik Teslimat
              </h2>
              <p className="mt-2">
                PetStockPro fiziksel ürün satmaz; pet shop&apos;lar için stok
                takip, satış kaydı, vitrin ve raporlama hizmeti sunan web
                tabanlı bir SaaS (Software-as-a-Service) platformudur.{' '}
                <strong>PRO</strong> veya <strong>PRO+</strong> abonelik
                satın alındığında &ldquo;teslim edilen&rdquo; şey, panel
                üzerinden ek özelliklere (yüksek stok limiti, çoklu şube,
                Excel import, tam raporlar vb.) erişimdir. Kargo, taşıma
                veya fiziksel teslimat süreci yoktur.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                2. Teslimat Yöntemi ve Süresi
              </h2>
              <p className="mt-2">
                Ödeme <strong>PayTR</strong> altyapısı üzerinden onaylandığı
                anda, sistem webhook bildirimiyle otomatik olarak ilgili
                planı hesaba tanımlar. Teslimat <strong>anındadır</strong> —
                ödeme onayından sonra saniyeler/dakikalar içinde panelde
                erişim açılır ve kayıtlı e-posta adresine onay bildirimi
                gönderilir. Ek bir bekleme süresi veya kargo takip numarası
                yoktur.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                3. Fatura Teslimatı
              </h2>
              <p className="mt-2">
                e-Arşiv fatura <strong>Nilvera</strong> üzerinden kesilir ve
                PDF olarak Üye&apos;nin kayıtlı e-posta adresine otomatik
                gönderilir. Fatura ayrıca panelden{' '}
                <strong>Ayarlar → Faturalar</strong> üzerinden de
                indirilebilir. Ek ücret veya işlem gerekmez.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                4. Erişim Sorunu Yaşanması Durumunda
              </h2>
              <p className="mt-2">
                Ödeme alındığı halde teknik bir arıza nedeniyle plan
                otomatik aktive olmazsa,{' '}
                <a
                  href={`mailto:${company.supportEmail}`}
                  className="font-bold text-cat-7 hover:underline"
                >
                  {company.supportEmail}
                </a>{' '}
                adresine bildirim yapılması yeterlidir; talep en geç 24 saat
                içinde incelenip giderilir veya gerekiyorsa iade süreci
                başlatılır (bkz.{' '}
                <a href="/return-policy" className="text-cat-7 hover:underline">
                  İade Politikası
                </a>
                ).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                5. Önemli — Vitrin Üzerinden Ürün Siparişi Yapılmaz
              </h2>
              <div className="mt-2 rounded-xl border border-cat/30 bg-cat-soft/40 p-3 text-[13px]">
                PetStockPro&apos;nun <strong>Vitrin</strong> bölümü, pet
                shop arayan müşteriler için bir bilgi/dizin sayfasıdır.
                PetStockPro üzerinden sepet, sipariş, çevrimiçi ödeme veya
                kargo işlemi <strong>yapılmaz</strong>. Müşteri ile pet shop
                arasındaki iletişim doğrudan WhatsApp/telefon üzerinden
                kurulur; ürünün teslimat şekli (elden teslim, kargo vb.) ve
                süresi tamamen ilgili pet shop&apos;un kendi sorumluluğu ve
                tercihindedir. PetStockPro bu sürece taraf değildir.
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                6. Hizmet Sağlayıcı &amp; İletişim
              </h2>
              {company.hasRealInfo ? (
                <p className="mt-2">
                  <strong>{company.legalName}</strong>
                  <br />
                  VKN: {company.vatNo}
                  <br />
                  Adres: {company.address}
                  {company.phone && (
                    <>
                      <br />
                      Telefon:{' '}
                      <a
                        href={`tel:${company.phone.replace(/\s/g, '')}`}
                        className="text-cat-7 hover:underline"
                      >
                        {company.phone}
                      </a>
                    </>
                  )}
                  <br />
                  E-posta:{' '}
                  <a
                    href={`mailto:${company.supportEmail}`}
                    className="text-cat-7 hover:underline"
                  >
                    {company.supportEmail}
                  </a>
                </p>
              ) : (
                <p className="mt-2">
                  <strong>{company.brandName}</strong> markası — şirket
                  kuruluş sürecinde, satıcı bilgileri lansman öncesi
                  yayınlanacak. Sorularınız için:{' '}
                  <a
                    href={`mailto:${company.supportEmail}`}
                    className="text-cat-7 hover:underline"
                  >
                    {company.supportEmail}
                  </a>
                </p>
              )}
            </section>
          </div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
