# PetStockPro — Yeni Session Devam Rehberi

**Tarih:** 2026-05-16 (Sprint 7b TAM + Sprint 7c parça 1+2: Uzak kullanıcı + DB Inspector)
**Mevcut Branch:** `cray61` — origin'in 14+ commit ileri (push edilmedi)
**Durum:** ✅ **Sprint 0-15 büyük kısmı tamamlandı + Sprint 7a tam + Sprint 7b TAM + Sprint 7c parça 1+2 (uzak kullanıcı + DB Inspector).** 836 test, 11 migration, 0 lint+typecheck error.

## 🚦 YENİ SESSION BAŞLANGIÇ — KALDIĞIN YER

**Sprint 7b TAMAMLANDI — 6/6 Bypass aksiyonu + Toolbox FAB committed.**

| Bypass | Durum | Commit |
|---|---|---|
| Foundation (verifyBypassGuard + writeBypassAudit + 10 test) | ✅ | `7b31adf` |
| Toolbox FAB component + admin layout entegrasyon | ✅ | `075fee0` |
| **1. Reverse expired** (24h+ hareket geri al + 1 yaprak) | ✅ + browser E2E | `a837b6c` |
| **2. Hard delete ürün** (6 test + browser E2E reject + happy) | ✅ + browser E2E | `92665dc` |
| **Disk doluluğu + top 8 tablo grafiği** (süperadmin sayfa) | ✅ + browser E2E | `b9822cf` |
| **3. Eksi stoğa zorla giriş** (8 test, sayfa+form+action hazır) | ✅ + browser E2E | `8507e4a` |
| **4. Plan limit override** (10 test, sayfa+form+action hazır) | ✅ + browser E2E | `b349e54` |
| **5. Sayım rollback** (10 test + allowNegative bypass + sayfa) | ✅ + browser E2E | `f26e8d0` |
| **6. Movement metadata düzelt** (14 test + 4 alan diff UI) | ✅ + browser E2E | `fba0f5b` |

### Bypass 3 browser smoke ✅ TAMAMLANDI (2026-05-16)

`/admin/superadmin/bypass/negative-stock` browser E2E doğrulandı:

- Form: Şube=0c1f5aad / Variant=a956cf52 (Catit Pixi XL Boy) / Düşür=60 / Sebep="Muhasebe kaydı düzeltmesi — fiziksel-sistem uyumsuzluk düzeltiliyor" / Şifre=TestPass123!
- Submit → success banner "✓ Negatif stok hareketi yazıldı · Önce: 53 → Sonra: -7"
- Ledger sayfası: 16/05 03:49 satır "Çıkış · Diğer · Catit Pixi XL Boy · Merkez Şube · ÖNCE 53 / Δ -60 / SONRA -7 · Notlar: Süperadmin bypass: eksi stok zorla — Muhasebe kaydı düzeltmesi"
- Audit log sayfası: `superadmin.bypass.negative_stock` 🔒 Süperadmin · sprint3prod@petshop.com · stock_movement (f15fc882) · afterState={"stockQty":-7,"quantityRemoved":60}

Screenshot timeout sorunu: stale .next cache, server stop + `rm -rf .next` + preview_start ile çözüldü (memory'deki kural).

### ✅ Bypass 1-6 TAMAMLANDI

### Sprint 7c — Uzak Kullanıcı Yönetimi (parça 1 / 3) ✅ committed

`/admin/superadmin/user/[id]` sayfası — tenant detay sayfasından "⚙ Yönet" linkiyle ulaşılır.

3 aksiyon (her biri şifre re-auth + zorunlu sebep + audit `superadmin.remote.*` + Telegram alert):
- ✅ **Şifre sıfırlama linki gönder** (Brevo email 30dk TTL, password reset token üret)
- ✅ **2FA sıfırla** (twoFactorEnabled=false + secret/recoveryCodes temizle + Telegram critical)
- ✅ **Hesap kilitle / kilidi aç** (lockedUntil 1..720h + lockedReason='SUPERADMIN' + Telegram critical/info)

Browser E2E: sprint27lock@petshop.com hedef → şifre reset linki ✓ banner / 2h hesap kilit → revalidate UI lock→unlock form switch → kilit aç → revalidate → lock form geri. Audit log'da 3 entry `bypass` damgalı görsel doğrulandı.

### Sprint 7c — DB Inspector (parça 2 / 3) ✅ committed

`/admin/superadmin/db-inspector` SELECT-only güvenli SQL runner — Toolbox FAB'a 🔬 link eklendi.

- ✅ **validateSelectQuery** — pure validator (SELECT/WITH only + chain `;` reject + 20 forbidden keyword word-boundary regex)
- ✅ **runInspectorSelect** — postgres connection (statement_timeout 5sn, subquery LIMIT 101, truncated flag)
- ✅ **Action** — her query (success + failure) audit log'a yazılır (`superadmin.dbinspector.query_run` / `.query_failed`)
- ✅ **UI** — sql textarea + Çalıştır + result table (id/email/role+) + 6 hazır preset query (kullanıcılar/tenant'lar/hareketler/audit/negatif stok/ürün count)

Browser E2E: SELECT happy 4 satır 378ms / DROP TABLE reject "Sadece SELECT veya WITH (CTE)" / Chain attack `SELECT 1; DROP TABLE` reject "Tek statement" / 5 audit log entry (3 failed + 1 success) görsel doğrulandı.

Bug fix: Drizzle template literal SET statement_timeout parametre binding kabul etmiyor → `sql.unsafe('SET statement_timeout = 5000')`. Query'de zaten LIMIT varsa double LIMIT syntax error → subquery wrap `SELECT * FROM (user_query) AS _inspector LIMIT 101`.

### Sprint 7c kalan iş (sonraki turlar)

Sprint 7c (1 hafta) — DB Inspector + Sistem Ayarları + Uzak Kullanıcı:
- DB Inspector sayfası (SELECT-only default + UPDATE kilitli mod)
- Sistem Ayarları sayfası (Plan tier'lar + Feature flags + Default kategoriler + Email şablonları)
- Uzak kullanıcı: Şifre reset / 2FA reset / Oturum invalidate / Hesap kilit
- `system_settings` + `system_broadcasts` tabloları + migration

### Sprint 7 tamamlanınca sıradaki

Plan-konsistent sırayla:
- **Sprint 8** Pano + Düşük Stok + PetPro Asistanı (Pano kısmı zaten yapıldı, PetPro Asistanı eksik)
- **Sprint 9** Tedarikçiler + Kullanıcılar (Tedarikçiler yapıldı, Kullanıcılar invite flow eksik)
- **Sprint 10** Ayarlar + Telegram + Bildirim (Telegram binding tablosu + setup wizard)
- **Sprint 11** Raporlar (3 section eklendi, kalan: müşteri analitik + stok değer raporu)
- **Sprint 12** Merkezi Vitrin Dizini ⚠ **BLOCKED** — SUPABASE_SERVICE_ROLE_KEY image upload için gerekli (Sprint 12 partial admin profil tamam)
- **Sprint 13/14** iyzico/Nilvera production deploy ⚠ **BLOCKED** — şirket kuruluş bekliyor
- **Sprint 15** Polish + Doc (notifications scaffold kısmı yapıldı)
- **Sprint 16** Lansman

### Bu session'da yapılanlar (kümülatif, 13+ feature)

| Sprint | İçerik | Commit |
|---|---|---|
| 1B.2 | Schema (sessions/stocktakes/stocktake_items/vitrin_events) + RLS baseline | `69ea943` |
| 2.10 | Settings sidebar (SettingsShell 7 link + Tailwind v4 fix) | `69ea943` |
| 14 | Billing orchestrator + /api/webhooks/iyzico + 34 test | `69ea943` |
| 4.7 | Guided Stocktake (lib + 3 UI + 25 test) | `69ea943` |
| 11 ext | Reports stocktake history + audit aktivite | `69ea943` |
| 15 | Notifications scaffold + Pano bell + stocktake trigger | `69ea943` |
| 15 ext | Auto-trigger (low_stock + out_of_stock + vitrin_auto_unpublished) | `69ea943` |
| Pano widget | Son bildirimler mini feed | `69ea943` |
| Mini | Şube detay + Ürün detay (variant×şube matrix) | `69ea943` |
| 12 partial | Storefront settings admin profil | `69ea943` |
| 7a | Süperadmin foundation + tenant detay + bug fix | `69ea943` |
| Düşük stok | Transfer önerisi + drawer auto-open + prefill | `69ea943` |
| Notif type filter | 5 group (Stok/Sayım/Vitrin/Billing/System) | `69ea943` |
| 7b foundation | verifyBypassGuard + writeBypassAudit + 10 test | `7b31adf` |
| 7b Toolbox FAB | SUPERADMIN-only sağ-alt menü + 6 bypass aksiyon link | `075fee0` |
| 7b Bypass 1 | Reverse expired movement (24h bypass + browser E2E) | `a837b6c` |
| 7b Bypass 2 | Hard delete ürün (helper + 6 test + browser E2E reject+happy) | `92665dc` |
| Disk grafiği | Süperadmin paneline disk doluluk + top 8 tablo bar chart | `b9822cf` |
| 7b Bypass 3 | Eksi stoğa zorla (helper + 8 test + sayfa + ✅ browser E2E) | `8507e4a` |
| 7b Bypass 4 | Plan limit override (helper + 10 test + sayfa + ✅ browser E2E FREE→PRO) | `b349e54` |
| 7b Bypass 5 | Sayım rollback (helper + 10 test + sayfa + allowNegative bypass + ✅ E2E -7→-5) | `f26e8d0` |
| 7b Bypass 6 | Movement metadata düzelt (helper + 14 test + 4 alan diff UI + ✅ E2E PSP-X4F7+FAT) | `fba0f5b` |

**Test:** 610 → 762 (+152)
**Migration:** 7 → 11 (0008/0009/0010/0011)
**Yeni route/sayfa:** ~40
**Browser E2E doğrulanan ekranlar:** Pano + 7 settings + 4 stocktake + ürün/şube detay + low-stock + notifications + süperadmin + tenant detay + bypass 1 + bypass 2 + bypass 3 + bypass 4 + bypass 5 + bypass 6 + 7c uzak kullanıcı (3 aksiyon) + 7c DB Inspector

---

## 🎯 SPRINT 0 READINESS — 30 SANİYELİK ÖZET

| Konu | Durum | Sıradaki |
|---|---|---|
| Tasarım dokümantasyon (24 doc) | ✅ Tamam | Mockup yapımı + Sprint 0 |
| Mantık hata taraması (4 tur, 40 bulgu) | ✅ Hepsi çözüldü — `MANTIK-HATALARI-2026-05-14.md` | — |
| Doc'lar arası tutarlılık | ✅ 4. tur sonrası temiz | Yeni karar çıkarsa tek noktadan revize |
| Plan tier kararı | ✅ 3-tier B (FREE 50 / PRO 500 750₺ / PRO+ ∞ 1.750₺, TR-only) | — |
| Vitrin yapısı | ✅ Merkezi tek (`/vitrin`, Sahibinden modeli) | Sprint 12 implementation |
| Ödeme entegrasyonu | ✅ Dokümante (iyzico Sprint 13 + Nilvera Sprint 14) | Şirket kuruluş bekleniyor |
| **Kullanıcı blokerları (2 adet)** | ⏳ Bekliyor | (1) Şirket kuruluş 2-4 hafta · (2) Supabase Pro $25/ay |
| Sprint 0 bootstrap | ⏳ Hazır, başlatılmadı | Next.js + Drizzle + Auth.js + shadcn/ui skeleton |
| Mockup yapımı (17 yeni mockup) | ⏳ Bekliyor | `UI-MOCKUP-PLAN.md` sırasıyla |

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
- ✅ **Supabase region: Frankfurt (`eu-central-1`)** — TR latency ~30-40ms, KVKK Madde 9 açık rıza akışı kayıt formunda zorunlu (2026-05-14 onay, `DEPLOYMENT.md §2.3`)
- ✅ Eski Pet/ klasörü **legacy referans** — kod kopyalanmıyor, dokümanları bile eski

### Davet Akışı (2026-05-14 hibrit onay)
- ✅ **Hibrit:** Admin email veya link yönteminden seçer
- ✅ 📧 Email: Brevo SMTP otomatik gönderim, 7 gün TTL — şube müdürü için
- ✅ 🔗 Link: 12-haneli token + URL kopya, 24 saat TTL, admin WhatsApp/SMS ile elden iletir — STAFF (kasiyer) için
- ✅ `userInviteMethodEnum` ('email'/'link') + `invitedById` FK eklendi (`DATABASE-SCHEMA.md`)
- ✅ Audit: `user.invited` event'inde `metadata.method` yazılır
- ✅ Rate-limit: tenant saatte 10 davet, IP dakikada 5 accept-invite (Cloudflare KV)

### Backend Dil/Framework Karar Gerekçesi (2026-05-15 C seçimi)
- ✅ **MVP: Next.js + Cloudflare Workers** (mevcut karar) — tek dil TS, sıfır DevOps, lansman zamanında
- ✅ **Go + VPS reddedildi:** tek geliştirici DevOps yükü + 3-6 ay lansman ertelenmesi + CLAUDE.md #1 kural çelişkisi
- ✅ **İleride hibrit:** 10K+ tenant veya P95>500ms tetiklenirse Strangler-Fig pattern ile performance-critical parçalar Go mikroservis (raporlar, image moderation, bulk export, sitemap pre-build)
- ✅ Re-evaluation tetikleyicileri dokümante: aktif tenant >10K / P95 >500ms / aylık altyapı >$500 / Workers limit / TS ekosistem çürüme
- ✅ "Performance lazım olur belki" → measure-then-optimize, premature optimization yok
- ✅ Detay: `TECH-STACK.md §6` (yeni bölüm — 6 ay sonra karar tekrar sorulursa referans)

### Monitoring & Observability Stratejisi (2026-05-15)
- ✅ **4 katman izleme:** (1) CF Workers Analytics (edge/API) + (2) Supabase Dashboard (DB) + (3) Süperadmin KPI dashboard (business) + (4) Telegram alert (real-time)
- ✅ **Grafana/Datadog reddedildi:** Süperadmin paneli zenginleştirildi, aynı işi görür + sıfır ek bağımlılık. Re-evaluation 500+ tenant'ta
- ✅ **Sentry MVP'de opsiyonel:** Free tier ile başla veya hiç. Lansman sonrası 100+ event/gün olursa Team plan ($26/ay) değerlendir
- ✅ **Yeni tablo:** `system_errors` (severity enum: info/warning/error/critical) — Workers Logs + Edge Function exception'ları yapısal kayıt, pg_cron 90 gün retention, RLS sadece SUPERADMIN
- ✅ **Süperadmin KPI dashboard zenginleştirildi** (`EKRAN-SUPERADMIN §1.1-1.3`): 6 sistem kart (Tenant + 24s Request + DB pool + Hata + Webhook + Telegram) + Business + Operasyonel + Real-time feed
- ✅ **Sprint 7c implementation:** Cloudflare Analytics API binding + Supabase Metrics REST API embed + Real-time `superadmin_feed` channel
- ✅ Detay: `DEPLOYMENT.md §8` (kapsamlı 8 alt-bölüm: 4 katman + hata stratejisi + uptime + neden Grafana yok + re-evaluation)

### EKRAN-AUTH.md + Cloudflare Turnstile (2026-05-15 kullanıcı onayı)
- ✅ **Yeni doc:** `EKRAN-AUTH.md` (15 bölüm + 52 AUTH-* test) — auth akışlarının tek toplu doc'u
- ✅ **Kapsam:** Login + Register + Email Verification + Forgot Password + Email Change + 2FA Setup + Onboarding 3 adım + Account Lock + Turnstile + KVKK çift checkbox
- ✅ **CAPTCHA = Cloudflare Turnstile** (Google reCAPTCHA değil) — `TECH-STACK §3.9c`: Workers native binding, $0 limitsiz, KVKK temiz (Cloudflare zaten sub-processor, ek anlaşma yok), Google'a veri göndermez
- ✅ **Turnstile yerleştirme:** Register + Forgot Password + Change Email **zorunlu**; Login 5+ başarısız sonrası **conditional**; vitrin Bildir + WhatsApp Feedback + accept-invite **yok** (KV rate-limit yeterli)
- ✅ **Email enumeration koruma:** Forgot password "Eğer kayıtlıysa link gönderildi" generic mesaj (kullanıcının özellikle sorduğu yer)
- ✅ **HIBP password check:** Register + reset HaveIBeenPwned k-anonymity API (bilinen veri sızıntısı şifreleri reddedilir)
- ✅ **Email doğrulama:** 24h TTL + resend 60sn cooldown + 24h max 5 + 7 gün grace period (sonra hesap kilitli, pg_cron)
- ✅ **Şifremi unuttum:** 30dk TTL + tek kullanımlık token + tüm session invalidate + email uyarı
- ✅ **Email değiştirme:** Çift doğrulama (eski email onay + yeni email confirm) + süperadmin Telegram alert ("iptal et" durumunda)
- ✅ **KVKK çift checkbox:** Aydınlatma onayı (Md.10) + Frankfurt veri lokasyonu açık rıza (Md.9) — kayıt anında zorunlu, ayrı checkbox'lar
- ✅ **users tablosuna 10 yeni field:** emailVerificationToken/ExpiresAt/ResendCount/LastSentAt + pendingEmail/Token/ExpiresAt + kvkkConsentedAt + dataLocationConsentedAt + onboardingCompletedAt
- ✅ **Sprint 2 revize:** 1.5 → 2 hafta (10 iş günü) — EKRAN-AUTH detaylandırması + Turnstile setup + onboarding wizard + email değiştirme + 52 test
- ✅ **EKRAN-AYARLAR §2.5 sadeleşti** — auth akışları EKRAN-AUTH'a taşındı, sadece "kullanıcı paneli üzerinden değiştirilebilir" ayarlar burada
- ✅ Detay: `EKRAN-AUTH.md` (yeni doc, ~720 satır)

### WhatsApp Geri Bildirim Balonu (2026-05-15 kullanıcı onayı)
- ✅ **Sticky balon UX:** Müşteri vitrin'de WhatsApp tıkladıktan sonra sağ alt sticky balon belirir (5 sn delay slide-up animation). Dış tıklama **dismiss etmez** (sticky), sadece manuel × veya radio tıklama kapatır.
- ✅ **5 emoji seçenek** (Q1 + Q2 birleşik tek soru): 😊 Çok iyi / 🙂 İyi / 😐 Orta / 😕 Kötü / 😞 Hiç ulaşamadım
- ✅ **Tek tıklama = submit** (submit butonu YOK) → checkmark + "Teşekkürler 🐾" 1.5sn + 500ms fade-out
- ✅ **Counter felsefesi (kullanıcı vurgusu):** "Çoğu insan anketi görmek bile istemez, tıklanma bizim için metrik" — `feedback_balloon_shown` / `feedback_submitted` / `feedback_closed_manually` / `feedback_dismissed` 4 ayrı event
- ✅ **Yorum opsiyonu YOK MVP'de** (Faz 2'ye saklı — moderation yükü baştan kabul edilmez)
- ✅ **Anti-spam 3 katman:** Cloudflare KV (1 IP × 1 tenant × 24h) + localStorage (frontend dedup) + DB unique constraint
- ✅ **KVKK anonim:** Açık rıza checkbox gerekmiyor (kişisel veri yok, IP hash bir yönlü). Aydınlatma metnine 1 satır not
- ✅ **Yeni tablo:** `vitrin_whatsapp_feedback` + 2 enum (`feedbackRatingEnum` 5 değer, `feedbackStatusEnum` 4 değer) + RLS public anon INSERT + tenant SELECT + süperadmin moderation. pg_cron 1 yıl retention (flagged süresiz)
- ✅ **4 yeni `vitrinEventTypeEnum` değeri** — funnel takibi için
- ✅ **Pet shop dashboard** (`EKRAN-AYARLAR §2.1.1`): Funnel (whatsapp_click → balloon_shown → submitted/closed/dismissed) + rating dağılımı + türetilen metric (ulaşma oranı, memnuniyet, ortalama puan, sinyaller)
- ✅ **Süperadmin dashboard** (`EKRAN-SUPERADMIN §1.1`): Müşteri Memnuniyeti kart + cevap hızı sorunu alert (>%20 unreached) + düşük memnuniyet alert (<3/5) + tenant ranking (en iyi 50 + en kötü 10)
- ✅ **Sprint 12 implementation** (+1 iş günü → 14 iş günü, plan ~24-24.5 hafta) — sticky komponent + POST endpoint + Cloudflare KV rate-limit + 15 VIT-FB test senaryosu
- ✅ Toplam MVP tablo **35 → 36**
- ✅ Detay: `EKRAN-PUBLIC-VITRIN.md §15` (11 alt-bölüm)

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

## ⚠ BEKLEYEN KARARLAR — 13 NOKTA (Hepsi MANTIK-HATALARI'nda çözüldü, sadece 2 kullanıcı blokeri kaldı)

> **2026-05-14 güncelleme:** Bu listedeki 13 noktanın **11'i** `MANTIK-HATALARI-2026-05-14.md` 1-4. turlarında çözüldü. Geriye **2 kullanıcı blokeri** (şirket kuruluş + Supabase Pro tier) kaldı. Aşağıda her noktanın çözüm haritası:

### 🚦 Hızlı Çözüm Haritası

| # | Konu | Çözüm Yeri | Durum |
|---|---|---|---|
| 1 | PetStockPro şirket/vergi/IBAN | Kullanıcı yapacak (2-4 hafta) | ⏳ **BLOKER** |
| 2 | Komisyon hesabı net gelir | `DEPLOYMENT.md §6.4` | ✅ |
| 3 | Vitrin metrikleri 4 ayrı etiket | `DATABASE-SCHEMA §3.8` + `EKRAN-PUBLIC-VITRIN §13` | ✅ |
| 4 | Variant bazlı vitrin (parent-only kararı) | `EKRAN-URUNLER §5.5` + `DATABASE-SCHEMA §3.3` | ✅ |
| 5 | Supabase Pro tier ($25/ay) | Kullanıcı yapacak (1 gün, lansman öncesi) | ⏳ **BLOKER** |
| 6 | Bayi Admin email constraint (K3) | `EKRAN-KULLANICILAR §4` politika notu (Gmail + alias) | ✅ (Faz 3 refactor schema'da hazır) |
| 7 | Vitrin currency = TRY only | `EKRAN-PUBLIC-VITRIN §13.6` | ✅ |
| 8 | SEO sitemap pre-build pattern | `EKRAN-PUBLIC-VITRIN §10.2` + `SPRINT-PLAN §15` | ✅ |
| 9 | Şifre kuralları + 2FA recovery | `EKRAN-AYARLAR §2.5` | ✅ |
| 10 | Realtime + Brevo Pro tier | `TECH-STACK §3.5` + `DEPLOYMENT §6` | ✅ |
| 11 | Logo varyantları (favicon/OG/dark) | Sprint 2 task | ⏭ Sprint 2 |
| 12 | Onboarding 3 adım wizard | Sprint 2 (auth.html mockup) | ⏭ Sprint 2 |
| 13 | Test senaryoları doc indeks | Her sprint başında | ⏭ Sprint 1+ |

**Lansman'a giden kritik yol:**
1. ⏳ Şirket kuruluş + vergi no + IBAN + mali müşavir (2-4 hafta) → bu olmadan Sprint 13/14 production'a geçemez
2. ⏳ Supabase Pro $25/ay (1 gün, lansman öncesi) → 30 gün backup + PITR

Aşağıdaki detaylar **arşiv** — çözüm dokümanları ile referansları korunur (sonradan tekrar açılırsa).

### 🔴 KRİTİK (Lansman Bloker — Çözülmezse Lansman Yapılamaz)

#### 1. ⏳ PetStockPro'nun Kendi Şirket/Vergi Durumu

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
- Brute force (2026-05-15 sıkı policy — kullanıcı kararı): **5 başarısız login → hesap 1 SAAT lock** + e-posta uyarı + Telegram süperadmin alert. **2+ başarısız sonrası frontend "kalan hak" banner** (3 yanlışta "3 hakkın kaldı", 4'te "2 hakkın kaldı + Şifremi Unuttum", 5'te "1 hakkın kaldı + 1 saat lock uyarı"). 3 art arda lock → 24 saat kalıcı lock + acil email. TOTP yanlışı sayılmaz. Detay: `EKRAN-AUTH §10`.

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

## 🎯 SIRADAKİ ADIMLAR (Öncelik — 2026-05-14 güncellenmiş)

### ✅ Adım 1 — Doküman Düzeltmeleri TAMAMLANDI (4 tur × 40 bulgu)

Tüm doc düzeltmeleri `MANTIK-HATALARI-2026-05-14.md`'de ✅ işaretli:

| Tur | Bulgu Sayısı | Konu |
|---|---|---|
| 1. tur | 19 (K1-5 + O1-8 + S1-6) | İlk geniş tarama (storefrontStatus, subscriptions, vitrin_reports, ...) |
| 2. tur | 14 (KT2-1..3 + OT2-1..6 + ST2-1..5) | 1. tur yarım kalmaları + yayılım (user_role claim, KDV %20, ...) |
| 3. tur | 2 (YT-1..2) | Kullanıcı geri bildirimi (hibrit foto AI moderation + "Verilerimi İndir") |
| 4. tur | 5 (YT-3..7) | 2+3. tur yayılım hatları (KDV seed, 5→6 rapor, notification UI, dış servis, 2-tier kalıntı) |
| **Toplam** | **40 bulgu** | **Hepsi ✅** |

### ⏳ Adım 2 — Kullanıcı Yapacak (Lansman Bloker — Şirket + Altyapı)

| # | Konu | Süre | Aciliyet |
|---|---|---|---|
| #1 | PetStockPro şirket kuruluş + vergi no + IBAN + mali müşavir anlaşması | 2-4 hafta | Sprint 13/14 production öncesi şart |
| #5 | Supabase Pro tier ($25/ay) abonelik — 30 gün backup + PITR | 1 gün | Sprint 16 lansman öncesi şart |

Kullanıcı bu 2 işi yapana kadar Sprint 0-12 paralel ilerleyebilir (kod çalışması yapılabilir, sadece production deploy bloklu).

### 📦 Adım 3 — Sprint Sırasında (İmplementation Aşamasında, kullanılacak yer hazır)

| Konu | Sprint | Hazır referans |
|---|---|---|
| Logo varyantları (favicon, OG, light/dark, mono) | Sprint 2 | `MARKA-VARLIKLARI.md` brief'i mevcut |
| Onboarding wizard 3 adım (ilk şube + ilk ürün + vitrin opsiyonel) | Sprint 2 | `UI-MOCKUP-PLAN.md §5.5 auth.html` |
| Test senaryoları (her ekran 10-20) | Her sprint başında | Her EKRAN-*.md sonunda mevcut (örn: 18 RPT senaryo, 30 PROD senaryo) |
| Bayi Admin user_memberships refactor | Faz 3 | `DATABASE-SCHEMA §3.9` schema hazır, UI yok |

### 🎨 Adım 4 — Mockup Yapımı (Sprint 0 paralel)

Önerilen sıra:
1. **`assets/tokens-v2.css`** masaüstünden kopyala (PetStockPro/assets/'e)
2. **`pano.html`** Pano-v3 baz alarak yenile (Verdana + topbar 🌐 Vitrin link + 47/50 plan)
3. **`super-admin.html`** 3-tier B plan tablosuna güncelle (YT-7 — şu an 2-tier mockup yanlış)
4. **`urunler.html`** v4 stile taşı + Satışa Aç toggle + Doğrula validation
5. Sırayla diğer 13 yeni mockup (UI-MOCKUP-PLAN.md §4 öncelik tablosu — toplam 17 mockup)

### 🚀 Adım 5 — Sprint 0 Bootstrap (Hazır, başlatılabilir)

Mockup'lar bittikten **veya** paralel olarak başlatılabilir. `SPRINT-PLAN.md §3` Sprint 0:

```
1. npx create-next-app@latest . --typescript --tailwind --app --src-dir --turbopack
2. ~30 paket: Auth.js v5, Drizzle, Supabase, shadcn/ui, TanStack Query, Zustand,
   next-intl, Recharts, Leaflet, Vitest, Playwright, axe, Sentry, Brevo, jose, bcryptjs
3. Supabase Dashboard'da petstockpro schema yarat + extensions:
   - postgis (vitrin yakınlık)
   - pg_trgm (search)
   - moddatetime (updated_at trigger)
   - unaccent (Türkçe karakter-insensitive arama)
   - pg_jsonschema (jsonb validation)
4. Drizzle config + connection test (.env hazır)
5. Auth.js v5 + Drizzle adapter + JWT signer (user_role claim — KT2-1)
6. Tailwind v4 + shadcn/ui init + TASARIM-SISTEMI tokenları (Verdana font)
7. Cities + Districts seed (81 il + ~970 ilçe — Pet/'ten dönüşüm)
8. Default categories seed (KDV %20 güncel — YT-3)
9. Logo + favicon assets (yer tutucu, Sprint 2'de varyantlar)
10. next.config.ts (i18n TR-only, image domains, CSP)
11. lib/realtime/use-realtime-channel.ts helper (S5 ESLint pattern)
12. lib/validation/vatNo.ts (O3 10/11 hane TC + VKN checksum)
13. lib/constants/vat-rates.ts (OT2-2 %10/%20/%8 tek kaynak)
14. messages/tr.json taslak (ST2-2 namespace pattern)
15. GitHub Actions CI
16. İlk commit: "chore: bootstrap PetStockPro skeleton"
```

**Sprint 0 ön-koşul:** Açık nokta yok (Adım 1 ✅). Mockup'lar paralel ilerleyebilir.

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

*Son güncelleme: 2026-05-15 (4. tur Claude self-tarama + 5 yayılım hatası + 6 yeni mimari karar: Supabase Frankfurt region + davet hibrit + backend dil/framework gerekçesi `TECH-STACK §6` + Monitoring/Observability Stratejisi `DEPLOYMENT §8` + EKRAN-SUPERADMIN KPI dashboard zenginleştirme + `system_errors` tablo + WhatsApp Geri Bildirim Balonu `EKRAN-PUBLIC-VITRIN §15` + `vitrin_whatsapp_feedback` tablo + **EKRAN-AUTH.md yeni doc + Cloudflare Turnstile bot koruması** `TECH-STACK §3.9c` + users tablosuna 10 yeni auth field). Bu doküman yeni session başlangıç noktasıdır. CLAUDE.md → DEVAM-REHBERI.md → MANTIK-HATALARI-2026-05-14.md → diğer dokümanlar sırasıyla okunmalı. **40 mantık hatası + 6 mimari karar işlendi (36 tablo, 26 doc), Sprint 0 bootstrap'e hazır.***
