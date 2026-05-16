# PetStockPro — Deployment Strategy

**Domain:** petstockpro.com (Cloudflare DNS, alındı)
**Frontend + API:** Cloudflare Workers + OpenNext (önerilen) — Faz 2
**Database:** Supabase Postgres (kullanıcının mevcut projesi)
**Storage:** Supabase Storage
**Email:** Brevo SMTP
**Monitoring:** Sentry + Cloudflare Analytics

> Domain Cloudflare'de olduğu için **Cloudflare Workers + OpenNext** doğal seçim. Bu doküman deploy stratejisini ve adımlarını detaylar.

---

## 1. Mimari Diyagramı

```
                        ┌────────────────────────────┐
                        │   Cloudflare DNS            │
                        │   petstockpro.com           │
                        │   www.petstockpro.com       │
                        └────────────┬───────────────┘
                                     │
                        ┌────────────▼───────────────┐
                        │   Cloudflare CDN + Workers │
                        │   (OpenNext build)         │
                        │   • Edge cache             │
                        │   • DDoS koruma            │
                        │   • SSL otomatik           │
                        └────────────┬───────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
    ┌─────────▼────────┐  ┌─────────▼────────┐  ┌─────────▼────────┐
    │ Public Vitrin     │  │ Admin Paneli      │  │ Süperadmin       │
    │ petstockpro.com   │  │ petstockpro.com   │  │ petstockpro.com  │
    │ /vitrin/* (public)│  │ /admin/* (auth)   │  │ /admin (auth+role)│
    └──────┬────────────┘  └─────┬────────────┘  └─────┬────────────┘
           │                     │                      │
           └─────────────────────┼──────────────────────┘
                                 │
                    ┌────────────▼──────────────────┐
                    │   Supabase (eu-central-1)     │
                    │   📍 Region: Frankfurt, DE     │
                    │   schema: petstockpro         │
                    │   • Postgres + RLS            │
                    │   • Auth                       │
                    │   • Realtime (WebSocket)      │
                    │   • Storage (S3 uyumlu)       │
                    │   • Edge Functions             │
                    └───────────────────────────────┘

Dış servisler (MVP):
  • Brevo SMTP (e-posta) — Sprint 0'da bootstrap, Sprint 16 lansman için Pro tier $35/ay
  • Telegram Bot API — Sprint 10'da admin bildirim entegrasyon
  • Cloudflare Turnstile (bot koruması) — Sprint 2'de auth formlarında (register/forgot-password/change-email/login 5+ fail) — $0 limitsiz, TECH-STACK §3.9c
  • Cloudflare Workers AI (LLaVA image moderation) — Sprint 12'de vitrin görsel doğrulama
  • iyzico (TR ödeme) — Sprint 13'te subscription tahsilat
  • Nilvera (e-Arşiv fatura) — Sprint 14'te e-Arşiv kesim (vergi mükellefi pet shop için opsiyonel)

Opsiyonel / opsiyonelize (MVP'de aktif değil veya sade pattern):
  • Sentry (errors) — MVP'de opsiyonel; Cloudflare Workers Logs + Telegram alert pattern $0 alternatif (DEPLOYMENT §8.5). Lansman sonrası 100+ event/gün olursa Sentry Team plan ($26/ay) değerlendir.

Faz 2'ye saklı (TR-only kararı, 2026-05-14):
  • Paddle (yurt dışı ödeme MoR) — yurt dışı talep gelirse açılır
  • Frankfurter API (TRY/USD/EUR kur) — multi-currency aktive olursa
```

---

## 2. Domain Yapılandırması

### 2.1 DNS Kayıtları (Cloudflare DNS)

```
Type    Name              Content                    Proxy
A       @                 [Cloudflare Workers]       ☁ Proxied
CNAME   www               petstockpro.com            ☁ Proxied
```

> **2026-05-14 (MANTIK-HATALARI O1):** Wildcard `*.petstockpro.com`, `super.petstockpro.com`, `app.petstockpro.com` kayıtları **kaldırıldı**.
>
> - Tenant subdomain modeli iptal (2026-05-13)
> - Süperadmin **ayrı subdomain veya path kullanmıyor** — tek `/admin` + role-based menü (CLAUDE.md #1 kural: tek geliştirici sade tut)
> - "Süperadmin" URL'de geçmiyor. SUPERADMIN role'lü kullanıcı login olunca sidebar'da ek menüler görür (🔧 Sistem, 🏢 Tüm Tenant'lar, 📊 Loglar). Normal ADMIN bu menüleri görmez.
> - Auth gating: `users.role = 'SUPERADMIN'` JWT claim'i middleware'de kontrol edilir, normal ADMIN ek menülere `403 Forbidden` alır.

### 2.2 SSL/TLS

- **Mode:** Full (strict)
- **Edge Certificate:** Auto (Let's Encrypt)
- **Universal SSL:** Sadece `petstockpro.com` + `www.petstockpro.com` (wildcard kaldırıldı, MANTIK-HATALARI O1)
- **HSTS:** Enabled, max-age 1 yıl, includeSubDomains, preload

### 2.3 Supabase Region — Frankfurt (eu-central-1) — 2026-05-14 onaylandı

**Karar:** Tüm Supabase kaynakları (Postgres, Auth, Realtime, Storage, Edge Functions) **`eu-central-1` (Frankfurt, Almanya)** region'ında.

**Neden Frankfurt:**

| Faktör | Değer |
|---|---|
| TR latency (İstanbul ↔ Frankfurt) | ~30-40ms (kullanıcı algılayamaz) |
| Supabase olgunluk | En stabil + feature-complete region |
| Yurt dışı pet shop (Faz 2 Paddle) | Avrupa müşterilere yakın |
| Veri koruma standardı | EU GDPR + KVKK uyumlu |
| Maliyet | US East ile aynı seviye |

**Cloudflare Workers region kararı YOK:** Workers global edge ağı — her müşteri en yakın edge node'dan hizmet alır (TR pet shop'ları otomatik İstanbul edge'inden, Almanya'dan bağlananlar Frankfurt edge'inden). Region seçimi sadece Supabase için anlamlı.

#### KVKK Uyumu (Frankfurt = yurt dışı veri lokasyonu)

Veri AB'de tutulduğu için KVKK Madde 9 **yurt dışı veri aktarımı** maddesi aktive olur. Çözüm — **3 katmanlı uyum**:

1. **Kayıt formu (auth.html — Sprint 2):**
   ```
   ☐ Verilerimin Avrupa Birliği'nde (Almanya, Frankfurt) saklanmasına
     açık rızam vardır. KVKK Madde 9 kapsamında detay → [Aydınlatma Metni]
   ```
   Bu checkbox **işaretlenmeden** kayıt tamamlanamaz (zorunlu).

2. **Aydınlatma metni (`/legal/aydinlatma`):**
   - "Veri lokasyonu: Almanya (Supabase Inc., eu-central-1 / Frankfurt)"
   - Supabase'in DPA (Data Processing Agreement) referansı
   - Veri sahibi hakları (silme, erişim, taşıma) — KVKK Madde 11
   - İletişim: `kvkk@petstockpro.com` (Sprint 16 lansman öncesi açılır)

3. **Sub-processor listesi:**
   - Supabase Inc. (Postgres + Auth + Storage + Realtime — Frankfurt, AB)
   - Cloudflare Inc. (CDN + Workers — global edge, ABD HQ)
   - Brevo SAS (e-posta SMTP — Paris/AB)
   - Sentry / Functional Software Inc. (hata izleme — ABD)
   - iyzico (TR ödeme — TR)
   - Nilvera (e-Arşiv — TR)

**Müşteri tarafı (vitrin ziyaretçi) KVKK:** Anonim IP/cookie hash'leri vitrin metriği için Frankfurt'a gider. EKRAN-PUBLIC-VITRIN §13.5 opt-out modeliyle uyumlu (KVKK Md.5/2: "meşru menfaat" + minimum veri).

**Önemli:** Bu karar **TR-only kararıyla çelişmiyor** — TR-only = TR müşteri + TR pet shop + TRY para birimi + TR vergi. Sunucu region veri lokasyonu ayrı bir mesele. Sub-processor listesinde Almanya zaten var (Supabase). KVKK Madde 9 açık rıza akışı bu nedenle TR-only kararında **kaldırılmadı** (yurt dışı **müşteri** akışı kaldırıldı — yurt dışı **veri lokasyonu** ayrı).

---

### 2.4 E-posta MX (Brevo için)

```
Type    Name    Content                       Priority
MX      @       mx1.brevo.com                10
MX      @       mx2.brevo.com                20
TXT     @       "v=spf1 include:spf.brevo.com ~all"
TXT     mail._domainkey  "v=DKIM1; ..."      (Brevo'dan al)
TXT     _dmarc  "v=DMARC1; p=none; ..."
```

---

## 3. Cloudflare Workers Setup

### 3.1 Wrangler Configuration

> **2026-05-17:** `wrangler.toml` skeleton repo'ya commitlendi (`/wrangler.toml`). Aşağıdaki içerik **kanonik referans** — repo'daki dosya bundan üretildi. Lansman öncesi Hyperdrive ID + secrets eklenecek.

```toml
# wrangler.toml
name = "petstockpro"
main = "src/cf/worker-entry.ts"   # OpenNext aktive olunca .open-next/worker.js'e geçer veya wrapper kalır
compatibility_date = "2026-01-15"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"

# Custom domains (2026-05-13: tenant subdomain ve PRO+ custom domain RAFA — sadece tek domain)
routes = [
  { pattern = "petstockpro.com/*", custom_domain = true },
  { pattern = "www.petstockpro.com/*", custom_domain = true },
  # ESKİ: { pattern = "*.petstockpro.com/*", custom_domain = true },  # tenant subdomain (iptal)
]

# Env vars (production secrets — wrangler secret put ile ekle)
[vars]
NEXT_PUBLIC_APP_URL = "https://petstockpro.com"
NEXT_PUBLIC_APP_DOMAIN = "petstockpro.com"
NEXT_PUBLIC_SITE_URL = "https://petstockpro.com"

# Cron Triggers (Workers Scheduled Events) — Sprint 12 ext daily summary
[triggers]
crons = [
  "0 6 * * *",   # 06:00 UTC = 09:00 TR — günlük vitrin şikayet özeti (süperadmin Telegram alert)
]

# Secrets (wrangler secret put X)
# - CRON_SECRET                       # /api/cron/* Bearer auth
# - DATABASE_URL
# - DATABASE_URL_DIRECT
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_JWT_SECRET
# - AUTH_SECRET
# - IYZICO_API_KEY / IYZICO_SECRET_KEY / IYZICO_WEBHOOK_SECRET
# - NILVERA_API_KEY
# - BREVO_API_KEY
# - TELEGRAM_BOT_TOKEN
# - TURNSTILE_SECRET_KEY
# - SENTRY_AUTH_TOKEN

# Hyperdrive (Supabase pooling — Cloudflare)
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive-id>"   # Cloudflare Dashboard > Workers > Hyperdrive'dan al

[observability]
enabled = true
```

### 3.1.-1 R2 Bucket — Sitemap Pre-build Cache (Sprint 12 ext, 2026-05-17)

50K+ URL'e ulaştığında `/sitemap.xml` dynamic SSR (Workers 5dk + 100MB request limit) yetersizleşir. Pre-build pattern:

```
Workers cron 03:00 UTC → /api/cron/sitemap-rebuild →
  collectSitemapEntries (DB) → buildSitemapXml → SitemapCacheStore.put (R2)

/sitemap.xml (mevcut Next.js MetadataRoute.Sitemap) → şu an dynamic SSR
  ↑ 50K+ URL'de ayrı /sitemap.xml/route.ts handler ile cache-first switch
```

**Defense in depth (rate-limit gibi):**
- R2 binding varsa cache update başarılı → /sitemap.xml ileride cache'den serve eder
- R2 down olursa cron 500 döner, /sitemap.xml dynamic SSR fallback (downtime yok)
- Cache TTL 25 saat (günlük cron başarısız olursa 1 saat tolerans)

**Setup:**

1. Cloudflare Dashboard > R2 → bucket yarat (örn `petstockpro-sitemap`)
2. `wrangler.toml` `[[r2_buckets]]` bloğunu açık hâle getir:
   ```toml
   [[r2_buckets]]
   binding = "SITEMAP_R2"
   bucket_name = "petstockpro-sitemap"
   ```
3. `wrangler deploy` — Workers runtime'da `env.SITEMAP_R2` erişilebilir
4. `src/lib/vitrin/sitemap-cache.ts` `globalThis.SITEMAP_R2` üzerinden algılar
5. Sprint 14 OpenNext aktive olunca cron otomatik tetiklenir (`[triggers]` `crons = ["0 3 * * *"]`)

**Dosya yapısı:**

| Dosya | Sorumluluk |
|---|---|
| `src/lib/vitrin/sitemap-cache.ts` | SitemapCacheStore interface + R2 / in-memory impl + `buildSitemapXml` |
| `src/app/api/cron/sitemap-rebuild/route.ts` | POST endpoint (Bearer auth) — XML build + cache.put |
| `src/lib/cron/scheduled-handler.ts` | `CRON_ENDPOINT_MAP['0 3 * * *'] = '/api/cron/sitemap-rebuild'` |
| `wrangler.toml` `[triggers]` `crons` | `"0 3 * * *"` — 06:00 TR (düşük trafik saati) |

**MVP'de pasif:** Dev'de in-memory cache, /sitemap.xml hâlâ dynamic SSR. Production'da R2 binding aktive olunca otomatik kullanılır. Geçiş için Faz 2'de `/sitemap.xml/route.ts` cache-first handler yazılır.

---

### 3.1.0 KV Namespace — Rate-Limit Store (Sprint 12 ext, 2026-05-17)

Vitrin şikayet anti-spam rate-limit için Cloudflare Workers KV kullanılır (production'da ~5ms vs DB COUNT ~50ms). Dev'de KV yok → `InMemoryRateLimitStore` fallback (process restart'ta sıfırlanır).

**Defense in depth — iki katmanlı:**

1. **Katman 1 — RateLimitStore** (KV production / in-memory dev): primary, hızlı yol
2. **Katman 2 — DB COUNT** (`vitrinReports` tablosu): yedek, KV cache miss / down olunca devreye girer

Eğer KV down olursa `submitReport` exception'ı yutar (sentry breadcrumb ileride) ve DB-level COUNT'a düşer. Production'da KV up olduğunda DB sorgusu hâlâ yedek olarak çalışır (over-permissive değil) — gerçek primary, DB'den daha düşük olan max(storeCount, dbCount) kullanır.

**Setup:**

1. Cloudflare Dashboard > Workers > KV → "RATE_LIMIT_KV" namespace yarat
2. Namespace ID'sini al, `wrangler.toml` `[[kv_namespaces]]` bloğuna yaz:
   ```toml
   [[kv_namespaces]]
   binding = "RATE_LIMIT_KV"
   id = "<kv-namespace-id>"
   ```
3. `wrangler deploy` — Workers runtime'da `env.RATE_LIMIT_KV` erişilebilir
4. `src/lib/rate-limit/factory.ts` `globalThis.RATE_LIMIT_KV` üzerinden algılar (OpenNext env→globalThis bind)

**Dosya yapısı (`src/lib/rate-limit/`):**

| Dosya | Sorumluluk |
|---|---|
| `store.ts` | `RateLimitStore` interface + `RateLimitCheckResult` tipi |
| `in-memory.ts` | `InMemoryRateLimitStore` — TTL'li Map, opportunistic sweep |
| `kv.ts` | `KvRateLimitStore` — Cloudflare KV (TTL clamp ≥60sn) |
| `factory.ts` | `getRateLimitStore()` — KV binding varsa KV, yoksa in-memory singleton |

**Test pattern:** `submitReport(input, ctx, db, now, { rateLimitStore: freshStore() })` — saf fonksiyon, test'te fresh in-memory store inject edilir, singleton kontaminasyonu yok.

---

### 3.1.1 Cron Trigger Dispatcher (Scheduled Event Pattern)

Cloudflare Workers `[triggers]` `crons` her tetiklendiğinde Worker runtime `scheduled(event, env, ctx)` çağırır. `event.cron` cron expression'ını içerir, biz cron → endpoint eşlemesi ile ilgili `/api/cron/*` route'una self-invocation yaparız (Bearer auth).

**Yapı (Sprint 12 ext, 2026-05-17 implement):**

| Dosya | Sorumluluk |
|---|---|
| `wrangler.toml` `[triggers]` | Cron expression listesi |
| `src/cf/worker-entry.ts` | Worker fetch + scheduled handler (OpenNext wrapper, Sprint 14'te aktive) |
| `src/lib/cron/scheduled-handler.ts` | `dispatchScheduledCron(cron, env, deps)` saf fonksiyon (test edilebilir) |
| `src/lib/cron/scheduled-handler.test.ts` | 11 unit test (happy path + error cases + cron map coverage) |
| `src/app/api/cron/daily-summary/route.ts` | Mevcut endpoint — Bearer auth + business logic |
| `CRON_ENDPOINT_MAP` (scheduled-handler.ts) | Cron expression → endpoint path tablosu |

**Akış:**

```
CF Workers Scheduled Event (cron="0 6 * * *")
  ↓
worker-entry.ts scheduled()
  ↓
ctx.waitUntil(dispatchScheduledCron(cron, env, { fetch }))
  ↓
CRON_ENDPOINT_MAP[cron] → "/api/cron/daily-summary"
  ↓
fetch POST ${NEXT_PUBLIC_APP_URL}/api/cron/daily-summary
  Authorization: Bearer ${CRON_SECRET}
  ↓
route.ts → buildDailyReportSummary → buildDailyReportSummaryAlert → sendTelegramAlert
  ↓
Süperadmin Telegram kanalı: "📊 Günlük şikayet özeti — 24s: 3 yeni..."
```

**Neden self-invocation (HTTP) ve direct call değil:**
- Aynı code path manuel dev test (`curl -X POST .../api/cron/daily-summary`) + production cron — sürpriz yok
- Scheduled handler thin wrapper; OpenNext re-export'unu değiştirmiyor
- Bearer auth sayesinde endpoint dış dünyaya açık olsa bile cron secret olmadan tetiklenmez

**Yeni cron eklemek için:**
1. `wrangler.toml` `[triggers]` `crons` listesine cron expression ekle
2. `src/lib/cron/scheduled-handler.ts` `CRON_ENDPOINT_MAP`'e `'<expr>': '/api/cron/<name>'` ekle
3. `/api/cron/<name>/route.ts` endpoint'i yaz (Bearer auth + `CRON_SECRET` check)
4. Unit test ekle (route test pattern: `route.test.ts`)
5. `wrangler deploy` ile schedule binding'i yayına al

**Sprint 14 lansman wiring:**
1. `npm i -D @opennextjs/cloudflare wrangler`
2. `open-next.config.ts` oluştur
3. `npm run build && npx opennextjs-cloudflare` → `.open-next/worker.js` üretir
4. `src/cf/worker-entry.ts` içindeki `openNextHandler` import'unu yorumdan çıkar (placeholder fetch'i değiştir)
5. `wrangler secret put CRON_SECRET` (production değer — `openssl rand -hex 32`)
6. `npx wrangler deploy` — schedule binding otomatik ayarlanır

### 3.2 Cloudflare Hyperdrive (Önerilen)

Cloudflare Workers serverless → DB connection pooling sorunu.
**Çözüm:** Cloudflare Hyperdrive (Supabase ile uyumlu)
- Cloudflare Dashboard > Workers > Hyperdrive
- New Hyperdrive → Supabase connection string'i ekle
- Hyperdrive ID'yi wrangler.toml'a yaz
- Workers env'inde `env.HYPERDRIVE.connectionString` kullan

Maliyet: Free tier'da 5 hyperdrive, sınırsız request.

### 3.3 OpenNext Build

```bash
# Geliştirme
npm run dev       # Next.js dev server

# Cloudflare için build
npm run build     # Next.js prod build
npx opennextjs-cloudflare    # OpenNext adapter — .open-next/ klasörü üretir

# Deploy
npx wrangler deploy
```

### 3.4 Build Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - run: npx opennextjs-cloudflare
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

---

## 4. Routing (Tek Domain — 2026-05-13 revize)

> **2026-05-13 değişiklik:** Önceki "tenant subdomain `{slug}.petstockpro.com` + custom domain (PRO+)" stratejisi **iptal** edildi. Tek domain üzerinden path-based routing.

```
petstockpro.com/                    → SaaS landing (Faz 2)
petstockpro.com/admin/*             → admin paneli (auth)
petstockpro.com/admin               → süperadmin sidebar ek menüleri (role='SUPERADMIN' kullanıcı için aynı sayfada görünür — ayrı URL YOK)
petstockpro.com/[locale]/vitrin/*   → merkezi vitrin (public)
petstockpro.com/[locale]/vitrin/magaza/[slug]  → pet shop profili
```

```ts
// src/middleware.ts (basitleştirilmiş — tek domain)
export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;

  // Admin paneli (auth gerekli) — süperadmin de bu URL'i kullanır,
  // 2026-05-14 (MANTIK-HATALARI O1): ayrı /super-admin path YOK, role-based menü
  if (pathname.startsWith('/admin')) {
    return adminMiddleware(request);
    // adminMiddleware içinde:
    //   if (route SUPERADMIN-only ise + user.role !== 'SUPERADMIN') → 403
    //   ADMIN sidebar'da süperadmin menülerini hiç görmez
  }

  // Vitrin (public, locale prefix)
  if (pathname.match(/^\/(tr|en)\/vitrin/)) {
    return vitrinMiddleware(request);
  }

  // Default: locale + landing
  return NextResponse.next();
}
```

**Custom domain ve tenant subdomain kaldırıldı** — PRO+ tier kapsam dışı (PLAN-KADEMELERI.md). Sadece tek `petstockpro.com` domain.

---

## 5. Deploy Stratejisi (Sprint 16'da)

### 5.1 Pre-Production Checklist

- ✅ Tüm test senaryoları PASS
- ✅ Sentry production env aktif
- ✅ Supabase Pro tier ($25/ay)
- ✅ Cloudflare Workers paid ($5/ay)
- ✅ Brevo Pro plan (mail volume için)
- ✅ DNS kayıtları doğru
- ✅ SSL aktif (Universal SSL)
- ✅ Backup test edildi (Supabase point-in-time recovery)
- ✅ Rate limit konfigürasyonu
- ✅ Monitoring + alerts (Sentry, UptimeRobot)
- ✅ GitHub Actions CI/CD yeşil

### 5.2 Deploy Adımları

1. **Database migration (Supabase)**
   ```bash
   npx drizzle-kit migrate --config=drizzle.production.config.ts
   psql $DATABASE_URL_DIRECT -f drizzle/rls/*.sql
   psql $DATABASE_URL_DIRECT -f drizzle/triggers/*.sql
   ```

2. **Cloudflare Worker deploy**
   ```bash
   npm run build
   npx opennextjs-cloudflare
   npx wrangler deploy
   ```

3. **DNS smoke test**
   ```bash
   curl -I https://petstockpro.com
   curl -I https://test.petstockpro.com
   ```

4. **Telegram bot webhook**
   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://petstockpro.com/api/telegram/webhook"
   ```

5. **iyzico webhook (Sprint 13)**
   - iyzico Dashboard > Webhook URL: `https://petstockpro.com/api/webhook/iyzico`

6. **Sentry release**
   ```bash
   npx sentry-cli releases new $VERSION
   npx sentry-cli releases set-commits --auto $VERSION
   npx sentry-cli releases finalize $VERSION
   ```

### 5.3 Smoke Test

- [ ] https://petstockpro.com → admin landing (sonra `/login`)
- [ ] Kayıt akışı çalışıyor
- [ ] Login akışı çalışıyor
- [ ] Pano açılıyor
- [ ] Ürün ekleme çalışıyor
- [ ] Stok hareketi kaydediliyor
- [ ] Realtime feed çalışıyor (başka tab'dan)
- [ ] Vitrin petstockpro.com/vitrin merkezi dizin çalışıyor (cities/districts seed yüklü, PostGIS aktif)

### 5.4 Ödeme Entegrasyonu Lansman Checklist

`PAYMENT-INTEGRATION.md §7` detaylı checklist. Özet:

**iyzico (TR Subscription):**
- [ ] Bayi sözleşmesi imzalandı (production)
- [ ] Production API key + Secret + Webhook URL kayıt
- [ ] 3D Secure flow gerçek kart testi (küçük tutar)

**Nilvera (TR e-Arşiv):**
- [ ] PetStockPro mali mühür sertifikası (TÜBİTAK SM)
- [ ] PetStockPro GİB e-Arşiv başvurusu onaylı
- [ ] Test fatura GİB sistemine başarıyla iletildi

**Paddle (yurt dışı):**
- [ ] Vendor hesap approved (production)
- [ ] DPA imzalandı + Sub-processor listesi güncel
- [ ] EU VAT test başarılı (DE/FR/NL)
- [ ] **KVKK Madde 9 yurt dışı veri aktarım açık rıza akışı** çalışıyor

**Yasal Genel:**
- [ ] KVKK Aydınlatma metni güncel (iyzico + Paddle + Nilvera + Supabase + Cloudflare + Brevo + Sentry sub-processor listesi)
- [ ] Hizmet sözleşmesi + cayma hakkı tenant onboarding modal'ında
- [ ] privacy@petstockpro.com aktif (veri sahibi hakları talepleri için)
- [ ] ETBİS bildirimi (yer/içerik sağlayıcı pozisyonu)
- [ ] Mesafeli satış sözleşmesi YOK (biz satıcı değiliz, vitrin altında disclaimer)

---

## 6. Maliyet Tahmini (Aylık)

### 6.1 MVP / Beta (10-50 tenant)

| Servis | Plan | Maliyet |
|---|---|---|
| Cloudflare Workers | Paid ($5/ay) | $5 |
| Cloudflare Hyperdrive | Free tier | $0 |
| Supabase | Free tier | $0 |
| Brevo SMTP | Free 300/gün | $0 |
| Sentry | Free 5K event/ay | $0 |
| Cloudflare DNS | Free | $0 |
| Domain petstockpro.com | $10/yıl | ~$1 |
| **TOPLAM** | | **~$6/ay** |

### 6.2 Growth (100-500 tenant)

| Servis | Plan | Maliyet |
|---|---|---|
| Cloudflare Workers | Paid | $5 |
| Supabase | Pro ($25/ay) | $25 |
| Brevo | Pro ($35/ay 20K mail) | $35 |
| Sentry | Team ($26/ay) | $26 |
| Cloudflare AI (image moderation, YT-1) | Usage-based | ~$2-5 |
| **TOPLAM** | | **~$93-96/ay** |

### 6.3 Scale (1K+ tenant)

| Servis | Plan | Maliyet |
|---|---|---|
| Cloudflare Workers | Paid + usage | $30-50 |
| Cloudflare Hyperdrive | Paid | $10 |
| Supabase | Team ($25 base) + usage | $50-100 |
| Brevo | Premium ($65 50K mail) | $65 |
| Sentry | Business ($80) | $80 |
| **TOPLAM** | | **~$235-305/ay** |

> **Not (2026-05-14):** Bu üç tablo sadece **giderleri** gösterir. Brüt gelir hedefi yanıltıcı — net gelir için §6.4'e bakın (komisyon + vergi + OPEX düşülmüş).

### 6.4 Net Gelir Tahmini — 3-tier B Senaryosu (2026-05-14 revize, TR-only)

> **2026-05-14 revize:** Plan kademesi 2-tier → 3-tier B'ye geçti (PLAN-KADEMELERI.md). Yeni hesap **tier kompozisyonu** üzerinden yapılır. TR-only kararıyla iyzico tek tahsilat kanalı.

> **🚨 PARA AKIŞI ÇİZGİSİ (DEĞİŞMEZ):**
>
> Bu tablo **PetStockPro'nun B2B aboneliği gelir hesabıdır** — pet shop → PetStockPro yönü.
>
> - **"iyzico tahsilat ücreti %3"** = iyzico'nun **bizim** PRO/PRO+ abonelik kartını işlerken kestiği POS işlem ücreti. Bankaların POS terminal komisyonuyla aynı şey.
> - PetStockPro **pet shop'un müşterilerine sattığı ürünlerden komisyon ALMAZ**. Müşteri ↔ pet shop B2C para akışına dahil değiliz (bkz. `EKRAN-PUBLIC-VITRIN.md §13.4 + CLAUDE.md §2.5`). WhatsApp deep link açıyoruz, kalan iletişim/ödeme/kargo pet shop'un kendi işidir.
>
> Yani 8.250 ₺/ay "iyzico tahsilat ücreti" = bizim 275K ₺ B2B abonelik tahsilatından iyzico'nun kestiği yaklaşık %3 POS işlem ücreti. Pet shop'un kasa satışlarıyla **sıfır bağlantısı** vardır.

#### Senaryo: Growth — 1.000 tenant, 3-tier B Kompozisyonu

Tenant dağılımı varsayımı (TR pet shop pazar segmenti — §6.5 verisi):
- %70 FREE (700 tenant × 0 ₺ = 0 ₺) — küçük mahalle, denemelik
- %25 PRO (250 tenant × 750 ₺ = 187.500 ₺) — mahalle olgun + küçük zincir
- %5 PRO+ (50 tenant × 1.750 ₺ = 87.500 ₺) — büyük zincirler

| Kalem | Tutar (aylık) | Not |
|---|---:|---|
| **Brüt tahsilat (PRO + PRO+)** | **+275.000 ₺** | 187.500 + 87.500 |
| iyzico tahsilat ücreti (%3) | −8.250 ₺ | POS işlem ücreti — iyzico bizim PRO/PRO+ abonelik tahsilatımızdan keser. Pet shop'un kasa satışlarıyla SIFIR bağlantı (B2C dahil değiliz, bkz. üst not bloğu). |
| OPEX — Cloudflare + Supabase Pro + Brevo Pro + Sentry | −7.500 ₺ | §6.2 toplamı |
| Mali müşavir + muhasebe + Nilvera mali mühür yıllık | −2.500 ₺ | TR küçük ölçek ortalama |
| **Vergi öncesi kâr** | **+256.750 ₺** | |
| Kurumlar vergisi (%25, 2026 oranı) | −64.000 ₺ | Yıllık kârın %25'inin 12 aya bölünmüş ortalaması |
| **NET** | **~193.000 ₺/ay** | **≈ $6.400/ay** ($1 ≈ 30 ₺ varsayım) |

**Önceki tek-tier hesapla karşılaştırma:**
- 2-tier %10 conversion × 750 ₺ tekti: brüt 75.000 ₺, net ~47.000 ₺ ≈ $1.560
- 3-tier B kompozisyon: brüt 275.000 ₺, net ~193.000 ₺ ≈ $6.400
- **4× iyileşme** — PRO+ tier büyük tenant'ları yakalamayı sağlıyor

#### Senaryo: Scale — 5.000 tenant, 3-tier B

Aynı %70/%25/%5 dağılım korunarak:

| Kalem | Tutar (aylık) |
|---|---:|
| PRO tahsilat (1.250 × 750 ₺) | +937.500 ₺ |
| PRO+ tahsilat (250 × 1.750 ₺) | +437.500 ₺ |
| **Brüt toplam** | **+1.375.000 ₺** |
| iyzico tahsilat ücreti (%3) | −41.250 ₺ |
| OPEX (§6.3 Scale tier $235-305 → ~10K₺) | −10.000 ₺ |
| Mali müşavir + ekip muhasebesi | −8.000 ₺ |
| **Vergi öncesi kâr** | **+1.315.750 ₺** |
| Kurumlar vergisi (%25) | −329.000 ₺/ay ort. |
| **NET** | **~986.000 ₺/ay (≈ $32.900)** |

#### Önemli Notlar

1. **3-tier kompozisyon avantajı:** Tek-tier %10 × 750 ₺ ile karşılaştırınca 3-tier B'nin gücü PRO+ tier'da büyük tenant'lardan **ek %50 brüt** çekmesi. %5 PRO+ × 1.750 ₺ = 87.500 ₺ — bu %25 PRO'nun yarısı kadar.

2. **TR-only kararı (2026-05-14):** Paddle yurt dışı kaldırıldı. Tüm tahsilat iyzico üzerinden, blended komisyon tek %3 (bayi sözleşmesi). Detay: `PAYMENT-INTEGRATION.md`.

3. **KDV ayrı satır (2026 %20):**
   - PRO 750 ₺ KDV dahil = **625 ₺ matrah + 125 ₺ KDV**
   - PRO+ 1.750 ₺ KDV dahil = **1.458 ₺ matrah + 292 ₺ KDV**
   - "Brüt tahsilat" KDV dahil; **KDV ayrı vergi dairesine ödenir**. Pet shop vergi mükellefi ise KDV indirebilir.
   - Gerçek brüt matrah (1K tenant Growth): 187.500/1,2 + 87.500/1,2 ≈ **229.000 ₺**

4. **Nilvera mali mühür:** TÜBİTAK SM yıllık ~1.500 ₺ → aylık ~125 ₺ (mali müşavir kalemine dahil).

5. **Tek geliştirici geçim eşikleri (yeni hesap):**
   - **Growth (~$6.400/ay):** TR'de **tam zamanlı + ekip büyütme + pazarlama bütçesi mümkün**. Önceki dar marjlı $1.560 değil. PRO+ tier büyük fark yarattı.
   - **Scale (~$32.900/ay):** Büyük çaplı operasyon (5-6 kişilik ekip, agresif pazarlama, R&D bütçesi).

6. **Açık varsayımlar:**
   - Dağılım %70/%25/%5 → conversion oranları realist ama tek noktasından doğrulanmadı. Lansmandan sonra 6-12 ay gerçek veriyle kalibre edilecek.
   - Mahalle pet shop'un (FREE 50 ürün) yeterliliği lansman pilot ile ölçülmeli — %70 FREE pay yüksek görünebilir, gerçek olabilir.

7. **Lansman öncesi mali müşavir + KGK denetimi gerektirir.** Detay: `PAYMENT-INTEGRATION.md §7`.

#### Pricing Kararı (DEVAM-REHBERI Karar C — 2026-05-14'te netleştirildi)

> **Karar:** 3-tier B kabul edildi.
>   - **FREE 50 ürün** (0 ₺) — denemelik
>   - **PRO 500 ürün** (750 ₺/ay KDV dahil) — esas pazar
>   - **PRO+ Sınırsız** (1.750 ₺/ay KDV dahil) — büyük zincirler
>
> **Doğrulama gerekenler (lansman sonrası):**
> - Tier dağılımı %70/%25/%5 gerçek miydi?
> - PRO 750 ₺ pet shop için sürdürülebilir mi?
> - PRO+ 1.750 ₺ premium fiyat segmenti yakalıyor mu?
> - Lansman öncesi 30-50 pet shop pilot anketle ön-doğrulama önerilir.

### 6.5 TR Pazar Büyüklüğü Doğrulaması (2026-05-14 agent araştırması)

Yukarıdaki realist senaryonun dayanağı. DEVAM-REHBERI mantık hatası #2 düzeltmesinin pazar tarafı.

#### Pazar Büyüklüğü (TAM / SAM / SOM)

| Metrik | Değer | Kaynak |
|---|---|---|
| **TAM** — Aktif pet shop sayısı (TR) | **5.000-15.000** (resmi 5K + kayıt dışı dahil 10-15K) | GlobalPETS 2023, Parafiks 2025 sektör tahmini |
| **SAM** — Dijital olgunlaşmaya açık | **3.000-4.000** (TAM'ın %30-40'ı) | TESK 2024 + KobiTime — POS yazılımı kullanan kesim |
| **SOM** — 2-3 yıllık realistik hedef | **500-1.500 tenant** (SAM'in %15-50'si) | Sektörde "yeşil alan" + büyüme avantajı |
| **Pet pazarı 2025** | **70 milyar ₺ (~$2 milyar)**, %70 yıllık ciro büyümesi | Trendyol/Nielsen/Ipsos 2025 |
| **Pet shop kanal payı (perakende içinde)** | %28,2 | Sektör verisi |

**Şehir kırılımı (TAM içinden):**
- İstanbul: 3.000-4.000
- Ankara: 1.000-1.500
- İzmir: 800-1.200
- Bursa + Adana: her biri 500-800

#### Dijital Benimseme Tablosu (TESK 2024)

| Pet shop stok takip yöntemi | Pay | PetStockPro fırsatı |
|---|---:|---|
| Kağıt defter / Excel | %55-65 | **Birincil hedef** — sıfırdan dijitalleşme |
| Jenerik POS yazılımı (Logo Go, Mikro, BenimPOS) | %25-35 | **İkincil hedef** — variant + sayım kilidi + vitrin için geçiş |
| **Pet shop'a özel SaaS** | **%0-5** | **YEŞİL ALAN** — Türk rakibi yok |

#### Sektör Büyüme Trendi

- Mama üretici izinli işletme: **2020: 46 → 2024: 114** (%150 büyüme 4 yılda)
- Yıllık birim büyüme: %15-20 (enflasyon hariç)
- Yıllık ciro büyümesi: %50-70 (enflasyon dahil)
- TR evcil hayvan sayısı: 6,5-19M (kaynak çelişkisi — kedi-köpek dar tanım vs geniş tanım)

#### Senaryo Karşılaştırma (Brüt tahsilat bazlı)

> Aşağıdaki tabloda **kıyas amaçlı** üç senaryo. Detay hesap §6.4'te (realist) yapıldı.

| Senaryo | Tenant | Conversion | Fiyat | **Brüt/ay** | **Net/ay (vergi sonrası)** |
|---|---:|---:|---:|---:|---:|
| Pesimist | 500 | %5 | 500 ₺ | 12.500 ₺ | ~10.000 ₺ (~$330) |
| **Realist (§6.4)** | **1.000** | **%10** | **750 ₺** | **75.000 ₺** | **~47.000 ₺ (~$1.560)** |
| Optimist | 5.000 | %15 | 750 ₺ | 562.500 ₺ | ~390.000 ₺ (~$13.000) |

**Belirsizlik notları:**
- TÜİK NACE 47.76 pet shop alt-kırılımı kamuya açık değil (kod "çiçek+bitki+pet" birleşik).
- ETBİS pet kategori ayrı sayım yok.
- 5.000 (resmi) vs 15.000 (kayıt dışı) farkı TR perakende informal ekonomi gerçeği — gerçek aktif sayı ortada.

**Kaynaklar:**
- [GlobalPETS Turkey Report](https://globalpetindustry.com/article/country-report-turkey-future-looks-promising-for-turkish-pet-food-manufacturers/) — 5.000 pet shop + 1.100 veteriner klinik
- [Marketing Türkiye](https://www.marketingturkiye.com.tr/haberler/ekonomiye-pati-degdi-pet-urunleri-pazari-buyuyor/) — 70 milyar ₺ pazar, kanal kırılımı (Trendyol/Nielsen/Ipsos 2025)
- [Anadolu Ajansı](https://www.aa.com.tr/tr/ekonomi/yemek-artiklarinin-yerini-ticari-hayvan-mamalari-aldi/3232669) — Mama üretici 2020-2024 büyüme
- [Parafiks](https://parafiks.com/petshop-acma/) — 10-15K şehir kırılımı sektör tahmini
- [KobiTime](https://kobitime.com/stok-takip-programi-2026/) — TESK 2024 %40+ kağıt defter raporu
- [SATSO Ticaret](https://ticaret.satso.org.tr/nace/2122/477601-belirli-bir-mala-tahsis-edilmis-magazalarda-ev-hayvanlari-ile-bunlarin-mama-ve-gidalarinin-perakende-ticareti-sus-baliklari-kopek-kus-hamster-kaplumba.aspx) — NACE 47.76.01 tanımı

---

## 7. Yedekleme + DR

### 7.1 Backup

- **Supabase:** Free tier 7 gün, Pro tier 30 gün + point-in-time
- **Manuel:** Haftalık `pg_dump` ek snapshot (KVKK için)
- **Storage:** Supabase Storage versioned (Pro)

### 7.2 Disaster Recovery

- **RTO** (Recovery Time): 4 saat
- **RPO** (Recovery Point): < 5 dk (Pro tier)
- Cloudflare Workers global → bölge ısa otomatik failover

### 7.3 Veri Migrasyonu Senaryosu

Supabase düşerse:
- Yedek `pg_dump` mevcut
- Aiven Postgres'e restore (Pro plan $50/ay)
- Connection string güncellenir
- 4 saat içinde online

---

## 8. İzleme ve Gözlemlenebilirlik (Monitoring & Observability) Stratejisi

> **2026-05-15 revize:** Tek geliştirici lens'iyle (CLAUDE.md #1 kural) sade ve maliyet-bilinçli strateji. Grafana / Datadog / New Relic gibi ek izleme katmanları **kapsam dışı** (§8.7 gerekçesi). Sentry Faz 2'ye saklı (§8.5).

### 8.0 Strateji Özeti — 4 Katman

| # | Katman | Ne ölçer | Aracı | Maliyet | Erişim |
|---|---|---|---|---|---|
| 1 | **Edge / API** | Request count, error rate, P95 latency, CPU time, cache hit, geographic distribution, bot detection | Cloudflare Workers Analytics (built-in) | $0 | CF Dashboard + Analytics API |
| 2 | **Database / Auth** | DB CPU, memory, connection pool, slow query, storage, auth event'ler, RLS denial | Supabase Dashboard → Reports | $0 (Free) / $25/ay (Pro daha detaylı) | Supabase Dashboard + REST API |
| 3 | **Business** | Aktif tenant, plan dağılımı, davet rate, vitrin click, açık kredi, plan limit dolanlar | **Süperadmin Paneli KPI dashboard** (kendi kodumuz) | $0 (kendi yazıyoruz) | `/admin` SUPERADMIN role |
| 4 | **Real-time Alert** | Kritik hata, payment failed, vitrin şikayet, plan past_due, AI mod hatası, DB CPU >70% | Telegram bot (zaten admin bildirim için kuruluyor) | $0 (Telegram free) | Telegram Bot API |

**Felsefe:** "Yerleşik dashboard'lar her zaman var. Eksik olan **birleştirilmiş business view**'i kendi süperadmin paneline koyuyoruz. Kritik durumlar Telegram'a fırlıyor."

### 8.1 Katman 1 — Cloudflare Workers Analytics (Edge / API)

**Built-in, $0, zero-config.** Workers Dashboard'da otomatik:

| Metric | Görüldüğü yer | Alert eşiği |
|---|---|---|
| Request count (5dk/1saat/1gün) | Workers Analytics → Overview | — |
| Error rate (5xx, 4xx) | Workers Analytics → Errors | >%1 → Telegram (§8.4) |
| P50/P95/P99 latency | Workers Analytics → Performance | P95 >500ms → süperadmin alert |
| CPU time | Workers Analytics → Resources | >50ms ortalama → re-evaluation (TECH-STACK §6.7) |
| Cache hit ratio | Workers Analytics → Cache | <%80 (vitrin static path için) → SEO impact |
| Geographic distribution | Workers Analytics → Geo | TR <%90 → yurt dışı trafik başladı (Paddle Faz 2 tetikleyici) |
| Bot detection | Workers Analytics → Security | Yüksek bot → DDoS, CF firewall kuralı ekle |

**Süperadmin paneline embed:** Cloudflare GraphQL Analytics API → süperadmin KPI dashboard'a gömülür (24 saat request grafiği). Detay: `EKRAN-SUPERADMIN.md §1` KPI dashboard.

### 8.2 Katman 2 — Supabase Dashboard (DB + Auth)

**Built-in, Free tier'da temel + Pro tier'da detaylı.**

| Metric | Free | Pro | Alert eşiği |
|---|---|---|---|
| DB CPU + Memory | Snapshot | Real-time grafik | CPU >70% sürekli → Telegram |
| Connection pool | Sayı | + queries waiting | Pool >%80 dolu → re-evaluation (Hyperdrive ekle) |
| Slow query log | Limitli | 30 gün retention | Aynı query >1sn × 100 → index ekle |
| Storage | Sayı | + tablo bazlı | >%80 limit → upgrade |
| Auth event'ler | Login/logout count | + IP geo + 2FA stats | Brute force >5/dk → IP block |
| RLS policy denial | — | Audit log | Tenant cross-leak → kritik |

**Süperadmin paneline embed:** Supabase Metrics REST API → DB connection pool gauge + slow query top 10 listesi (`EKRAN-SUPERADMIN §2.6`).

### 8.3 Katman 3 — Süperadmin Paneli KPI Dashboard

**Kendi kodumuz, $0 ek bağımlılık.** Mevcut planda (`EKRAN-SUPERADMIN.md §1`) zaten var — bu doc'tan zenginleştirilecek listesi:

#### Sistem KPI (Top 4-6 Kart)
- 🏢 **Aktif tenant** sayısı + plan dağılımı (FREE/PRO/PRO+) % pie chart
- 📈 **24 saat request grafiği** (Cloudflare Analytics API embed, sparkline)
- 💾 **DB connection pool** gauge (Supabase metrics REST API, anlık)
- ⚠ **Son 50 hata feed** (Workers Logs → Supabase `system_errors` tablo → süperadmin)
- 💳 **Webhook başarı oranı** (iyzico + Nilvera son 24 saat — başarı/başarısız ratio)
- 📩 **Telegram bildirim log** (son 100, kim hangi event aldı)

#### Business KPI
- 👥 Yeni tenant kayıt/gün (son 30 gün line chart)
- 📦 Toplam ürün × tenant × plan (3-tier B kompozisyon)
- 🚪 Davet conversion (gönderilen vs kabul edilen, email vs link breakdown — 2026-05-14 hibrit)
- 🚩 Vitrin şikayet hacmi (son 7 gün, otomatik gizlenen sayı)
- 💰 MRR tahmini (PRO × 750₺ + PRO+ × 1.750₺)

#### Operasyonel
- 🔴 Past-due abonelik sayısı (kaç tenant ödeme bekliyor)
- 🛑 Otomatik askıya alınan tenant
- 📊 AI image moderation success rate (LLaVA Workers AI)
- 🎫 Açık vitrin başvuru (manuel inceleme bekleyenler)

**Implementasyon:** Sprint 7c (Süperadmin sistem ayarları) içinde KPI dashboard genişletme + Cloudflare Analytics API entegrasyonu + Supabase metrics REST API embed. Detay: `EKRAN-SUPERADMIN §1 + §2.6`.

### 8.4 Katman 4 — Telegram Alert (Real-time)

**Zaten admin bildirim için kuruluyor** (TECH-STACK §3.8). İzleme alert'leri aynı bot üzerinden, ek kurulum yok.

#### Sistem-genel Alert (Süperadmin chat'ine)

| Trigger | Önem | Kanal |
|---|---|---|
| Workers error rate >%1 (son 5dk) | 🔴 Kritik | Süperadmin Telegram + e-posta |
| DB CPU >%70 sürekli (>5dk) | 🟡 Uyarı | Süperadmin Telegram |
| DB connection pool >%80 | 🟡 Uyarı | Süperadmin Telegram |
| Cloudflare DDoS attack tespiti | 🔴 Kritik | Süperadmin Telegram + SMS (gelecek) |
| iyzico/Nilvera webhook başarı <%95 | 🟡 Uyarı | Süperadmin Telegram |
| Yeni tenant kayıt | ℹ Bilgi | Süperadmin Telegram (sessiz) |
| Süperadmin login (impersonation öncesi 2FA) | 🔴 Audit | Süperadmin Telegram |
| Storage >%80 dolu | 🟡 Uyarı | Süperadmin Telegram (upgrade tetikleyici) |

#### Tenant-bazlı Alert (Tenant'ın kendi chat'ine — `notificationTypeEnum`)

Mevcut `notificationTypeEnum` event'leri (DATABASE-SCHEMA §3.5):
- `subscription_payment_failed` — past_due → tenant Telegram (zorunlu, kapatılamaz)
- `subscription_renewed` — başarılı tahsilat
- `invoice_issued` — e-Arşiv kesildi
- `vitrin_approved` — otomatik onay sonrası
- `vitrin_report_received` — 3+ şikayet
- `vitrin_auto_unpublished` — stok 0 → vitrin'den çekildi
- `plan_limit_warning` — %80'i geçti
- `low_stock_critical` / `out_of_stock` — ürün stok seviyesi
- `daily_summary` / `weekly_summary`

### 8.5 Hata İzleme Stratejisi (Sentry Faz 2'de)

> **Karar (2026-05-15):** Sentry MVP'de **opsiyonel** — Free tier'da bırak veya hiç kullanma. Lansman sonrası 500+ tenant veya 100+ event/gün olursa Sentry Team plan ($26/ay) değerlendirilir. Detaylı gerekçe: `TECH-STACK §6` bağlamında ek bir alt-karar.

#### Mevcut Hata İzleme Pattern'i (Sentry'siz $0)

```typescript
// app/api/[...path]/route.ts içinde error handler
try {
  // ... iş mantığı
} catch (err) {
  // 1. Workers Logs'a yapısal log (CF Dashboard'dan görülebilir, 24h retention)
  console.error('[ERR]', {
    route: req.url,
    err: serializeError(err),
    userId: ctx.user?.id,
    tenantId: ctx.user?.companyId,
    timestamp: Date.now()
  });

  // 2. Supabase system_errors tablosuna yaz (90 gün retention, süperadmin görünür)
  await db.insert(systemErrors).values({
    route, errorMessage: err.message, stack: err.stack,
    userId: ctx.user?.id, severity: classify(err)
  });

  // 3. Kritik hatada Telegram (Workers + Supabase'e ek katman)
  if (isCritical(err)) {
    await sendTelegram(SUPERADMIN_CHAT_ID, formatError(err));
  }

  return Response.json({ error: 'Internal error' }, { status: 500 });
}
```

#### Cloudflare Tail Worker (Opsiyonel Sprint 13+)

Tail Worker bir Worker'ın output'unu dinler, log'ları başka yere fırlatabilir:
```typescript
// tail-worker.ts
export default {
  async tail(events: TraceItem[]) {
    const errors = events.flatMap(e => e.exceptions);
    if (errors.length > 0) {
      await sendTelegram(SUPERADMIN_CHAT_ID, formatErrors(errors));
    }
  }
};
```

#### Sentry'ye Geçiş Tetikleyicileri (Sprint 16 sonrası)

- 100+ event/gün — manuel inceleme zorlaşır, dedup şart
- Frontend karmaşık JS hatası — kullanıcı reproduce edemediği
- Multi-developer ekip — kim hangi hatayı çözüyor takip

### 8.6 Uptime Monitor

**UptimeRobot Free tier:** 50 monitor, 5 dk interval, Telegram + e-posta alert.

Kontrol edilen endpoint'ler:
- `https://petstockpro.com` → 200 OK
- `https://petstockpro.com/api/health` → özel health check (DB + Realtime + 3rd party ping)
- `https://petstockpro.com/vitrin` → public vitrin landing

`/api/health` endpoint Sprint 0'da yazılır:
```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = await Promise.allSettled([
    db.execute(sql`SELECT 1`),                    // DB
    supabase.from('plans').select('tier').limit(1), // Auth ping
    fetch('https://api.iyzipay.com/health'),       // iyzico (Sprint 13+)
  ]);
  const allOk = checks.every(c => c.status === 'fulfilled');
  return Response.json(
    { status: allOk ? 'ok' : 'degraded', checks: ... },
    { status: allOk ? 200 : 503 }
  );
}
```

### 8.7 Neden Grafana / Datadog / New Relic Yok? — Karar Gerekçesi (2026-05-15)

**Soru:** Pet shop SaaS'ı için Grafana / Datadog gibi profesyonel APM araçları ekleyelim mi?

**Karar: HAYIR — MVP'de gereksiz, Faz 2'de re-evaluation.**

#### Grafana

| Argüman | Gerçek değer |
|---|---|
| "Görsel dashboard" | Süperadmin paneli zaten bu rolü üstleniyor — kendi kodumuzla. |
| "Cloudflare + Supabase metric birleştir" | Süperadmin paneli embed yapıyor (Analytics API + Metrics REST API). |
| "Custom business metric çizebilir" | Süperadmin paneli zaten çiziyor (MRR, tenant grafiği, davet conversion). |
| "VPS gerekli mi?" | Hayır — Grafana Cloud free tier var, ama veri kaynağı (Prometheus) ayrı kurulum. |
| "Maliyet?" | Grafana Cloud free → 14 gün retention. Pro $50+/ay. Tek geliştirici için fazla yük. |

**Sonuç:** Grafana = sadece görselleştirme. Veri kaynağı (Prometheus, Loki) ayrı kurulum + Workers'a custom metric instrumentation kodu (`metrics.increment(...)`) gerek. **Süperadmin paneli zaten aynı işi yapıyor, ek context yok.** Sprint 16 sonrası 500+ tenant olursa Grafana Cloud free tier yeniden değerlendirilir.

#### Datadog / New Relic / Honeycomb

| Araç | Aylık | Bizim için değer |
|---|---|---|
| Datadog APM | $31/host (~5 host MVP'de) → $155/ay | Workers Analytics + Supabase Dashboard zaten kapsıyor |
| New Relic Standard | $99/ay (kullanıcı bazlı) | Aynı |
| Honeycomb Pro | $130/ay (event bazlı) | Distributed trace MVP'de gereksiz |

**Bu araçlar enterprise (50+ developer ekip, 100K+ kullanıcı) için tasarlanmış.** Tek geliştirici + 1K tenant senaryosunda **överkill** ve **kuruluş maliyeti** kazanımdan fazla.

### 8.8 Re-evaluation Tetikleyicileri

Bu strateji **kalıcı değil**. Aşağıdaki sinyallerden 2+ aynı anda gelirse yeniden değerlendir:

| Sinyal | Nasıl ölçülür | Aksiyon |
|---|---|---|
| Süperadmin paneli yetersiz geldiğinde (custom metric eklemek zor) | Geliştirme sürtünmesi | Grafana Cloud free tier dene |
| 500+ event/gün hata | Süperadmin panel hata feed dolup taşıyor | Sentry Team plan ($26/ay) |
| P95 latency >500ms ve trace gerekli | CF Analytics yeterli detay vermiyor | OpenTelemetry + Honeycomb |
| Multi-tenant SaaS metrik (cohort analysis, churn rate) | Sürekli SQL yazıyorum süperadmin için | Metabase Cloud / Hex (BI tool) |
| Compliance audit (SOC2/ISO27001) | Müşteri büyük kurumlardan gelir | Datadog Compliance veya benzeri |

**Asla tetikleyici olmaz:**
- *"Twitter'da X şirket Grafana kullanıyor"* — moda değil, ölçü
- *"Profesyonel görünmek için"* — süperadmin paneli zaten profesyonel
- *"İleride lazım olur belki"* — measure-then-act

---

## 9. Custom Domain — KAPSAM DIŞI (2026-05-13)

Custom domain özelliği PRO+ ile birlikte **kaldırıldı**. Proje kapsamında YOK. DB schema'da `storefront_settings.custom_domain` field'ı da kaldırıldı (DATABASE-SCHEMA §3.6).

---

## 10. Sıradaki Adımlar

1. ✅ Bu doküman hazır
2. ⏭ DNS kayıtları kontrol (mevcut Cloudflare'de)
3. ⏭ Sprint 0'da `wrangler.toml` skeleton (deploy yapmadan dosya yapısı)
4. ⏭ Sprint 16'da production deploy

---

*Son güncelleme: 2026-05-12.*
