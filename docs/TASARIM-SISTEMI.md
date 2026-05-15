# PetStockPro — Tasarım Sistemi

**Tarih:** 2026-05-12
**Durum:** Onaylanmış tasarım kararları
**Referans:** `D:/Projeler/mockup-admin-premium-v3.html` (Premium Showcase)
**Felsefe:** *"Premium arka plan + klasik tipografi"* — glass/mesh/mascot premium dili Verdana'nın klasik okunabilirliği üzerine oturur.

---

## 1. Tipografi Sistemi

### 1.1 Font: **Verdana (saf)**

```css
--font-sans: Verdana, Geneva, Tahoma, sans-serif;
--font-mono: Consolas, "Lucida Console", Monaco, monospace;
```

**Neden Verdana:**
- Sistem font — yükleme süresi 0
- Ekran okunabilirliği çok yüksek (geniş x-height)
- Her platformda mevcut (web-safe)
- Türk kullanıcı için tanıdık (Word, Outlook)
- Türkçe karakter desteği tam (ş, ğ, ç, ı, İ, ö, ü)

**Tasarım gerekliliği:** Verdana karakter genişliği geniş olduğu için boyutları mockup'tan **küçültüldü**. Aksi halde header'lar overflow eder.

### 1.2 Boyut Skalası (Verdana'ya göre kalibre)

| Token | Boyut | Weight | Kullanım | Mockup karşılığı |
|---|---|---|---|---|
| `--fs-xs` | 10.5px | 700 | Caption, eyebrow, badge | 10-11px Mono/Sans |
| `--fs-sm` | 11.5px | 500 | Sub-label, meta, footer | 11-12px |
| `--fs-base` | 13px | 400 | Body, paragraph | 13.5-14px |
| `--fs-md` | 14px | 600 | Form input, button | 13.5-14px |
| `--fs-lg` | 16px | 700 | Card title | 17px Fraunces |
| `--fs-xl` | 20px | 700 | Section heading | 24-28px |
| `--fs-2xl` | 26px | 800 | Page title, hero greet | 38px Fraunces |
| `--fs-kpi-sm` | 28px | 700 | Small KPI value | 36px Fraunces |
| `--fs-kpi-lg` | 42px | 800 | Big KPI value | 52px Fraunces |

**Letter-spacing:**
- Body: `0` (default)
- Caption/eyebrow: `0.06em` (uppercase tracking)
- Headings: `-0.01em` (slight tightening)
- KPI values: `-0.02em`

**Line-height:**
- Body: `1.55`
- Headings: `1.15`
- KPI values: `1.0`

### 1.3 Font Weight Skalası

```
400 (Regular)  → Body text, paragraph
500 (Medium)   → Sub-label, button-secondary
600 (Semibold) → Card title, navigation item
700 (Bold)     → Heading, KPI label, badge
800 (Extrabold)→ Page title, KPI value, brand wordmark
```

Verdana 800 weight çok güçlü — sadece marka wordmark ve büyük KPI'larda.

### 1.4 Brand Wordmark

```html
<span class="wordmark">
  <span class="ps">PetStock</span><span class="pro">Pro</span>
</span>
```

```css
.wordmark { font-family: var(--font-sans); font-size: 20px; font-weight: 800; letter-spacing: -0.025em; }
.wordmark .ps { color: var(--cart); }
.wordmark .pro { color: var(--arrow); }
```

İki tonlu logo: **PetStock** lacivert + **Pro** yeşil. Verdana 800 Bold yeterli karakter veriyor (Fraunces serif gerekmez).

---

## 2. Renk Sistemi

### 2.1 Logo Paleti — 5 Semantik Tema

Her renk için 5 ton var: ana, açık (-2), koyu (-700), soft arka plan (-soft), dark mode soft.

```css
:root {
  /* CAT — turuncu (CTA, accent) */
  --cat:       #d4621c;
  --cat-2:     #ed7d2f;
  --cat-700:   #b8530f;
  --cat-soft:  #fdf2e9;

  /* CART — lacivert (primary, sidebar, başlık) */
  --cart:      #1e3a5f;
  --cart-2:    #2a4f7a;
  --cart-700:  #16304d;
  --cart-soft: #e8eef6;

  /* ARROW — yeşil (success, büyüme, indirim) */
  --arrow:     #22c55e;
  --arrow-2:   #4ade80;
  --arrow-700: #16a34a;
  --arrow-soft:#ecfdf5;

  /* BARS — açık mavi (info, chart, transfer) */
  --bars:      #7cb8e0;
  --bars-2:    #98c9e8;
  --bars-700:  #4d8fb8;
  --bars-soft: #eaf3fa;

  /* DOG — antrasit (neutral dark) */
  --dog:       #2c4257;
  --dog-2:     #41607d;
  --dog-soft:  #e6ebf0;

  /* Sistem renkleri */
  --danger:      #ef4444;
  --danger-soft: #fef2f2;
  --warning:     #f59e0b;
}
```

### 2.2 Yüzey ve Metin (Light)

```css
:root {
  --bg:        #f7f5f0;  /* sıcak krem — Linear/Anthropic Claude feel */
  --bg-warm:   #fbf8f3;
  --surface:   #ffffff;
  --surface-2: #f3f0ea;
  --surface-3: #e8e3d8;

  --glass-bg:     rgba(255, 255, 255, 0.65);
  --glass-border: rgba(255, 255, 255, 0.5);
  --glass-shadow: 0 8px 32px rgba(30, 58, 95, 0.08);

  --text:    #0e1a2b;  /* başlık, KPI */
  --text-2:  #50627a;  /* body, sub-label */
  --text-3:  #8b9bb1;  /* caption, meta, placeholder */

  --border:        rgba(30, 58, 95, 0.08);
  --border-strong: rgba(30, 58, 95, 0.16);
}
```

### 2.3 Dark Mode Override

```css
[data-theme="dark"] {
  --bg:        #07101e;
  --bg-warm:   #0c1828;
  --surface:   #111c2f;
  --surface-2: #182438;
  --surface-3: #213048;

  --glass-bg:     rgba(17, 28, 47, 0.6);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);

  --text:    #f0f5fb;
  --text-2:  #94a3b8;
  --text-3:  #64748b;

  /* Soft renk arka planları dark için ayarlanır */
  --cart-soft:  #15233a;
  --cat-soft:   #2a1808;
  --arrow-soft: #042818;
  --bars-soft:  #0e2030;
  --dog-soft:   #1a2335;
}
```

### 2.4 Renk Anlam Atlası

| Renk | Semantik anlam | Örnek kullanım |
|---|---|---|
| Cart (lacivert) | Primary, marka çerçevesi | Sidebar, başlıklar, kart üst bordürü, button-cart |
| Cat (turuncu) | CTA, vurgu, sipariş | Hero CTA, "Sipariş ver", focus ring, urgent badge |
| Arrow (yeşil) | Pozitif, başarı, indirim | Trend up, success toast, indirim tag, canlı dot |
| Bars (mavi) | Bilgi, transfer | Chart bars, info toast, transfer tag |
| Dog (antrasit) | Neutral, sayım | Sayım icon, neutral badge |
| Danger | Tehlike, kritik stok | Empty stock, hata mesajı, kritik dot |
| Warning | Uyarı, SKT yaklaşıyor | SKT badge, plan limit %80+ |

---

## 3. Spacing, Radius, Shadow

### 3.1 Border Radius

```css
--r-xs:   8px;   /* küçük badge, input, alt eleman */
--r-sm:   12px;  /* button, küçük kart */
--r:      18px;  /* drawer, modal, ana kart */
--r-lg:   24px;  /* bento card, panel */
--r-xl:   32px;  /* hero card */
--r-pill: 999px; /* badge, chip, segmented button */
```

### 3.2 Shadow Skalası

```css
--shadow-sm: 0 1px 3px rgba(14, 26, 43, .06);
--shadow-md: 0 8px 28px rgba(14, 26, 43, .09);
--shadow-lg: 0 24px 64px rgba(14, 26, 43, .15);

/* Renkli gölgeler (CTA için) */
--shadow-cat:   0 12px 32px -8px rgba(212, 98, 28, 0.4);
--shadow-cart:  0 12px 32px -8px rgba(30, 58, 95, 0.35);
--shadow-arrow: 0 12px 32px -8px rgba(34, 197, 94, 0.35);
```

### 3.3 Spacing (Tailwind v4 default)

`p-2, p-3, p-4, p-5, p-6, p-8` standart. Kart içi padding `22px` (mockup), Tailwind'de `p-[22px]` veya `p-5`.

---

## 4. Visual Zenginlik Katmanları

### 4.1 Mesh Gradient Background (Animasyonlu)

4 animasyonlu blob fixed pozisyonda, `z-index: -1`. Subtle pastel renkler — sayfa üzerinde **soft glow** etkisi.

```css
.mesh-bg { position: fixed; inset: 0; z-index: -1; pointer-events: none; }
.mesh-blob {
  position: absolute;
  width: 640px; height: 640px;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.45;  /* dark mode'da 0.28 */
}
```

**4 blob renkleri:**
- Blob 1 (sol üst): Lacivert (cart) — 22s loop
- Blob 2 (sağ üst): Turuncu (cat) — 26s loop
- Blob 3 (sol alt): Açık mavi (bars) — 30s loop
- Blob 4 (orta): Yeşil (arrow) — 34s loop, daha küçük (420px)

**`prefers-reduced-motion: reduce`** durumunda blob'lar **statik** (animasyon yok).

### 4.2 Paw Print Pattern

Subtle SVG repeat pattern, `z-index: -1`, **opacity 0.025**.

```css
.paw-pattern {
  position: fixed; inset: 0; z-index: -1;
  background-image: url("data:image/svg+xml;...");
  /* SVG: 30,30 ve 90,80 koordinatlarında pati izi */
}
```

Light mode: lacivert (`#1e3a5f` fill-opacity 0.025)
Dark mode: beyaz (fill-opacity 0.018)

### 4.3 Glass Morphism

Sidebar, Topbar, Bento kartları, Hero Snapshot widget'ı için:

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}
```

**Browser uyumluluğu:** Safari 14+, Chrome 76+, Firefox 103+. Edge eski sürümlerde `backdrop-filter` çalışmazsa fallback yüksek opaklık (`rgba(255,255,255,0.95)`).

### 4.4 3D Tilt (Bento Cards)

Mouse hover'da kart eğilir (perspective 1200px, ±6deg).

```js
card.addEventListener('mousemove', (e) => {
  const r = card.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  const rx = (0.5 - y) * 6;
  const ry = (x - 0.5) * 6;
  card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
});
```

**Disable koşulları:**
- Viewport < 1024px (touch device)
- `prefers-reduced-motion: reduce`

### 4.5 Hayvan Watermark (Bento Cards)

Her bento kartının sağ alt köşesinde subtle SVG mascot (opacity 0.07, hover'da 0.14).

```css
.animal-watermark {
  position: absolute;
  bottom: -8px; right: -8px;
  width: 110px; height: 110px;
  opacity: 0.07;
  pointer-events: none;
  transition: opacity 280ms ease, transform 280ms ease;
}
.b-card:hover .animal-watermark {
  opacity: 0.14;
  transform: scale(1.06) rotate(-3deg);
}
```

**Watermark hayvanları kart temasına göre:**
- tone-cat → kedi SVG (turuncu)
- tone-dog → köpek SVG (antrasit)
- tone-arrow → büyüme oku
- tone-bars → barkod/çubuk

---

## 5. Animasyon Sistemi

### 5.1 Easing Tokens

```css
--ease:        cubic-bezier(.22, .61, .36, 1);    /* standart */
--ease-bounce: cubic-bezier(.5, 1.6, .4, 1);      /* spring/bounce */
--dur-fast:    160ms;
--dur:         280ms;
--dur-slow:    520ms;
```

### 5.2 Animasyon Katalogu

| Animasyon | Kullanım | Süre |
|---|---|---|
| `blobMove1-4` | Mesh gradient blobs | 22-34s loop |
| `pulseDot` | Canlı dot (current page, dikkat bandı) | 2s loop |
| `livePulse` | Realtime indicator (yeşil halka) | 1.6-2s loop |
| `barSweep` | Progress bar shimmer | 2.4s loop |
| `ctaSweep` | CTA button shimmer | 2.8s loop |
| `markSheen` | Sidebar logo parlama | 5s loop |
| `mascotBob` | Plan card kedi bob | 3s loop |
| `floatA` | Empty state mascot float | 3.4-4s loop |
| `heartBeat` | Empty state kalp atışı | 1.6s loop |
| `sparkle` | Empty state ışıltı | 1.5s loop |
| `wave` | Hero greeting 👋 | 2.8s loop |
| `heroIn` | Hero card açılış | 520ms |
| `bentoIn` | Bento card cascade | 520ms stagger 70ms |
| `snapIn` | Snapshot widget slide-in | 520ms delay 120ms |
| `drawLine` | Chart line draw | 1.6s |
| `ptPop` | Chart point pop | 400ms bounce |
| `ringFill` | Circular progress | 1.4s |
| `gaugeFill` | Gauge dolum | 1.6s bounce |
| `snapBarFill` | Snapshot bar fill | 1.2s stagger 120ms |
| `barRise` | KPI mini bar chart | 520ms stagger |
| `numTicker` | Sayı animasyonu | 1.4s (IntersectionObserver) |

### 5.3 prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .mesh-blob { animation: none; }
  .b-card.tilt:hover { transform: none; }
}
```

---

## 6. Layout Sistemi

### 6.1 App Shell

```
┌────────┬──────────────────────────────┐
│        │  Topbar (64px, sticky, glass)│
│ Side   ├──────────────────────────────┤
│ bar    │                              │
│ 248px  │  Main (scrollable)           │
│ sticky │   ├ Hero                     │
│ glass  │   ├ Alerts strip             │
│        │   ├ Bento grid (12 col)      │
│        │   └ Drawer + ⌘K palette      │
└────────┴──────────────────────────────┘
```

### 6.2 Bento Grid (12 kolon)

```css
.bento {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 18px;
  padding: 22px 24px;
}
.col-3 { grid-column: span 3; }
.col-4 { grid-column: span 4; }
.col-5 { grid-column: span 5; }
.col-7 { grid-column: span 7; }
.col-8 { grid-column: span 8; }
.col-12 { grid-column: span 12; }
```

### 6.3 Responsive Breakpoints

| Breakpoint | Kural |
|---|---|
| `>= 1280px` | Full layout (sidebar 248px + bento 12-col) |
| `1024-1279px` | Bento kollar daha geniş (col-3→4, col-5→6) |
| `768-1023px` | Sidebar daralır (72px icon-only), bento col-6→12 |
| `< 768px` | Sidebar gizli (☰ menü, bottom-sheet), bento 1-col, hero stack |

---

## 7. Component Sistemi (shadcn/ui üzerine)

### 7.1 Buton Varyantları

```tsx
<Button variant="cat">     // Primary CTA, turuncu gradient
<Button variant="cart">    // Secondary, lacivert gradient
<Button variant="outline"> // Bordürlü, surface bg
<Button variant="ghost">   // Şeffaf, hover'da surface-2
```

### 7.2 Bento Card

```tsx
<BentoCard
  tone="cat" | "arrow" | "bars" | "dog"  // Renk teması
  size="col-3" | "col-4" | "col-5" | "col-7" | "col-8" | "col-12"
  tilt={true}            // 3D mouse tilt
  watermark="cat" | "dog" | "arrow" | "bars" | null
>
  <BentoCardHead title="..." subtitle="..." />
  <BentoCardBody>...</BentoCardBody>
</BentoCard>
```

### 7.3 KPI Card

```tsx
<KPICard
  variant="big" | "small"        // Big = 5-col Envanter Değeri tarzı
  tone="cat" | "arrow" | "bars" | "dog"
  label="Bugün Satış"
  value={4820}
  prefix="₺"
  suffix=""
  trend={+12}                    // Trend pill +%12
  sparkline={[30, 55, 42, 68, 52, 78, 88]}
  watermark="cat"
/>
```

### 7.4 Empty State (Mascot)

```tsx
<EmptyState
  mascot="cat+dog"               // Mockup'taki kedi+köpek+kalp
  title="Hepsi yolunda!"
  description="Kritik stoğu tükenen ürün yok..."
  action={<Button variant="outline">Ürünleri görüntüle</Button>}
/>
```

### 7.5 Drawer (Hızlı Stok Girişi vs.)

```tsx
<Drawer
  open={open}
  onOpenChange={setOpen}
  side="right"
  width="480px"
  title="Hızlı Stok Girişi"
  subtitle="Yeni stok hareketi kaydet — ⌘ Enter ile gönder"
>
  {/* form fields */}
  <DrawerFoot>
    <Button variant="ghost">İptal</Button>
    <Button variant="cat">Kaydet</Button>
  </DrawerFoot>
</Drawer>
```

### 7.6 Command Palette (⌘K)

```tsx
<CommandPalette
  open={open}
  groups={[
    { name: "Eylemler", items: [...] },
    { name: "Sayfalar", items: [...] },
    { name: "Ürünler", items: [...] },  // search ile dolu
  ]}
/>
```

### 7.7 Sidebar Plan Card

```tsx
<PlanCard
  plan="FREE" | "PRO" | "PRO_PLUS"  // 3-tier B (2026-05-14, TR-only) — YT-7
  used={47}
  limit={50}                         // FREE: 50, PRO: 500, PRO_PLUS: null (sınırsız)
  showMascot={true}                  // Kedi bob animasyonu
  upgradeUrl="/admin/settings/plan"
/>
```

---

## 8. Mockup'tan Korunan Yeni Özellikler

### 8.1 PetPro Asistanı (Akıllı Öneriler) — MVP'de aktif

**Lokasyon:** Pano'da Bento col-7 kart
**Mantık:** Rule-based (AI değil)
**3 öneri tipi:**

| Tip | Trigger | Aksiyon |
|---|---|---|
| 🐱 **Sipariş** (tag-order, cat color) | Stok < eşik AND satış hızı > 0 | "X adet öner" → Stok Girişi drawer pre-filled (son tedarikçi) |
| 🔄 **Transfer** (tag-trans, bars color) | Şube A bol AND Şube B kıt (variant level) | "Transfer aç" → Transfer drawer pre-filled |
| 🏷 **İndirim** (tag-discount, arrow color) | SKT < 30 gün AND stok > 0 | "İndirim oluştur" → İndirim modali (%X) |

**UI yapısı:**
```
[🐾 Asistan ikon] PETPRO ASİSTANI · "4 yeni" badge
Bugün için 4 akıllı öneri
Satış hızı, SKT ve transfer fırsatlarına göre

┌─────────────────────────────────────────────┐
│ [icon] [Tag] Ürün adı           [Aksiyon]   │
│        Sebep: ...                            │
├─────────────────────────────────────────────┤
│ ... 3 öneri ...                              │
└─────────────────────────────────────────────┘

[Tüm önerileri gör (N) →]
```

### 8.2 Büyük KPI Kartı — MVP'de aktif

**Pano KPI düzeni:** 1 büyük (Envanter Değeri) + 3 küçük (Bugün Satış / Stok Girişi / Aktif Ürün) = **toplam 4**.

**Büyük KPI (col-5):**
```
ENVANTER DEĞERİ · GERÇEK ZAMANLI
₺152.400  (42px Verdana 800)
[+%3.2 trend pill] geçen haftaya göre · 3 şube toplam
[mini bar chart sağ alt 56px height]
```

Lacivert gradient bg (`--cart` → `--dog`), bars renkli radial glow.

**Küçük KPI (col-3 veya col-4):**
- Bugün Satış (tone-cat, 4820₺, +%12 sparkline)
- Stok Girişi (tone-bars, 87 adet, "3 tedarikçi")
- Aktif Ürün (tone-arrow, 18/20, ring progress, "Limit'e 2 ürün kaldı")

### 8.3 ÇIKARILAN: Hero Snapshot Widget

**Karar:** Hero hafif tutulur — sadece greeting + meta + 2 CTA + 3 hero stats pill. Mockup'taki "Bugünkü Hedef + Şube Performansı" widget MVP'de **YOK**.

**Neden:** Tenant'ın günlük hedef belirleme özelliği ek Settings + backend gerek. MVP scope azaltıldı.

---

## 9. Empty State Sistemi

Tüm "boş veri" ekranlarında mascot illustration kullanılır:

| Ekran | Boş durum | Mascot tema | Mesaj |
|---|---|---|---|
| Pano düşük stok widget | Hiç düşük stok yok | Kedi+köpek+kalp | "Hepsi yolunda!" |
| Ürünler | İlk ürün eklenmedi | Kedi+barkod | "İlk ürününü ekle" |
| Stok Hareketleri | İlk hareket yok | Kedi+ok | "+ Yeni Hareket ile başla" |
| Düşük Stok | Hiç düşük yok | Köpek mutlu | "Tüm stok sağlam!" |
| Sayım | Henüz sayım yok | Köpek+clipboard | "İlk sayımını başlat" |
| Şubeler | Tek şube tenant | Kedi+pin | "İkinci şubeni eklemeye hazır mısın?" |
| Tedarikçiler | Tedarikçi yok | Köpek+kasa | "İlk tedarikçini kaydet" |
| Kullanıcılar | Sadece sahip | Kedi+kullanıcı | "Ekibini davet et" |
| Raporlar | Veri yetersiz | Köpek+grafik | "Birkaç satış sonra raporlar dolacak" |

---

## 10. Brand Wordmark Kullanımı

> **Detaylı brand asset rehberi:** `MARKA-VARLIKLARI.md`
> **Ana logo dosyası:** `assets/logo/logo.png` (Sprint 0'da `client/public/logo/logo.png` olarak yansır)

### 10.1 Sidebar (logo + wordmark)

```
[48px logo PNG] [PetStock][Pro]
                [eyebrow opsiyonel]
```

- Logo image: `<img src="/logo/logo.png" alt="" />` (transparent PNG, mockup-v3 sheen overlay mask uygulanabilir)
- Wordmark: 18px Verdana 800, ps→cart, pro→arrow

### 10.2 Tek Wordmark (login, public landing)

```
[PetStock][Pro]
```

36px Verdana 800 (hero büyük), 24px (header orta).

### 10.3 Favicon (Sprint 0'da üretilecek)

- 16×16, 32×32, 48×48 ICO multi-size
- Kedi+köpek kafa yakın plan (logo'nun küçük boyutta okunan bölümü)
- `client/public/favicon.ico`

### 10.4 Logo + Renk Paleti Bağlantısı

Logo'daki 5 renk = UI tasarım sistemindeki 5 ana semantik renk (`§2.1`):

| Logo öğesi | UI token | Anlam |
|---|---|---|
| Kedi turuncu | `--cat` | Accent, CTA |
| Köpek antrasit | `--dog` | Neutral dark |
| Sepet lacivert | `--cart` | Primary |
| Bar chart açık mavi | `--bars` | Info |
| Büyüme oku yeşil | `--arrow` | Success |

**Felsefe:** Tasarım sistemi logo'dan türetildi, marka tutarlılığı doğal.

---

## 11. Accessibility (WCAG AA)

### 11.1 Focus Visible

```css
*:focus-visible {
  outline: 2px solid var(--cat);
  outline-offset: 3px;
  border-radius: var(--r-xs);
}
```

Cat (turuncu) focus ring — sidebar lacivert ile tezat oluşturur, görünür.

### 11.2 Contrast Oranları

| Çift | Oran | Standart |
|---|---|---|
| `--text` üzerinde `--bg` | 16:1 | AAA |
| `--text-2` üzerinde `--bg` | 7:1 | AAA |
| `--text-3` üzerinde `--bg` | 4.5:1 | AA |
| White üzerinde `--cart` | 11:1 | AAA |
| White üzerinde `--cat` | 4.6:1 | AA (large text) |

### 11.3 Klavye Navigasyonu

- Tüm interaktif elemanlar Tab ile dolaşılabilir
- Drawer/Modal'da Tab trap
- Esc ile drawer/modal/palette kapanır
- ⌘K (Ctrl+K) ile command palette
- Pano hızlı eylem kısayolları: `i` (giriş), `s` (satış), `t` (transfer), `c` (sayım)

### 11.4 Screen Reader

- Tüm SVG icon'larda `aria-hidden="true"`
- Butonlarda `aria-label` (icon-only butonlar için)
- Live regions: bildirim toast, son hareketler feed (`aria-live="polite"`)

---

## 12. Dark Mode

`[data-theme="dark"]` attribute body'de. localStorage'da persist (`ps-theme` key).

**Sistem tercihi:**
```js
const dark = localStorage.getItem('ps-theme')
  ? localStorage.getItem('ps-theme') === 'dark'
  : matchMedia('(prefers-color-scheme: dark)').matches;
```

**Geçiş animasyonu:** `transition: background-color 280ms ease, color 280ms ease` body'de.

---

## 13. Tailwind v4 Konfigürasyon Önerisi

```css
/* tailwind.config.ts (TailwindCSS v4 — @theme inline) */
@import "tailwindcss";

@theme {
  --color-cat:       #d4621c;
  --color-cat-2:     #ed7d2f;
  --color-cat-700:   #b8530f;
  --color-cat-soft:  #fdf2e9;

  --color-cart:      #1e3a5f;
  --color-cart-2:    #2a4f7a;
  --color-cart-700:  #16304d;
  --color-cart-soft: #e8eef6;

  /* ... diğer renkler ... */

  --font-sans: Verdana, Geneva, Tahoma, sans-serif;
  --font-mono: Consolas, "Lucida Console", Monaco, monospace;

  --radius-xs:   8px;
  --radius-sm:   12px;
  --radius-default: 18px;
  --radius-lg:   24px;
  --radius-xl:   32px;
  --radius-pill: 999px;
}
```

shadcn/ui CSS variable bridge ile uyumlu.

---

## 14. Bundle Etkisi

| Eleman | Maliyet |
|---|---|
| Font yükleme | **0KB** (Verdana sistem) |
| Glass morphism | 0KB (sadece CSS) |
| Mesh gradient | 0KB (4 div + CSS animation) |
| Paw pattern | < 1KB (inline SVG data URI) |
| Hayvan mascot SVG | ~ 3KB her biri (5-6 mascot toplam ~ 18KB) |
| Recharts | ~ 95KB gzipped |
| Leaflet | ~ 45KB gzipped (lazy-load) |
| shadcn/ui | Her bileşen ~ 1-5KB (copy-paste) |

**Initial JS bundle hedefi:** < 300KB gzipped.
**LCP hedefi:** < 2.5s (mobile, 4G).

---

## 15. Tasarım Karar Özeti

| Karar | Seçim | Sebep |
|---|---|---|
| Font | Verdana saf | Kullanıcı tercihi, system font, TR okunabilir |
| Renk paleti | 5 logo teması (cat/cart/arrow/bars/dog) × 4 ton | Mockup uyumlu, semantik zengin |
| Visual zenginlik | Tam mockup (glass + mesh + paw + tilt) | Premium SaaS karakteri |
| Mascot dili | Tam mockup (watermark + empty mascot) | Pet shop marka karakteri |
| KPI düzeni | 1 büyük + 3 küçük | Envanter Değeri ön plana çıkar |
| PetPro Asistanı | MVP'de aktif (rule-based) | Pano değer katar, AI gerek değil |
| Hero Snapshot | **YOK** (Faz 2'ye) | Günlük hedef ek scope |
| Animasyon yoğunluğu | Tam mockup + `prefers-reduced-motion` | Erişilebilir premium |
| Dark mode | Aktif (localStorage persist) | Standart 2026 SaaS |

---

## 16. Sıradaki Adımlar

1. ✅ TASARIM-SISTEMI.md (bu dosya)
2. ⏭ **EKRAN-PANO.md** — Pano detay tasarım (mockup-v3 + Faz 1 + bu sistem)
3. ⏭ **EKRAN-URUNLER.md** — Ürünler ekranı (variant sistemi dahil)
4. ⏭ Diğer 9 ekran (Stok Hareketleri, Düşük Stok, Sayım, Şubeler, Tedarikçiler, Kullanıcılar, Raporlar, Ayarlar, Süperadmin)
5. ⏭ Database schema (Drizzle)
6. ⏭ Sprint planı revize (yeni stack)
7. ⏭ Sprint 0 (proje skeleton)

---

*Son güncelleme: 2026-05-12. Mockup-v3 baz alındı, Verdana sistemine kalibre edildi.*
