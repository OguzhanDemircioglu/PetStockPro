# PetStockPro — Yeni Session Devam Rehberi

**Tarih:** 2026-05-17 (Sprint 8/10/12 MVP TAM + Sprint 15 polish 4'lü + Sprint 12 ext ürün detay + WhatsApp Feedback Balonu + Feedback dashboard + Pano feedback widget + /vitrin pagination/sort + SEO il/ilçe sayfaları + vitrin moderation paneli + audit log pagination fix + sitemap.xml + robots.txt + vitrin_reports şikayet sistemi + report rate-limit + report Telegram alert + alert dedup + günlük summary alert + JSX whitespace polish + reset-password fix + **Workers cron scheduler config**)
**Mevcut Branch:** `cray61` — origin'in **66 commit** ileri (push edilmedi)
**Son commit:** `86f2f8c` chore(cf): wrangler.toml + cron scheduler dispatcher (daily-summary)
**Test:** 1046 passed (74 dosya) — vitest
**Lint+typecheck:** 0 error
**Migration:** 14 (0014 vitrin_reports + 0013 vitrin_whatsapp_feedback + 0012 telegram + 0008/0009/0010/0011 + 7 öncesi)

## 🚦 YENİ SESSION'A GİRDİĞİNDE — İLK 5 DK

1. **Bu dosyayı baştan oku** (sen şu an buradasın)
2. `CLAUDE.md` (proje genel kararlar + #1 kural: tek geliştirici)
3. `git log --oneline cray61~22..cray61` (son 22 commit listesi)
4. **Memory aktif kurallar** (otomatik yükleniyor):
   - Test-first + temiz çalış
   - Sorusuz akış, plana sadık
   - **UI test = preview_screenshot ile gerçek görsel** (DOM eval/fetch yetersiz)
   - **Her sayfanın testleri tamamlanınca commit** (batch yok, onay isteme)
   - **Session sonu DEVAM-REHBERI güncelle**

## ⚠ "STOK -5 / -7 NEDİR?" — Test Verisi Açıklaması

Eğer DB'de veya screenshot'ta `branch_inventory.stock_qty` negatif değer (-5, -7 vb.) görürsen **panik etme — bu kasıtlı test verisi**:

| Sprint | Aksiyon | Stok değişim | Hangi commit |
|---|---|---|---|
| 7b Bypass 3 | Eksi stoğa zorla giriş — Catit Pixi XL Boy / Merkez Şube'de 53 → **-7** | -60 quantity | `8507e4a` |
| 7b Bypass 5 | Sayım rollback (allowNegative bypass) — sayım movement reverse → **-5** | +2 reverse | `f26e8d0` |
| 8 ext | Transfer öneri test verisi için Merkez'e 100 stok girişi → **95** | +100 stock-in | `be177cb` |

**Şu anki DB durumu (2026-05-16):**
- Merkez Şube · Catit Pixi XL Boy: **95** (negatif değil)
- Şube 2 - İstanbul · Catit Pixi XL Boy: **0**

Negatif stok bypass'ı sadece SUPERADMIN tarafından özel sebep + şifre re-auth + audit log ile yapılabilir. Normal kullanıcı `recordStockOut` çağırdığında `newQty<0` ise `InsufficientStockError` throw eder.

## 🟢 Sıradaki olası işler (öncelik sırasıyla)

| # | İş | Tahmin | Neden |
|---|---|---|---|
| 1 | ~~Workers cron scheduler config~~ ✅ | — | **Tamamlandı 2026-05-17.** wrangler.toml + scheduled dispatcher + 18 test + DEPLOYMENT §3.1.1 |
| 2 | **Sitemap pre-build (pg_cron + R2)** | 1 gün | MVP dynamic sitemap hazır, 50K+ URL'de pre-build gerekecek (şu an erken) |
| 3 | **Cloudflare Workers KV rate-limit migration** | 30 dk | DB-level COUNT MVP'de yeter ama production'da KV ~5ms vs ~50ms |
| 4 | **Storage upload — Sprint 3.3** | ⛔ BLOKER | `SUPABASE_SERVICE_ROLE_KEY` gerek (kullanıcı sağlayacak) |
| 5 | **Sprint 13/14 production deploy** | ⛔ BLOKER | Şirket kuruluş + vergi no + IBAN (2-4 hafta) |

**Plana sadık sıra (CLAUDE.md SPRINT-PLAN):** Sprint 8 ✅ → Sprint 10 ✅ → Sprint 12 MVP ✅ → Sprint 15 polish 4'lü ✅ → Sprint 12 ext ürün detay + Feedback Balonu ✅ → Feedback dashboard (settings + Pano) ✅ → /vitrin pagination + sort enrichment ✅ → Sprint 12 ext SEO il/ilçe route'lar ✅ → Vitrin moderation süperadmin paneli ✅ → Audit log pagination fix ✅ → Sitemap.xml + robots.txt dynamic ✅ → vitrin_reports şikayet sistemi ✅ → Anti-spam rate-limit DB-level ✅ → Süperadmin Telegram alert yeni şikayet ✅ → Alert dedup 1h window ✅ → Günlük summary alert (endpoint hazır) ✅ → **Workers cron scheduler binding** ✅ → Sitemap pre-build / Workers KV migrate → Sprint 16 lansman (bloker bekliyor)

## 📦 Bu Turun Kümülatif Sonucu (22 commit)

### Sprint 7b — Süperadmin Bypass Override TAM (6/6 aksiyon)

| Bypass | Durum | Commit |
|---|---|---|
| Foundation (verifyBypassGuard + writeBypassAudit + 10 test) | ✅ | `7b31adf` |
| Toolbox FAB component + admin layout entegrasyon | ✅ | `075fee0` |
| **1. Reverse expired** (24h+ hareket geri al + 1 yaprak) | ✅ + E2E | `a837b6c` |
| **2. Hard delete ürün** (6 test) | ✅ + E2E | `92665dc` |
| **Disk doluluğu + top 8 tablo grafiği** | ✅ + E2E | `b9822cf` |
| **3. Eksi stoğa zorla giriş** (8 test) | ✅ + E2E | `8507e4a` |
| **4. Plan limit override** (10 test) | ✅ + E2E | `b349e54` |
| **5. Sayım rollback** (10 test + allowNegative bypass) | ✅ + E2E | `f26e8d0` |
| **6. Movement metadata düzelt** (14 test + 4 alan diff UI) | ✅ + E2E | `fba0f5b` |

### Sprint 7c — DB Inspector + Sistem Ayarları + Uzak Kullanıcı TAM (3/3 parça)

| Parça | İçerik | Commit |
|---|---|---|
| 1. Uzak kullanıcı yönetimi | Şifre reset / 2FA reset / lock+unlock + 20 test + 3 Telegram alert + /admin/superadmin/user/[id] sayfa | `cb705c0` |
| 2. DB Inspector | SELECT-only güvenli runner + 20 forbidden keyword + 20 test + 6 hazır query | `a91587b` |
| 3. Sistem Ayarları | Plan tier + 9 env check + DB extensions + 16 kategori (read-only) + 13 test | `9deb921` |

### Sprint 8 — PetPro Asistanı TAM (3/3 kart)

| Parça | İçerik | Commit |
|---|---|---|
| 1. Sipariş önerileri | listOrderSuggestions helper (düşük stok + son tedarikçi) + Pano widget + 8 test | `904f68d` |
| 2. Transfer önerileri | listTopTransferSuggestions flat wrapper + Pano widget | `be177cb` |
| 3. **İndirim önerisi** ✅ | listDiscountSuggestions (yavaş satış + yüksek stok, monthsOfInventory tier 10/20/30) + Pano widget + 22 test + browser E2E (yeni ürün eklendi → 200 stok girişi → widget 680→476₺ -%30 görüldü) | `0b041b5` |

### Fix — reset-password postgres-js Date binary cast

| Konu | Detay | Commit |
|---|---|---|
| reset-password DB update hatası | sql.raw + Date karışımı production'da fail ediyordu. `sql\`COALESCE(${col}, ${now.toISOString()}::timestamptz)\`` ile düzeltildi. Browser E2E: /forgot-password → /reset-password/[token] → POST 303 redirect, log'da hata yok. | `bade9f1` |

### Sprint 10 — Telegram setup wizard (tenant-level bot) TAM

| Parça | İçerik | Commit |
|---|---|---|
| Tek commit | Schema migration 0012 (companies +4 field: botToken/chatId/enabled/configuredAt) + lib/telegram/client.ts genişletildi (sendTenantTelegramAlert, errorCode + description) + lib/telegram/settings.ts (Zod schema regex, getTelegramSettings, saveTelegramConfig, setTelegramEnabled, sendTelegramTestMessage) + /admin/settings/notifications sayfası (BotFather rehberi + form + test + toggle) + Settings sidebar +1 link + Settings hub +1 status kart + 19 unit test | `3c59aeb` |

### Sprint 12 MVP — Merkezi vitrin dizini + profil sayfaları

| Parça | İçerik | Commit |
|---|---|---|
| Tek commit | lib/vitrin/public.ts (listPublicStorefronts + getStorefrontBySlug + listStorefrontProducts + buildWhatsappLink TR normalize) + lib/vitrin/track.ts (KVKK SHA256(IP+daily_salt) hash + fire-and-forget) + /vitrin/page.tsx (filter formu + 24'lü grid + pagination + empty state) + /vitrin/magaza/[slug]/page.tsx (hero + about + iletişim grid + ürün grid) + /vitrin/layout.tsx (public layout) + bug fix: storefront upsert artık companies.storefront_status auto-approve (rejected/auto_suspended bypass) + 20 unit test + browser E2E (Sprint 3 tenant approved → dizinde 1 PET SHOP kartı → profil sayfası XL Boy 3.499₺ → DB 12 profile_view event) | `6b1a0c5` |

### 🚫 Sprint 12 ext (Faz 2 — bu MVP'de yok)

- /vitrin/urun/[slug] cross-tenant ürün detayı + kıyaslama
- /vitrin/[il]/[ilce] şehir/ilçe sayfaları (SEO)
- /vitrin/kategori/[slug] kategori sayfaları
- WhatsApp Feedback Balonu (sticky 5 emoji — `EKRAN-PUBLIC-VITRIN.md §15`)
- PostGIS yakınlık sorgusu + Geolocation API
- SEO sitemap pre-build (pg_cron + R2)
- Schema.org structured data
- Vitrin Modlama süperadmin paneli (`vitrin_reports` tablosu mevcut)

### Sprint 10 ext + Polish (Sprint 15 4'lü)

| Konu | İçerik | Commit |
|---|---|---|
| **Telegram fan-out** | createNotification insert sonrası tenant telegram_enabled=true ise async fetch. Tenant-wide bildirimler Telegram'a düşer; kişisel userId bildirimleri skip (gizlilik). Title HTML escape. 6 yeni test | `5148ab1` |
| **Audit log filter ext** | Kullanıcı dropdown (listAuditUsers + selectDistinctOn) + Başlangıç/Bitiş tarih (YYYY-MM-DD → ::timestamptz cast, exclusive upper bound) + 50/sayfa pagination ?page=N + CSV export new params | `7f41a01` |
| **Düşük stok filter** | Kategori + Şube dropdown + UUID regex validation + filtreli badge subtitle. listLowStock signature: number|opts (geriye uyumlu) | `6b4b044` |
| **Notif fine-grain** | 5 grup chip'in altında alt-tip chip paneli (aktif grup için 16 type bireysel filter). ?type=<exact> URL param, group ile birlikte | `c10f6d4` |

### Sprint 12 ext (devam)

| Konu | İçerik | Commit |
|---|---|---|
| **Ürün detay** | `/vitrin/magaza/[slug]/urun/[productSlug]` — getStorefrontProductDetail helper (4 gating + variants LEFT JOIN/GROUP BY). Breadcrumb + hero (kategori/marka/stok count/fiyat aralığı) + description + variant grid (★ Varsayılan + Stok yok + variant-specific WhatsApp). Profil kart linkleri update. product_view event tracking | `c17169d` |
| **WhatsApp Feedback Balonu** | Migration 0013 (vitrin_whatsapp_feedback + 2 enum + 4 index + RLS), lib/vitrin/feedback.ts (SHA256 IP hash + 24h status upgrade pattern + 13 test), POST /api/vitrin/feedback (sendBeacon kabul), FeedbackBalloon sticky komponent (5sn delay + 5 emoji + tek tap submit + thanks 1.5sn + beforeunload sendBeacon + localStorage dedup), WhatsappLinkScript event yayını, profile + ürün detay sayfalarına entegre. E2E: rating=very_good submit → DB kayıt doğrulandı | `8dbbfef` |
| **Feedback dashboard** | /admin/settings/storefront sayfasına 30g vitrin metrikleri widget (4 KPI: aktivite/cevap/ortalama puan/ulaşma oranı + 5-emoji puan dağılımı progress bar). getFeedbackSummary helper UI'a bağlandı. <3 puan + <80% ulaşma oranı danger tone uyarı | `3cc342b` |
| **Pano feedback widget** | /admin Pano'ya kompakt 4-KPI özet (settings'teki uzun widget'in mini versiyonu): Aktivite + Anket cevabı + Ortalama puan + Ulaşma oranı. "Detay →" link settings/storefront'a. feedbackActivity > 0 conditional render. Mobile/tablet/desktop viewport doğrulandı. | `17587b2` |
| **/vitrin pagination + sort** | lib/vitrin/public.ts: StorefrontSort + STOREFRONT_SORTS + parseSortParam pure helper + listPublicStorefronts'a sort param (name_asc/recent/products_desc) + countPublicStorefronts yeni helper. Page: 3. form alanı sort dropdown + filter summary "Sıra: X" + Temizle koşulu güncellendi + header "X pet shop · sayfa N / M" + gerçek pagination nav (← Önceki / N/M / Sonraki →) + page>totalPages edge case "Sayfa boş" + "İlk sayfaya dön" CTA + buildPageUrl inline helper. +5 unit test (parseSortParam 4 + STOREFRONT_SORTS exhaustive). 3 viewport browser smoke. | `d23a57a` |
| **SEO il/ilçe sayfaları** | 4 yeni helper (getCityBySlug + getDistrictBySlug + listCitiesWithStorefronts + listDistrictsWithStorefronts). 2 yeni route: /vitrin/[il] (city header + ilçe chips + listing + pagination) + /vitrin/[il]/[ilce] (3-segment breadcrumb + district header + listing). Ana sayfa altına "Pet shop'u olan şehirler" chip section (SEO bridge). generateMetadata SEO title + description. JSX whitespace bug template-literal ile fix ("İzmirPet" → "İzmir Pet"). "İzmir'da" → "İzmir için" generic ifade (locative case ek-uyumu name-aware olmadan zor). notFound() 404 + edge case page>totalPages + 2 CTA. Browser smoke desktop + mobile + 404. | `61d1bcb` |
| **Vitrin moderasyon paneli** | lib/vitrin/moderation.ts: listAllFeedback (status/companyId filter + JOIN companies + LEFT JOIN users) + getModerationStats (byStatus + flaggedTodayCount 24h) + flagFeedback (Zod uuid+reason 3-500 + idempotency + companyId return) + unflagFeedback (restoreToStatus override). /admin/superadmin/vitrin-moderation: 4 KPI + 2 tab (Tümü/Flagged) + tablo + inline FlagButton (collapsible reason textarea) + UnflagButton (confirm) + audit log. Süperadmin pano header'a 3 tool link eklendi (Vitrin moderasyon + DB Inspector + Sistem ayarları). +12 unit test (4 schema + 4 flag + 4 unflag). Browser E2E gerçek DB round-trip: flag → KPI güncel + badge + unflag → restore → "✓ sistem temiz". | `d8f6926` |
| **Audit log pagination fix** | lib/audit/list.ts: countAuditLogs yeni helper (aynı filter, SELECT COUNT(*)::int). /admin/audit-log: Promise.all'a count eklendi → totalCount + totalPages hesaplandı + header "X aksiyon · sayfa N / M" + empty state edge case (page > totalPages → "Bu sayfa boş" + "İlk sayfaya dön" CTA) + pagination koşulu `items.length === PAGE_SIZE` yanıltıcı yerine `totalPages > 1 && items.length > 0` doğru + "Sayfa N / M" gösterimi. +4 unit test (total/empty/filter/invalid-date graceful). Browser E2E: normal sayfa + ?page=99 edge case + ?action=stock.in filter combo. | `8a1d76c` |
| **Sitemap.xml + robots.txt** | lib/vitrin/sitemap-data.ts: collectSitemapEntries 5 grup (static + cities + districts + tenants + products, distinct INNER JOIN approved+isEnabled) + getPublicBaseUrl env fallback. src/app/sitemap.ts: Next.js MetadataRoute.Sitemap dynamic (force-dynamic + revalidate 1h). src/app/robots.ts: User-Agent * + 12 disallow (/admin + auth + /api) + sitemap link. +10 unit test (collectSitemapEntries 6 senaryo + getPublicBaseUrl 4 env). Browser E2E: /sitemap.xml 4 URL render + /robots.txt 12 disallow. Pre-build pg_cron+R2 Faz 2'ye saklandı (50K+ URL'de gerek). | `9254077` |
| **vitrin_reports şikayet sistemi** | Migration 0014 + 3 enum (reason 7 değer + status 3 + targetType 2). lib/vitrin/reports.ts: reportInputSchema superRefine (targetType+productId tutarlılık) + submitReport (anon IP hash + insert) + listReports (companies JOIN + products LEFT JOIN + resolvedBy users LEFT JOIN) + getReportStats (byStatus + pendingTodayCount 24h) + resolveReport (idempotency + companyId return for audit). POST /api/vitrin/reports anon endpoint. ReportButton client: 7 emoji radio + note + KVKK note. Profil + ürün detay sayfalarına entegre. Süperadmin moderation page 3. tab "📨 Şikayetler" + ReportTableRow + ResolveReportButton (resolved/dismissed select + note + audit log). +20 unit test. Browser E2E gerçek DB round-trip: submit → süperadmin → dismiss → KPI güncel + resolver email + audit log. | `300ef65` |
| **Şikayet rate-limit** | submitReport içinde Zod sonrası INSERT öncesi DB-level COUNT(*) gate: aynı IP × tenant × 24h max 5. Aşılırsa rate_limit_exceeded reject (429). ipHash='unknown' (proxy header yok) → atlanır. report-button.tsx error mapping güncellendi ("Çok fazla şikayet gönderdin"). +2 unit test (rate_limit_exceeded + altında insert geçer). Browser E2E gerçek DB: 5 fetch ardarda → ilk 4 OK, 5. 429 + UI banner. Cloudflare Workers KV migrate Faz 2'de. | `f414616` |
| **Süperadmin Telegram alert: yeni şikayet** | buildNewVitrinReportAlert template (TR-localize 7 sebep enum + storefront/product hedef ayrımı + note 200 char truncate + panel URL link + severity warning). submitReport içinde insert sonrası fire-and-forget notifySuperadminOnNewReport (companyName + productName lookup → sendTelegramAlert). +6 unit test (storefront/product/note-truncate/note-yok/panel-link/bilinmeyen-reason). Browser E2E: yeni submit → server log `[telegram:mock] [WARNING] 🚩 Yeni vitrin şikayeti...`. | `9bdc957` |
| **Şikayet alert dedup (1h window)** | notifySuperadminOnNewReport içinde, alert build öncesi `ALERT_DEDUP_WINDOW_MS=1h` ile DB COUNT(*) WHERE companyId+status='pending'+createdAt>=cutoff. pendingInWindow > 1 → erken return (skip). 2 mevcut test update (countQueries=1/2 — alert dedup COUNT eklendi). Browser E2E: 5 pending var DB'de → yeni submit → INSERT OK + `[telegram:mock]` log YOK (skip ✓). | `0843565` |
| **Günlük summary alert (cron endpoint)** | lib/vitrin/summary.ts: buildDailyReportSummary helper (status group + top 5 tenant by pending DESC). buildDailyReportSummaryAlert template (0→info+sessiz, <5 pending→info+sessiz, ≥5→warning+sesli). POST /api/cron/daily-summary endpoint Bearer auth (CRON_SECRET env, 503/401/200). +6 unit test (boş/düşük/yüksek/windowHours/panelUrl/topTenants-boş). Workers cron scheduler binding production'da. | `1e79f4e` |
| **JSX whitespace polish** | Profile + ürün detay sayfalarındaki `<strong>PetStockPro</strong> sadece...` disclaimer paragraflarında JSX render leading whitespace yutmuştu ("PetStockProsadece"). `{'...'}` text literal pattern ile bölündü. SEO turundaki H1 fix'ine paralel devam. | `11ca04b` |
| **Workers cron scheduler config** | `wrangler.toml` skeleton repo'ya commitlendi (Sprint 0'da unutulmuş, DEPLOYMENT §3.1 hep "yapılacak"tı): tek domain routing + `[triggers]` `crons = ["0 6 * * *"]` + Hyperdrive placeholder + observability + 15 secret listesi. `src/lib/cron/scheduled-handler.ts`: `dispatchScheduledCron(cron, env, deps)` saf fonksiyon + `CRON_ENDPOINT_MAP` cron→endpoint tablosu — self-invocation pattern (Workers fetch'i ile `/api/cron/*` Bearer auth'a iç istek). `src/cf/worker-entry.ts`: scheduled handler iskeleti — Sprint 14 OpenNext aktive olunca `openNextHandler.fetch` import edilecek, şu an placeholder fetch (503). Tests: scheduled-handler.test.ts 11 test (happy path + unknown cron + secret missing + 401/503 http_error + fetch throw + JSON parse fail + non-Error throw + CRON_ENDPOINT_MAP shape) + daily-summary route.test.ts 7 test (503 cron_disabled + 401 wrong/missing/no-Bearer + happy path + summary helper throw + telegram throw). DEPLOYMENT.md §3.1.1 yeni bölüm: dosya yapısı tablosu + akış diyagramı + neden HTTP self-invocation gerekçe + "yeni cron eklemek için" 5 adım + Sprint 14 wiring 6 adım. +18 test (1028 → 1046). | `86f2f8c` |

### Sprint 9 — Kullanıcılar (davet akışı hibrit)

| Parça | İçerik | Commit |
|---|---|---|
| Davet flow tam | Helper + 14 test + email template + form + /admin/settings/users + /accept-invite/[token] + emailVerifiedAt COALESCE | `dbbcf0a` |

### Sprint 11 ext — 3 yeni rapor

| Parça | İçerik | Commit |
|---|---|---|
| Stok değer raporu | 3 helper (summary + by-category + top variants) + reports section | `f46c099` |
| Müşteri analitik | topCustomers + customerSummary + busiestHours + 5 KPI + top 10 + hour bars | `42ffe1e` |
| Dönem karşılaştırma | week/month delta% + 8 test + ComparisonCard "yeni/up/down/neutral" tone | `47a77bf` |

### 🔧 Bilinen workaround: preview_screenshot timeout

Bazen Next.js dev server cache stale olduğunda `preview_screenshot` 30sn timeout. Çözüm (memory'de kayıtlı):

```bash
preview_stop → rm -rf .next → preview_start
```

Bu tur'da bir kez yaşandı (bypass 3 sonrası). Çözüm 30 saniye, devam edilebilir.

### 🎯 Notlar (detay için git log + commit mesajları)

Detaylı açıklamalar her bir commit mesajında. Yukarıdaki tabloda commit hash'lerine `git show <hash>` ile bakabilirsin. Tekrar ihtiyaç olursa:
- `feedback_test_first` memory → test-first yaklaşım
- `feedback_workflow` memory → sorusuz akış, browser doğrulama
- `feedback_commit_per_sprint` memory → batch yok, sayfa bazlı commit
- `feedback_session_handoff` memory → DEVAM-REHBERI tazele
- `feedback_screenshot_required` memory → UI test gerçek screenshot

### Sprint plan-konsistent sıra (bundan sonra)

- **Sprint 8 kalan** — İndirim önerisi rule (yavaş satış + yüksek stok, Faz 2 SKT yaklaşan)
- **Sprint 10** — Ayarlar + Telegram setup wizard (Telegram bot config + bildirim tercih UI)
- **Sprint 12 — Merkezi Vitrin Dizini** ⚠ partial — `/vitrin` public dizin + WhatsApp deep link (admin profil tamam, public sayfalar eksik). Image upload **bloker** SUPABASE_SERVICE_ROLE_KEY
- **Sprint 13/14** iyzico/Nilvera production deploy ⚠ **BLOCKED** — şirket kuruluş bekliyor
- **Sprint 15** Polish + Doc (notifications scaffold + audit-log filtre eksik)
- **Sprint 16** Lansman

**Toplam test:** 610 → 879 (+269)
**Toplam commit:** 24 (5/16 22:00 sonrası)
**Migration:** 7 → 11

**Browser E2E doğrulanan ekranlar (kümülatif):**
- Pano (KPI + PetPro Asistanı 2 kart + bell + notif feed)
- 8 settings sayfası (general/firma/vitrin profili/users/account/security/audit/export)
- Stocktake (liste + new + detay workflow + complete + cancel)
- Stok hareketleri (4 drawer: stock-in/out/transfer/sayım)
- Ürün/şube detay (variant×şube matrix)
- Düşük stok (transfer önerisi panel + auto-open link)
- Notifications (5 group filter)
- Süperadmin: tenant list + tenant detay + user detay + 6 bypass + DB Inspector + Sistem Ayarları
- Auth: login + register + verify-email + forgot/reset + 2FA setup + change email + cancel + lock + account
- Onboarding 3 adım wizard
- Accept-invite davet kabul akışı
- Reports (5 section: satış + sayım + audit + stok değer + müşteri analitik + dönem karşılaştırma)

---

## 🚀 YENİ SESSION'A GİRDİĞİNDE — REFERANS DOKÜMANLARI

Kararlar referansı için gerektikçe oku (kod yazma için her seferinde okumana gerek yok):

| Doc | Ne zaman bak |
|---|---|
| `CLAUDE.md` | Proje genel kararlar + #1 kural (tek geliştirici) |
| `SPRINT-PLAN.md` | Sıradaki sprint'in detayı için |
| `PLAN-KADEMELERI.md` | Plan tier limit'leri (FREE 50 / PRO 500 / PRO+ ∞) |
| `EKRAN-PUBLIC-VITRIN.md` | Sprint 12 vitrin implementation |
| `EKRAN-KULLANICILAR.md` | Davet flow + STAFF yetki matrisi |
| `PAYMENT-INTEGRATION.md` | iyzico/Nilvera (Sprint 13/14) |
| `DATABASE-SCHEMA.md` | Tablo + enum referansı (36 tablo) |

**Kullanıcının çok kritik uyarısı (önceki session):**
> "bu chat de olanlar son kararlar, sakın birşeyi arkaplana atma"

Çelişkide yeni karar geçerli, eski tasarım koruma çabası yok.

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
