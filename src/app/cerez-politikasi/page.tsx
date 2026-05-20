import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/header';
import { MarketingFooter } from '@/components/marketing/footer';

export const metadata: Metadata = {
  title: 'Çerez Politikası — PetStockPro',
  description:
    'PetStockPro web sitesinin kullandığı çerezler, amaçları ve yönetim seçenekleri.',
};

export default function CerezPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1 px-6 py-12">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-cart">
            Çerez Politikası
          </h1>
          <p className="mt-2 text-[13px] text-ink-3">
            Son güncelleme: {new Date().toLocaleDateString('tr-TR')}
          </p>

          <div className="mt-8 flex flex-col gap-6 text-[14px] leading-relaxed text-ink-2">
            <section>
              <h2 className="text-lg font-bold text-cart">1. Çerez nedir?</h2>
              <p className="mt-2">
                Çerez (cookie), web sitesini ziyaret ettiğinde tarayıcına
                kaydedilen küçük metin dosyalarıdır. Çerezler kullanıcı
                deneyimini iyileştirmek, oturumunu hatırlamak ve site
                performansını ölçmek için kullanılır.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                2. Hangi çerezleri kullanıyoruz?
              </h2>

              <div className="mt-3 overflow-hidden rounded-xl border border-line">
                <table className="w-full text-[13px]">
                  <thead className="bg-line-soft text-left text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
                    <tr>
                      <th className="px-3 py-2">İsim / Tür</th>
                      <th className="px-3 py-2">Amaç</th>
                      <th className="px-3 py-2">Süre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr>
                      <td className="px-3 py-2 font-mono">
                        next-auth.session-token
                      </td>
                      <td className="px-3 py-2">
                        <strong>Zorunlu</strong> — oturum yönetimi (giriş)
                      </td>
                      <td className="px-3 py-2">30 gün</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono">pp_lock_state</td>
                      <td className="px-3 py-2">
                        <strong>Zorunlu</strong> — brute-force lock UX state
                      </td>
                      <td className="px-3 py-2">5 dakika</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono">
                        pp_fb_dismissed_v1
                      </td>
                      <td className="px-3 py-2">
                        <strong>Fonksiyonel</strong> — vitrin geri bildirim
                        balonu &ldquo;1 kere göster&rdquo; durumu
                      </td>
                      <td className="px-3 py-2">24 saat</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono">
                        pp_cookie_consent
                      </td>
                      <td className="px-3 py-2">
                        <strong>Fonksiyonel</strong> — çerez tercihinin
                        hatırlanması
                      </td>
                      <td className="px-3 py-2">6 ay</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono">
                        cf_clearance / __cf_*
                      </td>
                      <td className="px-3 py-2">
                        <strong>Zorunlu</strong> — Cloudflare bot koruması +
                        Turnstile doğrulama
                      </td>
                      <td className="px-3 py-2">30 gün</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[12.5px] text-ink-3">
                Üçüncü taraf izleme/reklam çerezi kullanmıyoruz. Google
                Analytics, Facebook Pixel veya benzeri yok.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">
                3. Çerezleri nasıl yönetebilirim?
              </h2>
              <p className="mt-2">
                Çerez ayarlarını her zaman tarayıcı tercihlerinden
                değiştirebilirsin. Zorunlu çerezleri kapatırsan site doğru
                çalışmayabilir (giriş yapamama, oturum kaybetme).
              </p>
              <p className="mt-2">
                Site genelinde çerez tercihini sıfırlamak için sayfanın
                altındaki banner&apos;ı tekrar göstermek istersen
                tarayıcı &ldquo;site verilerini temizle&rdquo; seçeneğini
                kullanabilirsin.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cart">4. İletişim</h2>
              <p className="mt-2">
                Çerez politikası hakkında sorularını
                <a
                  href="mailto:destek@petstockpro.com"
                  className="ml-1 text-cat-7 hover:underline"
                >
                  destek@petstockpro.com
                </a>
                {' '}adresine iletebilirsin.
              </p>
            </section>
          </div>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
