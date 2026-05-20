import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/header';
import { MarketingFooter } from '@/components/marketing/footer';

export const metadata: Metadata = {
  title: 'Mesafeli Satış Sözleşmesi — PetStockPro',
  description:
    'PetStockPro PRO ve PRO+ aboneliklerine ilişkin 6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamında mesafeli satış sözleşmesi.',
};

export default function MesafeliSatisSozlesmesiPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1 px-6 py-12">
        <article className="mx-auto max-w-3xl">
          <div className="rounded-xl border border-arrow/30 bg-arrow-soft px-4 py-3 text-[12.5px] font-bold text-arrow-7">
            📝 TASLAK — Avukat onayıyla finalize edilecek. Mesafeli Sözleşmeler
            Yönetmeliği (6502 sayılı kanun) zorunlu içerikleri içerir.
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-cart">
            Mesafeli Satış Sözleşmesi
          </h1>
          <p className="mt-2 text-[13px] text-ink-3">
            Yürürlük tarihi: {new Date().toLocaleDateString('tr-TR')}
          </p>

          <div className="mt-8 flex flex-col gap-6 text-[14px] leading-relaxed text-ink-2">
            <section>
              <h2 className="text-lg font-bold text-cart">1. Taraflar</h2>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-paper p-3">
                  <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                    SATICI
                  </p>
                  <p className="mt-1">
                    <strong>[FIRMA UNVANI — PLACEHOLDER]</strong>
                    <br />
                    MERSİS: [PLACEHOLDER]
                    <br />
                    VKN: [PLACEHOLDER]
                    <br />
                    Adres: [PLACEHOLDER]
                    <br />
                    E-posta: destek@petstockpro.com
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-paper p-3">
                  <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                    ALICI
                  </p>
                  <p className="mt-1 text-[13.5px]">
                    Üyelik kaydında belirtilen ad, soyad, e-posta, telefon
                    ve vergi numarası bilgilerine sahip kullanıcı
                    (&ldquo;Alıcı&rdquo; / &ldquo;Üye&rdquo;).
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                2. Sözleşme Konusu
              </h2>
              <p className="mt-2">
                İşbu sözleşmenin konusu, Alıcı&apos;nın PetStockPro platformuna
                üye olduktan sonra seçtiği FREE/PRO/PRO+ planın elektronik
                ortamda satın alınması ile ilgili olarak 6502 sayılı Tüketicinin
                Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği
                hükümleri gereğince tarafların hak ve yükümlülüklerinin
                belirlenmesidir.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                3. Sözleşme Konusu Hizmetin Temel Nitelikleri
              </h2>
              <ul className="mt-2 list-disc pl-5">
                <li>
                  <strong>Hizmet türü:</strong> Web tabanlı SaaS platform (stok
                  takip, satış kaydı, vitrin/dizin, raporlama)
                </li>
                <li>
                  <strong>Süre:</strong> Aylık otomatik yenilenen abonelik
                </li>
                <li>
                  <strong>Hizmet kapsamı:</strong> Seçilen planın özelliklerine
                  göre belirlenir (FREE: 50 ürün / PRO: 500 ürün / PRO+:
                  sınırsız)
                </li>
                <li>
                  <strong>Teslim yöntemi:</strong> Ödeme tamamlandığında plan
                  anında aktive olur, ek teslimat süreci yoktur
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                4. Ücret ve Ödeme Şekli
              </h2>
              <ul className="mt-2 list-disc pl-5">
                <li>FREE plan: 0 ₺ (sürekli ücretsiz)</li>
                <li>PRO plan: 750 ₺/ay, KDV dahil</li>
                <li>PRO+ plan: 1.750 ₺/ay, KDV dahil</li>
              </ul>
              <p className="mt-2">
                Ödeme tahsilatı her dönem başında otomatik olarak Alıcı&apos;nın
                kayıtlı kredi kartı/banka kartından <strong>iyzico</strong>
                {' '}altyapısı üzerinden yapılır. e-Arşiv fatura{' '}
                <strong>Nilvera</strong> üzerinden düzenlenip Alıcı&apos;nın
                kayıtlı e-postasına gönderilir.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                5. Cayma Hakkı
              </h2>
              <p className="mt-2">
                6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli
                Sözleşmeler Yönetmeliği uyarınca, Alıcı sözleşmenin kurulduğu
                tarihten itibaren <strong>14 (on dört) gün</strong> içinde
                herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin
                cayma hakkına sahiptir.
              </p>
              <p className="mt-2">
                <strong>Cayma hakkının kullanılamayacağı haller:</strong>{' '}
                Yönetmelik m. 15/1-ğ uyarınca, &ldquo;elektronik ortamda anında
                ifa edilen hizmetler veya tüketiciye anında teslim edilen
                gayri maddi mallara ilişkin sözleşmeler&rdquo; cayma hakkı
                kapsamı dışındadır.
              </p>
              <p className="mt-2">
                PetStockPro&apos;ya kaydolduktan ve ilk giriş yapıldıktan sonra
                hizmet aktive olduğu için cayma hakkı kullanılamaz. Üye dilediği
                zaman aboneliğini iptal edebilir; iptal dönem sonunda yürürlüğe
                girer (Üyelik Sözleşmesi m. 8).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                6. İade ve İptal
              </h2>
              <p className="mt-2">
                Aylık dönem ortasında abonelik iptali halinde kalan günler için
                ücret iadesi yapılmaz; mevcut dönem sonuna kadar plan kullanıma
                açık kalır.
              </p>
              <p className="mt-2">
                Hatalı tahsilat (örn. iki kere çekim), teknik arıza veya
                Şirket kusurundan kaynaklanan hatalı abonelik durumunda iade
                talep edilebilir. Talep, hatalı tahsilatı izleyen 14 gün içinde
                <strong> destek@petstockpro.com</strong> adresine yazılı olarak
                yapılır; haklı bulunması halinde 14 gün içinde iade edilir.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                7. Uyuşmazlıkların Çözümü
              </h2>
              <p className="mt-2">
                Sözleşmeden doğan uyuşmazlıklar halinde, Tüketici Hakem
                Heyetleri ve Tüketici Mahkemeleri yetkilidir. Parasal limitler
                Gümrük ve Ticaret Bakanlığı tarafından her yıl ilan edilir.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                8. Yürürlük
              </h2>
              <p className="mt-2">
                Alıcı, satın alma işlemini onayladığında bu sözleşmeyi okuduğunu
                ve kabul ettiğini beyan etmiş sayılır.
              </p>
            </section>
          </div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
