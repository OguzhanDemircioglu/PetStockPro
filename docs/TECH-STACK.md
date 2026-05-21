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
**Auto-bootstrap (PLAN-BETA-PERFORMANCE Faz 1, 2026-05-21):** `src/instrumentation.ts` Next.js native hook
boot'ta `runBootstrap()` çağırır → pending Drizzle migration apply + cities/districts (81+974) seed +
catalog_seed_products (1.240) seed. **Idempotent** — count=0 check ile skip, re-entrancy guard. Dev'de
her boot çalışır (~885ms), production'da `BOOTSTRAP_SKIP=1` ile devre dışı (CI/CD migration önceden).
`drizzle.__drizzle_migrations` history tablosu drizzle-kit ile ortak.

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

### 3.7 Monitoring: **In-app error tracking + Telegram alert (Sentry yerine)**

**Karar revizyonu (2026-05-21):** Sentry'e gerek yok. In-app `system_errors` tablosu + threshold-based Telegram burst alert pattern yeter:

- **`system_errors` tablosu** — `errorType`, `message` (PII strip'li), `stack`, `severity`, `companyId`, `userId`, `route`, `action`, `metadata` jsonb, `createdAt` (90 gün retention, KVKK uyumlu Frankfurt).
- **`lib/errors/track.ts` helper** — `trackError(err, context, db)` server action catch'lerinde fire-and-forget INSERT.
- **Threshold burst alert** — son 60 dk içinde aynı errorType 5+ kez → critical Telegram alert (`buildErrorBurstAlert`). 6h dedup (anti-spam).
- **Süperadmin `/admin/superadmin/errors` sayfası** — liste + detay drawer + resolve toggle.
- **Workers cron 03:55 UTC** — günlük threshold check + alert tetikleme.

**Sentry vs. bu pattern:**

| Sentry | In-app pattern |
|---|---|
| $26/ay Team plan | **$0** |
| 3. parti dependency + KVKK risk (ABD veri) | Frankfurt EU, kontrolün sende |
| Bundle +50KB | Bundle +0 |
| Stack trace zengin | Stack trace + context jsonb yeter |
| Web Vitals dahil | CF Analytics + Cloudflare/Vercel deploy sonrası eklenir |

**Aktivasyon:** `PLAN-BETA-PERFORMANCE.md` Faz 2.B ile beta öncesi.

**Lansman sonrası reconsider:** 100+ event/gün üretiyorsak veya Web Vitals'a ihtiyaç olursa Sentry Team plan ($26/ay) eklenir. MVP için **gerek yok**.

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

### 3.9c 🆕 Bot Koruması: Cloudflare Turnstile (2026-05-15 — EKRAN-AUTH §9)

> **Karar (2026-05-15):** Google reCAPTCHA yerine **Cloudflare Turnstile** kullanılır. Auth formlarında (register, forgot-password, change-email, 5+ başarısız login sonrası) bot koruması.

**Neden Turnstile, reCAPTCHA değil?** Detaylı karşılaştırma `EKRAN-AUTH §9.1`. Özet: ücretsiz limitsiz, Workers native binding (sıfır latency), KVKK temiz (Cloudflare zaten sub-processor, ek anlaşma yok), Google'a veri göndermez.

**Aktif olduğu formlar:**
| Form | Mod | Sebep |
|---|---|---|
| `/register` | Managed (görünmez/widget) | Bot tenant kayıt önlenmeli |
| `/forgot-password` | Managed | Email enumeration + spam koruma (kullanıcı vurgusu) |
| `/change-email` | Managed | Hesap ele geçirme korumasında ek katman |
| `/login` (5+ başarısız sonrası) | Managed | Brute-force ek katman; sürekli değil — UX bozar |
| Vitrin "🚩 Bildir" | YOK | Cloudflare KV rate-limit yeter (anonim, low value target) |
| WhatsApp Feedback Balonu | YOK | KV rate-limit yeter (1 IP × 1 tenant × 24h) |
| Davet kabul (accept-invite) | YOK | Token tabanlı, brute-force korumalı (5/dk IP) |

**Setup (Sprint 0 bootstrap):**
1. Cloudflare dashboard → Turnstile → "Add Site" → domain: `petstockpro.com`
2. Widget mode: **Managed** (Cloudflare otomatik invisible/widget seçer)
3. Site Key → `env.NEXT_PUBLIC_TURNSTILE_SITE_KEY`
4. Secret Key → `env.TURNSTILE_SECRET_KEY` (wrangler secret)

**Workers binding (`wrangler.toml`):**
```toml
[vars]
NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0x4AAA..."

# Secret olarak:
# wrangler secret put TURNSTILE_SECRET_KEY
```

**Backend verify pattern** (EKRAN-AUTH §9.4):
```typescript
// lib/auth/verify-turnstile.ts
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
      remoteip: ip,
    }),
  });
  const data = await res.json() as { success: boolean };
  return data.success === true;
}
```

**Frontend paketi:** `@marsidev/react-turnstile` (React 19 uyumlu, TR locale destekli).

**KVKK + Sub-processor:** Cloudflare zaten sub-processor listesinde (CDN olarak — PAYMENT-INTEGRATION §8.2). Turnstile için ek bildirim/açık rıza gerekmez.

**Maliyet:** $0 — Cloudflare Turnstile sınırsız ücretsiz (1M+ doğrulama/ay'a kadar bildirilen limit yok).

**Re-evaluation tetikleyici:** Eğer Turnstile false positive oranı >%2 olursa (gerçek müşteri bot olarak reddediliyor) → Cloudflare dashboard'da "interactive" moduna geç (basit puzzle). reCAPTCHA'ya geçiş şu an gerekmez.

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
- **TanStack Query 5.62** — server state (data fetching, cache, mutation)
  - **Durum:** ✅ **Aktif (2026-05-21, PLAN-BETA-PERFORMANCE Faz 4 + 5)**.
  - **Provider:** `src/app/providers.tsx` (client) → `src/app/layout.tsx`'a sarmal (Theme dış, Query iç).
  - **Default options:** `staleTime: 30s` + `refetchOnWindowFocus: true` + `retry: queries=1, mutations=0`.
  - **Devtools:** Sadece dev mode (`NODE_ENV !== 'production'`), bottom-left köşe.
  - **Key factory:** `src/lib/queries/keys.ts` — `productKeys` / `stockMovementKeys` / `stocktakeKeys` / `notificationKeys` / `storefrontKeys` (hierarchical invalidate).
  - **Optimistic CRUD:** Faz 5 ile 3 tam optimistic (bildirim oku 50ms flip + bell -1, vitrin Aç/Kapat badge flip + revert, bulk Tümünü oku 0 anında) + 2 PetSpinner pending (stok hareketi 4 drawer + sayım workflow).
  - **Hibrit model:** Server Component'te `initialData` SSR + Client Component'te `useState`+`useMutation` ile optimistic update + `revalidatePath` server-side cache refresh ile flicker'sız reconcile.
  - **Polling YOK** — `refetchOnWindowFocus: true` (default) yeter (POS-tarzı tek kasa, concurrent edit problem değil).
- **Zustand 5.0** — client UI state (sidebar collapse, modal, drawer, theme)
  - **Durum:** Kurulu ama henüz minimal kullanım. UI state için yeterli.
- **Redux YOK** — TanStack Query (server state) + Zustand (UI state) ikilisi yeter, 3. layer gereksiz.

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

**2026-05-13 not (yarısı iptal):** Önceki "Cloudflare for SaaS / custom domain (PRO+)" stratejisi tamamen kaldırıldı. Custom domain hâlâ kapsam dışı. **2-tier (FREE/PRO) kararı 2026-05-14'te iptal edildi** — 3-tier B geri açıldı (aşağıdaki not).

**2026-05-14 not:** TR-only kararı ile Paddle (yurt dışı ödeme) + Frankfurter API (currency rate) + EN locale dış servis/bağımlılık listesinden çıkarıldı. iyzico tek ödeme aracı, Nilvera tek e-Arşiv sağlayıcı, KVKK tek uyum referansı.

**2026-05-21 plan tier (son revize):** 3-tier B aktif — FREE 50 / PRO 500 (**1.000₺** KDV dahil) / PRO+ ∞ (**2.000₺** KDV dahil). Tarihçe: 2026-05-14 ilk 750/1.750 → 2026-05-20 Karar C 1.250/2.250 → 2026-05-21 "fiyat artırmayalım" **1.000/2.000**. Tek farklılaşma stok limiti, diğer tüm özellikler tüm planlarda açık. Custom domain / custom CSS / API erişimi / white-label hâlâ proje kapsamı dışı. Otoritatif: `PLAN-KADEMELERI.md §1`.
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

## 6. Backend Dil/Framework Seçimi — Neden Next.js, Neden Go Değil

**Karar (2026-05-15):** MVP'de **Next.js + Cloudflare Workers** korunur. İleride (10K+ tenant'a ulaşıldığında) performance-critical parçalar Strangler-Fig pattern ile Go mikroservis olarak çıkarılabilir. Bu doküman karar gerekçesini kalıcı olarak kaydeder, **6 ay sonra "neden Go değil" sorusu tekrar gelirse referans olur**.

### 6.1 Düşünülen Alternatif: Go + VPS

Tek geliştirici lens'i (CLAUDE.md #1 kural) ile değerlendirildi. Alternatif niyeti: *"yurt dışına açıldığında çok büyüyecek, Go + VPS daha sağlam"*.

### 6.2 Yük Analizi — "Çok Büyüyecek" Hipotezi Sayısal

PetStockPro hedef pazar (DEPLOYMENT §6.5): TR 1K tenant, Faz 2 yurt dışı +%10-20.

| Metrik | 1K tenant (TR) | 10K tenant (5 yıl, yurt dışı dahil) | Bottleneck? |
|---|---|---|---|
| Aktif eşzamanlı user | ~200 | ~2K | — |
| Request/saniye | ~50 (read-heavy) | ~500 | Workers free tier 100K req/gün **rahat altında**; paid $5/ay 10M req/gün |
| DB write/saniye | ~10 (stok hareketleri seyrek, insan eli) | ~100 | Postgres rahat |
| Realtime connection | ~150 | ~1.5K | Supabase Pro 500 → ek slot ekleme |
| CPU-heavy işler | Raporlar (haftalık) | Aynı + multi-currency | Materialized view + Edge Function async |

**Bottleneck Workers/Node değil — DB**. 10K tenant'a kadar Supabase + Hyperdrive (connection pooling) götürür. Bu durumda **Next.js veya Go fark etmez** çünkü darboğaz Postgres'in kendisi.

### 6.3 Go'nun Cazip Görünmesi vs Gerçek Değer

| İddia | Gerçek değer (PetStockPro bağlamında) |
|---|---|
| "10-100x hızlı binary" | Workers V8 isolates ~5ms warm, ~30ms cold. Pet shop API'sinde 5ms vs 50ms = kullanıcı algılayamaz. Bottleneck DB roundtrip (10-30ms), hesaplama değil. |
| "Goroutines concurrency" | Workers per-request paralel isolation zaten var. DB connection pool darboğaz olur — Hyperdrive (Workers + Postgres) çözer. |
| "Single binary deployment" | `wrangler deploy` saniyeler içinde — Go binary deploy'dan daha basit. |
| "Düşük memory" | Workers'da memory ölçülmüyor, ödenmez. |
| "Type safety" | TS strict mode + Drizzle/Zod runtime validation Go'ya çok yakın. |

Go gerçek **performance-critical** use case'lerde anlamlı: high-frequency trading, real-time gaming, video transcoding, low-level systems. Pet shop CRUD + raporlar bu kategoride değil.

### 6.4 VPS Aleyhine — Tek Geliştirici DevOps Yükü

| Konu | Cloudflare Workers (mevcut) | VPS (alternatif) |
|---|---|---|
| Linux güncelleme + CVE | YOK | Senin işin (her hafta) |
| SSL renewal | Otomatik | Certbot + cron + monitoring |
| DDoS koruma | Workers built-in | Cloudflare proxy ek katman + VPS direkt erişilebilir |
| Backup + restore drill | Supabase otomatik 30 gün | pg_dump + S3 + cron + restore test her ay |
| Monitoring + alert | Sentry hazır | Prometheus + Grafana + Alertmanager + PagerDuty |
| Scale (yatay) | Otomatik (edge) | Load balancer + ek VPS + state sync + sticky session |
| Real-time | Supabase Realtime entegre | Kendi WebSocket sunucusu + Redis state |
| **Lansman süresi** | **Şu plan (~24 hafta)** | **+3-6 ay (yeniden tasarım + Go öğrenme + DevOps kurulum)** |
| Aylık maliyet (1K tenant) | ~$60 | ~$60-80 + **sınırsız zaman maliyeti** |

CLAUDE.md #1 kural: *"3. parti tool > custom build"* + *"Maintenance yükü yüksekse sade tut"*. VPS bu kuralla doğrudan çelişir.

### 6.5 Yurt Dışı Açılış Mimariyi Etkilemiyor

Faz 2'de Paddle aktive olursa:
- **Frontend:** EN locale unhide (next-intl zaten yapılı, kapatıldı)
- **Backend:** Paddle webhook handler (Stripe-benzeri pattern, ~200 satır TS)
- **Region:** Frankfurt (eu-central-1) zaten yurt dışı için ideal (~30ms EU, ~80ms US East)
- **Multi-currency:** Frankfurter API + `currency_rates` tablosu (Faz 2 olarak şema'da hazır)

**Mimari değişiklik YOK** — feature flag açılımı + content update.

### 6.6 İleride Hibrit — Strangler-Fig Pattern (10K+ tenant)

**Şartlar (hepsi sağlanırsa hibrit'e geç):**
- 10K+ aktif tenant **veya**
- Belirli bir endpoint'te P95 latency >500ms (Sentry/CF Analytics izleme)
- DB CPU sürekli >70% (Supabase metric)
- Maliyetler: ek Workers/Supabase $200+/ay yetersiz

**Aday parçalar (Go mikroservis olarak çıkarılabilir):**
| Parça | Sebep | Deployment |
|---|---|---|
| Materialized view refresh (raporlar) | CPU-heavy aggregation, scheduled | Cloudflare Containers veya fly.io Go cron |
| Image moderation queue | LLaVA Workers AI yetmezse, batch processing | fly.io Go worker + Cloudflare R2 queue |
| Bulk export jobs (PDF/Excel 100K+ satır) | Edge Function 5dk limit aşımı | Go processor + S3 upload + e-posta link |
| Vitrin SEO sitemap pre-build | 500K+ URL üretim | Go binary + R2 yaz + Workers serve |

**Şu an yapma** — premature optimization (Knuth: *"premature optimization is the root of all evil"*). Gerçek bottleneck ortaya çıkmadan extract edersen:
1. İki dil context switch yükü erken yüklenir
2. Frontend↔backend type safety bozulur (Drizzle ↔ GORM uyumsuzluğu)
3. Lansman ertelenir
4. Tek geliştirici lens'ine ters düşer

### 6.7 Re-evaluation Tetikleyicileri (Yeniden Gözden Geçir)

Bu karar **kalıcı değil**. Aşağıdaki sinyallerden 2+ aynı anda gelirse yeniden değerlendir:

| Sinyal | Nasıl ölçülür | Aksiyon |
|---|---|---|
| Aktif tenant >10K | Süperadmin panel KPI | Hibrit Strangler-Fig planla (§6.6) |
| P95 latency >500ms | Sentry performance + CF Analytics | Bottleneck endpoint izole et → Go extract aday |
| Aylık altyapı maliyet >$500 | Stripe/CF/Supabase fatura | Cost optimization veya stack revize |
| Cloudflare Workers limit (CPU veya memory) | Workers metric alarm | Hibrit Go service düşün |
| TS/Node ekosisteminde bir teknoloji çürürse | Auth.js maintenance kesilirse vb. | Tek tek değiştir, dil değil |

**Asla yeniden değerlendirme nedeni olmayanlar:**
- *"Go daha cool"* — moda değil, ölçü
- *"Twitter'da X şirket Go'ya geçti"* — vaka değil, evrensel kural
- *"Performance lazım olur belki"* — measure, then optimize

### 6.8 Karar Özeti (Tek Cümle)

> **MVP'de Next.js + Cloudflare Workers (tek dil TS, sıfır DevOps), 10K+ tenant'ta veya P95>500ms'de Strangler-Fig ile Go mikroservis extract. VPS asla.**

---

## 7. Sıradaki Adımlar (Tech Stack tamamlandı sonrası)

1. ✅ **Tech stack** — bu doküman
2. ⏭ **Bekleyen detaylar** — UI lib (shadcn/ui kararı), chart, email vs. küçük seçimler
3. ⏭ **Tasarım sistemi** — mockup-admin-premium-v3 baz alarak TASARIM-SISTEMI.md
4. ⏭ **Ekran tasarımları** — Pano detay + diğer 10 ekran
5. ⏭ **Database schema** — Drizzle schema dosyaları
6. ⏭ **Sprint planı revize** — eski 16 sprint plan'ı yeni stack'e göre güncelle
7. ⏭ **Sprint 0** — proje skeleton (`npx create-next-app` + Supabase setup)

---

*Son güncelleme: 2026-05-12. 4 ana karar onaylandı, deploy + küçük detaylar sonraki adımlarda.*
