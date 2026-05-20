import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/header';
import { MarketingFooter } from '@/components/marketing/footer';

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni — PetStockPro',
  description:
    '6698 sayılı KVKK Kanunu kapsamında kişisel verilerin işlenmesine ilişkin aydınlatma metni.',
};

export default function KvkkPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1 px-6 py-12">
        <article className="mx-auto max-w-3xl">
          <div className="rounded-xl border border-arrow/30 bg-arrow-soft px-4 py-3 text-[12.5px] font-bold text-arrow-7">
            📝 TASLAK — Şirket kuruluşu (VKN + MERSİS) tamamlandıktan sonra
            avukat onayıyla finalize edilecek. iyzico üye işyeri başvurusu
            öncesi gerçek firma bilgileri doldurulmalı.
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-cart">
            KVKK Aydınlatma Metni
          </h1>
          <p className="mt-2 text-[13px] text-ink-3">
            Son güncelleme: {new Date().toLocaleDateString('tr-TR')}
          </p>

          <div className="mt-8 flex flex-col gap-6 text-[14px] leading-relaxed text-ink-2">
            <section>
              <h2 className="text-lg font-bold text-cart">1. Veri Sorumlusu</h2>
              <p className="mt-2">
                6698 sayılı Kişisel Verilerin Korunması Kanunu
                (&ldquo;KVKK&rdquo;) uyarınca, kişisel verileriniz; veri
                sorumlusu sıfatıyla <strong>[FIRMA UNVANI — PLACEHOLDER]</strong>{' '}
                (&ldquo;PetStockPro&rdquo; veya &ldquo;Şirket&rdquo;)
                tarafından aşağıda açıklanan kapsamda işlenebilecektir.
              </p>
              <ul className="mt-2 list-disc pl-5">
                <li>Adres: [PLACEHOLDER]</li>
                <li>MERSİS No: [PLACEHOLDER]</li>
                <li>VKN: [PLACEHOLDER]</li>
                <li>E-posta: destek@petstockpro.com</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                2. Toplanan Kişisel Veriler
              </h2>
              <ul className="mt-2 list-disc pl-5">
                <li>
                  <strong>Kimlik bilgileri:</strong> ad, soyad, e-posta, telefon,
                  vergi kimlik no
                </li>
                <li>
                  <strong>İşletme bilgileri:</strong> pet shop adı, ticari unvan,
                  şube adresleri, IBAN, vergi dairesi
                </li>
                <li>
                  <strong>İşlem bilgileri:</strong> stok hareketleri, satış
                  kayıtları, audit log, oturum logları
                </li>
                <li>
                  <strong>Teknik bilgiler:</strong> IP (anonim hash), cihaz türü,
                  oturum çerezleri, hata logları
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                3. İşleme Amaçları
              </h2>
              <ul className="mt-2 list-disc pl-5">
                <li>Hizmetin sağlanması (stok takip + satış kaydı + vitrin)</li>
                <li>Üyelik kaydı ve oturum yönetimi (KVKK m. 5/2-c)</li>
                <li>
                  Abonelik faturalandırma (iyzico ödeme + Nilvera e-Arşiv;
                  KVKK m. 5/2-a)
                </li>
                <li>
                  Güvenlik (2FA, brute-force koruması, audit log; KVKK m. 5/2-f)
                </li>
                <li>
                  Yasal yükümlülükler (Vergi Usul Kanunu, e-Arşiv yönetmeliği;
                  KVKK m. 5/2-ç)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                4. Veri Aktarımı
              </h2>
              <p className="mt-2">
                Kişisel verileriniz aşağıdaki hizmet sağlayıcılarla yasal
                gereklilikler ve KVKK m. 8 kapsamında paylaşılır:
              </p>
              <ul className="mt-2 list-disc pl-5">
                <li>
                  <strong>Supabase (AB Frankfurt):</strong> veritabanı barındırma
                  (KVKK m. 9 ek koruma kapsamında AB&apos;de tutulur)
                </li>
                <li>
                  <strong>Cloudflare:</strong> CDN + DDoS koruması + uygulama
                  altyapısı (ABD/AB karma)
                </li>
                <li>
                  <strong>iyzico (TR):</strong> Abonelik ödeme tahsilatı
                </li>
                <li>
                  <strong>Nilvera (TR):</strong> e-Arşiv fatura
                </li>
                <li>
                  <strong>Brevo (AB):</strong> transactional email
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">5. Saklama Süresi</h2>
              <ul className="mt-2 list-disc pl-5">
                <li>Üyelik verileri: üyelik aktif olduğu süre + 5 yıl</li>
                <li>Fatura kayıtları: 10 yıl (Vergi Usul Kanunu)</li>
                <li>Audit log: 1 yıl</li>
                <li>System error log: 90 gün</li>
                <li>
                  Vitrin etkileşim verisi (anonim IP hash): 1 yıl, sonra
                  toplulaştırılır
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                6. KVKK Madde 11 — Haklarınız
              </h2>
              <p className="mt-2">Aşağıdaki haklara sahipsiniz:</p>
              <ul className="mt-2 list-disc pl-5">
                <li>
                  Kişisel verilerinizin işlenip işlenmediğini, hangi amaçla
                  işlendiğini öğrenme
                </li>
                <li>Düzeltme, silme veya yok etme talep etme</li>
                <li>
                  Verilerinizi yapısal bir formatta indirme (
                  <strong>Ayarlar → Verilerimi İndir</strong> sayfasından CSV/JSON)
                </li>
                <li>Otomatik karar verme süreçlerine itiraz etme</li>
                <li>Zararın giderilmesini talep etme</li>
              </ul>
              <p className="mt-2">
                Bu hakları kullanmak için <strong>destek@petstockpro.com</strong>{' '}
                adresine yazılı talep iletebilirsiniz; talepleriniz 30 gün
                içinde ücretsiz yanıtlanır (talep konusu özel teknik işlem
                gerektiriyorsa ücret talep edilebilir, KVKK Tarifesi).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                7. İletişim &amp; Şikayet
              </h2>
              <p className="mt-2">
                Veri Sorumlusu: <strong>[FIRMA UNVANI — PLACEHOLDER]</strong>
                <br />
                E-posta: <a href="mailto:kvkk@petstockpro.com" className="text-cat-7 hover:underline">kvkk@petstockpro.com</a>
                <br />
                Posta: [PLACEHOLDER ADRES]
              </p>
              <p className="mt-2 text-[12.5px] text-ink-3">
                KVKK Kuruluna şikayet hakkınız ayrıca saklıdır.
              </p>
            </section>
          </div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
