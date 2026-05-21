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

---

## 🆕 İkinci tur — Ek Derin Bulgular (2026-05-21 gece geç)

### P0-3. `postgres-js` config'de `prepare: false` — prepared statements explicit kapalı

**Bulgu:** `src/lib/db/client.ts`:
```ts
const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10,
  prepare: false,  // ❌ TÜM prepared statements kapalı
  ...
});
```

**Neden böyle:** Supabase PgBouncer transaction mode ile prepared statements çakışıyor (sticky connection yok). Production'da Hyperdrive kullanılınca destek var.

**Etki:** P1-2 bulgusu (Drizzle `.prepare()` yok) tek başına yetmez. `postgres-js` seviyesinde de planning cache yok. Bu yüzden EXPLAIN ANALYZE planning 4-12ms.

**Fix:**
1. Production'da Hyperdrive aktif → `prepare: true` aç
2. Veya `pgbouncer=true` query param ile Drizzle adaptasyonu
3. Veya `transform.undefined` + manuel statement cache (advanced)

**Süre:** 1 saat + deployment test. Beklenen: Planning < 1ms.

---

### P1-4. **Vitrin arama `ILIKE %query%`** → leading wildcard, B-tree index kullanmaz

**Bulgu:** `src/lib/vitrin/search.ts`:
```ts
or(ilike(products.name, parsed.ilikePattern), ilike(brands.name, parsed.ilikePattern)),
```
`ilikePattern = '%escaped%'` → leading wildcard → **her zaman seq scan**.

**Önemli detay:** `catalog_seed_products` üzerinde **`gin_trgm_ops` index var** (Migration 0018) ama gerçek `products.name` + `brands.name` üzerinde YOK.

**Etki:** 1K-10K ürün'de vitrin arama lineer kötüleşir. Bu vitrin'in 2. en sık çalışan endpoint (popüler products'tan sonra).

**Fix:** Migration 0024:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- zaten var (0018)
CREATE INDEX CONCURRENTLY idx_products_name_trgm
  ON petstockpro.products USING GIN (lower(name) gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_brands_name_trgm
  ON petstockpro.brands USING GIN (lower(name) gin_trgm_ops);
```
Search query'i `lower()` ile sarmalayıp index kullanılır hale getir.

**Süre:** 30 dk + migration + lib refactor + test. Beklenen: 1K ürün'de seq scan → GIN index, %50-90 hızlanma.

---

### P1-5. `next.config.ts` `experimental.optimizePackageImports` YOK

**Bulgu:** next.config aktif: bundle-analyzer + AVIF/WebP + CSP. Ama:
- `experimental.optimizePackageImports` yok
- `experimental.serverComponentsHmrCache` yok
- `output: 'standalone'` yok
- `compress` ayarsız (default Cloudflare yapar)

**Etki:** Magic UI components, lucide-react, framer-motion gibi büyük paketler **tam import** ediliyor → 928K chunk büyüklüğüne katkı.

**Fix:**
```ts
experimental: {
  optimizePackageImports: [
    'lucide-react',
    'framer-motion',
    '@tanstack/react-query',
    'date-fns',
    'recharts',
  ],
  serverComponentsHmrCache: true,
}
```

**Süre:** 30 dk. Beklenen: -%20-30 bundle size, faster HMR dev.

---

### P2-5. Notifications `refetchOnWindowFocus: true` — 1K user × 30s = 30K req/s

**Bulgu:** `src/app/providers.tsx`:
```ts
queries: {
  staleTime: 30_000,
  refetchOnWindowFocus: true,  // ❌ her focus switch'te refetch
  retry: 1,
},
```

**Etki:** Concurrent admin'ler tab switch'de notifications + diğer query'leri refetch eder. 1K aktif kullanıcı, tab focus burst → trafik spike. Plus laptop sleep/wake → mass refetch.

**Fix:** Query-level override:
- Notifications: `refetchOnWindowFocus: false` (NotificationBell setQueryData zaten anlık)
- Product/category lists: stale data kabul OK
- Critical mutation (stock-out): pre-mutation refetch yeterli

**Süre:** 1 saat. Beklenen: Refetch trafiği -%80.

---

### P2-6. Drizzle `db.query.X.findMany` (relational) hiç kullanılmıyor

**Bulgu:** `grep "db\.query\." = 0 hit`. 264 manuel `leftJoin`/`innerJoin` ile yazılmış sorgular.

**Etki:** Drizzle's relational API (`db.query.products.findMany({ with: { variants: true, images: true } })`) **tek query** çıkarır + tip-güvenli. Manuel join'lerle yazılınca her seferinde N+1 risk (yan tablo ayrı query).

**Örnek:** `getProductDetail` 5 ayrı select yapıyor olabilir → 1 query relational ile.

**Fix:** En kritik 3-5 helper'ı (`getProductDetail`, `getDashboardStats`, `listPopularProducts7d`) relational query'e geçir. Pilot olarak ölç.

**Süre:** 3-4 saat. Beklenen: DB roundtrip -%30-50 hot path'lerde.

---

### P3-5. TanStack Query Devtools production'da include edilmedi mi?

**Bulgu:** `src/app/providers.tsx`:
```tsx
{process.env.NODE_ENV !== 'production' && (
  <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
)}
```

Conditional render ✓ ama Devtools paketi `dependencies` mı `devDependencies` mi? Tree-shaking düzgün yapılıyor mu?

**Fix:** `package.json` check, gerekirse `devDependencies`'a taşı + bundle analyzer confirm.

**Süre:** 15 dk.

---

### P3-6. Cron route'ları cache'ed mı?

**Bulgu:** 4 cron route var (`/api/cron/cleanup-old-logs`, `daily-summary`, `errors-threshold-check`, `sitemap-rebuild`) — hepsi `dynamic = 'force-dynamic'` ✓ (cron uniquely çalışır).

**Endişe:** Cloudflare Workers cron schedule + Next.js cron handler match etmiyorsa boş hit. `wrangler.toml` cron schedule kontrol edilmeli.

**Fix:** wrangler.toml inceleme + Cloudflare Workers log doğrulama (Sprint 14 production deploy sırasında).

**Süre:** Production deploy ile birlikte.

---

### P3-7. Sitemap.xml — 1K product × cross-tenant scaling

**Bulgu:** `/sitemap.xml` `revalidate = 3600` (1 saat) ✓. Şu an N pet shop × M ürün = ~100 satır.

**Etki (gelecek):** 500 pet shop × 50 ürün = 25K URL → sitemap.xml 5-10 MB. Sitemap index split gerekir.

**Fix:** sitemap-index pattern hazırla (Faz 2). 1K tenant'a kadar şu an yeterli.

**Süre:** Faz 2.

---

### P3-8. Audit log retention'a INSERT yoğunluğu

**Bulgu:** Audit log her server action'da yazılıyor (12 yerde `writeAuditLogAsync`). 1K tenant × günde 100 hareket = 100K audit row/gün.

**Etki:** Audit tablo hızla büyür. Şu an retention yok (CLAUDE.md: "audit_logs ASLA silinmez").

**Fix:** Partition by `created_at` (PostgreSQL declarative partitioning) ay/yıl bazında. Eski partition'ları Cold Storage'a aktar.

**Süre:** Production'da 6+ ay sonra gerekli. Faz 2'ye saklı.

---

### P3-9. Connection pool `max: 10` — Cloudflare Workers scale'de yetersiz

**Bulgu:** `postgres({ max: 10 })`. 1K concurrent request'te connection bekler.

**Detay:** Cloudflare Workers default isolate-bazlı, her isolate kendi pool'unu yapabilir. Hyperdrive zaten pool yönetir.

**Fix:** Production'da Hyperdrive aktif → bu config dev-only sayılır. Local'de stress test gerek değil.

**Süre:** Sprint 14 production deploy.

---

## 📊 Güncellenmiş Toplam Kazanım

| Faz | Bulgu | Süre | Kazanım |
|---|---|---|---|
| P0 (3 fix) | 1, 2, **3** (postgres-js prepare) | 5-6 saat | Vitrin TTFB %70-90, admin DB -%30-50, planning <1ms |
| P1 (5 fix) | 1, 2, 3, **4** (ILIKE trgm), **5** (optimizePackageImports) | 6-7 saat | Per-request -100-200ms, search 1K ürün %50-90 hızlanma, bundle -%20-30 |
| P2 (6 fix) | 1, 2, 3, 4, **5** (refetch tuning), **6** (relational query) | 8-10 saat | Refetch -%80, hot path DB roundtrip -%30-50, FCP -200-500ms |
| P3 (9 fix) | 1-4, **5-9** (devtools, cron, sitemap, audit retention, pool) | 5-6 saat | Polish, scale-ready 5K tenant |
| **Toplam** | **23 fix** | **24-29 saat** | **Lighthouse 95+, p99 <500ms 1K concurrent** |

---

## 🗂 Uygulama Sırası (Güncellenmiş — 23 fix)

Önce **P0** (en yüksek ROI):
1. **Tur 1:** P0-1 vitrin revalidate + cache headers (1-2 saat)
2. **Tur 2:** P0-2 React cache() + unstable_cache (2-3 saat)
3. **Tur 3:** P0-3 postgres-js prepare config (Hyperdrive ready, 1 saat)

Sonra **P1**:
4. **Tur 4:** P1-1 storefront_status index migration (30 dk)
5. **Tur 5:** P1-4 products.name + brands.name pg_trgm GIN index + lib refactor (1-2 saat)
6. **Tur 6:** P1-5 optimizePackageImports + next.config performance flags (30 dk)
7. **Tur 7:** P1-2 Drizzle .prepare() hot path (P0-3 + P1-2 birlikte etkili, 2 saat)
8. **Tur 8:** P1-3 query consolidation + relational query pilot (2 saat)

Sonra **P2**:
9. **Tur 9:** P2-1 bundle analyzer çalıştır + büyük chunk audit (1 saat)
10. **Tur 10:** P2-1 fix — Magic UI / Leaflet / exceljs lazy load (2-3 saat)
11. **Tur 11:** P2-2 static marketing (`/fiyatlar`, `/kvkk`, vb.) (30 dk)
12. **Tur 12:** P2-3 Pano Suspense streaming (2 saat)
13. **Tur 13:** P2-4 Image priority/sizes audit (1 saat)
14. **Tur 14:** P2-5 refetchOnWindowFocus query-bazında tune (1 saat)
15. **Tur 15:** P2-6 relational query — 3 hot path helper (3-4 saat)

Sonra **P3**:
16. **Tur 16:** P3-1 revalidateTag granular (1-2 saat)
17. **Tur 17:** P3-2 + P3-3 font + middleware matcher (1 saat)
18. **Tur 18:** P3-4 TanStack staleTime query tune (1 saat)
19. **Tur 19:** P3-5 + P3-6 + P3-7 polish (1 saat)
20. **Tur 20:** P3-8 + P3-9 audit partition + pool (Faz 2'ye saklı — production scale)

**Her tur sonrası:** test + lint + typecheck + browser smoke + DB query log ölçümü.

**Süre öncelik:** P0 3 tur (5-6 saat) ile kritik kazanımın %70'i alınır. P1-P2 ile %95'e ulaşılır.

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
