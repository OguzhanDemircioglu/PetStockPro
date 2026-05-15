# PetStockPro — Claude Code Bağlam

> Bu dosya Claude Code'un proje bağlamını otomatik yüklemesi için. Yeni session'da `cd D:/Projeler/petstockpro && claude` başlatıldığında okunur.

---

## 🚨 #1 KURAL — TEK GELİŞTİRİCİ SİSTEMİ

> Bu proje **tek geliştirici** (Oğuzhan) tarafından yapılıyor. Tasarım, geliştirme, dağıtım, müşteri desteği, pazarlama — hepsi tek kişi. **Diğer tüm kararların üstünde** olan kuraldır.

**Her karar + öneri bu filtreden geçer:**

| Sor | Yanıt | Davranış |
|---|---|---|
| Tek kişi 1-2 günde yapabilir mi? | Hayır | Kapsamı azalt, Faz 2'ye sakla |
| 3. parti tool / hazır servis çözer mi? | Evet | Custom kod yazma, tool kullan (iyzico/Brevo/Sentry/Supabase) |
| Maintenance yükü nedir? | Yüksek | Sade tut, otomatize et |
| "İyi olur" mu, "zorunlu" mu? | İyi olur | MVP dışı, Faz 2'ye |
| 1.000 tenant'ta tek kişi yönetebilir mi? | Hayır | Self-service tasarla, manuel onay/destek YOK |

**MVP felsefesi:**
- Az feature, **kaliteli olanı bitir**. Yarım 10 özellik yerine tam 5 özellik.
- **3. parti tool > custom build** (iyzico/Brevo/Sentry/Cloudflare/Nilvera hazır kullan, yeniden icat etme)
- **Otomatize et** (pg_cron, Edge Functions, webhook, materialized view, ESLint rule)
- **Self-service tenant onboarding** — manuel onay queue ölçeklenmez. 1K pet shop'a manuel destek imkansız.
- "Sonra ekleriz" listesi **cömert tutulur**. MVP scope sade.

**Süperadmin felsefesi:** Operasyonel müdür değil, kişisel izleme + müdahale paneli. Otomatik onay + manuel istisna (1K tenant'a manuel onay imkansız).

**Bu kural ihlal edildiğinde projeyi öldürür:** Tek geliştirici fazla yük altında kalırsa motivasyon biter, kalite düşer, lansman gecikir. "İyi olur ama tek kişi yapamaz" özellikler **kesilir, tartışılmaz.**

---

## 🚀 YENİ SESSION'A GİRDİĞİNDE — İLK OKUMA SIRASI

**2026-05-14 chat'i 2 kapsamlı revizyon turu yaptı.** Bağlam büyük, dokümante edildi:

1. **`docs/DEVAM-REHBERI.md`** ⭐ — kararlar listesi + bekleyen açık noktalar (önce bunu oku!)
2. **`docs/MANTIK-HATALARI-2026-05-14.md`** 🆕 — **40 mantık hatası çözüldü** (4 tur: K1-5 + O1-8 + S1-6 + KT2-1/2/3 + OT2-1..6 + ST2-1..5 + YT-1..7). Tüm düzeltmeler doc'lara yansıtıldı, ✅ işaretli.
3. Bu CLAUDE.md (proje genel durumu)
4. `docs/PLAN-KADEMELERI.md` (**3-tier B — FREE 50 / PRO 500 750₺ / PRO+ ∞ 1.750₺, TR-only** — 2026-05-14 revize, otoritatif)
5. `docs/DATABASE-SCHEMA.md` (36 tablo MVP — 6 yeni: subscriptions/invoices/processed_webhooks/vitrin_reports/system_errors/vitrin_whatsapp_feedback; storefrontStatus enum; user_role JWT claim)
6. `docs/EKRAN-PUBLIC-VITRIN.md` (merkezi tek vitrin, hibrit fotoğraf moderation YT-1)
7. `docs/PAYMENT-INTEGRATION.md` (iyzico + Nilvera — Paddle Faz 2'de pasif, TR-only)
8. `docs/UI-MOCKUP-PLAN.md` (17 mockup brief)

**Önceki session hatalarını tekrarlama** — DEVAM-REHBERI §⚠ Dikkat Edilecekler.

### 🆕 Bu Chat'te (2026-05-14) Yapılan Büyük Değişiklikler — Özet

| Konu | Sonuç | Otoritatif Belge |
|---|---|---|
| **3-tier B + TR-only** | FREE 50/PRO 500 750₺/PRO+ ∞ 1.750₺, KDV dahil. Paddle Faz 2'de saklı. | `PLAN-KADEMELERI.md` |
| **Süperadmin URL kaldırıldı** | Tek `/admin` URL, role-based sidebar menü. SUPERADMIN role'lü kullanıcı ek menüleri görür. JWT `user_role='SUPERADMIN'` claim. | `EKRAN-SUPERADMIN.md` + `SUPABASE-SETUP.md` |
| **Net gelir tablosu** | 1K tenant × (%70 FREE / %25 PRO / %5 PRO+) = 275K₺ brüt, **~193K₺ net ≈ $6.400/ay**. iyzico "tahsilat ücreti" (POS işlem). B2C komisyon YOK. | `DEPLOYMENT.md §6.4` |
| **Pazar verisi (TR pet shop)** | TAM 5-15K, SAM 3-4K, SOM 500-1.500 tenant (2-3 yıl). %0-5 SaaS = YEŞİL ALAN. | `DEPLOYMENT.md §6.5` |
| **STAFF kasiyer rolü** | Yetki matrisi 5 rol × 18 yetki. STAFF sadece satış kaydeder + sayıma katılır. | `EKRAN-KULLANICILAR.md §12.5` |
| **DB tablo sayısı** | 30 → 34 (subscriptions + invoices + processed_webhooks + vitrin_reports). MANTIK-HATALARI K2/K5. | `DATABASE-SCHEMA.md §3.10 + §3.9.5` |
| **storefrontStatus enum** | 5 state (disabled/pending/approved/rejected/auto_suspended). Otomatik onay default. | `DATABASE-SCHEMA.md §3.1` |
| **Hibrit foto moderation** | Cloudflare Workers AI (LLaVA) "Satışa Aç"ta + vitrin_reports `wrong_photo` topluluk modlama. ~$2-5/ay maliyet. | `TECH-STACK.md §3.9b` + `EKRAN-URUNLER.md §5.5` |
| **Audit log** | enum → varchar(100), esnek pattern (`entity.action`). | `DATABASE-SCHEMA.md §3.5` |
| **KDV** | %18 → **%20** (TR 2024 sonrası). Pet mama %10 özel oran. | `EKRAN-AYARLAR.md §2.3` |
| **"İhracat Hazırla" → "Verilerimi İndir"** | KVKK veri taşıma hakkı, daha net terim. | `EKRAN-AYARLAR.md §2.6` |
| **PostGIS tek extension** | earthdistance kaldırıldı, ST_DWithin tutarlı index. | `DATABASE-SCHEMA.md §6` |
| **Supabase region: Frankfurt** (2026-05-14 onay) | `eu-central-1`. TR latency ~30-40ms. KVKK Madde 9 açık rıza akışı kayıt formunda zorunlu. | `DEPLOYMENT.md §2.3` + `SUPABASE-SETUP.md §0` |
| **Davet hibrit** (2026-05-14 onay) | Admin seçer: 📧 Email (7 gün TTL, Brevo otomatik — şube müdürü için) veya 🔗 Link (24 saat TTL, admin elden iletir — STAFF kasiyer için). `userInviteMethodEnum` + `invitedById` field eklendi. | `EKRAN-KULLANICILAR.md §4` + `DATABASE-SCHEMA.md §3.1` |
| **Backend dil/framework karar gerekçesi** (2026-05-15 C seçimi) | MVP: Next.js + Cloudflare Workers (mevcut). İleride 10K+ tenant'ta veya P95>500ms'de Strangler-Fig ile Go mikroservis extract. VPS asla. Re-evaluation tetikleyicileri dokümante. | `TECH-STACK.md §6` |
| **Monitoring & Observability Stratejisi** (2026-05-15) | 4 katman: CF Workers Analytics + Supabase Dashboard + Süperadmin KPI dashboard (zenginleştirildi) + Telegram alert. Grafana/Datadog YOK (süperadmin paneli yeterli). Sentry MVP'de opsiyonel, lansman sonrası 100+ event/gün olursa Team plan. Yeni tablo: `system_errors` (90 gün retention, RLS sadece SUPERADMIN). Süperadmin paneli §1.1-1.3 6 sistem KPI + business + operasyonel + real-time feed. | `DEPLOYMENT.md §8` + `EKRAN-SUPERADMIN.md §1.1-1.3` + `DATABASE-SCHEMA.md §3.5` |
| **WhatsApp Geri Bildirim Balonu** (2026-05-15 onay) | Müşteri vitrin'de WhatsApp tıkladıktan sonra sağ alt sticky balon (dış tıklama dismiss etmez). 5 emoji seçenek (😊/🙂/😐/😕/😞), **tek tıklama = submit** (submit butonu yok), yorum YOK (Faz 2). Counter felsefesi: closed_manually + dismissed bile değerli sinyal. Anti-spam: 1 IP × 1 tenant × 24h. Pet shop için funnel + rating dağılımı + ortalama puan. Süperadmin için tenant ranking + cevap hızı sorunu alert. Yeni tablo `vitrin_whatsapp_feedback` (1 yıl retention) + 2 enum + 4 yeni vitrinEvent type. Sprint 12'de implement (+1 iş günü = 14 iş günü). | `EKRAN-PUBLIC-VITRIN.md §15` + `DATABASE-SCHEMA.md §3.8.1` + `EKRAN-AYARLAR.md §2.1.1` + `EKRAN-SUPERADMIN.md §1.1` + `SPRINT-PLAN.md §15` |
| **EKRAN-AUTH.md + Cloudflare Turnstile** (2026-05-15 onay) | Yeni doc (15 bölüm + 52 test): Login + Register + Email Verification + Forgot Password + Email Change + 2FA Setup + Onboarding 3 adım + Account Lock + KVKK çift checkbox. **Cloudflare Turnstile** (Google reCAPTCHA değil — Workers native, KVKK temiz, $0). Register + Forgot Password + Change Email **zorunlu**, Login 5+ fail sonrası **conditional**. Email enumeration koruma + HIBP password check + 7 gün grace period + 24h email verify TTL + 30dk password reset TTL. users tablosuna 10 yeni field. Sprint 2: 1.5 → 2 hafta. | `EKRAN-AUTH.md` (yeni) + `TECH-STACK.md §3.9c` + `DATABASE-SCHEMA.md §3.1` + `DEPLOYMENT.md §1` + `EKRAN-AYARLAR.md §2.5` (sadeleşti, AUTH'a referans) + `SPRINT-PLAN.md §5` (2 hafta) + `UI-MOCKUP-PLAN.md §5.5` |
| **Brute-force sıkı policy** (2026-05-15 onay) | Önceki "10 başarısız → 15 dk" yetersiz görüldü, sıkılaştırıldı: **5 başarısız → 1 SAAT lock** + 3 art arda lock → 24 saat kalıcı + acil email. **Kalan hak UX:** 3. yanlıştan itibaren frontend banner ("3 hakkın kaldı" → "2 hakkın kaldı + Şifremi Unuttum" → "1 hakkın kaldı + lock uyarı"). 2. yanlışta banner yok (parmak hatası varsayımı). Şifremi Unuttum lock'u bypass eder. TOTP yanlışı sayılmaz. Test: 52 → 59. | `EKRAN-AUTH.md §2.2 + §2.3 + §10` + `EKRAN-AYARLAR.md §2.5.2` + `DATABASE-SCHEMA.md §3.1 users` |

**Geride bekleyen (sen-yapacak):**
- Şirket kuruluş + vergi no + IBAN (lansman bloker, 2-4 hafta)
- Supabase Pro tier $25/ay abonelik (lansman öncesi)
- Pricing pilot anketi (30-50 pet shop)

**Sıradaki olası işler:**
- Sprint 0 bootstrap (Next.js + Supabase + Drizzle + Auth.js skeleton)
- urunler.html v4 stiline taşıma (ertelendi — pano.html zaten v4)
- ~~4. tur mantık hata taraması~~ ✅ **Tamamlandı 2026-05-14** — 5 yayılım hatası bulundu/düzeltildi (YT-3 KDV seed / YT-4 5→6 rapor / YT-5 notification UI / YT-6 dış servis / YT-7 2-tier kalıntı), `MANTIK-HATALARI-2026-05-14.md §4. Tur`
- super-admin.html 2-tier mockup → 3-tier B'ye güncelle (YT-7'nin mockup tarafı)
- Yeni mockup'lar UI-MOCKUP-PLAN.md sırasıyla (17 mockup)

---

---

## 🎯 Proje Özeti

**PetStockPro** = Pet shop'lar için çok-kiracılı (multi-tenant) **stok takip + satış kaydı SaaS** platformu.

- **Domain:** petstockpro.com (Cloudflare DNS, alındı)
- **Eski proje:** `D:/Projeler/Pet/` (PetToptan marketplace, legacy referans — yeni projeyle kod paylaşmıyor)
- **Yeni proje:** `D:/Projeler/petstockpro/` (sıfırdan, TS stack)

## 🚀 Şu Anki Durum: Sprint 2.6 Tamamlandı (2026-05-15)

**Branch:** `cray61` — **17 commit ahead of origin** (push edilmedi, kullanıcı kararı bekliyor)
**Test:** 380 passed (24 dosya, vitest)
**Lint + typecheck:** 0 error
**Seed:** 81 il + 974 ilçe Supabase Frankfurt'a aktarıldı (Pet/ legacy → turkey-locations.ts)

### ✅ Tamamlanan Sprint'ler

| Sprint | Commit | İçerik |
|---|---|---|
| 0 bootstrap + hardening | 94b657b + aaeef4c | Next.js 16 + Drizzle + Auth.js + Tailwind v4 + vitest + 38 test |
| 0 RLS baseline | (MCP) | 5 tablo RLS enabled, cities/districts public read |
| 1A | a19b27b | Payment+audit schema (subscriptions/invoices/processed_webhooks/audit_logs) + 16 test |
| 13 iyzico foundation | 4bd0cb0 | iyzipay@2.0.67 + config + client + Zod types + 19 test |
| 13 iyzico operations | f7e0621 | subscription create/retrieve/cancel + webhook (signature+parse+eventId) + 36 test |
| 14 Nilvera | c9092bd | HTTP client + retry + invoice create/retrieve/cancel + webhook + 51 test |
| 2 Auth foundation | 3fdfccd | password (bcryptjs+HIBP) + brute-force + authorize + Auth.js full config + LoginPage React + browser test |
| 2.2 Register | 33a5969 | registerNewTenant + RegisterPage + KVKK çift checkbox + 14 test + browser test |
| 2.3a Email verify foundation | 4937317 | email-verification helper + Brevo client + templates + 42 test |
| 2.3b Verify UI | e224ef9 | Schema migration (users +4 field) + register Brevo entegrasyon + /verify-email + /verify-email/[token] + browser test |
| 2.4 Forgot/Reset Password | (yeni) | Schema migration 0003 (users +2 field) + password-reset helper (timing-safe, 30dk TTL) + forgot-password action (enumeration koruma, generic 200) + reset-password action (HIBP + failedLoginCount/lockedUntil reset) + /forgot-password + /reset-password/[token] page (server token check + client form) + passwordChanged Brevo template + Brevo mock URL log helper (dev kolaylığı) + 34 test (10 helper + 6 forgot + 10 reset + 8 template) + browser full flow doğrulama |
| 2.5 2FA TOTP | (yeni) | Schema migration 0004 (users +5 field: secret + recoveryCodes jsonb + enabledAt + setupSecret + setupExpiresAt) + otpauth@9.5 + qrcode@1.5 paketleri + two-factor helper (generateSecret/buildOtpAuthUri/verifyTotp/generateRecoveryCodes 8 ABCD-EFGH/hashRecoveryCode SHA-256/verifyRecoveryCode timing-safe + tek-kullanımlık) + two-factor-setup orchestration (initSetup 10dk TTL + verifySetup + enable + disable) + custom AuthErrors (TwoFactorRequiredError + TwoFactorInvalidError code field) + authorize.ts TOTP step (şifre doğru sonrası 2FA enabled ise totp gerekli; recovery code dahil) + /2fa-setup 3-adım wizard (QR + manuel secret + 6haneli verify + recovery codes ekranı + clipboard/print) + login page TOTP step (requires2fa banner + readOnly email persist) + 53 test (33 helper + 14 setup + 6 authorize 2FA) + browser full flow (login → 2fa-setup → QR/secret → TOTP verify → recovery codes → enable → logout → login → 2fa banner → TOTP/recovery code login → kullanılmış recovery reject) |
| 2.6 Onboarding + Cities/Districts Seed | (yeni) | Pet/ legacy turkeyDistricts.ts taşındı (src/db/seed/turkey-locations.ts) + makeSlug shared util (src/lib/utils/slug.ts) + seed script (db:seed npm command) 81 il + 974 ilçe Supabase'e idempotent insert + lib/onboarding/actions (createFirstBranch + saveStorefront + completeOnboarding) + /onboarding 2-adım wizard (şube zorunlu: ad+il+ilçe+adres+WA + vitrin opsiyonel: slug edit veya skip) + /api/locations/districts route (cityId → districts JSON) + / sayfasında auth+onboarding gate (onboardingCompletedAt NULL → /onboarding redirect) + 12 test (createFirstBranch 6 + saveStorefront 5 + completeOnboarding 1) + browser full flow (login 2FA → /onboarding → İstanbul/Kadıköy şube + slug → /?onboarding=complete → / direct artık) — **NOT:** "İlk ürün" 3. adım Sprint 1B sonrası (products tablosu yok) |

### 🛠 Stack Çalışan Durumda

- **DB:** Supabase Frankfurt EU (`rjzhnfqrynalklsnnuym`), 9 tablo, 5 migration, hepsi RLS enabled, **cities (81) + districts (974) seed edildi**
- **Auth flow MVP:** /login (+ 2FA TOTP) + /register + /verify-email + /verify-email/[token] + /forgot-password + /reset-password/[token] + /2fa-setup + /onboarding (2 adım) — tümü browser end-to-end geçti
- **Onboarding flow:** Register → verify → login → /onboarding (otomatik redirect) → şube + opsiyonel vitrin → / dashboard
- **Sandbox-ready integrations:** iyzico + Nilvera + Brevo (key gelince aktif)
- **Memory:** test-first + ödeme integrity + sorusuz akış kuralları memory'de kayıtlı

### ⏭ Sıradaki — Yeni Session

| Sprint | İçerik | Tahmin |
|---|---|---|
| **2.7** | Account locked page + 2+ remaining banner + brute-force UX (5 fail → 1h lock + email + Telegram) | 1-2 saat |
| 2.8 | Settings > Security: 2FA disable + recovery code regenerate (Sprint 9 settings'le birleşebilir) | 1 saat |
| 1B | products + variants + branch_inventory + categories + brands + suppliers schema + 36 tablo komple | 3-4 saat |
| 1B+ | Onboarding'e "İlk ürün" 3. adımı ekle (products tablosu hazır olunca) | 30 dk |
| 14 sonu | Billing orchestrator (iyzico webhook → DB transaction → Nilvera invoice → audit) | 2-3 saat |
| 14 sonu | E2E mock flow test (webhook → DB → invoice complete) | 1 saat |

### 🔑 Bekleyen User Bloker

- iyzico sandbox + production API key (kullanıcı canlıya çıkmadan verecek)
- Nilvera API key + mali mühür sertifikası (şirket kuruluş sonrası)
- Brevo API key (production transactional email)
- Supabase Pro tier upgrade ($25/ay, lansman öncesi)

Hiçbiri Sprint 2.7 için bloker değil — devam edilebilir.

## 🆕 2026-05-14 Karar Revizyonu (TR-only + 3-tier B geri açıldı) — OTORİTATİF

> **Önceki 2026-05-13 "2-tier (FREE 50 / PRO ∞), PRO+ rafa" kararı İPTAL.** Yeni karar:

1. **3-tier (FREE / PRO / PRO+) geri açıldı** — *"FREE, PRO, PRO+ — sadece stok sayısına insanların artırmalarını istiyorum."*
   - **FREE 50 ürün** (0 ₺) — denemelik, mahalle pet shop
   - **PRO 500 ürün** (750 ₺/ay KDV dahil) — orta segment, esas pazar
   - **PRO+ Sınırsız** (1.750 ₺/ay KDV dahil) — büyük zincirler
   - Tek farklılaşma stok limiti — diğer tüm özellikler (vitrin, çoklu şube, audit, 2FA, asistan, raporlar, Nilvera e-Arşiv) tüm planlarda açık
   - PRO+ özellikleri (custom domain, custom CSS, API, white-label, öncelikli destek) **YOK** — proje kapsamı dışı kalıyor
   - Bkz. `PLAN-KADEMELERI.md` (otoritatif belge, tamamen yeniden yazıldı)

2. **TR-only** — *"Şimdilik sadece TR'de kullanılacak."*
   - Paddle MoR (yurt dışı ödeme) **kaldırıldı** — proje kapsamı dışı
   - KVKK Madde 9 yurt dışı veri aktarım açık rıza akışı **kaldırıldı**
   - GDPR cookie banner ek **kaldırıldı** (sadece KVKK opt-out)
   - EN locale **gizlendi** (next-intl yapısı kalır, Faz 2'de açılabilir)
   - Frankfurter kur API **kaldırıldı**
   - Vitrin EN currency disclaimer **kaldırıldı**
   - Sprint 14 sadeleşti: sadece Nilvera (Paddle yok)

3. **Net gelir yeniden hesaplandı** (3-tier B kompozisyonu, 1K tenant):
   - %70 FREE × 0₺ + %25 PRO × 750₺ + %5 PRO+ × 1750₺ = **275.000 ₺/ay brüt**
   - Net (vergi sonrası): **~193.000 ₺/ay ≈ $6.400/ay** — önceki realist $1.560'tan 4× iyi
   - Bkz. `DEPLOYMENT.md §6.4`

---

## 🆕 2026-05-13 Kararlar (Geçmiş — Bazıları 2026-05-14'te revize edildi)

Tartışmadan çıkan kararlar dokümanlara entegre edildi. **Önceki PetStockPro tasarımı (2026-05-12) bu kararlarla revize edildi.**

> ⚠ Aşağıdaki #1 (PRO+ rafa) kararı **2026-05-14'te iptal edildi** — yukarıdaki "Karar Revizyonu" bölümüne bakın.

### Büyük yapısal değişiklikler

1. **PRO+ tier RAFA kaldırıldı** ⚠ *İPTAL 2026-05-14* — *"PRO+ planını şimdilik rafa kaldıralım, satış olmasın, sadece stok takip uygulaması olarak ilerleyelim."*
   - ~~Önceki 20/100/sınırsız (3-tier) → **YENİ: FREE 50 / PRO sınırsız (2-tier)**~~
   - **2026-05-14 revize:** 3-tier B (FREE 50 / PRO 500 750₺ / PRO+ ∞ 1.750₺) geri açıldı
   - Bkz. `PLAN-KADEMELERI.md`

2. **Vitrin yapısı: Tenant subdomain → Merkezi tek vitrin** — *"Tek bir vitrin var, her kullanıcının ortak kullandığı tek bir vitrin var."*
   - Önceki tasarım: `{slug}.petstockpro.com` (her pet shop kendi mini sitesi, Shopify-Lite modeli) → **İPTAL**
   - **YENİ:** `petstockpro.com/vitrin` merkezi tek dizin (Sahibinden / Yelp / Google My Business modeli)
   - Müşteri Google'dan gelir → cross-tenant kıyaslama → en yakın pet shop seçer → 📞 WhatsApp deep link
   - **Custom domain YOK, custom CSS YOK** (PRO+ ile birlikte rafa)
   - Bkz. `EKRAN-PUBLIC-VITRIN.md` (yeniden yazıldı)

### Yeni özellikler (entegre edildi)

3. **Stok 0 → vitrin'den otomatik çekme** — Stok 0 olunca `vitrin_published = false` + Telegram bildirim. Manuel "Satışa Aç" toggle ile geri açılır (otomatik açılmaz). Bkz. `EKRAN-URUNLER §5.6`, `DATABASE-SCHEMA §5.5`.

4. **"Satışa Aç" toggle + "Doğrula" validation gate** — Ürünler tablosunda her satırda toggle. Açılırsa backend validation: en az 1 görsel + makul fiyat (1₺-50000₺) + ad + kategori + tenant vergi no. Hepsi pass → "Doğrula" enabled → vitrin'e çıkar. Bkz. `EKRAN-URUNLER §5.5`.

5. **Vergi numarası kayıtta opsiyonel** — Kayıt formunda sorulmuyor. "Satışa Aç" toggle tetikleyici → modal. Sadece stok takip için kullanan tenant'a vergi no zorunlu değil, ASLA otomatik askıya alınmaz. Bkz. `EKRAN-AYARLAR §2.1`, `PLAN-KADEMELERI §3.1`.

6. **Cities + Districts backend tabloları** — Frontend mevcut `client/src/data/turkeyDistricts.ts` (eski Pet/ projesinden) Supabase'e seed edilir. 81 il + ~970 ilçe. Mahalle YOK (ilçe yeter). SEO URL: `/vitrin/[il]/[ilce]/[kategori]`. Companies + branches `city_id`, `district_id` FK. Bkz. `DATABASE-SCHEMA §3.7`.

7. **Bayi Admin rolü** (Faz 3) — Multi-tenant read-only viewer. Aynı kişinin/işbirliğinin birden fazla pet shop tenant'ı varsa tek dashboard'da izleme. İki taraflı onay + ayrı user hesabı. MVP'de schema+enum hazır, UI Faz 3'te. Bkz. `DATABASE-SCHEMA §3.9`, `PLAN-KADEMELERI §3.2`, `EKRAN-SUPERADMIN §2.5.4`.

8. **Vitrin Modlama** süperadmin paneli 4. sekmesi — Başvurular / Bildirimler / Otomatik Filter / Bayi Admin (Faz 3). Bkz. `EKRAN-SUPERADMIN §2.5`.

### Ek netleştirmeler

- **Telegram entegrasyonu rolü:** ADMIN bildirim kanalı (sistem → pet shop sahibi). Müşteriyle hiç temas yok. Müşteri vitrin'de WhatsApp deep link kullanır. Bkz. `TECH-STACK §3.8`.
- **WhatsApp deep link:** Biz WhatsApp Business API kullanmıyoruz. `wa.me/...` deep link açılır, müşteri mesajı kendisi gönderir. Ücretsiz, KVKK yok, biz aracı değiliz.
- **PostGIS + pg_trgm + moddatetime + unaccent + earthdistance + pg_jsonschema extensions** Supabase'te aktive edilecek (Sprint 0). Bkz. `SUPABASE-SETUP.md §1.2`.

### Etkilenen tablolar

- `companies` → `vat_no` opsiyonel, `city_id` + `district_id` FK, `whatsapp_phone`, `vat_required_at`
- `branches` → `city_id` + `district_id` FK, `whatsapp_phone` opsiyonel
- `products` → `vitrin_published`, `vitrin_published_at`, `vitrin_auto_unpublished_at`, `vitrin_auto_unpublished_reason`
- **Yeni tablolar:** `cities` (81 seed), `districts` (~970 seed), `vitrin_events` (metrikler), `bayi_admin_relations` (Faz 3)
- `planEnum` → `FREE`, `PRO` (PRO_PLUS kaldırıldı)
- `userRoleEnum` → `BAYI_ADMIN` eklendi (Faz 3)
- **Toplam MVP tablo: 26 → 30**

### Etkilenen Sprint Plan

- **Sprint 0:** Cities/Districts seed + PostGIS extensions ek (yarım gün ek)
- **Sprint 12:** "Public Vitrin (subdomain)" → "Merkezi Vitrin Dizini" yeniden tanımlandı
- **Sprint 14:** Paddle + Nilvera (Custom Domain kapsamdan çıkarıldı)
- **Faz 3:** Bayi Admin (multi-tenant viewer)

### Kalan iş

- `preview/vitrin.html` legacy mockup (tenant subdomain modeli) — yeni merkezi vitrin için yeni mockup gerekir Sprint 12 öncesi
- Sprint 0 başlatma — Next.js + Supabase + Drizzle + Auth.js + shadcn/ui skeleton

## 🤔 2026-05-14 Açık Stratejik Kararlar (lansmandan önce netleşmeli)

Aşağıdakilerin hepsi **teknik değil ticari/stratejik** kararlar — Sprint 16 lansman öncesi netleşmesi gerek.

### Karar A — PRO Upsell Motivasyonu

**Sorun:** Vitrin tek tema, eşit görünüm. FREE 50 kullanıcı PRO'ya neden yükselsin? Sadece "50 ürünü geçtim" diye → ince motivasyon.

**Seçenek:**
- (a) Olduğu gibi bırak — "ürün limiti yeter" yeterli motivasyon, sade tut
- (b) PRO'ya küçük avantaj ekle: "✓ Onaylı PRO Üye" rozeti vitrin profilinde + sıralama bonusu (~5%)
- (c) Vitrin'de "Sponsored" özelliği aç (PRO ürünleri haftada 1 kez öne çıkar) — ama "rekabet eşit" felsefesini bozar

**Aday:** (b) küçük avantaj — eşit rekabet bozulmaz ama PRO için somut görünür değer

### Karar B — WhatsApp Tıklama → İlgi Ölçümü Atfı

**Sorun:** Pet shop "47 tıklama, 12 ilgi dönüşümü" karşılaştıramaz çünkü WhatsApp atan müşteri pet shop'a "vitrin'den geldim" demiyor.

**Seçenek:**
- (a) **Olduğu gibi bırak** — pet shop disiplini ile takip eder, biz sadece tıklama veriyoruz (en sade)
- (b) WhatsApp deep link mesajına nötr **"Vitrin referans kodu: PSP-A4F7"** ekle → pet shop o kodu Stok Çıkışı drawer'ında "Vitrin Referans" alanına girince ilgi dönüşümü tag'lenir

**ÖNEMLİ NOT (2026-05-14):** Önceki taslakta "Sipariş kodu" denmişti, **revize edildi → "Vitrin referans kodu"**. "Sipariş" sözcüğü yanıltıcı çünkü **biz sipariş almıyoruz** (bkz. EKRAN-PUBLIC-VITRIN §13.4 Para Akışı). Sadece "WhatsApp tıklama → pet shop'un kendi defterindeki satış" eşleştirmesi için iz tag.

**Aday:** (a) **Olduğu gibi bırak** — sade tut, fazla mühendislik. Vitrin metrikleri sadece tıklama gösterir, pet shop disiplini ile gerçek satışı karşılaştırır. Böylece "sipariş" kelimesi vitrin tarafında hiç görünmez, para akışı çizgisi net kalır.

**(b) seçenek istersen Faz 2'de eklenebilir** — küçük UX, opsiyonel kullanım.

### Karar C — Pricing + Hedef (Gelir Hedefi)

**Sorun:** 1K tenant × %5 PRO × 500₺ = 25K₺/ay (~$833) → maliyet sonrası net $500 → tek geliştirici geçim parası bile değil.

**Seçenek:**
- (a) Pricing yükselt — PRO 500₺ → 1000-1500₺ (sade FREE/PRO yapısında PRO'da daha çok değer pozisyonlama)
- (b) Hedef büyüt — 5-10K tenant (Türkiye geneli pazarlama yatırımı)
- (c) Kombine — orta pricing (750₺) + makul hedef (5K tenant) = ~$6K/ay net

**Realite:** Türkiye'de 10-15K aktif pet shop var (sektör tahmin). %5 conversion'la 5K tenant kazanmak = %33 pazar penetrasyonu = 2-3 yıl iş ama mümkün. Bu **Sprint 16 lansman öncesi** kullanıcı kararı verecek — şimdi karar şart değil.

### Süperadmin Felsefe Netleştirme (uygulandı 2026-05-14)

Süperadmin **operasyonel müdür değil**, site sahibinin **kişisel kontrol/müdahale paneli**:
- ✅ İzleme (tenant'lar, audit, sistem sağlığı)
- ✅ Acil müdahale (hard delete, plan limit override, sayım geri al, şifre/2FA reset, eksi stok zorlama)
- ✅ Tenant'a girme (impersonation — "ekrandan bakıp yardım et")
- ❌ **Operasyonel onay süreçleri YOK** — vitrin başvuru artık **otomatik onay** (validation pass = anında aktif), sadece otomatik reddedilenler süperadmin'e düşer (manuel inceleme alt-sekme)

EKRAN-SUPERADMIN.md §2.5 yeniden yazıldı — Vitrin Modlama 5 alt-sekme (Manuel İnceleme / Bildirimler / Otomatik Filter / Onay Logları / Bayi Admin Faz 3).

---

## 📁 docs/ Dizini Haritası

| Dosya | İçerik |
|---|---|
| `TECH-STACK.md` | Next.js 16 + Supabase + Drizzle + Auth.js v5 + shadcn/ui + Cloudflare Workers |
| `TASARIM-SISTEMI.md` | Verdana font + 5 logo paleti + glass + mesh + paw + hayvan mascot |
| `MARKA-VARLIKLARI.md` | Logo + favicon + OG image + e-posta template |
| `PLAN-KADEMELERI.md` | **3-tier B (2026-05-14): FREE 50 / PRO 500 750₺ / PRO+ ∞ 1.750₺, TR-only** — tek farklılaşma stok limiti |
| `DATABASE-SCHEMA.md` | 26 tablo + Drizzle TS + RLS politikaları + trigger'lar + index'ler |
| `SPRINT-PLAN.md` | 19 sprint × ~24 hafta (Sprint 7 → 7a/7b/7c) |
| `DEPLOYMENT.md` | Cloudflare Workers + OpenNext + Hyperdrive (custom domain YOK — kapsam dışı) |
| `SUPABASE-SETUP.md` | `petstockpro` schema kurulumu + RLS helper functions |
| `SUPERADMIN-YETKILERI.md` | **4 kategori yetki + Toolbox FAB** (sistem bypass / DB fix / sistem config / uzak kullanıcı) |
| `EKRAN-PANO.md` | Hero + Bento + PetPro Asistanı + Activity Feed (Realtime) |
| `EKRAN-URUNLER.md` | Variant + plan limit + 8 form bölümü + bulk actions |
| `EKRAN-STOK-HAREKETLERI.md` | Immutable ledger + 4 drawer + R1 (24h geri alma) + R3 (basit audit) |
| `EKRAN-DUSUK-STOK.md` | R6 sade-tut + sıralı drawer akışı |
| `EKRAN-SAYIM.md` | Drawer + tam-sayfa workflow + yumuşak kilit (Realtime) |
| `EKRAN-SUBELER.md` | Kart grid + harita opsiyonel (R5 lazy) |
| `EKRAN-TEDARIKCILER.md` | CRUD + soft delete |
| `EKRAN-KULLANICILAR.md` | Davet + rol + 2FA + aktif oturum |
| `EKRAN-RAPORLAR.md` | 5 rapor (hibrit: kart grid + drilldown) |
| `EKRAN-AYARLAR.md` | 6 bölüm sol-sidebar Stripe pattern |
| `EKRAN-SUPERADMIN.md` | 3 sekme + impersonation + **Toolbox FAB** |
| `EKRAN-PUBLIC-VITRIN.md` | **Merkezi tek vitrin** (`petstockpro.com/vitrin` Sahibinden modeli) + cross-tenant kıyaslama + 23 test |
| **`PAYMENT-INTEGRATION.md`** ⭐ | **iyzico (TR) + Nilvera (e-Arşiv) + Paddle (yurt dışı) entegrasyon + KVKK/GDPR/sözleşme uyum + lansman checklist** (yeni 2026-05-14) |
| **`UI-MOCKUP-PLAN.md`** ⭐ | **Tüm 17 mockup brief + öncelik + tool karar + prompt şablonu** (yeni 2026-05-14) |
| **`DEVAM-REHBERI.md`** 🚀 | **YENİ SESSION BAŞLANGIÇ NOKTASI — 13 açık nokta + bekleyen kararlar + sıradaki adımlar** (yeni 2026-05-14) |

## 📁 preview/ Dizini (Browser'da Çalışan)

| Dosya | Boyut | Açıklama |
|---|---|---|
| `pano.html` | 127KB | Admin Pano (mockup-v3 + topbar'da 🌐 vitrin linki) |
| `urunler.html` | ~120KB | Admin Ürünler (variant, plan limit, bulk, detay drawer) |
| `stok-hareketleri.html` | ~134KB | Admin Ledger + 4 drawer önizleme |
| `super-admin.html` | ~117KB | Süperadmin (3 sekme + **Toolbox FAB açık örnek**) |
| `vitrin.html` | ~85KB | **Tenant müşteri-facing vitrin** (12 ürün + 3 şube + iletişim + WhatsApp FAB) |
| `logo.png` | 1.5MB | PetStockPro logo |

## 🔑 Önemli Kararlar (Hatırlat)

1. **Tech stack:** Next.js 16 + Supabase + Drizzle + Auth.js v5. **Eski Pet/server (Java/Spring) kodu KULLANILMIYOR** — sıfırdan TS.
2. **Plan limitleri:** **3-tier B (2026-05-14): FREE 50 / PRO 500 750₺ / PRO+ ∞ 1.750₺ — TR-only.** Tek farklılaşma stok limiti. Diğer tüm özellikler her planda açık. 2026-05-13 "2-tier, PRO+ rafa" kararı iptal edildi.

2.5. **🚨 PARA AKIŞI ÇİZGİSİ (DEĞİŞMEZ — 2026-05-14):** Alıcı (müşteri) ile satıcı (pet shop) arasındaki para alışverişine **PetStockPro ASLA dahil değildir.** Bizim rolümüz sadece WhatsApp deep link açmak (dizin/yer sağlayıcı). Online sipariş YOK, sepet YOK, ödeme aracılığı YOK, komisyon YOK, kargo entegrasyonu YOK. Detay: `EKRAN-PUBLIC-VITRIN.md §13.4`. Bu çizgi yasal güvenlik (ödeme kuruluşu lisansı, sub-merchant, ETBİS aracı, KKDF) için kritik.
3. **Tipografi:** **Verdana saf** (sistem font, kullanıcı tercihi). mockup-v3'teki Plus Jakarta + Fraunces değil.
4. **Geri alma:** R1 — tek katman (24 saat herkes + SUPERADMIN süresiz).
5. **Audit:** R3 — basit JSON log, hash chain YOK.
6. **Marketplace:** YOK — biz sipariş alıp ödeme almıyoruz. Vitrin = bilgi sayfası, sipariş için WhatsApp/Telegram/telefon.
7. **PetPro Asistanı:** MVP'de aktif (rule-based, AI değil) — Sipariş/Transfer/İndirim önerisi.
8. **Süperadmin:** Sadece "tenant gibi davranan" değil — **4 kategori süper yetki** (bypass + DB fix + sistem config + uzak kullanıcı), Toolbox FAB ile.
9. **Deploy:** Cloudflare Workers + OpenNext. Domain: petstockpro.com.
10. **Realtime:** MVP'den itibaren Supabase Realtime (Pano feed, Sayım kilidi).

## 🤔 Açık Kalan Tasarım Sorusu

**Pet Shop Dizini** (`petstockpro.com/magazalar`): B2C kullanıcılar (pet ürünü almak isteyenler) `petstockpro.com`'a girince ne görüyor?

- Şu an: Sadece SaaS landing fikri var (henüz mockup yok)
- Önerilen: **Dual CTA Hero** — "🐾 Ürün arıyorum" → tenant dizini · "🏪 Pet shop sahibiyim" → SaaS landing
- Tenant dizini: Şehir filtresi + WhatsApp direkt link + harita (Faz 2)
- "Marketplace YOK" kararıyla uyumlu (sadece rehber, sipariş bizden geçmez)

Bu karar **Sprint 0 öncesi netleştirilmeli** veya Sprint 12'ye saklanmalı.

## 🛠 Sprint 0 Plan

`SPRINT-PLAN.md §3` detayında:

1. Repo + git init (zaten klasör var)
2. `npx create-next-app@latest . --typescript --tailwind --app --src-dir --turbopack`
3. Bağımlılıklar (~30 paket): Auth.js, Drizzle, Supabase, shadcn/ui, TanStack Query, Zustand, next-intl, Recharts, Leaflet, Vitest, Playwright, axe, Sentry, Brevo
4. Supabase Dashboard'da `petstockpro` schema yarat (`SUPABASE-SETUP.md §1.2` SQL)
5. Drizzle config + connection test
6. Auth.js v5 + Drizzle adapter
7. Tailwind v4 + shadcn/ui init + tasarım sistemi tokenları
8. Logo + favicon assets
9. next.config.ts (i18n + image domains + CSP)
10. GitHub Actions CI
11. İlk commit: `chore: bootstrap PetStockPro skeleton`

## 👤 Kullanıcı Tercihleri

- Tüm konuşma **Türkçe**
- Auto mode kullanılabilir, ama kritik kararlarda sor
- Detaylı, sistematik yaklaşımı sever (eksiklik raporu, alternatif sunumu)
- "Acelemiz yok" — kalite öne
- Tasarım disiplini: dokümante et, sonra implement et

## ⚠ Hatırlatma

- `.env` dosyasında **Supabase credentials yüklü** — asla commit etme (.gitignore'da)
- Eski Pet/ klasörü legacy referans, kod kopyalanmıyor
- Süperadmin Toolbox FAB Sprint 7b'de implementation (Sprint 7 → 7a/7b/7c bölündü, 4 hafta)
- Cloudflare Workers'da `jsonwebtoken` çalışmaz → `jose` kullan; `bcrypt` → `bcryptjs`

---

*Son güncelleme: 2026-05-13. Sprint 0 başlamadan önce son kontroller.*
