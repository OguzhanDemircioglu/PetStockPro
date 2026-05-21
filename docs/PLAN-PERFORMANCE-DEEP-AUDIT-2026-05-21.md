# Performance Deep Audit — 2026-05-21

**Hedef:** "Daha iyisi olamaz" seviyesinde performans. PLAN-BETA-PERFORMANCE 6/6 faz tamam (auto-bootstrap, log retention, error tracking, PetSpinner, TanStack Query, optimistic CRUD) ama gerçek production darboğazları için derin audit.

**Mevcut durum:** 1649 test pass, 0 lint, 0 typecheck. 27 commit pushed. Tüm sayfalar dinamik (67 route). 2.8 MB chunks (en büyük 928K).

---

## 🔴 P0 — Kritik (lansman bloker, ms cinsinden büyük kazanım)

### P0-1. Vitrin TÜM sayfalar `force-dynamic` → CDN cache bypass

**Bulgu:** 9 public vitrin sayfası `export const dynamic = 'force-dynamic'`:
- `/vitrin`, `/vitrin/[il]`, `/vitrin/[il]/[ilce]`, `/vitrin/ara`, `/vitrin/kategori/[slug]`, `/vitrin/marka/[brand]`, `/vitrin/urun/[slug]`, `/vitrin/magaza/[slug]`, `/vitrin/magaza/[slug]/urun/[productSlug]`

**Etki:** Cloudflare CDN/Workers cache **bypass**. Her request DB'ye + SSR + tam render. 1K visitor/saat'te DB çöker.

**Fix:**
- `export const revalidate = 60` (1 dk ISR) — yeterince taze, %95+ cache hit
- `Cache-Control: public, max-age=60, stale-while-revalidate=300` Response header
- `/vitrin/urun/[slug]` ve `/vitrin/magaza/[slug]` için longer revalidate (300s — ürün/mağaza profili değişiklik az)
- `/vitrin/ara` için no-cache (gerçek-zaman arama gerek) ama PostGIS query cache pgvector layer

**Süre:** 1-2 saat. Test: lighthouse before/after, Cloudflare hit ratio.

---

### P0-2. `react.cache()` kullanılmıyor → duplicate DB query layer-içi

**Bulgu:** `grep "react.*cache(" src/` = 0 hit. Layout 4 query + pano 10 helper → bunların bir kısmı duplicate (örn. `companies.id` lookup hem layout hem `getDashboardStats`'te).

**Etki:** Her admin route page load'da ~14-20 DB query. `companies` ve `branch_inventory` lookups duplicate.

**Fix:**
- `src/lib/cache/request-scoped.ts` — React `cache()` ile wrap:
  - `getCompanyById(id)` — request başına 1 query
  - `getActiveBranchesByCompany(id)` — request başına 1 query
  - `getUnreadNotificationCountForUser(userId)` — layout + pano duplicate'i tek query
- Helpers'da `cache()` wrapping → request-scoped memoize
- `unstable_cache()` ile cross-request cache (Next.js built-in) — örn. `cities` (81 row, sabit), `default_categories` (16 row)

**Süre:** 2-3 saat. Test: pano DB query log before/after, ms ölçüm.

---

## 🟠 P1 — Önemli (gözle görülür kazanım, 1K tenant ölçeğinde kritik)

### P1-1. `companies.storefront_status` index yok → Seq Scan

**Bulgu:** EXPLAIN ANALYZE `WHERE storefront_status = 'approved'`:
```
Seq Scan on companies c (cost=0.00..11.12 rows=1) (actual time=0.068..0.069 rows=1)
  Filter: (storefront_status = 'approved'::petstockpro.storefront_status)
  Rows Removed by Filter: 7
```
Şu an 7 row, planning 4.4ms. 1K tenant'ta seq scan **lineer kötüleşir**.

**Etki:** Vitrin'in en sık filter'ı. `/vitrin`, `/vitrin/ara`, popular products, nearby — hepsi bu filter'la başlıyor.

**Fix:** Migration 0023:
```sql
CREATE INDEX CONCURRENTLY idx_companies_storefront_approved
  ON petstockpro.companies (storefront_status)
  WHERE storefront_status = 'approved';
```
Partial index — sadece "approved" row'ları tutar, çok küçük + hızlı.

**Süre:** 30 dk + Drizzle migration generate + apply.

---

### P1-2. Drizzle ORM `.prepare()` kullanılmıyor → query plan cache yok

**Bulgu:** `grep "\.prepare\(" src/lib` = 0 hit. Tüm sorgular her execution'da parse + plan ediliyor. Planning Time 4-12ms gözlemlendi (boş tabloda — gerçek yükte daha kötü).

**Etki:** Hot path query'ler (pano dashboard stats, layout 4 query, vitrin popular products) per-request +5-10ms planning overhead.

**Fix:**
- En sık 10-15 query için `.prepare()` ile pre-compile
- Örnek: `src/lib/dashboard/stats.ts` `getDashboardStats` — 7 paralel sub-query, hepsi prepare edilebilir
- `placeholder()` ile dinamik param

**Süre:** 2 saat (refactor + test). Beklenen kazanım: -5-10ms per query × 14 query = **-70-140ms per pano load**.

---

### P1-3. Layout + Pano query consolidation

**Bulgu:** `/admin/layout.tsx` 4 query + `/admin/page.tsx` 10 helper = 14+ paralel ama bazıları duplicate (örn. `companies.plan` hem layout hem helper içinde).

**Etki:** Pano load'da gereksiz duplicate DB roundtrip.

**Fix:**
- React `cache()` (P0-2 ile birlikte) duplicate'i otomatik elimine eder
- Veya bilinçli consolidate: `getPanoBootstrap(companyId, userId)` tek helper, tüm gerekli veriyi tek call'da getir (CTE ile)

**Süre:** 2 saat. Beklenen kazanım: 14 → 6-8 query.

---

## 🟡 P2 — Orta (kullanıcı algılaması iyi, prod scale'de fark eder)

### P2-1. Bundle size — 928K tek chunk

**Bulgu:** `.next/static/chunks` toplam 2.8 MB, en büyük tek dosya **928K**. Detay yok (analyzer eklenmedi).

**Etki:** İlk page load yavaş, özellikle 3G/4G mobile.

**Fix:**
- `@next/bundle-analyzer` ekle → `ANALYZE=true npm run build` ile detaylı görüntü
- Suspect: Magic UI animations (snowfall, number-ticker, pulsating-button, animated-shiny-text), Leaflet, exceljs (server-only mu kontrol), qrcode (lazy load)
- Action: 3rd party'leri `dynamic({ ssr: false })` ile lazy load + admin-only bundle ayrı

**Süre:** 1-2 saat audit + 1-2 saat fix.

---

### P2-2. Marketing pages static yapılabilir

**Bulgu:** `/fiyatlar`, `/kvkk`, `/cerez-politikasi`, `/iletisim`, `/mesafeli-satis-sozlesmesi`, `/uyelik-sozlesmesi` → tümü `ƒ` (dinamik). Bu sayfalar **content sabit**, auth gerekmez.

**Etki:** Her request SSR + DB call ihtiyacı (aslında DB call yok ama dinamik routing maliyeti).

**Fix:** `export const dynamic = 'force-static'` veya `revalidate = 3600`. Cloudflare edge cache.

**Süre:** 30 dk. Direkt kazanım: marketing trafiği DB'yi hiç tutmaz.

---

### P2-3. Suspense streaming yok — slow query tüm sayfayı bekletir

**Bulgu:** Pano page.tsx 10 helper await'le. Yavaş helper (`getFeedbackSummary` veya `listExpiringSuggestions`) tüm sayfayı engeller.

**Fix:** `<Suspense>` boundary ile her PetPro öneri kartı bağımsız stream:
```tsx
<Suspense fallback={<PetSpinner size="md" />}>
  <PetProDiscountSuggestions companyId={...} />
</Suspense>
```
Pano top-half (hero + KPI + alert) önce gelir, alt-half (öneri kartları) sonra.

**Süre:** 2 saat. Beklenen kazanım: First Contentful Paint **-200-500ms**.

---

### P2-4. Image optimization audit

**Bulgu:** Next/Image kullanılıyor (`<img>` = 0). Ama `priority`, `sizes`, `loading="lazy"` audit yapılmadı.

**Fix:** Critical images (vitrin hero logo, ürün primary image above-fold) `priority` set; alt-fold images explicit `loading="lazy"`. `sizes` props attr eklenmemiş yerleri kontrol et.

**Süre:** 30 dk audit + 30 dk fix.

---

## 🟢 P3 — İnce ayar (production polish)

### P3-1. Server action `revalidatePath` granular

**Bulgu:** Bazı action'lar `revalidatePath('/admin')` veya `revalidatePath('/admin/products')` çağırıyor — geniş scope, başka kullanıcının cache'i de invalidate olabilir.

**Fix:** `revalidateTag()` kullan (Next.js 13+) — tenant-scope tag'leme.

**Süre:** 1-2 saat.

---

### P3-2. `font-display: swap` / `font-feature-settings` audit

**Bulgu:** Verdana sistem font kullanılıyor (Google Fonts yok) ✓ ama `font-display` configured mu, `tabular-nums` for prices?

**Fix:** Global CSS audit + `font-variant-numeric: tabular-nums` for price/qty display.

**Süre:** 30 dk.

---

### P3-3. Middleware (proxy) optimize

**Bulgu:** Tüm route'larda middleware çalışıyor (proxy). Static asset'leri exclude etmek edge'de büyük tasarruf.

**Fix:** `matcher` config — `/api`, `/admin`, `/vitrin` only.

**Süre:** 30 dk.

---

### P3-4. TanStack Query staleTime tune

**Bulgu:** Default `staleTime: 30s` — bazı veriler için fazla agresif, bazıları için yetersiz.

**Fix:** Query-bazında staleTime:
- `notificationKeys` — 60s (sık değişmez)
- `productKeys.detail` — 5 dk (manuel edit dışında değişmez)
- `stockMovementKeys` — 10s (sık güncelleme)

**Süre:** 1 saat.

---

## 📊 Beklenen Toplam Kazanım

| Faz | Süre | Kazanım |
|---|---|---|
| P0-1 + P0-2 | 4-5 saat | Vitrin TTFB %70-90 azalır, admin pano DB load -%30-50 |
| P1 (3 fix) | 4-5 saat | Per-request -100-200ms, 1K tenant scale ready |
| P2 (4 fix) | 4-6 saat | Bundle -%30, FCP -200-500ms |
| P3 (4 fix) | 3-4 saat | Polish, production ready |
| **Toplam** | **15-20 saat** | **Lighthouse 95+** |

---

## 🗂 Uygulama Sırası

Önce **P0** (en yüksek ROI):
1. **Tur 1:** P0-1 vitrin revalidate + cache headers (1-2 saat)
2. **Tur 2:** P0-2 React cache() + unstable_cache (2-3 saat)

Sonra **P1**:
3. **Tur 3:** P1-1 storefront_status index + Drizzle migration (30 dk)
4. **Tur 4:** P1-2 Drizzle .prepare() hot path (2 saat)
5. **Tur 5:** P1-3 query consolidation (2 saat)

Sonra **P2**:
6. **Tur 6:** P2-1 bundle analyzer + lazy load (3-4 saat)
7. **Tur 7:** P2-2 static marketing (30 dk)
8. **Tur 8:** P2-3 Suspense streaming (2 saat)
9. **Tur 9:** P2-4 Image audit (1 saat)

Sonra **P3**:
10. **Tur 10:** P3 polish (3-4 saat)

**Her tur sonrası:** test + lint + typecheck + browser smoke + DB query log ölçümü.

---

## ✅ "Mükemmel" kıstası (kabul kriterleri)

- [ ] Vitrin TTFB < 100ms (Cloudflare cache hit)
- [ ] Admin pano TTFB < 200ms (cache + consolidation)
- [ ] Lighthouse Performance 95+ (mobile)
- [ ] Bundle First Load JS < 200kB per route
- [ ] DB query count per page ≤ 6 (was 14+)
- [ ] Per-query Planning Time < 1ms (prepared statement)
- [ ] 1K concurrent visitor stress test (artillery/k6) — p99 < 500ms

---

*Audit: 2026-05-21 gece. Yazan: Claude (Performance Deep Audit Tur 1).*
