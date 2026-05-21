# PetStockPro — UI Mockup Planı + Brief

**Tarih:** 2026-05-14
**Durum:** Sprint 0 öncesi mockup hazırlığı
**Kapsam:** Tüm ekran mockup'ları için brief + öncelik + tool karar + prompt şablonu

> **Felsefe:** Mockup'lar **kod yazımı öncesi tasarım netleştirme aracı**. Sprint 0'da Next.js skeleton kurulduktan sonra her sprint başında ilgili mockup baz alınarak React component implementasyonu yapılır. Pixel-perfect değil, **layout + bileşen + akış** netleştirme amaçlı.

---

## 1. Mevcut Durum

### 1.1 preview/ klasöründe olanlar (4 adet + 1 legacy)

| Dosya | Boyut | Satır | Durum |
|---|---|---|---|
| `pano.html` | 128KB | 2925 | ⚠ Eski font (Plus Jakarta + Fraunces) — Verdana'ya geçiş gerek |
| `urunler.html` | 121KB | 2587 | ⚠ Aynı font sorunu + Satışa Aç toggle eksik |
| `stok-hareketleri.html` | 135KB | 2845 | ⚠ Aynı font sorunu |
| `super-admin.html` | 124KB | 2647 | ⚠ Aynı font + Vitrin Modlama 4. sekme eksik |
| `vitrin.html` | 73KB | 1266 | ❌ **LEGACY** — tenant subdomain modeli, tamamen iptal (2026-05-13) |

### 1.2 Eksik Mockup'lar (10 adet)

**Admin tarafı (5 admin ekran + auth):**
- `dusuk-stok.html` — EKRAN-DUSUK-STOK.md
- `sayim.html` — EKRAN-SAYIM.md (drawer + tam-sayfa workflow)
- `subeler.html` — EKRAN-SUBELER.md
- `tedarikciler.html` — EKRAN-TEDARIKCILER.md
- `kullanicilar.html` — EKRAN-KULLANICILAR.md
- `raporlar.html` — EKRAN-RAPORLAR.md (ana liste + 6 rapor detay)
- `ayarlar.html` — EKRAN-AYARLAR.md (6 bölüm + Vitrin Profili + Vitrin Metrikleri)
- `auth.html` — Login + Register + Şifre sıfırlama + E-posta doğrulama + Email değiştirme + 2FA setup + Onboarding (3 adım) — **Detay: `EKRAN-AUTH.md` (2026-05-15)**

**Public vitrin tarafı (yeni merkezi vitrin — 5 sayfa):**
- `vitrin-anasayfa.html` — `/vitrin` ana
- `vitrin-arama.html` — `/vitrin/arama` + `/vitrin/[il]/[ilce]`
- `vitrin-urun.html` — `/vitrin/urun/[slug]` + cross-tenant kıyaslama
- `vitrin-magaza.html` — `/vitrin/magaza/[slug]` pet shop profili
- `vitrin-ana-petstockpro.html` — `petstockpro.com` SaaS landing (Faz 2)

---

## 2. Tasarım Dili Özeti (TASARIM-SISTEMI.md)

> Mockup yapan tool/insan **bunları bilmek zorunda**.

### 2.1 Tipografi
- **Font:** **Verdana** (saf, sistem font) — Geneva, Tahoma, sans-serif fallback
- **Mono:** Consolas, "Lucida Console", Monaco
- **❌ Plus Jakarta Sans / Fraunces / JetBrains Mono kullanma** (eski karar, iptal)
- Boyutlar Verdana'ya kalibre: body 13px, başlık 20-26px, KPI büyük 42px

### 2.2 Renk Paleti — 5 Semantik Tema (logodan)

```css
--cat:    #d4621c   /* Turuncu — CTA, accent (kedi) */
--cart:   #1e3a5f   /* Lacivert — primary, sidebar (sepet) */
--arrow:  #22c55e   /* Yeşil — success, büyüme */
--bars:   #7cb8e0   /* Açık mavi — info, chart */
--dog:    #2c4257   /* Antrasit — neutral dark (köpek) */
--danger: #ef4444   /* Kırmızı — sistem (marka değil) */
```

Her renk için 5 ton var: ana, açık (-2), koyu (-700), soft arka plan (-soft).

### 2.3 Görsel Dil
- **Glass morphism** (sidebar, topbar, kartlar — `backdrop-filter: blur`)
- **Mesh gradient** (background, hero — yumuşak çok-renkli geçiş)
- **Paw pattern** (background subtle, opacity 0.025)
- **Hayvan mascot** (kedi + köpek illustration — bento kart watermark, hero görseli)
- **3D tilt** (bento kart hover — `transform: perspective rotateX rotateY`)
- **Border radius:** 8/12/18/24/32 (--r-xs / sm / md / lg / xl)
- **Shadow:** 3 seviye (sm / md / lg) + renk gölgeleri (--shadow-cat / cart / arrow)

### 2.4 Layout
- **Sidebar:** Sol fixed, 240px genişlik, gruplar (Envanter / Operasyon / Kaynaklar / Analiz / 🏪 Vitrin / Ayarlar)
- **Topbar:** Sticky üst, 64px, glass — sayfa başlığı + ⌘K + 🌐 Vitrin link + 🔔 + 🌓 + avatar
- **İçerik:** max-width 1280px, padding 24px

### 2.5 Bileşen Stili — Mockup Referansı

> `D:/Projeler/mockup-admin-premium-v3.html` premium showcase referans.

- **Bento kartlar** — düzensiz grid, farklı boyutlar, tilt hover
- **KPI ring** — circular progress (36×36, stroke 4px), plan limit göstermek için
- **Activity feed** — sticky sağ kolon, 30s polling, 🚨 superadmin işareti
- **Glass topbar** — backdrop-filter blur, alt border subtle
- **Premium button** — `--cat` gradient + `--shadow-cat` renkli gölge, hover bounce
- **Drawer** — sağdan slide-in, max-width 560px, backdrop blur

---

## 3. Yapım Yaklaşım Seçenekleri

| Seçenek | Avantaj | Dezavantaj | Uygunluk |
|---|---|---|---|
| **(a) Bana yaptır (Claude Code)** | Doğru klasöre direkt yazar, dokümanlardan eşik bilgileri okur, tutarlılık | Her ekran için bir mesaj turn'ü gerek | ✅ Tutarlılık + dokümana sadakat için ideal |
| **(b) Claude.ai artifacts** | Web claude.ai üzerinde interaktif HTML preview, hızlı iterasyon | Dosya manuel kopyala-yapıştır, prompt context kayıp | Tek ekran için OK, çoklu zor |
| **(c) v0.dev** | shadcn/ui native React component üretir | HTML mockup değil React, mevcut HTML akışıyla uyumsuz, ücretli | Sprint 1+ React implementasyonu için iyi, mockup için değil |
| **(d) Lovable / Bolt.new** | Tam stack mockup (deploy edilebilir) | Gereksiz kompleks, mockup için aşırı | Mockup için fazla |
| **(e) Figma + harici tasarımcı** | Pixel-perfect, design system iyi | Pahalı + uzun | Lansman sonrası v2 için, MVP için değil |

**Önerim: (a) — Bana yaptır.** Sebepler:
- Dokümanlar (EKRAN-*.md) zaten detaylı brief — direkt okuyup HTML üretebilirim
- Mevcut mockup'larla aynı CSS variable + font sistemi
- Plan tier (3-tier B 2026-05-14), vitrin yapısı (merkezi tek 2026-05-13), KVKK, TR-only kararları gibi son kararlara sadakat
- Tek seferde 14 mockup üretmek tek mesaj turn'ünde mümkün değil ama 2-3 turn'de hepsi hazır
- Pet/ deki eski mockup-admin-premium-v3.html bana referans — pattern'i takip ederim

---

## 4. Önerilen Yapım Sırası (Öncelik)

### 4.1 Faz 1 — Mevcut 4 mockup yenile (Verdana + son kararlar)

Sprint 0 öncesi yapılmalı (kod yazılmadan önce mockup tutarlı olsun):

1. **`pano.html`** — Verdana + topbar'da 🌐 Vitrin link + KPI Aktif Ürün ring 47/50 + plan göstergesi yeni
2. **`urunler.html`** — Verdana + Satışa Aç toggle + Doğrula validation + Bulk vitrine aç + plan limit 50/sınırsız
3. **`stok-hareketleri.html`** — Verdana + minor güncellemeler
4. **`super-admin.html`** — Verdana + Vitrin Modlama 4. sekme (otomatik onay yapısı) + 3-tier B plan tablosu (FREE 50 / PRO 500 / PRO+ ∞, 2026-05-14 YT-7)

### 4.2 Faz 2 — Eksik admin mockup'lar (Sprint 0-7'de gerek)

Sprint sırasına göre:

5. **`auth.html`** — Sprint 2 için (Login + Register + Onboarding + 2FA + Turnstile + email değiştirme — `EKRAN-AUTH.md` detay)
6. **`subeler.html`** — Sprint 6 için (lat/lng zorunlu vurgu + harita)
7. **`sayim.html`** — Sprint 5 için (drawer + tam-sayfa)
8. **`dusuk-stok.html`** — Sprint 8 için (R6 sade-tut)
9. **`tedarikciler.html`** — Sprint 9 için (CRUD)
10. **`kullanicilar.html`** — Sprint 9 için (hibrit davet: email/link toggle + rol seçici — 2026-05-14)
11. **`ayarlar.html`** — Sprint 10 için (6 bölüm + Vitrin Profili + Vitrin Metrikleri)
12. **`raporlar.html`** — Sprint 11 için (ana liste + 6 rapor detay — Açık Krediler dahil)

### 4.3 Faz 3 — Public vitrin mockup'lar (Sprint 12 için)

13. **`vitrin-anasayfa.html`** — `/vitrin` merkezi dizin ana
14. **`vitrin-arama.html`** — şehir/ilçe/kategori filtreli liste
15. **`vitrin-urun.html`** — ürün detay + cross-tenant kıyaslama
16. **`vitrin-magaza.html`** — pet shop profili (şube seçici dahil)
17. **`vitrin-ana-petstockpro.html`** — SaaS landing (Faz 2)

### 4.4 Temizlik

18. `vitrin.html` (eski) — sil veya `_LEGACY/` klasörüne taşı

---

## 5. Ekran-Ekran Brief

> Her ekran için: **kapsam + bileşen + data + etkileşim + bağımlılık**.

### 5.1 pano.html (yenile)

**Doküman:** `EKRAN-PANO.md` · **Kod:** [`src/app/admin/page.tsx`](../src/app/admin/page.tsx) (otoritatif — mockup'ın gerisinde)

> **2026-05-21 brief sync:** Implementasyon mockup'tan ileri. Mockup `preview/pano.html` Sprint 0 öncesi tasarım, kod 12+ sprint sonrası. Brief implementasyonu yansıtacak şekilde güncellendi. Mockup yenileme **Faz 2'ye saklı** (tek geliştirici sade-tut — kod canonical).

**Bileşenler (testid sırasıyla):**
- Topbar (`AdminTopbar`) — sayfa başlığı + tarih + ⌘K + 🌓 Theme + 🏪 Vitrin link + 🛡 Süperadmin (varsa) + 🔍 İzleyici (OBSERVER ise) + 🔔 NotificationBell (sayı rozet, cache-reactive, 2026-05-21 fix) + avatar + çıkış
- Sidebar (`AdminSidebar`) — brand + nav gruplar + plan progress + düşük stok rozet
- `pano-hero` — karşılama (companyName + son işlem zamanı) + 2 CTA (`hero-add-product` + `hero-stock-in`) + `hero-logo-wrap` mascot
- `kpi-trio` — 3 büyük KPI (Ciro/Hareket/Vitrin görüntülenme 7g) + mini sparkline
- `stock-strip` — Envanter değeri + şube breakdown + Aktif Ürün `N/limit` plan progress
- `pano-alert` + `pano-alert-cta` — kritik tek mesaj (varsa) → ilgili eyleme link
- `quick-chip-row` — 4 hızlı eylem chip (Stok Girişi / Yeni Satış / Transfer / Sayım)
- `pano-notif-feed` — son okunmamış 5 bildirim mini-feed (Sprint 15+)
- `pano-feedback-widget` — vitrin WhatsApp feedback özet (Sprint 12+ — funnel + ortalama rating)
- `petpro-transfer-suggestions` — şubeler arası transfer önerisi (rule-based)
- `petpro-discount-suggestions` — ölü stok indirim önerisi
- `petpro-expiring-suggestions` — SKT yakın ürünler
- `petpro-assistant` — kombine sipariş öneri kartı (low-stock + supplier grup)
- 2-kolon son aktivite grid: `recent-activity-all-ledger` (son 10 stok hareketi) + `recent-activity-today-audit` (bugünkü audit log)

**Data örnek:** Mavi Pet Shop, FREE 47/50 ürün, bugün 14 satış 1.850₺ ciro, 5 düşük stok ürün
**Etkileşim:** Hızlı Eylem chip'leri ilgili sayfaya navigate, KPI tıklama filtreli sayfa
**Bağımlılık:** TASARIM-SISTEMI tüm tokenlar + `notificationKeys` query cache key

---

### 5.2 urunler.html (yenile)

**Doküman:** `EKRAN-URUNLER.md`
**Yeni eklenenler (Verdana geçişi yanında):**
- **§5.5 Satışa Aç toggle** — her satırın sağında, açılırsa Doğrula buton (disabled→enabled validation pass sonrası)
- **§5.6 Stok 0 davranışı** — toggle OFF + tooltip "Stok bittiği için otomatik çekildi"
- **§8.8 Bulk vitrine aç/çıkar** — bulk action bar'da yeni buton
- Plan progress bar `FREE 47/50` (eski 18/20'den dönüştü)
- Validation hata göstergesi (eksik görsel/fiyat tooltip)

**Bileşenler:** 4 KPI üst şerit + filtre paneli + ürün tablo (sticky kolon Satışa Aç) + stok matrix expand + detay drawer + yeni/düzenle 2-kolon form
**Data:** Royal Canin Adult Kedi 2kg variant'lı + 35 ürün liste
**Etkileşim:** Toggle açıldığında AJAX validation çağrı, modal vergi no tetikleyici, bulk işlem onay

---

### 5.3 stok-hareketleri.html (yenile)

**Doküman:** `EKRAN-STOK-HAREKETLERI.md`
**Bileşenler:** Üst bar (Yeni Hareket dropdown 4 tip) + filtre paneli + özet bar sticky + ana tablo + 4 hareket drawer (Giriş/Çıkış/Transfer/Sayım) + detay drawer + geri alma 24h + audit hash basit
**Data:** Son 30g 850 hareket
**Etkileşim:** Drawer'lar slide-in, Sayım drawer tam-sayfa workflow'a yönlendirir
**Yenilik:** Sadece minor — eski font + son düzeltmeler

---

### 5.4 super-admin.html (yenile)

**Doküman:** `EKRAN-SUPERADMIN.md` + `SUPERADMIN-YETKILERI.md`

> **🚀 2026-05-14 not — Mockup dosya adı kalır, ama URL artık ayrı sayfa değil:** `preview/super-admin.html` dosya adı (mevcut mockup'a referans) **korunuyor**, ancak gerçek implementasyonda bu sayfa ayrı bir URL/sayfa **DEĞİL** — ANA `/admin` panelinin SUPERADMIN-only sidebar alt grubudur (`/admin/tenants`, `/admin/audit`, `/admin/plan-approval`, `/admin/db-inspector`, `/admin/system-settings`). Mockup HTML'i bu route'lardan herhangi birinin görsel önizlemesi olarak yorumlanır. Brief: "URL `/admin`, role-based menü, ayrı sayfa değil; sidebar SUPERADMIN için ek grup render eder."

**Yeni eklenenler:**
- **4 sekme:** Tenant'lar / Audit / Plan Onay / **Vitrin Modlama** (yeni)
- Vitrin Modlama 5 alt-sekme: Manuel İnceleme / Bildirimler / Otomatik Filter / Onay Logları / Bayi Admin (Faz 3 disable)
- Otomatik onay vurgusu (KPI: %94 oto-onay)
- Süperadmin felsefe banner (kişisel kontrol/müdahale, operasyonel müdür değil)
- Toolbox FAB (sağ alt, 4 kategori yetki)
- 3-tier B plan tablosu (FREE 50 / PRO 500 750₺ / PRO+ ∞ 1.750₺, 2026-05-14 YT-7) — preview/super-admin.html güncellenmesi gerekir (önceki 2-tier mockup geçersiz)

---

### 5.5 auth.html (YENİ — Sprint 2 için)

**Doküman:** `EKRAN-AUTH.md` (2026-05-15 yeni doc — auth akışının tek source'u, 15 bölüm + 52 test)

**Bileşenler (EKRAN-AUTH.md referansları):**
- **Login (`§2`)** — sol panel (logo + slogan + mascot), sağ form (email + şifre + "Şifremi unuttum" + 2FA TOTP step). **5+ başarısız sonrası Turnstile widget görünür.** Google OAuth YOK (TR-only sadeleştirme).
- **Register (`§3`)** — sol panel + sağ form (pet shop adı + email + şifre + şifre tekrar + **2 KVKK checkbox: Aydınlatma onayı + Frankfurt veri lokasyonu açık rıza**) + **Turnstile widget zorunlu**
- **E-posta doğrulama bekleme (`§4.1`)** — info sayfa + "Yeniden Gönder" 60sn cooldown countdown + spam klasör notu
- **E-posta doğrulama token tıklama (`§4.2`)** — başarılı/hatalı durum sayfası
- **Şifremi unuttum (`§5.1`)** — email + **Turnstile zorunlu** + generic mesaj (enumeration koruma)
- **Şifre sıfırlama (`§5.3`)** — yeni şifre + tekrar + HIBP check + "TÜM oturumlar kapanacak" uyarı
- **Email değiştirme (`§6`)** — çift doğrulama (eski + yeni email)
- **2FA setup wizard (`§7`)** — Adım 1 QR kod tara → Adım 2 6 haneli kod → Adım 3 8 recovery code (kopya/yazdır + checkbox)
- **Account locked sayfası (`§10.2`)** — geri sayım + "Şifremi unuttum" alternatifi
- **Onboarding (`§8`)** — 3 adım wizard (ilk şube → ilk ürün → vitrin profili opsiyonel)
- **Davet kabul (`§EKRAN-KULLANICILAR §4.4`)** — hibrit davet token tıklama akışı (email veya link)

**Cloudflare Turnstile bileşeni:** `@marsidev/react-turnstile` paketi, **TR locale**, theme=light, size=normal. Widget mode: Managed (Cloudflare otomatik invisible/widget seçer).

**Test sayısı:** 52 AUTH-* senaryosu (EKRAN-AUTH §13)

**Önemli:** Vergi no kayıt formunda **YOK** (2026-05-13 kararı)

---

### 5.6 subeler.html (YENİ — Sprint 6 için)

**Doküman:** `EKRAN-SUBELER.md`
**Bileşenler:** Kart grid (default) + tablo alternative + harita opsiyonel toggle + yeni şube form (lat/lng harita pin) + detay drawer + branch_inventory matrix
**Yeni vurgu:** **Vitrin için lat/lng zorunlu** banner — "Vitrin'de görünmek için en az bir şubenin haritada konumu olmalı"

---

### 5.7 sayim.html (YENİ — Sprint 5 için)

**Doküman:** `EKRAN-SAYIM.md`
**Bileşenler:** Drawer (başlatıcı: şube + mod + yumuşak kilit) + tam-sayfa workflow (parent grup + variant satırlar + sayım input + fark sebepleri + Tab/Enter atlama + onay modal)

---

### 5.8 dusuk-stok.html (YENİ — Sprint 8 için)

**Doküman:** `EKRAN-DUSUK-STOK.md`
**Bileşenler:** 3 KPI üst + filtre + tablo (kritiklik dot + öneri sipariş) + Toplu Sipariş Hazırla (R6 sade-tut: tek tedarikçi tek drawer, çoklu sıralı drawer)

---

### 5.9 tedarikciler.html (YENİ — Sprint 9 için)

**Doküman:** `EKRAN-TEDARIKCILER.md`
**Bileşenler:** KPI + tablo + yeni/düzenle form (vergi no + tedarik süresi + ödeme koşulları + IBAN) + detay drawer (son alımlar + toplam alım stat)

---

### 5.10 kullanicilar.html (YENİ — Sprint 9 için)

**Doküman:** `EKRAN-KULLANICILAR.md`
**Bileşenler:**
- **KPI 3 kart:** Toplam kullanıcı + ADMIN sayısı + STAFF sayısı (kasiyer rolü MVP'de aktif, S1)
- **Tablo:** ad-soyad, email, rol, şube, status, son giriş; hover satırda 👁/✏/🔑/⋯
- **Davet mini modal (hibrit — 2026-05-14):**
  - Email field + Gmail "+" alias notu (K3)
  - Rol radio: Bayi sahibi / Şube müdürü / Kasiyer (STAFF)
  - Şube dropdown (müdür/kasiyer için)
  - **Davet yöntemi radio:**
    - 📧 E-posta gönder (varsayılan, 7 gün TTL, Brevo otomatik)
    - 🔗 Davet linki üret (24 saat TTL, admin elden iletir)
  - Submit sonrası:
    - Email yöntem: "✓ Davet email gönderildi" toast
    - Link yöntem: Modal değişir → 🔗 URL + [📋 Linki Kopyala] butonu (clipboard write)
- **Detay drawer:** aktif oturumlar + 2FA durum + rol/şube değiştir + yeniden davet (method seçici)
- **Bekleyen davet badge'i:** "Davet bekliyor · 5 gün kaldı" sarı / "Süre doldu" kırmızı + "Yeniden Davet"

---

### 5.11 ayarlar.html (YENİ — Sprint 10 için)

**Doküman:** `EKRAN-AYARLAR.md`
**Bileşenler:** Stripe-style sol sidebar bölüm seçici + sağ içerik. **6 bölüm + 2 alt-tab:**
- Şirket Profili (vergi no opsiyonel notu)
- Plan + Fatura (3-tier B FREE/PRO/PRO+ — TR-only, Paddle Faz 2'ye saklı 2026-05-14 YT-7)
- **Vitrin** (yeni alt-tab grup):
  - **Vitrin Profili** (slug, logo, kapak, WhatsApp, çalışma saatleri, KVKK onay)
  - **Vitrin Metrikleri** (KPI + en çok ilgi gören + şehir dağılımı)
- Yerelleştirme (dil + currency + KDV)
- Bildirim (Telegram bağlama 3 adım + bildirim tipleri toggle)
- Güvenlik (2FA + şifre + aktif oturumlar)
- Veri / KVKK (export + KVKK linkleri)

---

### 5.12 raporlar.html (YENİ — Sprint 11 için)

**Doküman:** `EKRAN-RAPORLAR.md`
**Bileşenler:** Hibrit kart grid (6 rapor özet kartı) + drilldown detay sayfası (filtre + ana chart + yan widget + tablo + export PDF/Excel)
**6 rapor:** Satış / Kâr-Zarar / En Çok Satan / Ölü Stok / Şube Karşılaştırma / 💳 Açık Krediler (2026-05-14 S2)

---

### 5.13 vitrin-anasayfa.html (YENİ — Sprint 12 için)

**Doküman:** `EKRAN-PUBLIC-VITRIN.md §4`
**Bileşenler:**
- Header (logo + arama + il dropdown + TR/EN + Pet shop sahibi misin? CTA)
- Info bar (3 mesaj rotation: "1.247 ürün · 47 şehir")
- Hero (slogan + konum izni prompt + il seç)
- Kategori grid (6 ana kategori)
- Yakındaki pet shop'lar (harita + 4 kart, konum varsa)
- Popüler ürünler (8 kart cross-tenant)
- Şehir grid (6 ana şehir)
- İletişim CTA (Pet shop kayıt)
- Footer
- Cookie banner (KVKK + GDPR opt-in)

**Önemli:** **Tek tema PetStockPro markası** (eski 5 hazır tema kaldırıldı). Tüm pet shop'lar eşit görünür.

---

### 5.14 vitrin-arama.html (YENİ — Sprint 12 için)

**Doküman:** `EKRAN-PUBLIC-VITRIN.md §5-6`
**Bileşenler:** Header + breadcrumb + filtre (sol sidebar) + üst bar (sıralama: mesafe/fiyat/yeni) + ürün grid (4 sütun, mesafe rozeti) + harita opsiyonel + pagination

---

### 5.15 vitrin-urun.html (YENİ — Sprint 12 için)

**Doküman:** `EKRAN-PUBLIC-VITRIN.md §7`
**Bileşenler:**
- Galeri (sol)
- Ürün bilgi (sağ — variant tabs + fiyat aralığı)
- **Cross-tenant kıyaslama tablo** (3-5 pet shop: mesafe + stok + fiyat + WhatsApp butonu)
- "Neden bu sırada" link → algoritma açıklama modal
- Ürün açıklaması + teknik bilgiler
- Aynı kategoriden öneriler (4 kart)
- Bildiri butonu (🚩)

---

### 5.16 vitrin-magaza.html (YENİ — Sprint 12 için)

**Doküman:** `EKRAN-PUBLIC-VITRIN.md §8`
**Bileşenler:**
- Kapak fotoğrafı + logo + isim
- Bilgi bandı (adres + saatler + WhatsApp)
- **Şube seçici dropdown** (multi-branch için)
- Harita (Leaflet, şube pin)
- Hakkımızda
- Bu pet shop'ta arama + filtre
- Ürün grid (sadece bu pet shop'un vitrin'e açtığı ürünler)
- Çalışma saatleri 7 gün tablo
- İletişim
- Bildiri butonu

---

### 5.17 vitrin-ana-petstockpro.html (YENİ — Faz 2)

SaaS landing (`petstockpro.com/`) — pet shop sahibi geldiğinde gördüğü sayfa. Hero (FREE'den başla) + 3 değer önerisi + nasıl çalışır + müşteri kanıtı + fiyat tablosu (FREE/PRO) + son CTA. Standard SaaS landing pattern.

---

## 6. Brief Şablonu (Harici Tool için — Claude.ai / v0 / Lovable)

Eğer (b) Claude.ai artifacts veya (c) v0/Lovable ile yapmak istersen, her ekran için bu prompt şablonunu kullan:

```
PetStockPro pet shop SaaS uygulaması için [EKRAN ADI] mockup HTML/CSS oluştur.

DESIGN SYSTEM (zorunlu):
- Font: Verdana, Geneva, Tahoma, sans-serif (sistem font, Google Fonts YOK)
- Renk paleti (CSS variables):
  --cat: #d4621c (turuncu, CTA)
  --cart: #1e3a5f (lacivert, primary)
  --arrow: #22c55e (yeşil, success)
  --bars: #7cb8e0 (açık mavi, info)
  --dog: #2c4257 (antrasit, neutral)
  --danger: #ef4444
- Border radius: 8/12/18/24/32px
- Stil: Glass morphism (backdrop-filter blur) + mesh gradient background +
        paw pattern (subtle %2.5 opacity) + hayvan mascot (kedi+köpek illustration)
- Layout: Sidebar 240px sol fixed + topbar 64px sticky glass + content 1280px max

İÇERİK (referans dokümana sadık):
[Buraya ilgili EKRAN-XXX.md doküman içeriğini yapıştır — bileşen listesi + data örnek + etkileşim]

ÖZEL KURALLAR:
- Plan tier: 3-tier B (2026-05-14) — FREE 50 ürün / PRO 500 ürün 750₺ / PRO+ Sınırsız 1.750₺ (KDV dahil)
- TR-only — Paddle/USD/EUR/EN locale kapsam dışı
- Vitrin: merkezi tek (petstockpro.com/vitrin), tenant subdomain YOK
- WhatsApp deep link (wa.me/...), biz API kullanmıyoruz
- Türkçe arayüz
- Sample data: Mavi Pet Shop, Royal Canin, Whiskas, Üsküdar/Kadıköy

ÇIKTI:
Tek HTML dosyası, inline CSS, ~2500-3000 satır. JavaScript minimal (interaktif olmayan mockup).
```

---

## 7. Karar Soruları

Senden 3 net karar bekliyorum:

### Karar 1 — Yapım yaklaşımı
- (a) **Bana yaptır** (Claude Code, sırasıyla mockup üretirim)  ← önerim
- (b) Claude.ai artifacts (sen oraya prompt yapıştırırsın)
- (c) v0.dev / Lovable (React component üretir, mockup için fazla)

### Karar 2 — Yapım sırası
- (i) **Önce 4 mevcut güncel** (Verdana + son kararlar) → sonra eksikler — en sade ✅
- (ii) Önce eksik admin'ler (auth, subeler, sayim...) → sonra mevcut güncelle
- (iii) Önce vitrin (5 sayfa) → sonra admin

### Karar 3 — Tek seferde mi parça parça mı?
- (A) Tek seferde 17 mockup'ı plan dosyasına yaz, sırayla yap (uzun bir dizi turn)
- (B) **Sprint sırasına göre yap** — Sprint 0'dan önce sadece Faz 1 (mevcut 4 güncel), sonra her sprint başında ilgili mockup ✅
- (C) Sadece kritik 5-6 ekran (Pano / Ürünler / Auth / Vitrin Anasayfa / Vitrin Ürün Detay / Vitrin Pet Shop Profili) — gerisi sprint'te yap

---

## 8. Sıradaki Adım

Karar 1 + 2 + 3'ü onaylarsan başlıyorum. Önerim: **(a) Bana yaptır + (i) Mevcut 4 güncel önce + (B) Sprint sırasına göre**.

Bu durumda ilk turn'de: `pano.html` Verdana + son kararlarla yenilenir. Sonraki turn `urunler.html`. Toplam ~14 turn'de hepsi hazır olur, ama her sprint öncesi sırayla yapılırsa daha sağlıklı (her sprint'in başında ilgili mockup baz alınır, düzeltmeler kod yazılırken yapılır).

---

*Son güncelleme: 2026-05-14. Brief + tool karar + prompt şablonu hazır.*
