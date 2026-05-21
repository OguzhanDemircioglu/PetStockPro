# PLAN — Beta Öncesi Performans + Altyapı Sertleştirme

**Tarih:** 2026-05-21
**Durum:** ✅ Kullanıcı onayladı (2026-05-21) — implementasyon yeni session'da başlayacak
**Tahmini süre:** ~10-12 saat (1-2 tur)
**Branch:** `cray61`

---

## 🎯 Hedef

Beta'ya ("Sıradaki olası işler" #1: Closed beta soft launch) çıkmadan önce 5 ana altyapı eksiğini kapatmak:

1. **Auto-bootstrap** — local/staging/prod DB sıfırdan açıldığında migration + seed otomatik
2. **Log retention** — disk doluluğu için günlük cleanup cron
3. **Error tracking + Telegram alert** — Sentry'siz in-app çözüm (system_errors tablosu reuse)
4. **PetSpinner** — site temalı yükleme göstergesi (3 varyant)
5. **Optimistic UI** — TanStack Query Provider + 5 kritik CRUD'da anlık tepki

Beta v1 lansmanından önce **tek seferde** tamamlanır; sonradan eklemek kolay değil (özellikle #5 retrofit).

---

## 📐 Tasarım Kararları (Bu tur netleşti)

### A. Auto-bootstrap stratejisi

- Next.js native `src/instrumentation.ts` hook (Node.js runtime'da çalışır, Edge runtime'da skip)
- Migration sırası: `drizzle-orm/postgres-js/migrator` ile `_journal.json` baz alınır
- Seed sırası: per-tablo `COUNT(*)=0` check → varsa skip, yoksa idempotent insert
  - `cities` (81) + `districts` (974) — mevcut `db:seed` reuse
  - `catalog_seed_products` (1.240) — `scripts/seed-catalog-table.ts` reuse
  - `companies.default_categories` — register'da zaten per-tenant seed (per-call)
- **Dev mode:** boot'ta her zaman çalış (idempotent zaten)
- **Production mode:** env `BOOTSTRAP_SKIP=1` ile devre dışı bırakılabilir (CI/CD migration'ı önceden çalıştırırsa)

### B. Log retention TTL'leri

| Tablo | TTL | Sebep | Silinmemeli? |
|---|---|---|---|
| `system_errors` | 90 gün | DEPLOYMENT.md §8 retention | — |
| `vitrin_events` | 365 gün | KVKK anonim analytics 1 yıl | — |
| `processed_webhooks` | 90 gün | Idempotency guard yeter | — |
| `notifications` (`is_read=true`) | 90 gün | UI feed, eski okunmuş gereksiz | — |
| `vitrin_reports` (`status≠pending`) | 365 gün | Resolved arşiv | — |
| `vitrin_whatsapp_feedback` | 365 gün | Pet shop dashboard 1 yıl trend | — |
| **`audit_logs`** | ∞ | **KVKK 5 yıl + vergi 10 yıl** | ✅ **silinmez** |
| **`invoices`** | ∞ | **Yasal saklama** | ✅ **silinmez** |
| **`subscriptions`** | ∞ | Geçmiş abonelik audit | ✅ **silinmez** |

**Tetik:** Workers cron daily 04:00 UTC (07:00 TR). Sitemap rebuild (03:00) + cleanup (04:00) + daily-summary (06:00) sıralı.

### C. PetSpinner tasarım dili

Tema renkleri (`--cat` turuncu, `--cart` mavi, `--arrow` yeşil) + Verdana font. **3 varyant:**

1. **`<PetSpinner size="lg" />` (page-level)** — orta-büyük overlay için. **🐾 paw print** SVG, dönerken hafif scale pulse (1.0 → 1.1 → 1.0). Gradient: `--cat` → `--cat-2`. Animasyon hızı: 1.4s. Loading text optional altında.
2. **`<PetSpinner size="md" />` (section/card)** — orta kart loading için. Mevcut `animate-spin border-t-cat` pattern + paw merkez (küçük SVG).
3. **`<PetSpinner size="sm" inline />` (button/inline)** — buton içi pending. Sadece `animate-spin` circle (12px). Mevcut basit pattern.

**A11y zorunlu:**
- `role="status"` + `aria-live="polite"` + `aria-busy="true"`
- `<span className="sr-only">Yükleniyor…</span>`
- `prefers-reduced-motion: reduce` → animation durdurulur, sadece ⏳ emoji statik kalır

**Dark mode:** zaten Tailwind v4 token sistemiyle otomatik (var(--cat) light/dark farklı tonlar).

### D. TanStack Query stratejisi

- **Sadece Client Component'lerde** — Server Component + Server Action mevcut SSR/revalidatePath pattern'iyle çakışmadan, hibrit model:
  - **List view** (SSR ilk yükleme) — Server Component'te initial data, client'ta `useQuery({ initialData })`
  - **Mutation** — `useMutation` ile optimistic update + `setQueryData` rollback
  - **Polling YOK** — `refetchOnWindowFocus: true` (default) yeter (sekme değiştir-gel)
  - **`staleTime: 30s`** — kısa süreli cache, tab focus refetch'i tetikleyecek
- **Provider:** `src/app/providers.tsx` (client) → `src/app/layout.tsx`'a sarmal
- **Devtools:** sadece dev mode (`NODE_ENV !== 'production'`)

### E. Optimistic CRUD önceliklendirme (5 kritik akış)

POS-tarzı kullanımda **algılanan gecikme** en kritik 5 nokta:

| # | Akış | Mevcut | Yeni |
|---|---|---|---|
| 1 | **Stok hareketi kaydet** (drawer Save) | revalidatePath full reload | onMutate ledger'a satır ekle, fail rollback |
| 2 | **Sayım miktar kaydet** (row Save) | tek satır revalidate | onMutate row state güncelle |
| 3 | **Vitrin Aç/Kapat toggle** (liste row) | revalidate full liste | onMutate badge anında değişir |
| 4 | **Ürün düzenle** (edit form) | redirect + revalidate | onMutate row güncelle, redirect kalır |
| 5 | **Bildirim okundu işaretle** | revalidate | onMutate count azalır anında |

**Kapsam dışı (Faz 2):** Şube state toggle, fiyat değişimi, kullanıcı yönetimi (bunlar hızlı sıklıkta yapılmaz, anlık tepki kritik değil).

---

## 🗂 6-Fazlı Uygulama Planı

### **FAZ 1 — Auto-bootstrap** (~1.5 saat)

#### 1.1 `src/instrumentation.ts`
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.BOOTSTRAP_SKIP === '1') return;
  const { runBootstrap } = await import('./lib/bootstrap/run');
  await runBootstrap();
}
```

#### 1.2 `src/lib/bootstrap/run.ts`
- `runPendingMigrations(db)` — Drizzle migrator çağrısı, `_journal.json` baz alır
- `ensureCitiesAndDistricts(db)` — `COUNT(cities)=0` → seed
- `ensureCatalogSeedProducts(db)` — `COUNT(catalog_seed_products)=0` → seed
- Loglar console.log: `[bootstrap] migrations applied=3, cities seeded=81, ...`
- Error → console.error + process.exit(1) (boot fail explicit)

#### 1.3 next.config.ts
```ts
experimental: {
  instrumentationHook: true, // Next.js 16'da default ama explicit yazılır
}
```

#### 1.4 `src/lib/bootstrap/run.test.ts` (8 test)
- runPendingMigrations: zaten apply edilmiş → no-op
- ensureCitiesAndDistricts: COUNT=0 → seed call / COUNT>0 → skip
- ensureCatalogSeedProducts: aynı pattern
- Idempotency: aynı boot 2 kez çağrılırsa state aynı kalır
- Error path: migration fail → throw

#### 1.5 Faz 1 çıktısı
- Local sıfır DB → `npm run dev` → DB hazır 1-2 saniye
- 8 unit test + browser smoke (dev server log: bootstrap satırları)
- 1 commit

---

### **FAZ 2 — Log retention + Error tracking + Telegram alert** (~3 saat)

**2 alt-iş aynı fazda:** Disk doluluk koruması + Sentry'siz hata izleme. Workers cron ve süperadmin paneline aynı kart-tarzı section eklenir.

#### 2.A · Log retention cron

#### 2.1 `src/lib/cleanup/retention.ts`
```ts
export interface RetentionRule {
  table: string;
  ageDays: number;
  whereExtra?: SQL; // notifications: is_read=true; vitrin_reports: status≠pending
  description: string;
}

export const RETENTION_RULES: readonly RetentionRule[] = [
  { table: 'system_errors', ageDays: 90, description: 'Hata logları' },
  { table: 'vitrin_events', ageDays: 365, description: 'Anonim analytics' },
  { table: 'processed_webhooks', ageDays: 90, description: 'Idempotency guard' },
  { table: 'notifications', ageDays: 90, whereExtra: sql`is_read = true`, description: 'Okunmuş bildirimler' },
  { table: 'vitrin_reports', ageDays: 365, whereExtra: sql`status <> 'pending'`, description: 'Resolved şikayetler' },
  { table: 'vitrin_whatsapp_feedback', ageDays: 365, description: 'Geri bildirim' },
];

export async function runRetentionCleanup(db, now): Promise<CleanupReport>
```

`CleanupReport`: per-tablo `deletedCount`, total bytes freed (best-effort `pg_total_relation_size` delta).

#### 2.2 `src/app/api/cron/cleanup-old-logs/route.ts`
- POST + Bearer CRON_SECRET auth (mevcut pattern)
- runRetentionCleanup çağrısı
- Sonuç JSON döner: `{ ok, table, deletedCount, totalDeleted, executionMs }`
- **Telegram alert** (yeni mesaj builder `buildRetentionCleanupSummary`):
  - 10K+ silinen toplam → info severity ("🧹 Bugün X satır temizlendi")
  - Hata → critical severity

#### 2.3 `wrangler.toml` cron schedule
```toml
[triggers]
crons = [
  "0 3 * * *",  # sitemap-rebuild 03:00 UTC
  "0 4 * * *",  # cleanup-old-logs 04:00 UTC (YENİ)
  "0 6 * * *",  # daily-summary 06:00 UTC
]
```

#### 2.4 Süperadmin Sistem Ayarları kartı
- "🧹 Log retention" yeni section
- Her tablonun: TTL gün + son cleanup zamanı (last_cleanup_at) + tahmini satır sayısı
- Manuel "Şimdi temizle" buton (BAYI_SAHIBI YOK, sadece SUPERADMIN — bypass action)

#### 2.5 `src/lib/cleanup/retention.test.ts` (10 test)
- RETENTION_RULES shape (audit_logs olmadığını doğrula!)
- runRetentionCleanup: her tablo için delete chain mock + count toplama
- whereExtra: notifications is_read=true filter doğrulanır
- Audit log: cleanup denenmediği test (regression)
- now param dependency injection
- Error path: tablo yoksa rollback

#### 2.B · Error tracking + Telegram alert (Sentry yerine)

**Felsefe:** Sentry $26/ay + KVKK ABD veri akışı yerine in-app `system_errors` tablosu + threshold-based Telegram alert. $0 maliyet, Frankfurt'ta veri, bizim kontrolde.

##### 2.B.1 `src/lib/errors/track.ts`
```ts
export interface ErrorContext {
  companyId?: string;
  userId?: string;
  route?: string;
  action?: string;        // 'product.create' / 'stock.in' / ...
  metadata?: Record<string, unknown>;
}

export interface TrackedError {
  errorType: string;      // err.name veya 'UnknownError'
  message: string;
  stack: string | null;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export async function trackError(
  err: unknown,
  context: ErrorContext,
  db: DbClient,
): Promise<void>
```

- Catch-all helper: server action error boundary'lerinde çağrılır
- Stack trace ilk 2000 char (system_errors.stack TEXT, kısıt yok ama trim)
- PII koruma: `message` içinden email/IP regex strip
- Fire-and-forget (.catch swallow — error tracking error'a düşmesin)

##### 2.B.2 Threshold check & burst alert

`src/lib/errors/threshold.ts`:
- `checkErrorBurst(errorType, db, windowMinutes=60)` — son 60 dk içinde aynı errorType N+ kez tekrarladıysa true
- Default threshold: **5 burst** (config sabit, env override mümkün)
- Dedup: aynı errorType için 6 saat içinde max 1 alert (anti-spam)

`src/lib/telegram/messages.ts` — yeni builder:
```ts
buildErrorBurstAlert({
  errorType: 'PaymentValidationError',
  count: 7,
  windowMinutes: 60,
  firstOccurredAt: '2026-05-21T...',
  lastSampleMessage: 'Invalid card token',
  panelUrl: 'https://petstockpro.com/admin/superadmin/errors',
})
→ critical severity, sesli bildirim
```

##### 2.B.3 Süperadmin `/admin/superadmin/errors` sayfası

- Liste: son 200 error (filter: severity, errorType, date, resolved)
- Detay drawer: stack trace + context JSON + benzer error'lar
- "Resolved" toggle (UI-only flag; bookkeeping için)
- Süperadmin Sistem Ayarları'na "🐛 Hata izleme" kartı (son 24h count + son alert zamanı)
- Sidebar Süperadmin grubuna "🐛 Hatalar" link (badge: unresolved count)

##### 2.B.4 Server action error boundary entegrasyon

3 örnek path retrofit (pattern set'i):
- `stock-movements/actions.ts` → try/catch wrap + trackError
- `products/[id]/edit/actions.ts` → aynı
- `webhooks/iyzico/route.ts` → aynı (payment integrity kritik)

Faz 5 sonrası diğer 29 action dosyasına yayılma için **pattern set'i hazır** (boilerplate template comment).

##### 2.B.5 Cron entegrasyonu

Wrangler cron `03:55 UTC` — `/api/cron/errors-threshold-check` (cleanup'tan 5 dk önce, threshold check + burst alert tetikleme; cron triggered, manuel POST yok).

##### 2.B.6 Test (8 yeni test)

- `trackError`: happy path + PII strip + db fail silent
- `checkErrorBurst`: 4 event = false / 5+ event = true / windowMinutes hesap
- Dedup: 6h içinde aynı errorType için ikinci alert atılmaz
- `buildErrorBurstAlert`: critical severity + panel link + count vs threshold

#### 2.7 Faz 2 çıktısı
- **A:** 1 cleanup endpoint + Wrangler cron 04:00 + retention rules
- **B:** trackError helper + threshold check + /admin/superadmin/errors sayfa + sidebar link + 03:55 cron + 1 yeni Telegram alert + 3 action boundary entegre
- 18 unit test toplam (10 retention + 8 error tracking)
- Süperadmin paneli 2 yeni kart: Log retention + 🐛 Hata izleme
- 1-2 commit (A ve B ayrı commit'lenebilir)

---

### **FAZ 3 — PetSpinner UI component** (~1 saat)

#### 3.1 `src/components/ui/pet-spinner.tsx`

```tsx
interface Props {
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean; // true → display:inline-block (button içi)
  label?: string; // default "Yükleniyor…"
  showLabel?: boolean; // lg variant'ta görünür, diğerlerinde sr-only
  tone?: 'cat' | 'cart' | 'arrow'; // brand color
}
```

**SVG paw print:**
```svg
<!-- 24x24 viewBox, 4 toe + 1 pad -->
<svg viewBox="0 0 24 24" fill="currentColor">
  <ellipse cx="6" cy="9" rx="2" ry="2.5" />
  <ellipse cx="11" cy="6" rx="2" ry="2.5" />
  <ellipse cx="16" cy="9" rx="2" ry="2.5" />
  <ellipse cx="12" cy="13" rx="2" ry="2.5" />
  <path d="M 7 17 Q 7 21 11 21 L 13 21 Q 17 21 17 17 Q 17 14 12 14 Q 7 14 7 17 Z" />
</svg>
```

**Animasyon variant'ları:**
- `lg`: rotate 360° (1.4s linear) + scale 1.0→1.1→1.0 (1.4s ease)
- `md`: rotate 360° (1.0s linear) — sadece dönüş
- `sm`: mevcut `animate-spin border-t-cat` pattern (basit circle)

**A11y:**
- `role="status"` + `aria-busy="true"` + `aria-live="polite"`
- `<span className="sr-only">{label}</span>`
- CSS: `@media (prefers-reduced-motion: reduce) { animation: none; }` → ⏳ statik emoji fallback

#### 3.2 `globals.css` — yeni keyframe
```css
@keyframes paw-pulse {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.1); }
}
.animate-paw-pulse { animation: paw-pulse 1.4s ease infinite; }
@media (prefers-reduced-motion: reduce) {
  .animate-paw-pulse, .animate-spin { animation: none !important; }
}
```

#### 3.3 Mevcut 3 spinner'ı değiştir
- `src/components/products/seed-catalog-autocomplete.tsx:132` → `<PetSpinner size="sm" inline />`
- `src/components/vitrin/nearby-map-wrapper.tsx:22` → `<PetSpinner size="md" tone="cat" />`
- `src/components/magicui/shimmer-button.tsx` — dokunmuyoruz (kendi animasyonu var)

#### 3.4 `src/components/ui/pet-spinner.test.tsx` (5 test) — React Testing Library
- 3 size render
- inline prop → display:inline-block class
- showLabel=true → label görünür, false → sr-only
- aria-busy attribute zorunlu
- prefers-reduced-motion media query (jsdom support sınırlı, smoke yeter)

#### 3.5 Faz 3 çıktısı
- 1 yeni component + 1 keyframe + 3 mevcut yer migrate edildi
- 5 unit test + browser smoke (büyük spinner görsel kontrol)
- 1 commit

---

### **FAZ 4 — TanStack Query Provider + setup** (~1 saat)

#### 4.1 `src/app/providers.tsx` (client component)
```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  }));
  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV !== 'production' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

#### 4.2 `src/app/layout.tsx` — Providers sarmal
- ThemeProvider zaten var → Providers içine veya dışına? **Theme dış, Query iç** (theme cookie-driven SSR, query client-only)

#### 4.3 Standart query/mutation helper'ları
- `src/lib/queries/keys.ts` — query key factory (`productKeys.list(filters)`, `stockMovementKeys.byBranch(id)`, ...)
- `src/lib/queries/setup.ts` — `getQueryClient()` server-side hydration için (yeni session başına)

#### 4.4 Faz 4 çıktısı
- 1 yeni Provider + 2 lib dosyası
- Layout sarmal değişiklik
- Mevcut sayfalar etkilenmedi (Provider sadece consumer eklendikçe aktif)
- 1 commit (kapsam küçük, Faz 5 için altyapı)

---

### **FAZ 5 — 5 Kritik CRUD Optimistic Refactor** (~3-4 saat)

Her CRUD için pattern aynı:

```tsx
'use client';
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: async (input) => /* server action call */,
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, (old) => /* optimistic update */);
    return { previous };
  },
  onError: (err, input, ctx) => {
    queryClient.setQueryData(queryKey, ctx?.previous); // rollback
    toast.error(err.message);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey });
  },
});
```

#### 5.1 Stok hareketi (stock-movements drawer Save)
- Liste: `useQuery({ queryKey: stockMovementKeys.byBranch(branchId) })`
- Mutation: optimistic prepend yeni satır + `pending` flag (UI'da gri opacity)
- Error: rollback + toast "Kaydedilemedi"

#### 5.2 Sayım miktar kaydet (stocktake/[id] row)
- Her item row için ayrı useQuery? **Hayır** — tek master query (stocktake header + items)
- Mutation: row state güncelle (countedQty + diff + reason)
- 5 sn pending'de progress bar lokal hesaplı

#### 5.3 Vitrin Aç/Kapat toggle (products liste)
- Liste query'sinde toggle butonu mutation tetikler
- Optimistic: `vitrinPublished` flip + badge anında değişir
- Error: rollback + toast (validation_failed mesajları için server'dan dönüş)

#### 5.4 Ürün düzenle (products/[id]/edit form)
- Tek tek field değişiklik DEĞİL — form submit
- Mutation: success'ta redirect, ama liste cache'te ürün adı/SKU update
- Error: redirect olmaz, form state korunur

#### 5.5 Bildirim okundu işaretle (notifications)
- Bell badge count: `useQuery({ queryKey: notificationKeys.unreadCount })`
- Mutation: optimistic count - 1 + bildirim is_read=true flip
- Bulk "Tümünü okundu" → optimistic count = 0

#### 5.6 PetSpinner entegrasyonu
- Her mutation pending state'de buton içinde `<PetSpinner size="sm" inline />`
- Liste yükleme: `<PetSpinner size="md" />` placeholder (skeleton yerine bu MVP)

#### 5.7 Test (12-15 test)
- Her mutation için: happy path + rollback test
- Vitest + React Testing Library + msw mock (server action)
- queryClient instance test başına

#### 5.8 Faz 5 çıktısı
- 5 mutation refactor + spinner entegrasyon
- 12-15 unit test
- Browser smoke 5 senaryo (her CRUD'a click + anlık tepki + intent rollback)
- 1 commit (büyük commit, faz kapsamı net)

---

### **FAZ 6 — Test + Browser Smoke + Doküman + Push** (~1 saat)

#### 6.1 Tam test suite
```bash
npx vitest run --no-coverage --reporter=dot
# Beklenen: 1567 + ~40 yeni = ~1607 test pass
```

#### 6.2 Browser smoke senaryoları (8 senaryo)
1. ✅ Boş local DB → `npm run dev` → bootstrap log + DB hazır
2. ✅ Stok-in drawer → Kaydet → ledger'a **anında** yeni satır + spinner button içinde 200ms
3. ✅ Network throttle 3G → mutation rollback (server fail simulate)
4. ✅ Sayım row → say + reason + Save → diff badge **anında**
5. ✅ Vitrin toggle → badge **anında** değişir + 1 sn sonra confirmed
6. ✅ Bildirim oku → bell badge -1 **anında**
7. ✅ Süperadmin Sistem Ayarları → Log retention kartı + "Şimdi temizle" → cleanup raporu
8. ✅ PetSpinner 3 size mock sayfa (Storybook yok — `/dev/spinner-preview` opsiyonel)

#### 6.3 Doküman güncellemeleri

| Dosya | İçerik |
|---|---|
| `TECH-STACK.md` | TanStack Query "Aktif" notu + Provider yapısı |
| `DEPLOYMENT.md §3.1` | Workers cron `04:00 cleanup-old-logs` eklendi |
| `DEPLOYMENT.md §8` | Log retention TTL tablosu |
| `CLAUDE.md` | Bu turun karar satırı (2026-05-21+ tarih) |
| `DEVAM-REHBERI.md` | Yeni tur özet + browser smoke kanıtları |

#### 6.4 Git
- 5 faz boyunca 5 commit (her faz ayrı)
- Final docs commit ayrı
- Push: `git push origin cray61`

---

## ⚠ Risk + Dikkat Edilecekler

### 1. Server Component + TanStack Query karışımı
- TanStack Query **sadece client component'lerde**. Server Component'te `useQuery` yazılamaz.
- Hybrid: list sayfası SSR (Server Component) + interaction client component (`'use client'` directive)
- **initialData hydration** — SSR yapılan veriyi client cache'e seed et:
  ```tsx
  <ClientList initialData={data} /> // server'dan props ile geçer
  ```
- Şu an çoğu admin sayfası Server Component → mutation kullanan satırlar/butonlar **child client component**'e ayrılır

### 2. revalidatePath ile çakışma
- Mevcut Server Action'lar revalidatePath çağırıyor → tüm sayfa yeniden render
- Client cache + SSR revalidate çift refresh → flicker riski
- **Çözüm:** Mutation success'ta revalidatePath **kalır** (SSR cache invalidation), client'ta `setQueryData` ile zaten optimistic update yapılmış → useQuery refetch fresh data ile reconcile eder
- Pattern: server action sonra `revalidatePath` çağırılır ama client zaten optimistic → user net flicker görmez

### 3. Network fail UX
- onError'da `queryClient.setQueryData(queryKey, previous)` → state geri döner
- **Toast UX zorunlu**: "Kaydedilemedi — tekrar dene" (SWAL toast pattern mevcut)
- Re-try: kullanıcı tekrar tıklar (otomatik retry YOK — yanıltıcı olabilir)

### 4. Concurrent edit (iki tab aynı şube)
- Şu an mevcut sorun değil (tek geliştirici/tek kasa). Kullanıcı 5 dk poll önerdi → fazla.
- **Çözüm (Faz 2):** `refetchOnWindowFocus: true` (default) — sekme değiştir-gel = fresh fetch
- Stocktake softLock zaten mevcut (DB-level conflict koruması)
- **MVP'de yeterli**

### 5. Bootstrap'ta migration fail riski
- Production'da `BOOTSTRAP_SKIP=1` ile CI/CD'ye bırakılabilir
- Migration error → instrumentation.ts throw → boot fail (Next.js start error)
- **Önerilen:** local/dev'de aktif (geliştirici hızı için), production'da CI/CD migrate

### 6. Log retention yanlış tablo silebilir
- **audit_logs / invoices / subscriptions ASLA silinmez** — RETENTION_RULES'a eklenirken sabit kontrol testte (regression):
  ```ts
  it('audit_logs RETENTION_RULES içinde olmamalı (KVKK 5 yıl)', () => {
    expect(RETENTION_RULES.some(r => r.table === 'audit_logs')).toBe(false);
  });
  ```

### 7. PetSpinner — prefers-reduced-motion
- Mecburi karşılama (WCAG 2.2 Level AA)
- CSS `@media` ile animation:none + ⏳ statik fallback
- Test: jsdom mock (gerçek media query simulate edilemez ama class apply check)

### 8. TanStack Query bundle size
- `@tanstack/react-query@5.62` ~13 KB gzip — kabul edilebilir
- Devtools sadece dev (`process.env.NODE_ENV !== 'production'` koşulu)
- Production bundle analyzer ile doğrula (`npm run build:analyze`)

### 9. Error tracking PII sızıntısı
- `system_errors.message` içine email/IP gibi PII düşebilir (KVKK ihlali)
- `trackError` içinde regex strip:
  ```ts
  const sanitized = message
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[email]')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[ip]')
    .replace(/\b\d{10,11}\b/g, '[tckn-vkn]');
  ```
- Test: PII içeren error message → DB'ye sanitize hâli yazılır

### 10. Error burst alert flood prevention
- Aynı errorType 1000+ event/dk üretirse Telegram bot rate limit (30 mesaj/sn) çakar
- **Dedup window 6 saat** — aynı errorType için max 1 alert/6h
- **Hard cap:** Cron her 5 dk çalışsa bile günlük max 24 alert (errorType başına 4)
- Test: 100 burst → 1 alert (dedup doğrulanır)

---

## ✅ Atlama Olmayan Kontrol Listesi (Definition of Done)

**Faz 1 — Auto-bootstrap**
- [ ] **Migration auto-run** — local sıfır DB → npm run dev → migration log + tablo hazır
- [ ] **Seed auto-run** — boş cities/districts/catalog_seed → boot'ta seed çağrılır, dolu ise atlanır
- [ ] **BOOTSTRAP_SKIP=1 çalışır** — production CI/CD için escape hatch

**Faz 2.A — Log retention**
- [ ] **Cleanup cron endpoint** — POST /api/cron/cleanup-old-logs Bearer auth
- [ ] **Wrangler cron** — `0 4 * * *` schedule eklendi
- [ ] **Telegram alert** — cleanup başarı/fail bildirimi
- [ ] **audit_logs regression test** — RETENTION_RULES'da olmadığı doğrulanır
- [ ] **Süperadmin "Log retention" kartı** — manuel "Şimdi temizle" butonu (sadece SUPERADMIN)

**Faz 2.B — Error tracking + Telegram alert**
- [ ] **`trackError` helper** — system_errors INSERT + PII strip + fire-and-forget
- [ ] **Threshold check + dedup** — 5+/saat aynı errorType → alert; 6h dedup
- [ ] **`buildErrorBurstAlert`** — critical severity + panel link
- [ ] **`/admin/superadmin/errors` sayfası** — liste + detay + resolve toggle
- [ ] **Sidebar Süperadmin "🐛 Hatalar" link** — badge unresolved count
- [ ] **Süperadmin "🐛 Hata izleme" kartı** — Sistem Ayarları'na
- [ ] **3 action boundary** — stock-movements + product edit + iyzico webhook retrofit
- [ ] **Wrangler cron 03:55** — errors-threshold-check

**Faz 3 — PetSpinner**
- [ ] **PetSpinner 3 variant** — sm/md/lg + inline prop
- [ ] **A11y** — role="status" + aria-busy + sr-only label + prefers-reduced-motion
- [ ] **Mevcut 3 spinner migrate** — seed-catalog-autocomplete / nearby-map / (shimmer-button hariç)

**Faz 4 — TanStack Query Provider**
- [ ] **Providers** — layout.tsx sarmal + devtools dev-only
- [ ] **Query key factory** — `keys.ts` exportları
- [ ] **`getQueryClient` SSR hydration helper**

**Faz 5 — 5 CRUD optimistic**
- [ ] **Stok hareketi drawer Save** — onMutate prepend + rollback test
- [ ] **Sayım item Save** — row state güncelle
- [ ] **Vitrin Aç/Kapat toggle** — badge anında değişir
- [ ] **Ürün edit form** — submit success'ta cache update
- [ ] **Bildirim oku** — bell count anında azalır
- [ ] **Spinner entegrasyon** — pending state'de button içi PetSpinner

**Faz 6 — Test + smoke + doc + push**
- [ ] **Test toplam** — ~1610+ pass, typecheck 0 error, lint 0 error
- [ ] **Browser smoke 9 senaryo** — preview_screenshot ile (memory kuralı), bootstrap + 5 CRUD + retention + error burst + spinner
- [ ] **5 doküman güncel** (TECH-STACK / DEPLOYMENT / CLAUDE / DEVAM-REHBERI / bu plan)
- [ ] **Git push origin cray61** — 6-7 commit

---

## 🚀 Yeni Session Başlangıç Yöntemi

```
1. cd D:\Projeler\PetStockPro
2. claude
3. İlk komut: "PLAN-BETA-PERFORMANCE.md oku ve Faz 1'e başla"
```

---

## 📝 Lansman sonrası eklenebilir (bilinçli kapsamda DEĞİL)

**Önemli:** "Lansman sonrası" = bu plan'ın 6 fazı tamamlandıktan + beta yayınlandıktan + gerçek pet shop kullanıcı verisi toplandıktan **sonra** ihtiyaç doğrularsa eklenir. Şu anda bilinçli olarak ertelendi — tek geliştirici kuralı (CLAUDE.md #1: az feature, kaliteli olanı bitir).

| Konu | Erteleme sebebi |
|---|---|
| **PWA + offline-first** | 1-2 hafta iş; pet shop'ta internet hep var varsayımı MVP'de geçer. Gerçek "çevrim dışı" şikayeti gelirse yap |
| **Supabase Realtime** | Tek kasa = başkası eşzamanlı yazmıyor → websocket overhead gereksiz. 5K+ tenant'ta düşünülür |
| **Multi-user concurrent edit** | POS-tarzı tek kasa varsayımıyla problem değil. Stocktake softLock + DB UNIQUE constraint zaten DB-level koruma |
| **Service Worker cache** | Cloudflare CDN edge'de zaten yapıyor → duplicate iş |
| **PetSpinner Storybook** | Component dokümantasyon aracı; tek spinner için build setup overkill, mock sayfa yeter |
| **React Query SSR streaming** | Suspense pattern karmaşıklık artırır, initialData hydration yeter |
| **Spinner için Lottie animasyon** | Bundle weight (~50KB+) ve SVG zaten yeterli performant |
| **i18n EN locale** | **Strateji kararı:** TR-only (2026-05-14 CLAUDE.md). Yurtdışı pazar Faz 3 (Paddle MoR ile) |
| **Sentry integration** | ⚠ Bu plan'da Faz 2.B ile **system_errors + Telegram pattern**'i ekliyoruz → Sentry'e gerek kalmıyor. $0 + KVKK temiz + bizim kontrolde |

---

*Plan yazıldı: 2026-05-21. Onaylandı: 2026-05-21. İmplementasyon: yeni session'da (~10-12 saat efektif).*
*Sorumluluk: Bayi Admin (Oğuzhan).*
*Final çıktı: 6-7 commit + push + DEVAM-REHBERI güncel.*
