# Ekran: Pano (Dashboard)

**URL:** `/admin/dashboard`
**Sidebar yeri:** Envanter grubu, ilk sıra · 🏠 Pano
**Erişim:** ADMIN (bayi sahibi + şube müdürü) + STAFF (kasiyer — sade görünüm: KPI'lar + son hareketler feed + düşük stok uyarı; plan card / vitrin metrikleri / asistan önerileri gizli). Tam yetki matrisi: `EKRAN-KULLANICILAR.md §12.5` (2026-05-14 OT2-5).
**Otoritatif referans:** `D:/Projeler/mockup-admin-premium-v3.html`
**Tasarım sistemi:** `TASARIM-SISTEMI.md`

> Pano, kullanıcının her giriş açtığında karşılaştığı ekrandır. İşletmenin günlük nabzını tek bakışta gösterir, en sık yapılan eylemlerin kapısıdır. Performans (LCP < 2.5s) ve okunabilirlik kritiktir.

---

## 1. Layout Genel Bakış

```
┌─────────┬──────────────────────────────────────────────────┐
│         │  Topbar (sticky, glass)                           │
│ Sidebar ├──────────────────────────────────────────────────┤
│         │  ┌─ Hero card (sticky'değil, scrollla beraber) ─┐│
│  248px  │  │  Greeting + Meta + 2 CTA + 3 stats pill      ││
│ sticky  │  │  (Snapshot widget YOK — Faz 2'ye saklı)      ││
│ glass   │  └───────────────────────────────────────────────┘│
│         │                                                    │
│ ENVANT. │  Alerts strip (4 pill chip, yatay scroll)         │
│ • Pano  │                                                    │
│ • Ürün  │  ┌─── Bento grid (12 col, 18px gap) ──────────┐   │
│ • Hare. │  │  Big KPI col-5 │ Small col-3 │ Small col-4  │   │
│ • Düşük │  │  Envanter Değ. │ Bugün Satış │ Stok Girişi │   │
│ • Sayım │  ├────────────────┴─────────────┴──────────────┤   │
│         │  │  Trend Chart col-7   │ Low Stock col-5      │   │
│ OPERAS. │  ├──────────────────────┴───────────────────────┤   │
│ KAYNAK. │  │  PetPro Asistanı col-7│ Aktif Ürün KPI col-5│   │
│ ANALİZ  │  ├──────────────────────┴───────────────────────┤   │
│ SİSTEM  │  │  Activity Feed col-8  │ (boş veya empty)    │   │
│         │  └───────────────────────────────────────────────┘   │
│ Plan    │                                                    │
│ FREE    │  + Drawer (Hızlı Stok Girişi, slide-in 480px)    │
│ 47/50   │  + Command palette (⌘K)                            │
└─────────┴──────────────────────────────────────────────────┘
```

## 2. Bento Grid Yerleşim Planı

Mockup'ta gözlemlenen yerleşim + Faz 1 kararı (4 KPI) + benim revize:

```
Sıra 1: [Big KPI col-5] [Small col-3] [Small col-4]
Sıra 2: [Chart col-7] [Low Stock col-5]
Sıra 3: [Advisor col-7] [Aktif Ürün KPI col-5]
Sıra 4: [Activity Feed col-8] [Empty State col-4 — koşullu]
```

**Sıra 1 mantığı:** Envanter Değeri ana metrik (en büyük), günlük operasyonel KPI'lar (satış + giriş) yanda.
**Sıra 2 mantığı:** Görsel trend (chart) + acil eylem (düşük stok).
**Sıra 3 mantığı:** Akıllı eylem önerileri (asistan) + plan limit (aktif ürün gauge).
**Sıra 4 mantığı:** Detaylı son hareketler feed, sağda boş ürün varsa mascot kart.

---

## 3. Bölüm Detayları

### 3.1 Hero Card

**Konum:** `main` içinde top, `margin: 24px 24px 0`
**Background:** Multi-radial gradient + `--cart` → `--dog` linear
**Padding:** `36px 40px`
**Border-radius:** `--r-xl` (32px)
**Box-shadow:** `--shadow-cart`

**İçerik (sol kolon, kullanıcı bakış sırası):**

1. **Eyebrow rozeti:**
   ```
   [●] CANLI · 3 ŞUBE BAĞLI
   ```
   - Yeşil canlı dot (livePulse animasyon)
   - Tek şube tenant'ta: `CANLI · TEK MAĞAZA`
   - 11.5px Bold, letter-spacing 0.04em, uppercase
   - Background `rgba(255,255,255,0.16)`, border `rgba(255,255,255,0.22)`

2. **Greeting:**
   ```
   İyi sabahlar, Ahmet 👋
   ```
   - Verdana 26px Bold (mockup 38px Fraunces yerine, Verdana'ya kalibre)
   - Saat dilimine göre dinamik: `İyi sabahlar` (06-12), `İyi günler` (12-18), `İyi akşamlar` (18-23), `Geceniz iyi olsun` (23-06)
   - "Ahmet" cat→arrow gradient text (mockup'taki em yerine)
   - 👋 emoji `wave` animasyonu (2.8s loop)
   - i18n: TR → `İyi sabahlar, {name}`, EN → `Good morning, {name}`

3. **Meta satırı:**
   ```
   07 Mayıs 2026, Perşembe · 14 yeni stok hareketi · 3 ürün limit'e yaklaştı
   ```
   - Verdana 13px, color `rgba(255,255,255,0.85)`
   - Sayılar `Bold` `#fff`
   - Dinamik veriler:
     - Tarih: kullanıcı locale'i (TR: "07 Mayıs 2026, Perşembe", EN: "May 7, 2026, Thursday")
     - "Yeni stok hareketi": son 24 saat içinde
     - "Limit'e yaklaştı": son 7 günde eşik altına düşen ürünler

4. **2 CTA buton:**
   ```
   [📥 Stok Girişi]  [🛒 Satış Kaydı]
   ```
   - Primary: turuncu gradient (`btn-cat`), `--shadow-cat`, shimmer animasyon
   - Secondary: glass ghost (`hero-cta-ghost`)
   - Tıklama → ilgili Drawer açar (Stok Girişi drawer, Satış drawer)
   - Klavye kısayolları: `i` ve `s` (hero üstüne hover'da tooltip ile gösterilir)

5. **Hero stats pills (3 chip):**
   ```
   [₺4.820 bugün satış] [+87 stok girişi] [152K envanter ₺]
   ```
   - Glass pill, 8px 14px padding, pill radius
   - Sayılar mono (Consolas 13px Bold), renkli (cat/arrow/bars)
   - "Bugün satış" turuncu, "stok girişi" yeşil, "envanter" mavi

**İçerik (sağ kolon): Mascot Illustration**

❌ Snapshot widget YOK — `TASARIM-SISTEMI.md` §8.3 kararı. Faz 2'ye saklandı.

✅ **Yerine: Mascot Illustration** (kedi + köpek, mutlu kompozisyon)

```
        ╭─────────────────╮
        │   [✨ sparkle]    │
        │                    │
        │   [kedi turun.]   │
        │   [köpek antra.] │
        │                    │
        │  [floating pati]  │
        ╰─────────────────╯
```

**Spesifikasyon:**
- **Boyut:** 320×260px (max-width, scale responsive)
- **Pozisyon:** Hero grid sağ kolon, `align-self: center`
- **SVG inline** (HTML'e gömülü, bundle'a yük binmez, max ~6KB)
- **Kompozisyon:**
  - **Kedi** (turuncu `--cat`, 110×100px, sol önde) — gözleri açık, hafif yukarı bakıyor, kuyruk yukarı kıvrık (mutlu)
  - **Köpek** (antrasit `--dog`, 130×110px, sağ arkada) — kulakları yukarı, dili çıkık, mutlu ifade
  - **Sparkle'lar** (2-3 adet, yeşil `--arrow-2`) — kompozisyonun etrafında yıldız işareti
  - **Pati izleri** (2-3 adet, subtle `rgba(255,255,255,0.15)`) — yer çekimi hissi, kompozisyonun altında
- **Animasyonlar:**
  - Kedi: `floatA` 3.4s loop (Y ekseni ±6px, hafif rotate ±2°)
  - Köpek: `floatA` 4s loop reverse (zıt fazda)
  - Sparkle'lar: `sparkle` 1.5s loop staggered
  - Hover: kompozisyon hafif scale 1.02 (300ms ease)
- **Empty state mascot'tan farkı:**
  - Empty state'te kalp + "Hepsi yolunda" temaları var → kart ortasında
  - Hero'da kalp YOK (sadece kedi+köpek+sparkle), brand karakter olarak çalışır
  - Boyut daha büyük (130×130 değil 320×260)
- **Erişilebilirlik:** `aria-hidden="true"`, decorative
- **Mobile davranış:**
  - `< 1024px`: Mascot küçülür (200×160), hero altına stack olur
  - `< 768px`: Mascot **gizlenir** (hero compact, sadece text + CTA)
- **Dark mode:** Kedi rengi `--cat`, köpek rengi açılır (`--dog-2` yerine `#b8c5d6`), sparkle yeşil ton korunur

**Asset dosyası:** `client/src/components/illustrations/HeroMascot.tsx` — inline SVG React component, props ile renkler özelleştirilebilir.

**Mobile davranış:**
- Greeting font 22px'e düşer
- Stats pill flex-wrap
- CTA'lar full-width

### 3.2 Onboarding Kartı (yeni tenant, koşullu)

Eğer tenant `users.created_at < 7 gün önce` AND `products.count = 0` AND `stock_movements.count = 0`:

Hero **yerine** Onboarding kartı render edilir:

```
┌─────────────────────────────────────────────────────┐
│  PetStockPro'ya hoş geldin! 🎉                       │
│                                                       │
│  3 adımda kullanmaya başla:                          │
│                                                       │
│  [○] 1. İlk ürününü ekle      [Ürün Ekle →]         │
│  [○] 2. Stok girişi yap        [Stok Girişi →]      │
│  [○] 3. İlk satışını kaydet    [Satış Kaydı →]      │
│                                                       │
│  💡 Yardımcı kaynaklar: [Kılavuz] [Video Eğitim]    │
└─────────────────────────────────────────────────────┘
```

Tamamlanan adımlar ✓ ile işaretlenir (yeşil dot + line-through). Hepsi tamamlanınca 24 saat sonra otomatik kaybolur, normal Hero görünür.

### 3.3 Alerts Strip

**Konum:** Hero'nun altında, `padding: 0 24px`, `margin-top: 18px`
**Layout:** Flex, gap 10px, yatay scroll (`overflow-x: auto; scrollbar-width: none`)

**4 alert chip (örnekler):**

| İkon | Mesaj | Renk | Tıklama |
|---|---|---|---|
| 🔴 | **2 ürün** stoğu tükendi | `--danger` | `/admin/inventory/low-stock?filter=out` |
| 🐱 | **5 ürün** düşük stok | `--cat-700` | `/admin/inventory/low-stock?filter=critical` |
| 🟡 | **1 ürün** SKT yaklaşıyor | `--bars-700` | `/admin/products?filter=expiring` |
| 📦 | **3 sipariş** bekleyen teslim | `--arrow-700` | `/admin/operations/transfer?status=in-transit` |

**Davranış:**
- Hiç alert yoksa strip render edilmez (collapsed, layout shift yok)
- Tıklama → ilgili sayfaya filtreli git
- Hover: `translateY(-2px)`, `box-shadow: --shadow-md`
- Glass background + border + backdrop-filter
- Tıklama animasyonu: scale 0.95 → 1 (200ms)

**i18n örnek:**
```json
{
  "alerts.out_of_stock": "{count, plural, one {# ürün} other {# ürün}} stoğu tükendi",
  "alerts.low_stock": "{count, plural, one {# ürün} other {# ürün}} düşük stok"
}
```

### 3.4 Big KPI — Envanter Değeri

**Konum:** Bento sıra 1, col-5
**Tema:** Lacivert gradient (`--cart` → `--dog`)
**Glass:** YOK (gradient kart kendi başına dolu)

```
┌────────────────────────────────────────┐
│ ✦ ENVANTER DEĞERİ · GERÇEK ZAMANLI    │
│                                         │
│ ₺152.400                                │
│                                         │
│ [+%3.2] geçen haftaya göre · 3 şube    │
│                                  ┌────┐ │
│                                  │mini│ │
│                                  │bar │ │
│                                  │chrt│ │
│                                  └────┘ │
└────────────────────────────────────────┘
```

**İçerik:**
- **Eyebrow:** `✦ ENVANTER DEĞERİ · GERÇEK ZAMANLI` (`--cat-2` color, 11px Bold uppercase, letter-spacing 0.08em)
- **Value:** `₺152.400` (Verdana 42px Bold, letter-spacing -0.02em, line-height 1)
  - ₺ prefix Verdana 28px (daha küçük)
  - Sayı: `Intl.NumberFormat('tr-TR')` format
  - `data-target` attribute + IntersectionObserver ile ticker animasyon
- **Foot:**
  - `[+%3.2]` trend pill (`--arrow-soft` bg, `#d4f7df` text, `+%3.2` 800 weight)
  - `geçen haftaya göre · 3 şube toplam` (13px, `rgba(255,255,255,0.85)`)
- **Mini bar chart (sağ alt, absolute):**
  - 7 bar (son 7 gün envanter değer trendi)
  - 12px width × 56px max height
  - `--bars` renk, `barRise` animasyon (stagger 100ms)

**Hesaplama:**
```sql
-- Tenant'ın tüm aktif variant'larının (cost_price × stock_qty) toplamı
SELECT SUM(pv.cost_price * bi.stock_qty)
FROM branch_inventory bi
JOIN product_variants pv ON pv.id = bi.variant_id
WHERE bi.company_id = :tenantId
  AND pv.is_active = true;
```

**Realtime:** Stok hareketi olduğunda Supabase Realtime ile güncellenir (debounce 2s).

**Tıklama:** `/admin/products?sort=value-desc` (en değerli ürünler önce)

**Mockup tilt:** Aktif (mousemove ile rotateX/rotateY)

### 3.5 Small KPI — Bugün Satış (tone-cat)

**Konum:** Bento sıra 1, col-3
**Tema:** `tone-cat` (turuncu)

```
┌──────────────┐
│ [🛒 ikon]    │
│ BUGÜN SATIŞ │
│              │
│ ₺4.820       │
│              │
│ [+%12]  ▁▃▂▄▃▅▆ │
└──────────────┘
```

- **İkon:** Alışveriş sepeti SVG, `--cat-soft` bg, `--cat-700` color
- **Label:** `BUGÜN SATIŞ` (11px Bold uppercase, `--text-3`)
- **Value:** `₺4.820` (Verdana 28px Bold, `--cat-700` color)
- **Trend pill:** `[+%12]` `--arrow-soft` bg, küçük arrow ikon
- **Sparkline:** son 7 gün satış (7 bar, geom-mean normalize)

**Hesaplama:** Bugün (00:00 - şimdi, tenant timezone) tipi=SATIŞ stok hareketleri toplam `unit_price × quantity`.

**Realtime:** Yeni satış olduğunda anlık güncelle.

**Tıklama:** `/admin/operations/sales?date=today`

**Watermark:** Kedi SVG (cat color)

### 3.6 Small KPI — Stok Girişi (tone-bars)

**Konum:** Bento sıra 1, col-4
**Tema:** `tone-bars` (mavi)

```
┌──────────────────┐
│ [📥 ikon]        │
│ STOK GİRİŞİ      │
│                   │
│ 87 adet           │
│                   │
│ 3 tedarikçi       │
└──────────────────┘
```

- **Value:** `87` (Verdana 28px Bold) + `adet` suffix (14px, `--text-3`)
- **Foot:** `3 tedarikçi` (13px, `--text-2`)

**Hesaplama:** Bugün tipi=GİRİŞ hareketleri toplam `SUM(quantity)`, ayrı tedarikçi sayısı = `COUNT(DISTINCT supplier_id)`.

**Tıklama:** `/admin/inventory/movements?type=stock-in&date=today`

**Watermark:** Barkod SVG (bars color)

### 3.7 Small KPI — Aktif Ürün (tone-arrow, ring progress)

**Konum:** Bento sıra 3, col-5 (Asistan'ın yanı — plan limit önemli, asistanla aynı sırada görünmesi mantıklı)
**Tema:** `tone-arrow` (yeşil) + ring progress

```
┌──────────────────────┐
│ [📦 ikon] AKTİF ÜRÜN│
│                       │
│ 18 / 20  [○ ring 90%]│
│                       │
│ ⚠ Limit'e 3 ürün kaldı│
└──────────────────────┘
```

- **Value:** `18 / 20` flex-row (28px Bold + 18px suf)
- **Ring:** Circular progress 36×36, stroke 4px, `--cat` color (limit'e yaklaşan uyarı turuncu)
- **Plan rengi mantığı:**
  - < %60 dolu → `--arrow` (yeşil)
  - %60-80 dolu → `--cat` (turuncu)
  - %80-100 dolu → `--danger` (kırmızı)
  - FREE (50 ürün) → ring + sayaç, eşik bazlı renk
  - PRO (500 ürün) → ring + sayaç (47/500 gibi), eşik bazlı renk
  - PRO+ (∞ sınırsız) → ring yok, "Sınırsız ∞" gösterilir (3-tier B, 2026-05-14)
- **Foot mesajı:**
  - %0-60: `Plan'da yer var`
  - %60-80: `Limit'e {kalan} ürün kaldı`
  - %80-100: `Limit dolmak üzere · PRO'ya yükselt →`
  - %100: `Plan limiti doldu · Yükselt veya arşivle`

**Hesaplama:** Tenant'ın `is_active = true` parent product sayısı (variant'lar sayılmaz, plan kararı uyumlu).

**Tıklama:**
- `< %80`: `/admin/products`
- `>= %80`: `/admin/settings/plan` (yükseltme modali)

**Watermark:** Büyüme oku SVG (arrow color)

### 3.8 Trend Chart — Envanter Trendi

**Konum:** Bento sıra 2, col-7
**Tema:** Glass card, no tone

```
┌─────────────────────────────────────────┐
│ Envanter Trendi    [7g][30g][90g]      │
│ Son 7 günde toplam stok değeri          │
├─────────────────────────────────────────┤
│ 160k ─                                  │
│       \                              ╭─ │
│ 140k   \                          ╭──   │
│         \                      ╭──     │
│ 120k    `─.                ╭──         │
│             `──.       ╭──             │
│ 100k             `─────                │
│        01  02  03  04  05  06  07     │
└─────────────────────────────────────────┘
```

- **Head:** Card title (16px Bold) + sub (11.5px, `--text-3`) + segmented `[7g][30g][90g]`
- **Chart:** Recharts `AreaChart` (line + area gradient) — Faz 1 R2: tek line/area, composed yok
- **Stroke:** `--cart` 3px, linecap round, linejoin round, drawLine animasyon (1.6s)
- **Area gradient:** `--cart` 0.3 opacity → 0
- **Points:** 5px circle, `--surface` fill + `--cart` stroke 3px, son nokta `--cat` highlight
- **Tooltip:** Hover'da `01 May · ₺132.400` formatında, koyu bg + beyaz text + caret

**Periyot toggle:**
- `7g` (default) → son 7 gün, günlük
- `30g` → son 30 gün, günlük
- `90g` → son 90 gün, haftalık aggregate

**Veri:** Backend günlük envanter snapshot tablosu (`inventory_snapshots` — günlük cron ile yazılır) veya **on-the-fly hesap**:
```sql
SELECT date, SUM(cost_price × stock_qty)
FROM (her gün için stok durumu)
GROUP BY date
```

Performans için `inventory_snapshots` günlük cron + Supabase pg_cron önerilir.

**Empty state:** Hiç hareket yoksa `📊 Henüz veri yok. İlk stok girişini yap →` CTA.

**Boş bar chart varyantı (alternatif):** Recharts `BarChart` (giriş yeşil + çıkış kırmızı stacked) — kullanıcı isterse.

### 3.9 Düşük Stok Widget

**Konum:** Bento sıra 2, col-5
**Tema:** Glass card

```
┌──────────────────────────────────────────┐
│ Düşük Stok           [5 ürün]            │
│ 5 ürün dikkat ister                       │
├──────────────────────────────────────────┤
│ [kedi] Royal Canin Kedi 2kg          12→2│ 🔴
│        🗺 Merkez · 🐱 Mama                │
│                                           │
│ [kedi] Whiskas 400g · Sığır Etli   25→3 │ 🔴
│        🗺 Şube A · 🐱 Mama                │
│                                           │
│ [köpek] Pro Plan Köpek 15kg          18→7│ 🟠
│        🗺 Merkez · 🐶 Mama                │
│                                           │
│ ... 2 ürün daha                          │
│                                           │
│           Tümünü gör →                    │
└──────────────────────────────────────────┘
```

**Liste yapısı (her satır):**
- **Avatar (36px):** Ürün kategori bazlı hayvan SVG ikon (`tone-cat` veya `tone-dog` gradient bg)
- **Ürün adı + tags:**
  - Ad (13px Bold, tek satır ellipsis)
  - Tags: `🗺 Şube` + `🐱 Kategori` (10.5px, `--surface-2` bg)
- **Stok değişim (sağ):**
  - `12 → 2` formatında (önce gri, sonra `crit/warn` renkli)
  - `crit` (kritik): `--danger-soft` bg, `--danger` text, 🔴 dot
  - `warn` (yakında): `--cat-soft` bg, `--cat-700` text, 🟠 dot

**Sıralama:** Kritiklik (kritik → yakında) → eksik adet (büyük → küçük).

**Liste limiti:** İlk 5 ürün gösterilir. Daha varsa "Tümünü gör →" footer link.

**Tıklama (her satır):** Ürün detay drawer açılır.

**Realtime:** Stok değişimi (eşik altına düşme) anlık güncelleme.

**Empty state:** Hiç düşük stok yoksa **kart yerine** Empty State kartı (sıra 4'te gösterilen):
```
🎉 [mascot] Hepsi yolunda!
Kritik stoğu tükenen ürün yok.
[Ürünleri görüntüle]
```

### 3.10 PetPro Asistanı — Akıllı Öneriler

**Konum:** Bento sıra 3, col-7
**Tema:** Glass card + radial gradient overlay (sol üst turuncu, sağ alt mavi)

```
┌────────────────────────────────────────────────┐
│ ✦ PETPRO ASİSTANI                              │
│ Bugün için 4 akıllı öneri          [4 yeni]   │
│ Satış hızı, SKT ve transfer fırsatlarına göre │
├────────────────────────────────────────────────┤
│ [icon-cat] [Sipariş] Royal Canin Kedi 2kg     │
│            Satış +%35 · 2 günde tükenir       │
│            Tedarikçi: Ahmet Petshop           │
│                              [50 adet öner →] │
│ ──────────────────────────────────────────────│
│ [icon-bars][Transfer] Pro Plan Köpek 15kg     │
│            Merkez'de 7 · Şube B'de 25         │
│            Dengeleme önerisi                  │
│                              [Transfer aç →] │
│ ──────────────────────────────────────────────│
│ [icon-arrow][İndirim] Felix Yaş Mama · 8 adet │
│            SKT 14 gün · Şube A                │
│            %20 indirim ile hızlı dönüş        │
│                              [İndirim oluştur→]│
│                                                │
│         Tüm önerileri gör (4) →                │
└────────────────────────────────────────────────┘
```

### 3.10.1 Rule Mantığı (3 öneri tipi)

#### Tip 1: 🐱 SİPARİŞ (tag-order, cat color)

**Tetik koşulları:**
```
Variant başına:
- SUM(branch_inventory.stock_qty) < SUM(variant.threshold) (toplam eşik altı)
- Son 7 günde SUM(satış_quantity) > 0 (gerçekten satılıyor)
- Bu hafta satış hızı geçen haftadan +%20 daha yüksek (artış trendi)
- Aktif tedarikçisi var (son alımdaki supplier)

Öneri formülü:
- Önerilen adet = (eşik × 2) - mevcut_toplam
- "X günde tükenir" hesabı: mevcut_toplam / (son_7g_satış / 7)
```

**UI:**
- İkon: 📥 (cat color)
- Tag: `Sipariş` (cat-soft bg)
- Aksiyon: `{önerilen} adet öner` → Stok Girişi drawer pre-filled (ürün + tedarikçi + miktar)

#### Tip 2: 🔄 TRANSFER (tag-trans, bars color)

**Tetik koşulları:**
```
Variant başına:
- Bir şubede stock_qty > threshold × 2 (fazla)
- Aynı variant başka şubede stock_qty < threshold (eksik)
- Sadece multi-branch tenant'ta

Öneri formülü:
- Transfer miktarı = MIN(fazla_şubedeki_fazla, eksik_şubedeki_eksik)
```

**UI:**
- İkon: 🔄 (bars color)
- Tag: `Transfer` (bars-soft bg)
- Aksiyon: `Transfer aç` → Transfer drawer pre-filled (kaynak + hedef + ürün + miktar)

#### Tip 3: 🏷 İNDİRİM (tag-discount, arrow color)

**Tetik koşulları:**
```
Variant başına:
- branch_inventory.expiry_date < bugün + 30 gün (SKT yaklaşıyor)
- branch_inventory.stock_qty > 0
- Henüz indirim uygulanmamış (sale_price = orijinal sale_price)
- Son 14 günde satış var (ölü stok değil, hızlı satılabilir)
```

**Öneri formülü:**
- SKT kalan gün < 15 → %20 indirim
- SKT kalan gün 15-30 → %10 indirim

**UI:**
- İkon: 🏷 (arrow color)
- Tag: `İndirim` (arrow-soft bg)
- Aksiyon: `İndirim oluştur` → İndirim modali (önerilen yüzde + onay)

### 3.10.2 Backend

**Endpoint:** `GET /api/admin/advisor/suggestions`

**Response:**
```ts
type AdvisorSuggestion = {
  id: string;
  type: 'order' | 'transfer' | 'discount';
  variantId: string;
  productName: string;
  variantLabel: string;
  reason: string;        // Önceden hazır cümle
  action: {
    label: string;       // "50 adet öner"
    href: string;        // /admin/inventory/movements?action=stock-in&variant=...&supplier=...&qty=50
  };
  metrics: {             // Debug + audit için
    [key: string]: number | string;
  };
}
```

**Hesaplama:** Server Component'te SQL ile, **cache 5 dakika** (Supabase Edge Function veya Next.js Server Component cache).

**Realtime:** Önemli değişiklikler (yeni satış, transfer tamamlandı) öneri listesini invalidate eder.

**Boş durum:** Hiç öneri yoksa kart yine render edilir:
```
🎉 [mascot] Bugün öneri yok!
Stok dengesi mükemmel, SKT'ler güvende.
```

### 3.11 Activity Feed — Son Hareketler

**Konum:** Bento sıra 4, col-8
**Tema:** Glass card

```
┌──────────────────────────────────────────────────┐
│ Son Hareketler         [● CANLI · realtime]      │
│ Tüm şubelerden anlık akış                         │
├──────────────────────────────────────────────────┤
│ [📥 yeşil] Royal Canin Kedi 2kg   [+24 adet]    │
│            🐱 Stok Girişi · Ahmet Petshop · Merkez│
│                                       2 dk önce  │
│ ─────────────────────────────────────────────────│
│ [🛒 turun.] Whiskas 400g           [−3 adet]     │
│            Satış · Müşteri: 0532***1278 · Şube A │
│                                       8 dk önce  │
│ ─────────────────────────────────────────────────│
│ [🔄 mavi]  Pro Plan Köpek 15kg     [↔ 5 adet]   │
│            Transfer · Merkez → Şube B · Yola çık.│
│                                      23 dk önce  │
│ ─────────────────────────────────────────────────│
│ [📤 turun.] Felix Yaş Mama         [−2 adet]    │
│            Çıkış · Sebep: SKT Geçmiş · Şube A    │
│                                       1 sa önce  │
│ ─────────────────────────────────────────────────│
│ [📋 antra.] Aylık Sayım · Şube B   [147 SKU]    │
│            Sayım · 3 fark tespiti · Tamamlandı   │
│                                       2 sa önce  │
└──────────────────────────────────────────────────┘
```

**Liste yapısı (her satır):**
- **Tip ikon (42×42):** Hareket tipine göre renk
  - `t-in` (Giriş): `--arrow-soft` bg + `--arrow-700` icon
  - `t-out` (Çıkış/Satış): `--cat-soft` bg + `--cat-700` icon
  - `t-trans` (Transfer): `--bars-soft` bg + `--bars-700` icon
  - `t-count` (Sayım): `--dog-soft` bg + `--dog` icon
- **Body:**
  - Title: Ürün adı + miktar chip (`+24 adet` / `−3 adet` / `↔ 5 adet`)
  - Meta: Hareket tipi emoji + detay (tedarikçi/müşteri/transfer yönü) + şube
- **Time:** `2 dk önce` formatı (relative time, `date-fns` `formatDistanceToNow`)

**Süperadmin işareti:** `performed_as_superadmin = true` ise satırın solunda 🚨 rozet, hover'da "Süper admin tarafından" tooltip.

**Liste limiti:** **5 entry** (Faz 1 R2 kararı).

**Realtime:** Supabase Realtime ile WebSocket subscribe:
```ts
supabase
  .channel('stock_movements')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'stock_movements',
    filter: `company_id=eq.${companyId}`
  }, (payload) => {
    // Listenin başına ekle, sondan birini düşür
    // 5 saniye highlight (yeşil bg fade-out)
  })
  .subscribe();
```

**Tıklama (her satır):** Ledger detay drawer açılır (modal değil, drawer slide-in).

**Empty state:** Hiç hareket yoksa kart yerine Onboarding kartı render edilir (zaten Hero'da).

### 3.12 Empty State Kartı (Bento sıra 4, col-4 — koşullu)

Sadece **şu koşulda** render edilir:
- Düşük stok widget'ında hiç ürün yoksa (yani her şey yolunda)

Mockup'taki gibi büyük mascot + mesaj:

```
┌────────────────────────────┐
│                            │
│       [kedi + köpek]       │
│       [kalp + sparkle]     │
│                            │
│      Hepsi yolunda!        │
│ Kritik stoğu tükenen       │
│ ürün yok. Kedi de köpek    │
│ de mutlu — bugün bir adım  │
│ önde gidiyorsun.           │
│                            │
│  [Ürünleri görüntüle]      │
└────────────────────────────┘
```

- **Mascot:** 130×130 SVG (kedi turuncu + köpek antrasit + kalp + 2 sparkle)
- **Animasyonlar:** kedi+köpek `floatA`, kalp `heartBeat`, sparkles `sparkle`
- **Title:** "Hepsi yolunda!" (Verdana 16px Bold)
- **Description:** 12.5px, `--text-2`, max-width 260px
- **Background:** `linear-gradient(160deg, var(--cat-soft) 0%, var(--bars-soft) 100%)`

Diğer durumlarda (low stock var) bu kart **render edilmez**, sıra 4 sadece Activity Feed olur (col-8) ve sağ taraf boş kalır veya feed col-12 olur.

---

## 4. Drawer — Hızlı Stok Girişi

Hero'daki `📥 Stok Girişi` butonu veya `i` klavye kısayolu ile açılır.

**Konum:** Sağdan slide-in, max-width 480px, full-height
**Backdrop:** rgba(14, 26, 43, 0.55) + backdrop-filter blur(8px)
**Animasyon:** `transform: translateX(100%) → 0` 280ms

**Header:**
```
Hızlı Stok Girişi                                  [×]
Yeni stok hareketi kaydet — ⌘ Enter ile gönder
```
Background: `linear-gradient(135deg, var(--cart-soft) 0%, transparent 100%)`

**Body (alanlar):**
1. **Ürün** (autocomplete): "SKU, isim veya barkod ara…" — min 2 karakter, 200ms debounce
2. **Miktar + Birim** (2 kolon grid)
3. **Tedarikçi** (autocomplete + "+Yeni tedarikçi" inline)
4. **Lot No + SKT** (2 kolon grid)
5. **Not** (textarea, opsiyonel)

**Footer:**
```
                              [İptal]  [✓ Kaydet]
```

**Klavye:**
- `Esc` → drawer kapatır
- `⌘ Enter` (Ctrl+Enter) → kaydet
- `Tab` → sıradaki alan
- İlk açıldığında `#drwProd` (ürün arama) focus

**Validasyon (Zod):**
```ts
const stockInSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit: z.enum(['adet', 'kutu', 'koli', 'kg']),
  supplierId: z.string().uuid(),
  lotNumber: z.string().optional(),
  expiryDate: z.string().date().optional(),
  note: z.string().max(500).optional(),
});
```

**Submit:** Server Action `createStockIn` → Drizzle insert → Supabase Realtime tetiklenir → Activity Feed güncellenir, KPI'lar refresh.

**Toast:** "Stok girişi kaydedildi · ledger #1248" (sweetalert2 veya sonner)

**Tamamlanma sonrası:** Drawer kapanır, focus Hero CTA'sına geri döner.

---

## 5. Command Palette (⌘K)

`⌘K` (Mac) / `Ctrl+K` (Win) ile açılır.

**Modal:** 580px max-width, top 14vh
**Backdrop:** rgba(14, 26, 43, 0.65) + blur(10px)

**3 grup:**

```
🔍 [Eylem, sayfa veya ürün ara...]                [Esc]
─────────────────────────────────────────────────────
EYLEMLER
  📥  Hızlı Stok Girişi              ⌘G
  🛒  Yeni Satış Kaydı               ⌘S
  +   Yeni Ürün Ekle                 ⌘N
  🔄  Yeni Transfer                  ⌘T
  📋  Sayım Başlat                   ⌘C

SAYFALAR
  🏠  Pano                            /admin/dashboard
  📦  Ürünler                         /admin/products
  📊  Stok Hareketleri                /admin/inventory/movements
  ...

ÜRÜNLER (arama sonucu, dinamik)
  [img] Royal Canin Kedi 2kg
  [img] Whiskas 400g · Sığır Etli
  ...
```

**Davranış:**
- Yukarı/Aşağı ok ile gezinme
- Enter ile seçim
- Aranan kelime ile fuzzy match (3 grup arası)
- Ürün araması: API call (debounce 200ms) → results altta

---

## 6. State Management

### 6.1 TanStack Query (Server State)

```ts
// hooks/usePano.ts
export function usePanoData() {
  const queries = useQueries({
    queries: [
      { queryKey: ['kpi', 'inventory-value'], queryFn: fetchInventoryValue, refetchInterval: 60_000 },
      { queryKey: ['kpi', 'today-sales'], queryFn: fetchTodaySales, refetchInterval: 30_000 },
      { queryKey: ['kpi', 'today-stock-in'], queryFn: fetchTodayStockIn, refetchInterval: 30_000 },
      { queryKey: ['kpi', 'active-products'], queryFn: fetchActiveProducts, refetchInterval: 300_000 },
      { queryKey: ['chart', 'trend', period], queryFn: () => fetchTrend(period) },
      { queryKey: ['lowstock'], queryFn: fetchLowStock },
      { queryKey: ['advisor', 'suggestions'], queryFn: fetchAdvisorSuggestions, refetchInterval: 300_000 },
      { queryKey: ['movements', 'recent'], queryFn: fetchRecentMovements, staleTime: 30_000 },
    ]
  });
  // ...
}
```

**Cache stratejisi:**
- KPI'lar 30-60s refetch (Realtime ile invalidation öncelikli)
- Trend chart 5dk cache (büyük query)
- Advisor 5dk cache (rule hesabı pahalı)
- Recent movements 30s staleTime (Realtime ile invalidation öncelikli)

### 6.2 Zustand (Client UI State)

```ts
// stores/uiStore.ts
type UIState = {
  sidebarCollapsed: boolean;
  drawerOpen: 'stock-in' | 'sale' | 'transfer' | 'stocktake' | null;
  commandPaletteOpen: boolean;
  trendPeriod: '7d' | '30d' | '90d';
  toggleSidebar: () => void;
  openDrawer: (type: ...) => void;
  closeDrawer: () => void;
  // ...
};
```

### 6.3 Realtime Subscription

`PanoRealtime` component'ı (client component) mount olduğunda 2 subscribe:

```ts
useEffect(() => {
  const channel = supabase
    .channel(`tenant-${companyId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'stock_movements',
      filter: `company_id=eq.${companyId}`
    }, (payload) => {
      // KPI'ları invalidate
      queryClient.invalidateQueries(['kpi']);
      // Recent movements feed güncelle
      queryClient.invalidateQueries(['movements', 'recent']);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'branch_inventory',
      filter: `company_id=eq.${companyId}`
    }, (payload) => {
      // Düşük stok widget invalidate
      queryClient.invalidateQueries(['lowstock']);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [companyId]);
```

---

## 7. API Endpoint Listesi

| Endpoint | Method | Açıklama |
|---|---|---|
| `/api/admin/kpi/inventory-value` | GET | Toplam envanter değeri + trend |
| `/api/admin/kpi/today-sales` | GET | Bugün satış toplamı + sparkline |
| `/api/admin/kpi/today-stock-in` | GET | Bugün giriş + tedarikçi sayısı |
| `/api/admin/kpi/active-products` | GET | Aktif ürün / plan limit |
| `/api/admin/chart/inventory-trend?period={7d\|30d\|90d}` | GET | Trend chart verisi |
| `/api/admin/low-stock?limit=5` | GET | Pano widget için en kritik 5 |
| `/api/admin/advisor/suggestions` | GET | PetPro Asistanı 3 tip öneri |
| `/api/admin/movements/recent?limit=5` | GET | Son hareketler feed |
| `/api/admin/alerts` | GET | Alerts strip 4 chip |
| `/api/admin/inventory/stock-in` | POST | Hızlı stok girişi (drawer submit) |
| `/api/admin/search?q={query}` | GET | Command palette ürün arama |

Çoğu Server Component'te direkt Drizzle query (API endpoint gerek yok). API endpoint'ler:
- Realtime invalidation sonrası fetch (client-side)
- Mutation'lar (Stok Girişi drawer submit)
- Command palette arama (debounced)

---

## 8. Responsive Davranış

### 8.1 Desktop (>= 1280px)
Full layout, tüm bento kartlar yerinde.

### 8.2 Tablet (1024-1279px)
- `big-kpi` col-12 (full row)
- `chart-card` col-12
- `low-card` col-12
- `advisor-card` col-12
- `feed-card` col-8 (kalsın)
- `empty-card` col-4 (kalsın)

### 8.3 Tablet Küçük (768-1023px)
- Sidebar 72px (icon-only)
- Topbar `cmd` gizli, mobil ☰ buton görünür
- Bento tüm kartlar col-12

### 8.4 Mobile (< 768px)
- Sidebar gizli, bottom-sheet (sb-mobile-open class)
- Hero padding azaltır, stack (greeting → meta → CTA → stats)
- Hero CTAs full-width
- Alerts horizontal scroll
- Bento 1-col, gap 12px
- Big KPI value 38px
- Trend chart 220px height

---

## 9. Klavye Kısayolları

| Kısayol | İşlem |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `i` | Hızlı Stok Girişi drawer |
| `s` | Yeni Satış drawer |
| `t` | Yeni Transfer drawer |
| `c` | Sayım başlat |
| `?` | Kısayolları göster (modal) |
| `Esc` | Drawer / modal kapat |
| `g` `p` | Pano'ya git |
| `g` `u` | Ürünler'e git |
| `g` `h` | Hareketler'e git |

**Implementation:** `useHotkeys` (react-hotkeys-hook) veya custom hook. Input fokustayken kısayollar disable.

---

## 10. Erişilebilirlik

- Tüm interaktif elementler `Tab` ile dolaşılabilir
- Focus ring `--cat` 2px outline
- Drawer/Modal'da Tab trap (focus-trap-react)
- KPI sparkline'lar `aria-hidden` (görsel, veri tabloda erişilebilir)
- Trend chart `<table>` fallback (screen reader için)
- Activity feed `<ul>` semantic, `aria-live="polite"` yeni hareketlerde duyurur
- Alert chip'leri `<button>` (link değil), `aria-label` ile context
- Mascot SVG'ler `aria-hidden`
- prefers-reduced-motion: tüm animasyonlar disable

---

## 11. Performans Hedefleri

| Metrik | Hedef | Strateji |
|---|---|---|
| **LCP** | < 2.5s | Hero RSC + KPI'lar lazy (skeleton) |
| **FCP** | < 1.8s | Verdana sistem font, no font swap |
| **INP** | < 200ms | TanStack Query cache, optimistic update |
| **CLS** | < 0.1 | Alerts strip conditional, mascot sabit dim |
| **TTI** | < 3s | Code split (chart, drawer, palette lazy) |
| **Bundle (JS)** | < 300KB gz | shadcn/ui copy + tree-shake |

**Lazy load:**
- Recharts (Trend chart) — dynamic import
- Leaflet (Pano'da yok, sadece Şubeler)
- Command Palette (⌘K basılınca yüklenir)
- Drawer içerik (açılınca yüklenir)

---

## 12. Test Senaryoları (TARAYICI-TEST-SENARYOLARI.md uyumlu)

### PANO-001 — Hero greeting saat dilimine göre değişir
- 14:00'da `İyi günler, Ahmet 👋`
- 22:00'da `İyi akşamlar, Ahmet 👋`

### PANO-002 — Big KPI envanter değeri realtime güncellenir
- Başka tarayıcıda satış kaydedilir
- 2s içinde KPI değeri düşer (debounce sonrası)

### PANO-003 — Düşük stok widget eşik altı düşmesinde realtime ekler
- Bir ürünü eşik altına çekecek satış yap
- Widget'ta 5s içinde yeni satır belirir (highlight 5s)

### PANO-004 — PetPro Asistanı: sipariş önerisi tıklanır
- Asistan kart "50 adet öner" butonu tıkla
- Stok Girişi drawer ürün+tedarikçi+miktar pre-filled açılır

### PANO-005 — PetPro Asistanı: transfer önerisi tıklanır
- "Transfer aç" tıkla
- Transfer drawer kaynak+hedef+ürün+miktar pre-filled

### PANO-006 — Activity feed realtime + 🚨 işareti
- Süperadmin impersonation altında bir satış kaydet
- Feed'de yeni satırın solunda 🚨 rozet, hover'da "Süper admin tarafından"

### PANO-007 — Command palette ⌘K
- ⌘K bas → palette açılır
- "roy" yaz → Royal Canin ürünleri listelenir
- Enter → ürün detay drawer açılır

### PANO-008 — Hızlı eylem kısayolları
- Pano'da `i` bas → Stok Girişi drawer açılır
- `s` → Satış drawer
- `t` → Transfer drawer
- `c` → Sayım başlat

### PANO-009 — Plan limit yaklaşma uyarısı
- Ayşe (FREE 47/50) ile Pano aç
- Aktif Ürün KPI: ring %90 turuncu (yaklaşma), "Limit'e 2 ürün kaldı"

### PANO-010 — Empty state hepsi yolunda
- Tüm düşük stokları yükselt (eşik altından çıkar)
- Düşük Stok kartı yerine "Hepsi yolunda!" mascot empty state

### PANO-011 — Onboarding kartı yeni tenant
- Yeni tenant, 0 ürün
- Hero yerine "PetStockPro'ya hoş geldin! 3 adım..." kartı

### PANO-012 — Dark mode
- 🌓 tıkla → tüm renkler dark token'lara geçer
- Reload sonrası persist (localStorage)

### PANO-013 — Mobile responsive
- DevTools 390px viewport
- Sidebar gizli, ☰ açılır bottom-sheet
- Bento 1-col, hero stack

### PANO-014 — prefers-reduced-motion
- OS animation reduce aç
- Mesh blob'lar sabit, tilt yok, KPI ticker yok

### PANO-015 — Realtime disconnect
- Network offline
- "Bağlantı kesildi · realtime durdu" subtle banner
- Online olunca otomatik reconnect

---

## 13. Faz 1 ile Tutarsızlıklar (Çözüldü)

| Faz 1 | Bu doküman | Çözüm |
|---|---|---|
| 5 KPI (Bugün Satış, Giriş, Aktif, Envanter, Düşük) | 4 KPI (1 Big + 3 small) | R2 onaylı, Düşük Stok kart olarak ayrı |
| Trend composed (line+bar yeşil+kırmızı) | Tek line/area | R2 onaylı |
| Son hareket 10 entry | 5 entry | R2 onaylı |
| Polling 30s | Supabase Realtime | Tech stack kararı |
| PetPro Asistanı yok | Var (rule-based) | Mockup kararı + onay |
| Düşük stok kategori grupları | Düz liste (kategori tag olarak) | Mockup kararı |
| Hero karşılama bandı | Hero card (premium gradient) | Mockup kararı |

---

## 14. Sıradaki Adımlar (Pano sonrası)

1. ✅ EKRAN-PANO.md (bu doküman)
2. ⏭ Pano onayı sonrası diğer 10 ekran
3. ⏭ DATABASE-SCHEMA.md (Drizzle schema — Pano queryler için temel)
4. ⏭ Sprint planı revize (yeni stack)
5. ⏭ Sprint 0 (project skeleton)

---

*Son güncelleme: 2026-05-12. Mockup-v3 baz alındı, TASARIM-SISTEMI.md ve TECH-STACK.md ile uyumlu.*
