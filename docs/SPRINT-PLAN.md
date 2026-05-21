# PetStockPro — Sprint Planı

**Tarih:** 2026-05-12
**Stack:** Next.js 16 + Supabase + Drizzle + Auth.js (bkz. `TECH-STACK.md`)
**Toplam:** 19 sprint (Sprint 0 + 16 + Sprint 7'nin 7a/7b/7c bölünmesi) × ortalama 1.42 hafta = **~24 hafta** (5.5-6 ay) — Sprint 12 vitrin için 2.5 hafta (2026-05-13 revize), Sprint 14 Nilvera-only 1 hafta (2026-05-14 TR-only kararı, Paddle kaldırıldı)

> **Sprint 7 bölünmesi:** `SUPERADMIN-YETKILERI.md` (4 kategori yetki + Toolbox FAB) onaylandıktan sonra Sprint 7 büyüdü → 1.5 hafta yerine **4 hafta**. 7a (temel), 7b (override), 7c (DB Inspector + sistem ayarları) olarak ayrıldı.
**Methodology:** Browser-tested every sprint (Playwright + Vitest + axe-core)

> Bu doküman Faz 2 implementation yol haritasıdır. Faz 1 design dondu. Browser-tested kalite ile her sprint kapatılır.

---

## 1. Verification Loop (Her Sprint Sonu)

```
1. Implement (kod + commit)
2. tarayıcı test senaryoları geç (her ekran doc'unda var)
   - Playwright headed (manuel)
   - Chrome MCP (exploratory)
3. Otomatik regresyon eklenir
   - Playwright headless (E2E)
   - Vitest (unit)
4. axe-core ile WCAG AA audit
5. Tüm senaryo PASS → sprint kapanır
6. Demo + retrospektif
7. Sonraki sprint
```

---

## 2. Sprint Dağılımı

| # | Konu | Süre | Kategori | Çıktı |
|---|---|---|---|---|
| **0** | Bootstrap (skeleton + Supabase setup) | 1 hafta | Foundation | Çalışan dev env |
| **1** | DB Schema + RLS + Drizzle (Supabase ready) | 1.5 hafta | Backend foundation | DB hazır, tipler üretildi |
| **2** | Auth.js + 2FA + i18n + Frontend skeleton | 1.5 hafta | Foundation | Login + dashboard layout |
| **3** | Variant + Ürünler (CRUD + form 8 bölüm) | 2 hafta | Core | Ürün ekleme/düzenleme |
| **4** | Stok Hareketleri Ledger + 4 drawer | 2 hafta | Core | Giriş/Satış/Transfer/Sayım drawer |
| **5** | Sayım Workflow (tam-sayfa) | 1.5 hafta | Core | Sayım e2e |
| **6** | Şubeler + Branch Inventory + Multi-branch | 1.5 hafta | Multi-branch | İkinci şube açma akışı |
| **7a** | Süperadmin Paneli (ana `/admin` sidebar'a SUPERADMIN-only alt grup — ayrı sayfa değil, 2026-05-14): Tenant tablosu + İmpersonation + Plan Onay | 1.5 hafta | Sistem | Temel yönetim |
| **7b** | Süperadmin Toolbox FAB + Bypass Override'lar (`SUPERADMIN-YETKILERI.md`) | 1.5 hafta | Sistem | 24h bypass, hard delete, sayım geri al, eksi stok, plan limit override |
| **7c** | DB Inspector + Sistem Ayarları + Uzak Kullanıcı Yönetimi | 1 hafta | Sistem | DB sorgu UI, sistem config, şifre/2FA reset |
| **8** | Pano + Düşük Stok + PetPro Asistanı | 1.5 hafta | UX | Pano hero + asistan rules |
| **9** | Tedarikçiler + Kullanıcılar (CRUD) | 1.5 hafta | CRUD | Davet + rol akışı |
| **10** | Ayarlar (6 bölüm) + Telegram + Bildirim | 1.5 hafta | Sistem | Telegram bağlama, bildirimler |
| **11** | Raporlar (6 rapor + export) | 2 hafta | Analitik | PDF + Excel export (Açık Krediler 6. rapor — 2026-05-14 S2) |
| **12** | Merkezi Vitrin + SEO + Cities/Districts seed | 2 hafta | Pazarlama | petstockpro.com/vitrin aktif (Sahibinden modeli) |
| **13** | iyzico Subscription (TR ödeme) | 1.5 hafta | Ödeme | TR otomatik tahsilat |
| **14** | Nilvera e-Arşiv (TR e-fatura) | 1 hafta | Fatura | TR e-Arşiv kesim |
| **15** | Polish + Dokümantasyon Finalize | 1 hafta | Hazırlık | Bug fix + son okumalar |
| **16** | Lansman + Kapalı Beta | 1 hafta | Lansman | 10-15 pet shop test |

**Kilometre taşları (2026-05-14 MANTIK-HATALARI S6 düzeltmesi — net dil):**
- **Sprint 5 sonu** — İç test başlangıcı (ürün + stok + sayım minimal). **Beta DEĞİL** — sadece yakın çevre dogfooding. Vitrin henüz yok, gerçek pet shop'a açılmaz.
- **Sprint 8 sonu** — Pano + temel operasyon + asistan → genişletilmiş iç test (1-2 pilot pet shop manuel davet)
- **Sprint 11 sonu** — Tam fonksiyonel MVP (raporlar dahil) → kapalı beta açılabilir
- **Sprint 14 sonu** — TR ödeme + e-Arşiv fatura tam → public beta hazır
- **Sprint 16** — Production lansman

---

## 3. Sprint 0 — Bootstrap (1 hafta)

**Hedef:** Çalışan development environment.

> **2026-05-21 PLAN-BETA-PERFORMANCE Faz 1 sonrası ek:** Sprint 0 manuel bootstrap'i `src/instrumentation.ts` Next.js
> native hook ile otomatikleşti. Sıfır DB'de `npm run dev` → migration apply + cities/districts (81+974) seed +
> catalog_seed_products (1.240) seed otomatik (~885ms). `BOOTSTRAP_SKIP=1` ile prod CI/CD'de devre dışı. Sprint 0
> bootstrap işleri (Next.js init + Drizzle + Auth.js + shadcn) yapıldıktan sonra **manuel seed çağrısı artık
> gerekmez** — instrumentation.ts halleder. Detay: TECH-STACK.md §2.2 Auto-bootstrap + PLAN-BETA-PERFORMANCE.md Faz 1.

### Yapılacaklar

1. **Repo kurulum (yarım gün)**
   ```bash
   cd D:/Projeler/petstockpro
   git init (zaten yapıldı, kontrol)
   git remote add origin git@github.com:user/petstockpro.git
   ```

2. **Next.js init (yarım gün)**
   ```bash
   npx create-next-app@latest . --typescript --tailwind --app --src-dir --turbopack
   # Mevcut README'yi koru, üstüne yaz
   ```

3. **Bağımlılıklar (1 gün)**
   ```bash
   # Auth
   npm i next-auth@beta @auth/drizzle-adapter

   # DB
   npm i drizzle-orm postgres
   npm i -D drizzle-kit @types/pg

   # Supabase
   npm i @supabase/supabase-js @supabase/ssr

   # State
   npm i @tanstack/react-query zustand

   # i18n
   npm i next-intl

   # UI
   npx shadcn@latest init  # shadcn/ui setup
   npm i lucide-react

   # Validation
   npm i zod drizzle-zod

   # Charts
   npm i recharts

   # Map
   npm i leaflet react-leaflet
   npm i -D @types/leaflet

   # Utilities
   npm i date-fns
   npm i react-hotkeys-hook
   npm i sweetalert2 sonner

   # Test
   npm i -D vitest @vitest/ui jsdom
   npm i -D @testing-library/react @testing-library/jest-dom
   npm i -D @playwright/test
   npx playwright install
   npm i -D @axe-core/playwright

   # Email (Brevo)
   npm i @getbrevo/brevo

   # Monitoring
   npm i @sentry/nextjs
   ```

4. **Supabase project (1 gün)**
   - Supabase'de yeni proje oluştur (Free tier)
   - DB connection string al → `.env.local` koy
   - Storage bucket'ları yarat: `product-images`, `logos`, `documents`
   - Auth provider config: Email + Google (sonra)

5. **Drizzle setup (1 gün)**
   - `drizzle.config.ts`
   - `src/db/schema/` klasörü (alt dosyalar)
   - `src/db/index.ts` (client)
   - `npx drizzle-kit generate` test

6. **Auth.js setup (yarım gün)**
   - `src/lib/auth.ts` (NextAuth v5 config)
   - `src/middleware.ts` (auth gate + locale)
   - Drizzle adapter bağla

7. **Tailwind v4 + shadcn/ui konfigürasyon (yarım gün)**
   - `globals.css` (`TASARIM-SISTEMI.md`'deki tüm CSS variable'lar)
   - shadcn temaları: Button, Input, Drawer, Card, vs. başlangıç bileşenler

8. **Logo + assets (yarım gün)**
   - `public/logo/logo.png` (assets/'dan kopya)
   - favicon set üret (realfavicongenerator.net)
   - `public/og-image.png` placeholder

9. **next.config.ts (yarım gün)**
   - `next-intl` plugin
   - `images.remotePatterns` (Supabase Storage)
   - CSP headers (production)

10. **CI/CD basit (yarım gün)**
    - GitHub Actions: lint + test + build
    - `.github/workflows/ci.yml`

11. **Docs link (yarım gün)**
    - `docs/` zaten dolu (15+ doküman)
    - README'yi güncelle: setup talimatları, link'ler

### Verification (Sprint 0)

- ✅ `npm run dev` → http://localhost:3000 açılıyor
- ✅ "PetStockPro" landing placeholder görünüyor
- ✅ `npm run build` başarılı
- ✅ Supabase Postgres connection çalışıyor
- ✅ Drizzle `pnpm drizzle-kit studio` ile DB GUI açılıyor (boş)
- ✅ Auth.js `/api/auth/signin` endpoint cevap veriyor
- ✅ GitHub Actions CI yeşil

### Çıktı

Çalışan dev environment. Sprint 1'de bunun üstüne backend foundation kurulur.

---

## 4. Sprint 1 — DB Schema + RLS + Drizzle Hazır (1.5 hafta)

**Hedef:** Tüm tablolar + RLS politikaları + tip generation. Sayfa yok ama backend foundation tam.

### Yapılacaklar

1. **Drizzle schema (3 gün)**
   - `src/db/schema/tenant.ts`
   - `src/db/schema/branch.ts`
   - `src/db/schema/catalog.ts`
   - `src/db/schema/operations.ts`
   - `src/db/schema/system.ts`
   - `src/db/schema/storefront.ts`
   - `npx drizzle-kit generate` → migration üret

2. **Migration apply (yarım gün)**
   - `npx drizzle-kit migrate` Supabase'e push
   - Tablolar Supabase Dashboard'da göründü mü kontrol

3. **RLS politikaları (2 gün)**
   - `drizzle/rls/001_enable_rls.sql` ile başla
   - Helper functions (`auth.company_id()`, `auth.branch_id()`)
   - Her tablo için politikalar (`002_companies_policies.sql`, vs.)
   - Manuel uygula: `psql -f drizzle/rls/*.sql`

4. **Trigger'lar (1 gün)**
   - `stock_movements` immutable trigger
   - Yeni şube → branch_inventory otomatik
   - Yeni variant → branch_inventory otomatik
   - `updated_at` auto

5. **Seed data (1 gün — cities/districts dahil)**
   - `plans` master (3-tier B: FREE 50 / PRO 500-750₺ / PRO+ ∞ 1.750₺ — 2026-05-14 karar)
   - **`cities` (81 il) + `districts` (~970 ilçe) seed**
     - Veri kaynağı: TÜİK güncel il-ilçe listesi (https://www.tuik.gov.tr) veya nvi.gov.tr (Nüfus ve Vatandaşlık İşleri)
     - **⚠ ESKİ Pet/client/src/data/turkeyDistricts.ts kullanma** — 2 yıl eski, yeni ilçeler eksik olabilir
     - Sprint 0'da **TÜİK güncel verisi** indirilip dönüştürülecek
     - Versiyonlu: `V11__seed_cities_districts_v1.sql` (gelecek güncellemeler `Vxx__update_cities_v2.sql` olarak migration ile)
   - Default kategoriler template
   - Test tenant + 2 kullanıcı (ali@mavipet.test, super@petstockpro.test)
   - **PostGIS + pg_trgm + moddatetime + unaccent extensions aktive** (SUPABASE-SETUP §1.2)

6. **Type generation (yarım gün)**
   - `npx supabase gen types typescript` ile Supabase tipleri
   - Drizzle types testi
   - `drizzle-zod` schema'lar

7. **Test (1 gün)**
   - Unit test: RLS politikaları çalışıyor mu (Vitest + Supabase test client)
   - Integration test: tenant izolasyon (Ali Şirket A görür, B göremez)
   - Trigger test: stock_movements UPDATE → exception

### Verification

- ✅ 24 tablo Supabase Dashboard'da görünür
- ✅ RLS politikaları her tabloda aktif
- ✅ Test tenant ile login → kendi şirketini görüyor, başkasını görmüyor
- ✅ stock_movements UPDATE → DB exception
- ✅ Yeni şube ekleme → branch_inventory otomatik row'lar yaratılıyor
- ✅ `drizzle-kit studio` ile data görüntüleme

### Çıktı

Backend foundation hazır. Sprint 2'de auth ve frontend skeleton.

---

## 5. Sprint 2 — Auth + 2FA + Onboarding + Turnstile + Frontend Skeleton (2 hafta — 10 iş günü)

> **2026-05-15 revize:** Önceki "1.5 hafta" tahmini yetersizdi — EKRAN-AUTH.md detaylandırması ile gerçek iş genişledi: email değiştirme akışı + Turnstile setup + onboarding 3 adım wizard + HIBP check + email enumeration koruma + KVKK çift checkbox + 52 test senaryosu. Sprint 2 → 2 hafta.
>
> **Tam akış detayı:** `EKRAN-AUTH.md` (15 bölüm + 52 test).

**Hedef:** EKRAN-AUTH.md akışlarının tamamı + sidebar/topbar shell + i18n TR-only + 2FA + onboarding wizard.

### Yapılacaklar

1. **Auth.js v5 setup (1.5 gün)**
   - Credentials provider (email + şifre + 2FA TOTP)
   - Session callback → user_role + companyId + branchId claims (`KT2-1`: `user_role` claim, eski `is_superadmin` YOK)
   - Supabase JWT bridge (RLS için, `SUPABASE-SETUP §5`)
   - Cookie config (HttpOnly + Secure + SameSite=Lax + 7 gün)
   - Google OAuth Faz 2'ye saklı (scaffold da YAPMA — TR-only sade)

2. **Cloudflare Turnstile entegrasyon (0.5 gün — 2026-05-15 yeni)**
   - `@marsidev/react-turnstile` paket kurulum
   - `env.NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` config
   - `lib/auth/verify-turnstile.ts` server-side verify helper
   - TR locale + theme=light + size=normal config
   - Detay: `TECH-STACK §3.9c`

3. **Auth sayfaları (3 gün — EKRAN-AUTH.md sırasıyla)**
   - `/login` — email + şifre + 2FA step + 5+ fail Turnstile (`§2`)
   - `/register` — pet shop adı + email + şifre + 2 KVKK checkbox + Turnstile zorunlu + HIBP check (`§3`)
   - `/verify-email` bekleme + `/verify-email?token=` tıklama hedefi (`§4`)
   - `/forgot-password` — email + Turnstile zorunlu + enumeration koruma (`§5.1`)
   - `/reset-password?token=` — yeni şifre + tüm session invalidate (`§5.3`)
   - `/accept-invite?token=` — hibrit davet kabul (email + opsiyonel email düzelt) (`EKRAN-KULLANICILAR §4.4`)
   - `/account-locked` — 15dk geri sayım + alternatif aksiyonlar (`§10.2`)

4. **2FA setup wizard (1 gün — `EKRAN-AUTH §7`)**
   - 3 adım wizard: QR kod tara → 6 haneli kod doğrula → 8 recovery code (kopya/yazdır)
   - `otplib` TOTP secret üret + `qrcode` QR
   - Recovery codes 8 adet, SHA256 hash, tek kullanımlık
   - SUPERADMIN için zorunlu enforce (`§4.1`)

5. **Email değiştirme (0.5 gün — 2026-05-15 yeni — `EKRAN-AUTH §6`)**
   - `/admin/settings/account/change-email` çift doğrulama akışı
   - 3 endpoint: `/change-email/init`, `/verify`, `/cancel`
   - Eski email "İptal Et" → süperadmin Telegram alert

6. **Onboarding 3 adım wizard (1.5 gün — `EKRAN-AUTH §8`)**
   - Adım 1: İlk şube (il/ilçe + adres + WhatsApp)
   - Adım 2: İlk ürün (basit form, variant Sprint 3+)
   - Adım 3: Vitrin profili (opsiyonel) veya "Sonra hallederim"
   - "Atla" her adımda + onboardingCompletedAt set

7. **Layout shell (2 gün)**
   - `/admin/layout.tsx`: Sidebar + Topbar + Outlet
   - Sidebar: 5 grup, plan card, mascot (TASARIM-SISTEMI Verdana)
   - Topbar: breadcrumb + ⌘K placeholder + 🔔 + avatar (🌓 dark/light YOK MVP'de)
   - Glass morphism + mesh gradient + paw pattern bg

8. **i18n setup TR-only (0.5 gün)**
   - `next-intl` config
   - `messages/tr.json` (auth strings dahil — `ST2-2` namespace pattern)
   - EN locale gizli (next-intl yapısı korunur, Faz 2)
   - Currency formatter `Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })`

9. **Test (1.5 gün — 52 AUTH-* senaryosu, `EKRAN-AUTH §13`)**
   - Login (AUTH-001..010)
   - Register (AUTH-011..020)
   - Email Verification (AUTH-021..025)
   - Forgot Password (AUTH-026..035)
   - 2FA (AUTH-036..042)
   - Email Change (AUTH-043..048)
   - Onboarding (AUTH-049..052)
   - E2E (Playwright)

### Verification

- ✅ Email + şifre + 2 KVKK checkbox + Turnstile ile register çalışıyor
- ✅ E-posta doğrulama (Brevo SMTP, 24h TTL, resend 60sn cooldown)
- ✅ 2FA setup wizard + 8 recovery codes
- ✅ Şifremi unuttum akışı (Turnstile + enumeration koruma + 30dk TTL + tek kullanımlık)
- ✅ Email değiştirme çift doğrulama
- ✅ Onboarding 3 adım wizard (atla seçenekleri çalışıyor)
- ✅ Hesap kilidi **5 başarısız → 1 SAAT lock** (2026-05-15 sıkı policy) + 3 art arda lock → 24 saat + email + Telegram alert
- ✅ Frontend kalan hak banner (3+ yanlış sonrası "X hakkın kaldı")
- ✅ Sidebar + topbar görsel olarak mockup'a yakın
- ✅ 59 AUTH-* test PASS (önceki 52 → brute-force testleri 7 arttı)
- ✅ Logout

### Çıktı

Auth çalışıyor. Admin shell hazır. Sprint 3'te ilk operasyonel feature.

---

## 6. Sprint 3 — Variant + Ürünler (2 hafta)

**Hedef:** Ürünler ekranı tam — variant sistemi MVP'de aktif.

### Yapılacaklar

1. **Liste sayfası (3 gün)**
   - Filtre paneli (collapsed + URL persist)
   - KPI üst şerit (4 metrik)
   - Tablo (kolonlar + sıralama + sayfalama)
   - Stok kolonu expand (variant × şube matrix)
   - Hover satır eylemleri
   - Plan progress bar

2. **Detay drawer (2 gün)**
   - 9 bölüm (galeri + sınıflandırma + fiyat + matrix + açıklama + varyantlar + son hareket + metadata + footer)
   - Eşik mini-modal
   - Hızlı aksiyonlar

3. **Yeni / Düzenle sayfası (3 gün)**
   - 2-kolon layout
   - 8 form bölümü
   - Sticky özet
   - SKU auto-suggest + çakışma kontrolü
   - Görsel upload (Sprint 3.3 — drag-drop + **Cloudflare R2** via AWS SDK v3, S3-compatible; `tenants/{companyId}/{productId}/{uuid}.{ext}` key pattern; `requireImage=true` default — bkz. EKRAN-URUNLER.md §5.5 + §7.3)
   - Auto-save taslak (localStorage)

4. **Variant sistemi (2 gün)**
   - Form bölüm 7: variant tablo + ekle/sil
   - Backend transparent default variant (varyantsız ürünler için)
   - SKU otomatik suggest
   - Plan limit: parent = 1, variant bedava

5. **Bulk actions (1 gün)**
   - Eşik / kategori / fiyat değiştir
   - Arşivle (soft delete)
   - Excel export

6. **Plan limit kontrolü (1 gün)**
   - %80 banner
   - %100 disabled + modal
   - Backend 402 Payment Required

7. **Test (2 gün)**
   - 30 test senaryosu (PROD-001..030)
   - Variant sistemi senaryoları
   - Plan limit senaryoları

### Verification

- ✅ 30 PROD test senaryosu PASS
- ✅ 50 ürün eklendi (FREE limit)
- ✅ 51. ürün eklemeye çalıştı, modal çıktı
- ✅ Variant'lı ürün eklendi, matrix doğru
- ✅ SKU çakışma kontrolü çalışıyor
- ✅ Auto-save taslak çalışıyor
- ✅ axe-core 0 critical/serious

### Çıktı

Ürünler ekranı tam. Sprint 4'te stok hareketleri.

---

## 7. Sprint 4 — Stok Hareketleri Ledger (2 hafta)

**Hedef:** Ledger immutable + 4 hareket drawer'ı + geri alma R1.

### Yapılacaklar

1. **Ledger tablosu (3 gün)**
   - Liste sayfası (filtre + tablo + özet bar)
   - Detay drawer
   - Realtime feed (Supabase Realtime)
   - Filtre URL persist

2. **4 hareket drawer'ı (4 gün)**
   - Stok Girişi (tedarikçi zorunlu + multi-line + lot/SKT)
   - Çıkış/Satış (7 alt-tip + ödeme + eksi stok yasak)
   - Transfer (kaynak/hedef + yola çıktı/direkt teslim)
   - Sayım başlatıcı (tam-sayfa workflow'a yönlendirme)

3. **Geri alma R1 (1 gün)**
   - 24 saat ADMIN
   - Süresiz SUPERADMIN (🚨 audit)
   - Sayım geri alınamaz
   - Karşı hareket gir akışı

4. **Concurrent satış lock (1 gün)**
   - PostgreSQL `SELECT FOR UPDATE`
   - Race condition test
   - 409 Conflict response

5. **Audit log entegrasyon (1 gün)**
   - Her hareket → audit_logs entry
   - performed_as_superadmin damgası
   - IP + user_agent yakalama

6. **Test (2 gün)**
   - 33 LDG test senaryosu
   - Realtime test (başka tab'dan ekle)
   - Concurrent edge case

### Verification

- ✅ 33 LDG test senaryosu PASS
- ✅ Eksi stoğa izin verilmiyor
- ✅ Stok girişi → Realtime feed güncelleniyor
- ✅ Geri alma 24h içinde çalışıyor, dışında disabled
- ✅ Süperadmin impersonation altında 🚨 işareti
- ✅ Sayım geri alınamaz

### Çıktı

Ledger'ın kalbi çalışıyor. Sprint 5'te sayım workflow.

---

## 8. Sprint 5 — Sayım Workflow (1.5 hafta)

**Hedef:** Sayım tam-sayfa + yumuşak kilit + onay modal.

### Yapılacaklar

1. **Sayım liste sayfası (1 gün)**
   - Aktif sayımlar
   - Geçmiş sayımlar tablosu
   - Sayım detay drawer

2. **Tam-sayfa workflow (3 gün)**
   - İlerleme bar
   - Ürün tablosu (parent grup + variant)
   - Sayılan input + Tab/Enter navigasyon
   - Fark hesabı + sebep dropdown
   - Filtre pills (Sayılmadı/Sayıldı/Farklı)
   - Auto-save 30s

3. **Tamamla akışı (1 gün)**
   - Onay modal (fark özeti + uyarı)
   - Backend: stock_movements entry per fark
   - Branch_inventory güncelleme

4. **Yumuşak kilit Realtime (1 gün)**
   - Supabase Realtime subscribe
   - Sistem stoğu değişiminde toast
   - Sayım listesi anlık güncelle

5. **Mobile swipe-card (1 gün)**
   - Touch swipe gesture
   - Numpad otomatik açılır
   - Tek tek ürün UX

6. **Test (1 gün)**
   - 22 CNT senaryosu

### Verification

- ✅ 22 CNT test PASS
- ✅ Sayım tamamlanınca ledger entries doğru
- ✅ Yumuşak kilit: paralel satış toast bildirim
- ✅ Mobile swipe sorunsuz

### Çıktı

**🎯 Kilometre Taşı: İlk Satılabilir Saf SaaS**
Ürün + stok girişi + satış + sayım minimal akış tam. Erken iç test başlayabilir.

---

## 9. Sprint 6 — Şubeler + Multi-Branch (1.5 hafta)

**Hedef:** İkinci şube açma akışı + transfer + Şubeler ekranı.

### Yapılacaklar

1. **Şubeler liste (kart grid + tablo toggle) (2 gün)**
2. **Yeni / Düzenle form (1 gün)**
   - Adres + harita (Leaflet lazy)
   - Müdür atama
3. **Detay sayfası + sekmeler (2 gün)**
   - Stok, Hareketler, Satışlar, Kullanıcılar, Ayarlar
4. **Multi-branch geçiş otomatik (1 gün)**
   - 2. şube eklenince sidebar menü görünür
   - Transfer drawer aktif
   - Şube kolonu tablolarda görünür
5. **Şube kapatma (soft delete) (1 gün)**
   - Stok varsa transfer akışı
   - Stok 0 ise direkt
6. **Test (1.5 gün)**
   - 20 BRN senaryosu

### Verification

- ✅ 20 BRN test PASS
- ✅ 2. şube eklenince Şubeler menüsü otomatik aktif
- ✅ Transfer drawer multi-branch çalışıyor
- ✅ Soft delete + stok transfer yönlendirmesi

---

## 10. Sprint 7 — Süperadmin (4 hafta toplam, 3 alt-sprint)

**Hedef:** SUPERADMIN paneli + 3 sekme + impersonation + **Toolbox FAB + Override yetkileri** + **DB Inspector + Sistem Ayarları + Uzak Kullanıcı**

### Sprint 7a (1.5 hafta) — Temel Yönetim

1. **ANA `/admin` panelinde SUPERADMIN-only sidebar alt grubu** (2026-05-14 mimari: ayrı `/super-admin` URL/sayfa YOK, role-based menü — `EKRAN-SUPERADMIN.md` başındaki notu uygula). Route'lar `/admin/tenants`, `/admin/audit`, `/admin/plan-approval` altında. Sidebar sadece SUPERADMIN role için render edilir, normal ADMIN bu URL'lere `403` alır.
   - 3 sekme: Tenant'lar / Audit / Plan Onay
2. Tenant tablosu + detay drawer
3. İmpersonation akışı (JWT, sticky sarı bant, 120dk timer, sessiz mod)
4. Plan onay sekmesi
5. 2FA zorunlu
6. **Verification:** 19 SA senaryosu PASS

### Sprint 7b (1.5 hafta) — Toolbox + Bypass Override

`SUPERADMIN-YETKILERI.md` Kategori 1 (Sistem Kurallarını Bypass).

1. **Süperadmin Toolbox FAB** (sağ alt floating button, bağlam-aware menü)
2. **Bypass override aksiyonları:**
   - Süresi geçmiş hareket geri al
   - Sayım geri al
   - Hard delete (ürün, kullanıcı, tedarikçi)
   - Eksi stoğa zorla giriş
   - Plan limit override (temporary_limit_override)
   - Immutable hareket metadata düzelt
3. **Modal iskeletti** her override için: zorunlu sebep + şifre re-auth + audit 🚨🚨
4. **audit_logs.superadmin_action_type** = 'bypass' damgası
5. **Verification:** 25 bypass test senaryosu

### Sprint 7c (1 hafta) — DB Inspector + Sistem Ayarları + Uzak Kullanıcı

`SUPERADMIN-YETKILERI.md` Kategori 2-4.

1. **DB Inspector sayfası** (SELECT-only default + UPDATE kilitli mod + hazır script kataloğu)
2. **Sistem Ayarları sayfası** (Plan tier'lar + Feature flags + Default kategoriler + Email şablonları + Telegram bot + Sistem broadcast)
3. **Uzak kullanıcı yönetimi:**
   - Şifre anında reset
   - 2FA reset
   - Tüm oturum invalidate
   - Hesap kilitle/aç (locked_until)
4. **system_settings + system_broadcasts** tabloları
5. **Verification:** 20 senaryosu (DB Inspector + ayarlar + uzak kullanıcı)

### Sprint 7 Toplam Verification

- ✅ Sprint 7a: 19 SA + impersonation
- ✅ Sprint 7b: 25 bypass override (24h, hard delete, sayım, eksi stok, plan limit, metadata)
- ✅ Sprint 7c: 20 DB + sistem + uzak kullanıcı
- ✅ Tüm aksiyonlar audit 🚨🚨 + `superadmin_action_type` damgalı
- ✅ Audit log immutable (süperadmin bile değiştiremez)
- ✅ DB Inspector DROP/TRUNCATE komutları yasak

### Çıktı

**🎯 Kilometre Taşı: Sistem destek tam donanımlı.** Senin (sistem sahibi) tüm operasyonel ihtiyaçların karşılanır.

---

## 11. Sprint 8 — Pano + Düşük Stok + PetPro Asistanı (1.5 hafta)

**Hedef:** Pano hero + bento grid + asistan rules + düşük stok.

### Yapılacaklar

1. **Pano hero (1 gün)**
   - Greeting + meta + 2 CTA + stats pills
   - Mascot illustration sağ kolon
   - Onboarding kartı (yeni tenant)
2. **Alerts strip (yarım gün)**
3. **Bento grid (2 gün)**
   - Big KPI Envanter Değeri
   - 3 small KPI
   - Trend chart (Recharts)
   - Düşük stok widget
4. **Activity feed Realtime (1 gün)**
   - WebSocket subscribe
   - Süperadmin 🚨 işareti
5. **PetPro Asistanı (2 gün)**
   - Rule engine (Sipariş/Transfer/İndirim 3 tip)
   - Backend hesap
   - Frontend kart
6. **Düşük Stok ekranı (1 gün)**
   - Tablo + öneri hesabı
   - Toplu sipariş R6 akışı
7. **Test (1 gün)**
   - 15 PANO + 19 LOW senaryosu

### Verification

- ✅ Pano LCP < 2.5s
- ✅ PetPro Asistanı 3 tip öneri çalışıyor
- ✅ Toplu sipariş R6 sıralı drawer akışı
- ✅ Realtime feed başka tab'dan

---

## 12. Sprint 9 — Tedarikçiler + Kullanıcılar (1.5 hafta)

**Hedef:** İki CRUD ekranı + davet + rol akışları.

### Yapılacaklar

1. **Tedarikçiler ekranı (2 gün)**
2. **Kullanıcılar ekranı + davet (3 gün)**
   - Davet mini-modal
   - Davet e-postası (Brevo)
   - Accept-invite akışı
   - Rol değiştirme
3. **Aktif oturumlar + uzak çıkış (1 gün)**
4. **Test (1.5 gün)**
   - 14 SUP + 16 USR senaryosu

---

## 13. Sprint 10 — Ayarlar + Telegram + Bildirim (1.5 hafta)

**Hedef:** Settings 6 bölüm + Telegram bot + bildirim sistemi.

### Yapılacaklar

1. **Settings layout (sol sidebar + içerik) (1 gün)**
2. **6 bölüm formları (3 gün)**
3. **Telegram bot (2 gün)**
   - Custom bot oluştur (@PetStockProBot)
   - Bağlama akışı (3 adım kod)
   - Webhook handler
4. **Bildirim sistemi (2 gün)**
   - 7 bildirim tipi
   - Ekran içi 🔔 dropdown
   - Telegram gönderim
   - pg_cron daily/weekly summary
5. **2FA UI (Settings içinde) (1 gün)**
6. **Test (1 gün)**
   - 15 SET senaryosu

---

## 14. Sprint 11 — Raporlar (2 hafta)

**Hedef:** 6 rapor + export + materialized view performans (2026-05-14 S2: Açık Krediler 6. rapor olarak eklendi).

### Yapılacaklar

1. **Liste sayfası + 6 kart (1 gün)**
2. **6 detay sayfası (5-6 gün)**
   - Satış raporu
   - Kâr/zarar
   - En çok satan
   - Ölü stok
   - Şube karşılaştırma
   - Açık Krediler (`payment_method='credit' AND credit_paid_at IS NULL` gruplama + yaş analizi 0-15/16-30/31-60/60+ gün band'ları)
3. **Materialized view (1 gün)**
   - mv_daily_sales
   - inventory_snapshots
   - pg_cron refresh
4. **Krediyi Kapama akışı (0.5 gün)**
   - POST `/api/admin/reports/open-credits/[movementId]/settle`
   - `credit_paid_at = NOW()` set + audit `sale.credit_settled` + opsiyonel Telegram
5. **PDF export (2 gün)**
   - Supabase Edge Function
   - React-PDF
   - Asenkron toplu PDF (6 rapor)
6. **Excel export (1 gün)**
7. **Test (1 gün)**
   - 18 RPT senaryosu (RPT-001..018)

### Verification

- ✅ **🎯 Kilometre Taşı: Kapalı Beta Hazır**
- ✅ Tam fonksiyonel MVP
- ✅ 10-15 pet shop davet edilebilir

---

## 15. Sprint 12 — Merkezi Vitrin Dizini (2.5-3 hafta — 14 iş günü)

> **2026-05-13 revize:** Önceki "2 hafta" tahmini yetersizdi (13 iş günü iş, 10 iş günü ayrılmıştı). Vitrin Profili UI Sprint 11 (Ayarlar) içine kaydırılmadı çünkü vitrin'le bütünleşik akış. Sprint 12 → 2.5 hafta.
> **2026-05-14 net:** TR-only kararıyla Sprint 14 (Paddle çıkarıldı) 1.5 → 1 hafta düştü; bu Sprint 12'nin 0.5 hafta artışını dengeledi. Toplam plan **24 hafta** (5.5-6 ay).
> **2026-05-15 net:** WhatsApp Geri Bildirim Balonu task'ı (1 gün) eklendi → 13 → 14 iş günü. Toplam plan ~24-24.5 hafta (etki ihmal edilebilir, kullanıcı kararı bütün).

**Hedef:** `petstockpro.com/vitrin` merkezi tek dizin (Sahibinden modeli), Cities/Districts seed, PostGIS yakınlık, WhatsApp deep link, cross-tenant kıyaslama.

### Yapılacaklar

1. **Cities + Districts seed (yarım gün)**
   - turkeyDistricts.ts (eski Pet/) dönüşümü
   - 81 il + ~970 ilçe insert
2. **PostGIS + extensions aktive (yarım gün)**
   - postgis, pg_trgm, moddatetime, unaccent (earthdistance KALDIRILDI — 2026-05-14 MANTIK-HATALARI S4, PostGIS tek extension)
3. **Public sayfaları (5 gün)**
   - Vitrin ana sayfa (kategori grid + popüler + yakındaki pet shop)
   - Şehir/ilçe filtreli sayfa (`/vitrin/[il]/[ilce]`)
   - Kategori sayfası (cross-tenant)
   - Ürün detay + **cross-tenant kıyaslama** (3-5 pet shop kart)
   - Pet shop profili (`/vitrin/magaza/[slug]`) + harita + iletişim
   - Arama sonuçları
4. **WhatsApp deep link + vitrin_events tracking (1 gün)**
   - `wa.me/...` URL parametre encoding
   - Event kayıt (view, product_view, whatsapp_click)
5. **WhatsApp Geri Bildirim Balonu (1 gün — 2026-05-15 eklendi)**
   - Sticky balon bileşeni (`app/vitrin/_components/feedback-balloon.tsx`)
   - 5 emoji seçenek, tek tıklama submit, sticky davranış (dış tıklama dismiss etmez)
   - 5 sn delay + localStorage dedup (1 IP × 1 tenant × 24h)
   - POST `/api/vitrin/feedback` endpoint + Cloudflare KV rate-limit
   - beforeunload sendBeacon (`dismissed` counter)
   - Esc tuşu → manuel kapama
   - 4 yeni `vitrin_events` event_type tracking (balloon_shown / submitted / closed_manually / dismissed)
   - Mobile responsive (full-width balon)
   - 15 VIT-FB test senaryosu — `EKRAN-PUBLIC-VITRIN.md §15.10`
   - Detay: `EKRAN-PUBLIC-VITRIN.md §15` + `DATABASE-SCHEMA.md §3.8.1`
6. **Konum tespiti (1 gün)**
   - Browser Geolocation API
   - MaxMind GeoLite2 IP fallback
   - PostGIS ST_DWithin sorgusu
7. **SEO (2 gün) — sitemap pre-build pattern (2026-05-14 — DEVAM-REHBERI #8)**
   - Supabase Edge Function `generate-sitemap` (gece 03:00 pg_cron)
   - sitemap-index.xml + sitemap-{tenants,products,locations}-N.xml (her chunk 50K URL)
   - **İçerik filtresi:** sadece aktif tenant + vitrin_published ürün + min 3 ürünlü kategori×şehir kombinasyonu
   - Cloudflare R2 bucket'a yaz (`sitemap/` prefix)
   - Workers route `/sitemap*.xml` → R2 fetch + 1 saat edge cache (dynamic generation **YOK** — Workers timeout/100MB limit riski)
   - Meta + Open Graph + Schema.org Product + LocalBusiness
   - robots.txt
   - Süperadmin Toolbox "Sitemap Şimdi Yenile" butonu (manuel rebuild — acil durum)
   - Detay: `EKRAN-PUBLIC-VITRIN.md §10.2`
8. **Settings > Vitrin Profili yönetimi (1 gün)**
   - KVKK onay + slug + logo + kapak + WhatsApp + saatler
9. **ISR + Cloudflare cache stratejisi (1 gün)**
10. **Test (1 gün)** — 23 VIT + 15 VIT-FB = **38 senaryo** (WhatsApp Feedback Balonu testleri dahil — 2026-05-15)

### Verification

- ✅ petstockpro.com/vitrin merkezi vitrin aktif (Sahibinden modeli)
- ✅ Cities/Districts seed (81 il + ~970 ilçe)
- ✅ PostGIS yakınlık sorgusu çalışıyor
- ✅ Ürün katalog LCP < 2.5s
- ✅ Stok visibility level çalışıyor
- ✅ WhatsApp deep link (vitrin_events tracking)
- ✅ Schema.org Product structured data
- ✅ WhatsApp Feedback Balonu sticky + 5 emoji + tek tap submit + 24h dedup (2026-05-15)
- ✅ 38 test PASS (23 VIT + 15 VIT-FB)

---

## 16. Sprint 13 — iyzico Subscription (1.5 hafta)

**Hedef:** TR ödeme otomatik tahsilat. **Detay:** `PAYMENT-INTEGRATION.md §2`

### Yapılacaklar

1. **iyzico SDK kurulum + sandbox config (1 gün)**
2. **Subscription API entegrasyon (3 gün)** — recurring billing + 3D Secure
3. **Settings > Plan > "PRO'ya Yükselt" UI + 3D Secure flow (2 gün)**
4. **Webhook handler + idempotency (1 gün)**
5. **Subscription lifecycle state machine (1 gün)** — past_due → suspended → cancelled
6. **KVKK onay akışı + audit log (1 gün)** — hizmet sözleşmesi + cayma hakkı modal
7. **Sandbox testleri (0.5 gün)**

### Lansman öncesi (Sprint 16)
- iyzico Bayi Sözleşmesi imzala (production hesap)
- Production API key + Webhook URL
- 3D Secure gerçek kart testi
**Detay:** `PAYMENT-INTEGRATION.md §7.1`

---

## 17. Sprint 14 — Nilvera e-Arşiv (1 hafta)

**Hedef:** TR e-Arşiv fatura entegrasyonu. **Detay:** `PAYMENT-INTEGRATION.md §3`

> **2026-05-13:** Custom Domain (PRO+ Cloudflare for SaaS) kapsamı kaldırıldı.
> **2026-05-14:** **TR-only kararı** — Paddle (yurt dışı ödeme MoR) kapsamdan çıkarıldı. Sprint 1.5 → 1 haftaya düştü. Yurt dışı satış Faz 3'e ertelendi.

### Yapılacaklar

#### Nilvera (4 gün) — TR e-Arşiv fatura
1. API entegrasyon (e-Arşiv kesme)
2. Webhook handler (fatura UUID + PDF URL)
3. Stok Çıkışı drawer'a "E-Arşiv kes" toggle
4. Tenant onboarding'de e-Arşiv şartları açıklama (mali mühür + GİB başvuru)
5. Hata yönetimi (kontör bitti, sertifika süresi dolmuş)

#### Test + Polish (1 gün)
- Nilvera sandbox fatura akışı
- KVKK aydınlatma metni: Nilvera sub-processor güncel
- iyzico + Nilvera uçtan uca akış (ödeme → fatura tetiği)

### Lansman öncesi (Sprint 16)
- Nilvera mali mühür + GİB e-Arşiv başvuru onaylı (PetStockPro tarafı)
- KVKK aydınlatma metni: Nilvera + tüm sub-processor güncel
**Detay:** `PAYMENT-INTEGRATION.md §7.2 + §7.3`

---

## 18. Sprint 15 — Polish + Dokümantasyon (1 hafta)

**Hedef:** Bug fix + dokümantasyon güncellemesi + performans tweaks.

### Yapılacaklar

1. **Bug fix backlog (3 gün)**
2. **Performans audit (1 gün)**
   - Lighthouse her sayfa
   - Bundle analyzer
   - DB query optimizasyon
3. **KULLANIM-KILAVUZU.md tam revize (2 gün)** — pet shop sahibi için video eğitim
4. **API documentation (OpenAPI) (1 gün)**

---

## 19. Sprint 16 — Lansman + Kapalı Beta (1 hafta)

**Hedef:** 10-15 pet shop kapalı beta + production lansman.

### Yapılacaklar

1. **Production deploy (1 gün)**
   - Cloudflare Workers + OpenNext (veya Vercel)
   - Supabase Pro tier upgrade
   - Sentry production
   - Domain DNS production
2. **Beta tenant'lar onboarding (2 gün)**
   - 10-15 pet shop davet
   - Kişisel kurulum desteği
   - Geri bildirim toplama formu
3. **Monitoring + alerts (1 gün)**
   - Sentry alerts
   - Uptime monitor (UptimeRobot)
   - Slack/Telegram alerts
4. **PR + duyurular (1 gün)**
   - Twitter, LinkedIn
   - Pet shop forumları
   - Telegram pet shop grupları
5. **İlk hafta destek (2 gün)** — yoğun yanıt

### Verification

- ✅ Production sistemi çalışıyor
- ✅ 10-15 beta tenant aktif
- ✅ Sentry hata yok
- ✅ İlk gerçek satış kaydedildi

---

## 20. Faz 3 — Genişleme (Lansman Sonrası, Uzun Vade)

| Konu | Süre |
|---|---|
| Excel/CSV ürün import | 1 hafta |
| Barkod tarama (mobil PWA) | 2 hafta |
| Müşteri DB + Pet kartları | 2 hafta |
| Trendyol/Hepsiburada stok push | 3 hafta |
| AI talep tahmini (gerçek AI) | 4 hafta |
| Mobil native PWA → app store | 4 hafta |
| Garanti VPOS / Maximum BBVA | 2 hafta |
| Online satış (vitrin) — değerlendirme | TBD |
| Bayi Admin (multi-tenant viewer) | 2 hafta |
| ABC analizi + ek raporlar | 2 hafta |

---

## 21. Risk Yönetimi

| Risk | İhtimal | Etki | Karşı önlem |
|---|---|---|---|
| Tek geliştirici → süre aşımı | Yüksek | Yüksek | Sprint planı %20 buffer + browser-tested kalite tradeoff |
| Supabase free tier yetmez | Düşük | Orta | Pro tier $25/ay ile genişletme planı |
| iyzico entegrasyonu beklenenden uzun | Orta | Orta | Sandbox erken testing |
| Beta'da kritik bug | Orta | Yüksek | Sentry + hızlı hotfix capacity |
| Cloudflare Workers limit | Düşük | Orta | Long task'lar Supabase Edge Functions'a delegate |
| Tasarım sistemine direnç | Düşük | Düşük | Her ekran doc'unda detay var, sapma az |

---

## 22. Verification Test Senaryosu Sayıları

Toplam ~250 manuel browser test senaryosu:

| Ekran | Senaryo |
|---|---|
| AUTH | 10 |
| ISO (tenant + branch izolasyon) | 8 |
| PANO | 15 |
| PROD (Ürünler) | 30 |
| LDG (Stok Hareketleri) | 33 |
| CNT (Sayım) | 22 |
| BRN (Şubeler) | 20 |
| SUP (Tedarikçiler) | 14 |
| USR (Kullanıcılar) | 16 |
| RPT (Raporlar) | 14 |
| SET (Ayarlar) | 15 |
| SA (Süperadmin) | 19 |
| LOW (Düşük Stok) | 19 |
| VIT (Vitrin) | 23 |
| CC (Cross-cutting) | 15 |
| EDGE | 10 |
| **TOPLAM** | **283** |

Her sprint sonu ilgili senaryolar geçilir, PASS yoksa sprint kapanmaz.

---

## 23. Sıradaki Adım

✅ SPRINT-PLAN.md (bu doküman)
⏭ **Sprint 0 başlat** — proje skeleton kurulum

---

*Son güncelleme: 2026-05-14. 19 sprint (7 → 7a/7b/7c) × ortalama 1.42 hafta = **~24 hafta**. TR-only + 3-tier B karar uygulandı (Paddle kaldırıldı, Sprint 14 → 1 hafta). Browser-tested kalite garantisi.*
