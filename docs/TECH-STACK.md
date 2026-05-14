# PetStockPro — Tech Stack Kararları

**Tarih:** 2026-05-12 (revize 2026-05-14)
**Durum:** Onaylanmış 4 ana karar + bekleyen detaylar
**Bağlam:** PetStockPro sıfırdan yeni proje. Eski Pet/server (Java/Spring) referans değil — yeni proje, yeni stack.

---

## 🇹🇷 2026-05-14 Karar — TR-only Kapsam

> **PetStockPro TR-only çalışır. Yurt dışı kullanıcı, yurt dışı ödeme, yurt dışı veri aktarımı kapsam dışıdır.**

**Kaldırılan / pasifize edilen bileşenler:**
- ❌ **Paddle** (yurt dışı ödeme aracı) — kapsam dışı, kullanılmıyor
- ❌ **Frankfurter API** (currency rate / EUR-USD-TRY dönüşüm) — Faz 2'de pasif, sadece TRY kullanılıyor
- ❌ **EN locale** aktif değil — next-intl yapısı korunur, sadece TR locale yayınlanır (EN gizli, Faz 2'de açılabilir)
- ❌ **GDPR uyumu** — sadece **KVKK** (TR) uygulanır, KVKK Madde 9 yurt dışı veri aktarımı yok
- ❌ **USD / EUR para birimi** — sistemde sadece **TRY**

**Korunan bileşenler:**
- ✅ **iyzico** (TR ödeme — Faz 2)
- ✅ **Nilvera** (TR e-Arşiv — Faz 2)
- ✅ **Brevo** (e-posta), **Sentry**, **Supabase**, **Cloudflare**, **Telegram bot**

**Etki:** Stack ~%15 daraldı, KVKK tek uyum referansı, ödeme entegrasyonu sadece iyzico, frontend tek locale.

---

## 1. Felsefe ve Kısıtlar

Bu projenin özgün kısıtları stack seçimini şekillendirdi:

| Kısıt | Etki |
|---|---|
| **Tek geliştirici** | Tek dil ideal, az parça, az ops yükü |
| **Browser-tested every sprint** | E2E test zorunlu, type-safety büyük avantaj |
| **AI agent destekli geliştirme** (Claude/Cursor) | TS ecosystem ideal, training data bol |
| **TR-only hedef** (2026-05-14) | KVKK uyumu + TRY tek para birimi + TR locale (next-intl yapısı korunur, EN Faz 2 için gizli) |
| **18-22 hafta MVP** | Hızlı iterasyon kritik, boilerplate düşman |
| **Multi-tenant SaaS** | Row-level security kritik |
| **Ekonomik bootstrap** | Free tier'lar değerli |
| **Domain karmaşık** (stok ledger, sayım, transfer, plan) | Type-safety hata önler |

**Sonuç:** TypeScript end-to-end + serverless-first.

---

## 2. Onaylanmış 4 Ana Karar

### 2.1 Framework: **Next.js 16 (App Router)**

```
Next.js 16
├── App Router (RSC default)
├── Server Actions (form handling)
├── API Routes (REST + webhooks)
├── Turbopack (dev)
└── Middleware (auth + locale)
```

**Tek dil (TypeScript), tek build, tek deploy.** Backend ve frontend ayrımı yok — Server Components + Server Actions ile end-to-end TS.

### 2.2 Database + ORM: **Supabase Postgres + Drizzle + Supabase SDK (karma)**

```
Supabase Postgres
├── RLS politikaları (multi-tenant izolasyon)
├── Drizzle ORM (karmaşık query, migration, type-safe SQL builder)
└── Supabase JS SDK (CRUD, Realtime subscribe, Storage, Auth helper)
```

**Neden karma?**
- **Drizzle:** Ledger, raporlar, agregasyon, transaction'lı işlemler için type-safe SQL kontrolü
- **Supabase SDK:** Realtime subscribe, Storage upload/transform, basit CRUD'da daha az kod

**Migration:** Drizzle Kit (`drizzle-kit push` dev, `drizzle-kit migrate` prod)
**Type generation:** `supabase gen types typescript` (CI'da otomatik)

### 2.3 Auth: **Auth.js (NextAuth v5) + Drizzle Adapter**

```
Auth.js v5
├── Credentials provider (email + password + 2FA TOTP)
├── Google OAuth provider
├── Drizzle adapter (session DB-backed)
├── JWT strategy (Supabase RLS için JWT claim'ler)
└── Custom callbacks (role, company_id, branch_id) — 2026-05-14 KT2-1: is_superadmin claim kaldırıldı, role tek kaynak
```

**Neden Auth.js (Supabase Auth değil):**
- Daha esnek custom flow (Telegram binding, SUPERADMIN impersonation, 2FA TOTP)
- OAuth provider zenginliği (Google başlangıç, ileride Apple/Microsoft)
- JWT'yi biz şekillendiriyoruz — Supabase'e RLS için doğru claim'leri geçiriyoruz

**RLS entegrasyon yöntemi:**
- Auth.js callback'inde JWT'ye `company_id`, `branch_id`, `role` claim'leri eklenir
- Server Action / API Route Supabase'e `auth.setSession()` ile bu JWT'yi geçirir
- Supabase RLS politikaları JWT claim'leri okur (`auth.jwt() ->> 'company_id'`)

### 2.4 Realtime: **MVP'den itibaren aktif (Supabase Realtime)**

```
Supabase Realtime (WebSocket)
├── Pano "Son Hareketler" feed (anlık güncelleme)
├── Süperadmin impersonation banner (canlı durum)
├── Çoklu kullanıcı ürün düzenleme conflict warning
└── Düşük stok alarm (yeni eşik altına düşünce anında uyarı)
```

Faz 1'in 30 saniye polling kararı yerine WebSocket subscribe. UX kazancı, neredeyse sıfır ek maliyet.

#### 2.4.1 Connection Limit Yönetimi (2026-05-14 — DEVAM-REHBERI mantık hatası #10)

> **Sorun:** Supabase Free tier **200 concurrent realtime connection**. 1K aktif tenant Pano açıkken limit aşılır → bağlantı reddi → "Son Hareketler" feed donar.

**Çözüm 1 — Lansman tier'ı:** Supabase **Pro ($25/ay)** zorunlu → **500 concurrent** (Pro standart). 5K tenant'a kadar yeterli, sonra Team tier ($599/ay) gerekecek.

**Çözüm 2 — React cleanup ZORUNLU:** Her `useEffect` çağrısında `channel.unsubscribe()` cleanup'ta. Aksi halde sayfa kapanınca bağlantı açık kalır, ZOMBIE connection birikir.

```tsx
// ✅ DOĞRU pattern (kullanılacak)
useEffect(() => {
  const channel = supabase
    .channel('stock_movements')
    .on('postgres_changes', { event: 'INSERT', schema: 'petstockpro', table: 'stock_movements' },
        (payload) => addToFeed(payload.new))
    .subscribe();

  return () => {
    channel.unsubscribe();  // ZORUNLU — sayfa kapanınca disconnect
    supabase.removeChannel(channel);
  };
}, [tenantId]);

// ❌ YANLIŞ — cleanup yok, zombie connection
useEffect(() => {
  supabase.channel('stock_movements').on(...).subscribe();
}, [tenantId]);
```

**Çözüm 3 — Throttle + visibility API:** Tab background'da → `channel.unsubscribe()`, tab foreground → reconnect. `document.visibilityState` listener.

```tsx
useEffect(() => {
  const reconnectIfVisible = () => {
    if (document.visibilityState === 'visible') subscribeChannel();
    else channel.unsubscribe();
  };
  document.addEventListener('visibilitychange', reconnectIfVisible);
  return () => document.removeEventListener('visibilitychange', reconnectIfVisible);
}, []);
```

**Çözüm 4 — Helper hook + ESLint no-restricted-syntax (MANTIK-HATALARI S5 düzeltmesi 2026-05-14):**

Tek geliştirici lens: custom ESLint rule yazmak fazla iş. Pragmatik yaklaşım:

1. **Sprint 0'da `lib/realtime/use-realtime-channel.ts` helper hook'u yazılır** (cleanup + visibility logic'i içeride). Tüm component'ler bu hook'u kullanır:
   ```ts
   const { isConnected } = useRealtimeChannel('stock_movements', {
     event: 'INSERT', schema: 'petstockpro', table: 'stock_movements',
     onPayload: (p) => addToFeed(p.new),
   });
   ```

2. **Doğrudan `.subscribe()` kullanımı ESLint ile yasaklanır** (`no-restricted-syntax` standart rule — custom rule yazmaya gerek YOK):
   ```js
   // .eslintrc — sade kural
   'no-restricted-syntax': ['error', {
     selector: "CallExpression[callee.property.name='subscribe'][callee.object.callee.property.name='channel']",
     message: "Doğrudan supabase.channel().subscribe() yasak. lib/realtime/useRealtimeChannel kullan."
   }]
   ```

3. **Exception case'ler için escape hatch:**
   ```tsx
   // eslint-disable-next-line no-restricted-syntax -- legacy migration only
   const channel = supabase.channel('one-time').subscribe();
   ```

4. **PR check:** GitHub Actions `npm run lint` zorunlu — pattern PR'da yakalanır.

Bu yaklaşım custom plugin yazmadan standard ESLint ile çözüm sağlar (1 saat Sprint 0 işi).

---

## 3. Onaylanmış Detaylar

### 3.1 Deploy / Hosting — **NETLEŞTİ**
**Karar:** **Cloudflare Workers + OpenNext**
**Domain:** petstockpro.com (Cloudflare DNS, alındı)
**Detay:** `DEPLOYMENT.md`

```
Cloudflare DNS (petstockpro.com)
  └── Cloudflare Workers (OpenNext adapter)
       ├── petstockpro.com/admin/*       → admin paneli (auth)
       │                                    ├ Normal ADMIN: sidebar standart menüler
       │                                    └ SUPERADMIN role: ek sidebar grubu
       │                                      (/admin/tenants, /admin/audit,
       │                                       /admin/db-inspector, /admin/system-settings,
       │                                       /admin/plan-approval)
       │                                    ⚠ Ayrı /super-admin URL'i YOK (2026-05-14)
       │                                      SUPERADMIN-only route'lar role-based gating
       │                                      ile aynı `/admin` namespace altında.
       └── petstockpro.com/vitrin/*      → merkezi vitrin (public)

(2026-05-13 değişiklik: Tenant subdomain *.petstockpro.com İPTAL,
 Custom domain (PRO+) RAFA. Sadece tek merkezi vitrin.)
```

**Edge runtime için kısıtlar:**
- ❌ `jsonwebtoken` → ✅ `jose` (Cloudflare uyumlu)
- ❌ `bcrypt` (native) → ✅ `bcryptjs` (pure JS)
- ❌ Long-running tasks (>5dk) → Supabase Edge Functions (150sn timeout)
- ⚠ DB connection pooling → **Cloudflare Hyperdrive** (Supabase ile entegre, free tier)

**Maliyet:** Cloudflare Workers Paid ($5/ay) + Supabase free tier başlangıçta yeter.

### 3.2 UI Component Library: **shadcn/ui**
- Tailwind CSS v4 + Radix UI primitive üzerine kopya-sahip ol pattern
- NPM bağımlılığı yok — kod projemizde
- shadcn/ui MCP entegrasyonu mevcut (component arama + ekleme)
- Tema customization tam kontrol — mockup'taki premium dili buraya inşa ederiz

### 3.3 Chart Library: **Recharts + Custom SVG karma**
- **Recharts** — standart chart'lar (line, bar, area, pie)
- **Custom SVG** — mockup'taki premium chart'lar (animasyonlu trend, gauge, sparkline)
- Tremor değil — premium tasarım dili için fazla opinionated

### 3.4 Map Library: **Leaflet + OpenStreetMap**
- Ücretsiz, MIT lisans (Faz 1 kararı korunur)
- Lazy-load (dynamic import) — initial bundle'a yük binmez

### 3.5 Email: **Brevo SMTP**
- Faz 1 kararı korundu
- Transactional + e-posta doğrulama + bildirim

**Tier matrisi (2026-05-14 — DEVAM-REHBERI mantık hatası #10):**

| Tenant sayısı | Tier | Maliyet | Sebep |
|---|---|---|---|
| 1-30 | Free 300/gün | $0 | İlk dev/beta — tek tek davet, sınırlı bildirim |
| 30-100 | Free 300/gün **+ sıkı kontrol** | $0 | Günlük özet açıklı, kritik bildirim Telegram'a kaydır |
| 100+ (lansman) | **Pro $35/ay (20K mail/ay)** | $35/ay | **ZORUNLU** — günlük özet (1/tenant) + plan limit + doğrulama → 100 tenant'ta free tier dolu |
| 1K+ | Pro $35/ay yeter (20K mail/30K limit) | $35/ay | Telegram bildirimleri Brevo yükünü %70 azaltır |

**Brevo Free dolma analizi (lansman senaryosu):**

- 100 tenant × 1 günlük özet mail = 100/gün ✓
- + Yeni tenant onboarding (5/gün × 3 mail = 15) ✓
- + Plan limit uyarısı (10/gün)
- + Şifre sıfırlama (5/gün)
- + Vitrin başvuru bildirimi (3/gün — eğer e-posta seçilirse, Telegram default)
- **Toplam: ~133/gün** (free 300 sınırı altında ama %44 dolu, marj az)

200 tenant → 250+/gün → free tier dolar → **Pro tier ZORUNLU**.

**Telegram kayması:** Pet shop tercih ederse günlük özet + bildirimler Telegram'dan gelir, e-posta sadece kritik (şifre sıfırlama, hesap güvenlik) için. Bu Brevo yükünü ~%70 azaltır.

### 3.6 Background Jobs / Cron: **Supabase native**
- **Supabase Edge Functions** (Deno tabanlı, 150sn timeout) — Telegram async, PDF üretimi, büyük export
- **pg_cron** (Postgres extension) — günlük/haftalık özet bildirimleri, plan limit kontrolleri
- Inngest gerekli değil — Supabase native yeter

### 3.7 Monitoring: **Sentry**
- Error tracking (frontend + server)
- Free tier 5K event/ay MVP için yeter
- Performance monitoring (Web Vitals)
- Cloudflare/Vercel Analytics deploy sonrası eklenir

### 3.8 Telegram Bot — ADMIN BİLDİRİM KANALI (2026-05-13 netleştirme)

**Yöntem:** Custom bot (`@PetStockProBot`), webhook only (polling YOK). Webhook → Next.js API route → kısa işlemler hemen, uzun işlemler Supabase Edge Function'a delegate.

**ÖNEMLİ — Telegram'ın projedeki rolü tek yöne hizmet eder:**

| Kanal | Yön | Mesajı kim yolluyor | Maliyet |
|---|---|---|---|
| **Telegram bot** (`@PetStockProBot`) | Sistem → **Pet shop sahibi** (admin) | Bizim bot (otomatik) | Ücretsiz |
| **WhatsApp deep link** (`wa.me/...`) | Müşteri → Pet shop sahibi (vitrin'den) | **Müşterinin kendisi** | Ücretsiz |

**Telegram = ADMIN tarafı bildirim kanalı.** Müşteriyle hiç temas yok.

**Push bildirimler (sistem → pet shop sahibi):**
- 🚨 Kritik stok düştü
- ⛔ Stok bitti → vitrin'den otomatik çekildi (2026-05-13 davranışı, bkz. EKRAN-URUNLER §5.6)
- 💰 Yüksek tutarlı satış (eşik ayarlı)
- 👥 Yeni kullanıcı eklendi
- 📊 Plan limit yaklaşıyor
- 🌅 Günlük özet (21:00)
- 🗓 Haftalık özet (Pzt 09:00)
- 🔥 Vitrin tıklama özeti — *"Bu hafta 312 görüntüleme, 47 WhatsApp tıklama"* (yeni — vitrin_events tablosundan)
- ✓ Vitrin başvurun ONAYLANDI / REDDEDİLDİ (süperadmin aksiyonu)

**Pull komutlar (pet shop sahibi → bot):**
- `/stok ürün-adı` → anlık stok
- `/bugun` → bugünkü satış özet
- `/dusukstok` → düşük stok listesi
- `/vitrin` → vitrin tıklama özeti (yeni)
- `/yardim` → komut listesi

**Bot bağlama akışı:**
1. Pet shop `/admin/settings → Bildirim` sekmesi
2. "Telegram'a bağla" → 6 haneli kod (5dk geçerli)
3. Telegram'da `@PetStockProBot` aç → `/baglan 487293`
4. `telegram_bindings.chat_id` kaydedilir, tenant_id eşlenir
5. "✓ Bağlandı"

**Müşteri tarafı (vitrin) — Telegram DEĞİL, WhatsApp deep link:**
Müşteri vitrin'de "📞 Satıcıya Sor" butonuna basınca `wa.me/{whatsapp_phone}?text={hazır_mesaj}` deep link açılır. Müşteri kendi WhatsApp uygulamasında mesajı görür, kendisi "Gönder" butonuna basar. **Biz mesajı görmüyoruz, WhatsApp Business API kullanmıyoruz.**

**Karışmasın:** Pet shop sahibinin Telegram'ı (admin bildirim) ≠ Müşterinin WhatsApp'ı (vitrin deep link). İkisi farklı kanal, farklı amaca hizmet eder.

### 3.9 ~~Currency Rate API: Frankfurter API~~ — **Faz 2 — şu an aktif değil** (2026-05-14)

> **TR-only kararı (2026-05-14):** Sistemde sadece **TRY** kullanılır. Çoklu para birimi (USD/EUR) ve kur dönüşümü kapsam dışı. Frankfurter API entegrasyonu, `currency_rates` tablosu, kur dönüşüm helper'ları **MVP'de implement edilmez.**

**İleride (Faz 2+) gerekirse açılır:**
- Free, ECB tabanlı, anahtar gerektirmez
- 24 saat cache (Supabase'de `currency_rates` tablo — şema rezerve)

**MVP davranışı:** Fiyat / maliyet / satış tutar alanları her yerde `numeric(12,2)` TRY. UI'da yalnız `₺` simgesi. Para birimi seçici YOK.

### 3.9b 🆕 AI Image Moderation (2026-05-14 YT-1 — Cloudflare Workers AI)

> Hibrit fotoğraf doğrulama (1. katman): "Satışa Aç" toggle açıldığında ürün görseli pet sektörüne uygunluğu otomatik kontrol edilir. (2. katman: topluluk modlama — `vitrin_reports.wrong_photo` — EKRAN-URUNLER §5.5.)

**Tercih: Cloudflare Workers AI** (entegre, ucuz, vendor-lock yok)

| Boyut | Cloudflare AI Workers (önerilen) | OpenAI Vision (alternatif) |
|---|---|---|
| Model | `@cf/llava-hf/llava-1.5-7b-hf` (vision-language) | `gpt-4o-mini` veya `gpt-4-vision` |
| Maliyet | ~$0.011 per 1K invocations (free tier 10K/gün) | ~$0.00765/image (~$0.01) |
| Latency | <500ms (edge inference) | 1-3sn |
| Türkçe | OK (instruction-tuned multilingual) | OK |
| Entegrasyon | `env.AI.run('@cf/llava-...', {...})` Workers binding | OpenAI SDK + fetch |

```ts
// app/api/admin/products/[id]/validate-image/route.ts (Cloudflare Workers binding)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { imageUrl } = await req.json();
  const imageResp = await fetch(imageUrl);
  const imageArrayBuffer = await imageResp.arrayBuffer();

  const result = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
    image: [...new Uint8Array(imageArrayBuffer)],
    prompt: "Is this an image of a pet product (pet food, accessory, toy, health product, aquarium item, or pet itself)? Answer only 'yes' or 'no'.",
    max_tokens: 10,
  });

  const isPetProduct = result.description.toLowerCase().trim().startsWith('yes');

  // Sonucu cache et (image_hash → result) — aynı görsel tekrar kontrol edilmesin
  await env.AI_CACHE.put(`img:${imageHash}`, JSON.stringify({ isPetProduct, checkedAt: Date.now() }));

  return Response.json({ valid: isPetProduct });
}
```

**Maliyet tahmini (1K tenant senaryosu):**
- 1.000 tenant × ortalama 100 ürün vitrin'de = 100K toplam ürün
- Her ürün 1 ana görsel × 1 AI check (cached) = 100K invocation
- Yıllık: 100K × $0.011/1K = **$1.10/yıl başlangıç**
- Yeni yükleme + değişiklik (aylık ~%10) = 10K/ay × $0.011/1K = **$0.11/ay**
- **Toplam ~$2-5/ay** Growth tier'ında — DEPLOYMENT.md §6.2 OPEX'e ihmal edilir

**Cache stratejisi:** Görsel hash'i (SHA256) → AI sonucu KV'de 90 gün saklanır. Aynı görsel tekrar yüklenirse re-check yok.

**False positive override:** Süperadmin Toolbox FAB > "AI Karar Override" → manuel onay (false negative durumda).

### 3.10 PDF Üretimi (Faz 2 e-fatura için)
**Yaklaşım:** Supabase Edge Function + React-PDF (server-side, Deno uyumlu) — uzun timeout (150sn) PDF üretmek için yeterli.

### 3.11 Validation: **Zod**
- Request body + DB schema + Server Action input
- Drizzle schema → Zod (drizzle-zod paketi)
- Auth.js + Zod doğal entegrasyon

### 3.12 Test Stack
- **Vitest** — unit + integration test
- **Playwright** — E2E browser test (headed dev, headless CI)
- **axe-core** — accessibility audit (WCAG AA)
- **Testing Library** — component test

### 3.13 i18n: **next-intl** (TR-only aktif, EN gizli — 2026-05-14)

> **TR-only kararı (2026-05-14):** Sadece **TR locale** yayınlanır. EN locale **next-intl yapısı korunur** (kütüphane + dizin) ama gizli — Faz 2'de pazar genişletirsek açılabilir.

**MVP davranışı:**
- ✅ next-intl kütüphanesi kurulur (yapısal hazır)
- ✅ Mesajlar `messages/tr.json` altında, ICU MessageFormat
- ✅ Locale yapısı `[locale]` segmentli (Faz 2 için hazır)
- ⏸ `messages/en.json` dosyası **placeholder olarak tutulur** (bos veya 1-2 anahtar) — bundle'a girmez
- ⏸ Default ve tek locale: `tr` — `defaultLocale: 'tr'`, `locales: ['tr']`
- ⏸ Public sayfalar URL'de locale prefix **kullanmaz** (`/vitrin/...`, `/tr/vitrin/...` yok), admin de cookie-based ama tek dil

**Faz 2 açma yöntemi:** `locales: ['tr', 'en']` listesine `en` eklenir, `messages/en.json` doldurulur, language switcher UI'da görünür.

### 3.14 State Management
- **TanStack Query** — server state (data fetching, cache, mutation)
- **Zustand** — client UI state (sidebar collapse, modal, drawer, theme)
- Redux yok (Faz 1'deki kararı geri çekiyoruz — Zustand yeterli)

---

## 4. Final Stack (Onaylanmış + Bekleyen)

```
┌─────────────────────────────────────────────────┐
│  Browser (TR-only · 2026-05-14)                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Next.js 16 (App Router · RSC · Actions) │    │
│  │ TypeScript strict · Tailwind v4         │    │
│  │ next-intl (TR aktif, EN gizli)          │    │
│  │ shadcn/ui · Recharts                    │    │
│  │ Leaflet · Auth.js client                │    │
│  └────────────┬────────────────────────────┘    │
└───────────────┼─────────────────────────────────┘
                │ HTTPS · JSON · WebSocket
                ▼
┌─────────────────────────────────────────────────┐
│  Next.js Server (Server Components + Actions)   │
│  ┌─────────────────────────────────────────┐    │
│  │ Auth.js v5 + Drizzle adapter            │    │
│  │ Drizzle ORM (type-safe SQL)             │    │
│  │ Supabase SDK (Realtime · Storage)       │    │
│  │ Zod validation                          │    │
│  └────────────┬────────────────────────────┘    │
└───────────────┼─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│  Supabase                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Postgres │  │ Realtime │  │ Storage  │       │
│  │ + RLS    │  │ WebSocket│  │ S3-uyumlu│       │
│  └──────────┘  └──────────┘  └──────────┘       │
│  ┌──────────────────────────────────────────┐   │
│  │ Edge Functions (uzun task'lar — PDF,     │   │
│  │ büyük rapor export, Telegram async)     │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘

Dış servisler:
├── Brevo SMTP (e-posta)
├── Telegram Bot API (bildirim)
├── Sentry (error tracking)
├── iyzico Subscription (Faz 2 — TR ödeme, tek ödeme aracı)
├── Nilvera (Faz 2 — e-Arşiv / TR)
├── MaxMind GeoLite2 (vitrin konum tespiti — IP-based fallback)
└── PostGIS (Supabase native — vitrin yakınlık sorgusu)

KAPSAM DIŞI (TR-only 2026-05-14):
× Paddle (yurt dışı ödeme) — kullanılmıyor
× Frankfurter API (kur) — Faz 2 pasif, TRY tek para
× GDPR uyum katmanı — sadece KVKK
```

**2026-05-13 not:** Önceki "Cloudflare for SaaS / custom domain (PRO+)" stratejisi tamamen kaldırıldı. PRO+ tier proje kapsamı dışında — 2-tier yapı (FREE 50 / PRO sınırsız). Custom domain YOK.

**2026-05-14 not:** TR-only kararı ile Paddle (yurt dışı ödeme) + Frankfurter API (currency rate) + EN locale dış servis/bağımlılık listesinden çıkarıldı. iyzico tek ödeme aracı, Nilvera tek e-Arşiv sağlayıcı, KVKK tek uyum referansı.
```

---

## 5. Önemli Sonuçlar

### 5.1 Eski Pet Projesinden Tamamen Kopuş

- ❌ Java 17 + Spring Boot — **yok**
- ❌ JPA + Hibernate — **yok**
- ❌ Flyway — **Drizzle Kit ile değişti**
- ❌ Maven — **yok**
- ❌ Tomcat / JVM ops — **yok**
- ❌ `com.petshop` package — **yok**

Eski Pet/ klasörü sadece **referans + Faz 1 docs**. Hiçbir kod kopyalanmıyor.

### 5.2 Pattern Değişimleri

| Eski Pet (Java/Spring) | Yeni PetStockPro (Next.js/TS) |
|---|---|
| `@Controller` + `@RequestMapping` | API Route (`app/api/...route.ts`) veya Server Action |
| `@Service` + `@Repository` | Pure TS function + Drizzle query |
| `GenericResponse` + `DataGenericResponse<T>` | Zod schema + RPC return type |
| `@Filter("tenant")` Hibernate | Supabase RLS policy (DB seviyesi) |
| `@PreAuthorize("hasRole")` | Auth.js middleware + Server Action guard |
| Spring Scheduler `@Scheduled` | Supabase Edge Function + pg_cron |
| `application.yml` env config | `.env.local` + `process.env` |
| `mvn spring-boot:run` | `npm run dev` (Turbopack, ms cinsinden hot reload) |

### 5.3 Kazanımlar

- 🚀 **Hot reload milisaniyeler** (Java 30-60sn restart yok)
- 📦 **Tek dil** (context switch maliyeti sıfır)
- 🔐 **DB-seviyesi multi-tenant izolasyon** (RLS, manuel filter yok)
- 🎯 **End-to-end type safety** (DB schema → server → client)
- ⚡ **Realtime built-in** (WebSocket için custom kod yok)
- 💰 **Free tier startup** (Supabase 500MB + Cloudflare/Vercel free)
- 🤖 **AI agent uyumlu** (Claude/Cursor için TypeScript ideal)

### 5.4 Tradeoffs (Bilinçli Kabul)

- ⚠ **Background jobs serverless modelinde farklı** (Spring Scheduler yok — Supabase pg_cron veya Inngest)
- ⚠ **Cloudflare Workers'da bazı Node API'leri çalışmaz** (`fs`, `jsonwebtoken` → `jose` ile değiştir)
- ⚠ **Long-running tasks 5dk limit** (büyük PDF/export Supabase Edge Function'a)
- ⚠ **Spring enterprise pattern olgunluğu yok** — TS ile disiplini biz koruyacağız (zod + strict TS)

---

## 6. Sıradaki Adımlar (Tech Stack tamamlandı sonrası)

1. ✅ **Tech stack** — bu doküman
2. ⏭ **Bekleyen detaylar** — UI lib (shadcn/ui kararı), chart, email vs. küçük seçimler
3. ⏭ **Tasarım sistemi** — mockup-admin-premium-v3 baz alarak TASARIM-SISTEMI.md
4. ⏭ **Ekran tasarımları** — Pano detay + diğer 10 ekran
5. ⏭ **Database schema** — Drizzle schema dosyaları
6. ⏭ **Sprint planı revize** — eski 16 sprint plan'ı yeni stack'e göre güncelle
7. ⏭ **Sprint 0** — proje skeleton (`npx create-next-app` + Supabase setup)

---

*Son güncelleme: 2026-05-12. 4 ana karar onaylandı, deploy + küçük detaylar sonraki adımlarda.*
