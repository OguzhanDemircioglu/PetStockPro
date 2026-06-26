import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/header';
import { MarketingFooter } from '@/components/marketing/footer';
import { getLegalCompanyInfo } from '@/lib/company/legal-info';

export const metadata: Metadata = {
  title: 'İade Politikası — PetStockPro',
  description:
    'PetStockPro PRO ve PRO+ abonelik planları için iade, cayma hakkı ve iptal şartları.',
};

export default function ReturnPolicyPage() {
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
            İade Politikası
          </h1>
          <p className="mt-2 text-[13px] text-ink-3">
            Yürürlük tarihi: {new Date().toLocaleDateString('tr-TR')}
          </p>

          <div className="mt-8 flex flex-col gap-6 text-[14px] leading-relaxed text-ink-2">
            <section>
              <h2 className="text-lg font-bold text-cart">1. Kapsam</h2>
              <p className="mt-2">
                Bu İade Politikası, PetStockPro üzerinden satın alınan{' '}
                <strong>PRO</strong> ve <strong>PRO+</strong> abonelik
                planlarının ücretlendirilmesine ilişkin iade ve iptal
                şartlarını düzenler. <strong>FREE</strong> plan ücretsizdir,
                iade konusu değildir.
              </p>
              <div className="mt-3 rounded-xl border border-cat/30 bg-cat-soft/40 p-3 text-[13px]">
                <strong>Önemli ayrım:</strong> PetStockPro, pet shop
                sahiplerine yazılım hizmeti (SaaS abonelik) satar. Pet
                shop&apos;ların kendi müşterilerine sattığı fiziksel ürünler
                (mama, oyuncak, aksesuar vb.) bu politikanın kapsamı
                dışındadır — bu satışlar tamamen pet shop ile kendi müşterisi
                arasındadır, PetStockPro bu işlemlerin tarafı değildir ve
                ödeme/teslimat sürecine dahil olmaz.
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                2. Cayma Hakkı (14 Gün)
              </h2>
              <p className="mt-2">
                6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli
                Sözleşmeler Yönetmeliği uyarınca, Üye sözleşmenin kurulduğu
                tarihten itibaren 14 (on dört) gün içinde herhangi bir
                gerekçe göstermeksizin cayma hakkına sahiptir.
              </p>
              <p className="mt-2">
                Ancak Yönetmelik m. 15/1-ğ uyarınca, &ldquo;elektronik
                ortamda anında ifa edilen hizmetler&rdquo; cayma hakkı
                kapsamı dışındadır. PetStockPro aboneliği ödeme onayı ile
                anında aktive olduğundan ve hesaba giriş yapıldığından, cayma
                hakkı bu noktadan sonra kullanılamaz. Üye dilediği zaman
                aboneliğini iptal edebilir; iptal mevcut dönem sonunda
                yürürlüğe girer (bkz. madde 4).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                3. İade Talep Edilebilecek Durumlar
              </h2>
              <ul className="mt-2 list-disc pl-5">
                <li>Hatalı veya mükerrer (çift) tahsilat</li>
                <li>
                  Şirket kusurundan kaynaklanan teknik arıza nedeniyle
                  hizmete erişilememe
                </li>
                <li>
                  Kart sahibinin onayı olmadan yapılan yetkisiz işlem
                  şikayeti (banka/PayTR itiraz süreciyle birlikte
                  değerlendirilir)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                4. İade Yapılmayan Durumlar
              </h2>
              <ul className="mt-2 list-disc pl-5">
                <li>
                  Hizmeti kullanıp memnun kalmama veya kullanmama (hizmet
                  erişime açılmış sayılır)
                </li>
                <li>
                  Aylık dönem ortasında gönüllü iptal — kalan günler için
                  ücret iadesi yapılmaz, plan dönem sonuna kadar kullanıma
                  açık kalır
                </li>
                <li>
                  Pet shop&apos;un kendi müşterisiyle olan ticari
                  anlaşmazlıkları (PetStockPro bu işlemlerin tarafı değildir)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                5. İade Süreci ve Süresi
              </h2>
              <p className="mt-2">
                İade talebi, tahsilat tarihini izleyen 14 gün içinde{' '}
                <a
                  href={`mailto:${company.supportEmail}`}
                  className="font-bold text-cat-7 hover:underline"
                >
                  {company.supportEmail}
                </a>{' '}
                adresine, işlem tarihi ve gerekçe belirtilerek yazılı olarak
                iletilir. Talep değerlendirilir; haklı bulunması halinde en
                geç 14 gün içinde, tahsilatın yapıldığı ödeme yöntemine (PayTR
                üzerinden ilgili karta/hesaba) iade edilir.
              </p>
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
                  yayınlanacak. İade talepleri için:{' '}
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
