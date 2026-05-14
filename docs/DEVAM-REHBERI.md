# PetStockPro — Yeni Session Devam Rehberi

**Tarih:** 2026-05-14
**Önceki Session Tarihi:** 2026-05-13/14 (büyük revizyon — PRO+ kaldırıldı, vitrin merkezi tek modeli, ödeme entegrasyon dokümante)
**Durum:** Sprint 0 öncesi son kontrol — **13 açık nokta + 4 mockup yenileme + Sprint 0 başlatma**

---

## 🚀 YENİ SESSION'A GİRDİĞİNDE BU SIRAYI TAKİP ET

1. **`CLAUDE.md`** — proje genel durumu (TS/Supabase stack, son kararlar)
2. **Bu doküman (`DEVAM-REHBERI.md`)** — bekleyen kararlar + 13 mantık noktası ⭐
3. **`PLAN-KADEMELERI.md`** — **3-tier B (2026-05-14): FREE 50 / PRO 500 750₺ / PRO+ ∞ 1.750₺, TR-only**
4. **`EKRAN-PUBLIC-VITRIN.md`** — merkezi tek vitrin (Sahibinden modeli, 2026-05-13 yeniden yazıldı)
5. **`PAYMENT-INTEGRATION.md`** — iyzico + Nilvera (Paddle TR-only kararıyla 2026-05-14'te kaldırıldı)
6. **`UI-MOCKUP-PLAN.md`** — 17 mockup brief + öncelik
7. **`DATABASE-SCHEMA.md`** — 30 tablo (cities/districts/vitrin_events/bayi_admin eklendi)

Önceki session'da kullanıcı **çok kritik** uyarısı verdi:
> "bu chat çok kritik, bu chat de olanlar son kararlar, sakın birşeyi arkaplana atma"

Yani önceki PetStockPro/docs/ tasarımı (2026-05-12) ile yeni kararlar arasındaki **çelişkilerde yeni karar geçerli**. Eski tasarımı koruma çabası yapılmamalı.

---

## 📌 SONUÇLANDIRILMIŞ KARARLAR (Artık Tartışılmıyor)

### Mimari + Stack
- ✅ Stack: Next.js 16 + Supabase + Drizzle + Auth.js v5 + shadcn/ui + Cloudflare Workers (TS end-to-end)
- ✅ Schema: `petstockpro` (Supabase'te custom schema)
- ✅ Eski Pet/ klasörü **legacy referans** — kod kopyalanmıyor, dokümanları bile eski

### Plan Tier (3-tier B — 2026-05-14 revize, TR-only)

> 2026-05-13 "2-tier, PRO+ rafa" kararı **iptal edildi**. Yeni karar:

- ✅ **FREE 50 ürün** (0 ₺) — denemelik
- ✅ **PRO 500 ürün** (750 ₺/ay KDV dahil) — orta segment esas pazar
- ✅ **PRO+ Sınırsız** (1.750 ₺/ay KDV dahil) — büyük zincirler
- ✅ Tek farklılaşma stok limiti — tüm özellikler her planda açık
- ✅ Custom domain, custom CSS, API erişimi, white-label, öncelikli destek hâlâ **YOK** (kapsam dışı)
- ✅ **TR-only:** Paddle MoR kaldırıldı, EN locale gizlendi, Frankfurter kur kaldırıldı, sadece iyzico + Nilvera

### Vitrin Yapısı (2026-05-13)
- ✅ **Merkezi tek vitrin:** `petstockpro.com/vitrin` — Sahibinden / Yelp modeli
- ✅ **Tenant subdomain YOK** (`{slug}.petstockpro.com` modeli iptal)
- ✅ **Tek tema** — pet shop'lar eşit görünür (PetStockPro markası altında)
- ✅ Pet shop profili: `/vitrin/magaza/[slug]` (public, herkes görür)
- ✅ Cross-tenant ürün kıyaslama (3-5 pet shop fiyat + mesafe)
- ✅ Sıralama algoritması: Mesafe %40 + Stok %25 + Güncellik %15 + Profil tamlığı %10 + Üye yaşı %10

### Para Akışı Çizgisi (2026-05-14 — DEĞİŞMEZ)
- ✅ **B2C (müşteri↔pet shop):** PetStockPro **ASLA dahil değil**
- ✅ **B2B (pet shop→PetStockPro):** PRO aboneliği iyzico/Paddle ile bizim gelirimiz
- ✅ Online sipariş YOK, sepet YOK, ödeme aracılığı YOK, komisyon YOK, kargo YOK
- ✅ Sadece WhatsApp deep link (`wa.me/...`) — biz API kullanmıyoruz, müşteri kendi gönderir
- ✅ Telegram = ADMIN bildirim kanalı (müşteri tarafı değil — karışmasın!)

### 3 Vitrin Yer Diyagramı (2026-05-14 netleştirildi)
- 1️⃣ **Genel Vitrin (public):** `/vitrin` — tüm pet shop dizini
- 2️⃣ **Pet Shop Profil (public):** `/vitrin/magaza/[slug]` — bir pet shop'un public sayfası
- 3️⃣ **Admin Yönetim (auth):** `/admin/settings/vitrin` — pet shop sahibi profili düzenler

### Yeni Özellikler (Bu Chat'te Eklenen)
- ✅ **Stok 0 → vitrin'den otomatik çekme** + Telegram bildirim, manuel "Satışa Aç" ile geri açma
- ✅ **"Satışa Aç" toggle + "Doğrula" validation gate** (her ürün satırında)
- ✅ **Vergi no kayıtta opsiyonel**, "Satışa Aç" tetikleyici, asla otomatik askıya alınmaz
- ✅ **Cities + Districts seed** (81 il + ~970 ilçe — `client/src/data/turkeyDistricts.ts` Pet/'ten dönüşüm)
- ✅ **PostGIS extension** (yakınlık sorgusu için)
- ✅ **Bayi Admin (Faz 3)** — schema hazır, UI Faz 3'te
- ✅ **Vitrin Modlama** süperadmin 4. sekme

### Süperadmin Felsefesi (2026-05-14)
- ✅ **Operasyonel müdür DEĞİL** — kullanıcı net dedi: "süperadmin'i kendim için yaptım, izlemek + ekran üzerinden fix vermek"
- ✅ **Otomatik onay** + manuel istisna modlama (1000+ pet shop'a manuel onay imkansız)
- ✅ Sistemin takıldığı + kullanıcıların ciddi yanlışlar yapabileceği durumlarda manuel müdahale

### Ödeme Entegrasyonu (Sprint 13/14)
- ✅ **iyzico** Subscription (TR)
- ✅ **Nilvera** e-Arşiv (TR — pet shop'un kendi vergi yükümlülüğü için)
- ✅ **Paddle** MoR (yurt dışı — KVKK Madde 9 yurt dışı veri aktarım açık rıza akışı)
- ✅ Sub-processor listesi: Paddle + Supabase + Cloudflare + Brevo + Sentry + Telegram + iyzico + Nilvera

---

## ⚠ BEKLEYEN KARARLAR — 13 AÇIK NOKTA

### 🔴 KRİTİK (Lansman Bloker — Çözülmezse Lansman Yapılamaz)

#### 1. PetStockPro'nun Kendi Şirket/Vergi Durumu

**Sorun:** iyzico Bayi Sözleşmesi + Paddle Vendor + Nilvera mali mühür **hepsi şirket vergi no + IBAN ister.** Bu kullanıcının (proje sahibi) yapacağı iş — şirket kuruldu mu? Şu an PetStockPro'nun yasal varlığı yok görünüyor.

**Etki:** Sprint 13 (iyzico) + Sprint 14 (Paddle + Nilvera) implementasyonu yapılır ama production'a geçemez (sözleşme yok).

**Aksiyon (kullanıcı yapacak — Claude değil):**
- Limited şirket kuruluş (~15-20K₺ noter/kuruluş + odası) **veya** şahıs şirketi açma
- Vergi numarası al
- TR ticari banka hesabı + IBAN
- Mali müşavir anlaşması (ay ~2-3K₺)
- Lansmandan **en az 2 ay önce** tamamlanmalı

**Doküman güncellemesi:** PAYMENT-INTEGRATION.md §7'ye "Lansman ön-koşul: PetStockPro şirket kuruluş" eklenmeli.

#### 2. Komisyon Hesabı Gelir Tahminine Düşülmemiş

**Sorun:** DEPLOYMENT.md gelir hedefi `1K tenant × %30 PRO × 500₺ = 150K₺/ay (~$5K)` ama:
- iyzico tahsilat ücreti ~%3 + 0.25₺ → 500₺'den net **~485₺**
- Paddle komisyon ~%5 + $0.50/işlem → $20'den net **~$18.50**
- Mali müşavir bütçesi (~2-3K₺/ay) düşülmemiş
- Kurumlar vergisi (%25 TR) düşülmemiş

**Etki:** Gerçek net gelir tahmini **çok daha düşük**. Lansman strateji kararı yanlış varsayım üzerine.

**Aksiyon (Claude düzeltir):** DEPLOYMENT.md §6 maliyet/gelir tablosunu net gelir formülüne çevir:
```
Brüt: 1K × %30 PRO × 500₺ = 150K₺/ay
- iyzico tahsilat ücreti (%3): -4.5K₺
- Mali müşavir: -2.5K₺
- Sunucu/altyapı: -7.5K₺ (Cloudflare + Supabase + Sentry + Brevo)
- Kurumlar vergisi (yıllık): -16K₺/ay ortalama
- Net: ~119K₺/ay (~$4K)
```

#### 3. Vitrin Metrikleri Etiketleme Karışık

**Sorun:** Pet shop "47 görüntüleme" görüyor — ama bu ne?
- Profil sayfası ziyareti mi?
- Ürün detayda görüntülenme mi?
- Vitrin aramada listelenme mi?

**Etki:** Pet shop yanlış metrik üzerine karar verir, conversion ölçemez.

**Aksiyon (Claude düzeltir):** DATABASE-SCHEMA `vitrin_events` event_type enum + EKRAN-PUBLIC-VITRIN §13 metrikleri 4 ayrı:
- 👁 **Profil görüntüleme** (`profile_view`) = `/vitrin/magaza/[slug]` ziyaret
- 🛍 **Ürün görüntüleme** (`product_view`) = pet shop'un ürünü detayda
- 🔍 **Listede gösterilme** (`listing_impression`) = aramada/kategoride listelendi
- 📞 **WhatsApp tıklama** (`whatsapp_click`) = en kıymetli (conversion)

Mevcut vitrinEventTypeEnum güncelleme:
```ts
export const vitrinEventTypeEnum = pgEnum('vitrin_event_type', [
  'home_view',
  'profile_view',         // YENİ — pet shop profili ziyareti
  'product_view',
  'listing_impression',   // YENİ — aramada listelendi
  'category_view',
  'whatsapp_click',
  'phone_click',
  'telegram_click',
  'directions_click',
  'search',
]);
```

#### 4. Variant Bazlı Vitrin Gösterimi YOK

**Sorun:** DATABASE-SCHEMA `vitrin_published` **products** (parent) tablosunda. Variant'ta yok.

**Senaryo:** Royal Canin Adult Kedi parent + 3 variant (400g, 2kg, 10kg). Pet shop sadece 2kg ve 10kg'ı vitrin'e koymak istiyor (400g stokta var ama satışa açmak istemiyor — küçük paket için müşteri direkt arasın). Şu an mümkün değil.

**Karar gerek:** İki seçenek
- (a) **Parent-only (önerim — sade):** Tüm variant'lar birlikte vitrin'e çıkar veya hiçbiri. Kullanıcı: "tek ürün, 3 boyut" — sade UX
- (b) **Variant bazlı:** Her variant için ayrı toggle. Kompleks UX (50 ürün × 3 variant = 150 toggle)

**Önerim:** (a) parent-only. Pet shop satmak istemediği variant'ı **arşivler** (variant level isActive=false). Faz 2'de variant bazlı talep gelirse açılır.

**Aksiyon (Claude düzeltir):** EKRAN-URUNLER §5.5 + DATABASE-SCHEMA §3.3'e karar notu eklensin.

#### 5. Backup Stratejisi Yetersiz

**Sorun:** DEPLOYMENT Supabase Free **7 gün backup**. KVKK audit log 5 yıl, ledger 5 yıl saklama gerek.

**Senaryo:** Pet shop 10 gün önce ürün arşivledi → "yanlışlık, geri istiyorum" → kayıp.

**Etki:** Pet shop güveni sarsılır, KVKK denetimde sorun.

**Aksiyon (kullanıcı + Claude):**
- Lansmanda **Supabase Pro tier ($25/ay)** zorunlu
  - 30 gün backup
  - Point-in-Time Recovery (~5dk RPO)
- Manuel haftalık `pg_dump` snapshot Cloudflare R2'ya (KVKK 5 yıl saklama için)
- DEPLOYMENT.md §7 Backup bölümü güncellensin

---

### 🟡 ÖNEMLİ (Sprint Öncesi Netleşmeli)

#### 6. Bayi Admin Email Constraint (Faz 3)

**Sorun:** `users.email UNIQUE`. Aynı kişi hem Mavi Pet Shop ADMIN hem Bayi Admin olamaz (tek email).

**Senaryo:** Ahmet Bey hem `mavi@petshop.com` ile Mavi Pet ADMIN, hem aynı email ile Mavi+Sarı için BAYI_ADMIN olmak istiyor. UNIQUE constraint engelliyor.

**Karar gerek (Faz 3 öncesi şart):**
- (a) `(email, role)` composite unique
- (b) `user_company_memberships` tablosu — tek user → çoklu tenant + farklı rol
- (c) Bayi admin **ayrı email** kullansın (Faz 3'te kullanıcıya talimat)

**Önerim:** (b) — temiz multi-tenancy mimari. Faz 3'te user-membership refactor.

**Aksiyon (Claude not düşer):** DATABASE-SCHEMA §3.9'a Faz 3 refactor planı eklensin.

#### 7. Vitrin Müşteri Tarafı Currency

**Sorun:** EN locale müşteri vitrin'e girdi. Ürünler TRY mi, USD mi gösterilir?

**Karar gerek:**
- (a) **Vitrin sadece TRY** (TR pet shop, TR müşteri varsayımı, EN UI tercüme ama "₺" kalır)
- (b) Locale'e göre dönüşüm (TRY → USD/EUR güncel kur, Frankfurter API)

**Önerim:** (a) — sade, MVP. Yurt dışı müşteri için disclaimer: "Fiyatlar Türk Lirası — pet shop ile WhatsApp'tan görüşün."

**Aksiyon (Claude düzeltir):** EKRAN-PUBLIC-VITRIN'e currency politika notu §13.6 eklensin.

#### 8. SEO Sitemap Dynamic — Cloudflare Workers Timeout

**Sorun:** ~500K URL kombinasyonu (81 il × 970 ilçe × 6 kategori). Workers 5dk limit, request 100MB max. Her request'te dynamic sitemap üretmek timeout riski.

**Çözüm — Pre-build pattern:**
```
pg_cron gece 03:00 → sitemap.xml üret (sadece içerik olanlar) →
Cloudflare R2'ya yaz → Workers oradan static serve eder
```

**Aksiyon (Claude düzeltir):** EKRAN-PUBLIC-VITRIN §10.2 Sitemap bölümü revize. SPRINT-PLAN Sprint 12'ye sitemap pre-build görev eklensin.

#### 9. Şifre Kuralları + 2FA Recovery YOK

**Sorun:** DATABASE-SCHEMA `users.passwordHash` var ama policy belirsiz. Brute force koruma? Recovery code expire?

**Karar (önerim):**
- Min 8 karakter, en az 1 rakam, 1 büyük harf
- bcrypt cost 12 (Cloudflare Workers'da `bcryptjs`)
- 2FA recovery: 8 kod hashed (SHA256), kullanılınca tükenir, yeniden üretilebilir
- Login rate-limit: **5 deneme / 15 dk** (Cloudflare Workers KV)
- Şifre sıfırlama linki: **30 dk geçerli**, tek kullanımlık
- Brute force: 10 başarısız login → hesap **15 dk lock** + e-posta uyarı

**Aksiyon (Claude düzeltir):** Yeni bölüm `EKRAN-AYARLAR §2.5 Güvenlik` detay revizyon + auth.html mockup planına eklensin.

#### 10. Realtime + Brevo Free Tier Limitleri

**Sorun:**
- Supabase Realtime free **200 concurrent connection** — 1K aktif tenant Pano açıksa limit aşar
- Brevo free **300 mail/gün** — günlük özet (1 mail/tenant) + bildirim + e-posta doğrulama → 100 tenant'ta dolabilir

**Çözüm:**
- Realtime: React `useEffect` cleanup'ta `channel.unsubscribe()` zorunlu (sayfa kapanınca disconnect)
- Brevo: Lansman öncesi **Pro tier ($35/ay)** geçiş — 20K mail/ay
- Telegram bildirimleri Brevo'yu rahatlatır (e-posta yerine Telegram tercih edilirse)

**Aksiyon (Claude düzeltir):** DEPLOYMENT.md §6 maliyet tablosuna **Brevo Pro $35/ay zorunlu (lansman)** + TECH-STACK.md Realtime cleanup notu.

---

### 🟢 İYİLEŞTİRME (Sonra Düşünülebilir)

#### 11. Logo Varyantları Eksik

**Sorun:** `preview/logo.png` 1.5MB tek dosya. Production için lazım:
- Favicon: 16, 32, 180 (apple-touch), 512 (android-chrome)
- OG image: 1200×630 (sosyal paylaşım, e-posta önizleme)
- Light/dark/mono varyantları
- SVG (ölçeklenebilir, küçük dosya)

**Aksiyon (Sprint 2):** `assets/logo/` klasörü altında varyantlar üretilecek (Sprint 2 brand assets task).

#### 12. Onboarding Akışı Net Değil

**Sorun:** UI-MOCKUP-PLAN.md "3 adım onboarding" dedi ama kararlı değil:
- Wizard mı tooltip turu mu?
- Vitrin profili adımı zorunlu mu opsiyonel mi?

**Önerim:**
- **3 adım wizard** (kayıt + e-posta doğrulama sonrası)
- Adım 1: İlk şube ekle (zorunlu) — şirket bilgisi + en az 1 şube
- Adım 2: İlk ürün ekle (zorunlu) — kataloga başlangıç
- Adım 3: Vitrin profili (opsiyonel) — "Sonra hallederim" linki

**Aksiyon (Sprint 2 mockup'ında):** auth.html mockup'a onboarding 3 adım eklensin.

#### 13. Test Senaryoları Dokümanı YOK

**Sorun:** Eski Pet/'te `TARAYICI-TEST-SENARYOLARI.md` 126 senaryo vardı. PetStockPro'da yok.

**Çözüm:** Sprint başlarken her ekran için 10-20 senaryo yazılır (ekran doc'unun sonunda — şu an EKRAN-URUNLER.md'de 30 PROD senaryosu var, bu pattern). Ek olarak `TEST-SENARYOLARI.md` ana indeks dosyası oluşturulabilir.

**Aksiyon (Sprint 0 sonrası):** Her sprint'te ilgili ekran için test senaryosu yaz, PR check'e ekle.

---

## 📐 PANO-V3 REFERANS NOTU

**Lokasyon:** `C:\Users\oguzh\OneDrive\Desktop\pano-v3.html` (830 satır, mevcut preview/pano.html'in %28'i)

**Önemli farklar:**
- External CSS dependency: `../assets/tokens-v2.css` (tüm token'lar bu dosyada)
- Mevcut preview'da inline tokens, bu yapı **DRY** (her mockup aynı CSS'i import edecek)
- Daha **sade ve cesur** tasarım — gereksiz katmanlar atılmış
- Hero turuncu (cat) dominant + 3 KPI bold (cat/cart/arrow) + stock strip + alert + 2-kol body
- Sidebar nav active turuncu gradient (eski lacivert yerine)

**Yeni mockup yapım yaklaşımı:**
1. Önce `Desktop/pano-v3.html` ve `assets/tokens-v2.css` (varsa) PetStockPro/preview ve PetStockPro/assets'e **kopyala**
2. Tüm yeni mockup'lar `tokens-v2.css` import etsin (DRY)
3. Her ekran 800-1500 satır arası (mevcut 2500-2900'den hafifletilmiş)
4. Pano-v3 stilini referans al — sade + cesur

**Pano-v3'teki fontlar:** `var(--font)` kullanıyor (tokens-v2.css'te tanımlı). Verdana'yı confirm etmek için tokens-v2.css'e bakılmalı.

---

## 🎯 SIRADAKİ ADIMLAR (Öncelik)

### Adım 1 — 6 Düzeltme (Claude şimdi yapar, kullanıcı onaylar)

Bu chat'te belirlenen kritik+önemli noktaların doküman güncellemesi:

| # | Konu | Etkilenen Dosya |
|---|---|---|
| #2 | Komisyon hesabı net gelir formülü | `DEPLOYMENT.md §6` |
| #3 | Vitrin metrikleri 4 ayrı etiket | `DATABASE-SCHEMA.md §3.8` + `EKRAN-PUBLIC-VITRIN.md §13` |
| #4 | Variant bazlı vitrin = parent-only kararı | `EKRAN-URUNLER.md §5.5` + `DATABASE-SCHEMA.md §3.3` |
| #7 | Vitrin currency = TRY only politikası | `EKRAN-PUBLIC-VITRIN.md §13.6` (yeni) |
| #8 | SEO sitemap pre-build pattern | `EKRAN-PUBLIC-VITRIN.md §10.2` + `SPRINT-PLAN.md §15` |
| #9 | Şifre kuralları + 2FA recovery policy | `EKRAN-AYARLAR.md §2.5` + `DATABASE-SCHEMA.md §3.1` |
| #10 | Realtime cleanup + Brevo Pro tier | `TECH-STACK.md §3.5` + `DEPLOYMENT.md §6` |

### Adım 2 — Kullanıcı Yapacak (Lansman Bloker)

| # | Konu | Süre |
|---|---|---|
| #1 | PetStockPro şirket kuruluş + vergi no + IBAN | 2-4 hafta |
| #5 | Supabase Pro tier ($25/ay) abonelik (lansman öncesi) | 1 gün |

### Adım 3 — Faz 3 Not (Şimdi yazılır, sonra çözülür)

| # | Konu | Etkilenen Dosya |
|---|---|---|
| #6 | Bayi Admin email constraint refactor (Faz 3) | `DATABASE-SCHEMA.md §3.9` |

### Adım 4 — Sprint Sırasında (İmplementation Aşamasında)

| # | Konu | Sprint |
|---|---|---|
| #11 | Logo varyantları (favicon, OG, light/dark, mono) | Sprint 2 |
| #12 | Onboarding wizard 3 adım | Sprint 2 (auth.html mockup) |
| #13 | Test senaryoları dokümanı | Her sprint başında |

### Adım 5 — Mockup Yapımı (UI-MOCKUP-PLAN.md sırasıyla)

Önerilen sıra:
1. **`assets/tokens-v2.css`** masaüstünden kopyala (PetStockPro/assets/'e)
2. **`pano.html`** Pano-v3 baz alarak yenile (Verdana + topbar 🌐 Vitrin link + 47/50 plan)
3. Sırayla diğer 16 mockup (UI-MOCKUP-PLAN.md §4 öncelik tablosu)

### Adım 6 — Sprint 0 Bootstrap (Mockup'lar bittikten sonra)

`SPRINT-PLAN.md §3` Sprint 0 yapılacaklar:
- Next.js 16 init
- 30+ paket bağımlılık (Auth.js, Drizzle, Supabase, shadcn/ui, ...)
- Supabase petstockpro schema + extensions (postgis, pg_trgm, moddatetime, unaccent)
- Cities + Districts seed
- Drizzle config + connection test
- İlk commit

---

## 📋 BU CHAT'TE TAMAMLANAN İŞLER (Özet)

### Doküman Revizyonları (15 dosya)

| Dosya | Değişiklik |
|---|---|
| `PLAN-KADEMELERI.md` | 2026-05-13: 2-tier → 2026-05-14: **3-tier B (FREE 50 / PRO 500 750₺ / PRO+ ∞ 1.750₺, TR-only)** |
| `DATABASE-SCHEMA.md` | planEnum (FREE/PRO/PRO+), cities+districts+vitrin_events+bayi_admin tabloları, vitrin alanları, custom_domain field kaldırıldı |
| `EKRAN-PUBLIC-VITRIN.md` | **Tamamen yeniden yazıldı** — tenant subdomain → merkezi tek vitrin (Sahibinden modeli) |
| `EKRAN-URUNLER.md` | Satışa Aç toggle + Doğrula validation + stok 0 davranışı |
| `EKRAN-AYARLAR.md` | Vergi no opsiyonel + Vitrin Profili + plan tablosu 2-tier |
| `EKRAN-SUPERADMIN.md` | 3 → 4 sekme (Vitrin Modlama eklendi) + Bayi Admin Faz 3 not |
| `EKRAN-PANO.md` | KPI ring "PRO sınırsız" + plan örnekleri 47/50 |
| `SPRINT-PLAN.md` | Sprint 12 merkezi vitrin yeniden tanımı, Sprint 13/14 PAYMENT-INTEGRATION referans |
| `SUPERADMIN-YETKILERI.md` | 2-tier plan referansı, PRO+ kaldırıldı |
| `TASARIM-SISTEMI.md` | PlanCard tipi 2-tier |
| `TECH-STACK.md` | Custom domain kaldırıldı, Telegram = admin bildirim açıklama |
| `SUPABASE-SETUP.md` | PostGIS + pg_trgm + moddatetime + unaccent extensions |
| `DEPLOYMENT.md` | Tek domain routing, custom domain kaldırıldı, ödeme lansman checklist |
| `MARKA-VARLIKLARI.md` | Meta description "FREE 50 ürün" |
| `CLAUDE.md` | Yeni kararlar özet, çelişki çözümleri |

### Yeni Dokümanlar (3 dosya)

| Dosya | İçerik |
|---|---|
| `PAYMENT-INTEGRATION.md` | iyzico + Nilvera + Paddle + KVKK/GDPR uyum + lansman checklist (~600 satır) |
| `UI-MOCKUP-PLAN.md` | 17 mockup brief + öncelik + tool karar + prompt şablonu (~270 satır) |
| `DEVAM-REHBERI.md` | **Bu doküman** — yeni session devam rehberi |

### EKRAN-PUBLIC-VITRIN.md'ye Eklenen Yeni Bölümler

- §13.4 **Para Akışı + Yasal Pozisyon** (PetStockPro B2C'de SIFIR rol — yasal kalkan)
- §13.5 KVKK + Cookie Banner + ETBİS (müşteri tarafı)
- §20 Merkezi Dizin (yeniden yazılan vitrin yapısı)

### preview/ Mockup Güncellemeleri

| Mockup | Değişiklik |
|---|---|
| `pano.html` | 18/20 → 47/50 plan örneği |
| `urunler.html` | 18/20 → 47/50 plan örneği |
| `stok-hareketleri.html` | 18/20 → 47/50 plan örneği |
| `super-admin.html` | KPI 8 PRO+ kaldırıldı, dropdown PRO+ kaldırıldı, plan tablosu 2-tier |
| `vitrin.html` | LEGACY notu eklendi (tenant subdomain modeli — yeni merkezi vitrin için yeni mockup yapılacak) |

### .env.example

| Değişiklik |
|---|
| `NEXT_PUBLIC_TENANT_SUBDOMAIN_PATTERN` kaldırıldı (tenant subdomain modeli iptal) |
| `ENABLE_CUSTOM_DOMAIN` kaldırıldı (PRO+ kapsam dışı) |

---

## 🚦 KARAR VERİLEN VS BEKLEYEN — Tek Bakışta

### ✅ Karar Verildi (artık tartışılmaz)
- **Plan tier 3-tier B (2026-05-14): FREE 50 / PRO 500 750₺ / PRO+ ∞ 1.750₺ — TR-only**
- Vitrin merkezi tek (`/vitrin`)
- Para akışı çizgisi (B2C'de YOK)
- Stok 0 → vitrin'den çekme
- Satışa Aç toggle + Doğrula
- Vergi no kayıtta opsiyonel
- Cities + Districts seed
- PostGIS aktive
- Bayi Admin Faz 3
- Vitrin Modlama 4. sekme
- Süperadmin felsefe (operasyonel müdür değil)
- iyzico + Nilvera + Paddle entegrasyon
- Pano-v3 referans tasarım

### ⏳ Bekliyor (Yeni Session'da Çöz)
- 6 doküman düzeltme (Adım 1)
- PetStockPro şirket kuruluş (kullanıcı yapar)
- Mockup yapım (UI-MOCKUP-PLAN.md'ye göre sırayla)
- Sprint 0 başlatma (mockup'lar bittikten sonra)

---

## 🆘 Yeni Session'da Karşılaşabileceğin Tipik Senaryolar

### Senaryo A: Kullanıcı "şu açık noktayı düzelt" der
→ Bu doküman **§Adım 1**'deki listeye bak. İlgili dosyayı revize et. Yapıldıktan sonra DEVAM-REHBERI.md'de o satırı işaretle (✅ tamamlandı).

### Senaryo B: Kullanıcı "mockup yap" der
→ `UI-MOCKUP-PLAN.md` öncelik sırasına bak. Önce `assets/tokens-v2.css` masaüstünden kopyalanmış mı kontrol et. Pano-v3 referans alarak ilgili mockup'ı yaz.

### Senaryo C: Kullanıcı "Sprint 0 başlatalım" der
→ `SPRINT-PLAN.md §3 Sprint 0` adımlarını izle. **ÖN-KOŞUL:** Açık noktalar Adım 1'in tamamı düzeltilmiş + 4 mevcut mockup yenilenmiş olmalı.

### Senaryo D: Kullanıcı "yeni bir karar / değişiklik" der
→ Karar tüm dokümanlarda tutarlı uygulansın. Çelişki olan yerleri **kullanıcının yeni kararıyla değiştir** (eski tasarımı koruma çabası yapma — kullanıcı son söz).

### Senaryo E: Kullanıcı önceki kararı sorgular
→ Bu doküman **§Sonuçlandırılmış Kararlar** listesine bak. Eğer karar burada varsa **net cevap ver** + ilgili dokümana yönlendir. Yoksa kullanıcıyla yeniden tartış.

---

## ⚠ DİKKAT EDİLECEKLER (Önceki Session Hataları)

Önceki session'da yapılan hatalar (tekrarlanmasın):

1. **Yanlış klasör hatası:** Pet/ klasöründe çalışmak (eski legacy referans) yerine **PetStockPro/** kullan. `cd D:/Projeler/PetStockPro/` ile başla.

2. **Çelişki override hatası:** Önceki PetStockPro tasarımı (2026-05-12) ile yeni kararlar (2026-05-13/14) çelişirse **yeni karar geçerli**. "Mevcut tasarımı koru" felsefesi yapma — kullanıcı net dedi: "bu chat de olanlar son kararlar, sakın birşeyi arkaplana atma."

3. **"Faz 2 sonrası değerlendirilecek" yumuşatma:** Net karar varsa **net yaz**. Belirsizlik yaratma. PRO+ kaldırıldı = YOK, "değerlendirilecek" değil.

4. **Para akışı yanlış sözcük:** Vitrin tarafında "sipariş" / "satış" / "checkout" geçmesin. Sadece "ilgi", "tıklama", "ulaşım" kullan. Para akışı çizgisi kritik (PAYMENT-INTEGRATION §1).

5. **Süperadmin operasyonel müdür yanlışı:** Süperadmin sistem fix + kişisel izleme amaçlı. Manuel onay queue scale etmez (1000+ pet shop). Otomatik onay + manuel istisna doğru mimari.

---

## 📞 İletişim Şablonu

Kullanıcı (Oğuzhan) tek geliştirici. Kararları net verir, "rafa kaldır" gibi belirsiz dil sevmez. Hızlı iterasyon ister, "her şey iyi" cevabı yerine **eleştirel bakış + somut öneri** ister.

Önceki session'da çok değer verdiği şeyler:
- Dürüst hata kabul (ben Pet/ klasörü hatası yaptım, kabul ettim, düzelttim)
- Kapsamlı kontrol listesi (13 mantık noktası gibi)
- Net seçenek sunma (a/b/c önerim ile)
- Dokümante etme (her karar dokümana işlensin)

Önceki session'da rahatsız olduğu şeyler:
- "Çelişki çözüldü, mevcut korunur" gibi keyfi yorumlama
- Kararı yumuşatmak ("Faz 2 sonrası değerlendirilecek" — net yaz)
- Yanlış klasörde çalışmak (kontrol etmeden varsayım)

---

*Son güncelleme: 2026-05-14. Bu doküman yeni session başlangıç noktasıdır. CLAUDE.md → DEVAM-REHBERI.md → diğer dokümanlar sırasıyla okunmalı.*
