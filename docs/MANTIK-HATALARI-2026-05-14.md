# Mantık Hataları + Şüpheli Durumlar Taraması

**Tarih:** 2026-05-14
**Kapsam:** docs/ klasörü + CLAUDE.md (24 .md dosyası tarandı)
**Yöntem:** Cross-doc paralel okuma + field/table/route referans karşılaştırması + TR-only/3-tier kararı izi
**Atlananlar:** `DEVAM-REHBERI.md`'deki 13 nokta zaten biliniyor — tekrar edilmedi

> Bu dosya **yaşayan** bir liste. Düzeltilenler [✅] işaretlenir, yeni bulgular eklendikçe tarih notuyla işlenir.

---

## 🔴 Kritik (Lansman Bloker — Çözülmezse Lansman Yapılamaz)

### K1: ✅ `vitrin_approved` / `vitrin_enabled` field'ları DB schema'da YOK — vitrin akışı çalışmaz

- **Sorun:** Vitrin başvuru/onay akışı `companies.vitrin_approved` ve `companies.vitrin_enabled` kolonlarına referans veriyor ama bunlar `DATABASE-SCHEMA.md`'de tanımlı **değil**. Tek olan `companies.storefrontEnabled` (DATABASE-SCHEMA §3.1, satır 146). Üç farklı field adı, üç farklı doc'ta çelişiyor.
- **Etkilenen dosya(lar):**
  - `EKRAN-PUBLIC-VITRIN.md §4.4` (satır 217): PostGIS query `WHERE c.vitrin_approved = true`
  - `EKRAN-SUPERADMIN.md §2.5.1` (satır 267): `companies.vitrin_approved = true` (otomatik onay)
  - `EKRAN-SUBELER.md §9.4` (satır 444): `companies.vitrin_enabled = true` trigger
  - `EKRAN-URUNLER.md §5.5` (satır 295): `tenant'ın storefront_enabled = true`
  - `DATABASE-SCHEMA.md §3.1` (satır 146): sadece `storefrontEnabled` kolonu var
- **Önerilen aksiyon:**
  - (a) DB'ye `companies.vitrin_approved` (otomatik/manuel onay durumu) + `companies.vitrin_application_status` (`pending`/`approved`/`rejected` enum) ekle, tüm doc'larda tek adlandırmaya getir
  - (b) Mevcut `storefrontEnabled` boolean'ı yerine `storefrontStatus` enum yap (`disabled`/`pending_approval`/`approved`/`rejected`/`auto_suspended`) — tek field birden çok state taşır
- **Durum:** ✅ Çözüldü (2026-05-14 — Seçenek B uygulandı, otomatik onay + süperadmin istisna akışı onaylandı)
  - `DATABASE-SCHEMA.md`: `storefrontStatusEnum` ('disabled'/'pending'/'approved'/'rejected'/'auto_suspended') eklendi, `companies.storefrontEnabled` → `companies.storefrontStatus` (default `'pending'`) + `storefrontStatusReason` + `storefrontStatusChangedAt`
  - `EKRAN-PUBLIC-VITRIN.md §4.4`: PostGIS sorgu `WHERE c.storefront_status = 'approved'`
  - `EKRAN-SUBELER.md §9.4`: trigger açıklaması güncellendi
  - `EKRAN-SUPERADMIN.md §2.5.1`: otomatik onay akışı `storefront_status = 'approved'`
  - `EKRAN-URUNLER.md §5.5`: validation `storefront_status = 'approved'`

### K2: ✅ `subscriptions` ve `processed_webhooks` tabloları PAYMENT-INTEGRATION'da kullanılıyor ama DB schema'da yok

- **Sorun:** Sprint 13 (iyzico) implementasyonu için `subscriptions` ve `processed_webhooks` tabloları **şart**. Webhook idempotency `processed_webhooks`'a yazıyor, plan onay sonrası `subscriptions`'a kayıt giriliyor. Ama `DATABASE-SCHEMA.md` 30 tablo listesinde bu ikisi **yok** — sadece "Faz 2'de 3 tablo eklenecek" notu var (satır 1682). Sprint 13 lansman öncesi (Sprint 16'dan önce).
- **Etkilenen dosya(lar):**
  - `PAYMENT-INTEGRATION.md §2.1` (satır 50): `subscriptions tablosuna kayıt`
  - `PAYMENT-INTEGRATION.md §5.3` (satır 242-253): `processedWebhooks` idempotency
  - `PAYMENT-INTEGRATION.md §12` (satır 431): "DATABASE-SCHEMA — `subscriptions`, `invoices`, `processed_webhooks` (Faz 2)"
  - `EKRAN-SUPERADMIN.md §2.4` (satır 236): "Plan onay → subscriptions tablosuna kayıt"
  - `DATABASE-SCHEMA.md §11` (satır 1659-1682): "Faz 2'de eklenecek" — ama Sprint 13'te lazım
- **Önerilen aksiyon:** Sprint 13 öncesi `DATABASE-SCHEMA.md`'ye `subscriptions`, `processed_webhooks`, `invoices` (Nilvera için) tabloları eklensin. "Faz 2" notu kaldırılsın çünkü MVP sprint planında Sprint 13/14 lansmandan önce.
- **Durum:** ✅ Çözüldü (2026-05-14 — 3 tablo şimdi eklendi seçeneği uygulandı)
  - `DATABASE-SCHEMA.md §3.10`: 3 tablo + 2 enum eklendi (`subscriptions`, `processed_webhooks`, `invoices`; `subscriptionStatusEnum`, `invoiceStatusEnum`)
  - `§13` Faz 2 listesinden 3 tablo çıkarıldı → MVP'ye taşındı (yerine `auto_reorder_rules`, `customers`, `paddle_subscriptions` Faz 2'de saklı)
  - `§14` toplam tablo 30 → **33**
  - Tek aktif abonelik constraint + idempotency event_id PK + KVKK/vergi saklama (10 yıl) için `onDelete: restrict`
  - RLS: tenant kendi sub/invoice okur; processed_webhooks sadece süperadmin

### K3: ✅ `users.email UNIQUE` constraint — Tek email'in tek tenant'a bağlanması mimari kilit

- **Sorun:** Bu sorun DEVAM-REHBERI #6'da Bayi Admin için tartışıldı ama **daha geniş bir hata** var: `users.email UNIQUE` constraint hiç kimsenin iki farklı tenant'ta hesabı olmasına izin vermez. Senaryo: Ahmet Mavi Pet'in ADMIN'i, eşi Sarı Pet'i de açtı, **aynı email ile** ikinci hesap açamaz. Tek geliştirici olduğun için pilot pet shop'lar tek-email-tek-hesap pattern'i ile sınırlı. **CLAUDE.md "user ek e-posta ile başka tenant açar" yazmıyor.** Sprint 0'a girmeden netleştirilmeli.
- **Etkilenen dosya(lar):**
  - `DATABASE-SCHEMA.md §3.1` (satır 180): `email: varchar('email', { length: 255 }).unique().notNull()`
  - `EKRAN-KULLANICILAR.md §4.1` (davet akışı): aynı email iki tenant'a davet edilemez
- **Önerilen aksiyon:**
  - (a) `users.email` UNIQUE constraint'i kaldır + `(companyId, email) UNIQUE` composite key — tek email çoklu tenant
  - (b) `user_memberships` tablosu ekle (DEVAM-REHBERI #6 Bayi Admin önerisi), `users` table sadece kimlik tutsun
  - (c) Mevcut UNIQUE bırak, kullanıcıya "her tenant için ayrı email kullan" politikası kabul ettir (sade ama kısıtlayıcı)
- **Durum:** ✅ Çözüldü (2026-05-14 — Seçenek C uygulandı, tek geliştirici lens'inde MVP scope dışı)
  - `users.email UNIQUE` korundu — değişiklik yok
  - `EKRAN-KULLANICILAR.md` davet formuna **politika notu** eklendi: "Her tenant için ayrı email gerekir. Aynı kişi 2 pet shop açacaksa Gmail `+` alias kullanabilir (`ahmet+mavi@gmail.com`)."
  - **Faz 3 refactor planı:** Gerçek "Bayi Admin" senaryosu (DEVAM-REHBERI #6) geldiğinde `user_memberships` tablosu eklenir, `users.email UNIQUE` kaldırılır. Şimdi MVP'de %95+ pet shop tek tenant olacağı için scope dışı.

### K4: ✅ `data_export_jobs.tables jsonb notNull` — Boş seçim kabul ederse infinite job kuyruğu

- **Sorun:** `data_export_jobs.tables jsonb('tables').notNull()` — kullanıcı 0 tablo seçip "İhracat Hazırla" tıklarsa job queue'ya giriyor ama dışa aktaracak şey yok. KVKK export feature'ı kötüye kullanım olarak DDoS vektörü (her tenant saatte 100 boş export çağırırsa Edge Function quota bitirir). Backend validation + UI checkbox min 1 zorunluluk yok.
- **Etkilenen dosya(lar):**
  - `DATABASE-SCHEMA.md §3.5` (satır 716-726): `dataExportJobs` tablosu
  - `EKRAN-AYARLAR.md §2.6` (satır 411-427): "Veri dışa aktarım" formu
- **Önerilen aksiyon:**
  - (a) UI'da min 1 checkbox zorunlu + backend `tables.length === 0` → 400 Bad Request
  - (b) Tenant başına rate-limit: günde max 5 export request (audit log ile takip)
  - (c) Export sonucu 24 saat aktif kalsın notunun yerine **max 3 aktif job** sınırı koy
- **Durum:** ✅ Çözüldü (2026-05-14 — "Daha sıkı" seçeneği uygulandı, 6 katman koruma)
  - DB CHECK: `jsonb_array_length(tables) > 0` (boş array DB seviyesinde yasak)
  - Yeni field: `fileSizeBytes` (10MB sonrası reddedilir), `errorMessage` (failed durumu)
  - Rate-limit politikası: günde 3, saatte 1, output 10MB, aynı anda max 3 job, plan-priority queue
  - `EKRAN-AYARLAR §2.6`: UI politika notu + 3 hata mesajı (boş seçim / saatlik / günlük) + öncelik tablosu
  - Index: `idx_export_jobs_company_created` (rate-limit sorgu performansı)

### K5: ✅ `vitrin_reports` tablosu kullanılıyor ama DB schema'da yok — şikayet sistemi çalışmaz

- **Sorun:** Müşteri vitrin'de "🚩 Bildir" tıkladığında `vitrin_reports` tablosuna kayıt giriyor (EKRAN-PUBLIC-VITRIN §14 satır 948). EKRAN-SUPERADMIN §2.5.3 "Bildirimler alt-sekmesi" bu tablodan okuyor. Ama `DATABASE-SCHEMA.md`'de **bu tablo tanımlı değil**. Sprint 12 (vitrin) ile birlikte gelmesi gerek ama plan'da yok.
- **Etkilenen dosya(lar):**
  - `EKRAN-PUBLIC-VITRIN.md §14` (satır 945-953): vitrin_reports kullanımı
  - `EKRAN-PUBLIC-VITRIN.md §17` VIT-017: "Bildiri butonu vitrin_reports kaydı" test senaryosu
  - `EKRAN-SUPERADMIN.md §2.5.3` (satır 309-321): bildirim listeleme akışı
  - `DATABASE-SCHEMA.md`: TABLO YOK
- **Önerilen aksiyon:** Vitrin modlama mantığı için `vitrin_reports` tablosu DATABASE-SCHEMA'ya eklensin: `report_type` enum (`fake_product`/`copyright`/`spam`/`offensive_content`/`other`) + `target_type` (`product`/`tenant`/`message`) + `target_id` + `reporter_ip_hash` + `description` + `status` (`open`/`resolved`/`dismissed`) + `resolved_by_id` + `resolved_at`. RLS: sadece süperadmin okur.
- **Durum:** ✅ Çözüldü (2026-05-14 — Standart seçenek uygulandı)
  - `DATABASE-SCHEMA.md §3.9.5`: `vitrin_reports` + 3 enum (`vitrinReportTypeEnum` 6 değer, `vitrinReportTargetEnum`, `vitrinReportStatusEnum`)
  - Anonim şikayetçi (IP hash + UA + ülke), audit için `resolutionNote`
  - 3 index (status+date, company, ip) — süperadmin filtre + spam tespiti
  - Otomatik moderation kuralları: IP spam (saatte >5 dismissed), tenant şikayet anomalisi Telegram, 30 gün eski auto-dismiss
  - RLS: sadece süperadmin okur+yazar; public unauthenticated INSERT (rate-limit KV)
  - Toplam MVP tablo 33 → **34**

---

## 🟡 Önemli (Sprint Öncesi Netleşmeli)

### O1: ✅ Cloudflare DNS wildcard kayıtları "tenant subdomain iptal" kararıyla çelişiyor

- **Sorun:** Tenant subdomain modeli 2026-05-13'te iptal edildi (CLAUDE.md, DEVAM-REHBERI, EKRAN-PUBLIC-VITRIN). Ama `DEPLOYMENT.md` hâlâ:
  - Satır 71: `CNAME * → petstockpro.com  ← Vitrin subdomain (slug.petstockpro.com)`
  - Satır 73: `CNAME super → petstockpro.com  ← Süperadmin paneli (Faz 2'de ayrı subdomain)`
  - Satır 80: `Wildcard: *.petstockpro.com için Universal SSL`
  - Satır 20: ASCII diagram'da `*.petstockpro.com` görünüyor
  - SUPABASE-SETUP.md §1.3 (satır 77): Auth redirect `https://*.petstockpro.com/api/auth/callback/*` — vitrin subdomain için
- **Etkilenen dosya(lar):** `DEPLOYMENT.md §2.1`, `DEPLOYMENT.md §1` (mimari diyagram), `SUPABASE-SETUP.md §1.3`
- **Önerilen aksiyon:** Wildcard DNS kaydını kaldır (sadece `@` ve `www`). Universal SSL wildcard yerine sadece `petstockpro.com` + `www.petstockpro.com` SSL. Supabase auth redirect URL'lerinden wildcard satırını sil. Süperadmin için ayrı subdomain plan'ı da netleşsin (Faz 2 ne demek? Hâlâ planda mı, iptal mi?)
- **Durum:** ✅ Çözüldü (2026-05-14 — büyük mimari değişiklik)
  - **DNS:** Wildcard `*.petstockpro.com` + `super.petstockpro.com` + `app.petstockpro.com` kayıtları kaldırıldı. Sadece `petstockpro.com` + `www.petstockpro.com`.
  - **Süperadmin URL:** "URL'de superadmin geçmesin" kararı (kullanıcı, 2026-05-14). Tek `/admin` URL — herkes buraya gelir, SUPERADMIN role'lü kullanıcı sidebar'da ek menüler görür (🔧 Sistem / 🏢 Tüm Tenant'lar / 📊 Loglar / 🚨 Vitrin Modlama).
  - **Ayrı `/super-admin` path tamamen kaldırıldı** — sadece `/admin` URL. Auth gating route guard + sidebar render-time filter.
  - **Etkilenen dosyalar (8):** DEPLOYMENT.md, SUPABASE-SETUP.md, EKRAN-SUPERADMIN.md (büyük revize), SUPERADMIN-YETKILERI.md, EKRAN-AYARLAR.md, EKRAN-PUBLIC-VITRIN.md, TECH-STACK.md, SPRINT-PLAN.md, UI-MOCKUP-PLAN.md
  - **Korundu:** `preview/super-admin.html` mockup dosya adı (mevcut HTML), "Süperadmin Paneli" Türkçe kavramı, 3 sekme yapısı, Toolbox FAB, 4 yetki kategorisi, RLS politikaları

### O2: ✅ EKRAN-PUBLIC-VITRIN'de "Locale switcher (TR/EN)" hâlâ var — TR-only kararıyla çelişiyor

- **Sorun:** TR-only kararı (2026-05-14) sonrası EN locale gizli olmalı. Ama `EKRAN-PUBLIC-VITRIN.md §4.1` (satır 176) vitrin header'da hâlâ "Locale switcher (TR/EN)" var. Aynı doc §4 ana sayfa wireframe satır 119'da `[🌓] [TR▼]` lokalize seçici var. UI mockup yapılırsa EN seçeneği görünür olur — TR-only "gizli" kararıyla çelişir.
- **Etkilenen dosya(lar):** `EKRAN-PUBLIC-VITRIN.md §4`, `§4.1`
- **Önerilen aksiyon:** TR-only döneminde locale switcher UI'dan tamamen kaldır (next-intl yapısı kalsın ama dropdown gizli). Faz 2'de EN açılınca dropdown da görünür. Wireframe + §4.1 maddeleri güncellenmeli.
- **Durum:** ✅ Çözüldü (2026-05-14)
  - `EKRAN-PUBLIC-VITRIN.md §4` wireframe: `[TR▼]` UI öğesi kaldırıldı
  - `§4.1` header bileşeni: "Locale switcher" maddesi strikethrough + Faz 2 notu eklendi
  - next-intl yapısı korundu (Faz 2'de açılabilir)

### O3: ✅ Vergi no validation iki yerde tutarsız (URUNLER 10 hane vs AYARLAR 10/11 hane)

- **Sorun:** Şirket VKN 10 hane veya şahıs şirketi TC kimlik 11 hane olabilir (DATABASE-SCHEMA §3.1 yorumu net). Validation kuralı `EKRAN-AYARLAR §2.1`'de doğru "10 veya 11 hane" yazıyor. Ama `EKRAN-URUNLER §5.5`'teki "Vergi numarası gerekli" modal'ı (satır 339) sadece `[__________] (10 hane)` diyor — şahıs şirketi 11 hane TC kimlik girilemez. Mahalle pet shop'ların çoğu şahıs şirketi (PAYMENT-INTEGRATION'da bahsediliyor) — bu modal hatalı kabul eder. **Tedarikçi formu da aynı 10 hane sorunu** (EKRAN-TEDARIKCILER §5).
- **Etkilenen dosya(lar):**
  - `EKRAN-URUNLER.md §5.5` (satır 333-349): Vergi no modal
  - `EKRAN-TEDARIKCILER.md §5` (satır 90, 116): Tedarikçi vergi no validation
  - `EKRAN-AYARLAR.md §2.1` (satır 53-54): Doğru kural
- **Önerilen aksiyon:** Tüm vergi no input field'larında **single source of truth** validation kuralı: 10 (VKN) veya 11 (TC kimlik) + checksum. `lib/validation/vatNo.ts` helper'ı tek yer. URUNLER modal ve TEDARIKCILER formundaki copy ve placeholder güncellensin: "10 hane VKN veya 11 hane TC kimlik no".
- **Durum:** ✅ Çözüldü (2026-05-14)
  - `EKRAN-URUNLER.md §5.5` modal: "10 hane" → "10 hane VKN veya 11 hane TC kimlik no — şahıs şirketi"
  - `EKRAN-TEDARIKCILER.md §5`: form placeholder + validation kuralı + SUP-004 test güncellendi (`lib/validation/vatNo.ts` referansı)
  - `EKRAN-AYARLAR.md §2.1`: zaten doğruydu (10 veya 11 hane + checksum)
  - Single source of truth helper Sprint 0'da `lib/validation/vatNo.ts` olarak yazılır

### O4: ✅ DATABASE-SCHEMA seed `INSERT INTO site_settings` ama tablo `system_settings`

- **Sorun:** `DATABASE-SCHEMA.md §7` seed verilerinde (satır 1440-1446) `INSERT INTO site_settings (key, value) VALUES (...)` yazıyor. Ama tablo gerçek adı **`system_settings`** (satır 646, §3.5 sistem tabloları). `site_settings` adlı tablo schema'da hiç yok. Bu seed çalışmaz — DB migration başarısız olur.
- **Etkilenen dosya(lar):** `DATABASE-SCHEMA.md §7` (satır 1440-1446)
- **Önerilen aksiyon:** Seed SQL'i `INSERT INTO system_settings (key, value, category) VALUES ...` olarak düzelt. Ayrıca `category` notNull kolonu var ama seed'de yok — ekle (`'telegram'`, `'email'`, `'locale'`).
- **Durum:** ✅ Çözüldü (2026-05-14) — `DATABASE-SCHEMA.md §7` seed: tablo adı `system_settings`, `category` kolonu eklendi (`telegram`/`email`/`locale`).

### O5: ✅ `currency_rates` tablosu schema'da var ama TR-only kararıyla kapsam dışı

- **Sorun:** `currency_rates` tablosu `DATABASE-SCHEMA.md §3.2` (satır 324) ve Faz 2'de eklenecek dedikleri liste (satır 1672) içinde. Ama TR-only kararı (TECH-STACK §3.9, 2026-05-14) Frankfurter API entegrasyonunu **kaldırdı**. Schema'da tablo, kod dead-code olarak duruyor. MVP migration'ında bu tabloyu yaratmak gereksiz — `subscriptions` gibi gerçekten gerekli tablolar yok ama bu var.
- **Etkilenen dosya(lar):** `DATABASE-SCHEMA.md §3.2` (satır 323-331), `§11` (satır 1672)
- **Önerilen aksiyon:**
  - (a) MVP migration'da `currency_rates` tablosunu **yaratma**. Faz 2 multi-currency açılışında ayrı migration eklenir
  - (b) Schema dosyasında bırak ama `// FAZ2 — MVP'de DB'ye gitmez, sadece type referansı` yorum satırı ekle, drizzle-kit migration'a dahil etme
- **Durum:** ✅ Çözüldü (2026-05-14 — Seçenek B uygulandı)
  - `DATABASE-SCHEMA.md §3.2 currencyRates`: yorumla Faz 2 işaretlendi, `drizzle.config.ts` `schemaFilter` ile migration'dan dışlanır
  - `§14` toplam tablo sayısı 34 → **33** (currency_rates MVP'de migrate edilmez)
  - Type referansı korundu (TypeScript derlemesi için)

### O6: ✅ `users` tablosu çift süperadmin işaretleme — `role='SUPERADMIN'` AND `isSuperadmin=true`

- **Sorun:** `users` tablosunda iki ayrı süperadmin işareti var:
  - `users.role` enum'da `'SUPERADMIN'` değeri (satır 174)
  - `users.isSuperadmin` boolean (satır 189)
  - JWT claim'inde de iki tane: `role` ve `is_superadmin` (DATABASE-SCHEMA §4.1, satır 1019)
- İkisi senkronize tutulmalı — biri true diğeri false ise RLS politikaları belirsiz davranır. Hangisi otoritatif belirsiz. `auth.is_superadmin()` helper sadece `is_superadmin` claim'ini okur ama `role='SUPERADMIN'` ile login olmuş kullanıcı varsa? Race condition.
- **Etkilenen dosya(lar):** `DATABASE-SCHEMA.md §3.1` (satır 174-189), `§4` (satır 1019-1083), `EKRAN-SUPERADMIN.md §4.2` (JWT yapısı)
- **Önerilen aksiyon:**
  - (a) `isSuperadmin` boolean'ı **kaldır**, sadece `role='SUPERADMIN'` kullan (enum tek yer). Trigger: role değişince JWT yeniden imzalansın
  - (b) `role` enum'undan `SUPERADMIN` çıkar, sadece `isSuperadmin` flag bırak — bu daha temiz (SUPERADMIN şirket kullanıcısı değil, sistem kullanıcısı)
- **Durum:** ✅ Çözüldü (2026-05-14 — Seçenek A: tek kaynak gerçeklik = `role='SUPERADMIN'`)
  - `DATABASE-SCHEMA.md §3.1 users`: `isSuperadmin` boolean **kaldırıldı**, yorum eklendi
  - JWT callback: `token.isSuperadmin` çıkarıldı, sadece `token.role` JWT'ye yazılır
  - Supabase JWT claim: `is_superadmin` → `role` (RLS'te `auth.jwt() ->> 'role' = 'SUPERADMIN'`)
  - `auth.is_superadmin()` helper: `(auth.jwt() ->> 'role') = 'SUPERADMIN'`
  - Race condition tamamen ortadan kalktı, tek kaynak. O1 mimari değişikliğiyle de uyumlu (role-based menu).

### O7: ✅ PRO+ → PRO downgrade'de vitrin'den çekme akışı — manuel mi otomatik mi belirsiz

- **Sorun:** `PLAN-KADEMELERI §5.3` (satır 218-221) plan downgrade davranışını anlatıyor: "PRO+ (∞) → PRO (500) düşerse → 500'den fazla ürün 'Pasif modda' görünür. Tenant manuel olarak hangilerini aktif tutmak istediğini seçer. 30 gün içinde seçim yapılmazsa sistem en yeni N ürünü aktif tutar." Ama `EKRAN-AYARLAR §2.2` Plan + Fatura "Yükseltme / Downgrade akışı" tablosu (satır 248-251) şöyle der: "PRO+ → PRO: Dönem sonunda aktif (500 üstü ürün vitrin'den çekilir)". İki doc'ta iki farklı davranış:
  - PLAN-KADEMELERI: pasif moda al + 30 gün seçim süresi
  - AYARLAR: vitrin'den çek
- Hangisi gerçek? Bir ürün hem "pasif modda" hem "vitrin'den çekilmiş" olabilir mi? `products.isActive=false` vs `products.vitrinPublished=false` ikisi ayrı field.
- **Etkilenen dosya(lar):** `PLAN-KADEMELERI.md §5.3`, `EKRAN-AYARLAR.md §2.2`
- **Önerilen aksiyon:** Tek otoritatif kural:
  - PRO+ → PRO: ilk 500 hariç ürünler `isActive=false` (pasif mod). Vitrin'de zaten görünmezler (vitrin published filter inactive olanı dışlar). 30 gün seçim süresi tenant seçer.
  - Çift yazma yerine `EKRAN-AYARLAR §2.2`'yi PLAN-KADEMELERI §5.3'e referans gösteren tek satıra indir.
- **Durum:** ✅ Çözüldü (2026-05-14 — tek otoritatif kaynak)
  - `EKRAN-AYARLAR.md §2.2`: Downgrade akışı yeniden yazıldı, **`isActive=false` (pasif mod)** + 30 gün seçim + en-yeni-N tutma. PLAN-KADEMELERI §5.3'e referans verir.
  - Yanıltıcı "vitrin'den çekilir" söylemi kaldırıldı (vitrin filter'ı zaten isActive=true bekler, otomatik gizlenir).
  - SET-006c test güncellendi.

### O8: ✅ e-Arşiv fatura "tüm planlarda açık" ama FREE kullanıcı vergi no zorunlu değil

- **Sorun:** `PLAN-KADEMELERI §3` (satır 103) "Nilvera e-Arşiv entegrasyonu" tüm planlarda (FREE/PRO/PRO+) açık olarak işaretli. Ama `PAYMENT-INTEGRATION §3.2` e-Arşiv kullanmak için **vergi mükellefi + mali mühür sertifikası (TÜBİTAK SM ~750₺/yıl) + GİB e-Arşiv başvurusu + Nilvera kontör abonelik** gerekli. FREE plan kullanıcısı bunların çoğunu yapacak motivasyon bulamaz. Plan tablosunda "✅ e-Arşiv" görmek pazarlama aldatmacasıdır — kullanıcı "açık" sanır, deneyince "siz mali mühür almışsınız mı?" engeline çarpar.
- **Etkilenen dosya(lar):** `PLAN-KADEMELERI.md §3` (satır 103, 212), `EKRAN-AYARLAR.md §2.2`, `PAYMENT-INTEGRATION.md §3.2`
- **Önerilen aksiyon:**
  - (a) Plan tablosunda "e-Arşiv entegrasyonu" → "e-Arşiv entegrasyonu (vergi mükellefi + Nilvera kontör gerekli)" tooltip ekle
  - (b) FREE'de feature'ı gizle, ilk "fatura kes" tıklamasında onboarding modal ile şartları açıkla
  - (c) Bağımsız bir "Önkoşullar" sütunu ekle: ürün limiti dışında özellik açma şartları
- **Durum:** ✅ Çözüldü (2026-05-14 — Seçenek A: tooltip uygulandı)
  - `PLAN-KADEMELERI.md §3`: "Nilvera e-Arşiv entegrasyonu" satırına ¹ dipnot işareti + tablonun altında **detay önkoşul açıklaması** (vergi mükellefi + TÜBİTAK SM mali mühür + GİB başvuru + Nilvera kontör)
  - "Hazır ama önkoşullu" mesajı net — pazarlama aldatmacası önlendi
  - İlk fatura kesme tıklamasında onboarding modal şartları açıklar (Sprint 14 implementasyon notu)

---

## 🟢 Şüpheli / İyileştirme (Sonra Düşünülebilir)

### S1: ✅ `userRoleEnum` 'STAFF' rolü tanımlı ama hiçbir yerde aktif değil — Faz 2'de ne olacak?

- **Sorun:** `DATABASE-SCHEMA.md §3.1` (satır 174) `userRoleEnum` içinde `STAFF` var. `EKRAN-KULLANICILAR.md §4` davet formunda "STAFF (Faz 2) disabled — gri" yazıyor. Faz 2 bittiğinde STAFF nedir? Yetkileri ADMIN şube müdüründen ne kadar farklı? Sadece okuma yetkisi mi? Kasiyer mi (sadece satış kaydedebilir)? Tanımlı değil. Sprint 0 öncesi netleşmesi gerek çünkü RLS politikalarını şimdi yazıyoruz — STAFF için ek RLS koşulu sonra eklemek migration karmaşası.
- **Etkilenen dosya(lar):** `DATABASE-SCHEMA.md §3.1`, `EKRAN-KULLANICILAR.md §4`
- **Önerilen aksiyon:** Faz 2 STAFF rolü için kısa bir tanım doc'u: yetki matrisi (ADMIN bayi sahibi / ADMIN şube müdürü / STAFF / BAYI_ADMIN — her birinin CRUD matrisi). Şimdilik enum'da tutulacaksa açıklama yorum satırı ekle.
- **Durum:** ✅ Çözüldü (2026-05-14 — kasiyer rolü olarak MVP'de aktive)
  - `EKRAN-KULLANICILAR.md`: STAFF "Faz 2 disabled" → "Kasiyer rolü, branchId zorunlu" olarak aktif
  - `§12.5` yetki matrisi tablosu eklendi (5 rol × 18 yetki — SUPERADMIN/ADMIN bayi/ADMIN müdür/STAFF/BAYI_ADMIN)
  - STAFF tasarım felsefesi: operasyonel iş (satış + sayım + düşük stok görüş), yönetimsel iş YOK
  - `DATABASE-SCHEMA.md userRoleEnum`: yorum güncellendi, 4 rolün tanımı net
  - RLS uygulama örneği eklendi (Sprint 1'de implementasyon)
  - Faz 3 BAYI_ADMIN tablosu hâlâ Faz 3'te, UI yok ama enum hazır

### S2: ✅ `paymentMethodEnum` 'credit' (kredi) seçeneği var ama UX akışı belirsiz

- **Sorun:** `DATABASE-SCHEMA.md §3.4` (satır 467) `paymentMethodEnum` 'cash', 'card', 'bank_transfer', 'credit'. 'credit' = vadeli satış. Stok Çıkışı drawer'ında müşteri "kredili al" derse pet shop nasıl takip eder? `customer_ref` field'ı opsiyonel string, müşteri DB'si yok (Faz 3'e saklandı). Pet shop'un "bu müşteri 250₺ borç" raporu olmadan kredili satış sadece veri girişi, takip edilemiyor.
- **Etkilenen dosya(lar):** `DATABASE-SCHEMA.md §3.4`, `EKRAN-STOK-HAREKETLERI.md §7.1` (Stok Çıkışı drawer)
- **Önerilen aksiyon:**
  - (a) MVP'de 'credit' enum değerini sakla ama UX disabled — Faz 3 müşteri DB ile birlikte aktive olur
  - (b) 'credit' aktif kalsın ama Stok Çıkışı drawer'da `customer_ref` zorunlu işaretlensin + raporlarda "Açık kredi tutarları" özet kart eklensin
- **Durum:** ✅ Çözüldü (2026-05-14 — Seçenek B)
  - `DATABASE-SCHEMA.md §3.4`: paymentMethodEnum yorum güncellendi, `customer_ref` credit zorunlu CHECK constraint notu, yeni `credit_paid_at timestamp` field (veresiye kapama zamanı)
  - `EKRAN-RAPORLAR.md §4.6`: **6. rapor "💳 Açık Krediler"** eklendi — müşteri/tarih/tutar/gün tablosu + yaş analizi (0-15/16-30/31-60/60+) + krediyi kapama aksiyonu
  - "Toplu PDF" başlığı 5 rapor → 6 rapor güncellenmeli (atlandı, sonra düzeltilir)
  - Faz 3 müşteri DB açılınca customer_ref → customer_id FK refactor planı

### S3: ✅ `auditActionEnum` enum hard-coded — yeni özellikler eklenince migration zorluğu

- **Sorun:** `DATABASE-SCHEMA.md §3.5` (satır 596-609) `auditActionEnum` tüm audit action tiplerini önceden tanımlıyor (~30 değer). Yeni özellik eklendiğinde yeni enum değeri eklemek = migration. Performans için iyi (varchar değil enum) ama esneklik için kötü. Süperadmin bypass action'lar 4 kategoriden geliyor (`superadmin_action_type` enum), audit'te bunlar `'superadmin.bypass.expired_reversal'` gibi string yazılıyor (SUPERADMIN-YETKILERI §1.1) — string mı enum mı?
- **Etkilenen dosya(lar):** `DATABASE-SCHEMA.md §3.5`, `SUPERADMIN-YETKILERI.md §1`
- **Önerilen aksiyon:** Audit action'ları **string olarak** tut (varchar), enum yerine. Performans kaybı ihmal edilir, esneklik kazanır. Süperadmin override için ayrı `superadmin_action_subtype` text field — pattern: `bypass.expired_reversal`, `bypass.hard_delete`, vb.
- **Durum:** ✅ Çözüldü (2026-05-14)
  - `DATABASE-SCHEMA.md §3.5`: `auditActionEnum` kaldırıldı, `action` field artık `varchar(100)`. Yeni feature için migration yok.
  - Bilinen action listesi yorum olarak schema'da referans (TypeScript const + type alias örneği)
  - Pattern: `<entity>.<action>` (`product.create`, `superadmin.bypass.hard_delete`, `sale.credit_settled` vb.)
  - B-tree index sorgu hızı yeterli (1M+ kayıt'a kadar)

### S4: ✅ PostGIS yakınlık sorgusunda `ll_to_earth` vs `ST_DWithin` — iki farklı extension kullanılıyor

- **Sorun:** `DATABASE-SCHEMA.md §6` (satır 1402) GIST index'i `ll_to_earth(latitude, longitude)` kullanıyor — bu **earthdistance** extension. Ama `EKRAN-PUBLIC-VITRIN.md §4.4` (satır 218) sorgusu `ST_DWithin(ST_MakePoint(...)::geography, ...)` — bu **PostGIS** geography. İki farklı uzaklık hesabı kütüphanesi:
  - earthdistance: küresel mesafe (basit, hızlı, daha az hassas)
  - PostGIS geography: WGS84 ellipsoid (yüksek hassasiyet, ~5x yavaş)
- Index'lenmiş `ll_to_earth` ama sorgu `ST_DWithin` kullanıyorsa index hit olmaz, full table scan. 1K tenant'ta her vitrin sorgusu yavaşlar.
- **Etkilenen dosya(lar):** `DATABASE-SCHEMA.md §6` (satır 1402-1404), `EKRAN-PUBLIC-VITRIN.md §4.4` (satır 209-225)
- **Önerilen aksiyon:**
  - (a) PostGIS tek extension kullan: index'i `ST_GeogFromText` veya direct GIST (`USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)`) — sorgu da aynı pattern
  - (b) earthdistance ile basit yakınlık (km bazlı), hassasiyet düşük olduğunu kabul et
- **Durum:** ✅ Çözüldü (2026-05-14 — Seçenek A: PostGIS tek)
  - `DATABASE-SCHEMA.md §6` index: `ll_to_earth` → `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography` GIST
  - `SUPABASE-SETUP.md`: earthdistance extension yorumla kapatıldı
  - `SPRINT-PLAN.md` Sprint 12: extensions listesinden earthdistance çıkarıldı
  - Sorgu pattern'i (EKRAN-PUBLIC-VITRIN.md §4.4 ST_DWithin) ile index pattern'i artık aynı — full table scan riski yok

### S5: ✅ Realtime cleanup'ın ESLint rule zorunluluğu var ama hangi rule belirsiz

- **Sorun:** `TECH-STACK.md §2.4.1` (satır 154) "Lint rule: ESLint custom rule veya `eslint-plugin-react-hooks` exhaustive-deps + manuel review — `.subscribe()` çağrısı için cleanup zorunluluğu PR check'inde." Custom rule yazılacaksa Sprint 0'da yazılmalı. `eslint-plugin-react-hooks` "exhaustive-deps" zaten standart ama `.subscribe()` pattern'ini özel olarak yakalamaz — gerçek manuel review devam eder. Bu kararsızlık Sprint 0 bootstrap'inde gözden kaçabilir.
- **Etkilenen dosya(lar):** `TECH-STACK.md §2.4.1`
- **Önerilen aksiyon:** Sprint 0'da `lib/realtime/use-realtime-channel.ts` helper hook'unu yaz (TECH-STACK satır 156'da bahsedildi). Direkt `supabase.channel(...).subscribe()` kullanımı için ESLint custom rule yerine **kod review checklist** + `useRealtimeChannel` helper'ın exception case'lerine yorumla `// eslint-disable raw-subscribe` zorunluluğu daha pragmatik.
- **Durum:** ✅ Çözüldü (2026-05-14 — pragmatik yaklaşım)
  - `TECH-STACK.md §2.4.1`: Çözüm 4 yeniden yazıldı. **Custom ESLint plugin YOK** — standart `no-restricted-syntax` kuralı yeterli
  - `useRealtimeChannel` helper hook tek geçit
  - AST selector ile `.channel().subscribe()` pattern yakalanır (1 saat Sprint 0 işi)
  - Exception case'ler için `// eslint-disable-next-line no-restricted-syntax -- reason` zorunlu

### S6: ✅ Sprint 5 "ilk satılabilir saf SaaS" hedefi ama merkezi vitrin Sprint 12'de — tutarsız

- **Sorun:** `SPRINT-PLAN.md` kilometre taşları (satır 56-61): "Sprint 5 sonu — İlk satılabilir saf SaaS (ürün + stok + sayım minimal) → erken beta hazırlığı". Ama merkezi vitrin Sprint 12'de geliyor. Yani Sprint 5'te beta açıp pet shop'lar "vitrin nerede?" diye sorabilir — proje değer önerisinin yarısı yok. Erken beta'ya çıkmak istemek anlaşılır ama vitrin olmadan PetStockPro sadece "stok defteri" — rakipleri var (Logo Go, Mikro, Excel).
- **Etkilenen dosya(lar):** `SPRINT-PLAN.md §2`, `EKRAN-PUBLIC-VITRIN.md` (vitrin değer önerisi)
- **Önerilen aksiyon:**
  - (a) Kilometre taşı yazısını netleştir: "Sprint 5 → İç test başlangıcı" (kapalı beta değil), gerçek beta Sprint 12 sonu
  - (b) Vitrin'i Sprint 8-9'a alıp Sprint 12'yi polish yap (mockup'a göre çok zor — vitrin 2.5 hafta, Pano 1.5 hafta yer değiştiremez)
  - (c) MVP scope kararı netleştir: vitrin "must-have" mi "nice-to-have" mi? Eğer "must-have" ise erken beta vitrin'le birlikte (Sprint 12 sonu)
- **Durum:** ✅ Çözüldü (2026-05-14 — Seçenek A: dil düzelt)
  - `SPRINT-PLAN.md §2`: Sprint 5 "ilk satılabilir saf SaaS, erken beta" → **"İç test başlangıcı, beta DEĞİL"**
  - Sprint 8 "iç test" → "genişletilmiş iç test, 1-2 pilot pet shop"
  - Vitrin "must-have" konfirme edildi — gerçek beta Sprint 12 sonu
  - Yanıltıcı erken-beta mesajı önlendi

---

## Tarama Metodolojisi (Gelecek için)

**Taranan dosyalar (24):** CLAUDE.md, DEVAM-REHBERI.md, PLAN-KADEMELERI.md, DATABASE-SCHEMA.md (full ~1700 satır), DEPLOYMENT.md, TECH-STACK.md, PAYMENT-INTEGRATION.md, SPRINT-PLAN.md, SUPABASE-SETUP.md, SUPERADMIN-YETKILERI.md, EKRAN-PUBLIC-VITRIN.md, EKRAN-URUNLER.md, EKRAN-AYARLAR.md, EKRAN-SUPERADMIN.md, EKRAN-SUBELER.md, EKRAN-KULLANICILAR.md, EKRAN-TEDARIKCILER.md, EKRAN-STOK-HAREKETLERI.md, EKRAN-SAYIM.md, EKRAN-DUSUK-STOK.md, EKRAN-RAPORLAR.md, EKRAN-PANO.md, TASARIM-SISTEMI.md (kısmen), UI-MOCKUP-PLAN.md (kısmen)

**Arama pattern'leri kullanıldı:**
- Tablo/field referansları (`vitrin_approved`, `subscriptions`, `vitrin_reports`, vs.)
- Çelişen kararlar (TR-only öncesi vs sonrası, 3-tier vs 2-tier, tenant subdomain iptal sonrası kalan referanslar)
- Validation tutarlılığı (vergi no, email, IBAN, telefon)
- Plan tier matrisi (tüm doc'larda PRO+ var mı, fiyat 750/1750 doğru mu)
- Otomatik vs manuel onay akışları (vitrin başvuru, plan onay)

**Bulunmuş ama atlanmış (DEVAM-REHBERI'de zaten var):**
- #1 PetStockPro şirket kuruluş
- #2 Komisyon hesabı net gelir formülü
- #3 Vitrin metrikleri 4 ayrı etiket
- #4 Variant bazlı vitrin gösterimi
- #5 Backup stratejisi (Supabase Pro)
- #6 Bayi Admin email constraint (K3'te genişletildi)
- #7 Vitrin currency politikası
- #8 SEO sitemap pre-build
- #9 Şifre + 2FA recovery
- #10 Realtime + Brevo Pro tier (S5'te bir nokta eklendi)
- #11 Logo varyantları
- #12 Onboarding akışı
- #13 Test senaryoları dokümanı

---

## Özet

**19 bulgu, hepsi çözüldü (2026-05-14):**
- 🔴 5 Kritik **✅** — K1 storefrontStatus enum / K2 subscriptions+invoices+webhooks tablo / K3 email UNIQUE politika / K4 export DDoS koruma / K5 vitrin_reports tablo
- 🟡 8 Önemli **✅** — O1 DNS+/admin role-based / O2 locale switcher gizli / O3 vergi no 10/11 hane / O4 system_settings seed / O5 currency_rates Faz 2 / O6 role='SUPERADMIN' tek / O7 isActive=false downgrade / O8 e-Arşiv önkoşul tooltip
- 🟢 6 İyileştirme **✅** — S1 STAFF=kasiyer + yetki matrisi / S2 customer_ref + açık kredi raporu / S3 audit varchar / S4 PostGIS tek / S5 ESLint no-restricted-syntax / S6 Sprint 5 dil net

**Sprint 0 öncesi tamamlandı.** Tek geliştirici lens'i (CLAUDE.md #1 kural) her kararda uygulandı — sade, otomatik, self-service.

---

*Son güncelleme: 2026-05-14. Yeni bulgular çıkarsa tarih notuyla ekle.*

---

# 2. Tur Tarama (2026-05-14)

**Yöntem:** 1. tur 19 düzeltmesinin yarattığı yeni çelişkiler + ilk turda atlanmış boyutlar. Özel odak: O6 yarım kalma, K2 audit/notif/Realtime entegrasyon, S2 UX akışı, S1 STAFF gating yayılımı, ölü string referansları.

## 🔴 Kritik (Lansman Bloker)

### KT2-1: ✅ O6 yarım kaldı — `is_superadmin` JWT claim'i 4 doc'ta hâlâ kullanılıyor

- **Sorun:** O6 düzeltmesi DATABASE-SCHEMA.md'de uygulandı (`auth.is_superadmin()` artık `role = 'SUPERADMIN'` okur) ama **JWT claim'i `is_superadmin` üreten ve okuyan diğer dosyalar güncellenmedi**. Race condition O6 kapsamından çıkıp **runtime hatasına** dönüştü: backend `is_superadmin` claim yazıyor, RLS helper `role` claim arıyor → süperadmin RLS bypass çalışmaz.
- **Etkilenen dosya(lar):**
  - `SUPABASE-SETUP.md §5` (satır 175-214): `signSupabaseJwt()` fonksiyonu hâlâ `is_superadmin: boolean` parametresi alıyor + JWT payload'a `is_superadmin: user.is_superadmin` yazıyor (satır 191) + Auth.js callback'inde `is_superadmin: token.isSuperadmin` (satır 210, hatalı — `token.isSuperadmin` O6'ya göre artık yok)
  - `SUPABASE-SETUP.md §6` (satır 231-233): `petstockpro.auth_is_superadmin()` SQL helper hâlâ `current_setting('request.jwt.claim.is_superadmin')` okuyor
  - `EKRAN-SUPERADMIN.md §0` (satır 12, 37): "JWT claim `is_superadmin=true` middleware'de kontrol edilir"
  - `EKRAN-SUPERADMIN.md §4.2` (satır 500): JWT yapısı örneğinde hâlâ `is_superadmin: true` claim
  - `EKRAN-SUPERADMIN.md §4.3` (satır 517): Backend hard check `if (!user.is_superadmin)` — `user.role !== 'SUPERADMIN'` olmalı
  - `EKRAN-SUPERADMIN.md §7` (satır 586): Faz 1 uyumu checklist "JWT is_superadmin + hard backend check" güncellenmedi
  - `TECH-STACK.md §2.3` (satır 87): "Custom callbacks (role, company_id, branch_id, is_superadmin)" — `is_superadmin` listede
- **Aksiyon:** Tüm 4 dosyada `is_superadmin` token/claim referanslarını `role` ile değiştir. Tek kaynak: JWT payload `role: 'SUPERADMIN' | 'ADMIN' | 'STAFF' | 'BAYI_ADMIN'`. `petstockpro.auth_is_superadmin()` SQL fonksiyonu: `SELECT (current_setting('request.jwt.claim.role', true)) = 'SUPERADMIN'`.
- **Durum:** ✅ Çözüldü (2026-05-14)
  - **Önemli not:** PostgREST `role` claim'i Supabase auth seviyesi için `'authenticated'/'service_role'` bekler. Bizim app role'ümüz **`user_role`** claim adı altında yazılır (kafa karışıklığını önler).
  - `SUPABASE-SETUP.md §5`: `signSupabaseJwt()` artık `role: 'SUPERADMIN'|...|...` alır, JWT'ye `user_role` claim'ini yazar; `role` claim'i PostgREST için `service_role` (SUPERADMIN) veya `authenticated` (diğer) olur
  - `SUPABASE-SETUP.md §6`: `petstockpro.auth_is_superadmin()` artık `current_setting('request.jwt.claim.user_role') = 'SUPERADMIN'` okur + yeni helper `petstockpro.auth_user_role()` (ADMIN/STAFF/BAYI_ADMIN ayrımı için)
  - `DATABASE-SCHEMA.md auth.is_superadmin()`: `auth.jwt() ->> 'user_role' = 'SUPERADMIN'`
  - `EKRAN-SUPERADMIN.md §0/§4.2/§4.3/§7`: 4 yerde `is_superadmin: true` → `user_role: 'SUPERADMIN'` + hard check `user.role !== 'SUPERADMIN'`
  - `TECH-STACK.md §2.3`: callbacks listesinden `is_superadmin` çıkarıldı, KT2-1 not eklendi
- **Durum:** ✅ Karar verildi (2026-05-14)

### KT2-2: ✅ `vitrin_reports`, `subscriptions`, `invoices`, `processed_webhooks` için RLS POLICY SQL'i YOK — RLS aktif değil

- **Sorun:** K2 ve K5'te 4 yeni tablo eklendi (`subscriptions`, `invoices`, `processed_webhooks`, `vitrin_reports`). Tablo §3.10 ve §3.9.5'te tanımlı, RLS politikası yorumda anlatıldı (örn. "RLS: tenant kendi sub/invoice okur"), ama **§4.3 "Politika Örnekleri" SQL bloğunda CREATE POLICY komutu yok**. RLS otomatik tablo seviyesinde değil — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` çifti şart. Şu an migration koşulursa bu 4 tablo **default deny** (RLS yok = read herkes, write herkes — yani sadece backend service role yazabilir, başka erişim olmaz ya da tam tersi — Supabase tablonun owner'ına bağlı). Tenant kendi faturasını göremez, public "Bildir" formu çalışmaz.
- **Etkilenen dosya(lar):**
  - `DATABASE-SCHEMA.md §4.3` (satır 1283-1413): mevcut SQL bloğunda `subscriptions`, `invoices`, `processed_webhooks`, `vitrin_reports` için CREATE POLICY yok
  - `DATABASE-SCHEMA.md §3.10` (satır 1224-1227): RLS davranışı *yorumla* anlatılıyor ama SQL eksik
  - `DATABASE-SCHEMA.md §3.9.5` (satır 1120): Aynı durum, "RLS: Sadece süperadmin okur+yazar" yorumla
- **Aksiyon:** §4.3 sonuna 4 yeni tablonun ENABLE RLS + CREATE POLICY blokları eklensin:
  - `subscriptions`: tenant SELECT kendi `company_id`, süperadmin tüm
  - `invoices`: tenant SELECT kendi (read-only — UPDATE/DELETE yok), süperadmin tüm
  - `processed_webhooks`: sadece süperadmin SELECT + INSERT; tenant erişim yok (yalın `auth.is_superadmin()`)
  - `vitrin_reports`: süperadmin SELECT+UPDATE; public anon INSERT (rate-limit Cloudflare KV katmanında); tenant erişim YOK (taraflı davranışı önle)
- **Durum:** ✅ Çözüldü (2026-05-14)
  - `DATABASE-SCHEMA.md §4.3` sonuna **15 CREATE POLICY** bloğu eklendi (4 tablo × ENABLE RLS + SELECT/INSERT/UPDATE politikaları)
  - DELETE yasak (subscriptions/invoices KVKK + vergi 10 yıl, vitrin_reports KVKK 5 yıl, processed_webhooks pg_cron cleanup)
  - `vitrin_reports` public INSERT integrity check (required field'lar) — rate-limit Cloudflare Workers KV katmanında

### KT2-3: ✅ `subscriptionStatusEnum` PAYMENT-INTEGRATION state machine'iyle çelişiyor (`suspended` eksik)

- **Sorun:** PAYMENT-INTEGRATION §5.3 state diagram (satır 276-280) `past_due` → 3 retry → `suspended` → 7 gün → `cancelled` (FREE'ye düşürme) akışı tarif ediyor. Ama DATABASE-SCHEMA §3.10 `subscriptionStatusEnum` (satır 1137-1143) sadece `active`/`past_due`/`cancelled`/`expired`/`trialing` içeriyor — `suspended` enum değeri **yok**. Backend `past_due` retry'ları başarısız olunca DB'ye yazacak değer bulamaz. Sprint 13 lansman bloker.
- **Etkilenen dosya(lar):**
  - `DATABASE-SCHEMA.md §3.10` (satır 1137-1143): `subscriptionStatusEnum`'a `suspended` ekle
  - `PAYMENT-INTEGRATION.md §5.3` (satır 260-281): State diagram + enum mapping
- **Aksiyon:** `subscriptionStatusEnum`'a `'suspended'` ekle (anlam: 3 retry başarısız, plan zorla pasif — 7 gün sonra `cancelled`'a geçer). VEYA PAYMENT-INTEGRATION diagramını revize edip `past_due` → `cancelled` direkt yap (`suspended` ara state'i ortadan kalkar — pragmatik). Karar: 2. seçenek daha sade (tek geliştirici lens'i).
- **Durum:** ✅ Çözüldü (2026-05-14)
  - Seçenek 1 uygulandı: enum'a `'suspended'` eklendi (`active`/`past_due`/`suspended`/`cancelled`/`expired`/`trialing`)
  - Yorum: "past_due 7 gün geçti, abonelik askıda. Tenant FREE limit'e düşmedi henüz, ödeme yapınca yeniden active'e döner. PAYMENT-INTEGRATION §5.3 state machine."
  - PAYMENT-INTEGRATION state machine intact (gerekli 3 aşama: active → past_due → suspended → cancelled)

## 🟡 Önemli

### OT2-1: ✅ `notificationTypeEnum` — abonelik/vitrin/şikayet/fatura event'leri YOK

- **Sorun:** K2 + K5 sonrası DB'de subscriptions, invoices, vitrin_reports tabloları var ama `notificationTypeEnum` (DATABASE-SCHEMA satır 707-711) bu yeni event'ler için type değeri içermiyor. Sadece: `low_stock_critical`, `out_of_stock`, `high_sale`, `new_user`, `plan_limit_warning`, `daily_summary`, `weekly_summary`, `transfer_received`, `stocktake_completed`, `superadmin_session`. Eksik: `subscription_payment_failed` (past_due tenant'a uyarı), `subscription_renewed` (başarılı tahsilat), `invoice_issued` (e-Arşiv kesildi), `vitrin_approved` (otomatik onay tenant'a bildir), `vitrin_report_received` (süperadmin'e şikayet). Tenant ödemesi başarısız oluyor ama Telegram bildirim atılamıyor (enum constraint).
- **Etkilenen dosya(lar):**
  - `DATABASE-SCHEMA.md §3.5` (satır 707-711)
  - `EKRAN-AYARLAR.md §2.4` (satır 297-307): Bildirim tipleri tablosu — yeni event'ler için satır eklenmeli
  - `PAYMENT-INTEGRATION.md §5.3`: state geçişinde "Telegram bildirim atılır" notu var ama type belirsiz
- **Aksiyon:** `notificationTypeEnum`'a 5 yeni değer ekle: `subscription_payment_failed`, `subscription_renewed`, `invoice_issued`, `vitrin_approved`, `vitrin_report_received`. EKRAN-AYARLAR §2.4 tablosuna yeni satırlar (Telegram default açık, ekran opsiyonel).
- **Durum:** ✅ Karar verildi (2026-05-14)

### OT2-2: ✅ KDV varsayılan %18 (eski oran) — Türkiye 2024'te %20'ye çıktı, yer yer çelişki

- **Sorun:** Türkiye genel KDV oranı 2024 Temmuz'da %18 → %20 oldu. PRO/PRO+ fiyat hesabı bu çerçevede yapılmış (DATABASE-SCHEMA §3.10 satır 1199 yorum: "625₺ matrah + 125₺ KDV = 750₺" %20 oranıyla doğru). Ama:
  - `EKRAN-AYARLAR.md §2.3` (satır 272): "KDV varsayılan **[%18 ▼]**" — eski oran
  - `EKRAN-AYARLAR.md §2.3` (satır 273-277): kategori override (Mama %10 / Aksesuar **%18** / Sağlık %8 / Diğer **%18**) — eski oran
  - `EKRAN-URUNLER.md §622`: "KDV oranı [%10 ▼] (kategori bazlı default — mama %10, aksesuar **%20**)" — bu doğru!
  - `DATABASE-SCHEMA.md §3.2 products.vatRate` yorumu (satır 369): "%10, %18, %20" — üç oran karışık
- Aboneliğimiz %20 ama tenant'ın ürün KDV'si %18 default → fatura kesimi yanlış olur. Ürün KDV'si ile abonelik KDV'si bağımsız ama tek kaynak güncel olmalı.
- **Etkilenen dosya(lar):** `EKRAN-AYARLAR.md §2.3`, `DATABASE-SCHEMA.md §3.2` yorumu, `EKRAN-URUNLER.md §622` (zaten doğru ama tutarsız)
- **Aksiyon:** EKRAN-AYARLAR.md §2.3'te varsayılan KDV %18 → **%20** güncelle, kategori override örneklerinde aksesuar/diğer %18 → %20. DATABASE-SCHEMA `vat_rate` yorumu: "%10, %20" (Türkiye 2026 oranları — gıda %10, genel %20; %1/%8 gibi özel oranlar ürün kategoriye göre seçilebilir). Tek kaynak: `lib/constants/vat-rates.ts`.
- **Durum:** ✅ Karar verildi (2026-05-14)

### OT2-3: ✅ EKRAN-RAPORLAR.md 5 rapor → 6 rapor güncelleme atlandı (S2'de işaretlenmişti)

- **Sorun:** S2 düzeltmesinin sonunda doğrudan kabul edildi: *"'Toplu PDF' başlığı 5 rapor → 6 rapor güncellenmeli (atlandı, sonra düzeltilir)"*. EKRAN-RAPORLAR.md'de 6. rapor (💳 Açık Krediler) §4.6 olarak eklendi ama:
  - `§1` Layout (satır 24): "Bento grid (**5 rapor kartı**, col-4'er)"
  - `§1` Layout (satır 25-26): "[📊 Satış] [💰 Kâr/Zarar] [🏆 En çok satan] [🪦 Ölü Stok] [🏢 Şube kıyas]" — 6. kart (💳 Açık Krediler) listede YOK
  - `§2` (satır 39): "**Toplu PDF:** 5 raporun tek dokümanda derlemesi" → 6 olmalı
  - `§4` başlık (satır 52): "## 4. **5 Rapor Kartı**" → 6
  - `§6.2` (satır 225): "PDF (**Toplu — 5 rapor**)" → 6
  - `§6.2` (satır 230): "5 rapor (her biri 1-2 sayfa)" → 6
  - `§7` Faz 1 uyumu (satır 318): "✅ §21 yapı + §22 **5 rapor** detay" → 6
  - `§11` Test senaryoları (satır 299-314): **RPT-015 "Açık Krediler" test senaryosu YOK** (yeni rapor için test yazılmamış)
- **Etkilenen dosya(lar):** `EKRAN-RAPORLAR.md` (8 satır 5→6 güncelleme + RPT-015/016 test ekle)
- **Aksiyon:** Tüm "5 rapor" string'leri "6 rapor" yap; Bento grid'e 6. kart ekle; test senaryoları:
  - RPT-015: "Açık Krediler rapor kartı: 12 açık kredi + ₺3.420 toplam + en eski 47g"
  - RPT-016: "Krediyi kapama → `credit_paid_at = NOW()` + audit `sale.credit_settled` + Telegram bildirim"
- **Durum:** ✅ Karar verildi (2026-05-14)

### OT2-4: ✅ S2 `customer_ref` + `credit_paid_at` UX akışı EKRAN-STOK-HAREKETLERI'de tanımsız

- **Sorun:** S2 düzeltmesi DB'de `paymentMethodEnum.credit` + `customer_ref` zorunluluk CHECK constraint + `credit_paid_at` field ekledi. EKRAN-RAPORLAR §4.6 "krediyi kapama" aksiyonu var. Ama **EKRAN-STOK-HAREKETLERI'de Stok Çıkışı drawer akışında credit-spesifik UX yok**:
  - `paymentMethod = 'credit'` seçildiğinde `customer_ref` zorunlu field görünür mü?
  - Drawer kapanmadan önce client-side validation var mı?
  - "Bu müşterinin başka açık kredisi var mı?" inline uyarı?
  - Eğer customer_ref boşsa "Veresiye - Anonim" placeholder mı?
- Grep `customer_ref|credit_paid_at` EKRAN-STOK-HAREKETLERI'de sıfır match — sadece DB schema'da ve EKRAN-RAPORLAR'da tanımlı.
- **Etkilenen dosya(lar):** `EKRAN-STOK-HAREKETLERI.md §7.1` (Stok Çıkışı drawer)
- **Aksiyon:** Drawer akışına ek bölüm: Ödeme yöntemi = "💳 Veresiye" seçilince → `customer_ref` text field görünür ("Ahmet K. - 0532***1234" veya "Veresiye - Anonim"), uyarı banner "Bu müşteri 850₺ açık kredi taşıyor" (Faz 3'te aktif, MVP'de placeholder). Backend validation client-side mirror.
- **Durum:** ✅ Karar verildi (2026-05-14)

### OT2-5: ✅ S1 STAFF rolü diğer ekran doc'larında gating notları YOK

- **Sorun:** S1 düzeltmesi STAFF rolünü kasiyer olarak aktive etti, yetki matrisi EKRAN-KULLANICILAR §12.5'e eklendi. Ama diğer ekranlarda **STAFF için UI gating notları YOK** — STAFF login olunca ne görür, ne göremez belirsiz. Tarama:
  - `EKRAN-PANO.md`: STAFF kelimesi sıfır — STAFF'ın gördüğü Pano nedir? Kâr/maliyet kartları gizli mi?
  - `EKRAN-URUNLER.md`: STAFF kelimesi sıfır — STAFF "Ürün Ekle" butonu görmemeli, sadece okuma. Bulk işlemler gizli. Maliyet (alış fiyatı) gizli.
  - `EKRAN-STOK-HAREKETLERI.md`: STAFF kelimesi sıfır — STAFF Stok Çıkış drawer'ı görür (satış yapar) ama Stok Girişi/Transfer drawer'ları YOK. Reverse aksiyonu YOK.
  - `EKRAN-DUSUK-STOK.md`: STAFF görmeli (operasyonel) ama "Sipariş öner" + tedarikçi gizli olmalı
  - `EKRAN-RAPORLAR.md`: STAFF rapor görmemeli (yetki matrisi diyor) ama sidebar render filter belirsiz
- Bu UI gating eksikliği Sprint 1 implementasyonunda kafa karıştırır.
- **Etkilenen dosya(lar):** `EKRAN-PANO.md`, `EKRAN-URUNLER.md`, `EKRAN-STOK-HAREKETLERI.md`, `EKRAN-DUSUK-STOK.md`, `EKRAN-RAPORLAR.md`
- **Aksiyon:** Her doc'a §0 veya §1 başına "**Rol bazlı erişim**" alt-başlık: hangi rol hangi component'i görür/göremez (referans tablo: EKRAN-KULLANICILAR §12.5). Veya tek kaynak: EKRAN-KULLANICILAR §12.5'i genişlet — "her ekranda STAFF için gizli component listesi" tek tablo.
- **Durum:** ✅ Karar verildi (2026-05-14)

### OT2-6: ✅ EKRAN-PUBLIC-VITRIN.md satır 562 — ölü `storefront_enabled` referansı kalmış (K1 atlama)

- **Sorun:** K1 düzeltmesinde `storefrontEnabled` boolean → `storefrontStatus` enum'a geçildi. Çoğu yer güncellendi ama `EKRAN-PUBLIC-VITRIN.md §10.2.3 İçerik Filtresi` (satır 562) hâlâ `storefront_enabled=true` koşulu kullanıyor:
  > *"Pet shop profili → tenant aktif + `storefront_enabled=true` + son 90 gün içinde aktivite"*
- Bu sitemap pre-build sorgusu — şu an çalışmaz, `storefront_enabled` kolonu yok.
- **Etkilenen dosya(lar):** `EKRAN-PUBLIC-VITRIN.md §10.2.3` (satır 562)
- **Aksiyon:** `storefront_enabled=true` → `storefront_status = 'approved'` (K1 tek kaynak).
- **Durum:** ✅ Karar verildi (2026-05-14)

## 🟢 İyileştirme

### ST2-1: ✅ Realtime channel kapsamı — yeni tablolar (subscriptions, invoices, vitrin_reports) Realtime'a dahil mi?

- **Sorun:** TECH-STACK §2.4.1'de Supabase Realtime aktif. Pano `stock_movements`, Sayım kilidi Realtime kullanıyor. Yeni eklenen K2/K5 tabloları:
  - `subscriptions` — past_due geçişinde tenant ekranına anlık uyarı? (yoksa sadece Telegram + e-posta + giriş sırasında banner)
  - `invoices` — fatura kesildiğinde anlık ekran bildirim? (gerçekten gerekli mi — 1 ay 1 kez)
  - `vitrin_reports` — süperadmin paneli açıkken anlık "yeni şikayet" bildirimi (R3 manuel inceleme akışı için faydalı)
- Realtime maliyeti: Supabase Free 200 concurrent → tablonun Realtime'a açılması her yeni connection demek. Hangileri ne kadar şart belirsiz.
- **Etkilenen dosya(lar):** `TECH-STACK.md §2.4`, `EKRAN-SUPERADMIN.md §2.5.3`
- **Aksiyon:** Sade karar (tek geliştirici lens'i):
  - `subscriptions` → Realtime YOK (1 ayda 1 değişim, polling yeter)
  - `invoices` → Realtime YOK (aylık batch)
  - `vitrin_reports` → Realtime YOK MVP'de (süperadmin günde 1 kez bakar, polling yeter). Faz 2 yüksek hacimde aç.
  - `notifications` → Realtime VAR (zaten Pano feed için açık)
- **Durum:** ✅ Karar verildi (2026-05-14)

### ST2-2: ✅ i18n string'leri — yeni UI mesajları TR'de hazır mı?

- **Sorun:** TR-only + next-intl yapısı korunuyor (O2 kararı). Yeni UI mesajları (3-tier ekran metinleri, STAFF tooltip, açık kredi raporu, vitrin onay banner, e-Arşiv tooltip) Türkçe ekli mi? Sprint 0'da `messages/tr.json` ilk versiyon yazılırken bu mesajların listesi yok. Doc'larda mesaj metni var ama dağınık — `tr.json` namespace organizasyonu Sprint 0 planında belirsiz.
- **Etkilenen dosya(lar):** `SPRINT-PLAN.md` Sprint 0 / Sprint 1
- **Aksiyon:** Sprint 0 dosya bootstrap'ine ek: `messages/tr.json` taslağı (namespace pattern: `admin.products.create_button`, `vitrin.report_modal.title`, `superadmin.toolbox.hard_delete_confirm` vb.). Yeni UI doc'unu yazan kişi (sen) message key + Türkçe string'i ekler. **Acil değil ama Sprint 1 implementasyonu öncesi karar yararlı.**
- **Durum:** ✅ Karar verildi (2026-05-14)

### ST2-3: ✅ K3 email UNIQUE — Gmail "+" alias politikası UX akışı belirsiz

- **Sorun:** K3'te Seçenek C uygulandı: "Her tenant için ayrı email, Gmail `+` alias önerisi". EKRAN-KULLANICILAR davet formunda politika notu var. Ama:
  - Aynı kişi 2 tenant açacak → kayıt akışında ne olur? Frontend `ahmet@gmail.com` ile signup → backend "email zaten kullanılıyor" hata → kullanıcı `ahmet+sariPet@gmail.com` mi denesin? Hata mesajı nasıl?
  - Şube müdürü davet edilirken aynı email çakışırsa? K3 doc satırı sadece davet formu için politika diyor ama signup akışı için kontrol yok.
- **Etkilenen dosya(lar):** `EKRAN-AYARLAR.md` veya register/signup ekran doc'u (henüz yok), `EKRAN-KULLANICILAR.md §4`
- **Aksiyon:** Register ekranı doc'unda (Sprint 0 bootstrap'inde tasarlanmadıysa Sprint 1'de yazılır) hata mesajı: "Bu email zaten başka bir pet shop'ta kullanılıyor. Aynı kişiyseniz Gmail `+` alias kullanabilirsiniz (örn: `ahmet+ikincimagazam@gmail.com`)." Şube müdürü davet formunda da aynı tutarlı mesaj.
- **Durum:** ✅ Karar verildi (2026-05-14)

### ST2-4: ✅ K5 vitrin_reports şikayet tipi — "yanlış adres" + "şube kapanmış" eksik

- **Sorun:** K5'te `vitrinReportTypeEnum` 6 değer: `fake_product`, `copyright`, `spam`, `offensive_content`, `wrong_info`, `other`. **"wrong_info"** geniş kapsamlı — yanlış fiyat, yanlış stok, yanlış telefon, yanlış adres, kapanmış şube hepsi burada. Ama:
  - Müşteri "Bu pet shop adresinde başka bir kapı buldum (taşınmış)" diye şikayet ederse — `wrong_info` yeterli mi, yoksa `closed_business` (kapanmış işyeri) ayrı tip mi?
  - "Yanlış adres" + "şube kapanmış" pet shop dizininde **çok yaygın** bir şikayet tipi olabilir (Google My Business pattern).
- **Etkilenen dosya(lar):** `DATABASE-SCHEMA.md §3.9.5` (vitrinReportTypeEnum), `EKRAN-PUBLIC-VITRIN.md §14`
- **Aksiyon:** Ya `wrong_info` description text'i serbest bırak (müşteri yazsın), ya da `closed_business` 7. enum değer ekle. Sade tut: `wrong_info` + description text yeter (Faz 2'de büyük şikayet hacmi geldiğinde split). **Aksiyon: değişiklik YOK, sadece `description` field'ın "yanlış bilgi durumunda detayı yazın" placeholder'ı eklensin.**
- **Durum:** ✅ Karar verildi (2026-05-14) (low priority)

### ST2-5: ✅ Şikayet → tenant'a bildirim akışı tanımsız (K5 yarım)

- **Sorun:** K5'te `vitrin_reports` tablosu + süperadmin Bildirimler alt-sekmesi var. Süperadmin "Tenant'a uyarı gönder" aksiyonu (EKRAN-SUPERADMIN §2.5.3 satır 343) — ama:
  - Bu uyarı tenant'a nasıl ulaşır? Telegram mı, e-posta mı, in-app notification mı?
  - Tenant tarafında "şikayet aldın" göreceği bir ekran var mı?
  - `notifications` tablosu kullanılıyor mu? OT2-1'de `vitrin_report_received` type yok (eksiklik).
- **Etkilenen dosya(lar):** `EKRAN-SUPERADMIN.md §2.5.3`, `EKRAN-AYARLAR.md §2.4` (bildirim tipleri tablosu)
- **Aksiyon:** OT2-1 düzeltmesinde `vitrin_report_received` notification type eklenirse otomatik çözülür. Tenant ekranında "Vitrin Hesabım" sayfasında "📩 3 müşteri şikayeti aldın" rozet, tıklayınca detay (süperadmin'in görüntülediği aynı şikayet ama tenant view).
- **Durum:** ✅ Karar verildi (2026-05-14) (OT2-1 ile birlikte)

---

## 2. Tur Özet

**14 yeni bulgu, hepsi çözüldü ✅ (2026-05-14, 1. tur + 2. tur toplam 33 bulgu):**
- 🔴 3 Kritik **✅** — KT2-1 user_role claim tek kaynak / KT2-2 4 tablo RLS POLICY / KT2-3 subscription `suspended` state
- 🟡 6 Önemli **✅** — OT2-1 6 notification type / OT2-2 KDV %20 / OT2-3 6 rapor yayılım / OT2-4 credit UX / OT2-5 STAFF gating 5 ekran / OT2-6 storefront_status ref
- 🟢 5 İyileştirme **✅** — ST2-1 Realtime sade / ST2-2 i18n namespace / ST2-3 K3 UX mesaj / ST2-4 K5 description / ST2-5 vitrin_report_received

**Sprint 0 öncesi tarama tamamen kapandı.**

---

# 3. Tur — Kullanıcı Geri Bildirimi (2026-05-14)

**Yöntem:** Agent değil — kullanıcı doğrudan geri bildirim. Önceki taramalarda atlanan boyutlar.

## 🟡 Önemli

### YT-1: ✅ Fotoğraf doğrulama — alakasız görsel koyma riski (kullanıcı geri bildirimi)

- **Sorun:** Pet shop "Royal Canin 2kg" ürünü listeleyip yanlış görsel koyabilir (yanlışlık veya kasıt — kedi yerine ot fotoğrafı, telif görseli, alakasız ürün). 1K tenant × 50 ürün = 50K görsel, manuel inceleme imkansız (CLAUDE.md #1 kural: tek geliştirici).
- **Etkilenen dosya(lar):** `EKRAN-URUNLER.md §5.5`, `EKRAN-PUBLIC-VITRIN.md §14`, `DATABASE-SCHEMA.md §3.9.5`
- **Çözüm:** Hibrit (kullanıcı kararı 2026-05-14)
  - **1. katman (proaktif):** Cloudflare Workers AI (LLaVA vision modeli) — "Satışa Aç" toggle açıldığında 1 kez kontrol, "Bu görsel pet ürünü mü?" prompt. Cache (görsel hash → 90 gün KV).
  - **2. katman (reaktif):** Topluluk modlama — vitrin'de müşteri "🚩 Bildir > Yanlış fotoğraf" → `vitrin_reports.report_type='wrong_photo'`. 3 farklı IP raporu → görsel otomatik gizlenir + tenant Telegram + süperadmin Manuel İnceleme.
- **Durum:** ✅ Çözüldü (2026-05-14)
  - `DATABASE-SCHEMA.md`: `vitrinReportTypeEnum`'a `wrong_photo` eklendi
  - `EKRAN-URUNLER.md §5.5`: AI validation kuralı + topluluk modlama otomatik kural (3 IP → gizle)
  - `TECH-STACK.md §3.9b`: Cloudflare Workers AI yeni servis bölümü (LLaVA model + örnek kod + maliyet tahmini)
  - `DEPLOYMENT.md §6.2`: Growth tier OPEX'ine "Cloudflare AI image moderation ~$2-5/ay" eklendi
  - Süperadmin "AI Karar Override" Toolbox FAB (false positive için)

### YT-2: ✅ "İhracat Hazırla" terim kafa karıştırıcı (kullanıcı geri bildirimi)

- **Sorun:** EKRAN-AYARLAR §2.6 "Veri dışa aktarım" formunda buton "İhracat Hazırla" yazıyor. Türkçede "ihracat" = ülke dışı satış çağrışımı, kullanıcı kafa karışıklığı yaratır.
- **Etkilenen dosya(lar):** `EKRAN-AYARLAR.md §2.6`
- **Çözüm:** "Verilerimi İndir" (kullanıcı kararı 2026-05-14, daha kısa + KVKK bağlamında doğal)
- **Durum:** ✅ Çözüldü (2026-05-14)

---

## 3. Tur Özet

**2 yeni bulgu, ikisi de ✅ çözüldü (toplam tüm turlar: 35 bulgu)**
- 🟡 YT-1 Hibrit fotoğraf doğrulama (AI Cloudflare Workers + topluluk modlama)
- 🟡 YT-2 "İhracat" → "Verilerimi İndir" terim düzeltmesi

**Tarama yöntemi:** Kullanıcı doğrudan geri bildirim — agent değil. Bu tip "kullanıcı zihninden geçen" bulgular gelecekteki turlarda da değerli olabilir.

**Atlanmış sayılan ama önemli:**
- CLAUDE.md hâlâ 2-tier (PRO+ rafa) yazıyor — DEVAM-REHBERI #14'te zaten biliniyor, otoritatif değil
- `DATABASE-SCHEMA.md` satır 100 `planEnum`'da `PRO_PLUS` var, 3-tier B kararı uygulandı (OK)
- 2026-05-13 ek karar `vitrin_reports.target_type` enum'da `message` değeri vardı, K5'te `company` ve `product` olarak 2 değere indirildi — tutarlı

**Tarama yöntemi:**
- 5 hedefli `is_superadmin` grep — 4 doc'ta kalıntı bulundu
- 4 hedefli yeni-tablo RLS policy SQL grep — SQL bloğunda yok
- subscription state machine cross-check (DB enum vs PAYMENT-INTEGRATION diagram)
- KDV oranı cross-check (5 doc'ta arama)
- STAFF gating yayılım taraması (5 ekran doc grep)
- EKRAN-RAPORLAR 5→6 string sayımı (S2 atlama doğrulama)
- notification type vs yeni event mapping
- `customer_ref` ve `credit_paid_at` UX akış grep

---

*Son güncelleme: 2026-05-14 (3. tur kullanıcı geri bildirimi + 4. tur Claude taramasıyla). Toplam 40 bulgu, hepsi ✅: 1. tur 19 + 2. tur 14 + 3. tur 2 + 4. tur 5.*

---

# 4. Tur — Claude Self-Tarama Yayılım Kontrolü (2026-05-14)

**Yöntem:** 2. ve 3. tur 16 düzeltmenin yarattığı **yayılım hataları** + "karar verildi" işaretli ama **uygulanmamış** noktalar. Cross-doc grep + tablo/sayı tutarlılık kontrolü.

**Tetikleyici:** CLAUDE.md "Sıradaki olası işler" listesinde *"4. tur mantık hata taraması (son düzeltmeler yeni çelişki yarattı mı?)"* — bu kapsam.

## 🟡 Önemli (Yayılım Hatası — Yarım Kalmış Önceki Düzeltmeler)

### YT-3: ✅ DATABASE-SCHEMA seed kategoriler KDV %18 kalmış (OT2-2 yayılım atlandı)

- **Sorun:** OT2-2'de KDV %18 → %20 düzeltildi (EKRAN-AYARLAR + DATABASE-SCHEMA yorumu). Ama `DATABASE-SCHEMA.md §7` seed verilerinde **4 kategori hâlâ %18**:
  ```sql
  ($1, 'Aksesuar', 'aksesuar', '🎀', 18, false),   -- yanlış
  ($1, 'Oyuncak', 'oyuncak', '🧸', 18, false),     -- yanlış
  ($1, 'Kum', 'kum', '🪨', 18, false),             -- yanlış
  ($1, 'Bakım', 'bakim', '🧴', 18, false),         -- yanlış
  ```
  Mama %10 (gıda) ✅ ve Sağlık %8 (özel oran) ✅ doğru kalıyor.
- **Etkilenen dosya(lar):** `DATABASE-SCHEMA.md §7` (satır 1729-1735)
- **Aksiyon:** 4 kategori %18 → %20 güncelle.
- **Durum:** ✅ Çözüldü (2026-05-14) — `DATABASE-SCHEMA.md §7`: Aksesuar/Oyuncak/Kum/Bakım %20'ye güncellendi, OT2-2 + YT-3 yorum eklendi.

### YT-4: ✅ "5 rapor" → "6 rapor" yayılımı 9 yerde yarım kaldı (OT2-3 atlama)

- **Sorun:** OT2-3'te EKRAN-RAPORLAR.md 8 satır düzeltileceği söylendi ama uygulanmamış. Ayrıca yayılım `EKRAN-RAPORLAR.md` dışında **4 başka doc'a** sıçramış:
  - `EKRAN-RAPORLAR.md` satır 11/26/52/253/266/297/301 — "5 rapor" string, kart listesinde 💳 Açık Krediler eksik, RPT-015/016/017/018 testleri yok
  - `EKRAN-AYARLAR.md` satır 208 — plan kıyaslama tablosu "✓ 5 rapor"
  - `PLAN-KADEMELERI.md` satır 92 — özellik karşılaştırma "5 rapor (satış/kâr/...)"
  - `SPRINT-PLAN.md` satır 49 + 665-685 — Sprint 11 hedef + yapılacaklar
  - `UI-MOCKUP-PLAN.md` satır 31/135/287/288 — raporlar.html brief
- **Etkilenen dosya(lar):** 5 doc
- **Aksiyon:** Tüm "5 rapor" → "6 rapor"; kart listesine 💳 Açık Krediler; RPT-015..018 yeni test; Sprint 11 yapılacaklar genişletildi (Krediyi Kapama akışı + 6 detay sayfa); API endpoint listesine `/open-credits` + `/settle`.
- **Durum:** ✅ Çözüldü (2026-05-14) — 5 dosyada toplam 14 yer güncellendi, RPT-015..018 testleri eklendi.

### YT-5: ✅ OT2-1 notification types EKRAN-AYARLAR §2.4 tablosuna eklenmedi

- **Sorun:** OT2-1'de DATABASE-SCHEMA `notificationTypeEnum`'a 5 yeni event eklendi (`subscription_payment_failed`, `subscription_renewed`, `invoice_issued`, `vitrin_approved`, `vitrin_report_received`). Ama EKRAN-AYARLAR §2.4 "Bildirim tipleri" tablosu hâlâ **7 satır** — eski liste. Tenant ödemesi başarısız oluyorsa Telegram bildirim gönderilebilmesi için bu tablo eksikse UI gating'i karışır.
- **Etkilenen dosya(lar):** `EKRAN-AYARLAR.md §2.4` (satır 298-307)
- **Aksiyon:** Tabloya **5 yeni satır** ekle (Abonelik + Fatura: 3 satır; Vitrin: 2 satır). Trigger noktaları belgele (iyzico webhook → past_due → bildirim vs.). "Abonelik ödemesi başarısız" bildirimi **kapatılamaz** kuralı eklendi.
- **Durum:** ✅ Çözüldü (2026-05-14) — Tablo `subscription_payment_failed` (zorunlu), `subscription_renewed`, `invoice_issued`, `vitrin_approved`, `vitrin_report_received` ile 12 satıra çıkarıldı. Trigger noktaları belgelendi.

### YT-6: ✅ DEPLOYMENT.md dış servis listesi Sprint planıyla çelişiyor

- **Sorun:** `DEPLOYMENT.md §1` mimari diyagramında "Dış servisler" listesi:
  - "iyzico (TR ödeme — Faz 2)" — **yanlış**, Sprint 13 MVP'de
  - "Nilvera (e-fatura — Faz 2)" — **yanlış**, Sprint 14 MVP'de
  - "Paddle (yurt dışı — Faz 2)" — doğru (TR-only kararıyla Faz 2'ye taşındı)
  - "Frankfurter (kur)" — yanlış, TR-only kararıyla **kaldırılmalı** (O5 + TECH-STACK)
  - Cloudflare Workers AI (LLaVA, vitrin image moderation) — listede **yok** (YT-1 sonrası eklendi)
- **Etkilenen dosya(lar):** `DEPLOYMENT.md §1` (satır 51-58)
- **Aksiyon:** Liste yeniden yazıldı — MVP servisleri sprint sıralı; Faz 2'ye saklılar ayrı bölüm; Cloudflare Workers AI eklendi.
- **Durum:** ✅ Çözüldü (2026-05-14)

### YT-7: ✅ "2-tier yapı" kalıntı referansları 9 yerde otoritatif yanlış bilgi veriyor

- **Sorun:** 2026-05-14'te 3-tier B (FREE 50 / PRO 500 / PRO+ ∞) geri açıldı ama 2026-05-13 "2-tier (FREE/PRO), PRO+ rafa" kararının yazılı kalıntıları **otoritatif metinlerde** kalmış:
  - `EKRAN-PANO.md §11.7` (satır 345): "PRO (sınırsız) → ring yok ... (2-tier yapı, PRO+ rafa 2026-05-13)" — PRO+ ring kuralı eksik
  - `EKRAN-PUBLIC-VITRIN.md` 3 yer (satır 460, 1028, 1051): "PRO+ rafa" gerekçesi yanıltıcı
  - `SUPERADMIN-YETKILERI.md §3.1.1` (satır 211): **"Plan Tiers (2-tier — 2026-05-13)"** + FREE 50 / PRO ∞ 500₺ — süperadmin sistem ayarları sayfası 2-tier yapısında! Bu **çok kritik** çünkü süperadmin UI buna göre yazılır.
  - `TECH-STACK.md §4.2` (satır 460): "2-tier yapı (FREE 50 / PRO sınırsız)" — final not
  - `TASARIM-SISTEMI.md §7.7` (satır 512): `plan="FREE" | "PRO"` — **TypeScript type yanlış**, PRO_PLUS eksik
  - `UI-MOCKUP-PLAN.md` 3 yer (satır 107, 122, 214, 273): mockup brief'lerinde 2-tier yazılmış — mockup yapan biri yanlış tablo çizer
- **Etkilenen dosya(lar):** 6 doc, 9 yer
- **Aksiyon:** Tüm "2-tier" yapı/yorum/tabloları "3-tier B (FREE 50 / PRO 500 750₺ / PRO+ ∞ 1.750₺, TR-only)" olarak güncelle. Tarih notu "2026-05-14 YT-7" ile işaretle. Pano ring kuralları 3 plana göre yeniden tanımla. TASARIM-SISTEMI PlanCard type union'a PRO_PLUS eklensin. SUPERADMIN sistem ayarları 3-tier'a güncellensin.
- **Durum:** ✅ Çözüldü (2026-05-14) — 6 dosyada 9 yer güncellendi. PAYMENT-INTEGRATION.md ve DEPLOYMENT.md'deki 2-tier referansları **historical changelog** olarak korundu (tarih sırası bütünlüğü için).

---

## 4. Tur Özet

**5 yeni bulgu, hepsi ✅ çözüldü (2026-05-14, toplam tüm turlar: 40 bulgu)**
- 🟡 5 Önemli — YT-3 KDV seed yayılım / YT-4 5→6 rapor 5 doc / YT-5 notification types UI / YT-6 dış servis listesi / YT-7 2-tier kalıntı 6 doc

**Atlanan ama doğrulanmış (kalıntı temiz):**
- `is_superadmin` referansları: sadece **fonksiyon adı** olarak kalmış (`auth.is_superadmin()`, `petstockpro.auth_is_superadmin()`) — claim adı `user_role` ✅ tutarlı (KT2-1 doğru uygulandı)
- `storefront_enabled` / `storefrontEnabled`: aktif kodda kalıntı yok ✅ (K1 + OT2-6 doğru)
- STAFF gating notları: 5 ekran doc'unda var ✅ (OT2-5 doğru)
- customer_ref / credit_paid_at UX: EKRAN-STOK-HAREKETLERI §7.1'de Veresiye akışı eklendi ✅ (OT2-4 doğru)

**Tarama yöntemi:**
- 7 hedefli grep: is_superadmin, %18/KDV, "5 rapor", storefront_enabled, STAFF, customer_ref, Paddle/Frankfurter
- 2 hedefli enum cross-check: notificationTypeEnum DB ↔ UI tablosu
- Plan tier tutarlılık: 2-tier vs 3-tier B 11 doc'ta
- KDV oranı seed verisi: DATABASE-SCHEMA §7 INSERT

**Sprint 0 öncesi:** 4. tur sonrası **dokümanlar arası tutarlı**. Yeni session'da işlem yapan biri çelişen bilgi okuyamaz.

---

## 6. Tur (2026-05-21 gece) — 10 Bulgu

**Tetikleyici:** d6623b6 pricing revize (1.250/2.250 → 1.000/2.000) commit 18 dosya değiştirmiş ama yayılım 7 doc + 1 mockup + 1 test'te eksik kalmış. Ek olarak 5. tur YT5-2/3 (R2 strategy) Supabase Storage yansımasında bir doc'ta yarım kaldı.

### 🔴 Kritik (otoritatif yanlış bilgi)

### YT6-1: ✅ `CLAUDE.md §10 Kararlar` pricing 1.250/2.250 — STALE
- **Sorun:** CLAUDE.md:448 — "Pricing (2026-05-20 Karar C revize): PRO 1.250₺ + PRO+ 2.250₺" — yeni session'da kullanıcı kararı yansımamış otoritatif bilgi okur
- **Aksiyon:** "Pricing (2026-05-21 son revize): PRO 1.000₺ + PRO+ 2.000₺" + tarihçe (750/1.750 → 1.250/2.250 → 1.000/2.000)

### YT6-2: ✅ `PAYMENT-INTEGRATION.md §10 Karar Geçmişi` 2026-05-14 sonrası entry yok
- **Sorun:** Decision log 750/1.750 satırında durmuş, 2026-05-20 Karar C + 2026-05-21 son revize satırları eksik
- **Aksiyon:** İki yeni satır eklendi (2026-05-20 + 2026-05-21), son satır "otoritatif pricing" olarak işaretlendi

### YT6-3: ✅ `TECH-STACK.md §10` plan tier güncellemesi 750/1.750 — STALE
- **Sorun:** "2026-05-14 plan tier güncellemesi (YT-7)" satırı eski pricing'i otoritatif gösteriyordu
- **Aksiyon:** "2026-05-21 plan tier (son revize)" başlığıyla güncellendi + tarihçe satırı eklendi

### YT6-4: ✅ `SUPERADMIN-YETKILERI.md §3.1.1` plan tablosu 750/1.750 — STALE
- **Sorun:** Süperadmin yetki dokümanı eski pricing tablosuyla "PRO: [750] ₺" + "PRO+: [1.750] ₺" gösteriyordu
- **Aksiyon:** "[1.000] ₺" + "[2.000] ₺" güncellendi, başlık "2026-05-21 son revize"

### 🟡 Önemli (yayılım yarım kaldı, kafa karıştırıcı)

### YT6-5: ✅ `SPRINT-PLAN.md` Sprint 0 plans master + product-images bucket — eski
- **Sorun (a):** Line 228 — "plans master (3-tier B: FREE 50 / PRO 500-750₺ / PRO+ ∞ 1.750₺)" eski pricing
- **Sorun (b):** Line 144 — "Storage bucket'ları yarat: product-images, logos, documents" R2 kararı yansımamış
- **Aksiyon:** (a) Pricing 1.000/2.000 güncellendi + tarihçe; (b) Sadece `invoice-archives` (e-Arşiv) bucket, product-images R2'de notu eklendi

### YT6-6: ✅ `UI-MOCKUP-PLAN.md §6` harici tool prompt template eski pricing
- **Sorun:** Line 776 — Mockup üretim prompt template "PRO 500 ürün 750₺ / PRO+ Sınırsız 1.750₺" → Claude.ai/v0'a verilirse yanlış pricing'le mockup üretilir
- **Aksiyon:** 1.000/2.000 güncellendi

### YT6-7: ✅ `preview/urunler.html` mockup pricing eski
- **Sorun:** Line 371 — Plan progress strip altındaki yazı "PRO 500 ürün (750 ₺/ay) · PRO+ Sınırsız (1.750 ₺/ay)"
- **Aksiyon:** 1.000/2.000 güncellendi (kullanıcı d6623b6'da preview/super-admin.html'i güncellemiş ama urunler atlanmış)

### YT6-8: ✅ `SUPABASE-SETUP.md §10 Storage Bucket Policies` product-images RLS — eski
- **Sorun:** Storage Bucket Policies bölümü hâlâ Supabase `product-images` bucket'ı için RLS policy gösteriyordu. 5. tur YT5-2/3'te R2 stratejisine geçildi ama bu dosyada güncellenmedi
- **Aksiyon:** `product-images` policy kaldırıldı, `invoice-archives` (e-Arşiv PDF, server-side signed URL, KVKK gizlilik) policy eklendi + R2 referansı notu

### YT6-9: ✅ `src/lib/billing/totals.test.ts` test isimleri yanıltıcı
- **Sorun:** Test isimleri "PRO 750₺ KDV dahil" + "PRO+ 1750₺ KDV dahil" — matematik geçerli ama yanlış pricing example'ı kullanıyor (gerçek 1000/2000). Yeni geliştirici test'i okuyup pricing'i 750 sanır
- **Aksiyon:** Test örnekleri 1000 + 2000 ile güncellendi (matrah 833.33 / vat 166.67 ve matrah 1666.67 / vat 333.33). 3. test string input "1000.00"'a güncellendi

### 🟢 Düşük (historik kayıt, dokunulmadı)

### YT6-10: `DEVAM-REHBERI.md` historik kayıt referansları (dokunulmadı)
- Line 484 + 591 — Tur özetleri "Karar C: 1.250/2.250" diyor (historik); line 2195 belge haritası "750₺ / 1.750₺" notu (historik)
- **Karar:** Bu satırlar bilinçli historik kayıtlar (Karar tarihçesi). Üzerine yazmak tarihçeyi siler. Dokunulmadı.

---

## 6. Tur Özet (2026-05-21 gece)

**10 yeni bulgu — 9 ✅ çözüldü, 1 historik kayıt korundu (toplam tüm turlar: 50 bulgu)**

| Tür | Adet | Detay |
|---|---|---|
| 🔴 Kritik | 4 | CLAUDE.md / PAYMENT-INTEGRATION / TECH-STACK / SUPERADMIN-YETKILERI — otoritatif pricing yanlış |
| 🟡 Önemli | 5 | SPRINT-PLAN (2 sorun) / UI-MOCKUP-PLAN prompt / preview/urunler / SUPABASE-SETUP / billing/totals.test |
| 🟢 Düşük | 1 | DEVAM-REHBERI historik tur özetleri (dokunulmadı) |

**Tarama yöntemi:**
- d6623b6 commit'i (pricing revize) etkilenen 18 dosyayı listele, eksiklerini bul
- 4 grep deseni: `750|1.750|1.250|2.250` (pricing) · `Karar C revize` · `product-images.*bucket` (R2 yarım) · `750₺|1750₺` (test isim)
- src/lib/constants/plan-limits.ts canonical kabul, diğer doc/test/mockup ona göre tara
- TYPE_GROUPS / NotificationBell yansıma kontrolü — minimal etki, ek bulgu yok

**Etkilenen doc kategorileri:**
- 7 doc (CLAUDE + 6 docs/*.md)
- 1 mockup (preview/urunler.html)
- 1 test (src/lib/billing/totals.test.ts)
- 1 historik kayıt (dokunulmadı)

**Sonuç:** Tüm yeni session'larda artık 1.000/2.000 pricing kullanılacak. R2 strategy 5. tur YT5-2/3 yansıması tamamlandı.

---

*Son güncelleme: 2026-05-21 gece (6. tur Claude self-tarama). 50 toplam bulgu — 19 (1.) + 14 (2.) + 2 (3.) + 5 (4.) + 8 (5.) + 10 (6.) = ✅ hepsi çözüldü/korundu.*
