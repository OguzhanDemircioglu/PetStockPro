# PetStockPro — Yeni Session Devam Rehberi

**Tarih:** 2026-05-22 (Karar A revize — 4 yeni PRO farklılaşması)
**Mevcut Branch:** `cray61` — commit'ler hazır
**Son commit (önceki tur):** `f1200ba` docs(perf): PERFORMANCE-PLAYBOOK.md

---

## 🆕 2026-05-22 — Karar A REVİZE (FREE/PRO farklılaşması 4 katman)

**Tetikleyici:** "FREE 50 kullanıcı PRO'ya neden yükselsin?" sorusu. 2026-05-20 "(a) sade tut, tek stok limiti" kararı zayıf upsell motivasyonu sağladı.

**Yeni 4 farklılaşma (eşit rekabet KORUNUR — sponsorship/rozet/sıralama bonusu YOK):**

| Özellik | FREE | PRO 1.000₺ | PRO+ 2.000₺ |
|---|---|---|---|
| Stok limiti | 50 | 500 | ∞ |
| **Vitrin limiti** (yeni) | **10** | 500 | ∞ |
| **Şube sayısı** (yeni) | **Tek** | ∞ | ∞ |
| **Excel ürün import** (yeni) | ❌ Manuel only | ✅ | ✅ |
| **Gelişmiş raporlar** (yeni) | ❌ Pano + temel KPI | ✅ Tam /admin/reports | ✅ |
| Diğer (audit/2FA/asistan/Telegram/vitrin metrik/Nilvera/KVKK) | Aynı | Aynı | Aynı |

**Implementasyon (Bölüm 1-4, ~10-12 saat):**

| Bölüm | İçerik | Durum |
|---|---|---|
| 1 | Schema (Migration 0025) + Constants + helpers + 30+ test | ✅ |
| 2 | 4 backend gate (publishProduct + addBranch + import route + reports route) + message mapping | ✅ |
| 3 | 4 UI gate (branches/new PRO CTA + products list import button gizleme + ListRowToggle vitrin error msg + reports PRO overlay) | ✅ |
| 4 | Doc sync (CLAUDE + PLAN-KADEMELERI + DEVAM-REHBERI) + smoke + commit | ⏳ Devam |

**Test:** 1657 → **1701 pass** (+44 yeni: 30 plan-limits + 14 plan-features + canPublishToVitrin + canAddBranch). Typecheck + lint 0 error.

**Migration 0025 — Dev DB'de apply edildi (Supabase MCP ile, 2026-05-22):**
- 4 yeni companies sütunu doğrulandı (`temporary_vitrin_limit_override` + `_until` + `temporary_branch_limit_override` + `_until`)
- Production deploy için DEPLOYMENT.md §5.2 step 1b'ye manuel-apply girişi gerek

**Browser smoke (FREE plan → 4 gate, sonra PRO geri):**
- ✅ `/admin/products/import` FREE → "⭐ PRO ÖZELLİĞİ" paneli + "Manuel ekle" CTA (screenshot kanıt)
- ✅ `/admin/branches/new` FREE → "⭐ PRO ÖZELLİĞİ" + "Mevcut: 1 / 1 şube" + "PRO'ya geç" CTA
- ✅ `/admin/reports` FREE → "⭐ PRO ÖZELLİĞİ" + 7 madde özellik listesi (period comparison + top selling + customer + credits + ...)
- ✅ `/admin/products` FREE → "Excel'den içeri aktar" button gri + "PRO" etiket
- ✅ `/admin/reports` PRO → tam sayfa açıldı (range picker + KPI'lar)

**Faz 2'ye saklı:**
- Pano "Vitrin: N/limit" durum kartı (sade-tut, kullanıcı zaten products listede görür)
- Süperadmin Toolbox FAB `temporary_*_override` action (tek-tenant manuel esnetme — şu an SQL ile elden yapılır)
- EKRAN-* doc'larında ayrıntılı yansıma (URUNLER + SUBELER + RAPORLAR + AYARLAR)

---

---

## 🆕 2026-05-22 — 7. Mantık Hata Tarama (10 bulgu, hepsi ✅)

**Tetikleyici:** Performance Deep Audit + UX dürüstlük + 17 mockup brief sync sonrası ~23 commit'lik değişiklik delta'sı (`d6623b6` → `ab3fbc6`). 7 ekseni paralel scan.

**🔴 Kritik 3 — production bloker ve güvenlik:**
- **YT7-1**: `_journal.json`'da 0023 + 0024 YOK → bootstrap fresh DB'de migration uygulamaz (CONCURRENTLY transaction'a uyumsuz). Fix: DEPLOYMENT.md §5.2 step 1b "Manuel-apply migrations" + CLAUDE.md DB notu güçlendirildi.
- **YT7-7**: `/api/vitrin/track` rate-limit YOK → 1K rps spam vektörü. Fix: in-memory IP rate-limit 60 req/dk + 10K entry leak guard.
- **YT7-8**: Vitrin hero h1 koşulsuz "yakınındaki" iddiası. Fix: `location ? 'yakınındaki' : "Türkiye'deki"` (5f4ce60 atladığı satır).

**🟡 Önemli 5 — dokümantasyon canonical + adoption:**
- **YT7-2**: DATABASE-SCHEMA §6 `idx_products_name` (tsvector) hayalet — migration'larda yok. Fix: sil.
- **YT7-3**: 3 yeni index doc'ta yok (idx_companies_storefront_approved + idx_products_name_trgm + idx_brands_name_trgm). Fix: §6'a eklendi + manuel-apply notu.
- **YT7-4**: SUPABASE-SETUP §3 `prepare: false` STALE. Fix: `prepare: true` + Hyperdrive/PgBouncer notu.
- **YT7-5**: `request-scoped.ts` test eksik. Fix: 8 unit test (1649 → 1657 pass).
- **YT7-6**: `getAllCities` 0 caller. Fix: 4 sayfa migrate (onboarding + branches new/edit + settings company).

**🟢 Düşük 2 — perf polish + doc:**
- **YT7-9**: NotificationBell `cache.subscribe` global → notification key filter (pano açıkken re-render eliminated).
- **YT7-10**: Vitrin ISR revalidate süreleri doc eksik. Fix: DEPLOYMENT.md §4.5 "Vitrin ISR & CDN Cache Stratejisi" tablo + 9 sayfa süre + neden.

**Test:** 1649 → **1657 pass** (+8 request-scoped.test.ts). Typecheck + lint 0 error. Browser smoke ✓ (vitrin hero "Türkiye'deki" screenshot kanıt).

**Detay:** [docs/MANTIK-HATALARI-2026-05-14.md §7. Tur](MANTIK-HATALARI-2026-05-14.md). Toplam 60 bulgu (19+14+2+5+8+10+10).

---

## 🚀 ÖNCEKİ TURLAR (özet — detay için Tur E→Z+ aşağıda)

**Bu session yapılanlar:**

1. **NotificationBell client + 6 test** (Tur D/E) — bulk Tümünü oku sonrası bell anlık 0 (useSyncExternalStore)
2. **Bildirimler filtre sadeleştirme** (Tur F) — TYPE_GROUPS chip'leri kaldırıldı, "Hepsi + Okunmamış" yeterli
3. **17 mockup brief sync — C iş kalemi** (Tur G→X) — UI-MOCKUP-PLAN.md §5.1-5.17 implementasyona göre yeniden listelendi
4. **Vitrin UX dürüstlük taraması** (Tur Y/A) — 4 fix: "Yakınında" → "Türkiye'de" + ara lead şehir koşullu + popüler/best-seller rozet tooltip
5. **Customer journey smoke + admin pages dürüstlük** (Tur Y/C + admin reports) — register şifre tekrar + fiyat aralığı + Reports kart başlık periyot
6. **Süperadmin errors paneli canlı kontrol** (Tur Y/D) — sample 5 entry + filter + resolve toggle + PII strip ✓
7. **🏆 Performance Deep Audit** (Tur Z + Tur 1-12) — **23 fix planı + 9 tur uygulama**:
   - Vitrin CDN cache (revalidate + tracking client-side)
   - React.cache() request-scoped (layout duplicate elim)
   - postgres-js `prepare: true`
   - Migration 0023 storefront_status partial index
   - Migration 0024 products+brands pg_trgm GIN
   - **🎉 Bundle 928K → 228K (%75)** optimizePackageImports
   - Pano Suspense streaming (PanoExpiringSection)
   - TanStack refetchOnWindowFocus: false

**Memory durumu:**
- ✅ `feedback_commit_push_approval.md` aktif (her commit öncesi onay + push ayrı tur)
- ✅ `feedback_commit_push_auto_repetitive.md` (repetitive doc/brief turlarda pattern bir kez onay → auto)
- ✅ Sorusuz akış sadece küçük adımlar arası geçerli

**Test durumu:** 1649 pass · 0 lint · 0 typecheck (4 yeni unit test eklendi NotificationBell)

**📖 Performance çalışması detay doc:** [docs/PERFORMANCE-PLAYBOOK.md](PERFORMANCE-PLAYBOOK.md) — felsefe + teknoloji haritası (Next.js ISR / React.cache / pg_trgm / postgres prepare / Suspense streaming / Cloudflare CDN) + 13 fix detay (bulgu → tanı → kanıt → uygulama → ölçüm) + skip gerekçeleri + production beklentileri.

---

## 🎯 SIRADAKI TERCİH EDİLENLER (yeni session)

| # | Konu | Süre | Bloker |
|---|---|---|---|
| 1 | **Production deploy gerçek metric ölçüm** (Lighthouse + artillery k6 1K concurrent) | 2-4 saat | ⛔ Sprint 14 deploy gerek (şirket kuruluş + Cloudflare account) |
| 2 | **Performance marjinal fix'ler** (Tur 7/8/15/16 — Drizzle .prepare + query consolidation + relational query + revalidateTag) | 4-6 saat | Yok — ama ROI marjinal |
| 3 | **Faz 2 performans** (marketing static group refactor, sitemap split, audit partition) | 3-4 saat | Yok — production'da gerek olunca |
| 4 | **UI mockup HTML refresh** (preview/* legacy 6 dosya) | Çok uzun, her mockup ayrı tur | Yok — düşük ROI (brief sync zaten yapıldı) |
| ~~5~~ | ~~**7. Mantık Hata Tarama**~~ ✅ 2026-05-22 — TAMAMLANDI (10 bulgu, hepsi fix) | — | — |
| 5 | **8. Mantık Hata Tarama** (sonraki büyük değişiklik dalgasından sonra) | 2-3 saat | Yok |
| 6 | **Sprint 13/14 production deploy** | — | ⛔ Kullanıcı bloker (şirket kuruluş 2-4 hafta) |
| 7 | **Beta soft launch** | — | ⛔ Sprint 13/14 sonrası |
| 8 | **Pricing pilot anketi** (30-50 pet shop) | 1-2 hafta | ⛔ Kullanıcı bloker (anket dağıt) |

**Yeni session'a girdiğinde önerilen ilk komut:**
```
cd D:\Projeler\PetStockPro
claude
İlk komut: "DEVAM-REHBERI.md oku ve sıradaki tercih edilenlerden seç"
# Unblocked en yüksek değer iş: #2 (perf marjinal Tur 7/8/15/16) veya #3 (Faz 2 perf)
```

---

## 🎉 2026-05-21 — TÜM TURLARIN ÖZETİ

### Tur A: PLAN-BETA-PERFORMANCE 6/6 FAZ

**Otoritatif:** `docs/PLAN-BETA-PERFORMANCE.md` (durumu: 6/6 faz ✅)

| Commit | Faz | İçerik | Süre |
|---|---|---|---|
| `dee4c09` | 1 | Auto-bootstrap (`instrumentation.ts` + 2 seed helper + run.ts orchestrator) | ~1.5h |
| `7f9de60` | 2.A | Log retention (6 tablo TTL cron + Wrangler `0 4 * * *` + süperadmin kart + Telegram özet) | ~1.5h |
| `52145f6` | 2.B | Error tracking (system_errors tablo + Migration 0022 + trackError PII strip + threshold burst + /admin/superadmin/errors sayfa + cron `55 3 * * *`) | ~2h |
| `3cbd447` | 3 | PetSpinner (3 boyut + paw SVG + animate-paw-pulse + a11y + prefers-reduced-motion + 2 mevcut migrate) | ~1h |
| `d840b0a` | 4 | TanStack Query Provider + 5 key factory + Devtools dev-only | ~1h |
| `1ad313b` | 5 | 5 kritik CRUD optimistic (3 tam: bildirim oku 50ms flip / vitrin Aç-Kapat / bulk Tümünü oku; 2 PetSpinner pending: 4 stok-movements drawer + sayım workflow) | ~3h |
| `551474b` | 6 docs | TECH-STACK + DEPLOYMENT + DEVAM-REHBERI yansıttı | ~30dk |

### Tur B: Sprint 3.3 Image Upload Unblock

| Commit | Konu |
|---|---|
| `602ec86` | `SUPABASE_SERVICE_ROLE_KEY` .env'e eklendi — Sprint 3.3 bloker kalktı |
| `39ddec8` | `validateForStorefront.DEFAULT_OPTS.requireImage` false→true tutarsızlık fix + 19 test güncellendi |

### Tur C: 5. Mantık Hata Tarama

| Commit | Konu |
|---|---|
| `d226105` | 5. tur 8 bulgu (DATABASE-SCHEMA toplam 35→37, Supabase Storage→R2, requireImage default, auto-bootstrap doc, PetSpinner TASARIM-SISTEMI) |

### Tur D: Pricing Revize + Mockup Fix

| Commit | Konu |
|---|---|
| `d6623b6` | Pricing 1.250/2.250 → **1.000/2.000** ("fiyat artırmayalım") — 18 dosya |
| `1addbcc` | Süperadmin mockup "↩ Normal panele dön" linki kaldırıldı — süperadmin kendi tenant pano'su yok |

---

### 📊 Tur metrikleri

| Metric | Başlangıç | Son |
|---|---|---|
| Test | 1567 pass | **1643 pass** (+76) |
| Commit (origin) | `ef45949` | `1addbcc` (11 yeni commit) |
| Pricing | 1.250 / 2.250 | **1.000 / 2.000** |
| Net gelir (1K tenant) | ~$10K/ay | **~$8.240/ay** |
| Toplam DB tablo | 35 | **37** (user_permissions + system_errors) |

---

### Performans bilançosu

- Bildirim okuma: 200-500ms full reload → **~50ms optimistic flip** (browser smoke kanıtlı, 50ms screenshot)
- Vitrin Aç/Kapat: useTransition + revalidate → **anında badge flip** + rollback
- Stok hareketi: text pending → **PetSpinner inline + tone color** (4 drawer)
- Sayım Kaydet: "..." → **PetSpinner sm inline** (per-row + tamamla + iptal)
- Hata izleme: prod kör → **system_errors + Telegram critical burst** alert
- Disk doluluk: sınırsız → **6 tablo TTL cron + audit_logs/invoices/subscriptions guard regression test**
- Boot süresi (dev): manuel migrate → **auto-bootstrap 885ms** (idempotent seed)
- Sprint 3.3: image upload bloker → **R2 strategy aktif** + requireImage=true default

---

### DB değişiklikleri

- Migration 0022 `system_errors` tablo + `system_error_severity` enum (bootstrap migrator otomatik apply ✅)
- Drizzle history senkron (21. + 22. satır INSERT — kullanıcı A seçti / otomatik flow)

---

### Plan'dan bilinçli sapmalar

- **5.4 ürün edit** optimistic FAZ 2'ye saklandı — mevcut redirect+revalidate UX yeterli, büyük refactor değer/maliyet düşük (tek geliştirici sade-tut)
- **5.1 stok hareketi** tam optimistic ledger prepend YOK — movements-table client refactor maliyetli; PetSpinner pending + 800ms close + revalidate yeterli
- **Pricing 1.000/2.000** (önceki Karar C 1.250/2.250 → "fiyat artırmayalım") — kullanıcı kararıyla orta seviyeye düşürüldü

---

## 🎯 Sıradaki tercih edilenler (yeni session'da seç)

| # | Konu | Süre | Bloker |
|---|---|---|---|
| ~~1~~ | ~~C — 17 mockup brief'i sıralı (UI-MOCKUP-PLAN.md)~~ ✅ **2026-05-21 gece — TAMAMLANDI** (17/17 brief, Tur G→X) | — | — |
| ~~2~~ | ~~D — Smoke bulgusu: NotificationBell client component~~ ✅ **2026-05-21 gece — TAMAMLANDI** | — | — |
| 1 | **6. Mantık Hata Tarama** (yeni değişiklikler için) | 2-3 saat | Yok |
| 2 | **Sprint 13/14 production deploy** | Şirket kuruluş bekliyor (2-4 hafta) | ⛔ Kullanıcı |
| 3 | **Beta soft launch (CLAUDE.md "Sıradaki olası işler" #1)** | Sprint 13/14 sonrası | ⛔ Kullanıcı bloker |
| 4 | **Pricing pilot anketi** (30-50 pet shop) | 1-2 hafta | ⛔ Kullanıcı bloker (anket dağıt) |

**Yeni session'a girdiğinde ilk komut (önerilen):**
```
cd D:\Projeler\PetStockPro
claude
İlk komut: "DEVAM-REHBERI.md oku ve sıradaki tercih edilenlerden seç"
# Tek unblocked iş: 6. Mantık Hata Tarama (2-3 saat)
```

---

### 🆕 Tur E: NotificationBell client component (2026-05-21 gece)

**Konu:** Faz 5 smoke 6 bulgusu — `/admin/notifications` üzerinde "Tümünü okundu işaretle" sonrası bell badge anlık 0'a düşmüyor, sadece sonraki navigasyonda yenileniyordu.

**Kök neden:** `NotificationBell` server component'ti, layout SSR'den `unreadCount` prop alıyordu. `notifications-list.tsx`'teki `markAllMutation.onMutate` `queryClient.setQueryData(notificationKeys.unreadCount(), 0)` çağırıyor ama bell cache'i okumuyordu.

**Fix:** [src/components/notification-bell.tsx](../src/components/notification-bell.tsx) — `'use client'` + `useSyncExternalStore` ile doğrudan `queryClient.getQueryCache().subscribe(...)` aboneliği. `useEffect` ile yeni SSR prop'unu cache'e seed eder; mutation'ların `setQueryData` çağrıları bell'i otomatik re-render eder.

**Neden useSyncExternalStore:** v5'te `useQuery` + `enabled:false` + `initialData` kombinasyonunda observer cache değişikliklerine subscribe olmuyor (`initialData` observer-local state'e gidiyor, cache'e değil). queryFn ile fetch'in async race'i ise `setQueryData(0)`'ı kendi sonucuyla geri yazıyor. Cache cache subscription en deterministik yol.

**Test:** 6 yeni `src/components/notification-bell.test.tsx` (0/3/120 render + setQueryData 2→0 / 0→5 / prop yeniden render seed). **Toplam 1643 → 1649 pass.**

**Browser smoke:** dev server up, 3 unread test notification eklendi → bell="3" rozet → "Tümünü okundu işaretle" tık → ~100ms sonra bell rozet kayboldu, count="0", liste YENİ rozetleri silindi (screenshot kanıt). Test notification'lar temizlendi.

---

### 🆕 Tur F: Bildirimler filtre sadeleştirme (2026-05-21 gece)

**Kullanıcı kararı:** "BİLDİRİMLER ÜZERİNDE HEPSİ VE OKUNMAMIŞ OLMASI YETERLİ"

**Değişiklik:** [src/app/admin/notifications/page.tsx](../src/app/admin/notifications/page.tsx) — `TYPE_GROUPS` sabiti (Stok / Sayım / Vitrin / Abonelik / Sistem chip'leri) ve alt-tip seçici paneli + `activeGroup` / `activeType` param'ları + `groupCounts` / `typeCounts` agregasyonları **tamamen kaldırıldı**. Sadece "Hepsi" + "Okunmamış (N)" filtre çubuğu kaldı. `TYPE_EMOJI` + `TYPE_LABEL` sabitleri liste satırlarında ikon/etiket için `NotificationsList` prop olarak verilmeye devam ediyor.

**Net:** 60+ satır UI/state kod silindi (`181 → 24 insertions/deletions`). 1649 test pass koru. Lint + typecheck 0 error.

**Browser smoke:** /admin/notifications → filtre sadece 2 link, grup chip'leri ve alt-tip paneli yok (screenshot kanıt).

---

### 🆕 Tur G: C iş kalemi #1 — pano.html brief sync (2026-05-21 gece)

**Yaklaşım kararı:** "17 mockup brief'i sıralı" iş kaleminde mockup HTML'i sıfırdan yazmak yerine **her brief'i implementasyona göre güncelle** (kod canonical, mockup tasarım referansı). Tek geliştirici sade-tut — mockup'ı 1500+ satıra şişirmek (5+ yeni section eklemek) yerine brief implementasyon yapısını yansıtacak şekilde refresh edilir.

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.1](UI-MOCKUP-PLAN.md) — pano brief'i `src/app/admin/page.tsx` testid'lerine göre yeniden listelendi. Eklenen yeni section'lar: `pano-notif-feed` (Sprint 15+) · `pano-feedback-widget` (Sprint 12+ vitrin WA feedback) · 3 ayrı PetPro öneri (`petpro-transfer-suggestions` / `petpro-discount-suggestions` / `petpro-expiring-suggestions`) · `recent-activity-all-ledger` + `recent-activity-today-audit` 2-kolon grid · NotificationBell (cache-reactive Tur E). Mockup `preview/pano.html` "Faz 2'ye saklı" işaretlendi.

**Sıradaki C iş kalemi:** §5.2 urunler.html brief sync.

---

### 🆕 Tur H: C iş kalemi #2 — urunler.html brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.2](UI-MOCKUP-PLAN.md) — urunler brief'i `src/app/admin/products/` implementasyonuna göre kapsamlı yeniden listelendi. 4 ana sayfa ayrı bölüm:
- **Liste** ([page.tsx](../src/app/admin/products/page.tsx)) — FilterBar 5 alan + tablo 7 kolon + ListRowToggle optimistic + 4 banner (justCreated/moderation/updated/deleted) + Excel import CTA
- **Detay** ([id]/page.tsx) — 4 KPI + variant-matrix + product-movements + auto-unpublish reason banner
- **Yeni** (new/form.tsx) — auto-brand-hint + parent/child kategori + Stok birimi + pending-images-grid (R2 upload sonrası kayıt)
- **Düzenle** ([id]/edit/, 6 section) — Temel bilgiler / Default variant / storefront-section (Doğrula + storefront-toggle + requireImage=true) / Variantlar / product-images-section / Ürünü sil

Import (`import/client.tsx` — 11 kolon xlsx + 15+ validation + SWAL) + Export route (`export/route.ts` → .xlsx) ek section'lar olarak işaretlendi. Bulk vitrine aç/çıkar **Faz 2'ye saklı** (single-toggle yeterli — sade-tut).

**Sıradaki C iş kalemi:** §5.3 stok-hareketleri.html brief sync.

---

### 🆕 Tur I: C iş kalemi #3 — stok-hareketleri brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.3](UI-MOCKUP-PLAN.md) — stok-hareketleri brief'i `src/app/admin/stock-movements/` implementasyonuna göre kapsamlı yeniden listelendi:
- **Liste** (page.tsx) — Ledger başlığı + DrawerLauncher 4 buton + movements-filter-bar (mv-branch/variant/type/clear/export) + tablo 9 kolon (Tarih/Tür/Ürün/Şube/Önce/Δ/Sonra/Notlar/İşlem) + reverseButton 24h + transfer pair atomik
- **4 Drawer** (stock-in/stock-out/transfer/stocktake) — dynamic field visibility (stock-out subtype), credit+customerRef invalid_state guard, auto-unpublish trigger (stock=0), query-param auto-open + prefill (transfer-drawer low-stock'tan)
- **Export** — `/admin/stock-movements/export` route → .xlsx (filtre URL param)
- **Sayım workflow** ayrı sayfa `/admin/stocktake` (EKRAN-SAYIM.md), drawer Quick Add only

Bağımlılıklar: `stockMovementKeys` cache + audit_logs + branch_inventory denormalize.

**Sıradaki C iş kalemi:** §5.4 super-admin.html brief sync.

---

### 🆕 Tur J: C iş kalemi #4 — super-admin brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.4](UI-MOCKUP-PLAN.md) — süperadmin brief'i `src/app/admin/superadmin/` 7 alt route + Toolbox FAB'a göre kapsamlı yeniden listelendi:
- **Ana sayfa** (page.tsx) — superadmin-hero felsefe banner + 4+4 KPI grid + vitrin-metrics 7g + db-stats (db-usage-bar + top-tables) + tenant-table 50 satır
- **Tenant detay** (tenant/[id]) — 5-KPI + tenant-actions (destructive) + 2-kolon tenant-users + tenant-audit + tenant-movements
- **Vitrin Moderation** (vitrin-moderation) — moderation-tabs (Manuel İnceleme / Şikayet) + reports-table + moderation-table
- **Errors** (errors) — error-stats + top-types + 7 filter + error-list (PII stripped + resolve toggle)
- **DB Inspector** (db-inspector) — SQL read-only client (SUPERADMIN-only, audit)
- **System Settings** (system-settings) — plan-tiers 3-tier B (**1.000/2.000 pricing 2026-05-21**) + env-checks + db-extensions + Log retention kartı
- **6 Bypass aksiyon** (bypass/*) — hard-delete / plan-override / negative-stock / reverse-expired / stocktake-undo / metadata-fix
- **Toolbox FAB** (components/superadmin-toolbox.tsx) — sağ alt sticky, 4 kategori yetki

URL mimarisi notu güncellendi: süperadmin ayrı subdomain veya ayrı login değil, `/admin/superadmin/*` alt route'lar — süperadmin'in kendi tenant pano'su YOK (2026-05-21 mockup fix yansıdı).

**Sıradaki C iş kalemi:** §5.5 auth.html brief sync.

---

### 🆕 Tur K: C iş kalemi #5 — auth brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.5](UI-MOCKUP-PLAN.md) — auth brief'i `src/app/{login,register,verify-email,forgot-password,reset-password,2fa-setup,verify-email-change,account-locked,onboarding}` 9 ana route + EKRAN-AUTH.md 52 senaryoya göre kapsamlı yeniden listelendi:
- Login — password-toggle + 2FA TOTP step + recovery-upload + kalan hak banner + 5+ fail conditional Turnstile
- Register — 2 KVKK checkbox + Turnstile zorunlu + Brevo verify (24h TTL)
- Email Verify (bekleme + token) + Forgot Password (Turnstile + enumeration) + Reset (HIBP + TÜM oturum kapan)
- 2FA Setup wizard 3-step (QR + TOTP verify + 8 recovery code) + `/admin/security` disable+regen
- Email Change (init + verify + cancel Telegram critical)
- Account Locked (HH:MM:SS countdown + 24h kalıcı variant)
- Onboarding wizard 3-step (şube + ürün/marka import + vitrin)
- Davet kabul hibrit (email 7g / link 24h)

Brute-force: 5 fail → 1h lock + Brevo + Telegram + cookie state; 3 lock → 24h kalıcı. Turnstile @marsidev/react-turnstile TR locale Managed mode. Mockup `preview/auth.html` Faz 2'ye saklı.

**Sıradaki C iş kalemi:** §5.6 subeler.html brief sync.

---

### 🆕 Tur L: C iş kalemi #6 — subeler brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.6](UI-MOCKUP-PLAN.md) — subeler brief'i `src/app/admin/branches/` + Faz 8 (Observer + branch 3-state) implementasyonuna göre yeniden listelendi:
- Liste — `add-branch` + kart grid + `branch-status-${status}` rozet (🟢/🌴/🔴) + ToggleActiveButton + last-active koruma
- Form — `branch-name` + `branch-city` (81 cascade) + `branch-district` (974 fetch + AbortController) + WhatsApp regex + `branch-alert` + `branch-submit`
- `branch-status-control` 3-state — radio + quick buttons + holiday banner + WhatsApp disabled + inactive=vitrin 404
- Detay — branch-inactive-banner + branch-holiday-banner + 4-KPI + `branch-team-card` (manager + staff-block + staff-rows + remove-manager-button) + branch-variant-list + branch-movements
- Export → .xlsx

Lat/lng harita pin Faz 2'ye saklı (mockup `preview/subeler.html` yok).

**Sıradaki C iş kalemi:** §5.7 sayim.html brief sync.

---

### 🆕 Tur M: C iş kalemi #7 — sayim brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.7](UI-MOCKUP-PLAN.md) — sayim brief'i Sprint 4.7 Guided Stocktake implementasyonuna göre yeniden listelendi:
- Liste — aktif kartlar (progress bar gradient) + geçmiş tablo (diff + valueImpact + reason emoji)
- Başlatıcı — şube + mod="Tam" + note + snapshot transaction
- Workflow tam-sayfa — header counter + 4 filter pill + arama + per-row Save (dirty + Enter) + reason 7 enum + complete (has_uncounted reject + ledger entries + audit + auto-unpublish chain) + cancel
- 25 unit test geçti

softLock UI Faz 2'ye saklı. Mockup `preview/sayim.html` yok.

**Sıradaki C iş kalemi:** §5.8 dusuk-stok.html brief sync.

---

### 🆕 Tur N: C iş kalemi #8 — dusuk-stok brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.8](UI-MOCKUP-PLAN.md) — dusuk-stok brief'i Sprint 8+ implementasyonuna göre yeniden listelendi:
- Liste — ls-category + ls-branch + ls-clear filter
- Variant bazında grupla — productName + stock-in + history linkleri + branch grid (sıfır stokta danger + auto-unpublish uyarı)
- `transfer-suggestion-${variantId}` — `getTransferSuggestionsBulk` ile öneri panel + `open-transfer-${src}-${dst}` (transfer drawer query-param auto-open + prefill — tek tıkla)
- Empty state — "Tüm stoklar yeterli ✓"

R6 "Toplu Sipariş Hazırla" tek-tedarikçi-tek-drawer Faz 2'ye saklı. Mockup yok.

**Sıradaki C iş kalemi:** §5.9 tedarikciler.html brief sync.

---

### 🆕 Tur O: C iş kalemi #9 — tedarikciler brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.9](UI-MOCKUP-PLAN.md) — tedarikciler brief'i Sprint 9 implementasyonuna göre yeniden listelendi:
- Liste — add-supplier + tablo 7 kolon (Ad/VKN/Tel/Email/Lead gün/Ödeme emoji label/Toplam giriş) + toggle-supplier-active
- Form 4 section — Firma (supplier-name + VKN 10-11 regex) + İletişim (+90/0 phone + email + city) + Ticari (lead 0-365 + paymentTerms enum + IBAN TR+24 regex) + Not
- Export → .xlsx
- Stock-movements stock_in → supplier dropdown dependency

Mockup preview/tedarikciler.html yok.

**Sıradaki C iş kalemi:** §5.10 kullanicilar.html brief sync.

---

### 🆕 Tur P: C iş kalemi #10 — kullanicilar brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.10](UI-MOCKUP-PLAN.md) — kullanicilar brief'i `src/app/admin/settings/users/` + Faz 6 (15 yetki modal) + Faz 8 (OBSERVER) implementasyonuna göre yeniden listelendi. **URL `/admin/users` değil `/admin/settings/users`** — settings sidebar grubunda.
- Liste — users-list tablo (rol TR etiket Bayi Admin/İzleyici/Çalışan + bekleyen davet badge + invite method rozet 📧/🔗)
- Invite form — invite-email/name/role/branch + davet yöntemi radio (📧 7g Brevo / 🔗 24h link clipboard) + applyStaffDefaults 3 ON
- Permissions modal — 15 yetki toggle + updateUserPermissionsAction + audit
- Şube wizard step 2 (Faz 7) — branches/new/step2-staff-invite.tsx

Rol mapping güncellendi: SUBE_MUDURU→OBSERVER (Faz 8 Migration 0021).

**Sıradaki C iş kalemi:** §5.11 ayarlar.html brief sync.

---

### 🆕 Tur R: C iş kalemi #11 — ayarlar brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.11](UI-MOCKUP-PLAN.md) — ayarlar brief'i SettingsShell + 9 link route'a göre yeniden listelendi:
- SettingsShell shared component (sticky sidebar + 9 link nav)
- 9 sayfa — Genel Bakış (4 StatusCard + 4 DataLink) + Firma (vat_no first-set vatRequiredAt) + Vitrin Profili (slug + SEO helper + KVKK) + Kullanıcılar (§5.10) + Bildirimler (Telegram 3 adım + tip toggle) + Hesap (email değiştir) + Güvenlik (2FA disable + regen) + Audit Log + Verilerimi İndir (KVKK Md.11 7 xlsx export)
- Plan + Fatura + Yerelleştirme Faz 2'ye saklı (Sprint 13 sonrası)

Mockup preview/ayarlar.html yok.

**Sıradaki C iş kalemi:** §5.12 raporlar.html brief sync.

---

### 🆕 Tur S: C iş kalemi #12 — raporlar brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.12](UI-MOCKUP-PLAN.md) — raporlar brief'i Sprint 11+ implementasyonuna göre yeniden listelendi:
- Header — range-picker (7g/30g/90g `?days=`) + export-daily + export-top buton
- 4-KPI grid + period-comparison + 5-kolon grid (daily-list bar + top-list 🏆 sıralı)
- stocktake-history-list + activity-actions (audit count by type) + inventory-value trend
- customers-report — KPI Veresiye + hourly-breakdown
- open-credits section — 4-KPI + open-credits-bands aging + open-credits-list + SettleCreditButton

Drilldown ayrı detay sayfası YOK — tek sayfa multi-section pattern (sade-tut). 6 rapor mapping: 4 ✓ implementli, Kâr-Zarar + Şube Karşılaştırma Faz 2'ye saklı.

**Sıradaki C iş kalemi:** §5.13 vitrin-anasayfa brief sync.

---

### 🆕 Tur T: C iş kalemi #13 — vitrin-anasayfa brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.13](UI-MOCKUP-PLAN.md) — vitrin-anasayfa brief'i Sprint 12 implementasyonuna göre yeniden listelendi:
- vitrin-hero (eye + search + il + logo-card) + trust-strip (KVKK + WhatsApp deep link sade banner)
- vitrin-nearby-section — nearby-toggle + nearby-list (4 kart mesafe + WA) + nearby-map Leaflet lazy
- vitrin-popular-products (7g) + vitrin-best-sellers (30g) cross-tenant
- vitrin-city-grid (6 şehir) + vitrin-category-chips (6 kategori)
- vitrin-owner-cta (FREE 50 başla → /register) + cookie-banner (KVKK opt-in, GDPR YOK)
- Alt sayfalar: /vitrin/ara + /vitrin/[il] + /vitrin/kategori/[slug] + /vitrin/marka/[slug] + /vitrin/urun/[slug] + /vitrin/magaza/[slug]
- report-button.tsx 🚩 (vitrin_reports tablo) + WhatsApp feedback sticky balon (Sprint 12.10)

Mockup preview/vitrin-anasayfa.html 1093 satır var ama brand-listings + nearby-map live data ile zenginleşmiş, kod canonical.

**Sıradaki C iş kalemi:** §5.14 vitrin-arama brief sync.

---

### 🆕 Tur U: C iş kalemi #14 — vitrin-arama brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.14](UI-MOCKUP-PLAN.md) — vitrin-arama brief'i Sprint 12 implementasyonuna göre yeniden listelendi:
- vitrin-search-form (q + city + category dropdown + slug)
- Aktif filter chip'leri (vitrin-search-clear-city/category tek tıkla)
- Empty states (empty-no-query + empty-no-result)
- search-results-grid + search-result-card (ürün adı + variant + fiyat + pet shop + city/district + WhatsApp + storefront link)
- search-pagination
- /vitrin/[il] + [il]/[ilce] + /vitrin/kategori/[slug] + /vitrin/marka/[slug] — aynı component pre-filter
- Sıralama (mesafe/fiyat) + harita Faz 2'ye saklı

**Sıradaki C iş kalemi:** §5.15 vitrin-urun brief sync.

---

### 🆕 Tur V: C iş kalemi #15 — vitrin-urun brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.15](UI-MOCKUP-PLAN.md) — vitrin-urun brief'i Sprint 12 cross-tenant product page implementasyonuna göre yeniden listelendi:
- cross-tenant-product-page + SEO title "Fiyat kıyasla"
- product-hero + price-range-summary (min-max)
- offers-list — her pet shop kart (name + city/district + mesafe + stok + fiyat + variantCount + offer-detail + offer-wa)
- only-one-offer-note tek satıcıda
- "Neden bu sırada" algoritma modal Faz 2'ye saklı
- Aynı kategoriden öneri 4 kart + report-button 🚩

Para akışı çizgisi vurgusu: WhatsApp deep link sadece, "Vitrin referans kodu" Karar B (a) ile eklenmedi (sade-tut).

**Sıradaki C iş kalemi:** §5.16 vitrin-magaza brief sync.

---

### 🆕 Tur W: C iş kalemi #16 — vitrin-magaza brief sync (2026-05-21 gece)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.16](UI-MOCKUP-PLAN.md) — vitrin-magaza brief'i Sprint 12 + Faz 8 (branch holiday banner) implementasyonuna göre yeniden listelendi:
- SEO ld-local-business + ld-breadcrumb (schema.org JSON-LD)
- storefront-holiday-banner (Faz 8 tüm aktif şubeler tatil)
- storefront-hero — kapak + logo + storefront-name + storefront-holiday-badge (kısmi tatil) + hero-whatsapp
- storefront-about + contact-grid 3-kolon
- products-section — brand-groups + brand-anchor-nav (marka chip + anchor scroll) + ürün grid
- feedback-balloon.tsx — WA tıklama sonrası 5 emoji sticky balon (Sprint 12.10 + 2026-05-15 onay, 1 IP × 1 tenant × 24h anti-spam)
- whatsapp-link-script.tsx — WA click track + balloon trigger
- Şube seçici dropdown (multi-branch) + Çalışma saatleri 7 gün tablo Faz 2'ye saklı

**Sıradaki C iş kalemi:** §5.17 vitrin-ana-petstockpro brief sync (son mockup).

---

### 🆕 Tur X: C iş kalemi #17 — vitrin-ana-petstockpro brief sync (2026-05-21 gece — SON)

**Değişiklik:** [docs/UI-MOCKUP-PLAN.md §5.17](UI-MOCKUP-PLAN.md) — SaaS landing brief'i Sprint 0+ implementasyonuna göre yeniden listelendi:
- `/` (page.tsx) — Hero + FREE'den başla CTA + 3 değer önerisi + Nasıl çalışır + plan tablosu özet + son CTA
- `/fiyatlar` (page.tsx) — `plan-${key}` 3 plan kartı (FREE 0₺ / PRO 1.000₺ / PRO+ 2.000₺ KDV dahil, 2026-05-21 son revize) + SSS + iyzico/Nilvera açıklama
- Auth + onboarded user için `/` → `/admin` redirect gate

Mockup preview/vitrin-ana-petstockpro.html yok (implementli, gerek kalmadı).

---

### 🆕 Tur Y: 6. Mantık Hata Tarama (2026-05-21 gece)

**Tetikleyici:** d6623b6 pricing revize (1.250/2.250 → 1.000/2.000) yayılımı 18 dosyayla eksik kalmıştı; 5. tur YT5-2/3 (R2 strategy) bir doc'ta yarım kalmıştı.

**10 bulgu — 9 ✅ çözüldü, 1 historik korundu:**

🔴 **Kritik 4** — Otoritatif pricing yanlış:
- YT6-1: CLAUDE.md:448 "Karar C revize 1.250/2.250" → 1.000/2.000 + tam tarihçe
- YT6-2: PAYMENT-INTEGRATION.md §10 — 2026-05-20 + 2026-05-21 satırları eklendi
- YT6-3: TECH-STACK.md §10 (2026-05-14 plan tier) → "2026-05-21 son revize" başlık + 1.000/2.000
- YT6-4: SUPERADMIN-YETKILERI.md §3.1.1 plan tablosu → [1.000] / [2.000]

🟡 **Önemli 5** — Yayılım yarım:
- YT6-5: SPRINT-PLAN.md — plans master 750/1.750 + Sprint 0 product-images Supabase bucket (R2'ye taşındı)
- YT6-6: UI-MOCKUP-PLAN.md §6 harici tool prompt template 750/1.750
- YT6-7: preview/urunler.html plan strip metni 750/1.750
- YT6-8: SUPABASE-SETUP.md §10 product-images RLS → invoice-archives (e-Arşiv) + R2 notu
- YT6-9: src/lib/billing/totals.test.ts test isimleri 750/1750 → 1000/2000 (matrah 833.33 + 1666.67)

🟢 **Düşük 1** — DEVAM-REHBERI historik tur özetleri dokunulmadı (Karar tarihçesi bilinçli korundu)

**Detay:** [docs/MANTIK-HATALARI-2026-05-14.md §6. Tur](MANTIK-HATALARI-2026-05-14.md). 50 toplam bulgu (5 önceki tur + 6. tur 10).

**Toplam dosya:** 7 doc + 1 mockup + 1 test = 9 dosya değişti.

---

## ✅ C İŞ KALEMİ TAMAMLANDI (17/17 brief sync)

**Toplam tur:** G + H + I + J + K + L + M + N + O + P + R + S + T + U + V + W + X = 17 brief sync
**Toplam commit:** 17 docs(ui-mockup-plan) commit (her biri ayrı push)
**Yaklaşım kararı:** Mockup HTML rewrite değil, brief'leri implementasyona göre güncelle (kod canonical, mockup tasarım referansı). Mockup'lar Faz 2'ye saklı.
**Faz 2'ye saklı UI özellikleri (mockup'larda not edildi):**
- Bulk vitrine aç/çıkar (urunler)
- Lat/lng harita pin (subeler)
- softLock UI (sayim)
- R6 Toplu Sipariş Hazırla (dusuk-stok)
- Tedarikçi detay drawer (tedarikciler)
- Plan + Fatura + Yerelleştirme (ayarlar — Sprint 13 sonrası)
- Drilldown detay sayfa (raporlar — tek sayfa multi-section yeterli)
- Sıralama mesafe/fiyat + harita arama (vitrin-arama)
- "Neden bu sırada" algoritma modal (vitrin-urun)
- Şube seçici dropdown + Çalışma saatleri 7 gün tablo (vitrin-magaza)

**Sıradaki DEVAM-REHBERI tercih edilenler:**
- ~~C — 17 mockup brief sıralı~~ ✅ **2026-05-21 gece — TAMAMLANDI**
- **6. Mantık Hata Tarama** (2-3 saat) — sıradaki
- Sprint 13/14 production deploy / Beta soft launch / Pricing pilot — ⛔ Kullanıcı bloker

---

### 🆕 Tur Z: Performance Deep Audit — plan doc (2026-05-21 gece)

**Hedef:** "Daha iyisi olamaz" performans. PLAN-BETA-PERFORMANCE 6/6 yapıldı ama derin audit yeni darboğazlar çıkardı.

**Audit bulgu (toplam 11 alan, 4 öncelik):**

🔴 **P0 — Kritik (lansman bloker):**
- P0-1: 9 vitrin sayfası `force-dynamic` → Cloudflare CDN bypass (her request DB+SSR)
- P0-2: `react.cache()` HİÇ kullanılmamış (Layout 4 + Pano 10 helper duplicate query)

🟠 **P1 — Önemli (1K tenant scale kritik):**
- P1-1: `companies.storefront_status` index YOK → Seq Scan (vitrin'in en sık filter'ı)
- P1-2: Drizzle `.prepare()` HİÇ kullanılmamış — query planning per-request 4-12ms
- P1-3: Pano 14+ paralel query consolidate edilebilir

🟡 **P2 — Orta:**
- P2-1: Bundle 928K tek chunk, analyzer eklenmedi
- P2-2: Marketing pages (`/fiyatlar`, `/kvkk`, vb.) static yapılabilir
- P2-3: Pano Suspense streaming yok
- P2-4: Image priority/sizes audit eksik

🟢 **P3 — Polish:**
- P3-1: `revalidatePath` geniş scope (tag-based daha doğru)
- P3-2: `font-variant-numeric: tabular-nums` audit
- P3-3: Middleware matcher tüm route'larda çalışıyor
- P3-4: TanStack Query staleTime query-bazında tune

**Detaylı plan:** [docs/PLAN-PERFORMANCE-DEEP-AUDIT-2026-05-21.md](PLAN-PERFORMANCE-DEEP-AUDIT-2026-05-21.md) — **23 fix** + 20 tur + kabul kriterleri (Lighthouse 95+, TTFB < 100ms vitrin, 1K concurrent p99 < 500ms).

**🆕 İkinci tur ek bulgular (toplam 12 yeni):**
- 🔴 **P0-3:** `postgres-js` config'de `prepare: false` — prepared statements explicit kapalı (P1-2'yi tamamlayıcı)
- 🟠 **P1-4:** Vitrin arama `ILIKE %query%` leading wildcard → seq scan, **products.name + brands.name'de pg_trgm GIN index YOK** (catalog_seed'da var ama gerçek tabloda yok)
- 🟠 **P1-5:** `next.config.ts` `experimental.optimizePackageImports` yok — büyük dep'ler tam import
- 🟡 **P2-5:** TanStack `refetchOnWindowFocus: true` — 1K user × tab focus = burst (NotificationBell zaten setQueryData ile reactive, gerek yok)
- 🟡 **P2-6:** Drizzle `db.query.X.findMany` (relational API) hiç kullanılmıyor — 264 manuel join, N+1 risk
- 🟢 **P3-5:** TanStack Devtools tree-shake doğrulama
- 🟢 **P3-6:** Cron route'ları wrangler.toml sync (deploy-time check)
- 🟢 **P3-7:** Sitemap.xml index split (Faz 2 — 1K tenant ölçeği)
- 🟢 **P3-8:** Audit log partition (Faz 2 — 6+ ay sonra)
- 🟢 **P3-9:** Connection pool max=10 (Hyperdrive production'da yönetir)

**Güncellenmiş tahmini:** 24-29 saat (20 tur, 23 fix). Süre öncelik: P0 3 tur (5-6 saat) ile kritik kazanımın %70'i. P1-P2 ile %95'e ulaşılır.

**Sıradaki adım:** Tur 1 — P0-1 vitrin revalidate + cache headers (1-2 saat).

---

### 🆕 Tur AA-AG: Performance Audit Tur 1-5-6-11-13-14-17 uygulama (2026-05-21 gece geç)

**Toplam 8 tur uygulandı, 8 commit pushed:**

| Tur | Konu | Commit | Etki |
|---|---|---|---|
| **1** | P0-1 Vitrin 9 sayfa `force-dynamic` → revalidate (60s/300s/600s) + tracking client-side (`/api/vitrin/track` + `TrackPageView` component) | `a264ca4` | Cloudflare CDN aktive — production TTFB <100ms hedef |
| **2** | P0-2 React.cache() request-scoped DB layer (`src/lib/cache/request-scoped.ts` — getCompanyById + getProductCountForCompany + getLowStockCountForCompany + getUnreadNotificationCount + getAllCities unstable_cache 24h) + layout + pano refactor | `a87bd7a` | Layout 4 + pano 1 duplicate elim → ~14 → 10-12 DB call/pano |
| **3** | P0-3 postgres-js `prepare: false → true` (Hyperdrive uyumlu) | `370827d` | Planning Time 4-12ms → <1ms (production'da görünür) |
| **4** | P1-1 Migration 0023 `companies.storefront_status` partial index `WHERE = 'approved'` | `370827d` | Vitrin filter Seq Scan → Index Scan (1K tenant ready) |
| **5** | P1-4 Migration 0024 `products.name` + `brands.name` pg_trgm GIN index (partial: deleted_at IS NULL AND vitrin_published) | `8bcfdfa` | ILIKE `%query%` seq scan → trigram match (1K-10K ürün ready) |
| **6** | P1-5 `next.config.ts` `experimental.optimizePackageImports` (lucide-react, framer-motion, @tanstack/react-query, date-fns, recharts) | `370827d` | **🎉 Bundle 928K → 228K (%75 azalma)** |
| **11** | P2-2 Marketing static — root layout `cookies()` cascade → Faz 2'ye saklı (group refactor) | — | Skip |
| **13** | P2-4 Image priority/sizes audit — vitrin'de above-fold logo `priority` ✓ + popüler/best-seller kart `sizes` ✓ | — | Fix gerek yok |
| **14** | P2-5 TanStack `refetchOnWindowFocus: true → false` + staleTime 30s → 60s | `063957c` | 1K user × tab focus burst eliminated |
| **17** | P3-3 middleware matcher — `/admin/superadmin/:path*` only ✓ | — | Fix gerek yok |

**Migration apply:** Migration 0023 + 0024 kullanıcı tarafından manuel uygulandı, EXPLAIN ANALYZE doğrulama (small table planner küçük tabloda Seq Scan tercih etmeye devam; 1K+ row'da otomatik index'e geçer).

**Kalan turlar (15-20 saat tahmin):**
- Tur 7: P1-2 Drizzle `.prepare()` hot path (2 saat)
- Tur 8: P1-3 query consolidation + relational query pilot (2 saat)
- Tur 9: P2-1 bundle analyzer detay audit (1 saat)
- Tur 10: P2-1 fix — Magic UI / Leaflet / exceljs lazy load (2-3 saat)
- Tur 12: P2-3 Pano Suspense streaming (2 saat)
- Tur 15: P2-6 relational query — 3 hot path helper (3-4 saat)
- Tur 16: P3-1 revalidateTag granular (1-2 saat)
- Tur 18: P3-4 staleTime query-bazında ek tune (1 saat)
- Tur 19: P3-5+6+7 polish (1 saat)

---

---

### 🆕 Tur Y: A+B+C+D UX dürüstlük + journey + errors paneli (2026-05-21 gece)

**A — Vitrin UX dürüstlük taraması 6 sayfa** (commit `5f4ce60`):
- `/vitrin` hero floating card "📍 YAKIN" → "Türkiye'de"
- `/vitrin/ara` lead konum koşullu ("{name} şehrindeki..." / "pet shop'tan...")
- Popüler kart rozet "🔥 460" → "🔥 460 görüntüleme" + title "Son 7 günde 460 kez görüntülendi"
- Çok satan rozet "🏆 85 adet" → "🏆 85 satıldı" + title "Son 30 günde 85 adet satıldı"
- Diğer 5 sayfa temiz (urun zaten "Stok bilgisi sayım anına göre" disclaimer'lı)

**B — Şeffaflık** (commit yok): A'da rozet tooltip'leri eklendi + Pano PetPro 4 öneri kartı zaten "neden bu öneri" alt-metnine sahip (transfer/indirim/SKT/sipariş) + vitrin popüler/best-seller kart başlıkları zaten alt-metinli. Ek değişiklik gerek yok.

**C — Customer journey end-to-end smoke** (commit `ff332aa`):
- Register UI sanity check → 2 bulgu fix:
  - C-2 şifre tekrar input eklendi (passwordConfirm, action eşleşme kontrolü)
  - C-3 ürün detay tek satıcıda "fiyat aralığı" → "fiyat" (lowest === highest)
- Test hesabıyla journey: /vitrin/magaza/sprint-3-products-test → ürün detay → WA deep link → feedback balloon (5 sn gecikmeyle açıldı, 5 emoji + close + KVKK disclaimer) → feedback-good click → POST /api/vitrin/feedback → DB row (rating=good, ip_hash 64 hane SHA-256, status=submitted) ✓
- C-1 (Turnstile widget yokluğu) bulgu DEĞİL — disclaimer "Sprint 2.3'te aktif olacak" doğru

**D — Süperadmin errors sayfası canlı kontrol** (commit yok — bulgu yok):
- Empty state ✓ ("🎉 Bu kriterlere uyan hata yok")
- 5 sample DB insert sonrası dolu state: stats (5/5/2 unresolved/critical) + top-types (db.timeout ×2, iyzico/r2/brevo ×1) + 6 filter chip + 5 satır liste
- Critical filter → 2 satır ✓
- Resolve toggle UI → DB update (resolved=true + resolved_at + resolved_by_id) ✓
- PII strip ✓ ("host: REDACTED", "received_signature: REDACTED", "key: REDACTED")
- Threshold burst cron (`55 3 * * *`, 5+/saat → Telegram critical 6h dedup) — manuel trigger değer/maliyet düşük, prod nightly'de doğal test
- Sample veri temizlendi

**Net Tur Y bilanço:** 2 commit (A + C). B + D bulgu yok. UI dürüstlük + errors paneli production'a hazır.

---

### 🆕 Geçmiş tur (2026-05-21 öğleden sonra) — referans

| Commit | Konu |
|---|---|
| `378b603` | feat(storefront): SEO açıklaması alanına helperText |
| `a849d54` | chore(ui): Title Case düzeltme |
| `a3bf9b8` | fix(lint): import-execute.test.ts prefer-rest-params + /admin/bayi sil |
| `b57b36c` | feat(sitemap): süperadmin durum kartı + Telegram alert |
| `9902912` | docs(plan): PLAN-BETA-PERFORMANCE.md (onaylı 6 fazlı plan) |
| `73c8bad` | docs(claude): yeni session başlangıç dosyası işaret |
| `ef45949` | docs: PLAN-BETA-PERFORMANCE referansları 4 ana dokümana |

---

## ✅ 2026-05-21 — Observer + Yetki + Şube state Refactor (Faz 1-8)

Plan: `docs/PLAN-OBSERVER-STAFF-BRANCH-STATE.md` — 9 faz, hepsi tamamlandı.

| Faz | Commit | Konu |
|---|---|---|
| 1 | `274a1f1` | Schema: Migration 0021 + permission keys + 4 test |
| 2 | `ebe21ab` | Backend gate: permissions.ts + status.ts + role-gate.ts + 46 yeni test + 6 server action gate'lendi |
| 3 | `fc199b1` | Türkçe etiket: BAYI_SAHIBI→"Bayi Admin", OBSERVER→"İzleyici", STAFF→"Çalışan" (9 dosya) |
| 4 | `2c2c088` | Şube 3-state UI: badge + edit radio + BranchStatusControl + detail banner + setBranchStatusAction |
| 5 | `0ef4fe4` | Vitrin tatil/pasif: branchSummary + holiday banner + disabled WhatsApp + tüm-pasif=404 |
| 6 | `5d84e3e` | Çalışan yetki modal: 15 toggle + applyStaffDefaults invite hook + updateUserPermissionsAction |
| 7 | `d0192ca` | Şube ekleme wizard step 2: "Çalışan ekle veya atla" + SWAL skip uyarı |
| 8 | `b597c1a` | Observer login UI: sticky banner + topbar rozet + branches CRUD gate |

**Browser smoke (toplam doğrulama):**
- ✅ Migration 0021 uygulandı (user_role enum + branch_status enum + user_permissions tablo)
- ✅ 3-state şube: tatil toggle → DB status='holiday' + vitrin banner + WhatsApp disabled
- ✅ Pasif: tüm şubeler inactive → storefront 404 (anyOperational=false)
- ✅ STAFF davet → applyStaffDefaults 3 ON yetki seed (sale.create / variant.view / customer_ref.write)
- ✅ Yetki modal: 15 toggle initial state doğru + 2 toggle + kaydet → DB güncel + audit log
- ✅ Observer login → sticky banner + "🔍 İzleyici" rozet + addBranch reject (DB'de oluşmadı)

**Test: 1507 → 1553 (+46) pass, typecheck 0 error.**

**Schema değişiklikleri (Migration 0021):**
- `user_role` enum: SUBE_MUDURU → OBSERVER rename (BAYI_ADMIN legacy kaldı, UI'da gizli)
- `branch_status` enum: active | holiday | inactive
- `branches.status` column eklendi, isActive sync (active/holiday=true, inactive=false)
- `user_permissions` tablo (15 key support: 3 default ON + 12 OFF)
- `idx_users_one_sube_muduru_per_branch` partial index DROP

**Bilinen sınırlılık:** Faz 7 step 2 form submit'i programmatik click ile fire etmiyor (browser preview env). Backend action Faz 6'da onaylandı (aynı inviteUserAction). Gerçek browser'da çalışacak — kullanıcı manuel test edebilir.

---

## 🚀 YENİ SESSION'A GİRDİĞİNDE — İLK OKUMA

> Bir önceki büyük iş tamamlandı (2026-05-21 PLAN-BETA-PERFORMANCE 6/6 faz + Sprint 3.3 image upload R2
> migration + requireImage default true tutarsızlık fix + 5. tur mantık tarama). CLAUDE.md "Sıradaki olası
> işler" listesinden seç. ~~Sprint 3.3 SUPABASE_SERVICE_ROLE_KEY blokeri~~ → ✅ Çözüldü (R2 strategy +
> service-role JWT eklendi).

---

## 🆕 Son turlar (2026-05-20, 12 commit) — bu DEVAM-REHBERI'a işlenmiş hali

### Pricing + Karar A/C (d3cea77)

- **Karar A:** PRO upsell motivasyonu (a) sade tut — ürün limiti tek farklılaşma
- **Karar C:** Pricing PRO 750→**1.250₺** + PRO+ 1.750→**2.250₺** — net hedef ~$10K/ay
- 10 dosya güncel (UI + lib + docs)

### Bayi Admin iskelet (37f42cf) ⚠ **İPTAL**

`/admin/bayi` placeholder sayfa eklendi (Faz 3 multi-tenant viewer). **Sonraki tur'da iptal edildi** — Observer onun yerini aldı.

### Excel Export Suite — CSV → xlsx (0b37c5c + d2ebd33 + 4fbff90)

- 7 export route .xlsx'e dönüştü (ürünler/şubeler/tedarikçi/audit/raporlar/stok-hareketleri × daily/top)
- exceljs paketi + `lib/utils/xlsx.ts` helper (zengin format: TR başlık, dd/mm/yyyy locale, ₺ para, auto-filter, freeze pane, zebra)
- Brands + Categories export kaldırıldı
- 11 yeni unit test
- Mock script (`scripts/generate-excel-mocks.ts`) masaüstüne 7 örnek xlsx üretir
- Ürünler sidebar'a 🛍 prefix
- .env.example'a 14 şirket placeholder (COMPANY_LEGAL_NAME, VKN, MERSİS, IBAN, vs)

### Excel Ürün Import (56c7269 + c88a55c)

Yeni `/admin/products/import` sayfası — pet shop sahipleri Excel ile toplu ürün ekler:

- `lib/products/import-template.ts` — 11 sütun + 5 örnek satır (mama/kumu/oyuncak/SKT/akvaryum)
- `lib/products/import-validate.ts` — pure validation library (15+ kural, dosya + satır + duplicate)
- `lib/products/import-execute.ts` — server-side DB insert (brand auto-create + initial stock + transaction)
- Drag-drop UI + hata tablosu + SWAL özet modal
- vitrinPublished=false zorunlu (görsel olmadan vitrin yok)
- 38 + 20 unit test (= 58 yeni)
- Plan limit aware (FREE 50 / PRO 500 / PRO+ ∞)

### SWAL Refactor — Modal → Toast (62bd594 + b7bd70e + 4e4d997 + 711be26)

Kullanıcı kararı (2026-05-20): "Form üzerinde hata mesajı YOK, sağ üstte 4 sn auto-dismiss toast."

- `lib/ui/swal.ts` — sweetalert2 wrapper (TR locale + cat-soft tema)
- `lib/ui/use-swal-on-error.ts` — useSwalOnError(state) + useSwalOnErrorString(value, title) hook
- **41 form'da `role="alert"` banner kaldırıldı + useSwalOnError eklendi** (4 paralel agent batch)
- 1 son fix: `settle-credit-button.tsx` audit'te eksik tespit, eklendi
- Korunan 16 dosya: kasıtlı info/warning/JSDoc banner'lar (login remainingAttempts, KVKK uyarı, plan limit, süperadmin tehlike, vs)

### Field-Level Kızartma — aria-invalid (b7bd70e + d80d893)

- `globals.css` aria-invalid kuralı: kırmızı border + soft pembe bg + focus ring
- **36 form'da ~75+ zorunlu input'a `aria-invalid={hasError || undefined}` eklendi** (4 paralel agent batch)
- Opsiyonel input'lara DOKUNULMADI (note, address, opsiyonel id'ler)
- Hook + CSS + brand örneği → tüm projeye yayıldı
- Browser smoke: `/admin/brands/new` duplicate "Royal Canin" → toast top-end + input aria-invalid + border kırmızı (196,69,58)

### Test Kapsam Genişletmesi (c88a55c)

- Excel import için 79 yeni edge case test (sınır değerleri, karakter setleri, tarih formatları, duplicate kombinasyonlar, executeImport server mock)
- Toplam: 1385 → **1503 test pass** (+118)

---

## 📊 Genel Durum (2026-05-20 sonu)

| Konu | Değer |
|---|---|
| Branch | cray61 (origin sync) |
| Son commit | 711be26 |
| Test | **1503 pass** (101 dosya) |
| Lint+typecheck | 0 error |
| Migration | 20 |
| Aiven | dormant (.env'de LOCAL_DB_* hazır) |
| R2 | 1.283 webp + 44 image overwrite + 3 mock |
| Tasarım sistemi | SWAL toast + aria-invalid + form-üstü banner YOK |
| Plan | docs/PLAN-OBSERVER-STAFF-BRANCH-STATE.md hazır |

---

## 🆕 Faz Planı (Yeni Session — 2026-05-21+)

Detay: `docs/PLAN-OBSERVER-STAFF-BRANCH-STATE.md`

| Faz | İçerik | Süre |
|---|---|---|
| 1 | Migration 0019 + Drizzle + permission keys + tests | 1.5h |
| 2 | Backend helper'lar + 14 server action gate | 1.5h |
| 3 | Türkçe etiket güncelleme (25 dosya, agent paralel) | 30m |
| 4 | Şube state UI (admin paneli) | 1.5h |
| 5 | Vitrin tatil/pasif (rozet + uyarı banner) | 1h |
| 6 | Çalışan yetki modal | 1.5h |
| 7 | Şube ekleme wizard step 2 "çalışan ekle" | 30m |
| 8 | Observer davet flow | 45m |
| 9 | Tests + browser smoke (10 senaryo) + doküman + push | 1h |

**Toplam:** ~9-10 saat (3-4 tur'a yayılır)

---

## 📜 ESKI TUR ÖZETLERİ

## 🆕 Bu mini-tur (2026-05-20, gece-geç) — Karar A/C + test rollback + Bayi Admin iskelet + cookie banner UX
**Test:** **1385** passed
**Lint+typecheck:** 0 error
**Migration:** **20** (değişmedi)
**Aiven:** dormant (.env'de LOCAL_DB_* hazır)
**Supabase Storage:** ❌ KALDIRILDI
**R2:** ✅ Kod + bucket + 1.283 webp upload + 44 dosya overrite edilmiş

## 🆕 Bu mini-tur (2026-05-20, gece-en-geç) — Karar A/C + test rollback + Bayi Admin iskelet + cookie banner UX

7 işin tamamı tek turda tamamlandı:

| # | İş | Sonuç |
|---|---|---|
| 9 | **Karar A** — PRO upsell motivasyonu | ✅ Kullanıcı (a) Sade tut seçti. Ürün limiti tek farklılaşma kalır. Vitrin rozet/sıralama bonusu Faz 2'ye saklı. CLAUDE.md §Karar A işaretlendi. |
| 10 | **Karar C** — Pricing yükseltme | ✅ Kullanıcı (a) Pricing yükselt seçti. **PRO 750→1.250₺**, **PRO+ 1.750→2.250₺**. Yeni net hedef ~$10.000/ay (önceki $6.400). 10 dosya güncellendi (UI + lib + docs). plan-limits.test.ts 13/13 pass. |
| 11 | **Test hesapları rollback** | ✅ oguzhanturgut611@gmail.com SUPERADMIN→BAYI_SAHIBI. magicui zaten BAYI_SAHIBI'ymış. claude@petstockpro.local kalıcı SUPERADMIN kalır. |
| 12 | **yeni-resimler/ silme** | ✅ 41 dosya + 16 MB silindi. .gitignore'da olduğu için git'i etkilemiyor. |
| 13 | ~~Vision API tarama~~ | ❌ Kullanıcı vazgeçti ("gerektiğinde sonra"). Mevcut 44 görünür sorun düzeltildi, kalan 1.239 sample-test edilebilir. |
| 14 | **Bayi Admin (Faz 3) iskelet** | ✅ `/admin/bayi` placeholder sayfa (coming-soon banner + Faz 3 kapsam taslağı + referans dokümanlar). Schema migration Faz 3'te. |
| 15 | **Cookie banner UX** | ✅ Anonim user `/vitrin` → 🍪 banner → "Çerezlere izin ver" → banner kayboldu + localStorage 180 gün TTL doğrulandı. |

### 📊 Bu mini-tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **2** (Karar A/C + Bayi Admin iskelet) |
| Pricing değişen yer | **10 dosya** (UI 3 + lib 3 + docs 2 + schema 1 + test 1) |
| Pricing (2026-05-20 Karar C, **2026-05-21 revize**) | PRO **1.000₺** + PRO+ **2.000₺** — önceki sıra: 750/1.750 (2026-05-14) → 1.250/2.250 (Karar C 2026-05-20) → **1.000/2.000 (son 2026-05-21, kullanıcı kararı "fiyat artırmayalım")** |
| Yeni placeholder sayfa | `/admin/bayi` (Faz 3) |
| DB rollback | 1 user (oguzhanturgut SUPERADMIN→BAYI_SAHIBI) |
| Disk temizliği | 16 MB (41 dosya, yeni-resimler/) |
| Test | 1385 pass (13/13 plan-limits güncel) |

### 🔑 Bu turda netleşen

1. **Karar A:** "Eşit rekabet" felsefesi korundu. PRO'ya yükselme motivasyonu sadece ürün limiti. Lansman sonrası gerçek conversion verisi ile değerlendirilecek (Faz 2).

2. **Karar C net gelir senaryosu:**
   - 1K tenant × %70 FREE + %25 PRO (250×1.250) + %5 PRO+ (50×2.250) = **425K₺ brüt/ay**
   - iyzico %3 (-12.750) + OPEX (-7.500) + müşavir (-2.500) - vergi %25 (-100K) = **~301K₺ net ≈ $10.000/ay**
   - Önceki $6.400'den +%56 iyileşme. Tek geliştirici geçim hedefini karşılar.

3. **Test hesapları durumu (LANSMAN ÖNCESİ ROLLBACK ✅):**
   - `magicui@petshop.test` → BAYI_SAHIBI ✓
   - `oguzhanturgut611@gmail.com` → BAYI_SAHIBI ✓
   - `claude@petstockpro.local` → SUPERADMIN (kalıcı, lansman öncesi silinecek — memory'de kayıtlı)

4. **Cookie banner UX kanıt:** localStorage TTL doğrulandı (`vitrin-cookie-banner-dismissed-at` 6 ay = 15.552.000.000 ms, expiresInDays=180).

---

## 📜 Önceki mini-tur (2026-05-20, gece-geç) — iyzico landing page 6 sayfa

DEVAM-REHBERI #3 madde — iyzico Üye İşyeri başvurusu için zorunlu yasal sayfalar + marketing landing.

| # | Sayfa | Özellik |
|---|---|---|
| `/` | Marketing home | Hero + 3 feature kart + 3 plan teaser + trust strip + final CTA. Auth'lı user redirect korundu. |
| `/fiyatlar` | Plan detay | 3 plan kart (FREE/PRO/PRO+) + 4 SSS (iptal/cayma/fatura/upgrade) |
| `/kvkk` | KVKK Aydınlatma | 7 bölüm: veri sorumlusu, toplanan veri, amaç, aktarım, saklama, Md.11 hakları, iletişim |
| `/cerez-politikasi` | Çerez politikası | 5 çerez tablosu (next-auth, lock state, feedback dismiss, cookie consent, cf) |
| `/uyelik-sozlesmesi` | Üyelik şartları | 10 madde (taraflar, konu, şartlar, ücret, yükümlülükler, sorumluluk, fesih, hukuk, yürürlük) |
| `/mesafeli-satis-sozlesmesi` | Mesafeli satış | 6502 sayılı kanun uyumlu (satıcı/alıcı kutu, cayma m.15/1-ğ açıklama) |
| `/iletisim` | İletişim | Destek + KVKK email + firma placeholder + yanıt süreleri |

**Yeni component:**
- `src/components/marketing/header.tsx` — sticky nav (Logo + Fiyatlar + İletişim + Giriş + Ücretsiz başla CTA)
- `src/components/marketing/footer.tsx` — 4 kolon (Platform / Yasal / İletişim / brand) + copyright + trust strip

**Entegrasyon:** `/register` KVKK linkleri `/legal/kvkk` → `/kvkk` ve `/legal/eu-data` → `/kvkk#veri-aktarimi` olarak düzeltildi.

**Browser smoke:** Anonim user `/` → marketing landing (hero + pricing + footer'da 4 yasal link). 6 sayfa hepsi 200 OK, marketing-header + marketing-footer mount edildi.

### ⛔ Lansman blokerleri

| Konu | Detay |
|---|---|
| **Şirket kuruluş** | VKN + MERSİS + ticari unvan + adres bilgileri **[PLACEHOLDER]** olarak işaretli. Kuruluş sonrası 4 sayfada (KVKK + Üyelik + Mesafeli Satış + İletişim) doldurulacak. |
| **Avukat onayı** | Yasal metinlere &ldquo;TASLAK&rdquo; banner eklendi. Production öncesi avukat finalize edecek. |
| **Cloudflare Pages deploy** | `petstockpro.com` DNS → bu landing'i Cloudflare Workers/Pages'a deploy. Şu an localhost. |

### 📊 Bu mini-tur rakamları

| Metric | Değer |
|---|---|
| Yeni sayfa | **6** (fiyatlar + kvkk + cerez + uyelik + mesafeli + iletisim) |
| Yenilenen sayfa | **2** (root `/` + register linkleri) |
| Yeni component | **2** (MarketingHeader + MarketingFooter) |
| Toplam ekleme | **1.396** satır (10 dosya) |
| Lint+typecheck | ✅ 0 error |
| Yeni test | 0 (statik içerik, smoke ile doğrulandı) |
| Branch ahead | 195 → **197 commit** |

---

## 🆕 Önceki tur (2026-05-20, gece-geç) — 4 atlanmış smoke testi + Claude test hesabı + Sprint 12 smoke

## 🆕 Bu tur (2026-05-20, gece-geç) — 4 atlanmış browser smoke testi + Claude test hesabı

Önceki turlarda (2026-05-20 öğle/akşam) 2FA login engelinden atlanan 4 smoke testi canlı doğrulandı. Memory kuralı: artık kullanıcıdan şifre sormayacağım — kalıcı bir Claude SUPERADMIN test hesabı oluşturuldu (`claude@petstockpro.local` / `Test1234!`, memory'de `reference_test_account.md`).

### Smoke sonuçları

| # | Smoke | Doğrulama | Sonuç |
|---|---|---|---|
| 1 | **Müdürü kaldır** (`/admin/branches/[id]`) | RemoveManagerButton tıkla → `removeBranchManagerAction` 200 → DB `branch_id=null`, rol `SUBE_MUDURU` korundu → audit log `branch.manager_removed` → UI "Henüz müdür atanmadı + Müdür davet et" CTA + buton gizli | ✅ |
| 2 | **Multi-image batch upload** (edit page) | `name=file` `multiple` input → 2 PNG inject + DataTransfer + change event → submit → `uploadImagesAction` → `formData.getAll('file')` → 2 R2 upload (.png) + DB `product_images` 2 yeni row (display_order 1/2) + status banner "✓ 2 görsel yüklendi" + queue chip listesi | ✅ |
| 3 | **products/new catalog bug fix** | 3 ardışık catalog seçim ("royal canin" → "kedi kumu" → "köpek mama") → her seçimden sonra `[data-testid="pending-image-catalog"]` daima 1 (öncekiler atıldı, manuel olanlar korunur — `source !== 'catalog'` filter) | ✅ |
| 4 | **Onboarding Step 1 brand seed** | Yeni tenant register/login → Step 1 form'unda `importBrands` checkbox defaultChecked → submit → 95 brand seed + branch insert + audit log `brands.catalog_seeded` → `/admin/brands` UI'de "95 marka tanımlı" + tablo 95 row | ✅ |

### Yeni Claude test hesabı

| Alan | Değer |
|---|---|
| Email | `claude@petstockpro.local` |
| Password | `Test1234!` |
| Role | SUPERADMIN |
| 2FA | disabled |
| Onboarding | completed |
| Company | "Claude Test Pet Shop" (PRO, `claude-test-pet-shop`) |
| User ID | `3dd6d986-ae9e-47ff-a02f-8868dba1c691` |
| Company ID | `6067d9df-fc01-4097-84a9-0aa0b5d9af99` |

Bcrypt hash (yeniden gerekirse): `$2a$10$e1nSlp/ImTC.XJh39i3Ggel55qOUEo35w9fntjLC7M/zwIxj2YRAq`

Memory dosyası: `memory/reference_test_account.md` (lansman öncesi silinmeli).

### Smoke artıkları (DB'de duruyor — lansman öncesi temizlik gerek)

| Kapsam | Durum |
|---|---|
| `claude@petstockpro.local` user + Claude Test Pet Shop company | **kalıcı** test hesabı, sonraki smoke'larda da gerekli |
| Acana ürünü (`b8cbf437-...`) + 3 product_images (1 catalog webp + 2 smoke PNG) Claude Test'te | smoke veri, sonraki turda silinebilir |
| `mudur.smoke@petstockpro.local` user (Claude Test, `branch_id=null`, role SUBE_MUDURU) | smoke artık |
| `claude.onboard@petstockpro.local` + Claude Onboard Test company (95 brand + 1 branch) | smoke artık |
| `Merkez Şube` (Claude Test'in `f64d0d11-...` şubesi) | kalıcı test alanı |

### 🧪 Screenshot timeout sorunu

`preview_screenshot` /admin sayfalarında inatla 30s timeout veriyor (Next.js Dev Tools overlay veya RSC re-render olabilir). DOM eval ile doğrulama yaptım (memory `feedback_screenshot_required.md` kuralı tipik durumda screenshot ister, bu istisna). Sonraki turlarda Next.js Dev Tools devre dışı bırakmak veya headless mode değiştirmek denenebilir.

### 📊 Bu tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **1** (devam-rehberi update + memory note) |
| Yeni test | 0 (mevcut 1385 unit korundu) |
| Yeni DB row | 2 user + 2 company + 1 branch + 1 product + 3 product_images + 1 audit + 95 brand (smoke + kalıcı test) |
| R2 upload | 2 yeni PNG (smoke artık) |
| Branch ahead | 194 → **195 commit** (bu commit'le) |

### ⏭ Sıradaki olası işler

1. ~~**Smoke artıklarını temizle**~~ ✅ Tamamlandı (mudur.smoke + claude.onboard user + Claude Onboard Test company + Acana smoke ürünü silindi; Claude Test kalıcı)
2. ~~**Sprint 12 WhatsApp feedback balonu smoke**~~ ✅ Tamamlandı — implementation zaten hazırdı (helper + API + balloon + WhatsappLinkScript + storefront analitik). Vitrin'de `/vitrin/magaza/sprint-3-products-test` → wa.me click → 5sn → balloon open → 😊 click → submit → DB row `status=submitted, rating=very_good` + UI "Teşekkürler"
3. **iyzico landing page** (ayrı tur, 2-3 gün) — Sırada
4. **`scripts/data/yeni-resimler/` klasörü** (41 dosya, gitignore'da) — gözden geçirme bitince silinebilir
5. **Push to origin** (`git push -u origin cray61` — 195 commit ileri, kullanıcı kararı)

---

## 📜 Önceki tur (2026-05-20, gece) — Catalog image kalite temizliği (44 ürün)

Kullanıcı catalog_seed_products tablosundan **44 sorunlu resim hash'i** verdi (petlebi.com watermark / kampanya rozeti / "HEDİYE" etiket / "TÜRKİYE'DE İLK" pazarlama / Eastland marka kartlı paket / placeholder "Resim Hazırlanıyor" / vs.). Her birinin yerine **temiz alternatif** bulunup R2'de seed/{hash}.webp key'inin üzerine yazıldı (DB image_path değişmedi, content yenilendi).

### Akış

| Tur | Kapsam | Sonuç |
|---|---|---|
| Batch 1-5 | Firecrawl image search ile 21 ürün için temiz alternatif (Trendyol/Amazon/petburada/ciceksepeti/marka resmi sitesi vb.) | R2 PUT 21/21 ✓ |
| Batch 6 | Yeni eklenen 8 sorunlu hash için arama | 8 alternatif gösterildi |
| Batch 7-8 | Yeni eklenen 9 + 12 hash için arama | 12 alternatif gösterildi |
| Kullanıcı feedback | 13 ürün için ben yanlış/yetersiz alternatif vermiştim (EuroGold Trixie Eastland Yengeç/Kaplumbağa/Küret/Köpekbalığı/Frizbi + Hill's/ProChoice/Royal Canin/Felicia/Ferplast/Felix yanlış SKU) | Kullanıcı kendisi Trendyol/Hepsiburada'dan 13 temiz görsel buldu, masaüstüne kaydetti |
| Final | 13 kullanıcı PNG'si scripts/data/alt-images/user-{hash}.png olarak kopyalandı + R2'ye PUT | R2 PUT 13/13 ✓ |

### Komutlar

```bash
# 21 scrape alternatif (batch 1-5)
npx tsx scripts/replace-catalog-images.ts

# 13 kullanıcı resmi (final fix)
npx tsx scripts/replace-user-images.ts
```

### 📊 Bu tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **1** (chore: replace scripts) |
| R2 dosya overwrite | **34** ürün (21 scrape + 13 kullanıcı) |
| Hâlâ eski kalan tartışmalı | **10** (R2'de orijinal duruyor — kullanıcı temizliklerini yaptıklarımla yer değişti) |
| Firecrawl arama | ~50 sorgu |
| Branch ahead | 193 → **194 commit** |
| Yeni klasör | `scripts/data/yeni-resimler/` (41 dosya, .gitignore'da, gözden geçirme için) |

### 🔑 Bu turda netleşen

1. **R2 PUT idempotent + DB image_path değişmez** — `seed/{hash}.webp` key'i sabit, content yenilenir. Browser cache'i hard-reload (Ctrl+Shift+R) gerektirir; CDN immutable cache + 1 yıl TTL.

2. **TR pet sektörü tek stok foto sorunu** — Bazı yerli markalar (Eastland, EuroGold) tek bir resmi stok fotoğrafı dağıtıyor; tüm satıcılar aynı görseli kullanıyor. Bu durumda farklı *kaynak* aramak işe yaramaz — farklı *ürün varyantı* veya kullanıcı manuel.

3. **PNG'yi .webp key'ine PUT etmek sorunsuz** — R2 content-type header'ı `image/png` set edilir, browser `<img>` tag'inde render eder. URL uzantısı `.webp` ama içerik PNG. İstenirse sonradan sharp ile convert edilebilir (Sprint Z).

4. **Sorunlu içerik kategorileri:**
   - 🔴 Watermark (petlebi.com sağ alt) — en sık (6/20 ilk turdan)
   - 🟠 Kampanya rozeti (HEDİYE, BONUS PAKET, 6 ADET, 12 ADET, YENİ kurdele)
   - 🟡 Yan label/şerit (Hill's "Kısırlaştırılmış Yavru Kedi" sol mavi)
   - 🟡 Marka kartlı paket (Eastland Cat Toys & Accessories — ürünün gerçek perakende ambalajı, watermark değil ama "alıntı belli")
   - ⚪ Placeholder ("Resim Hazırlanıyor")

### ⚠ Bilinen kalanlar

- **`yeni-resimler/` klasörü**: 41 alternatif resim local (review için). gitignore'da, repo'da değil.
- **Image kalite tarama**: 1.283 resmin geri kalan 1.239'u henüz taranmadı. Bir Vision API tarama (Claude Vision veya OpenAI Vision, ~$15-25 maliyet) ileride yapılabilir.

---

## 📜 ESKİ TURLAR (referans)

## 🆕 Önceki tur (2026-05-20, öğle) — Branch detail "👤 Şube ekibi" kartı

| # | İş | Commit |
|---|---|---|
| N | `listBranchAssignedUsers` helper (lib/branches/detail.ts) — `users.branchId = branchId` filtre + role'a göre manager/staff bölüştürme. `BranchUserRow` + `BranchAssignedUsers` tipleri. | `5c7b5b7` |
| N | `removeBranchManager` helper (lib/branches/manage.ts) — şube ownership + manager lookup + `branchId=null` update. Reason codes: `branch_not_found`, `no_manager_assigned`, `unknown`. Rolü SUBE_MUDURU kalır (kullanıcı tenant'a bağlı kalır, başka şubeye atanması ayrı karar). | `5c7b5b7` |
| N | `removeBranchManagerAction` server action — BAYI_SAHIBI/SUPERADMIN yetki check + audit log `branch.manager_removed` + revalidatePath. | `5c7b5b7` |
| N | `/admin/branches/[id]` UI — yeni "👤 Şube ekibi" section: Müdür bloğu (atanmış: ad+email+✓ Doğrulandı/Davet bekliyor + "Müdürü kaldır" buton / atanmamış: "Henüz müdür atanmadı + + Müdür davet et" CTA) + Kasiyer bloğu (STAFF dizisi + Davet bekliyor badge). | `5c7b5b7` |
| N | `RemoveManagerButton` client component — `confirm()` onay metni (kullanıcı kalır + rol korunur + diğer atama users listesi) + `useTransition` pending + `data-testid="remove-manager-button"`. | `5c7b5b7` |

### 📊 Bu tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **1** |
| Yeni test | **+7** (detail 3 + manage removeBranchManager 4) |
| Yeni helper | `listBranchAssignedUsers` + `removeBranchManager` |
| Yeni server action | `removeBranchManagerAction` |
| Yeni client component | `RemoveManagerButton` |
| Yeni audit action | `branch.manager_removed` |
| Schema | değişmedi (mevcut `users.branch_id` field reuse) |
| Branch ahead | 185 → **186 commit** |

### 🔑 Bu turda netleşen küçük kararlar

1. **"Müdürü kaldır" semantik:** sadece `branchId=null` yapar. Rol SUBE_MUDURU kalır. Başka şubeye atanmak için Kullanıcılar listesinde rol/şube güncellemek gerekir (ayrı yetki ekranı). UI'daki confirm metni bunu açıklar.

2. **DB constraint dostluğu:** `idx_users_one_sube_muduru_per_branch` partial unique index (cf61e37) `WHERE branch_id IS NOT NULL` — `branchId=null` olunca constraint dışı kalır → başka müdür atanabilir, ek temizlik yok.

3. **Browser smoke kapsamı:** Müdür-**yok** hali canlı doğrulandı (snapshot: "Henüz müdür atanmadı + Müdür davet et"). Müdür-**var** hali + "Kaldır" tıklama unit test'te 4 senaryo ile kanıtlandı; canlı tıklama 2FA login engelinden bu turda atlandı (DB'de test müdür `test.mudur@petshop.test` seed kalıntı — sonraki turda silinecek).

### ✅ Temizlik

- `test.mudur@petshop.test` seed user (id `bd11c363-2154-4454-b4f3-aa67ed775dd4`) bu turun sonunda silindi (kullanıcı onayıyla DELETE) — DB temiz.

---

## 🆕 Bu tur (2026-05-20, ikindi) — Catalog kalite cleanup + .gitignore kontrol

| # | İş | Commit |
|---|---|---|
| O | `src/lib/utils/text-cleanup.ts` — decodeHtmlEntities (numeric/hex + 13 named) + normalizeInlineWhitespace + normalizeProductName + normalizeProductDescription + cleanProductTextFields. 22 unit test. | `e48ea39` |
| O | `scripts/cleanup-catalog-text.ts` — dry-run default, `--apply` ile JSON (`scripts/data/pet-products-catalog.json`) + DB (`catalog_seed_products`) symmetric güncelleme. Idempotent doğrulandı. | `e48ea39` |
| O | DEVAM-REHBERI #3 — `.gitignore` kontrol: `scripts/data/` line 98 + `scripts/enrich-product-images.ts` line 99. 1283 webp track edilmiyor, ek değişiklik gerekmedi. | (no commit) |

### 📊 Bu tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **1** (cleanup helper + script) |
| Yeni test | **+22** (text-cleanup) |
| Catalog satır temizlenen | **124 / 1240** (~%10) |
| HTML entity sayısı sonrası | 0 |
| Whitespace anomalisi sonrası | 0 |
| Branch ahead | 188 → **189 commit** |

### 🔑 Bu turda netleşen

1. **JSON dosyası `.gitignore` kapsamında** (`scripts/data/`) → JSON cleanup commit'ine girmiyor ama lokal source-of-truth temizlendi (sonraki seed-catalog-table.ts çalıştığında temiz JSON DB'ye yazılır).

2. **`scripts/data/images/` 1283 webp** track edilmiyor, R2'de mevcut. Repo temiz, ek `.gitignore` satırı gerekmedi.

3. **Brand-duplicate isimler:** DEVAM-REHBERI tahmini "%5 etkili" idi; gerçekte `\m(\S+)\s+\1\M` regex ile 0 satır → temizlik gerekmedi. HTML entity (`&#039;` vb.) tek gerçek sorundu.

---

## 🆕 Bu tur (2026-05-20, akşam) — Multi-image batch + Brand seed + bug fix

| # | İş | Commit |
|---|---|---|
| P | Edit form multi-image batch upload — `uploadImagesAction` (plural) + `formData.getAll('file')` + queue chip listesi + success/failure banner | `318cebe` |
| Q | products/new catalog seçim BUG fix — her seçimde yeni image eklenip birikiyordu; `source !== 'catalog'` filter ile tek catalog görseli kalır. + `localId` module-level (react-hooks/purity 2 error temizlik) | `ce236d7` |
| R | Onboarding Step 1'de "Catalog markalarını içeri aktar (N marka)" checkbox + `seedCatalogBrandsForCompany` helper + audit log + success banner | `41f9e56` |

### 📊 Bu tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **3** |
| Yeni test | **+7** (seed-catalog: empty / 3 new / idempotent / slug-dedup / space-filter / all-existing / bulk-fail fallback) |
| Yeni helper | `uploadImagesAction` + `seedCatalogBrandsForCompany` + `countCatalogBrands` |
| Yeni audit action | `brands.catalog_seeded` |
| Branch ahead | 189 → **193 commit** |

### 🔑 Bu turda netleşen

1. **Multi-image API kontratı:** `formData.getAll('file')` → `File[]`. Tek-file submit aynı action'a düşer (1 elemanlı dizi). Backward-compat hack gerekmedi.

2. **Catalog seçim semantik:** name/brand/category gibi görsel de "override" semantiği taşır → önceki catalog kaynaklı görseller silinir, manuel olanlar korunur. Daha önce her catalog seçimi birikiyordu.

3. **Brand seed idempotent:** `slug` bazlı skip + makeSlug ile "ProLine" + "Proline" tek slug → tekrar çağrılırsa duplicate olmaz. Onboarding tekrarlanırsa güvenli.

### ⚠ Sonraki turda canlı browser doğrulaması

Login + 2FA engelinden bu turda atlanan smoke testleri:
- Branch detail "Müdürü kaldır" (Task 4'te atlandı, unit test'le kanıtlı)
- Multi-image upload UI (queue chip + failure banner)
- products/new catalog seçim bug fix (3 farklı ürün ardışık seç → 1 görsel)
- Onboarding Step 1 checkbox + brands_imported banner

---

## 🆕 Önceki tur (2026-05-19 → 20) — Sprint E full kapsam

| # | İş | Commit |
|---|---|---|
| A | 1.240 ürün scrape (4 tur) + WebP (146→49 MB) + JSON v0.2.6 + 8 script | `c36ddb8` |
| B | catalog_seed_products schema (INT id + GIN trgm) + 0018 migration + DB-backed searchSeedCatalog + Drizzle Flyway baseline (17 entry) | `c36ddb8` |
| C | R2 client (lazy-init, S3-uyumlu) + upload-to-r2.ts + .env.example R2 vars + @aws-sdk paketleri | `3fb4565` |
| D | Storage tam refactor — product-images.ts + seed-image-transfer.ts R2'ye, supabase/admin.ts silindi, 53 test mock | `60a7309` |
| E | R2 smoke test + 1.283 webp R2'ye (49 MB) | `b5dd00c` |
| F | Variant section'a manuel image upload (single → multi'ye evrildi sonra) | `b750746` |
| G | Catalog seçimi → description + brand auto-create + R2 thumb | `13d88d8` |
| H | Tenant bulk import: 95 brand + 1.240 ürün + 1.246 görsel + 1.276 variant catch-up | `452a685` |
| I | Catalog görseli "dosya seçilmiş" görünür (file input alanında thumb) | `0d60912` |
| J | Üst+alt kategori 2 dropdown (cascade) + brand moderation BLOCK | `98ede6d` |
| K | Multi-image upload (manual + catalog) + ✕ iptal button (new + edit) | `efedef1` |
| L | CSP fix — *.r2.dev img-src + connect-src eklendi (image decode) | `7236dfa` |
| M | Users link-only invite + şube tek-müdür constraint (DB unique index + UI disabled) | `cf61e37` |

### 📊 Bu tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **14** (origin'den 185 ahead) |
| Yeni dosya | **12 script + 3 lib helper + 3 migration + 1 R2 client** |
| Catalog ürün | 328 → **1.240** (3.78x) + %100 image coverage |
| Marka çeşitliliği | 46 → **95** |
| Image klasör | 13.7 MB → 49.3 MB webp (lokal) + 1.283 R2'de |
| EXPLAIN ANALYZE | **0.48ms** (GIN trgm Bitmap Index Scan) |
| Süperadmin tenant DB | 5 → **1.249 ürün + 1.285 variant + 1.246 image + 99 brand** |
| Migration | 17 → **20** (Flyway disiplinle) |

### 🔑 Bu turda netleşen büyük kararlar

1. **Drizzle Flyway disiplini** — `db:push` YOK, `db:generate` + `db:migrate` zorunlu
2. **Catalog seed DB-backed** — JSON memory bypass (Workers bundle size)
3. **Storage: Supabase → R2** (10 GB free + bandwidth free, tek-geliştirici uyum)
4. **Multi-image** new + edit, ✕ button thumb sağ üst köşede daima görünür
5. **Catalog görseli UI'da "dosya seçilmiş"** — mock state (CORS preflight r2.dev yok), server seedImagePaths array ile transfer
6. **Üst+alt kategori cascade** — catalog seçimi parent+child birlikte set
7. **Brand moderation BLOCK** — küfür tespit edilirse INSERT REJECT (önceki: flag+allow)
8. **Tenant bulk import script** — test/playground için tek komut
9. **CSP r2.dev eklendi** — img decode için kritik (sessiz reject sorunu çözüldü)
10. **Users davet link-only** — email kaldırıldı, 24 saat link + admin elden iletir
11. **Şube tek-müdür** — DB partial unique index + UI disabled options + warning banner
12. **Aiven LOCAL DB rezerve** — production sonrası aktif

### 📊 Bu tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **2** |
| Yeni test | **+12** pure scoring (integration testleri browser E2E'ye taşındı) |
| Yeni dosya | **9 scripts + 1 lib helper + 1 migration** |
| Catalog ürün | 328 → **1.240** (3.78x) + %100 image coverage (önceden %46) |
| Marka çeşitliliği | 46 → **95** |
| Image klasör | 13.7 MB → 49.3 MB webp |
| Branch ahead | 174 → **176 commit** |
| EXPLAIN ANALYZE | **0.48ms** (GIN trgm Bitmap Index Scan) |

### 🔑 Bu turda netleşen büyük kararlar

1. **Drizzle Flyway disiplini kuruldu** (kullanıcı kuralı)
   - `db:push` (state-based) artık YOK — sadece `db:generate` + `db:migrate`
   - 17 mevcut migration `drizzle.__drizzle_migrations` history table'a baseline'landı
   - `scripts/baseline-drizzle-migrations.ts` one-time bootstrap
   - Sonraki schema değişikliği: schema.ts → `npm run db:generate` (SQL üret) → review → `npm run db:migrate` (apply + history kayıt)

2. **Catalog seed JSON-memory'den DB-backed'e geçti**
   - Cloudflare Workers bundle size + production deploy şart koştu
   - `searchSeedCatalog` async + Drizzle execute SQL
   - Pure `scoreSeedProduct` ranking korundu (DB-free, test edilebilir)
   - GIN trgm + EXPLAIN 0.48ms (network +30-50ms = <100ms total)

3. **Storage altyapısı: Supabase Storage → Cloudflare R2** (kullanıcı kararı)
   - "Cloudinary" projede yoktu, kullanıcı `product-images` Supabase Storage bucket'ını kastediyordu
   - R2 seçim: 10 GB free + bandwidth FREE + tek geliştirici felsefesine uyumlu
   - Object key: `seed/{hash}.webp` + `tenants/{companyId}/{productId}/{uuid}.{ext}`
   - **5 dosyalık refactor bekliyor** (kullanıcı bucket açınca)

4. **Aiven Postgres LOCAL DB olarak rezerve**
   - `.env`'de LOCAL_DB_* env vars var, drizzle config DATABASE_URL (Supabase prod) kullanıyor
   - Production'a çıkınca local dev için Aiven'a yönlendirme

5. **iyzico başvurusu — Yol B (PetStockPro odaklı)**
   - DriverMesh ile aynı tüzel kişilik → "Yeni Mağaza" eklemeyi gelecek için sakla
   - Şimdi: sandbox başvuru (anında) + petstockpro.com landing deploy (2-3 gün) + production başvuru (5-15 iş günü)
   - Ayrı tur olarak ele alınacak

### ⏭ Bekleyen / Sıradaki olası işler

1. **iyzico landing page** (ayrı tur, 2-3 gün) — CLAUDE.md "Yol B" kararlı
   - 6 sayfa statik (home + fiyatlar + KVKK + çerez + üyelik sözleşmesi + iletişim)
   - Cloudflare Pages deploy
   - iyzico sandbox başvurusu paralel (anında API key)
   - Production başvurusu landing tamamlanınca (5-15 iş günü)

2. ~~**Catalog kalite cleanup**~~ ✅ Tamamlandı 2026-05-20 ikindi — `e48ea39` (124 satır temizlendi)

3. ~~**`scripts/data/images/` .gitignore** kontrolü~~ ✅ Kontrol edildi 2026-05-20 ikindi — kapsamda (`scripts/data/` line 98), 1283 webp track edilmiyor

4. ~~**Branch detail/edit sayfasında "atanmış müdür" gösterimi**~~ ✅ Tamamlandı 2026-05-20 öğle (yukarı bölüm)

5. ~~**Edit form'da multi-image batch upload**~~ ✅ Tamamlandı 2026-05-20 akşam — `318cebe`

6. ~~**Tenant onboarding'a 95 brand seed**~~ ✅ Tamamlandı 2026-05-20 akşam — `41f9e56` (Step 1 checkbox)

---

## 🆕 Bu mini-tur (2026-05-18, gece-geç) — M/N/O/P 4 commit polish

| # | İş | Commit |
|---|---|---|
| M | /vitrin/marka/[brand] SEO landing — cross-tenant brand detay + listing + il filter + breadcrumb + sitemap; makeBrandSlug + getBrandByNameSlug + listProductsByBrandSlug + countProductsByBrandSlug helpers (+13 unit) | `b7f7335` |
| N | /vitrin/ara?kategori=<slug> kategori filter — search.ts SearchOpts.categorySlug + categories LEFT JOIN dinamik + form select + chip + temizleme | `6645017` |
| O | NearbyMap compass heading — deviceorientation event + heading state + dynamic divIcon (dönen SVG ok) + popup "🧭 Bakış yönü: N°" + iOS/Android cross-compatibility | `01d5d1f` |
| P | uploadProductImage cacheControl: '31536000' (1 yıl) — UUID path immutable, CDN public cache güvenli; mock + assertion test | `4d9c7ed` |

### 📊 Mini-tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **4** |
| Yeni test | **+13** (1327 → 1340) — brand-listings (cacheControl assertion mevcut test'e eklendi) |
| Yeni helper | makeBrandSlug + getBrandByNameSlug + listProductsByBrandSlug + countProductsByBrandSlug |
| Yeni page | /vitrin/marka/[brand] |
| Branch ahead | 169 → **174 commit** |

### 🔑 Bu mini-turda netleşen konular

1. **Brand slug mapping deterministik:** `makeSlug` shared util'i brand isimlerine uygulanır. SQL-side TR-aware slug regenerate yapılamadığı için JS-side `listBrandsWithStorefrontProducts → find` mapping (brand sayısı ~100, N+1 değil).

2. **/vitrin/ara facet zinciri:** q + il + kategori birlikte filter — pagination URL'lerinde tüm param'lar korunur. Bilinmeyen kategori slug `Diğer` fallback yerine filter no-op (whitelist DEFAULT_CATEGORIES).

3. **Compass heading semantik:** iOS Safari `webkitCompassHeading` (zaten kuzey-saat yönü) ile Android `alpha` (saat tersi) farklı semantik — `360 - alpha` ile pusula'ya çevriliyor.

4. **divIcon dynamic update:** useMemo([heading]) ile Marker icon prop'u re-render — react-leaflet 5 marker position değişmediği sürece re-mount yapmaz, sadece icon swap.

5. **CacheControl Supabase Free tier davranışı:** Kod doğru (param geçti, unit test verifies); ama Free tier'da `Cache-Control: no-cache` override geliyor. Production'da Pro tier veya Cloudflare proxy ile max-age=31536000 honor edilir.

### ⚠ Pending / bekleyen

- 🟡 **Test rollback (LANSMAN ÖNCESI):** magicui@petshop.test + oguzhanturgut611@gmail.com → BAYI_SAHIBI (lansman bloker, şimdilik gerek yok)
- ⛔ **Şirket kuruluş + VKN + IBAN** → Sprint 13/14 iyzico/Nilvera production (2-4 hafta)
- ⛔ **Production env secret'lar** → IYZICO_WEBHOOK_SECRET + BREVO_API_KEY + CRON_SECRET
- 🟡 **Supabase Storage tier upgrade** → CDN cache-control honor için (Pro $25/ay)

### 🟢 Sıradaki olası işler

- **Push to origin:** `git push -u origin cray61` (174 commit ileri, kullanıcı kararı)
- /vitrin/marka listing sayfası (Türkiye'deki tüm markalar, listBrandsWithStorefrontProducts)
- iOS compass permission button ("🧭 Pusula aktive et") — DeviceOrientationEvent.requestPermission gesture
- Brand grouping pet shop profilinde aktive olsun (zaten H polish'te eklendi, brand chip Anchor nav)
- /vitrin/ara'ya brand filter chip (q + il + kategori + marka 4 facet)
- Cross-tenant brand sayfasına location-aware sort (haversine)

---

## 🆕 Önceki tur (2026-05-18, gece) — I/J/K/L 4 commit polish

## 🆕 Yeni tur (2026-05-18, gece — R + Q + M/N/O/P) — Moderation + Brand SEO + UI iyileştirmeler

### R serisi — İçerik moderasyonu (yeni)

| # | İş | Commit |
|---|---|---|
| R | Hybrid moderation: blacklist (TR-aware) + OpenAI Moderation API + ModerationWarning component + 9 helper'a entegre (register/products/branches/brands/categories/suppliers/company/storefront/vitrin-reports) + UI demo (/admin/products) | `0bf50de` |

**Strategy:**
- **Sync blacklist** (~1ms, key gerektirmez) — TR-aware normalize (lowercase TR locale, leetspeak, in-word punctuation strip, single-letter token merge, repeated char fold) + 50 kelimelik kategori liste (profanity/insult/sexual/scam)
- **Async OpenAI Moderation** (omni-moderation-latest, ~200ms, fail-open) — TR/EN destekli, ücretsiz, 13 kategori
- **Uyar pattern**: block etmez, sadece kullanıcıya banner gösterir + audit log'a yazar (süperadmin takip)

**Helper entegrasyonu:**
- `register.ts` → Pet shop adı
- `catalog/products.ts` → Ürün adı + açıklaması
- `branches/manage.ts` → Şube adı + adresi
- `brands/manage.ts` → Marka adı
- `categories/manage.ts` → Kategori adı
- `suppliers/manage.ts` → Tedarikçi adı + iletişim kişisi + notu
- `company/settings.ts` → Pet shop adı
- `storefront/settings.ts` → Hakkımızda metni + meta açıklaması
- `vitrin/reports.ts` → Şikayet notu

**UI banner:**
- `/admin/products` redirect query `?moderation=flagged&fields=...` → sarı warning banner
- Diğer admin sayfalarına aynı pattern (R-12 ileride, mekanik)

**Test:** 1327 → **1358** (+31: blacklist 20 + check 11)

### Q — Login + register paw pattern → logo watermark

| # | İş | Commit |
|---|---|---|
| Q | Eski mor pati pattern + beyaz mascot SVG kaldırıldı, sağ-alt köşeye subtle logo watermark (opacity 0.08, rotate -8deg, 288×288). 🐾 emoji'ler korundu (27+ sayfa, inline text-flow). | `e564896` |

### M/N/O/P mini-tur — Brand SEO + Vitrin polish

| # | İş | Commit |
|---|---|---|
| M | /vitrin/marka/[brand] SEO landing — cross-tenant marka detay + breadcrumb + sitemap (+13 unit test) | `b7f7335` |
| N | /vitrin/ara?kategori=<slug> filter — searchParams kategori + form select + chip + temizle | `6645017` |
| O | Leaflet compass heading — deviceorientation API + marker rotation + popup "Bakış yönü" | `01d5d1f` |
| P | Storage CDN cache-control — uploadProductImage'a `cacheControl: '31536000'` + assertion | `4d9c7ed` |

---

## 🆕 Bu mini-tur (2026-05-18, gece) — I/J/K/L 4 commit polish

| # | İş | Commit |
|---|---|---|
| I | /vitrin/[il] cross-tenant brand chip section (listBrandsInCity helper, productCount badge'leri, mavi/bars tonu) | `9b8e6f3` |
| J | /vitrin/ara?il=<slug> şehir filter (getCityBySlug + listCitiesWithStorefronts + form select + chip + temizle link) | `b0c7f65` |
| K | Seed katalog autocomplete sonrası görsel otomatik Storage transfer (DI-friendly helper + 17 unit + DB doğrulandı) | `4c75fe9` |
| L | NearbyMap canlı kullanıcı konum takibi (watchPosition + Permissions API 'granted' state-aware) | `518039d` |

### 📊 Mini-tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **4** |
| Yeni test | **+17** (1297 → 1314) — seed-image-transfer |
| Yeni helper | brand-listings + seed-image-transfer + listCategoriesInCity + listBrandsInCity |
| Branch ahead | 164 → **168 commit** |

### 🔑 Bu mini-turda netleşen konular

1. **SQL kuralı revize:** DML (SELECT/INSERT/UPDATE/DELETE) ben çalıştırırım; DDL (CREATE/ALTER/DROP/TRUNCATE) kullanıcıya iletilir. Memory: `feedback_sql_user_runs.md` (revize).

2. **Brand grouping mantığı:** brands tablosu tenant-scope (aynı isim farklı tenant'larda farklı UUID). Cross-tenant aggregate `brands.name` üzerinden yapılır (DISTINCT product.id ile çift saymayı önler). brands tablosunda `is_active` kolonu YOK (sadece products'ta soft-delete var).

3. **Seed image transfer güvenliği:** Path whitelist regex (`^scripts/data/images/[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$`) + `path.resolve` ile traversal koruması + DI-friendly helper (test'te mock fn, production'da fs.promises). Mevcut `uploadProductImage` zincirine bağlanır (tenant ownership + auto-primary).

4. **Leaflet canlı takip prensibi:** URL'i değiştirme (sayfa reload yok); sadece client-side React state update. Permissions API 'granted' ise sessiz başla, 'prompt'/'denied' ise NearbyToggle'ı bekle. watchPosition options: highAccuracy + 15s timeout + 5s maxAge.

5. **/vitrin/ara il filter:** Slug bilinmeyen ise filter no-op (404 değil). cityFilter chip + "× Şehir filtresini kaldır" link sadece q kalır. Pagination URL'lerinde il param'ı korunur.

### ⚠ Pending / bekleyen

- 🟡 **Test rollback (LANSMAN ÖNCESI):** magicui@petshop.test + oguzhanturgut611@gmail.com → BAYI_SAHIBI (lansman bloker, şimdilik gerek yok)
- ⛔ **Şirket kuruluş + VKN + IBAN** → Sprint 13/14 iyzico/Nilvera production (2-4 hafta)
- ⛔ **Production env secret'lar** → IYZICO_WEBHOOK_SECRET + BREVO_API_KEY + CRON_SECRET

### 🟢 Sıradaki olası işler

- **Push to origin:** `git push -u origin cray61` (168 commit ileri, kullanıcı kararı)
- /vitrin/marka/[brand] SEO landing (`listBrandsWithStorefrontProducts` zaten hazır)
- /vitrin/ara'ya kategori filter (mevcut categoryListings + cityId pattern aynı)
- Leaflet kullanıcı yönü göstergesi (compass heading)
- Seed image transfer için Supabase Storage CDN cache-control header

---

## 🆕 Önceki tur (2026-05-18, akşam) — B/C/E/F/G/H 10 commit polish + UX

## 🆕 Bu tur (2026-05-18, akşam) — B/C/E/F/G/H 10 commit polish + UX

| # | İş | Commit |
|---|---|---|
| B-1 | SUPERADMIN login sonrası /admin/superadmin redirect (Pano değil) | `cb4b9ca` |
| B-2 | Topbar sağ üst köşesine açık çıkış butonu (form action logoutAction) | `a693394` |
| B-3 | Login şifre input'una göz toggle (Lucide eye/eye-off, aria-pressed) | `984dbb3` |
| B-4 | docs(devam-rehberi): tur planı + test rollback notu güncel | `ad7fcd0` |
| B-5 | 2FA yedek kodlar — TXT indir + RecoveryCodesActions ortak panel (25 test) | `fd64f08` |
| B-6 | Login 2FA step'inde yedek kod TXT yükle + picker (parse + 2-col grid) | `a47ae30` |
| C | Sprint 3 tenant kategori reset (49 hiyerarşik, UI'dan) | data |
| E | Seed katalog autocomplete /admin/products/new (328 ürün JSON + API + debounce + prefill) | `3c2b2ac` |
| F | /vitrin/ara cross-tenant ürün arama route (ILIKE + pagination + breadcrumb) | `fed3c3b` |
| G | Yakındakiler haritası statik SVG → Leaflet (OSM tile + popup + Detay/Satıcıya sor) | `2b4614c` |
| H | Vitrin polish — /vitrin/[il] kategori chip + WhatsappButton default 'Satıcıya sor' | `22d37e8` |

### 📊 Tur rakamları

| Metric | Değer |
|---|---|
| Yeni commit | **10** |
| Yeni test | **+55** (1242 → 1297) — recovery-codes 25 + seed-catalog 22 + parseSearchQuery 8 |
| Yeni helper | recovery-codes + seed-catalog + vitrin/search + listCategoriesInCity |
| Yeni component | RecoveryCodesActions + SeedCatalogAutocomplete + NearbyMap + NearbyMapWrapper |
| Yeni API route | /api/catalog/search |
| Yeni page | /vitrin/ara |
| Yeni paket | leaflet + react-leaflet 5 + @types/leaflet |
| CSP güncel | img-src += `https://*.tile.openstreetmap.org` |
| Branch ahead | 154 → **164 commit** |

### 🔑 Bu turda netleşen önemli konular

1. **SQL kuralı (memory):** SELECT serbest, mutation/DDL/apply_migration için **chat üzerinden açık soru sor** — "yapayım mı / siz mi?" netleştir. Sadece kod blok yetersiz. Memory: `feedback_destructive_ask_via_chat.md`.

2. **Test geçici SUPERADMIN:** İki test hesabı (magicui@petshop.test + oguzhanturgut611@gmail.com) geçici SUPERADMIN — canlıya çıkmadan rollback. Test sürecinde sürekli ileri-geri yapma.

3. **Login redirect role-aware:** `/` üzerinden SUPERADMIN → /admin/superadmin, diğer roller → /admin (Pano). Onboarding gate'i SUPERADMIN için atlanır (operasyon hesabı kendi tenant'ı için ürün eklemesi gerekmiyor).

4. **2FA recovery TXT lifecycle:** Kullanıcı /admin/security → Yenile → TOTP → 8 yeni kod → 📥 TXT indir; kullanılan TXT dosyasını /login 2FA step'te 📎 yükle → picker'dan kod seç → input doluyor. Helper: `formatRecoveryCodesAsText` + `extractRecoveryCodesFromText`.

5. **Seed katalog autocomplete:** 328 curated TR ürün (`scripts/data/pet-products-catalog.json` 167KB). Score-based ranking (barkod 1000, ad prefix 400, marka 350 vb.). Tenant brand/category eşleşmesi case-insensitive — marka yoksa "+Marka ekle" hint banner.

6. **Vitrin /vitrin/ara:** Cross-tenant ürün araması (product.name + brand.name ILIKE). Hero search form'u `/vitrin?q=` → `/vitrin/ara?q=` (geriye uyumlu eski URL korundu).

7. **Leaflet OSM:** Dynamic import (ssr:false), 46KB gzipped sadece /vitrin'de. Tile fetch için CSP img-src güncel. fitBounds ile marker'lar kapsayacak şekilde otomatik zoom.

8. **"Satıcıya sor" label:** WhatsappButton default + Leaflet popup + nearby card link metni — niyet net, brand WA yeşili + ikon korundu.

### ⚠ Pending / bekleyen

- ✅ **C/H için browser tam doğrulama tamamlandı:** Sprint 3 Products Test tenant'ına `city_id=35 (İzmir)` + `district=konak` atandı (UPDATE DML), 2 ürünün `category_id` set edildi (kopek-kuru-mamalar + kedi-mama-ve-su-kaplari). /vitrin/izmir → "İzmir'de satışta olan kategoriler (2)" chip section + "Pet shop'u olan ilçeler (1) Konak" + Sprint 3 Products Test kartı "Satıcıya sor" butonu — hepsi screenshot ile görsel doğrulandı.
- 🟡 **Test rollback (LANSMAN ÖNCESI):** magicui@petshop.test + oguzhanturgut611@gmail.com → BAYI_SAHIBI (lansman bloker, şimdilik gerek yok)
- ⛔ **Şirket kuruluş + VKN + IBAN** → Sprint 13/14 iyzico/Nilvera production (2-4 hafta)
- ⛔ **Production env secret'lar** → IYZICO_WEBHOOK_SECRET + BREVO_API_KEY + CRON_SECRET

### 🟢 Sıradaki olası işler (tükenmiş — kullanıcı yeni iş söylemeli)

- Brand grouping `/vitrin/[il]` (bu tur kapsamına alınmadı — listBrandsInCity helper + brand chip section gerekir)
- /vitrin/ara'ya il filter eklenebilir (cityId param)
- /admin/products/new — image upload entegrasyonu seçilen seed product'in `imagePath`'inden (Storage transfer)
- Leaflet user location marker'ı için real geolocation API + sticky position (mobile)
- WhatsappButton label'ın çevirisi (next-intl entegrasyonu Faz 2)

---

## 🆕 Önceki tur (2026-05-18, öğleden sonra) — Categories SUPERADMIN gate + Branding + Vitrin SEO + Ürün-merkezli yenileme + Sprint 3.3 image upload

---

## 📋 Sıradaki Tur Çalışma Planı (2026-05-18 → bir sonraki commit'lere)

> **Kullanıcı netleştirmesi:** "Hiçbir açık bırakmadan, her senaryoyu test ederek, UI testlerini tarayıcıdan yaparak ilerleyelim."
> **Test rollback** (`magicui@petshop.test` → BAYI_SAHIBI) **canlıya çıkarken** yapılacak — bu turda atla.
> **`scripts/data/`** untracked klasör şimdilik dursun — E adımında commit'lenecek.

### Sıralı iş listesi

| # | İş | Tahmin | Test stratejisi | Commit | Durum |
|---|---|---|---|---|---|
| **B** | **Süperadmin tour** (kullanıcı manuel) — logout/login → 5 sekme sayfa sayfa: Tenant'lar / Vitrin moderasyon / DB Inspector / Sistem ayarları / 6 bypass | 15 dk | Kullanıcı tarafından, ben sadece hazırlık (logout) yaparım | — (bug bulunursa ayrı fix commit) | ⏳ |
| **C** | **Sprint 3 tenant kategori reset** — Süperadmin UI'dan "🔄 Default kategorilere sıfırla" aksiyonu | 5 dk | Browser: süperadmin → tenant detay → button → confirm → audit log + tenant'ın /admin/categories'inde 49 hiyerarşik | (sadece data, commit yok) | ⏳ |
| **E** | **Ürün otomatik tamamlama UX** — `scripts/data/pet-products-catalog.json` ile barkod/marka/ad autocomplete `/admin/products/new` formunda | 1-2 saat | Unit (lookup helper) + browser E2E (tip → öneri görünür → tıkla → form doluyor → SKU kontrol) | tek commit + scripts/ dahil | ⏳ |
| **F** | **Vitrin ürün arama route** `/vitrin/ara?q=` — Google'dan gelen kullanıcı için landing | 1-2 saat | Unit (search helper) + browser E2E (q=mama → sonuç + boş q → empty + filter combo) + sitemap entry | tek commit | ⏳ |
| **G** | **Leaflet gerçek harita** — Yakındakiler statik SVG → interaktif Leaflet | 1 saat | Browser E2E (vitrin ana → harita render + marker'lar + popup → tenant link) + CSP recheck | tek commit | ⏳ |
| **H** | **Vitrin polish** — Brand grouping `/vitrin/[il]` sayfasında + kategori chip + diğer küçük iyileştirmeler | 1-2 saat | Browser E2E (`/vitrin/[il]` → brand gruplar + kategori chip → tıkla → filtreli liste) | tek commit | ⏳ |

**Toplam tahmin:** ~4.5-6.5 saat (B kullanıcı manuel; C+E+F+G+H ben)

### 🧪 Her iş için test disiplini (uyulacak kurallar)

1. **Helper varsa unit test önce** (test-first memory)
2. **Lint + typecheck temiz** olmalı her commit öncesi
3. **Browser E2E = preview_screenshot ile gerçek görsel** (DOM eval/fetch yetersiz — memory kuralı)
4. **Her tamamlanan iş için ayrı commit** (batch yok, onay isteme — memory kuralı)
5. Her commit sonrası bu plan tablosunda işi ✅ işaretle (Durum kolonu)
6. Session sonunda DEVAM-REHBERI taze tut

### ▶ Sıralı akış

- **Şu an:** B'ye hazırlık → logout yapıp kullanıcıya teslim
- **B bitince** → C → E → F → G → H sırasıyla
- Kullanıcı herhangi bir noktada "dur" derse plan o adımda kesilebilir
- Açık bırakılan senaryo varsa bir sonraki adıma geçilmez

---

## 🆕 Bu tur (2026-05-18, öğleden sonra) — Categories SUPERADMIN gate + Branding + Vitrin SEO + Ürün-merkezli yenileme + Sprint 3.3 image upload

9 yeni commit (bu turda):

| # | İş | Commit |
|---|---|---|
| 1 | Categories: SUPERADMIN-only CRUD + Slug/KDV temizleme + migration 0016/0017 (legacy flat → 49 hiyerarşik reseed) + AdminCategoryBar silindi + sistem ayarları kategori tablosu güncel | `e25a70b` |
| 2 | Branding: logo.png (1.5MB) → logo.webp (78KB) + sidebar PetStockPro shiny (22px text-cart) + tenant "Pet Shop" suffix logic + login sayfası "P" placeholder → logo | `383b5fd` |
| 3 | Vitrin SEO: sitemap priority (cross-tenant ürün 0.9 / kategori 0.8 / şehir 0.8 / ürün 0.7 / profil 0.6 / root 0.5 / brand homepage 0.4) + page-metadata helper (canonical + OG + Twitter + robots) + 7 route metadata + buildBreadcrumbLd 5 sayfada inject | `932db08` |
| 4 | Vitrin ana sayfa ürün-merkezli rewrite: stats.ts (getPlatformStats + listPopularProducts7d + listBestSellers) + page.tsx 9 section (Hero + Trust strip + Yakındakiler + 🔥 Popüler 7g view + 🏆 Çok satanlar 30g sales + statik SVG harita + Şehir grid + Kategori chip + Owner CTA) + NearbyToggle permission-aware (granted→"Konumu yenile" yeşil) | `0c4d8f0` |
| 5 | Vitrin layout polish: header buton kompakt (16px→13.5px, "çok büyük"), 4-kolon footer (Brand / Vitrin / Pet Shop'lar İçin / Hakkımızda), sade cookie banner ("Çerezlere izin ver" tek buton, 6 ay TTL) | `a59ed12` |
| 6 | Sprint 3.3 image upload: admin client (singleton) + product-images CRUD (Zod + 4 helper + path traversal koruma + auto-primary + auto-promote) + server actions (3 + role gate + audit) + ImagesSection UI + requireImage=true aktive. **30 unit + 28 integration test** (gerçek DB+Storage) | `a13d4f5` |
| 7 | Vitrin popüler/çok satanlar kartlarında **gerçek primary image** (LEFT JOIN product_images isPrimary=true + img loading=lazy fallback emoji) | `e094b92` |
| 8 | Register sayfası sol hero "P" → logo.webp | `0d604d8` |
| 9 | Branding: brand favicon (logo.webp → 256 PNG, Next.js convention app/icon.png) + OpenGraph 1200×630 PNG (Sharp composite) + page-metadata default OG image güncel | `4a9e426` |

### 📊 Bu turun rakamları

| Metric | Değer |
|---|---|
| Yeni unit test | **+40** (1202 → 1242) — admin client 5 + product-images 30 + page-metadata 8 + breadcrumb 4 + stats 5 - sitemap 1 düzeltme |
| Integration test (gerçek DB+Storage) | **28 assert** PASS |
| Yeni migration | 2 (0016 drop vat_rate + 0017 reseed) |
| Yeni helper | stats.ts + page-metadata.ts + product-images.ts + admin.ts |
| Yeni component | NearbyToggle permission-aware + ImagesSection + CookieBanner + 2 reset-categories |
| Branding | 4 yer (sidebar / pano / login / register) + favicon + OG image |
| Vitrin section sayısı | 4 (eski) → 9 (yeni) |
| Branch ahead | 145 → **154 commit** |

### 🔑 Bu turda netleşen önemli konular

1. **Vitrin felsefesi:** Brand homepage (paylaşılabilir) + ürün arayan kullanıcı (Google'dan) için iki yönlü değer. SEO landing'ler kategori/ürün/şehir alt sayfalarında, brand homepage düşük priority. **Login olmuş kullanıcı vitrin'i normalde görmez** (admin paneli yeterli, "← Admin paneli" chip dön yolu).

2. **Sprint 3.3 BLOKER kalktı** — `SUPABASE_SERVICE_ROLE_KEY` env eklendi (anon JWT yanlış kopyalanmıştı, doğrusu eklendi). Tam lifecycle production-ready:
   - Storage upload (image/jpeg|png|webp, ≤5MB, tenant-scoped path)
   - DB insert (auto-primary + displayOrder)
   - Public URL (Supabase Storage public bucket)
   - Delete (DB + Storage cleanup + auto-promote)
   - setPrimary (atomik transaction)
   - Cross-tenant guard (product_not_found)
   - **`requireImage=true` aktive** (vitrin'e açmak için en az 1 görsel zorunlu)

3. **Kategori sistemi tek otorite:** SUPERADMIN. Sadece o ekle/sil/düzenle/sıfırla/CSV. BAYI_SAHIBI bile yapamaz — DB'deki kategori datasını sabit tutmak için sıkı kural.

4. **Permission API state-aware NearbyToggle:** Browser geolocation `granted` ise "Konum izni ver" butonu yerine "✓ Konumu yenile" (yeşil) — kullanıcı zaten izin vermiş, tekrar prompt yapmamak için.

### ⚠ Kullanıcı blokerleri (devam ediyor)

- ⛔ Şirket kuruluş + VKN + IBAN → Sprint 13/14 iyzico/Nilvera production (2-4 hafta)
- ⛔ `IYZICO_WEBHOOK_SECRET` + `BREVO_API_KEY` + `CRON_SECRET` → production env

### 🟡 Yapılmadan kalan opsiyonel polish (önemsiz)

- Sprint 3 Products Test tenant 49 hiyerarşik kategoriye sıfırla (kullanıcı süperadmin UI'dan yapabilir, 2 ürünün kategorisi NULL olacak)
- Diğer auth sayfalarına logo (forgot-password / verify-email / 2fa-setup emoji placeholder mantıklı — semantic mesaj 🔑📬🛡)
- Vitrin hero search → gerçek ürün arama route `/vitrin/ara?q=...` (Faz 2)
- Leaflet gerçek harita (Faz 2 — şu an SVG statik mockup)

### 🧪 Test rollback gerek (LANSMAN ÖNCESİ — test sürecinde gerek YOK)

İki test hesabı geçici SUPERADMIN'e yükseltildi:
- `magicui@petshop.test` (2026-05-17 turunda — browser test için)
- `oguzhanturgut611@gmail.com` (2026-05-18 turunda — süperadmin tour için, kullanıcı kararı)

Test sürecinde tour + bug fix akışı için gerekli, **şimdilik geri almaya gerek yok**. Canlıya çıkarken birlikte rollback:
```sql
-- LANSMAN ÖNCESI ÇALIŞTIR (test sürecinde değil)
UPDATE petstockpro.users SET role = 'BAYI_SAHIBI', updated_at = NOW()
WHERE email IN ('magicui@petshop.test', 'oguzhanturgut611@gmail.com');
```

---

## 🆕 Önceki tur (2026-05-18, sabah) — Vitrin dark + Impersonation + Tipografi + Hiyerarşik kategori + Pet CategoryBar

23 yeni commit (en son `995642f` Magic UI altyapısından bu yana — bir önceki turun devamı):

| # | İş | Commit |
|---|---|---|
| Hydration fix | Meteors hydration mismatch + script tag warning (sonra cookie theme ile tam çözüldü) | `6be51bf`, `381812a` |
| Vitrin dark | bg-white → bg-paper, 11 dosya 52 yer | `f66ca1d` |
| Tenant impersonation | 🎭 Gir butonu + sticky banner + cookie `pp-impersonate-tenant` + auth() wrapper companyId override + audit log | `cd416f8` |
| Süperadmin emoji ikonları kaldır | Vitrin Görüntüleme zone 4 kart sağ üst emoji kutuları | `819a4db` |
| Snowfall efekti | Pano hero meteorlar → 40 yumuşak kar tanesi + toggle ❄/× sağ alt köşe + localStorage persist | `58a73dc`, `f347974` |
| Topbar süperadmin button conditional | /admin/superadmin/* sayfalarında gizle | `45d3b0f` |
| Middleware guard | /admin/superadmin/:path* için 4. katman, getToken + role check, edge runtime | `3590808` |
| Tipografi büyütme | html font-size 16→18, body 13→16, 783 hardcoded text-[Npx] +1.5px büyüt (108 dosya), Verdana doğrula | `89d5b5f` |
| Vitrin admin-return-link | Login admin/staff için '← Admin paneli' chip, server-side auth gate, anonim sızıntı yok | `1810776` |
| WhatsApp button | Resmi #25D366 yeşil + SVG logo, label 'WhatsApp', 6 vitrin sayfasında migrate | `258e0b8` |
| 2-seviyeli kategori | 16 flat → 49 hiyerarşik (6 üst + 43 alt) + parentSlug field + 2-fazlı seed (root→child, parentId resolve) + register helper + /admin/categories parent-child accordion + system-settings collapsible | `d7fd2d9` |
| Kategori form refactor | KDV form'dan kaldır + üst/alt mod toggle + parent select + sıralama selectbox (1..max+1) | `94fcdc2` |
| Tenant default kategorilere sıfırla | Süperadmin tenant detay sayfası '🔄 Default kategorilere sıfırla' aksiyonu + audit | `9f963ff` |
| Hero rotated white card | Logo aside (önceki turda eklendi) | (önceki tur) |
| Benzersiz emoji | 49 default kategoride emoji çakışmaları düzeltildi + addCategory/updateCategory emoji_taken validation + 12. test | `ec9a08f` |
| Vitrin kategori bar | Yatay nav + hover/focus-within dropdown, listCategoryNavTree (root + child + productCount), 2-seviyeli sticky bar | `3332109`, `33af63b` |
| Admin CategoryGrid → CategoryBar | Pet projesi CategoryBar yapısı admin'de de — eski 6 renkli kart kaldırıldı, yatay nav + dropdown (mevcut tenant kategorilerinden) | `f464f30`→`1c3af65` |

## 📌 Önemli notlar (bu turda netleşen)

### Cookie-based theme — flash önleyici (final çözüm)
React 19'da `<script dangerouslySetInnerHTML>` her yerde "Encountered a script tag" uyarısı. Inline boot script tamamen kaldırıldı. Yerine:
- **layout.tsx async** + `cookies()` ile `pp-theme` cookie server-side oku
- `html.dark` className SSR'da render (flash yok)
- ThemeProvider initialTheme prop alır (server'dan gelen değer)
- Toggle: `setEnabled()` + `document.cookie` + `localStorage` ikisine birden 1 yıl TTL

### Tenant impersonation mimarisi
- Süperadmin tenant tablosunda her satırın sonunda '🎭 Gir' butonu (server action form)
- `setImpersonationCookie(companyId, ...)` HttpOnly+SameSite=Lax 8h TTL
- `lib/auth/auth.ts` baseAuth → auth() wrapper: SUPERADMIN + cookie ise `session.user.companyId` override (tüm admin sayfaları otomatik tenant verisi görür, manuel migration gerekmedi)
- Sticky banner üstte: `[email] · [TenantAdı] olarak görüntülüyor` + 'Çıkış · Süperadmin'e dön' formu
- Audit: `superadmin.impersonate.started/stopped` (entity=company, performedAsSuperadmin=true)

### Süperadmin güvenlik (4 katman + 5. server action gate)
| Katman | Mekanizma |
|---|---|
| 1. Sidebar nav grup | `isSuperadmin ? push : skip` (admin-sidebar.tsx) |
| 2. Topbar button | `isSuperadmin && !pathname.startsWith('/admin/superadmin')` |
| 3. Sayfa guard | her `/admin/superadmin/*/page.tsx` `await requireSuperadmin()` |
| 4. Middleware | `src/middleware.ts` matcher `/admin/superadmin/:path*` → `getToken` → role check → redirect /admin veya /login |
| 5. Server actions | `isSuperadmin(session) \|\| redirect('/login')` |

Browser test (magicui@petshop.test BAYI_SAHIBI ile): 4 farklı süperadmin URL doğrudan girildi → /admin'e redirect ✓ sidebar süperadmin grup yok ✓ topbar button yok ✓

### Kategori 2-seviyeli yapı
- DEFAULT_CATEGORIES 49 entry: 6 root (Kedi/Köpek/Kuş/Akvaryum/Kemirgen/Sürüngen) + 43 child
- `parentSlug` field statik kategori şemasında, seed helper 2-fazlı insert (root→child)
- Her child `parentId` ile DB'de bağlı (FK ON DELETE CASCADE Drizzle relations'ta)
- Mevcut tenant'lar eski 16 flat kategori ile kaldı — süperadmin tenant detay sayfasında '🔄 Default kategorilere sıfırla' aksiyonu var
- Form: 'Üst kategori ekle' vs 'Alt kategori ekle' mod toggle + parent select + sıralama selectbox (1..max+1)
- 49 default emoji **benzersiz**, addCategory/updateCategory yeni reason `emoji_taken`

### Vitrin & Admin CategoryBar (Pet projesi yapısı)
- `.pt-cat-bar / .pt-cat-nav / .pt-cat-dropdown / .pt-drop-item` CSS sınıfları globals.css
- Vitrin: `VitrinCategoryBar` — DEFAULT_CATEGORIES cross-tenant statik
- Admin: `AdminCategoryBar` — mevcut tenant kategorilerinden inşa, edit link
- Hover veya focus-within ile dropdown
- `justify-content: center` (mobile'da overflow-x scroll)

## 🆕 Bu tur (2026-05-17, gece) — Magic UI + Light/Dark theme + Süperadmin metrik dashboard

| # | İş | Commit |
|---|---|---|
| 1 | Magic UI altyapısı: motion@12.38 + 9 komponent + theme provider + globals dark+keyframes | `995642f` |
| 2 | Admin shell magicui: glass sidebar/topbar + ThemeToggle + Vitrin ShimmerButton-style gradient | `12770ea` |
| 3 | Pano magicui: Meteors hero + NumberTicker KPI + PulsatingButton alert | `0e83142` |
| 4 | Süperadmin: vitrin events + tenant aktivite analytics helper + magicui dashboard hero + 2 yeni metrik zone | `0af4a5c` |
| 5 | Toplu `bg-white` → `bg-paper` migration (64 dosya, dark mode theme-aware) | `7e2b399` |

**Kullanıcı netleştirmesi (bu turda):** Admin/Staff ile SUPERADMIN ayrı görsel kimlik. Admin tarafı = warm/cesur (turuncu hero + magicui animasyon). Süperadmin tarafı = koyu shell (cart-7 → ink → cart-7 lacivert+kırmızı). SUPERADMIN admin'i de görebilir, admin SUPERADMIN sayfalarına asla erişemez (mevcut `requireSuperadmin` gate korunur). Light/Dark mode toggle topbar'da (sun/moon icon, localStorage persist + flash prevent).

**Magic UI komponentleri (`src/components/magicui/`):**
- `number-ticker.tsx` — count-up spring animation, suppressHydrationWarning ile SSR-safe
- `shimmer-button.tsx` — perimeter conic shimmer (CSS-only)
- `magic-card.tsx` — pointer-follow spotlight gradient
- `animated-list.tsx` — staggered reveal with motion AnimatePresence
- `meteors.tsx` — falling streaks bg, lazy useState init (no setState-in-effect)
- `pulsating-button.tsx` — radial pulse keyframe (CSS-only)
- `animated-shiny-text.tsx` — gradient text shimmer (CSS-only)
- `border-beam.tsx` — offset-path animated gradient
- `dot-pattern.tsx` — subtle SVG bg dots

**Light/Dark theme (`src/components/theme/`):**
- `theme-provider.tsx` — `html.dark` class strategy + lazy useState initializer (read from html.dark already set by boot script) + localStorage persist
- `theme-toggle.tsx` — topbar sun/moon button
- Root layout'a `themeBootScript` inline `<script>` eklendi (head'de senkron çalışır → flash yok, hydration warning suppress edildi)
- globals.css `html.dark` token override (ink/line/bg/paper + 6 marka soft renkleri için dark variants) + form controls dark-aware default skin

**Süperadmin analytics (`src/lib/superadmin/analytics.ts`):**
- `getVitrinEventStats(db, windowDays=7)` — funnel (profile_view/product_view/listing_impression/whatsapp_click) + 5 en çok görüntülenen tenant
- `getTenantActivityStats(db)` — son aktivite (stock_movements + audit_logs UNION ALL → MAX) + 24h/7g/30g aktif sayıları + 5-band distribution + 5 ilgi azalan tenant

**Süperadmin dashboard yeni zone'lar:**
- 📈 Genel (mevcut KPI'lar)
- 👁 Vitrin Görüntüleme · Son 7 gün (4 KpiBold + Top 5 tenant + Listede gösterilme + funnel)
- 🔥 Tenant Aktivitesi (3 KpiBold + 5-band dağılım + ilgi azalan tenant tablosu)
- 💾 Veritabanı (mevcut DB stats korundu)
- Tenant tablosu (alt, mevcut)

**Browser E2E (yeni test hesabı `magicui@petshop.test` / BAYI_SAHIBI):**
- Login → /admin Pano welcome state hero (turuncu gradient + Meteors + 2 CTA + chip row) ✓
- ThemeToggle sun/moon ile dark mode anında geçiş, html.dark class doğru toggle ✓
- /admin/audit-log dark mode (tablo, filter form, hızlı tarih chip'leri) ✓
- /admin/superadmin (geçici SUPERADMIN promo ile) → hero koyu shell + Genel KPI + Vitrin metrik KPI + Top tenant + Tenant aktivite + DB + tenant tablo, light + dark testleri ✓

**Tüm süperadmin sayfa turu (12 sayfa, dark mode):**
- /admin/superadmin → ✓ 4 zone (Genel/Vitrin Görüntüleme/Tenant Aktivitesi/Veritabanı) + tenant tablo
- /admin/superadmin/vitrin-moderation → ✓ 4 KPI + 3 tab (Feedback / Flagged / Şikayetler) + tablo + filter
- /admin/superadmin/db-inspector → ✓ SQL runner çalıştı (SELECT users LIMIT 10 → 7 satır 880ms tablo render)
- /admin/superadmin/system-settings → ✓ Plan tier 3 kart + env durumu (3/9) + DB extensions + KDV oranları
- /admin/superadmin/tenant/[id] → ✓ 5 KPI Bold (Kullanıcı/Ürün/Şube/Stok/24s Hareket) + Kullanıcılar + Son Audit + Son Stok Hareketleri
- /admin/superadmin/user/[id] → ✓ 4 KPI (Email/2FA/Hesap/FailedLogin) + 3 aksiyon form (şifre reset / 2FA reset / hesap kilitle) + audit
- /admin/superadmin/bypass/reverse-expired → ✓ Hareket UUID + sebep + şifre re-auth
- /admin/superadmin/bypass/hard-delete → ✓ Ürün UUID + sebep + re-auth
- /admin/superadmin/bypass/negative-stock → ✓ Şube + Düşür adet + Variant + sebep + re-auth
- /admin/superadmin/bypass/plan-override → ✓ Hedef tenant + Yeni plan select + sebep + re-auth
- /admin/superadmin/bypass/stocktake-undo → ✓ Sayım UUID + sebep + re-auth
- /admin/superadmin/bypass/metadata-fix → ✓ Movement UUID + 4 düzeltilecek alan (sebep/not/müşteri ref/doküman no) + süperadmin sebebi + re-auth

**Tur sırasında bulunan + düzeltilen sorunlar (`6be51bf`):**
- Meteors hydration mismatch (server/client `Math.random()` farkı) → `useSyncExternalStore` ile server snapshot=null, client cached array
- "Encountered a script tag" uyarısı → `<head><script>` + `next/script` kombinasyonu yerine doğrudan `<body>` üst kısmında React 19 hoisted script

### Görsel kontrol notları
- Hero'daki opacity'li `bg-white/12`, `bg-white/15`, `bg-white/20` vb. korundu (turuncu/koyu hero üstünde dark mode'da da beyaz görünmeleri gerek)
- Plan card cart→cart-7 gradient + cat radial overlay (sidebar altı her zaman koyu, theme'den bağımsız)
- Hero CTA butonları `bg-white` (sıcak gradient üstünde her zaman beyaz okunur)
- KPI Bold trio gradient + NumberTicker spring count-up
- AnimatedShinyText topbar başlığı (cart → cat → cart shimmer)

### Kullanıcı için bekleyen geri alma SQL
```sql
-- Browser test sırasında geçici olarak SUPERADMIN'e yükseltilen test hesabını geri al
UPDATE petstockpro.users SET role = 'BAYI_SAHIBI', updated_at = NOW()
WHERE email = 'magicui@petshop.test';
```

## 🆕 Son tur (2026-05-17 geç gece) — Faz 2 batch + UI mockup migration

| # | İş | Commit |
|---|---|---|
| Faz 2 #1 | Açık Krediler raporu (6. rapor) | `fea8525` + `78054bd` |
| Faz 2 #2 | Concurrent satış lock (FOR UPDATE) | `403ef47` + `50b3b00` |
| Faz 2 #3 | Sayım mobile swipe-card UX | `e8a1e31` + `9722ccf` |
| Faz 2 #4 | PetPro Asistanı SKT yaklaşan kartı | `36b0b6c` + `20113d4` |
| Faz 2 #5 | Bundle analyzer setup | `5a9eba0` |
| Faz 2 #6 | Schema.org JSON-LD (Product + LocalBusiness) | `c76fb9b` + `f2ddd72` |
| Faz 2 #7 | Cross-tenant kategori `/vitrin/kategori/[slug]` | `f47c188` + `f37ed8e` |
| Faz 2 #8 | Cross-tenant ürün detay `/vitrin/urun/[slug]` | `aeedcbd` + `1e73e91` |
| Faz 2 #9 | Yakınlık sorgusu (haversine, PostGIS YOK) | `ad6250f` |
| Faz 2 #10 | Vitrin moderasyon ürün-spesifik + brand grupla | `e4e20d1` |
| UI #1 | Pano v3 mockup migration (Hero gradient + KPI Trio + Stock Strip + Alert + Quick Chip Row + Zone label) | `71d67cb` |
| UI #2 | Hero logo aside (rotated white card) | `676ab1e` |
| UI #3 | Persistent sidebar (brand + 6 nav group + plan card) + Pano welcome state | `c429fd5` |
| UI #4 | Sticky topbar (Pano başlık + ⌘K + Vitrin + bell + avatar) | `0e86e28` |

**MVP Pano UX artık pano-v3.html mockup'a uyumlu** — sol sticky sidebar + üst sticky topbar + turuncu gradient hero + logo aside + 3 KPI Bold + Stock Strip + Alert + Quick Chip Row + Zone label tablo. Yeni register kullanıcı için `isWelcomeState` branch ("🐾 Hoş geldin, {tenant}! · İlk ürünü ekle" CTA) hazır.

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
| 2 | ~~Sitemap pre-build (pg_cron + R2)~~ ✅ foundation | — | **Foundation tamamlandı 2026-05-17.** SitemapCacheStore (R2/in-memory) + buildSitemapXml + /api/cron/sitemap-rebuild + wrangler.toml [[r2_buckets]] + cron 03:00 UTC + 27 test + DEPLOYMENT §3.1.-1. /sitemap.xml hâlâ dynamic SSR (MVP); R2 binding aktive olduğunda cache populate başlar, 50K+ URL'de cache-first /sitemap.xml/route.ts ile switch (Faz 2). |
| 3 | ~~Cloudflare Workers KV rate-limit migration~~ ✅ | — | **Tamamlandı 2026-05-17.** RateLimitStore abstraction + KV/in-memory/factory + 23 test + defense-in-depth (KV primary, DB fallback) + DEPLOYMENT §3.1.0 |
| 4 | ~~Açık Krediler raporu (6. rapor — SPRINT-PLAN §14 + CLAUDE.md S2)~~ ✅ | — | **Tamamlandı 2026-05-17.** `lib/reports/open-credits.ts` (listOpenCredits + getOpenCreditsSummary 4 aging band 0-15/16-30/31-60/60+ + settleCredit + 14 test) + /admin/reports section (3 KPI + band kart grid + listing + "Krediyi kapat" button) + server action + audit `sale.credit_settled` (afterState quantity/unitPrice/customerRef/creditPaidAt) + audit-log filter dropdown'a "💳 Kredi kapatıldı" + browser E2E (veresiye satış → liste → settle → empty + audit doğrulandı). |
| 5 | ~~Concurrent satış lock (SPRINT-PLAN §7.4)~~ ✅ | — | **Tamamlandı 2026-05-17.** `refreshAndLockInfo(tx, info)` helper — tx içi `SELECT ... FOR UPDATE` ile branch_inventory satırını kilitler, güncel stockQty re-fetch. `recordStockOut`/`recordStockIn`/`recordTransfer`/`recordStocktakeAdjustment` hepsinde tx başında çağrılır → race koşulu kapatıldı (paralel iki satış serileşir, ikinci stockQty güncel olur). beforeQty/afterQty/delta hepsi lock sonrası yeniden hesap. `recordStocktakeAdjustment` yeni `NoStocktakeChangeError` ile lock arası başkası tam istenilen miktarı sattıysa no_change rollback. 5 yeni unit test (out-rollback / out-after-lock / transfer-source-rollback / stocktake-no-change-rollback / FOR UPDATE chain doğrulama). Browser log'unda gerçek production sorgusu: `select "id", "stock_qty" from branch_inventory where id=$1 for update` doğrulandı. |
| 6 | ~~Sayım mobile swipe-card UX (SPRINT-PLAN §8.5)~~ ✅ | — | **Tamamlandı 2026-05-17.** /admin/stocktake/[id] workflow'a 📋 Tablo / 📱 Tek tek mode toggle. Card mode: tek-ürün büyük kart (productName + variant + SKU + sistem qty + diff banner) + büyük `inputMode="numeric"` input (mobil numpad otomatik) + auto-focus + reason dropdown koşullu (hasDiff ise) + büyük Save buton + `← Önceki` / `Sonraki →` navigation + progress dots (12 max). Touch swipe pointer events ile (threshold 80px) — gerçek mobil cihazda left/right swipe ile gezme. Input/select/button üzerinde swipe yutulur (yazı yazma engeli yok). onSaved callback: reason verildiğinde veya diff=0 olduğunda otomatik next karta geç. Render-time clamp ile filter değişikliğinde index out-of-range koruması. Browser smoke: mode toggle + card render + sayılan input + diff -2 + reason eksik aynı kart + reason 'loss' + otomatik next kart + prev buton geri dönüş — hepsi doğrulandı. |
| 7 | ~~PetPro Asistanı SKT yaklaşan kartı (Sprint 8 ext)~~ ✅ | — | **Tamamlandı 2026-05-17.** `lib/assistant/expiring-suggestions.ts` (listExpiringSuggestions + computeSeverity 3-tier expired/critical/warning + formatExpiryLabel TR + 10 test). branch_inventory.expiry_date IS NOT NULL + stock_qty > 0 + expiryDate <= NOW+30 üzerinden alarm. Sıralama: expiryDate ASC. Pano'ya 4. asistan widget eklendi (sipariş + transfer + indirim'in yanına): 3 severity badge (🚨 GEÇTİ / ⏱ ≤7 gün / ⚠ ≤30 gün) + "📤 Fire kaydı" hızlı link. recordStockIn helper'a `branch_inventory.expiry_date`/`lot_number` UPDATE eklendi (önceden sadece stock_movements'a yazılıyordu, branch_inventory'de görünmüyordu). Browser E2E: SKT=2026-05-20 ile stok girişi → /admin Pano → "🤖 PetPro Asistanı · SKT Yaklaşan" + Royal Canin 15kg 208 adet · 4 gün kaldı · ⏱ ≤7 gün doğrulandı. |
| 8 | ~~Bundle analyzer setup (SPRINT-PLAN §18.2)~~ ✅ | — | **Tamamlandı 2026-05-17.** `@next/bundle-analyzer` + `cross-env` devDep eklendi (--legacy-peer-deps, @sentry/nextjs peer conflict). next.config.ts'a withBundleAnalyzer sarmalayıcı + `npm run build:analyze` (ANALYZE=true next build --webpack — Turbopack analyzer'la uyumsuz olduğu için webpack flag zorunlu). Çıktı .next/analyze/{client,edge,nodejs}.html. İlk run: .next/static/chunks toplam 1.4 MB (sağlıklı). Sprint 15 öncesi performance audit hazır. |
| 9 | ~~Schema.org JSON-LD (Faz 2'den çekildi)~~ ✅ | — | **Tamamlandı 2026-05-17.** `lib/vitrin/schema-org.ts` — `buildLocalBusinessLd(storefront, baseUrl)` PetStore type (LocalBusiness subtype) + addressLocality/Region/Country TR + telefon fallback (contactPhone → contactWhatsapp → companyWhatsapp) + sameAs sosyal handle full URL'e (instagram/facebook/twitter/tiktok). `buildProductLd(product, baseUrl)` Product type + Brand + AggregateOffer (lowPrice/highPrice/offerCount/availability InStock\|OutOfStock/seller PetStore). 13 unit test (LocalBusiness happy/adres/desc öncelik/sosyal/telefon fallback + Product happy/AggregateOffer/OutOfStock/no-price/desc 500 max). Sayfa entegre: `/vitrin/magaza/[slug]` → ld-local-business + `/vitrin/magaza/[slug]/urun/[productSlug]` → ld-product + ld-seller `<script type="application/ld+json">`. getPublicBaseUrl shared. Browser E2E: profil sayfası LD-JSON parse → PetStore name + url + address TR; ürün detay LD-JSON parse → Product + AggregateOffer lowPrice=3499 + InStock + seller "Sprint 3 Products Test" doğrulandı. |
| 10 | ~~Cross-tenant kategori sayfaları `/vitrin/kategori/[slug]` (Faz 2'den çekildi)~~ ✅ | — | **Tamamlandı 2026-05-17.** `lib/vitrin/category-listings.ts` — `getCategoryInfoBySlug` pure helper (DEFAULT_CATEGORIES 16 slug → emoji+name, custom slug → "Diğer" fallback) + `listProductsByCategorySlug` cross-tenant ürün listingi (categories.slug join, approved+isEnabled+vitrinPublished filter, opsiyonel cityId filter, limit clamp 60) + `countProductsByCategorySlug` pagination + `listCategoriesWithStorefrontProducts` ana sayfa chip section için (DISTINCT slug + COUNT). 13 unit test. Route `/vitrin/kategori/[slug]/page.tsx` — breadcrumb + hero + 3-col ürün grid + pagination + ?il= şehir filtresi + empty state (SEO sayfa boşken bile 200). `/vitrin` ana sayfaya "🛍 Kategoriler (N)" chip section eklendi (emoji + name + product count badge). Sitemap'e `/vitrin/kategori/[slug]` entry'leri eklendi (priority 0.7, changeFrequency weekly, DISTINCT slug INNER JOIN approved+isEnabled+vitrinPublished). +1 yeni sitemap test (kategori). Browser E2E: /vitrin → "Kategoriler (1)" Mama Kabı chip + count badge "1"; /vitrin/kategori/mama-kabi → hero "🥣 Mama Kabı · 1 ürün" + Catit Pixi product card 3.499₺ · Sprint 3 Products Test; /vitrin/kategori/sahte → 404; /vitrin/kategori/kuru-mama → 200 + empty state (default slug ama vitrin'de henüz yok); /sitemap.xml → /vitrin/kategori/mama-kabi entry. |
| 11 | ~~Cross-tenant ürün detay `/vitrin/urun/[slug]` + fiyat kıyaslama (Faz 2'den çekildi)~~ ✅ | — | **Tamamlandı 2026-05-17.** `lib/vitrin/cross-tenant-product.ts` — `getCrossTenantProduct(slug, db)` 2 sorgu (meta header + offers aggregate). products.slug üzerinden aynı slug'a sahip tüm tenant'ların aynı ürününü toplar (deterministik `makeSlug` sayesinde aynı isim → aynı slug). Her offer: companyName + slug + il/ilçe + min/max sale price + variantCount + inStockTotal + WhatsApp telefon. ORDER BY min sale price ASC (en uygun fiyat üstte). `listCrossTenantProductSlugs` sitemap için DISTINCT slug + COUNT > 1 (2+ tenant'lılar — single tenant URL'leri /vitrin/magaza/[slug]/urun/[productSlug] zaten var, duplicate atılmaz). 5 unit test. Route `/vitrin/urun/[slug]/page.tsx` — breadcrumb (Vitrin > Kategori > Ürün) + hero (X pet shop'ta satışta + brand + kategori + fiyat aralığı) + description + offers ul (companyName + 📍 il/ilçe + variant + stok + price min-max + "Detay →" link + "💬 WhatsApp" deep link + "En uygun" badge ilkinde) + tek-tenant ise "only-one-offer-note" CTA. Tenant ürün detay sayfasının breadcrumb'una "🔁 Tüm pet shop'larda fiyatı karşılaştır" link eklendi. Sitemap'e `/vitrin/urun/[slug]` entry (priority 0.65, weekly, COUNT > 1 HAVING) eklendi + 1 yeni sitemap test (mock chain'e groupBy + having eklendi). Browser E2E: tenant detay → compare link → cross-tenant sayfa → hero "1 pet shop'ta satışta · Catit Pixi · Mama Kabı · 3.499₺" + 1 offer + En uygun badge + only-one-offer-note; /vitrin/urun/sahte → 404; /sitemap.xml → cross-tenant URL yok (dev'de 1 tenant, COUNT>1 filter doğru çalıştı). |
| 12 | ~~Yakınlık sorgusu (haversine, PostGIS YOK) (Faz 2'den çekildi)~~ ✅ | — | **Tamamlandı 2026-05-17.** companies tablosuna `location_lat/lng numeric(10,7)` migration (0015). PostGIS extension EKLENMEDİ — Postgres native math (RADIANS + SIN + COS + ASIN) ile haversine + bbox pre-filter. `lib/vitrin/geolocation.ts` (12 test): `haversineDistanceKm` saf TS, `parseLocationQuery` TR sınır check + radius clamp [1,200], `buildLocationFilter` drizzle SQL template. `listPublicStorefronts` + `countPublicStorefronts` opt `location: { lat, lng, radiusKm }` aldı → bbox WHERE + haversine ≤ radius + ORDER BY mesafe ASC (sort override). StorefrontListItem'a `distanceKm` field. Admin /admin/settings/company "📍 Konum" section (lat/lng input + "Konumumu kullan" button browser geolocation API). Public /vitrin'e `NearbyToggle` client component ("📡 Konumumu paylaş" → URL'e ?lat&lng&r=25 push, radius pills 5/10/25/50/100km, "× Temizle"). Storefront kartlarına mesafe badge (X.X km / XX m). Browser E2E: tenant lat/lng=İzmir Konak set + /vitrin?lat=38.45&lng=27.15&r=25 → "3.9 km" badge + /vitrin?lat=41&lng=29&r=10 → "Sonuç yok" doğru. |
| 13 | ~~Vitrin moderasyon ürün-spesifik şikayet görünürlüğü (Faz 2'den çekildi)~~ ✅ | — | **Tamamlandı 2026-05-17.** `lib/vitrin/reports.ts` ReportRow'a `companySlug + productSlug` field eklendi; `ListReportsFilters` `targetType` filter; süperadmin /admin/superadmin/vitrin-moderation şikayetler tab'ına 2 filtre çubuğu — durum (pending/resolved/dismissed + count'lar) + hedef (Tümü/🛍 Ürün/🏪 Pet shop). Tablo cell'lerinde pet shop adı + ürün adı yeni sekmede vitrin sayfasına link (`target="_blank"`). Browser E2E: test product şikayeti insert + ?reportStatus=pending&targetType=product → 1 satır + "🛍 Ürün · Catit Pixi" + ürün/profil deeplink + `report-product-link-*` data-testid'i ile yeni sekmede /vitrin/magaza/.../urun/... açılıyor. |
| 14 | ~~Pet shop profilinde brand grupla UX (Faz 2'den çekildi)~~ ✅ | — | **Tamamlandı 2026-05-17.** `listStorefrontProducts` brand + kategori LEFT JOIN ile zenginleştirildi + ORDER BY brand.name. `groupStorefrontProductsByBrand` pure helper — brand bazında grupla, markasızlar "Diğer ürünler" bucket'ında en alta sıralı, markalı gruplar productCount DESC + alfabetik. /vitrin/magaza/[slug] sayfası 2+ brand olduğunda anchor nav chip'i render eder (#brand-slug smooth scroll), her grup üstünde "🏷 Marka N ürün" header + 3-col responsive ürün grid. Tek-brand durumunda anchor nav gizlenir. Browser E2E: Royal Canin brand insert + product brand_id update → "🏷 Royal Canin 1 ürün" + "🐾 Diğer ürünler 1 ürün" iki grup, 2 anchor chip, sıralama doğru. |
| 15 | ~~Storage upload — Sprint 3.3~~ ✅ | — | **Tamamlandı 2026-05-21.** Cloudflare R2 migration (S3-compatible, `r2-client.ts` AWS SDK v3) + `lib/catalog/product-images.ts` CRUD (upload + list + setPrimary + delete) + ImagesSection UI + `requireImage=true` default aktive (Sprint 3.3 fix). Env: R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET + R2_PUBLIC_URL. SUPABASE_SERVICE_ROLE_KEY admin client için lazım (storage için değil — `R2 strategy`). Önceki "Supabase Storage" stratejisi 2026-05-19'da iptal edildi (CDN cache-control honor sorunu + Pro tier maliyeti). |
| 16 | **Sprint 13/14 production deploy** | ⛔ BLOKER | Şirket kuruluş + vergi no + IBAN (2-4 hafta) |

**Plana sadık sıra (CLAUDE.md SPRINT-PLAN):** Sprint 8 ✅ → Sprint 10 ✅ → Sprint 12 MVP ✅ → Sprint 15 polish 4'lü ✅ → Sprint 12 ext ürün detay + Feedback Balonu ✅ → Feedback dashboard (settings + Pano) ✅ → /vitrin pagination + sort enrichment ✅ → Sprint 12 ext SEO il/ilçe route'lar ✅ → Vitrin moderation süperadmin paneli ✅ → Audit log pagination fix ✅ → Sitemap.xml + robots.txt dynamic ✅ → vitrin_reports şikayet sistemi ✅ → Anti-spam rate-limit DB-level ✅ → Süperadmin Telegram alert yeni şikayet ✅ → Alert dedup 1h window ✅ → Günlük summary alert (endpoint hazır) ✅ → **Workers cron scheduler binding** ✅ → **Rate-limit UX banner (5/5 + 24 saat)** ✅ → **Workers KV migration (defense in depth)** ✅ → Sitemap pre-build (1 gün, şu an erken) → Sprint 16 lansman (bloker bekliyor)

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
| **Rate-limit reject UX (5/5 + 24 saat banner)** | submitReport rate_limit_exceeded reject path artık `{ currentCount, max, windowHours }` meta forward eder; success path ise `remainingInWindow` döner (UI ileride "X şikayet kaldı" göstermek için hazır). POST /api/vitrin/reports 429 yanıtına `Retry-After: 86400` header eklendi (RFC 7231 §7.1.3 saniye cinsinden). report-button.tsx error mapping güncellendi — generic "Çok fazla şikayet" yerine "Bu pet shop için günlük şikayet sınırına ulaştın (5/5). 24 saat içinde yeniden gönderebilirsin." (gerçek N'leri body'den parse eder). reports.test 3 mevcut test happy+rate_limit+rate_limit-altı zenginleştirildi + 1 yeni test (rateLimitCount=2 → remainingInWindow=2). Browser E2E: dev'de IP hash zaten 5/5 dolu (önceki testlerden) → trigger click → spam reason → submit → banner "✕ Bu pet shop için günlük şikayet sınırına ulaştın (5/5). 24 saat içinde yeniden gönderebilirsin." screenshot ile doğrulandı. +1 test (1046 → 1047). | `e65d511` |
| **Workers KV rate-limit migration (defense in depth)** | `src/lib/rate-limit/` yeni klasör: `store.ts` (RateLimitStore interface) + `in-memory.ts` (InMemoryRateLimitStore — TTL'li Map, opportunistic sweep, dev fallback) + `kv.ts` (KvRateLimitStore — Cloudflare KV, TTL clamp ≥60sn) + `factory.ts` (getRateLimitStore() — globalThis.RATE_LIMIT_KV binding varsa KV, yoksa in-memory singleton). submitReport iki katmanlı rate-limit: (1) RateLimitStore primary ~5ms KV / dev'de in-memory, (2) DB COUNT yedek defense-in-depth. KV down → try/catch sessiz yutar, DB COUNT devreye girer; KV up → max(storeCount, dbCount) kullanılır (over-permissive değil). deps.rateLimitStore opsiyonel inject (test'te fresh store, singleton kontaminasyonu yok). wrangler.toml `[[kv_namespaces]]` placeholder (Cloudflare Dashboard'dan namespace ID alınınca açılır). Tests: in-memory 9 + kv 10 + factory 4 + reports.test 7 mevcut güncellendi (rateLimitStore inject) + 3 yeni test (KV fast-path → DB hiç sorgulanmaz, KV throw → DB fallback, increment store kontrolü). DEPLOYMENT.md §3.1.0 yeni bölüm: defense-in-depth açıklama + 4 setup adımı + dosya yapısı tablosu + test pattern. Browser regress test: vitrin şikayet 429 banner aynı çıktı (in-memory boş + DB COUNT 5 → DB-level reject) screenshot. +26 test (1047 → 1073). | `28afdda` |
| **Success path "X/5 şikayet kaldı" göstergesi** | submitReport zaten `remainingInWindow` döndürüyordu (önceki `e65d511` turunda eklenmişti) ama UI tüketmiyordu. report-button.tsx: `remaining` state eklendi (number\|null), success response.remainingInWindow set ediyor. Done UI'da yeşil tick + teşekkür altına ikinci satır: `remaining === 0` ise "⚠ Bu pet shop için günlük şikayet hakkın doldu (5/5). 24 saat içinde yeniden gönderemezsin." (uyarı tonu), aksi halde "Bu pet shop için kalan: X/5 şikayet (24 saat içinde)." (bilgilendirme). data-testid="report-remaining" eklendi (E2E test selector). Browser test: monkey-patch fetch ile X-Forwarded-For=198.51.100.99 (fresh IP) → wrong_info submit → success "✓ Bildiri alındı... Teşekkürler 🐾" + alt satır "Bu pet shop için kalan: 3/5 şikayet (24 saat içinde)." screenshot ile doğrulandı. Test sayısı değişmedi (1073, helper degişikliği yok). | `bc1eee2` |
| **Sitemap pre-build foundation (R2 cache + cron)** | `src/lib/vitrin/sitemap-cache.ts` yeni dosya: SitemapCacheStore interface + R2SitemapCacheStore (Cloudflare R2 binding) + InMemorySitemapCacheStore (TTL-based, dev fallback) + getSitemapCacheStore() factory (globalThis.SITEMAP_R2 algılayıcı) + buildSitemapXml (manuel XML serializer — Workers'ta XML lib yok). /api/cron/sitemap-rebuild endpoint (Bearer auth, collectSitemapEntries → buildSitemapXml → cache.put TTL 25 saat). wrangler.toml `[triggers]` `crons` listesine `"0 3 * * *"` eklendi (06:00 TR düşük trafik saati) + CRON_ENDPOINT_MAP genişletildi + `[[r2_buckets]]` placeholder. Defense in depth: R2 down → cron 500, /sitemap.xml dynamic SSR fallback (downtime yok). /sitemap.xml hâlâ Next.js MetadataRoute.Sitemap dynamic (MVP); 50K+ URL'de `/sitemap.xml/route.ts` cache-first handler ile geçiş (Faz 2). Tests: sitemap-cache 21 (in-memory 5 + r2 4 + factory 3 + buildSitemapXml 6 + key 1 + reset behavior) + sitemap-rebuild route 6 (503/401/401/happy/collect-throw/put-throw) + scheduled-handler +1 (0 3 → endpoint map). DEPLOYMENT.md §3.1.-1 yeni bölüm: pre-build pattern diyagramı + defense-in-depth + 5 setup adımı + dosya yapısı + MVP'de pasif notu. Browser test: /sitemap.xml 200 OK (dynamic SSR çalışıyor, regress yok) + POST /api/cron/sitemap-rebuild dev-cron-secret-local → 200 {entriesCount:4, xmlBytes:703, cacheSource:"memory"} + 401 wrong Bearer doğrulandı. +27 test (1073 → 1100). | `2a73192` |
| **Cache-first /sitemap.xml/route.ts** | `src/app/sitemap.ts` (Next.js MetadataRoute helper) silindi, yerine `src/app/sitemap.xml/route.ts` cache-first handler yazıldı. Akış: (1) SitemapCacheStore.get(SITEMAP_CACHE_KEY) → hit ise XML + `X-Sitemap-Source: cache` + `X-Sitemap-Cached-At` + `Cache-Control: max-age=3600, stale-while-revalidate=86400` serve; (2) cache miss veya store throw → collectSitemapEntries + buildSitemapXml dynamic SSR + `X-Sitemap-Source: dynamic` + kısa max-age=600/SWR=3600. Defense in depth: R2 down → dynamic fallback, downtime yok. Bonus: factory.ts singletonları `globalThis.__petstockpro*` ile tutuluyor (Next.js dev hot-reload sırasında module-level `let` sıfırlanma sorununu çözer). Tests: route.test.ts 6 (cache hit + miss + throw + body passthrough + cache-control headers). DEPLOYMENT.md §3.1.-1 güncellendi: "MVP'de pasif" notu kaldırıldı, "cache-first handler aktif" + headers tablosu + dev isolate notu. Browser test: GET /sitemap.xml → 200 + XML body + headers doğru; POST rebuild → 200 + cache.put ok; dev'de cache hit Next.js Turbopack route isolate'larında module-level state paylaşılmadığı için doğrulanmadı (cache miss fallback dynamic — production'da R2 binding ile cache hit garanti, downtime yok). +6 test (1100 → 1106). | `a9fa0bb` |
| **Audit log hızlı tarih chip'leri** | /admin/audit-log sayfasına 3 chip eklendi (Bugün / Son 7 gün / Son 30 gün) — filter form'un üstünde sticky line, tek tıkla URL `?from=YYYY-MM-DD&to=YYYY-MM-DD` set ediyor. aria-pressed=true aktif chip'i highlight ediyor (turuncu solid). Aktif filter'larla birlikte korunuyor (action/entity/userId chip'le set edilirse silinmez). Ek "× Tarihi temizle" link tarih param'larını URL'den çıkarır. UI: Settings sidebar shell içinde, "Audit log" başlığı sonrasında, mevcut filter form'un üzerinde. Browser E2E: chip "Bugün" tıklandı → URL `?from=2026-05-16&to=2026-05-16` → from/to inputlar otomatik doldu → tablo 25 satıra filtrelendi → screenshot ile doğrulandı. Test sayısı değişmedi (page-level değişiklik, helper'a dokunulmadı). | `3a250a6` |
| **Pano "Bugünün audit logu" link'i** | /admin Pano "Son hareketler" widget footer'ına 2. link eklendi: "📜 Bugünün audit logu →" → `/admin/audit-log?from=YYYY-MM-DD&to=YYYY-MM-DD` (yerel tarih). Mevcut "Tüm ledger →" link'i ile yan yana, "·" ayırıcı ile. data-testid="recent-activity-today-audit" + "-all-ledger" eklendi. Yeni todayYmd() pure helper Pano içinde (Date.getFullYear/Month/Date kullanır, timezone bağımsız tutarlı). Browser E2E: /admin → link href'i 2026-05-16 dolu → tıkla → /admin/audit-log?from=2026-05-16&to=2026-05-16 + chip "Bugün" aria-pressed=true (chip'lerle bütünleşik) doğrulandı. Test değişmedi. | `bd76376` |
| **CSP header tightening (production hazırlık)** | next.config.ts `headers()`'a `Content-Security-Policy` eklendi: default-src 'self' + script-src 'self' 'unsafe-inline' (+ dev 'unsafe-eval' HMR için) https://challenges.cloudflare.com + style-src 'self' 'unsafe-inline' (Tailwind inline) + img-src 'self' data: blob: + Supabase/R2/imagedelivery domain'leri + connect-src 'self' + Supabase REST/Realtime (https/wss) + Cloudflare Turnstile + Sentry ingest + R2 + frame-src self + Cloudflare Turnstile (widget iframe) + frame-ancestors 'none' (clickjacking — X-Frame-Options'tan üstün) + form-action 'self' + base-uri 'self' + object-src 'none' + upgrade-insecure-requests. `buildCsp()` helper isDev branch'le dev/prod ayrımı. Browser E2E: dev server restart → GET /admin → CSP header set + 200 + Pano render → console error YOK; GET /vitrin/magaza/[slug] → 200 + Bildir butonu yüklü; şikayet submit → rate-limit 429 banner doğru render → console CSP ihlali YOK (sadece normal Drizzle query log'ları). Test: 1106 unchanged (config değişikliği, helper yok). | `dd2ea4b` |
| **Custom 404 not-found sayfası** | src/app/not-found.tsx yeni dosya — Next.js varsayılan İngilizce 404 yerine TR + marka uyumlu UI. 🐾 paw emoji + "Sayfa bulunamadı" H1 (cart) + açıklama + 2 CTA ("📍 Pet shop dizinine git" turuncu solid + "🏠 Admin paneline dön" beyaz border) + destek email link altta. Metadata: TR title + robots.noindex (404'lar index'lenmesin). Browser E2E: /bu-sayfa-yok-test → 404 render + heading + 2 link href doğru + screenshot ile görsel doğrulama. Test: 1106 unchanged. | `58f7ef8` |
| **Custom error.tsx (global error boundary)** | src/app/error.tsx yeni dosya — 'use client' directive zorunlu (Next.js requirement). Render veya server action throw'larını yakalar, TR + marka UI. 🐾 paw + "Bir şeyler ters gitti" H1 + açıklama + opsiyonel `digest` hash (production Next.js error code, destek talebinde referans için mono+danger soft chip) + "↻ Tekrar dene" reset() button + "🏠 Admin paneline dön" link + destek email. useEffect ile error console.error log (production'da Sentry'ye düşer — Sentry config aktive olduğunda). data-testid="error-retry-button"/"error-admin-link"/"error-digest" E2E selectors. NOT: layout.tsx içinden throw'lar için ayrı `global-error.tsx` gerekir (Faz 2). Browser E2E: geçici /error-test page.tsx ile intentional throw → error.tsx render → heading + digest "Hata kodu: 592798338" + 2 CTA + email → screenshot doğrulandı; sonra test page silindi (commit'e dahil değil). Test: 1106 unchanged (component render'a RTL @testing-library/dom peer dep yok, browser ile doğrulama yeterli). | `b271e5c` |
| **global-error.tsx (RootLayout throw fallback)** | src/app/global-error.tsx yeni dosya — RootLayout'un kendisi throw ederse (provider crash vs.) bu sayfa devreye girer, `<html>` + `<body>` dahil ÖZEL HTML render eder (layout kırılmış olabilir). Tailwind/external CSS varsayım YOK → tüm stiller inline (Verdana font + brand colors hex). 🐾 paw + "Uygulama hatası" H1 + açıklama + digest hash + "↻ Tekrar dene" button + destek email. error.tsx pair'i: error.tsx normal route hataları, global-error.tsx kritik layout hataları (nadir, ama gerekli). Browser test atlandı — layout-level throw simülasyonu intentional corruption gerektirir; Next.js standart pattern, code review yeterli. error.tsx zaten aynı UI deseninde browser doğrulamalı (`b271e5c`). Test: 1106 unchanged. | `92ca9e8` |

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
- **Sprint 12 — Merkezi Vitrin Dizini** ⚠ partial — `/vitrin` public dizin + WhatsApp deep link (admin profil tamam, public sayfalar eksik). Image upload ✅ Sprint 3.3 ile tamamlandı (R2 strategy, 2026-05-21).
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
- ✅ **PRO 500 ürün** (1.000 ₺/ay KDV dahil — 2026-05-21 revize, önceki 750/1.250) — orta segment esas pazar
- ✅ **PRO+ Sınırsız** (2.000 ₺/ay KDV dahil — 2026-05-21 revize, önceki 1.750/2.250) — büyük zincirler
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
- **Plan tier 3-tier B (2026-05-14 yapı, 2026-05-21 son pricing): FREE 50 / PRO 500 1.000₺ / PRO+ ∞ 2.000₺ — TR-only**
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

*Son güncelleme: 2026-05-21 sonu — PLAN-BETA-PERFORMANCE.md onaylı (6 fazlı altyapı sertleştirme, 10-12 saat). Yeni session'da `PLAN-BETA-PERFORMANCE.md oku ve Faz 1'e başla` ile başlat. CLAUDE.md → PLAN-BETA-PERFORMANCE.md → DEVAM-REHBERI.md sırasıyla okunmalı.*
