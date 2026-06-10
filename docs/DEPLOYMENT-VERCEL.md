# PetStockPro — Vercel Deploy Rehberi

> **Karar (2026-06-10):** Uygulama **Vercel**'e deploy edilir. Cloudflare Workers/OpenNext bırakıldı (Next.js 16 + OpenNext esbuild toolchain'i kırık — 3 ayrı build hatası). Cloudflare **DNS + R2 + Workers AI/Vectorize** için kalır (API/SDK ile çağrılır).

## Mimari
```
Uygulama (Next.js 16)   → Vercel (fra1 / Frankfurt — Supabase'e yapışık)
Veritabanı              → Supabase (Frankfurt eu-central-1)
Görsel + sitemap        → Cloudflare R2 (S3 API)
AI chatbot              → Cloudflare Workers AI + Vectorize (CF REST API)
DNS                     → Cloudflare → Vercel (CNAME)
Cron                    → Vercel Cron (vercel.json → /api/cron/*)
Rate-limit              → Vercel KV (Upstash) [bkz. §7]
Ödeme callback          → https://petstockpro.com/api/webhooks/paytr
```

---

## 1. Repo'yu bağla
1. [vercel.com](https://vercel.com) → **Add New → Project** → GitHub `OguzhanDemircioglu/PetStockPro` import.
2. Framework otomatik **Next.js** algılanır. Build `next build`, Output otomatik.
3. Region: `vercel.json` içinde **`fra1`** (Frankfurt) — fonksiyonlar Supabase Frankfurt'a yapışık → DB latency ~2ms. ⭐ En büyük performans kazancı.

## 2. Environment Variables (Settings → Environment Variables → Production + Preview)
`.env`'deki TÜM server değerlerini gir. **Production'da değişenler:**
| Değişken | Production değeri |
|---|---|
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | `https://petstockpro.com` |
| `NEXT_PUBLIC_APP_DOMAIN` | `petstockpro.com` |
| `PAYTR_TEST_MODE` | `0` (canlı) |
| `NILVERA_BASE_URL` | `https://api.nilvera.com` (canlı) |
| `NODE_ENV` | otomatik `production` |

Gerekli secret'lar: `DATABASE_URL`, `AUTH_SECRET`, `SUPABASE_*`, `PAYTR_MERCHANT_ID/KEY/SALT`, `NILVERA_API_KEY` + `NILVERA_SELLER_VKN/TITLE`, `BREVO_*`, `TELEGRAM_*`, `CF_ACCOUNT_ID` + `CF_API_TOKEN` + `CF_VECTORIZE_INDEX`, `R2_*`, `CRON_SECRET`, `TURNSTILE_*`.

> Supabase MCP yerine: Vercel env'leri **şifreli** tutar, repo'ya girmez. (`.env` zaten gitignored.)

## 3. Cron (vercel.json — hazır)
- 6 cron tanımlı (`vercel.json` `crons`). Vercel **GET** isteği gönderir → her route'a `export const GET = POST` köprüsü eklendi.
- **Auth:** `CRON_SECRET` env set edilince Vercel otomatik `Authorization: Bearer $CRON_SECRET` header'ı ekler → route'lardaki kontrol aynı.
- ⚠ **Vercel Pro ($20/ay) gerekir** — Hobby planı 2 cron + günde 1 ile sınırlı.

## 4. DNS (Cloudflare panel)
1. Vercel → Project → **Domains** → `petstockpro.com` ekle → Vercel DNS talimatını verir.
2. Cloudflare DNS'te o kaydı oluştur. **Proxy (turuncu bulut) kapalı / DNS-only** öner (Vercel kendi CDN'i + cache'i var; çift-CDN sorun çıkarabilir). WAF istersen dikkatli proxy.

## 5. PayTR Bildirim URL
PayTR Mağaza Paneli → Bildirim URL: **`https://petstockpro.com/api/webhooks/paytr`** (deploy + DNS sonrası ulaşılabilir).

## 6. Vercel performans imkanları (kullanılıyor)
- ✅ **Region `fra1`** — DB co-location (vercel.json)
- ✅ **ISR** — vitrin `revalidate` (Vercel native)
- ✅ **Image Optimization** — `next/image` + `remotePatterns` (R2/Supabase) → otomatik AVIF/WebP + edge cache
- ✅ **Speed Insights + Analytics** — `@vercel/analytics` + `@vercel/speed-insights` (layout'a eklendi)
- ✅ **Fluid Compute** — Vercel default (warm functions, düşük cold-start)
- ✅ **Edge Middleware** — auth middleware (jose) edge'de çalışır
- 🔵 **PPR (Partial Prerendering)** — Next 16 experimental, lansman sonrası değerlendir
- 🔵 **Vercel Firewall** — built-in DDoS/WAF (Pro+)

## 7. KV rate-limit — Vercel'e uyarla (yapılacak)
`src/lib/rate-limit/factory.ts` şu an `globalThis.RATE_LIMIT_KV` (Workers binding) bekliyor → Vercel'de yok, **in-memory fallback** devreye girer (per-instance, lambda'lar arası reset → zayıf).
- **Vercel KV (Upstash Redis) oluştur:** Vercel → Storage → KV → bağla → `KV_REST_API_URL` + `KV_REST_API_TOKEN` otomatik env.
- `@vercel/kv` veya `@upstash/redis` ekle + factory'ye branch (env varsa Upstash store, yoksa memory).
- Lansman için memory fallback kabul edilebilir (brute-force login zaten DB-backed); AI chat rate-limit'i sağlamlaştırmak için KV önerilir.

## 8. Migration sonrası temizlik (opsiyonel)
App artık CF Workers'da koşmadığı için şunlar kaldırılabilir: `wrangler.toml`, `wrangler.staging.toml`, `src/cf/worker-entry.ts`, `src/lib/cron/scheduled-handler.ts`, `open-next.config.ts`, `@opennextjs/cloudflare`, `wrangler` (devDep). R2/Workers AI/Vectorize **API ile** çağrıldığı için wrangler gerekmez. (Acele etme — önce Vercel'de stabil çalıştığını gör.)
