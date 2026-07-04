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

**2026-07-04 (billing/ödeme session) — PRO→PRO+ YÜKSELTME + PROD DEPLOY.** Son commit `104337f`, **prod'a deploy edildi** (Vercel, `petstockpro.com` CANLI · smoke OK). 6 commit (`85255c8`..`104337f`). Test **1970 pass** · typecheck/lint 0 error · Migration **41** (0041 pending_upgrade — prod Supabase + lokal Aiven'a apply edildi).

**Bu session özeti:**
1. **PRO→PRO+ çökme fix'i** (`85255c8`) — server action'da try/catch yoktu → PayTR throw'u ham 500 + "Server Components render" error-boundary çökmesine yol açıyordu. + native `window.confirm`/inline banner → `swalConfirm`/`swalToast` (SWAL konvansiyonu).
2. **PayTR saved-cards parse fix** (`bb3ac4d`) — `/odeme/capi/list` BAŞARIDA kartların DÜZ DİZİSİni döndürür (`[{ctoken,...}]`); eski `{status,cards}` şeması diziyi reddedip `"beklenmedik yanıt biçimi (HTTP 200)"` throw ediyordu → polimorfik normalize + 5 test.
3. **Sade hata mesajları** (`3f5aca6`) — ham PayTR/DB detayı artık kullanıcıya sızmaz, yalnız `console.error` (Vercel logu). Not: mojibake "YÃ¼kseltme" DevTools ham-yanıt görüntü artefaktıydı, gerçek SWAL toast doğru (browser doğrulandı).
4. **Saklı-kart-YOK iframe yükseltme** (`20cbf39`) — migration 0041 (`pending_upgrade_oid`+`pending_upgrade_amount_try`, `pending_merchant_oid`'den **İZOLE**) + `startUpgradeCheckout` + orchestrator izole `applyUpgradePayment` dalı + `applyUpgradeInTx` paylaşımı + `PaytrIframeModal` (BillingCheckout ortak) + 8 test.
5. **Proration KALDIRILDI** (`fdd9094`) — kullanıcı "9,95₺ kafa karıştırıcı" → her zaman **TAM fark** (PRO+ − PRO = 1.000₺). `computeProration` tested util olarak duruyor (geri dönülürse hazır).
6. **Gerçek fiyatlar** (`104337f`) — geçici test 10/20₺ → **1.000/2.000₺** (`git revert 6ff139d` + `page.tsx` çakışma çözümü: marketing landing kaldırıldığından fiyat kartı yok).

**Güncel PROD durum (CLAUDE.md gövdesindeki eski iyzico/CF Workers referansları GEÇERSİZ — bunlar otoritatif):**
- **Deploy = Vercel** (CF Workers/OpenNext bırakıldı), `petstockpro.com` CANLI, `vercel deploy --prod` CLI (authed). Prod DB = **Supabase** (`rjzhnfqrynalklsnnuym`), lokal dev = **Aiven**.
- **Ödeme = PayTR** (recurring saklı kart + iframe + non3d) + **Nilvera** (canlı e-Fatura/e-Arşiv, VKN doğrulama yönlendirmeli) — ikisi de CANLI.
- **Fiyat:** FREE 0 / PRO **1.000₺** / PRO+ **2.000₺** (KDV dahil).
- 2026-05-22 → 2026-07-04 arası ara-history **memory dosyalarında** (PayTR/Nilvera/Vercel/promo kaldırma — bkz. `MEMORY.md`). Otoritatif billing doc: `docs/PLAN-PAYTR-NILVERA.md` §9.3.

---

**2026-05-22 (AI Chatbot session) — AI CHATBOT TAMAMLANDI 7 fazda.** Son commit `ea082fb`. **6 commit yeni** (8deee93..ea082fb). 0 bekleyen commit. Test **1782 pass** (+133 yeni AI test) · typecheck/lint 0 error.

**AI Chatbot session özeti (Faz 1-7):**
1. **Faz 1** (`8deee93`) — USER-MANUAL chunk script + 29 unit test (189 chunk üretimi, TR-friendly 3.5 char/token)
2. **Faz 2** (`adf6fe8`) — CF API client (cf-client.ts) + Vectorize index create + 182 chunk embed + 5 smoke query PERFECT (21 test)
3. **Faz 3** (`e408086`) — Migration 0027 (ai_usage + ai_messages) + rag.ts + usage.ts + `/api/ai/chat` route + 23 test
4. **Faz 4** (`31967dc`) — Sidebar "🤖 AI Asistanı" link + `/admin/ai` page + ChatInterface (welcome + 5 önerilen soru + markdown render + auto-scroll)
5. **Faz 5** (`09e438b`) — Plan gate (FREE 10/gün) + rate-limit (IP×user 5/dk KV/memory) + UI sayaç + 4 hata türü reject (15 test)
6. **Faz 7** (`ea082fb`) — USER-MANUAL §21 AI Asistanı + süperadmin AI istat KPI (4 kart) + Vectorize re-seed (189 chunk)
7. **(Faz 6 test pekitirme Faz 5'e dahil)**

**Production altyapı (Aiven + Cloudflare):**
- Migration 0027 Aiven'da apply edildi (manuel, journal'a eklenmedi — CLAUDE.md pattern)
- Cloudflare Vectorize `petstockpro-user-manual` (1024 dim, cosine) + 189 chunk seed
- CF Workers AI: `@cf/baai/bge-m3` (embed) + `@cf/meta/llama-3.1-8b-instruct` (LLM)
- Env: `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_VECTORIZE_INDEX`, `AI_FREE_DAILY_LIMIT=10`, `AI_RATE_LIMIT_PER_MINUTE=5`

**Test kanıtları:**
- Smoke RAG 4/4: Vitrin/Stok-0/2FA/kapsam-dışı tümü doğru
- Latency 876-2568ms (avg ~1700ms), token cost ~$0.002/query
- AI self-aware: "AI Asistanın günlük limiti?" → "FREE 10 mesaj" doğru
- Browser smoke 3 senaryo (welcome + suggested + free-form) PASS
- Süperadmin AI istat KPI render OK (bugünkü mesaj=4, ort latency=2.8sn, token=8.080)

---

**2026-05-22 GECE (önceki session) — Uzun session bitti.** Son commit `424a520`. **39 commit GitHub'da** (88dfa8b..424a520). 0 bekleyen commit. Test **1649 pass** · typecheck/lint 0 error.

**Bu session'da yapılan büyük tur özetler (sırasıyla):**
1. **NotificationBell client + 6 test** (commit `88dfa8b`) — bulk Tümünü oku sonrası bell anlık 0 (useSyncExternalStore). Cache-reactive.
2. **Bildirimler filtre sadeleştirme** (commit `a69b95f`) — TYPE_GROUPS chip'leri (Stok/Sayım/Vitrin/Abonelik/Sistem) tamamen kaldırıldı. Sadece "Hepsi + Okunmamış" kaldı.
3. **17 mockup brief sync — C iş kalemi** (Tur G→X, 17 commit) — UI-MOCKUP-PLAN.md §5.1-5.17 src/app/ implementasyonuna göre yeniden listelendi. Mockup HTML refresh skip — kod canonical.
4. **Vitrin UX dürüstlük taraması** (commit `5f4ce60`) — 4 fix: hero "Yakınında" → "Türkiye'de" (konum yokken), /vitrin/ara lead şehir koşullu, popüler "🔥 460 görüntüleme" + tooltip, çok satan "🏆 85 satıldı" + tooltip.
5. **Customer journey smoke + admin dürüstlük** (commit `ff332aa` + `57aa483`) — register şifre tekrar input + ürün detay tek-satıcı "fiyat" + Reports kart başlık "(son N gün)".
6. **🏆 Performance Deep Audit — 23 fix planı + 9 tur uygulama** (Tur 1-12, 8 commit):
   - **P0-1** Vitrin 9 sayfa `force-dynamic` → `revalidate` ISR + tracking client-side (`/api/vitrin/track` + `TrackPageView`)
   - **P0-2** `src/lib/cache/request-scoped.ts` React.cache() (getCompanyById + 4 helper) + getAllCities unstable_cache
   - **P0-3** postgres-js `prepare: true` (Hyperdrive uyumlu, planning 4-12ms → <1ms)
   - **P1-1** Migration 0023 `companies.storefront_status` partial index (manuel apply edildi)
   - **P1-4** Migration 0024 `products.name` + `brands.name` pg_trgm GIN partial (manuel apply edildi)
   - **P1-5** next.config `experimental.optimizePackageImports` → **🎉 Bundle 928K → 228K (%75 azalma)**
   - **P2-3** Pano Suspense streaming (`PanoExpiringSection` async deferred)
   - **P2-5** TanStack `refetchOnWindowFocus: false` + staleTime 60s
   - **P2-4 / P3-3/5/6/4** zaten OK (Image priority, middleware matcher, Devtools devDeps, wrangler cron, default staleTime)

**Memory durumu:**
- ✅ `feedback_commit_push_approval.md` aktif — her commit öncesi onay + push HER ZAMAN ayrı tur (toplu push yasak)
- ✅ `feedback_commit_push_auto_repetitive.md` (yeni 2026-05-21) — repetitive doc/brief turlarda pattern bir kez onay → auto commit+push
- ✅ `feedback_screenshot_required.md` — UI değişiklikleri preview_screenshot ile doğrula
- ✅ `feedback_destructive_ask_via_chat.md` — DB mutation / destructive aksiyonlarda chat onay
- ✅ Sorusuz akış sadece küçük adımlar arası geçerli; commit/push'ta askıya alınır

**Test:** 1649 pass (önceki 1643'ten +6 NotificationBell)
**DB:** 24 migration · 0023+0024 `CONCURRENTLY` modifier kullandığı için Drizzle migrator transaction'ında çalışmaz → **manuel apply** (`_journal.json`'a EKLENMEZ, production deploy `psql` ile uygulanır — bkz. [DEPLOYMENT.md §5.2 step 1b](docs/DEPLOYMENT.md))
**Bundle:** En büyük chunk **928K → 228K** (%75 azalma)

**Sıradaki büyük iş seçenekleri (`docs/DEVAM-REHBERI.md` §SIRADAKI TERCİH EDİLENLER):**
- **Production deploy gerçek metric ölçüm** (Lighthouse + artillery k6) — ⛔ Sprint 14 bloker (şirket kuruluş)
- **Performance marjinal fix'ler** (Tur 7/8/15/16 — Drizzle prepare/query consolidation/relational/revalidateTag) — Yok bloker, ROI marjinal
- **7. Mantık Hata Tarama** — yeni değişiklikler için (2-3 saat)
- Sprint 13/14 production / Beta / Pricing pilot — ⛔ kullanıcı bloker

---

### Eski tur özetleri (referans için)

**2026-05-21 öğleden sonra (Sprint 3.3 SON TEMİZLİK):** R2 image upload zaten implementli (r2-client.ts + product-images.ts + images-section.tsx + image-actions.ts + R2 env'leri eksiksiz ✓). **Tutarsızlık çözüldü:** `validateForStorefront.DEFAULT_OPTS.requireImage = false → true`. Önceden edit sayfası `requireImage: true` geçiriyordu ama `publishProductAction` (list-row-toggle) opts geçmiyordu → görselsiz ürün vitrin'e açılabiliyordu. Artık default true, eski "Aç" akışları "missing_image" issue verir. `storefront.test.ts` 2 test güncellendi (`requireImage true (default)` + `false override`), `VALID_ROW.imageCount: 0 → 1`. 19 storefront test pass.

**2026-05-21 (Faz 3-5 BETA-PERFORMANCE):** Algılanan gecikme iyileştirildi. **Faz 3** (commit `3cbd447`): `PetSpinner` 3 boyut + paw SVG + animate-paw-pulse + prefers-reduced-motion + a11y (role=status + aria-busy + sr-only). 2 mevcut spinner migrate (seed catalog + nearby-map). 6 yeni test. **Faz 4** (commit `d840b0a`): TanStack Query Provider + 5 key factory (`productKeys`/`stockMovementKeys`/`stocktakeKeys`/`notificationKeys`/`storefrontKeys`) + Devtools dev-only. Layout sarmal ThemeProvider iç. **Faz 5**: 5 kritik CRUD optimistic — 3 tam optimistic (5.5 bildirim oku → 50ms flip + bell badge -1 + rollback test; 5.3 vitrin Aç/Kapat toggle → setPublished onMutate + PetSpinner pending; bildirim bulk Tümünü oku → 0 anında) + 2 PetSpinner pending (5.1 stok hareketi 4 drawer button içi sm spinner + tone color; 5.2 sayım workflow card + table + complete + cancel buton). 5.4 ürün edit Faz 2'ye saklandı (redirect+revalidate yeterli, tek geliştirici sade-tut). 12 mutation test (notifications-list 6 + list-row-toggle 6). Browser smoke: /admin/notifications mark-read 50ms optimistic flip + bell 3→2 + opacity transition (screenshot kanıt). **Toplam Faz 3-5: 18 yeni test, 1625 → 1643 pass.** **Sıradaki:** FAZ 6 doc + push.

**2026-05-21 (Faz 2 BETA-PERFORMANCE):** Log retention + error tracking tamamlandı. **Faz 2.A** (commit `7f9de60`): 6 tablo TTL-based cleanup cron (system_errors 90g / vitrin_events 365g / processed_webhooks 90g / notifications 90g / vitrin_reports 365g / vitrin_whatsapp_feedback 365g; audit_logs/invoices/subscriptions ASLA silinmez, regression test guard). Wrangler cron `0 4 * * *` + süperadmin "🧹 Log retention" kartı + Telegram özet alert. **Faz 2.B**: Sentry replacement (system_errors tablo Migration 0022 — bootstrap migrator otomatik apply etti + drizzle history 22. satır). trackError helper + PII strip (email/IP/TCKN) + threshold burst (5+/saat → critical Telegram alert + 6h dedup) + /admin/superadmin/errors sayfası (4 stat + top types + 7 filter + resolve toggle) + sidebar SupChip + 3 action retrofit (stock-in + product edit + iyzico webhook) + cron `55 3 * * *` errors-threshold-check. Browser smoke: errors sayfa empty + dolu (4 mock satır, top types) + system-settings retention kartı (system_errors=4 → ✓ Temiz). 44 yeni test (1575 → 1619 pass).

**2026-05-21 (Faz 1 BETA-PERFORMANCE):** Auto-bootstrap tamamlandı — `src/instrumentation.ts` boot hook + `src/lib/bootstrap/run.ts` orchestrator + cities/districts + catalog_seed_products idempotent ensure. Drizzle `__drizzle_migrations` 21. satır manuel senkron (kullanıcı A seçti, history INSERT). 8 yeni test (1567→1575 pass). Browser smoke: dev server 700ms ready + bootstrap 885ms (cities=81/catalog=1240 mevcut → skip). Migration 0022 (system_errors) bootstrap'ta otomatik apply edildi.

**2026-05-20 sonu:** SWAL toast + aria-invalid + Excel ürün import tamamlandı. **Sıradaki büyük iş: Observer/Yetki/Şube-state refactor** — plan: `docs/PLAN-OBSERVER-STAFF-BRANCH-STATE.md` ⭐

1. **`docs/PLAN-BETA-PERFORMANCE.md`** 🆕🆕 — **YENİ SESSION BAŞLANGIÇ DOSYASI (2026-05-21 onaylı)** — 6 fazlı altyapı planı: auto-bootstrap + log retention + error tracking (Sentry'siz, system_errors + Telegram) + PetSpinner + TanStack Query Provider + 5 CRUD optimistic. Toplam 10-12 saat.
2. **`docs/PLAN-OBSERVER-STAFF-BRANCH-STATE.md`** — 9 fazlı önceki plan (tamamlandı 2026-05-21)
3. **`docs/DEVAM-REHBERI.md`** ⭐ — kararlar listesi + bekleyen açık noktalar
3. **`docs/MANTIK-HATALARI-2026-05-14.md`** — 40 mantık hatası çözüldü (4 tur)
4. Bu CLAUDE.md (proje genel durumu)
4. `docs/PLAN-KADEMELERI.md` (**3-tier B — FREE 50 / PRO 500 1.000₺ / PRO+ ∞ 2.000₺, TR-only** — 2026-05-21 son revize, otoritatif)
5. `docs/DATABASE-SCHEMA.md` (36 tablo MVP — 6 yeni: subscriptions/invoices/processed_webhooks/vitrin_reports/system_errors/vitrin_whatsapp_feedback; storefrontStatus enum; user_role JWT claim)
6. `docs/EKRAN-PUBLIC-VITRIN.md` (merkezi tek vitrin, hibrit fotoğraf moderation YT-1)
7. `docs/PAYMENT-INTEGRATION.md` (iyzico + Nilvera — Paddle Faz 2'de pasif, TR-only)
8. `docs/UI-MOCKUP-PLAN.md` (17 mockup brief)

**Önceki session hatalarını tekrarlama** — DEVAM-REHBERI §⚠ Dikkat Edilecekler.

### 🆕 Bu Chat'te (2026-05-14) Yapılan Büyük Değişiklikler — Özet

| Konu | Sonuç | Otoritatif Belge |
|---|---|---|
| **3-tier B + TR-only** | FREE 50/PRO 500 **1.000₺**/PRO+ ∞ **2.000₺**, KDV dahil. **2026-05-21 son revize** (1.250/2.250 → 1.000/2.000, kullanıcı kararı "fiyat artırmayalım"). Önceki: 2026-05-20 Karar C 750/1.750 → 1.250/2.250. Paddle Faz 2'de saklı. | `PLAN-KADEMELERI.md` |
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
| **Excel Ürün Import** (2026-05-20) | `/admin/products/import` — pet shop sahipleri xlsx ile toplu ürün ekler. 11 sütun + 5 örnek satır şablon, 15+ validation (sınır + duplicate + DB cross-check), SWAL özet modal, drag-drop UI. vitrinPublished=false zorunlu (görsel olmadan vitrin yok). 38+20 unit test. | `EKRAN-URUNLER.md §6` |
| **CSV → Excel xlsx Export** (2026-05-20) | 7 export route (.xlsx zengin format: TR header, dd/mm/yyyy locale, ₺ para, auto-filter, freeze pane, zebra). exceljs paketi + `lib/utils/xlsx.ts` helper. Brands + Categories export kaldırıldı (sabit data). | `EKRAN-AYARLAR.md §2.6` |
| **SWAL Toast UX** (2026-05-20) | Form üstü `role="alert"` banner'ları KALDIRILDI. Sağ üstte 4 sn auto-dismiss toast (hover pause). Modal yerine toast. `useSwalOnError(state)` hook 41 form'da. Inline UX-info banner'lar (login kalan hak, KVKK uyarı, plan limit) kasıtlı korundu. | `lib/ui/swal.ts` + `lib/ui/use-swal-on-error.ts` |
| **Field-Level Kızartma** (2026-05-20) | `globals.css` aria-invalid kuralı (border-danger + soft bg + focus ring). 36 form'da ~75+ zorunlu input'a `aria-invalid={hasError \|\| undefined}`. Opsiyonel input'lara dokunulmadı. | `globals.css` |
| **Observer + Yetki + Şube state** (2026-05-21 **TAMAMLANDI**, 8 commit `274a1f1`..`b597c1a`) | Migration 0021 uygulandı: **SUBE_MUDURU→OBSERVER rename** + **branch_status enum 3-state** (active/holiday/inactive) + **user_permissions tablo** (15 key, 3 default ON + 12 OFF) + `idx_users_one_sube_muduru_per_branch` DROP. UI: "🔍 İzleyici" rozet + sticky banner + topbar + 3-state buton group + tatil/pasif vitrin banner + WhatsApp disabled + 15 toggle yetki modal + şube ekleme wizard 2-step "Çalışan ekle". Backend: permissions.ts + status.ts + role-gate.ts + assertNotObserver + hasPermission gate 14 server action'da (stock-movements + products + storefront + stocktake + branches). Türkçe: "Bayi Admin"/"İzleyici"/"Çalışan" etiketleri. **+46 unit test (1507→1553 pass).** | `PLAN-OBSERVER-STAFF-BRANCH-STATE.md` |

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

## 🚀 Şu Anki Durum: 12+ Sprint/Polish Aynı Turda Tamamlandı (2026-05-16)

**Branch:** `cray61` — origin ile sync (commit pending — kullanıcı kararı bekliyor)
**Test:** 736 passed (51 dosya, vitest) — toplam +126 yeni test (610 → 736)
**Lint + typecheck:** 0 error
**Migration:** 7 → **11** (0008 sessions/sayım/vitrin + 0009 katalog RLS + 0010 notifications + 0011 storefront_settings)

**Bu turda tamamlanan (12 sprint/polish + browser E2E + screenshot):**
1. **Sprint 1B.2** — sessions + stocktakes + stocktake_items + vitrin_events (+8 schema test)
2. **RLS baseline** — 8 katalog tablosu RLS=ENABLED (advisory kapandı)
3. **Sprint 2.10** — Settings sidebar (SettingsShell 7 link, lg:grid-cols-[220px_1fr] Tailwind v4 fix)
4. **Sprint 14** — Billing orchestrator + /api/webhooks/iyzico route + E2E mock (+34 test)
5. **Sprint 4.7** — Guided Stocktake (lib + UI + browser E2E +25 test)
6. **Sprint 11 ext** — Reports stocktake history (+6 test)
7. **Sprint 15** — Notifications scaffold + Pano bell badge + stocktake_completed trigger (+14 test)
8. **Sprint 15 ext** — Transition-based auto-trigger: low_stock_critical + out_of_stock (+9 test)
9. **Pano widget** — Son bildirimler mini feed (KPI altında)
10. **Mini** — /admin/branches/[id] şube detay sayfası (4 KPI + variant stok + son hareketler)
11. **Sprint 12 partial** — Storefront settings (admin profil, 4 section, +12 test, Settings sidebar 7. link)
12. **Mini** — /admin/products/[id] ürün detay (4 KPI + auto-unpublish banner + variant×şube matrix + son hareketler)
13. **Sprint 7a** — Süperadmin foundation (+5 test) + /admin/superadmin tenant listesi (8 KPI + tenant tablo) + /admin/superadmin/tenant/[id] detay (5 KPI + users + audit + movements) + subquery alias bug fix
14. **Pano top-bar** — Conditional 🛡 Süperadmin link (sadece SUPERADMIN'se)
15. **vitrin_auto_unpublished trigger** — applyInventoryChain stock_zero detect + 5 sn pencere ile (+2 test)
16. **Reports — Audit aktivitesi** — Action count by type + bar chart + 3 KPI (+5 test)
17. **Düşük stok — Transfer önerisi** — getTransferSuggestionsBulk + low-stock sayfasında "Önerilen transfer X→Y +N adet" link (+6 test)
18. **Transfer drawer query-param auto-open + prefill** — Tek tıkla düşük stoktan transfer (E2E doğrulandı)

**Browser E2E doğrulanan ekranlar:**
- /admin (Pano + 6 KPI + son bildirimler widget + bell badge + sup link)
- /admin/settings (7 sidebar sayfası)
- /admin/stocktake (liste + new form + tamamlandı detay + iptal detay)
- /admin/products (liste + detay + edit)
- /admin/branches (liste + detay)
- /admin/stock-movements (ledger + 4 drawer)
- /admin/reports (3 analitik section: satış + sayım + audit)
- /admin/audit-log (filter + 7+ satır)
- /admin/low-stock (transfer önerisi panel + auto-open link)
- /admin/notifications (filter + tek-tek/tümünü okundu)
- /admin/superadmin + tenant detay
- POST /api/webhooks/iyzico (4 senaryo)
**Seed:** 81 il + 974 ilçe + 16 default category (her yeni tenant'a otomatik)
**Schema:** 21 tablo (migration 0008 + 0009 applied) — Sprint 1B.2 sessions + stocktakes + stocktake_items + vitrin_events eklendi, **21 tablo tamamı RLS enabled** (advisory kapandı)
**Webhook endpoint:** `/api/webhooks/iyzico` POST mounted, signature verification + payload parse + orchestrator dispatch — IYZICO_WEBHOOK_SECRET env'i bekliyor (production öncesi)
**Storage bucket:** `product-images` (public read, server-side write) oluşturuldu — `SUPABASE_SERVICE_ROLE_KEY` 2026-05-21 .env'e eklendi (219 char JWT, anon'dan farklı). Sprint 3.3 image upload **artık yapılabilir**.

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
| 2.7 Account Lock UX | (yeni) | Schema migration 0005 (users +3 field: lockedReason varchar + recentLockCount int + lastLockedAt) + brute-force.ts genişletildi (24h window stale check, recentLockCount, lockedReason BRUTE_FORCE_1H/24H, newRecentLockCount + newLastLockedAt result fields) + Custom errors (AccountLockedError lockedSecondsRemaining+lockedReason field + InvalidCredentialsError remainingAttempts field) + authorize.ts (locked iken AccountLockedError throw, fail lock'u tetiklerse Brevo email gönderim + AccountLockedError throw, fail lock olmazsa InvalidCredentialsError throw remainingAttempts ile) + buildAccountLockedTemplate (BRUTE_FORCE_1H ve 24H iki varyant + IP block + reset CTA + "sen denemiyorsan destek" uyarı) + login action (remainingAttempts state + account_locked code → cookie lock state + redirect /account-locked + invalid_credentials code → state.remainingAttempts) + login page kalan hak banner (3/2/1 hak zinciri, renkli) + /account-locked sayfa (server cookie read + LockedCountdown client component HH:MM:SS countdown + Şifremi Sıfırla CTA + destek email + permanent variant kırmızı) + 6 yeni test (brute-force +3: 24h stale reset + recentLockCount korunur + permanent lock; authorize +1: 5. yanlış AccountLockedError throw) + browser full flow (5 yanlış zinciri → banner 3/2/1 → lock → /account-locked countdown → Brevo email + log → /forgot-password lock bypass → reset → yeni şifreyle login OK → /onboarding) — `pp_lock_state` cookie 5dk TTL + HttpOnly + secure |
| 2.8 Security Settings + Telegram Alert | (yeni) | lib/telegram/client.ts (Bot API + dev mock fallback console log + severity info/warning/critical) + lib/telegram/messages.ts (buildAccountLockedAlert BRUTE_FORCE_1H warning + BRUTE_FORCE_24H critical + buildTwoFactorDisabledAlert info sessiz) + authorize.ts (5. yanlış lock'ta Telegram alert fire-and-forget) + two-factor-setup.ts (disableTwoFactor Telegram alert + companyName lookup, regenerateRecoveryCodes TOTP doğrulamayla yeni 8 kod) + /admin/security 3-panel server+client (status panel: aktive zamanı + kalan recovery count + warning badge 2/0 kaldı, disable panel + regen panel — collapsible) + 13 yeni test (telegram client 4 + telegram messages 6 + 2fa setup +3 regenerate) + browser full flow (2FA aktif user login → /admin/security → "6/8 kullanılmamış" → regen TOTP → 8 yeni kod ekranı → disable TOTP → success banner + PASİF status + Telegram mock "🛡 2FA kapatıldı" log) |
| 2.9 Email Change | (yeni) | Schema migration 0006 (users +3 field: pendingEmail varchar + pendingEmailToken + pendingEmailExpiresAt 24h TTL) + lib/auth/change-email.ts (initEmailChange password re-auth + same/taken check + 2 Brevo email; verifyEmailChange email=pendingEmail + final notify; cancelEmailChange Telegram critical alert) + 3 Brevo template (buildEmailChangeRequestNewTemplate doğrula CTA + buildEmailChangeNotifyOldTemplate "İptal Et" CTA + buildEmailChangedFinalTemplate eski email final notify) + buildEmailChangeCancelledAlert Telegram critical (hesap ele geçirme şüphesi) + /admin/account (server gate + collapsible form: yeni email + şifre re-auth + dual-email uyarı) + /verify-email-change/[token] server (email finalize + final email) + /cancel-email-change/[token] server (pendingEmail NULL + Telegram alert + Şifremi Sıfırla CTA + saldırı şüphesi banner) + 19 test (12 change-email helper + 7 brevo templates) + browser full flow (init → 2 email log → cancel link → "iptal edildi" UI + 🚨 CRITICAL Telegram log → ikinci init → verify link → "değiştirildi" UI + final notify → yeni email ile login OK → eski email reject) |
| 1B.1 Catalog + Stock Foundation | (yeni) | Schema migration 0007: 5 enum (animal_type 7 değer + movement_type 5 değer + movement_subtype 7 değer + payment_method 4 değer + supplier_payment_terms 4 değer) + 8 tablo (categories: parent self-ref + slug unique per tenant + vatRate %10/%20 + sktRequired; brands: slug unique; suppliers: vatNo + leadTime + paymentTerms + IBAN; products: parent vitrinPublished + categoryId/brandId nullable + animalTypes jsonb + soft delete + denormalize totalStockQty; product_variants: SKU unique per tenant + costPrice/salePrice + threshold per branch jsonb + isDefault tek "default" variant; product_images: isPrimary + displayOrder; branch_inventory: (branchId, variantId) unique + stockQty + expiryDate; stock_movements: immutable ledger + type+subtype + transferGroupId + reversesId/reversedById + payment_method credit veresiye + audit superadmin) + 18 index (FK + slug unique + barcode + low-stock + transfer-group + vitrin partial) + lib/catalog/default-categories.ts (16 kategori: kuru-mama/yas-mama/odul-snack %10 KDV, aksesuar+oyuncak+sağlık %20 KDV; mama+ilaç+şampuan SKT) + seedDefaultCategoriesForCompany helper + 10 test (DEFAULT_CATEGORIES shape: 16 unique slug + kebab-case + vatRate 10/20 + 3 food %10 + 5+ SKT + diger displayOrder=99 + emoji + 1-15+99 sıralama; seed helper companyId rows insert) + UI/seed entegrasyonu **Sprint 3+ (ürün CRUD UI)** — schema + foundation hazır, register'da otomatik seed sonra |
| 3.0 Product CRUD Minimal | (yeni) | lib/catalog/products.ts (createProduct: Zod validate + slug üret + SKU çakışma check + Drizzle transaction product + default variant; listProducts: leftJoin category/brand + variantCount subquery + defaultSalePrice subquery + soft delete filter) + Register entegrasyonu (16 default category transaction içinde INSERT — yeni tenant otomatik kategori) + /admin/products list (empty state mascot + table: name+slug, category, brand, variant count, stock 0 highlight, default sale price, vitrin badge) + /admin/products/new (server SSR: 16 kategori + 0 marka load + emoji prefix; client 2-section form: temel bilgiler + variant SKU/cost/sale/threshold; collapse Sprint 3.1+'da: 6 daha section) + Onboarding wizard 3 step'e büyüdü (Step 1 şube + Step 2 ilk ürün opsiyonel/atla + Step 3 vitrin opsiyonel/atla — step indicator + getCalls otomatik wizard navigation) + firstProductAction (skip ya da create) + browser full flow (yeni user register → verify → login → /onboarding Step 1 İzmir+ilçe → Step 2 Royal Canin 2kg 180₺ → Step 3 vitrin atla → /?onboarding=skipped-storefront → /admin/products list 1 ürün → /admin/products/new ikinci ürün Mama Kabı kategori + 2499.99₺ → list 2 satır → duplicate SKU reject "Bu SKU zaten kullanılıyor") + 0 yeni test (mevcut 14 register testi yeni category INSERT chain ile yeşil kaldı, 424 total) — **NOT:** Edit/delete/image upload/Satışa Aç toggle Sprint 3.1+ |
| 3.1 Product Edit + Soft Delete | (yeni) | lib/catalog/products.ts: getProductDetail (product + default variant join + soft delete filter) + updateProduct (Zod validate + ownership check + SKU çakışma kendi variantId hariç + Drizzle transaction product+variant) + softDeleteProduct (deletedAt + isActive=false + vitrinPublished=false) + /admin/products/[id]/edit (server SSR: product detail + categories+brands; client 2-section form pre-populated; update action bound productId/variantId; delete form ayrı section) + List'te edit linkleri (name → /edit) + updated=success + deleted=success banner'lar + browser full flow (edit name+price → ✅ banner + list updated → duplicate SKU edit reject "başka variant kullanıyor" → soft delete → 🗑 banner + list 1 satıra düştü) + 424 test passing (lint+typecheck temiz, helper testleri Sprint 3.2'de) — **NOT:** Multi-variant editor Sprint 3.2, image upload Sprint 3.3, Satışa Aç toggle Sprint 3.4 |
| 3.2 Multi-Variant Editor | (yeni) | lib/catalog/variants.ts (listVariants displayOrder/valueLabel sort + createVariant Zod + product ownership + SKU çakışma + auto displayOrder=max+1 + costPrice opsiyonel default '0' + isDefault=false; updateVariant son aktif pasifleştirme koruması + SKU çakışma kendi hariç + branchThresholds jsonb; deleteVariant hard delete + default koruması + son aktif koruması + FK RESTRICT bilgisi; setDefaultVariant transaction iki update — atomik tek default garantisi + sadece aktif default olabilir; reorderVariants displayOrder=index + tenant+product ownership check + tx loop; listBranchOptions UI için aktif şubeler) + /admin/products/[id]/edit/variant-actions.ts (5 server action revalidatePath + redirect login + parseBranchThresholds JSON normalize) + variants-section.tsx (collapsible "+ Yeni variant" inline form + her variant satırı: badge ★ DEFAULT / Pasif + SKU + barkod + alış/satış + eşik + (+N şube) rozet + 3 buton koşullu: ★ Default yap aktif & non-default → set + ✎ Düzenle her zaman → inline edit + 🗑 Sil non-default & 2+ aktif → confirm() native + useTransition pending state; Edit form aynı VariantFormFields shared + isActive checkbox + branchThresholds details controlled hidden JSON) + 29 yeni test (createVariantSchema 5 + updateVariantSchema 2 + createVariant 5 happy/not_found/sku_taken/Zod gate/displayOrder=null + updateVariant 5 happy/not_found/last_active/SKU çakışma/active count check + deleteVariant 5 happy/is_default/last_active/pasif silinebilir/not_found + setDefaultVariant 3 happy iki update/not_active/not_found + reorderVariants 3 happy/empty/mismatch + listVariants 1) + browser full flow (edit page → + Yeni variant XL Boy 3499₺ → 2 satır → ★ Default yap XL → Mini Boy edit "Standart"→"Mini Boy" eşik 5→8 + Merkez Şube 3 → "Eşik 8(+1 şube)" rozet → duplicate SKU edit reject + form alert "Bu SKU başka variant tarafından kullanılıyor" → Default variant'ta 🗑 Sil UI gizli → Mini Boy 🗑 sil → 1 satır kaldı → reload persistence ✅) + 453 test passing + 0 lint+typecheck error — **NOT:** Image upload Sprint 3.3, Satışa Aç toggle + Doğrula validation Sprint 3.4 |
| 3.4 Satışa Aç + Doğrula | (yeni) | lib/catalog/storefront.ts (validateForStorefront tek sorgu product+company innerJoin + activeVariantCount + min/maxSalePrice + imageCount subquery + 6 issue code: missing_vat_no/product_inactive/no_active_variant/invalid_sale_price/missing_category/missing_image + opts.requireImage default false Sprint 3.3 sonrası true + minSalePrice/maxSalePrice override; publishProduct idempotent validation pass → update + audit alanları vitrinPublishedAt/ById + reasons NULL; unpublishProduct manuel kapatma → vitrinAutoUnpublishedReason='manual' idempotent) + getProductDetail vitrin alanları genişletildi (publishedAt + reason) + /admin/products/[id]/edit/storefront-actions.ts (publish/unpublish server actions revalidatePath edit+list) + storefront-section.tsx (header heading "Vitrin'de yayında/kapalı" + meta info publishedAt + reason + sticky toggle switch label disabled durumlarda kilitli + ValidationPanel 5 check satır ✓/✕ + eksiklikler listesi danger alert + useTransition pending) + /admin/products/list-row-toggle.tsx (liste satırı hızlı toggle: ✓ Aktif / Aç / ⚠ N eksik; fail durumunda 1.5sn sonra router.push edit'e — Doğrula gör) + page.tsx storefront validation parallel load + 19 yeni test (validateForStorefront 11: happy/not_found/missing_vat_no/short_vat/inactive/no_category/no_active_variant/invalid_price_low/invalid_price_high/requireImage true/false/opts override + publishProduct 4: happy/idempotent/validation_failed/not_found + unpublishProduct 3: happy/idempotent/not_found) + browser full flow (list "Aç" → vergi no eksik → 1.5s redirect /edit → Doğrula panel ✕ Şirket vergi numarası "1 eksik" + toggle disabled → DB vat_no='1234567890' set → reload → "✓ Tümü hazır" + enable → tıkla "✓ Vitrin'e açıldı" + heading "Yayında" → DB vitrin_published=true + publishedAt + publishedById set → list "✓ Aktif" → list'ten tıkla kapat → edit "Kapanma sebebi: Manuel kapatıldı") + 472 test passing + 0 lint+typecheck error — **NOT:** missing_image kontrolü Sprint 3.3 image upload sonrası requireImage=true ile aktive edilecek |
| 3.3 HAZIR (2026-05-21 unblock) | (yapılabilir) | `product-images` Supabase Storage bucket public-read mevcut (5MB limit, image/jpeg+png+webp). `SUPABASE_SERVICE_ROLE_KEY` artık .env'de (219 char JWT). Server-side upload + signed URL + thumbnail + product_images CRUD + `requireImage=true` aktive edilebilir. Tahmini 2-3 saat. |
| 8 Pano (KPI Hero) | (yeni) | lib/dashboard/stats.ts: getDashboardStats tek SELECT 7 aggregate sub-query (totalProducts/totalActiveVariants/totalStockQty/branchCount/todaySaleQty/todaySaleRevenue/lowStockCount) — branch-bazlı threshold JSONB karşılaştırma SQL (`COALESCE((pv.branch_thresholds ->> bi.branch_id::text)::int, pv.threshold)`); listLowStock 4-table join (branch_inventory + productVariants + products + branches) düşük stok variantları + branch breakdown; listRecentActivity son 8 hareket join product+variant+branch isimleri. **Date'i sql template'inde ISO string'e çevir** (postgres-js Date instance kabul etmez). /admin sayfa: 4 KPI kart (Toplam ürün + plan progress bar + variant count, Toplam stok + şube sayısı, Bugünkü satış + ciro accent renkli, Düşük stok danger accent + ✓ Hepsi yeterli yeşil) + 2 alt section (Düşük stok listesi 6 max stok sayı vs threshold + Son hareketler 8 feed badge'li +/- chip'li). QuickLink header buttonları (Stok hareketleri / Ürünler / Şubeler / Tedarikçiler / Ayarlar). / sayfası auth+onboarded user'ı /admin'e redirect (önceden landing kalıyordu). 6 yeni test (getDashboardStats 3: happy 7 metrik / empty 0 default / null normalize + listLowStock 2 + listRecentActivity 1). Hydration düzeltme: company/branch/supplier formlarında `<p role="alert">` → `<div>` (ul descendant olabilir, hydration error temizlendi). Browser: /admin → "Merhaba, Sprint 3 Products Test" + 4 KPI (1/40/25/0) + activity feed 8 hareket. 557 test passing, 0 lint+typecheck error. |
| 10 Firma Ayarları | (yeni) | lib/company/settings.ts: getCompanyProfile + updateCompanyProfile + companyProfileSchema (name min 2 / vatNo 10-11 hane VKN+TC / whatsappPhone +90 veya 0 prefix / cityId 1-81 / districtId uuid / boş string null normalize). İlk kez vat_no ekleme → vatRequiredAt=now set (Satışa Aç validation gate ile ilişki). /admin/settings/company/page.tsx: profile.vatNo NULL ise danger banner "Vergi numarası eksik — vitrin için zorunlu" CTA + CompanyForm 2 section (Firma name+vatNo + İletişim/Konum whatsappPhone+cityId+districtId cascade) BranchForm pattern + AbortController district fetch. actions.ts: updateCompanyAction revalidatePath /admin/products (Doğrula refresh için). 11 yeni test (schema 7 + updateCompanyProfile 4 happy/firstVat/idempotent/not_found/Zod). Browser: /admin/settings/company → form pre-populate name + vatNo=1234567890 (browser test sırasında DB'ye manuel set'lediğim) → vatNo değiştir 9876543210 + WhatsApp +905339998877 → submit → "✓ Firma bilgileri güncellendi" → invalid vatNo 123 → "VKN 10 hane veya TC 11 hane olmalı" hata; Doğrula gate artık UI'dan vat_no eklenebilir. 551 test passing, 0 lint+typecheck error. |
| 9 Tedarikçiler CRUD | (yeni) | lib/suppliers/manage.ts: listSuppliers (totalIncomingQty SUM subquery stock_movements stock_in + reversedById NULL) + getSupplierDetail + addSupplier + updateSupplier + setSupplierActive + supplierSchema (name min 2 / vatNo 10-11 hane VKN+TC / email format / IBAN TR+24hane regex / phone +90 veya 0 prefix / paymentTerms enum cash/net_30/net_60/other / leadTimeDays 0-365 / boş string → null normalize). actions.ts: 3 server action redirect success / bound id update / toggle confirm. UI: /admin/suppliers tablo (Ad+contact, VKN mono, telefon+email iletişim, Lead gün, Ödeme emoji-label 💵 Peşin/📆 30/60 gün/➕ Diğer, Toplam giriş, ToggleSupplierActive); SupplierForm 4 section (Firma + İletişim + Ticari koşullar + Not) shared add+edit; /admin/suppliers/new + /admin/suppliers/[id]/edit. 16 yeni test (supplierSchema 10: minimum/VKN 10-11/9 hane reddet/boş null/email format/IBAN TR+24/wrong country reddet/paymentTerms invalid/leadTime>365 + addSupplier 2 happy/Zod fail + updateSupplier 2 happy/not_found + setSupplierActive 2). Browser: empty state → + Yeni Tedarikçi → Royal Canin Türkiye + VKN 1234567890 + contact Ayşe + +902121234567 + 60 gün → ?created=success → liste 1 satır; /admin/stock-movements Stok Girişi drawer aç → supplier dropdown ✅ "Royal Canin Türkiye" seçilebilir (Stock-in drawer dependency tamamlandı). 540 test passing, 0 lint+typecheck error. |
| 5 Şubeler CRUD | (yeni) | lib/branches/manage.ts: listBranches (city/district leftJoin + variantInventoryCount + totalStockQty SUM subquery) + getBranchDetail (filter from list) + addBranch (Zod + city/district FK doğrulama: city_not_found/district_mismatch) + updateBranch (tenant ownership + FK doğrulama) + setBranchActive (last_active_branch koruması: son aktif şube pasifleştirilemez, en az 1 aktif kalmalı transfer için) + getBranchInventorySummary (silme öncesi uyarı için, Sprint 5+) + branchSchema (name min 2 / cityId 1-81 TR il / whatsappPhone regex +90 veya 0 prefix / boş string → null normalize). actions.ts: addBranchAction redirect success / updateBranchAction bound id / toggleBranchActiveAction confirm gerektirir. UI: /admin/branches kart grid (3 kolon responsive, name → edit link, Aktif/Pasif badge, 📍 city/district, 📞 WhatsApp, variant count + total stock summary + ToggleActiveButton client component son aktif kontrolü server-side); /admin/branches/new sayfa server SSR cities load + BranchForm shared component (cascade city → district fetch /api/locations/districts onboarding wizard pattern + AbortController yarış kontrolü, initialDistricts prop ile edit pre-load fetch atlama); /admin/branches/[id]/edit pre-populate district list edit için. 16 yeni test (branchSchema 6: zorunlu/isim<2/cityId>81/phone format/boş null/+90 prefix + addBranch 4: happy/city_not_found/district_mismatch/Zod + updateBranch 2: happy/not_found + setBranchActive 4: pasifleştir 3 aktif var/son aktif reject/pasif→aktif last check yok/not_found). Browser full flow: /admin/branches listede 1 şube Merkez İzmir/Aliağa 40 stok → + Yeni Şube → "Şube 2 - İstanbul" cascade city İstanbul → ilçeler 40 yüklendi → Kadıköy + WhatsApp +905321112233 → submit → ?created=success banner + 2 kart liste → /admin/stock-movements transfer butonu **artık enabled** (Sprint 4.3 E2E bekleyen) → Merkez → İstanbul 10 adet transfer → 2 entry aynı transferGroupId TG:30a6ff → DB Merkez 40→30, İstanbul 0→10 toplam 40 ✅. 524 test passing, 0 lint+typecheck error. |
| CSV Export Suite (KVKK Md.11) | (yeni) | lib/utils/csv.ts: escapeCsvCell (; / " / newline wrap + "" escape) + rowsToCsv + csvResponseBody (UTF-8 BOM Excel TR uyum). 9 export route: reports daily/top + audit-log + stock-movements + products + brands + categories + suppliers + branches. /admin/settings/export "Verilerimi İndir" hub (KVKK Madde 11 veri taşıma hakkı, EKRAN-AYARLAR §2.6). Her listede ⬇ CSV buton header'da, filter param'ları URL'ye geçer. 10 csv test. |
| 4.7 Guided Stocktake (Sayım Oturumu) | (yeni) | **lib/stocktake/sessions.ts (5 ana helper + 2 Zod schema)**: startStocktakeSchema (branchId uuid + mode default 'full' + opsiyonel categoryId + note≤500) + updateItemCountSchema (countedQty int 0-999_999 + reason 7 enum loss/overage/wrong_entry/expired/damage/theft/other + customReason≤500). startStocktake (branch ownership + tüm aktif variant snapshot tek tek select+branch_inventory leftJoin systemQty COALESCE 0 + transaction tek insert stocktakes header + bulk insert stocktake_items snapshot; reject branch_not_found / no_variants / invalid_input / unknown). listStocktakes (branch+startedBy leftJoin email + ORDER BY startedAt DESC + limit default 50). getStocktakeWithItems (header + branch + items innerJoin productVariants+products + ORDER BY product.name, displayOrder). updateStocktakeItemCount (item+stocktake ownership inner join + status check in_progress/waiting → reject session_closed + diff hesapla counted-system + counter increment wasCountedBefore false ise ++ countedItems; willBeDiff !== wasDiffBefore ise diffItems update; transaction içinde stocktake_items update + stocktakes counter update + countedItems/diffItems lookup; reject not_found / invalid_input / unknown). completeStocktake (header lookup + status check + uncountedCount = totalItems-countedItems ile reject has_uncounted; SELECT diff != 0 items + for-loop recordStocktakeAdjustment reuse (mevcut stock_movements integration: branch_inventory upsert + product.totalStockQty SUM + auto-unpublish chain çalışır), her item için "Sayım: {reason}" textual reason; stocktake.status='completed' + closedAt set; movementsCreated counter ok döner). cancelStocktake (already_closed check + cancelled + closedAt). **25 unit test (4 startStocktakeSchema + 4 updateItemCountSchema + 5 startStocktake invalid/branch_not_found/no_variants/happy+transaction-1-trip+items insert 3 row/transaction throw / 4 updateStocktakeItemCount invalid/not_found/session_closed/happy diff+counter / 4 completeStocktake not_found/session_closed/has_uncounted+count/happy 2 movements / 4 cancelStocktake not_found/already_completed/already_cancelled/happy)**. **UI: /admin/stocktake/page.tsx liste (Aktif kartlar + Geçmiş tablo + empty state + progress bar gradient + filtre/sebep emoji label TR)** + /admin/stocktake/new (server SSR branches active filter + form 1 select 1 input "Tam" mod sabit) + /admin/stocktake/[id] (server SSR getStocktakeWithItems + workflow.tsx client component 4 filter pills tümü/sayılmadı/sayıldı/farklı + arama + ItemRow useState counted/reason/diff/savedCounted/savedReason/isDirty kontrol + ✓ Save buton per row dirty olunca + Enter handler ile submit + reason dropdown disabled hasDiff true ise + ✓/○ completed badge + CompleteButton confirm()+useTransition success/error state + CancelButton confirm+useTransition). 3 server action (startStocktakeAction redirect detay sayfasına + updateCountAction itemId echo + revalidatePath + completeStocktakeAction has_uncounted reason mesaj + 3 revalidatePath + cancelStocktakeAction redirect liste). audit entegrasyon (stocktake.started / stocktake.completed / stocktake.cancelled). **Browser smoke full E2E**: /admin/stocktake → empty state → + Yeni Sayım → Merkez Şube + "Browser smoke test sayımı" → Başlat → POST 303 redirect → detay sayfa #4f26d35e + 2 ürün satırı (Catit XL 52, Royal Canin 0) → row1 counted=50 → Save → diff=-2 + reason dropdown "Kayıp" görünür → counted/diff/pct güncellendi (1/1/50%) → row1 reason=loss → Save → row2 counted=0 → Save → counted=2/2 100% → Complete button enabled → Tamamla → status=Tamamlandı + ledger'da "📋 Sayım Catit XL 52→50 reason='Sayım: loss'" + audit log entry "stocktake.completed". **677 test passing (+25), 0 lint+typecheck error.** **NOT:** Mode 'full' only (kategori + manuel Faz 2), softLock pasif (trigger Faz 2). |
| 14 Billing Orchestrator + Route + E2E | (yeni) | **3 dosya yeni + 1 route handler.** lib/billing/totals.ts: computeInvoiceTotals (Math.round penny-safe matrah+vat=total, %20 default ama param override + zero/Infinity/NaN/negatif reject) + addMonths (JS native setMonth clamp davranışı, orijinal Date mutate edilmez) + SUBSCRIPTION_VAT_RATE 20 sabit + 15 unit test. lib/billing/orchestrator.ts: processIyzicoWebhookEvent ana fonksiyon (5 outcome: duplicate/processed/subscription_not_found/company_user_missing/unsupported_event) + persistWebhookEvent (Postgres 23505 duplicate yakala) + findSubscriptionByIyzicoRef + findCompanyOwner (BAYI_SAHIBI lookup, audit author için) + 5 event handler (ORDER_SUCCESS+RENEWAL_SUCCESS payment success path: period extend+1ay → invoice insert pending → Nilvera best-effort + Nilvera response ile invoice issued/pdfUrl/nilveraInvoiceId update; RENEWAL_FAILURE → past_due; CANCELED → cancelled+cancelAtPeriodEnd+cancelledAt; EXPIRED → expired + company.plan='FREE' revert; UPGRADED → updatedAt + audit, plan ref mapping Faz 2) + issueNilveraInvoice helper (company VKN+name çek → externalRef=invoiceId + customer + 1 line matrah+%20 + currency TRY; VKN yoksa throw → invoice 'pending' kalır background retry) + 11 unit test (idempotency duplicate / 2 error path subscription_not_found+company_user_missing / RENEWAL_SUCCESS happy invoice+Nilvera+audit ile mock VKN doğru kullanım / ORDER_SUCCESS periodStart=now + action=payment_succeeded / Nilvera 502 fail invoice pending+nilveraError+audit yine yazılır / VKN eksik Nilvera atlanır / RENEWAL_FAILURE past_due+audit / CANCELED+cancelledAt / EXPIRED+plan FREE revert / UPGRADED updatedAt+audit). app/api/webhooks/iyzico/route.ts: POST handler raw body + x-iyz-signature header + verifyIyzicoSignature (env yoksa 500 webhook_secret_missing / invalid 401 / parse fail 400 / orchestrator throw 200 OK iyzico retry spam koruma / success 200 OK outcome) + force-dynamic + runtime nodejs. route.test.ts vi.mock ile orchestrator+webhook+nilvera+db client mock + 8 test (5 path + duplicate + subscription_not_found + happy nilvera ile mock invoke kontrol). 652 test passing (+34 bu session), 0 lint+typecheck error. Browser smoke: POST /api/webhooks/iyzico → 500 webhook_secret_missing (env eksik) — production öncesi IYZICO_WEBHOOK_SECRET set'lendiğinde gerçek webhook trafiği orchestrator'a iletilecek. |
| 2.10 Settings Sidebar Layout | (yeni) | src/components/settings-shell.tsx server-component SettingsShell (props: current SettingsSection / title / description / children) + sol kalıcı sidebar nav 6 link (📊 Genel bakış /admin/settings + 🏢 Firma /admin/settings/company + 👤 Hesap /admin/account + 🛡 Güvenlik /admin/security + 📜 Audit log /admin/audit-log + ⬇ Verilerimi İndir /admin/settings/export) — aria-current="page" doğru aktif item highlight + data-settings-nav/link test selector + lg:sticky lg:top-6 desktop yapışkan + responsive grid-cols-[220px,1fr] / mobile stack. URL'ler değişmedi, her sayfa SettingsShell wrap'ler. Hub /admin/settings yeniden yazıldı: "Genel bakış" 4 StatusCard (Firma+VKN durumu / Hesap+pendingEmail / 2FA aktif/kapalı / Plan) + Veri yönetimi 4 DataLink (kategori/marka/şube/tedarikçi count). 6 sayfa sarmalandı (account/security forms outer main+header çıkarıldı, child content olarak verildi). Browser doğrulama: 6 sayfa GET 200 OK + aria-current="page" expected sectionla 6/6 eşleşti. 618 test passing, 0 lint+typecheck error. **NOT:** /admin/account + /admin/security + /admin/audit-log standalone URL korundu (route move yok, geriye uyumlu) — Faz 2'de /admin/settings/* altına taşınabilir. |
| 1B.2 Katalog RLS Baseline | (yeni) | Sprint 1B.1 (migration 0007) katalog tablolarını RLS=DISABLED bırakmıştı (Supabase advisory critical). Migration 0009 sprint_1b2_catalog_rls_baseline: 8 tablo (products + product_variants + product_images + branch_inventory + stock_movements + categories + brands + suppliers) ENABLE ROW LEVEL SECURITY. Pattern: postgres user RLS bypass eder (server actions etkilenmez), anon REST role default-deny. Public read için policy ileride Sprint 12 vitrin'de eklenecek. Browser smoke: 8 admin sayfası (/admin + /admin/products + /admin/branches + /admin/categories + /admin/brands + /admin/suppliers + /admin/audit-log + /admin/reports + /admin/low-stock + /admin/stock-movements) hepsi RLS açıldıktan sonra 200 OK döndü, /admin/products list 1 ürün + /admin/stock-movements 13 satır render edildi. Advisory kapandı. 618 test passing (mevcut testlerin tümü postgres user üzerinden çalışıyor, RLS bypass intact). 0 lint+typecheck error. |
| 1B.2 Sessions + Sayım + Vitrin Events Schema | (yeni) | Schema migration 0008: 4 yeni enum (stocktake_status 4 değer / stocktake_mode 3 değer full+category+manual / stocktake_reason 7 değer loss+overage+wrong_entry+expired+damage+theft+other / vitrin_event_type 14 değer — 10 analytics + 4 feedback balonu) + 4 yeni tablo (sessions sessionToken PK + user FK + expires + cihaz takibi ipAddress/userAgent/deviceLabel/lastActivityAt — Auth.js Drizzle adapter Faz 2 + Aktif Oturumlar UX ileride; stocktakes company+branch FK + mode + categoryId opsiyonel + softLock + status default in_progress + 4 sayım istatistiği totalItems/countedItems/diffItems/valueImpact + startedBy + closedAt; stocktake_items stocktake FK cascade + variant FK restrict + systemQty/countedQty/diff + reason enum + customReason text "other" için + isSkipped + (stocktakeId, variantId) UNIQUE; vitrin_events company FK cascade + branchId/productId/variantId opsiyonel + eventType + visitorIpHash SHA256+daily_salt + visitorCityId/Country + UTM 3 field + searchQuery — KVKK uyumlu anonim) + 9 index (sessions user/expires + stocktakes company+status/branch + stocktake_items unique + variant + vitrin company+date + type+date + product partial WHERE NOT NULL) + 12 FK constraint + RLS enabled 4 tabloda (policy yazımı Sprint 1B.2+). 8 yeni schema shape test (4 enum coverage + 4 table column presence). 618 test passing, 0 lint+typecheck error. **NOT:** Bu schema-only sprint — UI tüketici Sprint 4.7 sayım ve Sprint 12 vitrin'de gelecek. stock_movements'a stocktakeId+stocktakeReason kolonları sayım UI sprint'inde eklenecek. |
| Audit Log Foundation | (yeni) | lib/audit/log.ts: writeAuditLog (Zod-free, sessiz fail) + writeAuditLogAsync (fire-and-forget) — append-only, action 'entity.action' pattern. lib/audit/list.ts: listAuditLogs filter (action/entityType/userId) + users.email leftJoin. **Server action entegrasyonu (12 yer)**: createProduct / updateProduct / softDeleteProduct / publishProduct / unpublishProduct / recordStockIn / recordStockOut / recordTransfer / stocktake / reverse / addBrand+update+delete / addCategory+update+delete / addSupplier+update+toggle / addBranch+update+toggle / updateCompany (vat_no_set ayrı action). /admin/audit-log read-only viewer (100 son satır + 26 action label emoji+TR + süperadmin badge + JSON afterState details disclosure). Settings hub'a 📜 Denetim section eklendi. 8 yeni test (writeAuditLog happy/fail-silent/superadmin override/null defaults + writeAuditLogAsync fire-and-forget + error swallow + listAuditLogs 2). Browser: yeni stok-in 5 adet → /admin/audit-log "📥 Stok girişi sprint3prod@petshop.com stock_movement (74321efc) Göster" satır + JSON afterState {afterQty:42, quantity:5, branchId, variantId} expand. 600 test passing, 0 lint+typecheck error. |
| 6.5 Markalar CRUD | (yeni) | lib/brands/manage.ts (list+add+update+delete + productCount subquery + slug çakışma + makeSlug shared) + actions + UI tablo + DeleteBrandButton (productCount>0 warning'li confirm) + BrandForm shared + /admin/brands/* sayfa + Pano QuickLink 🏷. 13 yeni test (schema 4 + addBrand 3 + updateBrand 3 + deleteBrand 3). Browser: empty → + Yeni → Catit → tablo 1 satır → product edit form Marka dropdown'unda Catit seçilebilir (önceden "Henüz marka yok"). |
| 6.6 Kategoriler CRUD | (yeni) | lib/categories/manage.ts (list+add+update+delete + productCount subquery + slug çakışma + categorySchema KDV enum 1/8/10/20 + sktRequired boolean + displayOrder 0-999 + emoji transform empty→null) + actions + UI tablo (emoji + slug + KDV badge + SKT chip + sıra + ürün count) + DeleteCategoryButton + CategoryForm shared (2-col emoji+name + KDV select + displayOrder + SKT checkbox) + /admin/categories/* sayfa + Pano QuickLink 📂. 13 yeni test. Browser: 16 default kategori listede → + Yeni 🐠 Akvaryum Süsü %20 → tablo 17 satır (kullanıcı eklenen sıra 100). |
| 6 Düşük Stok Detay | (yeni) | /admin/low-stock sayfa: listLowStock limit=200, variant bazında grupla (aynı variant farklı şubelerde olabilir), grup kartı + ürün/SKU + "Stok girişi yap →" arrow link + branch grid (stok / eşik kartı, sıfır stokta danger border + "Vitrin'den otomatik düşmüş olabilir" uyarı). Pano düşük stok kartına "Tümünü gör + sipariş aksiyonları →" link footer. |
| 11 Raporlar (minimal) | (yeni) | lib/reports/sales.ts: 3 helper (dailySalesSummary 30 gün GROUP BY DATE_TRUNC sale + revenue + count, topSellingVariants 10 max variant satış adet sıralı, periodSummary toplam adet+ciro+sayı+ortalama sepet). Reversed (reversedById NOT NULL) ve reversal kayıtları (reversesId NOT NULL) hariç tutulur. **Date interpolation fix:** Drizzle gte+sql template Date param postgres-js'te "string argument received Date" hatası veriyordu. Çözüm: `sql.raw(\`'${iso}'::timestamptz\`)` ile SQL literal cast (Postgres parse). Aynı sorun dashboard'da çözüldü: subquery'de `DATE_TRUNC('day', NOW())` Postgres-side hesap. /admin/reports sayfa: range picker 7/30/90 gün (URL ?days=) + 4 KPI (toplam adet/ciro/satış sayısı/ort sepet TR locale formatlı) + 5-kolon grid (3-kol günlük çubuk grafik + 2-kol top variants 🏆 sıralı). 6 yeni test (dailySalesSummary 2 / topSellingVariants 1 / periodSummary 3 avgBasket math). /admin Pano QuickLink + 📊 Raporlar eklendi. Browser: stok-in 5+3 sale 3499₺ → /admin/reports → "1 satış, 3 ad, 10.497₺ ciro, ort sepet 10.497₺" + günlük 2026-05-15 satır + top 1 Catit Pixi XL. 566 test passing, 0 lint+typecheck error. |
| 4.6 Transfer Pair Reversal | (yeni) | reverseStockMovement transfer için pair handling: aynı transferGroupId iki entry'yi birlikte geri alır. reverseTransferPair internal helper: orijinal + pair fetch (reversesId NULL + id !=) + 24h pencere (süperadmin bypass) + her iki şubede stok yeterli mi check (negatif yön için) + transaction: yeni reversalTransferGroupId crypto.randomUUID + 2 yeni reversal movement (transferTargetBranchId reference geri yön + reversesId set) + iki orijinali reversedById ile UPDATE + applyInventoryChange iki şubede. Yeni reject sebebi: `transfer_pair_missing` (transferGroupId NULL veya pair bulunamadı). UI: ReverseButton `isTransfer` artık disable etmez (sadece warning'li confirm mesajı). actions.ts Türkçe `transfer_pair_missing` → "Transfer eşi bulunamadı (veri tutarsız)" mesaj. 3 yeni test (pair_missing / pair zaten reversed → already_reversed / pair happy 2 insert + 4+ update / hedef yetersiz → insufficient_stock meta). Browser: 🔁 Transfer 10 adet → ↶ Geri al → 2 yeni "Transfer geri alma TG:9b8e1f" entry + iki orijinal "✓ Geri alındı" → DB Merkez 30→40, İstanbul 10→0 doğru restore ✅. 560 test passing, 0 lint+typecheck error. |
| 4.5 Reversal (Geri alma 24h) | (yeni) | lib/stock/movements.ts: reverseStockMovement helper + REVERSAL_WINDOW_MS const (24h). Tek sorguda orijinal movement çek + tenant ownership + 6 reject sebebi: not_found / already_reversed (reversedById set) / is_reversal (reversesId set — bir geri alma tekrar geri alınamaz) / window_expired (24h geçti, isSuperadmin bypass) / transfer_requires_pair (Sprint 4.6) / insufficient_stock (stock-in geri al iken şubede yeterli yok). Transaction: yeni reversal movement insert (aynı type+subtype, ters quantity, reversesId orijinal, performedAsSuperadmin flag, reason 'Geri alma' default) + orijinali reversedById ile UPDATE (immutable mantığı: orijinal değişmez sadece pointer) + applyInventoryChange branch_inventory + product totalStockQty + auto-unpublish chain. actions.ts: reverseMovementAction Türkçe reason→message (not_found / already_reversed / is_reversal / window_expired / insufficient_stock / transfer_requires_pair / unknown) + revalidatePath. movements-table.tsx: yeni İşlem kolonu + 3 durum: reversedById → "✓ Geri alındı" gri / reversesId → "↶ Geri alma" gri / değil → ReverseButton client component. ReverseButton: server'da withinWindow + isTransfer hesaplanıp prop geç (React purity Date.now() forbidden render içinde), confirm() onay + useTransition pending + router.refresh + hata banner. 9 yeni test (recordStockIn geri al happy 1 saat / 25 saat expired / superadmin bypass / zaten geri alınmış / kendisi reversal / transfer reddet / şube yetersiz / not_found / REVERSAL_WINDOW_MS const). Browser: 📋 Sayım -3 geri al → +3 stok 12→15 + orijinale "✓ Geri alındı" + reversal'a "↶ Geri alma"; 📤 Çıkış -25 geri al → +25 stok 15→40 + DB stock_qty=40 doğrulandı; aynı movement'a tekrar geri al butonu görünmüyor (UI guard). 508 test passing, 0 lint+typecheck error. |
| 4.4 Stocktake (Sayım) | (yeni) | lib/stock/movements.ts: recordStocktakeAdjustment helper (Zod countedQty 0-1M, delta = counted - current, delta=0 → no_change kayıt yok, delta+ → giriş yönlü stocktake type movement, delta- → çıkış yönlü + auto-unpublish trigger countedQty=0 + vitrinPublished). actions.ts: stocktakeAction + buildState delta+afterQty meta + 'Sayım sistemdeki miktarla aynı' no_change Türkçe mesaj. stocktake-drawer.tsx: şube + variant + countedQty (large bold input) + reason + note; success alert "Δ +3 → yeni stok 12" delta görünür. DrawerLauncher 4. buton 📋 Sayım eklendi (4 drawer toplam). 6 yeni test (stocktakeAdjustmentSchema 2: countedQty 0 OK / negatif reject; recordStocktakeAdjustment 4: eksik sayım delta+/fazla sayım delta- auto-unpublish trigger/no_change kayıt yok/not_found). Browser: 15 stok-in → 12 sayım Anlık kontrol → ledger "📋 Sayım -3 → 12"; aynı 12 sayım → "Sayım sistemdeki miktarla aynı — düzeltme yok" alert + no_change. 499 test passing, 0 lint+typecheck error. |
| 4.1 Stock Movements UI (3 drawer) | (yeni) | /admin/stock-movements ana sayfa (server: listStockMovements son 100 + listBranchOptions + listVariantOptions ürün/variant join + listSupplierOptions) + MovementsTable (📥 Giriş arrow / 📤 Çıkış cat / 🔁 Transfer line badge'ler, subtype Türkçe etiket sale/waste/gift/sample/return/internal_use/other, Önce/Δ/Sonra üç kolon, payment_method 💵/💳/🏦/📝 emoji, customerRef/documentNo/reason/transferGroup chip'ler, reversedById olanlar opacity 50 line-through) + DrawerLauncher 3 buton (Stok Girişi arrow / Çıkış cat / Transfer disabled 2+ şube yokken) + DrawerShell shared (right slide-in panel + backdrop + Escape close + body overflow lock + sticky header + max-w-lg) + 3 drawer (stock-in: şube/variant/qty/cost/supplier/document/lot/SKT/note; stock-out: şube/variant/subtype dynamic field visibility — sale priceField+customerField+paymentMethod, waste→reason, gift/sample→customerField, internal_use yok; credit+customerRef boş → "Veresiye satışta müşteri zorunlu" warning UI + helper invalid_state reject; transfer: kaynak+hedef select+variant+qty+note) + actions.ts (3 server action: stockIn/stockOut/transfer + Türkçe reason→message mapping + buildState shared + revalidatePath movements+products) + browser full flow (page açıldı 1 şube → Transfer disabled doğru; Stok Giriş drawer açıldı XL Boy 25 adet 2700₺ kaydet → drawer 800ms sonra kapandı → ledger "📥 Giriş +25 → 25 alış 2700₺" → DB branch_inventory.stock_qty=25 + products.total_stock_qty=25; vitrin manuel açıldı → Çıkış drawer 25 sale 3499₺ Toplu test alıcı → ledger 2 satır → DB vitrin_published=false + reason='stock_zero' + total_sold_qty=25 **auto-unpublish ✅**; yetersiz stok testi: 0 stok + 1 sale → alert "✕ Yetersiz stok (mevcut: 0, istenen: 1)" doğru) + 0 lint+typecheck error, 493 test passing (no UI test) — **NOT:** stocktake sayım Sprint 4.4, reversal R1 24h Sprint 4.5 |
| 4.0 Stock Movements Foundation | (yeni) | lib/stock/movements.ts: 3 ana helper transaction-based (recordStockIn alış girişi: yeni inventory satırı veya UPDATE, ilk hareket olabilir; recordStockOut satış/fire/hediye/numune/iade/dahili 7 subtype, sale+credit→customerRef zorunlu invalid_state, yetersiz stok early reject; recordTransfer kaynak+hedef iki entry aynı transferGroupId crypto.randomUUID, transferTargetBranchId reference, aynı şube reddedilir Zod refine, kaynak yetersiz reject + InsufficientStockError custom class). applyInventoryChange shared transaction helper: branch_inventory upsert (yoksa INSERT lastReceivedAt/SoldAt, varsa UPDATE stockQty + totalSoldQty) + products.totalStockQty denormalize SUM(branch_inventory.stockQty) tüm variantlar → tek update + stock-out sonrası tüm şube toplamı 0 + vitrinPublished → auto-unpublish vitrinAutoUnpublishedReason='stock_zero'. fetchVariantStockInfo: tek sorgu tenant ownership + current branch stockQty + inventoryRowId. lib/stock/list.ts: listStockMovements (filter: branch/variant/type + limit 100) + listVariantHistory (variant detayı için). 21 test (stockInSchema 4 + stockOutSchema 2 + transferSchema 2 + recordStockIn 4: ilk INSERT/UPDATE branch+tenant_check/Zod_fail + recordStockOut 5: happy_sale/insufficient_stock_meta/credit_no_customerRef_invalid_state/credit_with_customerRef/waste + recordTransfer 3: happy/insufficient/target_other_tenant + InsufficientStockError 1) + 493 test passing + 0 lint+typecheck error. **NOT:** UI Sprint 4.1+ (drawer'lar), stocktake recordStocktakeAdjustment Sprint 4.4 |

### 🛠 Stack Çalışan Durumda

- **DB:** Supabase Frankfurt EU (`rjzhnfqrynalklsnnuym`), 17 tablo, 8 migration (0000-0007), hepsi RLS enabled, **cities (81) + districts (974) seed edildi**, catalog 8 tablo + her tenant'a 16 default category register'da otomatik seed
- **Auth flow MVP:** /login (+ 2FA TOTP + remaining banner) + /register + /verify-email + /verify-email/[token] + /forgot-password + /reset-password/[token] + /2fa-setup + /onboarding (2 adım) + /account-locked (countdown) + /admin/security (disable/regen) + /admin/account + /verify-email-change/[token] + /cancel-email-change/[token] — tümü browser end-to-end geçti
- **Onboarding flow:** Register → verify → login → /onboarding (otomatik redirect) → şube + opsiyonel vitrin → / dashboard
- **Brute-force güvenlik:** 5 fail → 1h lock + Brevo email + Telegram alert + cookie state, 3 art arda lock → 24h kalıcı, /forgot-password lock bypass eder
- **Telegram:** Süperadmin alert kanalı stub (account_locked + 2fa_disabled + email_change_cancelled) — config gelince production ready
- **Sandbox-ready integrations:** iyzico + Nilvera + Brevo (key gelince aktif)
- **Memory:** test-first + ödeme integrity + sorusuz akış kuralları memory'de kayıtlı

### ⏭ Sıradaki — Yeni Session

| Sprint | İçerik | Tahmin |
|---|---|---|
| **3.3 (hazır 2026-05-21)** | Image upload — `SUPABASE_SERVICE_ROLE_KEY` eklendi: server upload + signed URL + thumbnail + product_images CRUD + `requireImage=true` aktive | 2-3 saat |
| 4 | Stok hareketleri UI + immutable ledger (4 drawer: stock-in/out/transfer/stocktake) + trigger'lar (append-only, branch_inventory auto-update, stock-0 vitrin çekme) | 3-4 saat |
| 1B.2 | stocktakes + stocktake_items + sessions (Auth.js Drizzle adapter) + vitrin_events tablolar | 1-2 saat |
| 2.10 | Settings sidebar layout (account / security / billing) — Sprint 9 ile birleşebilir | 1-2 saat |
| 1B | products + variants + branch_inventory + categories + brands + suppliers schema + 36 tablo komple | 3-4 saat |
| 1B+ | Onboarding'e "İlk ürün" 3. adımı ekle (products tablosu hazır olunca) | 30 dk |
| 14 sonu | Billing orchestrator (iyzico webhook → DB transaction → Nilvera invoice → audit) | 2-3 saat |
| 14 sonu | E2E mock flow test (webhook → DB → invoice complete) | 1 saat |

### 🔑 Bekleyen User Bloker

- iyzico sandbox + production API key (kullanıcı canlıya çıkmadan verecek)
- Nilvera API key + mali mühür sertifikası (şirket kuruluş sonrası)
- Brevo API key (production transactional email)
- Supabase Pro tier upgrade ($25/ay, lansman öncesi)

**Sprint 3.3 unblock 2026-05-21:** `SUPABASE_SERVICE_ROLE_KEY` .env'e eklendi (219 char JWT, anon=208'den farklı). Image upload artık server-side `service_role` ile yapılabilir. İmplementasyon yapılacak işler listesinde sıradaki yüksek öncelikli.

## 🆕 2026-05-14 Karar Revizyonu (TR-only + 3-tier B geri açıldı) — OTORİTATİF

> **Önceki 2026-05-13 "2-tier (FREE 50 / PRO ∞), PRO+ rafa" kararı İPTAL.** Yeni karar:

1. **3-tier (FREE / PRO / PRO+) geri açıldı** — *"FREE, PRO, PRO+ — sadece stok sayısına insanların artırmalarını istiyorum."*
   - **FREE 50 ürün** (0 ₺) — denemelik, mahalle pet shop
   - **PRO 500 ürün** (1.000 ₺/ay KDV dahil) — orta segment, esas pazar
   - **PRO+ Sınırsız** (2.000 ₺/ay KDV dahil) — büyük zincirler
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
   - %70 FREE × 0₺ + %25 PRO × 1.000₺ + %5 PRO+ × 2.000₺ = **350.000 ₺/ay brüt** (2026-05-21 güncel)
   - Net (vergi sonrası): **~193.000 ₺/ay ≈ $6.400/ay** — önceki realist $1.560'tan 4× iyi
   - Bkz. `DEPLOYMENT.md §6.4`

---

## 🆕 2026-05-13 Kararlar (Geçmiş — Bazıları 2026-05-14'te revize edildi)

Tartışmadan çıkan kararlar dokümanlara entegre edildi. **Önceki PetStockPro tasarımı (2026-05-12) bu kararlarla revize edildi.**

> ⚠ Aşağıdaki #1 (PRO+ rafa) kararı **2026-05-14'te iptal edildi** — yukarıdaki "Karar Revizyonu" bölümüne bakın.

### Büyük yapısal değişiklikler

1. **PRO+ tier RAFA kaldırıldı** ⚠ *İPTAL 2026-05-14* — *"PRO+ planını şimdilik rafa kaldıralım, satış olmasın, sadece stok takip uygulaması olarak ilerleyelim."*
   - ~~Önceki 20/100/sınırsız (3-tier) → **YENİ: FREE 50 / PRO sınırsız (2-tier)**~~
   - **2026-05-14 revize:** 3-tier B (FREE 50 / PRO 500 / PRO+ ∞) geri açıldı (pricing 750/1.750 → 2026-05-20 Karar C 1.250/2.250 → 2026-05-21 son 1.000/2.000)
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

### Karar A — PRO Upsell Motivasyonu ✅ **2026-05-22 REVİZE: 4 yeni farklılaşma**

> **2026-05-22 revize:** 2026-05-20 "(a) sade tut, tek farklılaşma stok limiti" kararı yetersiz görüldü. FREE 50 kullanıcı PRO'ya yükselmek için tek sayısal limit zayıf motivasyon. Yeni karar — kullanıcı 4 yeni farklılaşma ekledi (eşit rekabet felsefesi KORUNUR, sponsorship/sıralama bonusu YOK):

**Yeni 3-tier B kademeleme:**

| Özellik | FREE | PRO 1.000₺ | PRO+ 2.000₺ |
|---|---|---|---|
| Stok limiti | 50 | 500 | ∞ |
| **Vitrin limiti** (yeni) | 10 | 500 | ∞ |
| **Ürün ekleme** (yeni) | Manuel only | + Excel import | Hepsi |
| **Şube sayısı** (yeni) | Tek | ∞ | ∞ |
| **Raporlar** (yeni) | Pano + temel KPI | + Tam /admin/reports | Hepsi |
| Diğer (audit, 2FA, asistan, Telegram, vitrin görünürlük, vitrin metrikleri) | Aynı | Aynı | Aynı |

**Karar gerekçesi:**
- 4 farklılaşma hâlâ "sade" çünkü her biri **sayısal limit** (10/500) veya **doğal sınır** (manuel→Excel, tek→çoklu, basit→detaylı)
- "Mahalle pet shop ne için PRO?" sorusu net cevap: 500 ürün (Excel) + çoklu şube + raporlar
- Eşit rekabet (Karar A 2026-05-20 ana mesaj) **korundu** — sponsorship/rozet/sıralama bonusu YOK
- Vitrin metrikleri tüm planlarda eşit (kullanıcı bu seçeneği işaretlemedi)

**Önceki Karar A (2026-05-20):** "(a) sade tut, tek stok limiti" — yetersiz görüldü (revize).

### Karar B — WhatsApp Tıklama → İlgi Ölçümü Atfı

**Sorun:** Pet shop "47 tıklama, 12 ilgi dönüşümü" karşılaştıramaz çünkü WhatsApp atan müşteri pet shop'a "vitrin'den geldim" demiyor.

**Seçenek:**
- (a) **Olduğu gibi bırak** — pet shop disiplini ile takip eder, biz sadece tıklama veriyoruz (en sade)
- (b) WhatsApp deep link mesajına nötr **"Vitrin referans kodu: PSP-A4F7"** ekle → pet shop o kodu Stok Çıkışı drawer'ında "Vitrin Referans" alanına girince ilgi dönüşümü tag'lenir

**ÖNEMLİ NOT (2026-05-14):** Önceki taslakta "Sipariş kodu" denmişti, **revize edildi → "Vitrin referans kodu"**. "Sipariş" sözcüğü yanıltıcı çünkü **biz sipariş almıyoruz** (bkz. EKRAN-PUBLIC-VITRIN §13.4 Para Akışı). Sadece "WhatsApp tıklama → pet shop'un kendi defterindeki satış" eşleştirmesi için iz tag.

**Aday:** (a) **Olduğu gibi bırak** — sade tut, fazla mühendislik. Vitrin metrikleri sadece tıklama gösterir, pet shop disiplini ile gerçek satışı karşılaştırır. Böylece "sipariş" kelimesi vitrin tarafında hiç görünmez, para akışı çizgisi net kalır.

**(b) seçenek istersen Faz 2'de eklenebilir** — küçük UX, opsiyonel kullanım.

### Karar C — Pricing + Hedef (Gelir Hedefi) ✅ **2026-05-20 KARAR: (a) Pricing yükselt**

**Sorun:** 1K tenant × %5 PRO × 750₺ = 25K₺/ay (~$833) → maliyet sonrası net $500 → tek geliştirici geçim parası bile değil.

**Karar:** ✅ **(a) Pricing yükselt** — PRO 750₺ → **1.250₺** (2026-05-20) → **1.000₺** (2026-05-21 revize), PRO+ 1.750₺ → **2.250₺** (2026-05-20) → **2.000₺** (2026-05-21 revize). "Fiyat artırmayalım" kullanıcı kararıyla Karar C revize'den orta seviyeye düşürüldü:
- 1K tenant × %25 PRO × 1.000₺ = 250.000₺
- 1K tenant × %5 PRO+ × 2.000₺ = 100.000₺
- Toplam brüt ~425.000₺/ay, net ~298K₺/ay = **~$9.900/ay net** (önceki ~$6.400'den iyileşti)

**Hedef tenant:** 1K tenant (2-3 yılda). 5K hedefe geçiş ise lansman sonrası 12 aylık conversion ölçümü ile yeniden değerlendirilir.

**Etkilenen dosyalar:** `lib/constants/plan-limits.ts`, `lib/billing/totals.ts`, `db/schema/index.ts`, `app/page.tsx`, `app/fiyatlar/page.tsx`, `app/mesafeli-satis-sozlesmesi/page.tsx`, `app/admin/superadmin/bypass/plan-override/form.tsx`, `PLAN-KADEMELERI.md`.

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
| `PLAN-KADEMELERI.md` | **3-tier B (2026-05-21 son revize): FREE 50 / PRO 500 1.000₺ / PRO+ ∞ 2.000₺, TR-only** — tek farklılaşma stok limiti |
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
2. **Plan limitleri:** **3-tier B: FREE 50 / PRO 500 / PRO+ ∞ — TR-only.** Tek farklılaşma stok limiti. Diğer tüm özellikler her planda açık. **Pricing (2026-05-21 son revize): PRO 1.000₺ + PRO+ 2.000₺** (tarihçe: 2026-05-14 750/1.750 → 2026-05-20 Karar C 1.250/2.250 → 2026-05-21 "fiyat artırmayalım" 1.000/2.000). 2026-05-13 "2-tier, PRO+ rafa" kararı iptal edildi.

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
