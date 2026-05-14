# PetStockPro — Marka Varlıkları

**Tarih:** 2026-05-12
**Logo dosya:** `assets/logo/logo.png` (1.5MB PNG, transparent)
**Tasarım sistemi bağlantı:** `TASARIM-SISTEMI.md`

> Bu doküman PetStockPro markasının görsel kimliğini tanımlar: logo varyantları, wordmark kuralları, favicon, sosyal medya assets ve kullanım disiplini.

---

## 1. Ana Logo

### 1.1 Kompozisyon

```
   [Kedi 🐱]  [Köpek 🐶]
   turuncu    antrasit
       \      /
       [Sepet 🛒]  ← lacivert
          |
       [Bar chart] ← açık mavi
       [Barkod]    ← siyah
       [Büyüme oku ↗] ← yeşil
```

**Logo öğeleri (5 sektör mesajı tek görselde):**

| Öğe | Renk | Anlam |
|---|---|---|
| **Kedi** | Turuncu `#d4621c` (`--cat`) | Pet shop ana segment |
| **Köpek** | Antrasit `#2c4257` (`--dog`) | Pet shop ikinci segment |
| **Sepet** | Lacivert `#1e3a5f` (`--cart`) | E-ticaret / satış kaydı |
| **Bar chart** | Açık mavi `#7cb8e0` (`--bars`) | Veri / analiz / rapor |
| **Barkod** | Siyah `#0e1a2b` | Stok takibi / SKU |
| **Büyüme oku** | Yeşil `#22c55e` (`--arrow`) | Büyüme / başarı / kazanç |

**Renk paleti tutarlılığı:** Logo'daki 5 renk tüm UI tasarımının semantik temellerini oluşturur (`TASARIM-SISTEMI.md §2.1`).

### 1.2 Dosya Listesi

```
assets/logo/
├── logo.png            ✅ Ana logo, transparent bg, 1.5MB
└── (gelecek)
    ├── logo.svg        ⏳ Vector — sıfırdan üretilecek
    ├── logo-mono.png   ⏳ Tek renkli (lacivert) varyant
    ├── logo-white.png  ⏳ Beyaz varyant (koyu bg için)
    ├── logo-icon.png   ⏳ Sadece kedi+köpek (32×32, 64×64 favicon)
    └── logo-wordmark.png ⏳ Sadece "PetStockPro" wordmark (header için)
```

**Üretim önceliği:**
1. **logo.svg** — vector hali (yüksek öncelik, retina ekran ve scale için)
2. **logo-icon** (favicon için) — kedi+köpek kafa yakın plan
3. **logo-wordmark** (sidebar dar mode için)

---

## 2. Logo Kullanım Kuralları

### 2.1 Minimum Boyut

| Mecra | Min boyut | Not |
|---|---|---|
| Web header (sidebar) | 32×32px (icon) veya 120×40px (full) | Mockup: 48px sidebar mark |
| Favicon | 16×16, 32×32, 48×48 (ICO) | Kedi+köpek kafa yakın plan |
| Apple touch icon | 180×180 PNG | Logo + padding |
| Open Graph | 1200×630 | Logo + wordmark + tagline |
| Sosyal medya avatar | 400×400 | Kedi+köpek tam logo (kare crop'a uyar) |
| E-posta header | 600×120 | Wordmark + ufak logo |
| Promosyon (Instagram post) | 1080×1080 | Logo + slogan |

### 2.2 Padding (Clear Space)

Logo etrafında **kedi kafa yüksekliği** kadar boşluk bırakılır. Hiçbir metin/şekil bu alanın içine girmemeli.

### 2.3 Arka Plan Kuralları

| Arka plan | Logo varyantı | Kontrast |
|---|---|---|
| Beyaz / krem (`--bg`, `#f7f5f0`) | **Ana logo (renkli)** | Mükemmel |
| Lacivert (`--cart`) | logo-white veya logo-mono beyaz | Yüksek |
| Resim/foto | Beyaz container içinde ana logo | Garanti |
| Glass morphism (mockup) | Ana logo (transparent destekli) | İyi |

**Yasak:**
- ❌ Düşük kontrast arka planlar (orta gri vb.)
- ❌ Renkli arka planda renkli logo (kontrast yetmez)
- ❌ Logo'yu döndür/eğ/stretch — orijinal oran korunmalı

### 2.4 Sheen Animasyonu (Sidebar)

Mockup-v3'te sidebar logo'sunda **sheen overlay** animasyonu var (5s loop, parlama efekti).

```css
.sb-mark-shine {
  -webkit-mask-image: url('/logo/logo.png');
  mask-image: url('/logo/logo.png');
  /* mask-mode logo şekline parlama yansır */
}
```

Logo PNG'si transparent olduğu için mask uygulanabilir. Sheen sadece logo piksellerinin üstünde gezer.

---

## 3. Wordmark (Yazılı Logo)

### 3.1 İki Tonlu Wordmark

```
PetStockPro
└──┬───┘└┬┘
   lacivert  yeşil
   (--cart)  (--arrow)
```

**HTML/CSS:**
```html
<span class="wordmark">
  <span class="ps">PetStock</span><span class="pro">Pro</span>
</span>
```

```css
.wordmark {
  font-family: Verdana, sans-serif;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.025em;
}
.wordmark .ps  { color: var(--cart); }
.wordmark .pro { color: var(--arrow); }
```

### 3.2 Boyut Varyantları

| Bağlam | Boyut | Weight |
|---|---|---|
| Sidebar (logo yanında) | 18px | 800 |
| Hero (login/landing) | 36px | 800 |
| E-posta header | 24px | 800 |
| Footer | 14px | 700 |

### 3.3 Tagline (alt yazı, opsiyonel)

```
PetStockPro
Pet shop'unuz için stok takip ve satış kaydı
```

**EN:** `Stock tracking and sales for your pet shop`

Tagline 11-12px, `--text-3` (gri), `letter-spacing: 0.04em`, hafif uppercase.

---

## 4. Favicon Setup

### 4.1 Dosya Listesi (Sprint 0'da üretilecek)

```
client/public/
├── favicon.ico          (multi-size 16/32/48)
├── icon.svg             (modern browser, vector)
├── icon-192.png         (PWA)
├── icon-512.png         (PWA)
├── apple-touch-icon.png (180×180)
└── manifest.json        (PWA manifest)
```

### 4.2 İçerik

**favicon.ico:** Kedi+köpek kafa yakın plan (gövdesiz, kompakt). Sepet ve bar chart gizlenir (küçük boyutta okunmaz).

**icon.svg:** Vector versiyonu (browser modern destekli).

**Apple touch icon:** Padding ile logo (köşelerden ~20px boşluk, iOS otomatik corner radius uygular).

**manifest.json:**
```json
{
  "name": "PetStockPro",
  "short_name": "PetStockPro",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#1e3a5f",
  "background_color": "#f7f5f0",
  "display": "standalone"
}
```

### 4.3 Yöntem

Logo PNG'den favicon üretimi:
- **Online:** realfavicongenerator.net (free, tam set üretir)
- **CLI:** `pwa-asset-generator logo.png ./public --manifest manifest.json`
- **Manuel:** Photoshop/Figma'da yakın plan kedi+köpek kafa export

---

## 5. Open Graph + Twitter Card

### 5.1 Open Graph Image (1200×630)

Sosyal medya paylaşımlarında görünür. İçerik:

```
┌────────────────────────────────────────────────┐
│                                                  │
│   [Logo]      PetStockPro                       │
│               Pet shop için stok takip          │
│                                                  │
│   ┌────────────────────────────────────────┐   │
│   │ [Pano ekran görüntüsü / illustration]  │   │
│   └────────────────────────────────────────┘   │
│                                                  │
│   petstockpro.com                                │
└────────────────────────────────────────────────┘
```

**Dosya:** `client/public/og-image.png` (1200×630, PNG, optimize ~150KB)

**Background:** Hero gradient (mockup'taki gibi cart → dog gradient + radial blob'lar)

### 5.2 Meta Tags (Next.js metadata API)

```ts
export const metadata: Metadata = {
  title: 'PetStockPro — Pet shop için stok takip',
  description: 'Çok şubeli pet shop\'lar için bulut tabanlı stok takip ve satış kayıt SaaS\'ı. FREE plan 50 ürün, sınırsız kullanıcı.',
  openGraph: {
    title: 'PetStockPro',
    description: '...',
    url: 'https://petstockpro.com',
    siteName: 'PetStockPro',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'tr_TR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PetStockPro',
    description: '...',
    images: ['/og-image.png'],
  },
};
```

---

## 6. E-posta Template Header

Brevo SMTP ile gönderilen tüm transactional e-postalarda kullanılır:

```
┌──────────────────────────────────────────────┐
│                                                │
│   [logo 40px]   PetStockPro                   │
│                                                │
├──────────────────────────────────────────────┤
│                                                │
│   [İçerik bölgesi]                            │
│                                                │
├──────────────────────────────────────────────┤
│   PetStockPro · petstockpro.com               │
│   © 2026 · Tüm hakları saklıdır              │
│   [Aboneliği yönet] · [Hesap sil]            │
└──────────────────────────────────────────────┘
```

**Tasarım:**
- **Header:** beyaz bg + logo + wordmark
- **İçerik:** beyaz bg, body text 14px, başlık 20px
- **Footer:** açık gri bg (`#f3f0ea`), 11px font, gri text
- **CTA buton:** turuncu gradient (`--cat`), 14px Bold, beyaz text, 12px border-radius

**Mobile responsive:** max-width 600px container, table-based (e-posta client desteği).

---

## 7. Sosyal Medya Avatarları

| Platform | Boyut | İçerik |
|---|---|---|
| Twitter/X | 400×400 | Logo (tam) |
| Instagram | 320×320 | Logo (tam, kare crop) |
| Facebook | 170×170 | Logo (tam) |
| LinkedIn (company) | 300×300 | Logo + wordmark altı |
| YouTube | 800×800 | Logo (mascot odaklı) |
| Telegram (`@PetStockProBot`) | 512×512 | Logo |

**Banner/Cover:**
- Twitter banner: 1500×500 — gradient bg + logo + wordmark + tagline
- LinkedIn cover: 1128×191 — minimalist + wordmark
- Facebook cover: 820×312 — illustration + tagline

---

## 8. Animasyon Önerisi (Hareketli Logo)

İleride (Faz 2+) animasyonlu logo varyantları:

### 8.1 Lottie Animation (Splash/Loading)

- Kedi+köpek yumuşak head-bob (`mascotBob` 3s loop)
- Sepet alttan slide-in
- Büyüme oku yukarı çıkar (drawLine animasyon)
- Tek tek öğeler stagger 300ms

Lottie JSON dosyası → `client/public/animations/logo-intro.json`

### 8.2 Hover Animasyon (Sidebar Logo)

Mockup'ta zaten var: `markSheen` (sheen overlay 5s loop). Bunu koru, ek hareket yok.

---

## 9. Brand Voice & Mesajlar

### 9.1 Tonalite

| Öğe | Tone |
|---|---|
| **Marka adı** | PetStockPro (asla "PSP" veya kısaltma) |
| **Tone of voice** | Profesyonel ama samimi, Türk kullanıcıya yakın |
| **Hitap** | "siz" (formal) — admin paneli; "sen" (samimi) — onboarding mesajlar |
| **Emoji** | Strategik (🐱🐶📦📥 — fonksiyonel; ✨🎉 — özel anlar) |
| **Sayı formatı** | Türkçe `₺1.250,50` ABD `$1,250.50` (locale aware) |

### 9.2 Anahtar Sloganlar

- **TR:** *"Pet shop'unuz için stok takip ve satış kaydı"*
- **EN:** *"Stock tracking and sales for your pet shop"*
- **Kısa:** *"Pet shop. Stok. Kontrol."*
- **Onboarding:** *"5 dakikada kuruldu, hemen kullanmaya başla"*

### 9.3 Yasaklı Terimler

| ❌ Kullanma | ✅ Kullan |
|---|---|
| "kullanıcı" (jargon) | "siz" / "ekip üyesi" |
| "müşteri" (ana ürün için) | "tenant" / "pet shop" (technical), "kullanıcı" (UI) |
| "ERP" (kibirli) | "stok takip yazılımı" |
| "ürün" yerine "item" (TR'de) | "ürün" |
| "abonelik iptal" (sert) | "aboneliği sonlandır" |

---

## 10. Sprint 0'da Yapılacaklar (Logo + Brand)

1. ✅ `assets/logo/logo.png` kopyalandı
2. ⏭ `client/public/logo/logo.png` (Sprint 0'da Next.js public klasörüne kopyala)
3. ⏭ `logo.svg` vector üret (Figma veya online tool)
4. ⏭ Favicon set üret (realfavicongenerator.net)
5. ⏭ `client/public/og-image.png` üret (Figma template ile)
6. ⏭ Apple touch icon (180×180)
7. ⏭ PWA manifest
8. ⏭ E-posta template header (React Email veya MJML)
9. ⏭ Telegram bot avatarı yükle

---

## 11. Logo Tarihçesi

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| v1.0 | 2026-05-12 | İlk PetStockPro logosu (kullanıcı tarafından sağlandı) — kedi+köpek+sepet+barkod+bar chart+büyüme oku kompozisyonu, transparent PNG 1.5MB |

Eski PetToptan logosu kullanılmayacak (proje pivot edildi, marketplace kaldırıldı).

---

## 12. Telif ve Kullanım Hakları

- **Sahip:** PetStockPro / Oğuzhan
- **Lisans:** Tüm haklar saklıdır
- **3. parti kullanımı:** İzin gerekir (entegrasyon partner'lar için "Brand Guidelines" PDF Faz 3'te hazırlanacak)
- **Logo değişiklik:** Renk/oran/şekil değiştirilemez (sadece izin verilen varyantlar kullanılır)

---

*Son güncelleme: 2026-05-12. Logo v1.0 alındı, MARKA-VARLIKLARI.md ilk sürüm.*
