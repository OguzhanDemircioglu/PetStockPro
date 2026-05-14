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
                    │   Supabase (mevcut proje)     │
                    │   schema: petstockpro         │
                    │   • Postgres + RLS            │
                    │   • Auth                       │
                    │   • Realtime (WebSocket)      │
                    │   • Storage (S3 uyumlu)       │
                    │   • Edge Functions             │
                    └───────────────────────────────┘

Dış servisler:
  • Brevo SMTP (e-posta)
  • Telegram Bot API
  • Frankfurter (kur)
  • Sentry (errors)
  • iyzico (TR ödeme — Faz 2)
  • Paddle (yurt dışı — Faz 2)
  • Nilvera (e-fatura — Faz 2)
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

### 2.3 E-posta MX (Brevo için)

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

```toml
# wrangler.toml
name = "petstockpro"
main = ".open-next/worker.js"
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

# Secrets (wrangler secret put X)
# - DATABASE_URL
# - DATABASE_URL_DIRECT
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_JWT_SECRET
# - NEXTAUTH_SECRET
# - BREVO_API_KEY
# - TELEGRAM_BOT_TOKEN
# - SENTRY_AUTH_TOKEN

# Hyperdrive (Supabase pooling — Cloudflare)
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive-id>"   # Cloudflare Dashboard > Workers > Hyperdrive'dan al
```

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

## 8. Monitoring + Alerts

### 8.1 Sentry

- Error tracking (frontend + backend)
- Performance monitoring (Web Vitals)
- Release tracking (GitHub Actions ile auto)

### 8.2 Cloudflare Analytics

- Bandwidth + request count
- Cache hit ratio
- Bot detection
- Geographic distribution

### 8.3 Uptime Monitor

- **UptimeRobot** free tier:
  - 50 monitor
  - 5 dk interval
  - Alerts: Telegram + e-posta + Slack

Kontrol edilen endpoint'ler:
- `https://petstockpro.com` (200 OK)
- `https://petstockpro.com/api/health` (özel health check endpoint)

### 8.4 Custom Alerts (Telegram'a)

- Plan limit doluyor → tenant'a
- Hata oranı > %1 → sahibe (sen)
- Süperadmin login → sahibe (security audit)
- Yeni tenant kayıt → sahibe (notification)

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
