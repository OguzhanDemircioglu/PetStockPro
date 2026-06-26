import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/header';
import { MarketingFooter } from '@/components/marketing/footer';
import { getLegalCompanyInfo } from '@/lib/company/legal-info';

export const metadata: Metadata = {
  title: 'Üyelik Sözleşmesi — PetStockPro',
  description:
    'PetStockPro platform üyelik şartları, hizmet kapsamı, taraf yükümlülükleri ve fesih şartları.',
};

export default function UyelikSozlesmesiPage() {
  const company = getLegalCompanyInfo();

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <article className="mx-auto max-w-3xl">
          {!company.hasRealInfo && (
            <div className="rounded-xl border border-arrow/30 bg-arrow-soft px-4 py-3 text-[12.5px] font-bold text-arrow-7">
              ℹ Bu sözleşme lansman öncesi taslak metindir. Şirket kuruluşu
              tamamlanıp avukat onayı alındıktan sonra şirket bilgileri
              yayınlanacak ve sözleşme yürürlüğe girecek.
            </div>
          )}

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-cart">
            Üyelik Sözleşmesi
          </h1>
          <p className="mt-2 text-[13px] text-ink-3">
            Yürürlük tarihi: {new Date().toLocaleDateString('tr-TR')}
          </p>

          <div className="mt-8 flex flex-col gap-6 text-[14px] leading-relaxed text-ink-2">
            <section>
              <h2 className="text-lg font-bold text-cart">
                1. Taraflar
              </h2>
              <p className="mt-2">
                İşbu Üyelik Sözleşmesi (&ldquo;Sözleşme&rdquo;), bir tarafta{' '}
                <strong>
                  {company.hasRealInfo
                    ? company.legalName
                    : `${company.brandName} (şirket kuruluş sürecinde)`}
                </strong>{' '}
                (&ldquo;Şirket&rdquo; / &ldquo;{company.brandName}&rdquo;) ile
                diğer tarafta platforma üye olan kullanıcı
                (&ldquo;Üye&rdquo;) arasında imzalanmıştır.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                2. Konu ve Kapsam
              </h2>
              <p className="mt-2">
                PetStockPro; pet shop&apos;lar için stok takip, satış kaydı,
                vitrin (dizin) yönetimi ve raporlama hizmetleri sunan
                web tabanlı bir SaaS platformudur. Üye, FREE/PRO/PRO+
                planlardan birine kaydolarak platform hizmetlerinden
                yararlanır.
              </p>
              <p className="mt-2">
                <strong>Önemli:</strong> PetStockPro, müşteri ile pet shop
                arasında satışa aracılık etmez. Vitrin, sadece pet shop&apos;u
                bulunmak isteyen müşteriler için bir dizindir. Müşteri ile
                pet shop arasındaki para alışverişi, kargo ve satış işlemine
                Şirket dahil değildir (ödeme kuruluşu lisansı veya marketplace
                statüsü taşımaz).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                3. Üyelik Şartları
              </h2>
              <ul className="mt-2 list-disc pl-5">
                <li>18 yaşını doldurmuş, fiil ehliyetine sahip olmak</li>
                <li>
                  Türkiye&apos;de yerleşik bir pet shop / hayvan ürünleri
                  satıcısı olmak
                </li>
                <li>Vergi kimlik numarası ve geçerli IBAN sağlamak</li>
                <li>
                  Üyelik kaydında verilen bilgilerin doğru, eksiksiz ve
                  güncel olduğunu beyan etmek
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                4. Hizmet Bedeli ve Ödeme
              </h2>
              <p className="mt-2">
                Plan ücretleri <strong>/fiyatlar</strong> sayfasında belirtildiği
                gibidir. PRO ve PRO+ planları için ödeme aylık peşin tahsil
                edilir; tahsilat PayTR üzerinden yapılır, e-Arşiv fatura
                Nilvera üzerinden düzenlenir.
              </p>
              <p className="mt-2">
                Şirket, fiyatlarda değişiklik hakkını saklı tutar. Değişiklik
                Üye&apos;nin mevcut dönem sonuna kadar uygulanmaz; sonraki dönemde
                yeni fiyat geçerlidir. Değişiklik en az 30 gün önceden email
                ile bildirilir.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                5. Üyenin Yükümlülükleri
              </h2>
              <ul className="mt-2 list-disc pl-5">
                <li>
                  Platform üzerinden yalnızca pet shop iş süreçleri için işlem
                  yapmak
                </li>
                <li>Hesap güvenliğini sağlamak (2FA aktive etmek önerilir)</li>
                <li>
                  Vitrin&apos;de doğru bilgi (fiyat, stok, görsel) yayınlamak
                </li>
                <li>
                  Müşterilerle WhatsApp/telefon üzerinden iletilen iletişimde
                  KVKK ve Tüketici Kanunu&apos;na uygun davranmak
                </li>
                <li>
                  Telif hakkı, marka hakkı veya kişilik haklarını ihlal eden
                  içerik yüklememek
                </li>
                <li>
                  Spam, dolandırıcılık veya yasa dışı amaçlarla platformu
                  kullanmamak
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                6. Şirketin Yükümlülükleri
              </h2>
              <ul className="mt-2 list-disc pl-5">
                <li>Hizmeti makul ölçüde kesintisiz sunmak (SLA hedefi: %99.5)</li>
                <li>Üye verilerini KVKK ve teknik güvenlik standartlarına uygun saklamak</li>
                <li>
                  Acil güvenlik açığı tespiti durumunda 72 saat içinde Üye&apos;ye bildirim göndermek
                </li>
                <li>
                  Üyelik feshi durumunda Üye verilerini KVKK Madde 11
                  kapsamında 30 gün boyunca taşınabilir formatta sunmak
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                7. Sorumluluğun Sınırlandırılması
              </h2>
              <p className="mt-2">
                PetStockPro hizmeti &ldquo;olduğu gibi&rdquo; (as-is) sunulur.
                Şirket; Üye&apos;nin platform üzerinden kaydettiği stok/satış
                verilerinin doğruluğundan, vergi mevzuatına uygunluğundan,
                vitrin&apos;de yayınlanan fiyat/açıklama bilgilerinin doğruluğundan
                ve müşteri ile pet shop arasındaki ticari uyuşmazlıklardan
                sorumlu değildir.
              </p>
              <p className="mt-2">
                Şirketin toplam sorumluluğu, Üye&apos;nin son 12 ayda ödediği
                abonelik bedeli ile sınırlıdır (zorunlu yasal yükümlülükler
                hariç).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                8. Fesih ve İptal
              </h2>
              <p className="mt-2">
                Üye, dilediği zaman paneldeki{' '}
                <strong>Ayarlar → Plan → Aboneliği İptal Et</strong> seçeneği
                ile aboneliğini sonlandırabilir. İptal işlemi dönem sonunda
                yürürlüğe girer; iade yapılmaz.
              </p>
              <p className="mt-2">
                Şirket, Üye&apos;nin işbu Sözleşme ihlali halinde Üyeliği derhal
                askıya alma veya sonlandırma hakkını saklı tutar.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                9. Uygulanacak Hukuk ve Yetkili Mahkeme
              </h2>
              <p className="mt-2">
                İşbu Sözleşme Türkiye Cumhuriyeti hukukuna tabidir.
                Uyuşmazlıklarda{' '}
                <strong>{company.legalJurisdiction}</strong> Mahkemeleri ve
                İcra Daireleri yetkilidir.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">10. Yürürlük</h2>
              <p className="mt-2">
                Bu Sözleşme, Üye&apos;nin kayıt sırasında onaylaması ile
                yürürlüğe girer ve üyelik süresince geçerlidir.
              </p>
            </section>
          </div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
