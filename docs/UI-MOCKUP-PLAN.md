# PetStockPro — UI Mockup Planı + Brief

**Tarih:** 2026-05-14
**Durum:** Sprint 0 öncesi mockup hazırlığı
**Kapsam:** Tüm ekran mockup'ları için brief + öncelik + tool karar + prompt şablonu

> **Felsefe:** Mockup'lar **kod yazımı öncesi tasarım netleştirme aracı**. Sprint 0'da Next.js skeleton kurulduktan sonra her sprint başında ilgili mockup baz alınarak React component implementasyonu yapılır. Pixel-perfect değil, **layout + bileşen + akış** netleştirme amaçlı.

---

## 1. Mevcut Durum

### 1.1 preview/ klasöründe olanlar (4 adet + 1 legacy)

| Dosya | Boyut | Satır | Durum |
|---|---|---|---|
| `pano.html` | 128KB | 2925 | ⚠ Eski font (Plus Jakarta + Fraunces) — Verdana'ya geçiş gerek |
| `urunler.html` | 121KB | 2587 | ⚠ Aynı font sorunu + Satışa Aç toggle eksik |
| `stok-hareketleri.html` | 135KB | 2845 | ⚠ Aynı font sorunu |
| `super-admin.html` | 124KB | 2647 | ⚠ Aynı font + Vitrin Modlama 4. sekme eksik |
| `vitrin.html` | 73KB | 1266 | ❌ **LEGACY** — tenant subdomain modeli, tamamen iptal (2026-05-13) |

### 1.2 Eksik Mockup'lar (10 adet)

**Admin tarafı (5 admin ekran + auth):**
- `dusuk-stok.html` — EKRAN-DUSUK-STOK.md
- `sayim.html` — EKRAN-SAYIM.md (drawer + tam-sayfa workflow)
- `subeler.html` — EKRAN-SUBELER.md
- `tedarikciler.html` — EKRAN-TEDARIKCILER.md
- `kullanicilar.html` — EKRAN-KULLANICILAR.md
- `raporlar.html` — EKRAN-RAPORLAR.md (ana liste + 6 rapor detay)
- `ayarlar.html` — EKRAN-AYARLAR.md (6 bölüm + Vitrin Profili + Vitrin Metrikleri)
- `auth.html` — Login + Register + Şifre sıfırlama + E-posta doğrulama + Email değiştirme + 2FA setup + Onboarding (3 adım) — **Detay: `EKRAN-AUTH.md` (2026-05-15)**

**Public vitrin tarafı (yeni merkezi vitrin — 5 sayfa):**
- `vitrin-anasayfa.html` — `/vitrin` ana
- `vitrin-arama.html` — `/vitrin/arama` + `/vitrin/[il]/[ilce]`
- `vitrin-urun.html` — `/vitrin/urun/[slug]` + cross-tenant kıyaslama
- `vitrin-magaza.html` — `/vitrin/magaza/[slug]` pet shop profili
- `vitrin-ana-petstockpro.html` — `petstockpro.com` SaaS landing (Faz 2)

---

## 2. Tasarım Dili Özeti (TASARIM-SISTEMI.md)

> Mockup yapan tool/insan **bunları bilmek zorunda**.

### 2.1 Tipografi
- **Font:** **Verdana** (saf, sistem font) — Geneva, Tahoma, sans-serif fallback
- **Mono:** Consolas, "Lucida Console", Monaco
- **❌ Plus Jakarta Sans / Fraunces / JetBrains Mono kullanma** (eski karar, iptal)
- Boyutlar Verdana'ya kalibre: body 13px, başlık 20-26px, KPI büyük 42px

### 2.2 Renk Paleti — 5 Semantik Tema (logodan)

```css
--cat:    #d4621c   /* Turuncu — CTA, accent (kedi) */
--cart:   #1e3a5f   /* Lacivert — primary, sidebar (sepet) */
--arrow:  #22c55e   /* Yeşil — success, büyüme */
--bars:   #7cb8e0   /* Açık mavi — info, chart */
--dog:    #2c4257   /* Antrasit — neutral dark (köpek) */
--danger: #ef4444   /* Kırmızı — sistem (marka değil) */
```

Her renk için 5 ton var: ana, açık (-2), koyu (-700), soft arka plan (-soft).

### 2.3 Görsel Dil
- **Glass morphism** (sidebar, topbar, kartlar — `backdrop-filter: blur`)
- **Mesh gradient** (background, hero — yumuşak çok-renkli geçiş)
- **Paw pattern** (background subtle, opacity 0.025)
- **Hayvan mascot** (kedi + köpek illustration — bento kart watermark, hero görseli)
- **3D tilt** (bento kart hover — `transform: perspective rotateX rotateY`)
- **Border radius:** 8/12/18/24/32 (--r-xs / sm / md / lg / xl)
- **Shadow:** 3 seviye (sm / md / lg) + renk gölgeleri (--shadow-cat / cart / arrow)

### 2.4 Layout
- **Sidebar:** Sol fixed, 240px genişlik, gruplar (Envanter / Operasyon / Kaynaklar / Analiz / 🏪 Vitrin / Ayarlar)
- **Topbar:** Sticky üst, 64px, glass — sayfa başlığı + ⌘K + 🌐 Vitrin link + 🔔 + 🌓 + avatar
- **İçerik:** max-width 1280px, padding 24px

### 2.5 Bileşen Stili — Mockup Referansı

> `D:/Projeler/mockup-admin-premium-v3.html` premium showcase referans.

- **Bento kartlar** — düzensiz grid, farklı boyutlar, tilt hover
- **KPI ring** — circular progress (36×36, stroke 4px), plan limit göstermek için
- **Activity feed** — sticky sağ kolon, 30s polling, 🚨 superadmin işareti
- **Glass topbar** — backdrop-filter blur, alt border subtle
- **Premium button** — `--cat` gradient + `--shadow-cat` renkli gölge, hover bounce
- **Drawer** — sağdan slide-in, max-width 560px, backdrop blur

---

## 3. Yapım Yaklaşım Seçenekleri

| Seçenek | Avantaj | Dezavantaj | Uygunluk |
|---|---|---|---|
| **(a) Bana yaptır (Claude Code)** | Doğru klasöre direkt yazar, dokümanlardan eşik bilgileri okur, tutarlılık | Her ekran için bir mesaj turn'ü gerek | ✅ Tutarlılık + dokümana sadakat için ideal |
| **(b) Claude.ai artifacts** | Web claude.ai üzerinde interaktif HTML preview, hızlı iterasyon | Dosya manuel kopyala-yapıştır, prompt context kayıp | Tek ekran için OK, çoklu zor |
| **(c) v0.dev** | shadcn/ui native React component üretir | HTML mockup değil React, mevcut HTML akışıyla uyumsuz, ücretli | Sprint 1+ React implementasyonu için iyi, mockup için değil |
| **(d) Lovable / Bolt.new** | Tam stack mockup (deploy edilebilir) | Gereksiz kompleks, mockup için aşırı | Mockup için fazla |
| **(e) Figma + harici tasarımcı** | Pixel-perfect, design system iyi | Pahalı + uzun | Lansman sonrası v2 için, MVP için değil |

**Önerim: (a) — Bana yaptır.** Sebepler:
- Dokümanlar (EKRAN-*.md) zaten detaylı brief — direkt okuyup HTML üretebilirim
- Mevcut mockup'larla aynı CSS variable + font sistemi
- Plan tier (3-tier B 2026-05-14), vitrin yapısı (merkezi tek 2026-05-13), KVKK, TR-only kararları gibi son kararlara sadakat
- Tek seferde 14 mockup üretmek tek mesaj turn'ünde mümkün değil ama 2-3 turn'de hepsi hazır
- Pet/ deki eski mockup-admin-premium-v3.html bana referans — pattern'i takip ederim

---

## 4. Önerilen Yapım Sırası (Öncelik)

### 4.1 Faz 1 — Mevcut 4 mockup yenile (Verdana + son kararlar)

Sprint 0 öncesi yapılmalı (kod yazılmadan önce mockup tutarlı olsun):

1. **`pano.html`** — Verdana + topbar'da 🌐 Vitrin link + KPI Aktif Ürün ring 47/50 + plan göstergesi yeni
2. **`urunler.html`** — Verdana + Satışa Aç toggle + Doğrula validation + Bulk vitrine aç + plan limit 50/sınırsız
3. **`stok-hareketleri.html`** — Verdana + minor güncellemeler
4. **`super-admin.html`** — Verdana + Vitrin Modlama 4. sekme (otomatik onay yapısı) + 3-tier B plan tablosu (FREE 50 / PRO 500 / PRO+ ∞, 2026-05-14 YT-7)

### 4.2 Faz 2 — Eksik admin mockup'lar (Sprint 0-7'de gerek)

Sprint sırasına göre:

5. **`auth.html`** — Sprint 2 için (Login + Register + Onboarding + 2FA + Turnstile + email değiştirme — `EKRAN-AUTH.md` detay)
6. **`subeler.html`** — Sprint 6 için (lat/lng zorunlu vurgu + harita)
7. **`sayim.html`** — Sprint 5 için (drawer + tam-sayfa)
8. **`dusuk-stok.html`** — Sprint 8 için (R6 sade-tut)
9. **`tedarikciler.html`** — Sprint 9 için (CRUD)
10. **`kullanicilar.html`** — Sprint 9 için (hibrit davet: email/link toggle + rol seçici — 2026-05-14)
11. **`ayarlar.html`** — Sprint 10 için (6 bölüm + Vitrin Profili + Vitrin Metrikleri)
12. **`raporlar.html`** — Sprint 11 için (ana liste + 6 rapor detay — Açık Krediler dahil)

### 4.3 Faz 3 — Public vitrin mockup'lar (Sprint 12 için)

13. **`vitrin-anasayfa.html`** — `/vitrin` merkezi dizin ana
14. **`vitrin-arama.html`** — şehir/ilçe/kategori filtreli liste
15. **`vitrin-urun.html`** — ürün detay + cross-tenant kıyaslama
16. **`vitrin-magaza.html`** — pet shop profili (şube seçici dahil)
17. **`vitrin-ana-petstockpro.html`** — SaaS landing (Faz 2)

### 4.4 Temizlik

18. `vitrin.html` (eski) — sil veya `_LEGACY/` klasörüne taşı

---

## 5. Ekran-Ekran Brief

> Her ekran için: **kapsam + bileşen + data + etkileşim + bağımlılık**.

### 5.1 pano.html (yenile)

**Doküman:** `EKRAN-PANO.md` · **Kod:** [`src/app/admin/page.tsx`](../src/app/admin/page.tsx) (otoritatif — mockup'ın gerisinde)

> **2026-05-21 brief sync:** Implementasyon mockup'tan ileri. Mockup `preview/pano.html` Sprint 0 öncesi tasarım, kod 12+ sprint sonrası. Brief implementasyonu yansıtacak şekilde güncellendi. Mockup yenileme **Faz 2'ye saklı** (tek geliştirici sade-tut — kod canonical).

**Bileşenler (testid sırasıyla):**
- Topbar (`AdminTopbar`) — sayfa başlığı + tarih + ⌘K + 🌓 Theme + 🏪 Vitrin link + 🛡 Süperadmin (varsa) + 🔍 İzleyici (OBSERVER ise) + 🔔 NotificationBell (sayı rozet, cache-reactive, 2026-05-21 fix) + avatar + çıkış
- Sidebar (`AdminSidebar`) — brand + nav gruplar + plan progress + düşük stok rozet
- `pano-hero` — karşılama (companyName + son işlem zamanı) + 2 CTA (`hero-add-product` + `hero-stock-in`) + `hero-logo-wrap` mascot
- `kpi-trio` — 3 büyük KPI (Ciro/Hareket/Vitrin görüntülenme 7g) + mini sparkline
- `stock-strip` — Envanter değeri + şube breakdown + Aktif Ürün `N/limit` plan progress
- `pano-alert` + `pano-alert-cta` — kritik tek mesaj (varsa) → ilgili eyleme link
- `quick-chip-row` — 4 hızlı eylem chip (Stok Girişi / Yeni Satış / Transfer / Sayım)
- `pano-notif-feed` — son okunmamış 5 bildirim mini-feed (Sprint 15+)
- `pano-feedback-widget` — vitrin WhatsApp feedback özet (Sprint 12+ — funnel + ortalama rating)
- `petpro-transfer-suggestions` — şubeler arası transfer önerisi (rule-based)
- `petpro-discount-suggestions` — ölü stok indirim önerisi
- `petpro-expiring-suggestions` — SKT yakın ürünler
- `petpro-assistant` — kombine sipariş öneri kartı (low-stock + supplier grup)
- 2-kolon son aktivite grid: `recent-activity-all-ledger` (son 10 stok hareketi) + `recent-activity-today-audit` (bugünkü audit log)

**Data örnek:** Mavi Pet Shop, FREE 47/50 ürün, bugün 14 satış 1.850₺ ciro, 5 düşük stok ürün
**Etkileşim:** Hızlı Eylem chip'leri ilgili sayfaya navigate, KPI tıklama filtreli sayfa
**Bağımlılık:** TASARIM-SISTEMI tüm tokenlar + `notificationKeys` query cache key

---

### 5.2 urunler.html (yenile)

**Doküman:** `EKRAN-URUNLER.md` · **Kod:** [`src/app/admin/products/`](../src/app/admin/products/) — page.tsx + filter-bar.tsx + list-row-toggle.tsx + new/ + [id]/ + [id]/edit/ + import/ + export/

> **2026-05-21 brief sync:** Implementasyon mockup'tan ileri. Mockup `preview/urunler.html` Faz 2'ye saklı (kod canonical, sade-tut).

**Liste sayfası (`/admin/products`, [page.tsx](../src/app/admin/products/page.tsx)):**
- Header — "Admin · Ürünler" + sayı (filtreli/FREE plan limit metni) + 2 buton: `📥 Excel'den içeri aktar` + `+ Yeni ürün`
- Result banner'lar: justCreated (✅ + seed_image durumu) + `moderation-warning` (uygunsuz ifade flagged) + updated + deleted (soft delete)
- `FilterBar` — q + parent kategori + alt kategori + marka + status + vitrin durumu
- Tablo — Ürün (name + slug mono) + Kategori + Marka + Variant count + Stok (toplam, 0 ise danger) + Fiyat default variant + Vitrin (`ListRowToggle` optimistic flip)
- Soft delete satır opacity-50
- Empty state — logo mascot + "İlk ürününü ekle" CTA veya "Filtreyi temizle"

**Detay sayfası (`/admin/products/[id]`, [page.tsx](../src/app/admin/products/[id]/page.tsx)):**
- Header — name + slug + auto-unpublish reason banner (varsa: stock_zero / missing_image / vat_no)
- 4 KPI kart grid
- `variant-matrix` — variant × şube stok cross-table
- `product-movements` — son 10 stok hareketi feed

**Yeni ürün (`/admin/products/new`, [form.tsx](../src/app/admin/products/new/form.tsx)):**
- Auto-brand-hint section — `auto-brand-hint` (katalog seed marka önerisi, hayvan tipi ile)
- "📦 Temel bilgiler" — name + slug + animal type + `parent-category-select` + `child-category-select` + brand + description
- "🏷 Stok birimi" — default variant (SKU + variantLabel + barkod + cost/sale price + threshold per branch JSON)
- Çoklu görsel yükleme — `product-image-input` + `pending-images-grid` (submit öncesi pending queue, kayıt sonrası R2'ye upload)

**Düzenle (`/admin/products/[id]/edit`, 6 section):**
- "📦 Temel bilgiler" — same fields editable + isActive checkbox
- "🏷 Default variant — hızlı düzenleme" — default variant inline edit
- `storefront-section` ([storefront-section.tsx](../src/app/admin/products/[id]/edit/storefront-section.tsx)) — heading "Vitrin'de yayında/kapalı" + meta (publishedAt + reason) + sticky `storefront-toggle` + ValidationPanel (5 check ✓/✕: vat_no / active / variant / price / image) + opts.requireImage=true (2026-05-21)
- "📋 Variantlar" ([variants-section.tsx](../src/app/admin/products/[id]/edit/variants-section.tsx)) — multi-variant editor inline + default işaretle + sil (son aktif koruma)
- `product-images-section` ([images-section.tsx](../src/app/admin/products/[id]/edit/images-section.tsx)) — upload + reorder + set primary + delete + image-action-status feedback
- "🗑 Ürünü sil" danger section — soft delete confirm

**Import sayfası (`/admin/products/import`, [client.tsx](../src/app/admin/products/import/client.tsx)):**
- Drag-drop xlsx + 11 kolon şablon (template/ klasör) + 15+ validation (sınır + duplicate + DB cross-check) + SWAL özet modal + vitrinPublished=false zorunlu

**Export route:** `/admin/products/export` `route.ts` → .xlsx (TR header, ₺ para, auto-filter, freeze pane, zebra) — Verilerimi İndir hub'tan tetiklenir.

**Data örnek:** Royal Canin Adult Kedi 2kg variant'lı + 35 ürün liste
**Etkileşim:** ListRowToggle satır içi optimistic flip (Faz 5), Doğrula validation gate (storefront-section), bulk vitrine aç/çıkar **Faz 2'ye saklı** (single-toggle yeterli)
**Bağımlılık:** TASARIM-SISTEMI · `storefrontKeys` query cache · R2 image storage · Cloudflare Workers AI moderation

---

### 5.3 stok-hareketleri.html (yenile)

**Doküman:** `EKRAN-STOK-HAREKETLERI.md` · **Kod:** [`src/app/admin/stock-movements/`](../src/app/admin/stock-movements/) — page.tsx + movements-filter-bar.tsx + movements-table.tsx + drawer-launcher.tsx + 4 drawer + reverse-button.tsx + export/

> **2026-05-21 brief sync:** Implementasyon mockup'tan ileri. Mockup `preview/stok-hareketleri.html` Faz 2'ye saklı.

**Liste sayfası (`/admin/stock-movements`, [page.tsx](../src/app/admin/stock-movements/page.tsx)):**
- Header — "Admin · Stok Hareketleri" + Ledger başlığı + "Son 100 hareket · Append-only" alt-metin + `DrawerLauncher` 4 buton (4 hareket tipi)
- `DrawerLauncher` ([drawer-launcher.tsx](../src/app/admin/stock-movements/drawer-launcher.tsx)) — 4 buton: `open-stock-in` (📥 Stok Girişi, arrow renk) · `open-stock-out` (📤 Çıkış/Satış, cat renk) · `open-transfer` (🔁 Transfer, 2+ şube zorunlu) · `open-stocktake` (📋 Sayım). Şube/variant yoksa disabled hint
- `movements-filter-bar` ([movements-filter-bar.tsx](../src/app/admin/stock-movements/movements-filter-bar.tsx)) — `mv-branch` + `mv-variant` + `mv-type` (giriş/çıkış/transfer/sayım) + `mv-filter-clear` + `mv-export` (xlsx download)
- Tablo ([movements-table.tsx](../src/app/admin/stock-movements/movements-table.tsx)) — Tarih · Tür (📥/📤/🔁/📋 + subtype TR etiket) · Ürün · Şube · Önce · Δ · Sonra · Notlar (customerRef/documentNo/reason/transferGroup chip'ler) · İşlem (`reverse-button`)
- Reversed satır opacity-50 + line-through · reversal satır "↶ Geri alma" rozet · reverseButton 24h pencere içinde, transfer pair otomatik birlikte geri alır
- Empty state — 📦 icon + filtre temizle CTA

**4 Drawer (sağdan slide-in, DrawerShell shared):**
- `StockInDrawer` ([stock-in-drawer.tsx](../src/app/admin/stock-movements/stock-in-drawer.tsx)) — şube + variant + qty + cost + supplier + documentNo + lot + SKT + note · PetSpinner pending (Faz 5)
- `StockOutDrawer` ([stock-out-drawer.tsx](../src/app/admin/stock-movements/stock-out-drawer.tsx)) — şube + variant + subtype dynamic field (sale=priceField+customerField+paymentMethod / waste=reason / gift+sample=customerField / internal_use=yok) · credit + customerRef boş → "Veresiye satışta müşteri zorunlu" UI guard · auto-unpublish trigger (stock=0 + vitrinPublished)
- `TransferDrawer` ([transfer-drawer.tsx](../src/app/admin/stock-movements/transfer-drawer.tsx)) — kaynak + hedef şube + variant + qty + note · query-param auto-open + prefill (low-stock'tan tek tıkla)
- `StocktakeDrawer` ([stocktake-drawer.tsx](../src/app/admin/stock-movements/stocktake-drawer.tsx)) — şube + variant + countedQty (large bold input) + reason 7 enum + note · "Sistemdeki miktarla aynı" → no_change kayıt yok · countedQty=0 + vitrinPublished → auto-unpublish

**Export:** `/admin/stock-movements/export` route → .xlsx (filtre param'larını URL'den okur, TR header, dd/mm/yyyy locale)

**Data örnek:** Son 100 hareket — 15 stok giriş + 30 satış + 8 transfer + 12 sayım + 35 sayım initial
**Etkileşim:** Drawer'lar slide-in (DrawerShell — Escape kapat + body lock + backdrop blur), Sayım workflow için `/admin/stocktake` ayrı sayfa (drawer + tam-sayfa, EKRAN-SAYIM.md), reverseButton 24h pencere + transfer pair atomik
**Bağımlılık:** TASARIM-SISTEMI · `stockMovementKeys` query cache · audit_logs (movement.created entry) · branch_inventory denormalize + product.totalStockQty SUM

---

### 5.4 super-admin.html (yenile)

**Doküman:** `EKRAN-SUPERADMIN.md` + `SUPERADMIN-YETKILERI.md` · **Kod:** [`src/app/admin/superadmin/`](../src/app/admin/superadmin/) — 7 alt URL

> **URL mimarisi (2026-05-14 onay + 2026-05-21 mockup fix):** Süperadmin **ayrı subdomain veya ayrı login DEĞİL** — `/admin/superadmin/*` alt route'lar, SUPERADMIN role'lü kullanıcı topbar'da "🛡 Süperadmin" linki görür. Süperadmin'in kendi tenant pano'su **YOK** — sadece süperadmin işleri yapar, tenant'a impersonate ile girer ("✕ Çıkış · Süperadmin'e dön" ile çıkar). Mockup `preview/super-admin.html` Faz 2'ye saklı.

**Ana sayfa (`/admin/superadmin`, [page.tsx](../src/app/admin/superadmin/page.tsx)):**
- `superadmin-hero` — başlık + felsefe banner (kişisel kontrol/müdahale, operasyonel müdür değil)
- 4-kolon KPI grid (toplam tenant + approved storefront + total users + total products)
- 4-kolon KPI grid 2 (24h movements + unread notifs + PRO subs + PRO+ subs)
- `vitrin-metrics` — 7g profile_view / product_view / listing_impression / whatsapp_click
- 2-kolon recent activity (audit son 5 + son aktif tenant son 5)
- `tenant-activity-metrics` — 7g top 5 tenant traffic (impressions + WA clicks)
- 2-kolon detail (en yeni tenant + top vitrin tenants)
- `db-stats` 2-kolon — DB size + connection count + capacity bar (`db-usage-bar`) + `top-tables` top 8 büyüklük
- `tenant-table` — 50 tenant tablosu (name + slug + plan + storefront status + users + products + branches + total stock + createdAt + impersonate buton `impersonate-${id}`)

**Tenant detay (`/admin/superadmin/tenant/[id]`, [page.tsx](../src/app/admin/superadmin/tenant/[id]/page.tsx)):**
- Header (name + plan + storefront_status)
- 5-kolon KPI grid (users + products + branches + total stock + last activity)
- `tenant-actions` — destructive (reset categories + impersonate + plan-override + hard-delete linkler)
- 2-kolon (`tenant-users` son 10 user + `tenant-audit` son 20 audit entry)
- `tenant-movements` — son 50 stok hareketi

**Vitrin Moderation (`/admin/superadmin/vitrin-moderation`, [page.tsx](../src/app/admin/superadmin/vitrin-moderation/page.tsx)):**
- 4-KPI grid (Manuel İnceleme bekleyen + Onaylanmış + Reddedilmiş + Auto-suspended)
- `moderation-tabs` — Manuel İnceleme / Şikayet Raporları (otomatik onay vurgusu — %X oto-onay)
- Reports tab: `reports-results` + `reports-filter-bar` + `reports-table` (company + product + report_type + status + reporter IP hash + reviewed_by + actions)
- Moderation tab: `moderation-results` + `moderation-table` (pending_review tenant'lar — onayla/reddet butonları)

**Errors (`/admin/superadmin/errors`, [page.tsx](../src/app/admin/superadmin/errors/page.tsx)):**
- 4-stat `error-stats` (Today / 7g / 30g critical / Toplam unresolved)
- `top-types` — en sık 5 error type (critical alert burst)
- `filters` — 7 filter (severity + type + resolved + date + user + tenant + search)
- `error-list` — son 100 system_errors entry + resolve toggle (PII stripped)

**DB Inspector (`/admin/superadmin/db-inspector`, [page.tsx](../src/app/admin/superadmin/db-inspector/page.tsx)):** SQL read-only inspector client + SQL execute (SUPERADMIN-only, audit log)

**System Settings (`/admin/superadmin/system-settings`, [page.tsx](../src/app/admin/superadmin/system-settings/page.tsx)):**
- `plan-tiers` — 3-tier B tablo (FREE 50 / **PRO 500 1.000₺ / PRO+ ∞ 2.000₺**, 2026-05-21 pricing son revize)
- `env-checks` — Brevo/iyzico/Nilvera/Telegram/Cloudflare key durumları
- 2-kolon — `db-extensions` (PostGIS/pg_trgm/moddatetime…) + Log retention kartı (6 TTL tablo + Sentry-replacement system_errors stat)

**6 Bypass aksiyon (`/admin/superadmin/bypass/*`):**
- `hard-delete` — tenant hard delete (audit + Telegram critical)
- `plan-override` — manuel plan up/downgrade
- `negative-stock` — eksi stok zorla onay
- `reverse-expired` — 24h sonrası movement geri al
- `stocktake-undo` — completed sayım geri al
- `metadata-fix` — JSON content alanları düzeltme

**Toolbox FAB** ([components/superadmin-toolbox.tsx](../src/components/superadmin-toolbox.tsx)) — sağ alt sticky FAB, 4 kategori yetki erişim (bypass / DB fix / sistem config / uzak kullanıcı)

**Bağımlılık:** TASARIM-SISTEMI · isSuperadmin gate her sayfa başında · impersonation cookie + banner · audit_logs (tüm aksiyonlar) · Telegram critical alert

---

### 5.5 auth.html (yenile)

**Doküman:** `EKRAN-AUTH.md` (15 bölüm + 52 test) · **Kod:** [`src/app/`](../src/app/) — login + register + 2fa-setup + verify-email + verify-email-change + forgot-password + reset-password + onboarding + account-locked

> **2026-05-21 brief sync:** Sprint 2 ve sonrası implementasyon tamamlandı (auth full flow browser end-to-end geçti). Mockup `preview/auth.html` Faz 2'ye saklı (Verdana güncel, son akışlar koda göre).

**Login (`/login`, [page.tsx](../src/app/login/page.tsx)):**
- Sol panel — logo + slogan + 🔒 KVKK uyumlu rozet
- Sağ form — email + şifre + `password-toggle` (göster/gizle)
- 2FA TOTP step — `twoFactorEnabled=true` ise banner görünür + 6-haneli kod input
- Recovery code upload — `recovery-upload-trigger` → `.txt` dosyasından kod parse (`extractRecoveryCodesFromText`) → `recovery-picker` ile birini seç (`recovery-picker-option`)
- Kalan hak banner — 3/2/1 hak zinciri (5. yanlışta lock + Brevo email + Telegram alert)
- **5+ başarısız sonrası Turnstile widget** (conditional)
- 🔒 Cloudflare Turnstile + ✓ KVKK uyumlu footer rozet

**Register (`/register`, [page.tsx](../src/app/register/page.tsx)):**
- Sol panel + sağ form (pet shop adı + email + şifre + şifre tekrar)
- **2 KVKK checkbox zorunlu** — Md.10 Aydınlatma onayı + Md.9 Frankfurt veri lokasyonu açık rıza
- **Turnstile widget zorunlu** (her register)
- Vergi no kayıt formunda **YOK** (2026-05-13 kararı)
- Submit → Brevo verify email (24h TTL) + /verify-email bekleme

**Email Verify (`/verify-email`, [page.tsx](../src/app/verify-email/page.tsx) + [[token]/](../src/app/verify-email/[token])):**
- Bekleme sayfası — "Yeniden Gönder" 60sn cooldown + spam klasör notu
- Token tıklama — başarılı/hatalı durum sayfası

**Forgot Password (`/forgot-password`, [page.tsx](../src/app/forgot-password/page.tsx)):**
- Email + **Turnstile zorunlu** + generic 200 (enumeration koruma)
- Lock bypass (account_locked iken bile şifre reset edebilir)
- Brevo reset email (30dk TTL)

**Reset Password (`/reset-password/[token]`):**
- Yeni şifre + tekrar + HIBP check + "Tüm oturumlar kapanacak" uyarı + Brevo passwordChanged final email
- failedLoginCount + lockedUntil reset

**2FA Setup (`/2fa-setup`, [wizard.tsx](../src/app/2fa-setup/wizard.tsx) — 3-step):**
- Step 1 — QR kod tara + manuel secret (otpauth URI + 10dk TTL setup secret)
- Step 2 — 6 haneli TOTP doğrula
- Step 3 — 8 recovery code ABCD-EFGH (clipboard copy + print + checkbox "Sakladım")
- `/admin/security` üzerinden disable + regenerate codes (Telegram alert)

**Email Change (`/admin/account` init + `/verify-email-change/[token]` confirm):**
- Init — password re-auth + new email + 2 Brevo email (yeni doğrula CTA + eski "İptal Et" CTA)
- Verify token — final değişiklik + eski email final notify
- Cancel token — Telegram critical alert (hesap ele geçirme şüphesi)

**Account Locked (`/account-locked`, [countdown.tsx](../src/app/account-locked/countdown.tsx)):**
- HH:MM:SS geri sayım + "Şifremi unuttum" alternatif CTA + permanent lock kırmızı variant + destek email

**Onboarding (`/onboarding`, [wizard.tsx](../src/app/onboarding/wizard.tsx) — 3-step):**
- Step 1 — İlk şube (ad + il cascade ilçe + adres + WhatsApp)
- Step 2 — İlk ürün opsiyonel/atla + `onboarding-import-brands-checkbox` (katalog seed marka 80+ aktive)
- Step 3 — Vitrin profili opsiyonel/atla (slug edit veya skip)
- `/?onboarding=complete` veya `/?onboarding=skipped-storefront` dashboard'a redirect

**Davet kabul (EKRAN-KULLANICILAR §4.4):** hibrit davet token tıklama (email 7g veya link 24h) → register sonrası company'ye join

**Cloudflare Turnstile bileşeni:** `@marsidev/react-turnstile`, TR locale, theme=light, size=normal, Managed mode.
**Brute-force:** 5 fail → 1h lock + Brevo email + Telegram alert + cookie state; 3 art arda lock → 24h kalıcı.
**Test sayısı:** 52 AUTH-* senaryosu (EKRAN-AUTH §13) — Sprint 2-2.9 hepsi yeşil.

---

### 5.6 subeler.html (yenile)

**Doküman:** `EKRAN-SUBELER.md` · **Kod:** [`src/app/admin/branches/`](../src/app/admin/branches/) — page.tsx + branch-form.tsx + branch-status-control.tsx + toggle-active-button.tsx + [id]/page.tsx + [id]/edit/ + new/ + export/

> **2026-05-21 brief sync:** Sprint 6 implementasyon + Faz 8 (Observer + 3-state branch) tamamlandı. Mockup `preview/subeler.html` **henüz yok** — Faz 2'ye saklı (lat/lng harita pin daha sonra eklenecek).

**Liste sayfası (`/admin/branches`, [page.tsx](../src/app/admin/branches/page.tsx)):**
- Header — "Admin · Şubeler" başlığı + sayı + `add-branch` "Yeni Şube" CTA
- Kart grid (3-kolon responsive) — her kart: name → edit link + `branch-status-${status}` rozet (🟢 Aktif / 🌴 Tatil / 🔴 Pasif) + 📍 city/district + 📞 WhatsApp + variant count + total stock + `ToggleActiveButton`
- Empty state — "Henüz şube yok" + ilk şube ekle CTA

**Yeni/düzenle form ([branch-form.tsx](../src/app/admin/branches/branch-form.tsx)):**
- `branch-name` + `branch-city` (81 il cascade) + `branch-district` (974 ilçe fetch + AbortController yarış kontrolü) + adres + WhatsApp `+90 / 0` prefix regex
- `branch-alert` validation hata + `branch-submit` PetSpinner pending
- Last-active koruma — son aktif şube pasifleştirilemez (transfer için en az 1 aktif kalmalı)

**Branch Status Control ([branch-status-control.tsx](../src/app/admin/branches/branch-status-control.tsx) — Faz 8):**
- 3-state radio (Aktif / Tatil / Pasif) — `branch-status-control-radio` + `status-radio-${s}` per state
- Quick buttons variant — `branch-status-control-buttons` + `status-quick-${s}`
- status=holiday + vitrin → "🌴 Tatildeyiz, şubat 30'da dönüyoruz" banner + WhatsApp disabled
- status=inactive + tüm şubeler → vitrin 404 (anyOperational=false guard)

**Detay sayfası (`/admin/branches/[id]`, [page.tsx](../src/app/admin/branches/[id]/page.tsx)):**
- Header — name + `branch-inactive-banner` (pasif uyarısı) veya `branch-holiday-banner` (tatil uyarısı)
- 4-kolon KPI grid
- `branch-team-card` — `branch-manager-block` (OBSERVER izleyici varsa rozet) + `branch-staff-block` + `branch-staff-rows` (kasiyer listesi) + `remove-manager-button`
- 2-kolon: `branch-variant-list` + `branch-variant-rows` (variant stok + threshold per branch) + `branch-movements` + `branch-movement-rows` (son 50 hareket)

**Export:** `/admin/branches/export` route → .xlsx

**Vitrin görünürlük:** lat/lng zorunlu **henüz aktif değil** (harita pin UI Faz 2'de eklenecek). Şu an city + district + adres yeterli.

**Bağımlılık:** TASARIM-SISTEMI · cities (81) + districts (974) seed · branch_status enum (active/holiday/inactive Migration 0021) · user_permissions tablo (OBSERVER read-only Faz 8) · branches/[id]/edit/page.tsx şube ekleme wizard 2-step "Çalışan ekle" (Faz 7)

---

### 5.7 sayim.html (yenile)

**Doküman:** `EKRAN-SAYIM.md` · **Kod:** [`src/app/admin/stocktake/`](../src/app/admin/stocktake/) — page.tsx (liste) + new/ (form) + [id]/ (workflow)

> **2026-05-21 brief sync:** Sprint 4.7 Guided Stocktake tamamlandı (browser smoke E2E geçti). Mockup `preview/sayim.html` **henüz yok** — Faz 2'ye saklı.

**Liste sayfası (`/admin/stocktake`, [page.tsx](../src/app/admin/stocktake/page.tsx)):**
- Header — "Admin · Sayım" + "Yeni Sayım Başlat" CTA → `/admin/stocktake/new`
- **Aktif sayımlar section** (status=in_progress) — kartlar: branch + mod + startedAt + counter (countedItems/totalItems progress bar gradient) + "Devam et →"
- **Geçmiş tablo** (status=completed | cancelled) — tarih + şube + counter + diffItems + valueImpact + status badge + reason emoji label TR
- Empty state — "Henüz sayım yok" + ilk sayım CTA

**Başlatıcı (`/admin/stocktake/new`, [form.tsx](../src/app/admin/stocktake/new/form.tsx)):**
- Form — şube select (aktif şubeler) + mod sabit "Tam" (kategori + manuel Faz 2'ye saklı) + opsiyonel note ≤500 char
- Submit → snapshot tüm aktif variant + branch_inventory leftJoin + bulk INSERT stocktake_items (transaction) + redirect `/admin/stocktake/[id]`

**Workflow (`/admin/stocktake/[id]`, [workflow.tsx](../src/app/admin/stocktake/[id]/workflow.tsx) — client tam-sayfa):**
- Header — başlık + branch + mod + status + closedAt + counter (countedItems/totalItems + diffItems + valueImpact)
- Filtre/arama section — 4 pill: tümü / sayılmadı / sayıldı / farklı + arama input
- Tablo section — ürün adı + variant label + systemQty + countedQty (large input + dirty state işareti) + diff (auto-calculated) + reason dropdown (loss/overage/wrong_entry/expired/damage/theft/other 7 enum + disabled if hasDiff=false) + customReason text "other" için
- Per-row Save buton — dirty olunca enabled + Enter handler ile submit (`updateStocktakeItemCount`)
- ✓/○ completed badge + isSkipped işareti
- Footer buttonlar — CompleteButton (has_uncounted reject + confirm + useTransition) + CancelButton (confirm + useTransition)
- Tamamlandı: ledger'a "📋 Sayım Catit XL 52→50 reason='Sayım: loss'" entries (her diff !== 0 item için stock_movements + branch_inventory upsert + product.totalStockQty SUM + auto-unpublish chain) + status='completed' + closedAt set + audit log

**Test:** 25 unit test (startStocktakeSchema 4 + updateItemCountSchema 4 + startStocktake 5 + updateStocktakeItemCount 4 + completeStocktake 4 + cancelStocktake 4)

**Yumuşak kilit (softLock):** schema'da var ama UI Faz 2'ye saklı (concurrent sayım çakışma çözümü)
**Bağımlılık:** TASARIM-SISTEMI · stocktakes + stocktake_items tablolar (Migration 0008) · stock_movements integration · auto-unpublish chain · audit_logs

---

### 5.8 dusuk-stok.html (yenile)

**Doküman:** `EKRAN-DUSUK-STOK.md` · **Kod:** [`src/app/admin/low-stock/page.tsx`](../src/app/admin/low-stock/page.tsx) (tek sayfa)

> **2026-05-21 brief sync:** Sprint 8+ Düşük Stok + transfer önerisi tamamlandı. Mockup `preview/dusuk-stok.html` **henüz yok** — Faz 2'ye saklı.

**Liste sayfası (`/admin/low-stock`):**
- Header — "Admin · Düşük Stok" + sayı (filtreli/toplam)
- `low-stock-filter` section — `ls-category` (kategori multi-select) + `ls-branch` (şube multi-select) + `ls-clear` temizle
- Empty state (tüm stoklar yeterli) — "Tüm stoklar yeterli ✓" + arrow renk + dashed border
- Liste — variant bazında grupla (aynı variant farklı şubelerde olabilir):
  - Grup kartı — productName + variantLabel + SKU
  - `stock-in-${variantId}` — "Stok girişi yap →" arrow link (stok-movements drawer auto-open)
  - `history-${variantId}` — variant geçmişi link
  - Branch grid — şube/stok / eşik kartı (sıfır stokta danger border + "Vitrin'den otomatik düşmüş olabilir" uyarı)
  - `transfer-suggestion-${variantId}` panel — `getTransferSuggestionsBulk` ile "Önerilen transfer X→Y +N adet" link + `open-transfer-${sourceBranchId}-${targetBranchId}` (stok-movements/transfer drawer query-param auto-open + prefill — tek tıkla)

**Bağımlılık:** TASARIM-SISTEMI · branch_inventory + productVariants + branches + branchThresholds jsonb · `getTransferSuggestionsBulk` helper · transfer drawer query-param prefill

---

### 5.9 tedarikciler.html (yenile)

**Doküman:** `EKRAN-TEDARIKCILER.md` · **Kod:** [`src/app/admin/suppliers/`](../src/app/admin/suppliers/) — page.tsx + supplier-form.tsx + toggle-supplier-active.tsx + new/ + [id]/ + export/

> **2026-05-21 brief sync:** Sprint 9 tedarikçi CRUD tamamlandı. Mockup `preview/tedarikciler.html` **henüz yok** — Faz 2'ye saklı.

**Liste sayfası (`/admin/suppliers`, [page.tsx](../src/app/admin/suppliers/page.tsx)):**
- Header — "Admin · Tedarikçiler" + sayı + `add-supplier` "Yeni Tedarikçi" CTA
- Tablo — Ad+contact + VKN mono + 📞 telefon + ✉ email + Lead gün + Ödeme koşulları emoji-label (💵 Peşin / 📆 30 gün / 📆 60 gün / ➕ Diğer) + Toplam giriş (SUM stock_movements stock_in subquery) + `toggle-supplier-active` (aktif/pasif soft delete)
- Empty state — "Henüz tedarikçi yok" + ilk ekle CTA

**Form ([supplier-form.tsx](../src/app/admin/suppliers/supplier-form.tsx), 4 section):**
- Firma — `supplier-name` + VKN/TC (10-11 hane regex) + slug auto
- İletişim — `+90` veya `0` prefix phone regex + email + adres + cityId
- Ticari koşullar — `leadTimeDays` (0-365) + paymentTerms enum (cash/net_30/net_60/other) + IBAN (TR + 24 hane regex) + opening_balance
- Not — internal_note ≤500 char
- `supplier-alert` validation hata + `supplier-submit` PetSpinner pending

**Detay (`/admin/suppliers/[id]`, ileride drawer veya ayrı sayfa olabilir) — şu an tablo'dan inline edit yeterli.**

**Export:** `/admin/suppliers/export` route → .xlsx

**Bağımlılık:** TASARIM-SISTEMI · suppliers tablo (supplier_payment_terms enum) · cities + districts seed · stock-movements stock_in → supplier dropdown dependency · Toplam giriş istatistiği SUM subquery

---

### 5.10 kullanicilar.html (yenile)

**Doküman:** `EKRAN-KULLANICILAR.md` · **Kod:** [`src/app/admin/settings/users/`](../src/app/admin/settings/users/) — page.tsx + invite-form.tsx + permissions-modal.tsx + actions.ts

> **2026-05-21 brief sync:** Sprint 9 + Faz 6 (Çalışan yetki modal 15 toggle) tamamlandı. URL `/admin/users` değil **`/admin/settings/users`** — settings sidebar grubunda. Mockup `preview/kullanicilar.html` **yok** — Faz 2'ye saklı.

**Liste sayfası (`/admin/settings/users`, [page.tsx](../src/app/admin/settings/users/page.tsx)):**
- `users-list` article — tablo:
  - Ad-soyad + email + rol badge (BAYI_ADMIN/OBSERVER/STAFF — TR etiket "Bayi Admin"/"İzleyici"/"Çalışan") + şube + status + son giriş
  - Bekleyen davet badge — invitePending (hasPassword=false) ise "Davet bekliyor · N gün kaldı" sarı / "Süre doldu" kırmızı + `inviteMethod` rozet (📧 Email / 🔗 Link)
  - Hover satırda — yetki modal aç + rol değiştir + yeniden davet

**Davet formu ([invite-form.tsx](../src/app/admin/settings/users/invite-form.tsx)):**
- `invite-email` + `invite-name` + `invite-role` (OBSERVER/STAFF dropdown) + `invite-branch` (rol=OBSERVER ise zorunlu, STAFF=opsiyonel)
- Davet yöntemi radio — 📧 E-posta (7 gün TTL, Brevo otomatik) / 🔗 Link (24 saat TTL, admin elden iletir)
- Submit sonrası link yöntemde → `invite-accept-url` modal (clipboard copy + uyarı)
- STAFF invite → `applyStaffDefaults` 3 ON yetki seed (`sale.create` / `variant.view` / `customer_ref.write`)

**Yetki modal ([permissions-modal.tsx](../src/app/admin/settings/users/permissions-modal.tsx) — Faz 6):**
- 15 yetki toggle (3 default ON STAFF + 12 OFF) — sale.create / sale.refund / variant.view / variant.edit / variant.create / customer_ref.write / stocktake.start / stock-in.create / stock-out.create / transfer.create / branch.edit / supplier.edit / report.view / audit.view / export.run
- updateUserPermissionsAction → user_permissions tablo + audit log

**Şube ekleme wizard 2-step (Faz 7):** `branches/new/step2-staff-invite.tsx` — "Çalışan ekle veya atla" SWAL uyarı (aynı inviteUserAction)

**Bekleyen kararlar — Yapı 2026-05-14:** STAFF = "kasiyer" terimi ile aynı. Bayi Admin (BAYI_ADMIN) = pet shop sahibi rol. Şube müdürü → OBSERVER (read-only) Faz 8 rename.

**Bağımlılık:** TASARIM-SISTEMI · users tablo (userRoleEnum + inviteMethodEnum + invitedById) · user_permissions tablo (Migration 0021) · Brevo invite email (7g TTL) · invite token (24h link TTL)

---

### 5.11 ayarlar.html (YENİ — Sprint 10 için)

**Doküman:** `EKRAN-AYARLAR.md` · **Kod:** [`src/app/admin/settings/`](../src/app/admin/settings/) + [`src/components/settings-shell.tsx`](../src/components/settings-shell.tsx) (sidebar layout shared)

> **2026-05-21 brief sync:** Sprint 2.10 SettingsShell + Sprint 10+ implementasyon tamamlandı. Mockup `preview/ayarlar.html` **yok** — Faz 2'ye saklı.

**SettingsShell ([settings-shell.tsx](../src/components/settings-shell.tsx)):** sol kalıcı sidebar nav (lg:sticky lg:top-6 desktop / mobile stack) + sağ içerik. 9 link:
- 📊 Genel Bakış (`/admin/settings`)
- 🏢 Firma (`/admin/settings/company`)
- 🌐 Vitrin Profili (`/admin/settings/storefront`)
- 👥 Kullanıcılar (`/admin/settings/users`) — §5.10
- 🔔 Bildirimler (`/admin/settings/notifications`)
- 👤 Hesap (`/admin/account`)
- 🛡 Güvenlik (`/admin/security`)
- 📜 Audit Log (`/admin/audit-log`)
- ⬇ Verilerimi İndir (`/admin/settings/export`)

`aria-current="page"` doğru aktif item highlight + `data-settings-link={key}` test selector.

**Sayfalar:**
- **Genel Bakış** (`/admin/settings`) — 4 StatusCard (Firma+VKN durumu / Hesap+pendingEmail / 2FA aktif/kapalı / Plan) + Veri yönetimi 4 DataLink (kategori/marka/şube/tedarikçi count)
- **Firma** (`/admin/settings/company`) — companyProfileSchema form: name + VKN/TC (10-11 hane regex VKN+TC) + whatsappPhone (+90/0 prefix) + cityId (1-81) + districtId (cascade); İlk vat_no eklenince `vatRequiredAt=now` set (Satışa Aç validation gate ile ilişki)
- **Vitrin Profili** (`/admin/settings/storefront`, [form.tsx](../src/app/admin/settings/storefront/form.tsx)) — slug edit + storefront açıklaması SEO helperText + logo + kapak + WhatsApp deep link + çalışma saatleri 7 gün + KVKK onay (Sprint 12)
- **Kullanıcılar** — §5.10 (`/admin/settings/users`)
- **Bildirimler** (`/admin/settings/notifications`, [telegram-form.tsx](../src/app/admin/settings/notifications/telegram-form.tsx)) — Telegram chat bağlama 3 adım (BotFather + chat_id + test mesaj) + bildirim tipi toggle (low_stock_critical/out_of_stock/high_sale/…)
- **Hesap** (`/admin/account`) — email değiştir collapsible form (password re-auth + new email + dual-email Brevo notify + İptal Et CTA Telegram critical)
- **Güvenlik** (`/admin/security`) — 2FA durum panel + disable + regenerate recovery codes
- **Audit Log** (`/admin/audit-log`) — read-only viewer (100 son satır + 26 action label emoji+TR + süperadmin badge + JSON afterState disclosure)
- **Verilerimi İndir** (`/admin/settings/export`) — KVKK Md.11 veri taşıma hub: 7 .xlsx export link (reports daily/top + audit-log + stock-movements + products + suppliers + branches)

**Plan + Fatura, Yerelleştirme, KVKK linkleri** — Faz 2'ye saklı (Sprint 13 iyzico billing sonrası + lansman öncesi). Plan tier 3-tier B (1.000/2.000) süperadmin system-settings'te görünür.

**Bağımlılık:** TASARIM-SISTEMI · SettingsShell sticky sidebar · `revalidatePath('/admin/products')` company update sonrası (Doğrula refresh) · audit_logs (company.vat_no_set ayrı action)

---

### 5.12 raporlar.html (yenile)

**Doküman:** `EKRAN-RAPORLAR.md` · **Kod:** [`src/app/admin/reports/page.tsx`](../src/app/admin/reports/page.tsx) (tek sayfa, çoklu section) + settle-credit-button.tsx + export/ route

> **2026-05-21 brief sync:** Sprint 11+ implementasyon tamamlandı. Mockup `preview/raporlar.html` **yok** — Faz 2'ye saklı. Drilldown ayrı detay sayfası yerine tek sayfa çoklu section (sade-tut).

**Liste sayfası (`/admin/reports`):**
- Header — "Admin · Raporlar" + `range-picker` (7g / 30g / 90g — URL `?days=`)
- 2 Export buton — `export-daily` (günlük satış xlsx) + `export-top` (top variant xlsx)
- 4-KPI grid — toplam adet + ciro + satış sayısı + ortalama sepet (TR locale formatlı)
- `period-comparison` section — önceki periyot vs şimdi karşılaştırma
- 5-kolon grid (3-2 split):
  - `daily-list` — 30g günlük satış çubuk grafik (date + count + revenue)
  - `top-list` — top 10 variant 🏆 sıralı (adet + ciro)
- **Sayım geçmişi** section — `stocktake-history-list` (son tamamlanan sayımlar + diff + valueImpact)
- **Audit aktivitesi** — `activity-actions` action count by type + bar chart + 3 KPI (son 30g)
- `inventory-value` section — envanter değeri trend chart
- `customers-report` section — KPI Veresiye / Veresiye Tahsil Oranı / hourly breakdown
- `open-credits` section (💳 Açık krediler — tüm zaman):
  - 4-KPI — Toplam açık tutar + N kayıt + en eski / en yeni
  - `open-credits-bands` — aging bands (0-30g / 31-60g / 61-90g / 90+g)
  - `open-credits-list` — açık veresiye satış tablo + `SettleCreditButton` (tahsil et action)

**Export:** `/admin/reports/export` route → .xlsx (daily veya top variant — `?type=daily|top`)

**Drilldown detay sayfası YOK** (önceki brief'te plan vardı, tek sayfa multi-section pattern daha sade — tek geliştirici sade-tut).

**6 rapor mapping:**
- Satış ✓ (daily-list + top-list + period-comparison)
- Kâr-Zarar — Faz 2'ye saklı (purchase price tracking deeper)
- En Çok Satan ✓ (top-list)
- Ölü Stok — `petpro-discount-suggestions` Pano'da (§5.1)
- Şube Karşılaştırma — Faz 2'ye saklı
- 💳 Açık Krediler ✓ (open-credits section)

**Bağımlılık:** TASARIM-SISTEMI · stock_movements (sale subtype + payment_method credit) · `getOpenCredits` helper + aging bands · `settleCredit` action (payment_method güncelle + customerRef hash) · audit_logs · vat_no (Doğrula gate)

---

### 5.13 vitrin-anasayfa.html (yenile)

**Doküman:** `EKRAN-PUBLIC-VITRIN.md §4` · **Kod:** [`src/app/vitrin/page.tsx`](../src/app/vitrin/page.tsx) + layout.tsx + cookie-banner.tsx + nearby-toggle.tsx + report-button.tsx + admin-return-link.tsx

> **2026-05-21 brief sync:** Sprint 12 vitrin tamamlandı. Mockup `preview/vitrin-anasayfa.html` 1093 satır (mevcut tasarım referansı — fakat brand-listings.tsx + nearby-map.tsx live data ile zenginleşmiş, kod canonical).

**Ana sayfa (`/vitrin`, [page.tsx](../src/app/vitrin/page.tsx)):**
- Layout — admin'den gelmişse "↩ Admin'e dön" link (`admin-return-link.tsx`)
- `vitrin-hero` section — `vitrin-hero-eye` (mascot) + başlık + `vitrin-hero-search` form (`vitrin-search-input` arama → `/vitrin/ara?q=`) + il select cascade + `vitrin-hero-logo-card`
- `vitrin-trust-strip` — KVKK uyumlu rozet + "WhatsApp deep link, biz sipariş almıyoruz" sade banner (para akışı çizgisi)
- `vitrin-nearby-section` — konum izni varsa Yakındaki pet shop'lar (`nearby-toggle`):
  - `vitrin-nearby-list` — 4 kart (mesafe + isim + WhatsApp + adres + storefront link)
  - `vitrin-nearby-map` — Leaflet harita pin'lerle (lazy load)
- `vitrin-popular-products` — son 7g popüler ürün cross-tenant (8 kart)
- `vitrin-best-sellers` — son 30g en çok satılan ürün cross-tenant
- `vitrin-city-grid` — 6 ana şehir grid + diğer şehir count link
- `vitrin-category-chips` — 6 ana kategori chip + diğer kategori count
- `vitrin-owner-cta` — Pet shop sahibi misin? FREE 50 ürün başla CTA → /register
- Footer + KVKK politika link + iletişim
- `cookie-banner` (KVKK opt-in; GDPR YOK — TR-only 2026-05-14)

**Alt sayfalar (Sprint 12):**
- `/vitrin/ara` ([ara/](../src/app/vitrin/ara)) — arama sonuçları (§5.14)
- `/vitrin/[il]` + `/vitrin/[il]/[ilce]` — il/ilçe sayfa
- `/vitrin/kategori/[slug]` — kategori sayfa
- `/vitrin/marka/[slug]` — marka sayfa
- `/vitrin/urun/[slug]` — ürün detay + cross-tenant kıyaslama (§5.15)
- `/vitrin/magaza/[slug]` — pet shop profili (§5.16)

**Önemli:**
- **Tek tema PetStockPro markası** (eski 5 hazır tema kaldırıldı)
- Tüm pet shop'lar eşit görünür (Karar A: sponsorship/rozet YOK)
- WhatsApp deep link `wa.me/...` — biz API kullanmıyoruz, sipariş almıyoruz, para akışında DEĞİLİZ
- `report-button.tsx` — ürün/pet shop için 🚩 şikayet butonu (vitrin_reports tablo)
- WhatsApp tıklama sonrası sticky feedback balonu (Sprint 12.10 — 5 emoji tek-tık submit, 1 IP × 1 tenant × 24h)

**Bağımlılık:** TASARIM-SISTEMI · vitrin_events tablo (KVKK anonim ipHash + city) · `getNearbyStorefronts` PostGIS + ST_DWithin · brand-listings.tsx · nearby-map.tsx Leaflet lazy · cities + districts seed

---

### 5.14 vitrin-arama.html (yenile)

**Doküman:** `EKRAN-PUBLIC-VITRIN.md §5-6` · **Kod:** [`src/app/vitrin/ara/page.tsx`](../src/app/vitrin/ara/page.tsx) + [`src/app/vitrin/[il]/`](../src/app/vitrin/[il])

> **2026-05-21 brief sync:** Sprint 12 implementasyon tamamlandı. Mockup `preview/vitrin-arama.html` **yok** — Faz 2'ye saklı.

**Arama sayfası (`/vitrin/ara`, [page.tsx](../src/app/vitrin/ara/page.tsx)):**
- Header — başlık + breadcrumb
- `vitrin-search-form` — `vitrin-search-input` (q) + `vitrin-search-city` (il dropdown 81 + slug) + `vitrin-search-category` (kategori dropdown DEFAULT_CATEGORIES + slug)
- Aktif filter chip'leri — `vitrin-search-clear-city` + `vitrin-search-clear-category` (tek tıkla kaldır)
- Empty states — `empty-no-query` (form sadece + öneri text) / `empty-no-result` (filtre eşleşmeyen)
- `search-results-grid` — ürün kartları (`search-result-card` her satır):
  - Ürün adı + variant label + fiyat (range veya tek)
  - Pet shop name + city/district (location string)
  - WhatsApp deep link buton + storefront link
- `search-pagination` — sayfa nav (prev/next + sayı)

**İl/ilçe sayfa (`/vitrin/[il]/page.tsx` + `/vitrin/[il]/[ilce]/page.tsx`):** aynı arama componenti, city/district pre-filter

**Kategori sayfa (`/vitrin/kategori/[slug]/page.tsx`):** kategori pre-filter

**Marka sayfa (`/vitrin/marka/[slug]/page.tsx`):** marka pre-filter (brand-listings.tsx referansı)

**Sıralama:** **Faz 2'ye saklı** — şu an default order (relevance / yeni eklenen). mesafe/fiyat sort harita+lat/lng aktif olunca geliyor.

**Harita opsiyonel:** Faz 2'ye saklı (vitrin-anasayfa'da nearby-map var, listede yok).

**Bağımlılık:** TASARIM-SISTEMI · `searchVitrinProducts` helper · cities + districts seed · vitrin_events search_query log (KVKK anonim)

---

### 5.15 vitrin-urun.html (yenile)

**Doküman:** `EKRAN-PUBLIC-VITRIN.md §7` · **Kod:** [`src/app/vitrin/urun/[slug]/page.tsx`](../src/app/vitrin/urun/[slug]/page.tsx) · **Helper:** `getCrossTenantProduct`

> **2026-05-21 brief sync:** Sprint 12 cross-tenant product page tamamlandı. Mockup `preview/vitrin-urun.html` **yok** — Faz 2'ye saklı.

**Ürün detay (`/vitrin/urun/[slug]`):**
- `cross-tenant-product-page` ana wrapper + SEO title `"{productName} — Fiyat kıyasla | PetStockPro Vitrin"`
- `product-hero` section — başlık (productName) + variant info + `price-range-summary` (min-max fiyat)
- "Ürün hakkında" section — açıklama + teknik bilgiler
- `offers-list` section — cross-tenant kıyaslama (her pet shop bir kart):
  - Pet shop name + city/district + mesafe (konum varsa)
  - Stok durumu rozet (var/yok) + fiyat
  - Variant count (`{N} variant`)
  - `offer-detail-${companyId}` link (storefront'a)
  - `offer-wa-${companyId}` — WhatsApp deep link (referans kodu YOK — para akışı çizgisi 2026-05-14 K2-a)
- `only-one-offer-note` — tek pet shop satıyorsa "fiyat kıyası için diğer pet shop'ları gözlemleyin" mesaj
- "Neden bu sırada" link → algoritma açıklama modal **Faz 2'ye saklı**
- Aynı kategoriden öneriler — 4 kart (cross-tenant)
- `report-button.tsx` 🚩 şikayet (vitrin_reports tablo)

**Para akışı vurgusu:** WhatsApp deep link `wa.me/{phone}?text=...` — biz aracı DEĞİLİZ. "Vitrin referans kodu" Karar B (a) ile **eklenmedi** (sade-tut).

**Bağımlılık:** TASARIM-SISTEMI · `getCrossTenantProduct` helper (product+variant+stock+pet shop aggregate) · vitrin_events product_view + whatsapp_click log · report-button

---

### 5.16 vitrin-magaza.html (yenile)

**Doküman:** `EKRAN-PUBLIC-VITRIN.md §8` · **Kod:** [`src/app/vitrin/magaza/[slug]/page.tsx`](../src/app/vitrin/magaza/[slug]/page.tsx) + feedback-balloon.tsx + whatsapp-link-script.tsx + [slug]/urun/

> **2026-05-21 brief sync:** Sprint 12 + Faz 8 (branch holiday banner) tamamlandı. Mockup `preview/vitrin-magaza.html` **yok** — Faz 2'ye saklı.

**Pet shop profili (`/vitrin/magaza/[slug]`):**
- SEO — `ld-local-business` (LocalBusiness JSON-LD schema.org) + `ld-breadcrumb`
- `back-link` — geri navigation
- `storefront-holiday-banner` — tüm aktif şubeler tatildeyse "🌴 Tatildeyiz, dönüş tarihi: ..." banner (Faz 8)
- `storefront-hero` — kapak fotoğrafı + logo + `data-storefront-name` başlık + `storefront-holiday-badge` (kısmi tatil) + `hero-whatsapp` ana WhatsApp link
- `storefront-about` — Hakkımızda metni
- `contact-grid` — 3-kolon (adres + saatler + WhatsApp/telefon)
- `products-section`:
  - `brand-groups` — marka bazında grupla
  - `brand-anchor-nav` — marka chip'leri (sayfa içi anchor scroll)
  - Ürün grid (sadece bu pet shop'un vitrin'e açtığı ürünler)
- `storefront-report-section` — `report-button` 🚩 (vitrin_reports tablo)
- `feedback-balloon.tsx` — WhatsApp tıklama sonrası sağ alt sticky 5 emoji feedback balonu (Sprint 12.10 + 2026-05-15 onay):
  - 😊/🙂/😐/😕/😞 tek-tık submit (submit buton YOK)
  - Anti-spam: 1 IP × 1 tenant × 24h
  - Closed manually + dismissed bile değerli sinyal (counter felsefesi)
- `whatsapp-link-script.tsx` — WA click track + feedback balloon trigger
- Şube seçici dropdown (multi-branch) — Faz 2'ye saklı (şu an ana adres yeterli)
- Çalışma saatleri 7 gün tablo — `contact-grid`'de özet, detay Faz 2

**Bağımlılık:** TASARIM-SISTEMI · `getStorefrontProfile` + `getStorefrontProducts` helper · vitrin_whatsapp_feedback tablo (1y retention) · vitrin_events whatsapp_click + balloon_event log · branch_status (Faz 8 holiday banner)

---

### 5.17 vitrin-ana-petstockpro.html (yenile)

**Kapsam:** SaaS landing (`petstockpro.com/`) — pet shop sahibi geldiğinde gördüğü sayfa · **Kod:** [`src/app/page.tsx`](../src/app/page.tsx) + [`src/app/fiyatlar/page.tsx`](../src/app/fiyatlar/page.tsx)

> **2026-05-21 brief sync:** Sprint 0+ landing tamamlandı. Mockup `preview/vitrin-ana-petstockpro.html` **yok** — implementli, mockup'a gerek kalmadı.

**Ana sayfa (`/`, [page.tsx](../src/app/page.tsx) — login değil/onboarded değil ise gösterilir):**
- Hero section — başlık + FREE'den başla CTA + mascot
- 3 değer önerisi (KPI özet — stok takip + vitrin + WhatsApp)
- Nasıl çalışır section
- Plan tablosu özet (FREE 50 / PRO 500 / PRO+ ∞) → /fiyatlar detay
- Son CTA — kaydol

**Fiyatlar sayfası (`/fiyatlar`, [page.tsx](../src/app/fiyatlar/page.tsx)):**
- `plan-${key}` 3 plan kartı (FREE / PRO / PRO_PLUS):
  - **FREE: 0 ₺/ay** — 50 ürün
  - **PRO: 1.000 ₺/ay (KDV dahil)** — 500 ürün (2026-05-21 son revize)
  - **PRO+: 2.000 ₺/ay (KDV dahil)** — Sınırsız ürün (2026-05-21 son revize)
  - Tek farklılaşma stok limiti — diğer tüm özellikler her planda açık (vitrin / çoklu şube / audit / 2FA / asistan / raporlar / Nilvera e-Arşiv)
- SSS section + iyzico + Nilvera açıklama

**Auth + onboarded user için:** `/` ana sayfa kontrol → `/admin` redirect (auth.ts gate).

**Bağımlılık:** TASARIM-SISTEMI · `planLimitDisplay` constant · iyzico billing flow (Sprint 13 sonrası aktif) · /mesafeli-satis-sozlesmesi + /kvkk-aydinlatma-metni linkleri

---

## 6. Brief Şablonu (Harici Tool için — Claude.ai / v0 / Lovable)

Eğer (b) Claude.ai artifacts veya (c) v0/Lovable ile yapmak istersen, her ekran için bu prompt şablonunu kullan:

```
PetStockPro pet shop SaaS uygulaması için [EKRAN ADI] mockup HTML/CSS oluştur.

DESIGN SYSTEM (zorunlu):
- Font: Verdana, Geneva, Tahoma, sans-serif (sistem font, Google Fonts YOK)
- Renk paleti (CSS variables):
  --cat: #d4621c (turuncu, CTA)
  --cart: #1e3a5f (lacivert, primary)
  --arrow: #22c55e (yeşil, success)
  --bars: #7cb8e0 (açık mavi, info)
  --dog: #2c4257 (antrasit, neutral)
  --danger: #ef4444
- Border radius: 8/12/18/24/32px
- Stil: Glass morphism (backdrop-filter blur) + mesh gradient background +
        paw pattern (subtle %2.5 opacity) + hayvan mascot (kedi+köpek illustration)
- Layout: Sidebar 240px sol fixed + topbar 64px sticky glass + content 1280px max

İÇERİK (referans dokümana sadık):
[Buraya ilgili EKRAN-XXX.md doküman içeriğini yapıştır — bileşen listesi + data örnek + etkileşim]

ÖZEL KURALLAR:
- Plan tier: 3-tier B (2026-05-14) — FREE 50 ürün / PRO 500 ürün 750₺ / PRO+ Sınırsız 1.750₺ (KDV dahil)
- TR-only — Paddle/USD/EUR/EN locale kapsam dışı
- Vitrin: merkezi tek (petstockpro.com/vitrin), tenant subdomain YOK
- WhatsApp deep link (wa.me/...), biz API kullanmıyoruz
- Türkçe arayüz
- Sample data: Mavi Pet Shop, Royal Canin, Whiskas, Üsküdar/Kadıköy

ÇIKTI:
Tek HTML dosyası, inline CSS, ~2500-3000 satır. JavaScript minimal (interaktif olmayan mockup).
```

---

## 7. Karar Soruları

Senden 3 net karar bekliyorum:

### Karar 1 — Yapım yaklaşımı
- (a) **Bana yaptır** (Claude Code, sırasıyla mockup üretirim)  ← önerim
- (b) Claude.ai artifacts (sen oraya prompt yapıştırırsın)
- (c) v0.dev / Lovable (React component üretir, mockup için fazla)

### Karar 2 — Yapım sırası
- (i) **Önce 4 mevcut güncel** (Verdana + son kararlar) → sonra eksikler — en sade ✅
- (ii) Önce eksik admin'ler (auth, subeler, sayim...) → sonra mevcut güncelle
- (iii) Önce vitrin (5 sayfa) → sonra admin

### Karar 3 — Tek seferde mi parça parça mı?
- (A) Tek seferde 17 mockup'ı plan dosyasına yaz, sırayla yap (uzun bir dizi turn)
- (B) **Sprint sırasına göre yap** — Sprint 0'dan önce sadece Faz 1 (mevcut 4 güncel), sonra her sprint başında ilgili mockup ✅
- (C) Sadece kritik 5-6 ekran (Pano / Ürünler / Auth / Vitrin Anasayfa / Vitrin Ürün Detay / Vitrin Pet Shop Profili) — gerisi sprint'te yap

---

## 8. Sıradaki Adım

Karar 1 + 2 + 3'ü onaylarsan başlıyorum. Önerim: **(a) Bana yaptır + (i) Mevcut 4 güncel önce + (B) Sprint sırasına göre**.

Bu durumda ilk turn'de: `pano.html` Verdana + son kararlarla yenilenir. Sonraki turn `urunler.html`. Toplam ~14 turn'de hepsi hazır olur, ama her sprint öncesi sırayla yapılırsa daha sağlıklı (her sprint'in başında ilgili mockup baz alınır, düzeltmeler kod yazılırken yapılır).

---

*Son güncelleme: 2026-05-14. Brief + tool karar + prompt şablonu hazır.*
