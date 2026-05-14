# Ekran: Şubeler

**URL:**
- Liste: `/admin/branches`
- Detay: `/admin/branches/[id]`
- Yeni: `/admin/branches/new`

**Sidebar yeri:** Kaynaklar grubu, 1. sıra · 📍 Şubeler
**Erişim:** SADECE bayi sahibi (ADMIN branch_id=NULL). Şube müdürü göremez.
**Görünürlük:** Tenant'ta 1 şube varsa sidebar menüsü **gizli**. İlk şube eklenince otomatik görünür.
**Otoritatif referans:** Faz 1 `FAZ1-TASARIM-KARARLARI.md` §16 + §20 R5
**Tasarım sistemi:** `TASARIM-SISTEMI.md`

> Şubeler ekranı çoklu mağaza yönetiminin kalbidir. Default **kart grid** (görsel), alternatif tablo toggle. Harita **opsiyonel** (R5 lazy-load).

---

## 1. Layout

```
┌─────────┬──────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Yönetim > Kaynaklar > Şubeler)           │
│         ├──────────────────────────────────────────────────┤
│         │ ┌─ Üst bar (KPI + CTA + Görünüm toggle) ────────┐│
│         │ │ 📍 3 şube · 👥 5 müdür           [⊞ Kart][▤ Tablo]│
│         │ │                          [+ Yeni Şube]         ││
│         │ └────────────────────────────────────────────────┘│
│         │ ☐ Haritada göster (toggle — default kapalı R5)   │
│         │                                                    │
│         │ ┌─ Kart Grid (default) ─────────────────────────┐│
│         │ │ [Merkez kart] [Şube A kart] [Şube B kart]    ││
│         │ └────────────────────────────────────────────────┘│
│         │                                                    │
│         │ veya ▼ Tablo görünümü                              │
│         │ ┌─ Tablo ────────────────────────────────────────┐│
│         │ │ Ad │ Adres │ Müdür │ Stok değeri │ Aktif ürün ││
│         │ └────────────────────────────────────────────────┘│
└─────────┴──────────────────────────────────────────────────┘
```

## 2. Üst Bar

### 2.1 KPI

```
📍 3 şube   ·   👥 5 müdür   ·   ⚠ 0 sorun
```

- Toplam şube
- Müdür atanmış kullanıcı sayısı (her şube için ayrı user mümkün)
- Sorun: müdür atanmamış şube veya stok değeri = 0

### 2.2 Görünüm Toggle

```
[⊞ Kart] [▤ Tablo]
```

- Default: Kart grid (mockup uyumu)
- Toggle persist localStorage (`branches-view`)

### 2.3 + Yeni Şube CTA

Primary `btn-cat`, → `/admin/branches/new`

### 2.4 Haritada Göster Toggle (R5)

```
☐ Haritada göster
```

Default: **kapalı** (R5 — Leaflet lazy load).

Açılınca:
- Leaflet bundle dynamic import (~45KB)
- Sayfanın üstünde harita render (400px height)
- Şubeler pin olarak görünür
- Tıklama → o şube card'a focus + scroll

---

## 3. Kart Grid (Default)

```
┌─ Kart Grid ──────────────────────────────────────────┐
│                                                        │
│ ┌─ Merkez ────────────┐  ┌─ Şube A ────────────┐    │
│ │ 🏠 Merkez (Kadıköy)  │  │ 🏪 Şube A (Beşiktaş)│    │
│ │ Mağaza müdürü       │  │ Mağaza müdürü       │    │
│ │ Ahmet Şahin          │  │ Zeynep K.            │    │
│ │ 📞 0212 xxx xxxx    │  │ 📞 0212 yyy yyyy    │    │
│ │                       │  │                       │    │
│ │ ─────                 │  │ ─────                 │    │
│ │ 📦 184 ürün           │  │ 📦 142 ürün           │    │
│ │ 💰 ₺85.400 stok       │  │ 💰 ₺48.200 stok       │    │
│ │ ⚠ 3 düşük            │  │ ⚠ 1 düşük            │    │
│ │ 🛒 ₺2.340 bugün       │  │ 🛒 ₺1.480 bugün       │    │
│ │                       │  │                       │    │
│ │ [Detay →]            │  │ [Detay →]            │    │
│ └──────────────────────┘  └──────────────────────┘    │
│                                                        │
│ ┌─ Şube B ────────────┐  ┌─ + Yeni Şube ─────────┐  │
│ │ 🏪 Şube B (Üsküdar)  │  │                        │  │
│ │ Mağaza müdürü        │  │   [Yeni Şube Ekle]    │  │
│ │ ⚠ atanmadı           │  │                        │  │
│ │ ...                   │  │   (kart yer tutucu)   │  │
│ └──────────────────────┘  └────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 3.1 Kart Yapısı (her şube)

```
[İkon] Şube adı (semt)
       Tip: 🏠 Merkez / 🏪 Şube
Müdür: Ahmet Şahin (link)
       atanmadı (kırmızı uyarı)
📞 telefon
📍 adres (kısaltılmış, hover'da tam)

─── İstatistikler ─────────────
📦 184 ürün (parent count)
💰 ₺85.400 envanter değeri
⚠ 3 düşük stok
🛒 ₺2.340 bugün satış

[Detay →] (cart açma)
[⚙ menü: düzenle, kapat]
```

**Hayvan watermark:**
- Merkez kart: Kedi SVG sağ alt köşe
- Diğer şubeler: Köpek SVG

**Tilt animasyon:** Hover'da 3D tilt (Pano kartlarındaki gibi).

**Aktif şube vurgu:**
- Sticky topbar'daki "Aktif Şube Seçici"de o şube seçili ise kart `--cart` border ile vurgulu

### 3.2 Tip İkonları

| Tip | İkon | Anlam |
|---|---|---|
| `MAIN` | 🏠 Merkez | Ana mağaza (tipik 1 adet) |
| `BRANCH` | 🏪 Şube | Diğer şubeler |

Faz 1 §16: "Şube tipi sınıflandırma kaldırıldı — tek tip Şube". Ama UI'da görsel ayrım için "merkez" vs "şube" gösterilir (DB'de zorla tip yok, "ilk eklenen şube otomatik merkez" varsayımı).

### 3.3 Müdür Atanmamış Uyarı

```
Mağaza müdürü
⚠ atanmadı  [👤 Müdür Ata]
```

Kart yine görünür ama müdür alanı kırmızı uyarı + hızlı ata CTA.

---

## 4. Tablo Görünümü (Alternatif)

```
☑ │ Ad      │ Tip   │ Adres                │ Müdür  │ 📦   │ 💰      │ ⚠ │ Bugün  │
☑ │ Merkez  │ 🏠    │ Kadıköy/İstanbul     │ Ahmet  │ 184  │ ₺85.400 │ 3 │ ₺2.340 │
☑ │ Şube A  │ 🏪    │ Beşiktaş/İstanbul    │ Zeynep │ 142  │ ₺48.200 │ 1 │ ₺1.480 │
☑ │ Şube B  │ 🏪    │ Üsküdar/İstanbul     │ ⚠ Yok  │  92  │ ₺18.800 │ 0 │ ₺1.000 │
```

Bulk action: Müdür ata, Pasif et.

---

## 5. Yeni / Düzenle Sayfası

**URL:** `/admin/branches/new` veya `/admin/branches/[id]/edit`

### 5.1 Form Bölümleri

**Bölüm 1: Temel**
```
Şube adı *      [Merkez Kadıköy]
Tip             ◉ Merkez  ○ Şube (sadece ilk şubede merkez)
Açıklama        [opsiyonel - "Ana mağazamız, 3 kat"]
```

**Bölüm 2: Adres**
```
Ülke *          [Türkiye ▼]
İl *            [İstanbul ▼]
İlçe *          [Kadıköy ▼]
Mahalle/Cad.    [Caferağa Mah. Bahariye Cad.]
No / Daire      [No 47/3]
Posta kodu      [34710]
```

**Bölüm 3: Harita (Opsiyonel)**

```
[🗺 Haritada konum belirle]  → tıklayınca Leaflet açılır

Yöntemler:
1. ◉ Adresten otomatik bul (geocode — Nominatim API free)
2. ○ Harita üstüne tıkla (manuel pin)
3. ○ Konumu girme (atla)

[Harita preview 400×300]
   Pin marker konumda
```

**Bölüm 4: İletişim**
```
Telefon         [0212 xxx xx xx]
E-posta         [merkez@petshop.com]
Çalışma saatleri[Pzt-Cmt: 09:00-19:00, Paz: kapalı]
```

**Bölüm 5: Müdür Atama**

```
Şube müdürü     [autocomplete + Yeni davet]
                Mevcut kullanıcılardan seçim
                veya "+ Yeni Kullanıcı Davet Et" mini-modal
```

**Mini-modal yeni davet:**
```
👥 Şube Müdürü Davet Et
E-posta *  [ahmet@petshop.com]
Ad         [Ahmet Şahin]
Rol        ADMIN (branch_id=bu_şube)  (sabit, değiştirilmez)
[İptal]  [Davet Et + Müdür Yap]
```

**Bölüm 6: Operasyonel**

```
☑ Aktif şube
   Sayım, transfer, satış buraya yapılabilir

KDV oranı       [varsayılan tenant geneli]
                Faz 1 §16 R5: KDV override şube bazlı YOK

Para birimi     [TRY ▼]  (tenant geneli, override yok)
```

Footer:
```
[İptal]  [Kaydet]  [Kaydet ve Müdür Ata]
```

---

## 6. Şube Detay Sayfası

**URL:** `/admin/branches/[id]`

```
┌────────────────────────────────────────────────────────┐
│ [← Şubeler]   🏠 Merkez                                 │
│ Kadıköy/İstanbul · 3 yıldır faaliyette                  │
│                          [✏ Düzenle] [⚙ menü] [×Kapat] │
├────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─ Sol kolon (info) ──────┐ ┌─ Sağ (metrik) ────────┐ │
│ │ 📍 Adres                  │ │ KPI'lar (mini)        │ │
│ │ 📞 İletişim               │ │ ─────                 │ │
│ │ 👤 Müdür: Ahmet           │ │ 📦 184 ürün           │ │
│ │ 🕐 Çalışma saatleri      │ │ 💰 ₺85.400            │ │
│ │ 🗺 Harita (Haritada gör) │ │ 🛒 ₺2.340 bugün       │ │
│ │ [+expand harita]          │ │ ⚠ 3 düşük             │ │
│ └─────────────────────────────┘└────────────────────────┘ │
│                                                          │
│ ─── Sekmeler ────────────────────────────────────────   │
│ [Stok] [Hareketler] [Satışlar] [Kullanıcılar] [Ayarlar]│
│                                                          │
│  ▼ Stok sekmesi:                                        │
│   Bu şubedeki tüm variant'lar tablosu                   │
│   (Ürünler ekranı subset'i)                             │
│                                                          │
│  ▼ Hareketler sekmesi:                                  │
│   Sadece bu şube hareketleri (Stok Hareketleri filter) │
│                                                          │
│  ▼ Satışlar sekmesi:                                    │
│   Sadece bu şubenin son 30 gün satışları (chart + tablo)│
│                                                          │
│  ▼ Kullanıcılar sekmesi:                                │
│   Bu şubeye atanmış kullanıcılar                        │
│                                                          │
│  ▼ Ayarlar sekmesi:                                     │
│   Şube bazlı ayarlar (KDV gibi — Faz 2)                │
└────────────────────────────────────────────────────────┘
```

---

## 7. Branch Inventory Tetiklemeleri

### 7.1 Yeni Şube Eklendiğinde

Backend `INSERT` sonrası:

```sql
-- Tenant'ın tüm aktif variant'ları için branch_inventory satırı yarat (stock_qty = 0)
INSERT INTO branch_inventory (company_id, branch_id, variant_id, stock_qty)
SELECT $companyId, $newBranchId, pv.id, 0
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE p.company_id = $companyId
  AND pv.is_active = true;
```

İlk stok hareketi (Stok Girişi) ile gerçek stok yazılır.

### 7.2 Yeni Variant Eklendiğinde

Tüm aktif şubelere `branch_inventory` satırı (stock_qty = 0):

```sql
INSERT INTO branch_inventory (company_id, branch_id, variant_id, stock_qty)
SELECT $companyId, b.id, $newVariantId, 0
FROM branches b
WHERE b.company_id = $companyId
  AND b.is_active = true;
```

Bu trigger Drizzle ORM seviyesinde veya Postgres trigger ile.

### 7.3 Multi-Branch Tetiklemesi

İlk şube `branches.count = 1` → sidebar'da "Şubeler" menüsü **gizli**, Stok Hareketleri Şube kolonu **gizli**, Transfer drawer **gizli**.

İkinci şube `branches.count = 2` → tüm bu UI elementler **otomatik aktif** olur. Hot reload gerek yok (auth.callback'inde set edilen flag).

---

## 8. Soft Delete (Şube Kapatma)

Hard delete YOK. Sadece `is_active = false`.

### 8.1 Kapatma Akışı

```
[⚙ menü] → "Şubeyi kapat"

┌── Şubeyi kapat? ────────────────────────────────────┐
│ Merkez (Kadıköy)                                      │
│                                                       │
│ ⚠ Bu şubede stok var:                                │
│   • 184 ürün                                          │
│   • Toplam değer: ₺85.400                            │
│                                                       │
│ Şubeyi kapatmadan önce stoğu başka şubeye taşı:      │
│                                                       │
│   ● Şube A'ya transfer et (Önerilen)                 │
│   ○ Şube B'ye transfer et                            │
│   ○ Zayiat olarak çıkar (audit'li)                   │
│                                                       │
│   [İptal]  [Transfer Akışını Başlat]                 │
└───────────────────────────────────────────────────────┘
```

**Stok 0 ise:**
```
✓ Bu şubede stok yok.
Şubeyi kapatmak istediğine emin misin?
[İptal]  [Kapat]
```

Kapatma sonrası:
- `branches.is_active = false`
- Müdür atamaları kalır ama UI'da görünmez
- Geçmiş hareketler, satışlar audit log'da korunur
- Yeni hareket yapılamaz (UI + backend kilit)

### 8.2 Geri Açma

Pasif şubeler `?status=archived` filtresi ile görünür. `[Geri Aç]` butonu → tek tıkla aktif eder.

---

## 9. Harita (R5 — Opsiyonel + Lazy)

### 9.1 Harita Kütüphanesi: Leaflet + OpenStreetMap

- **Bundle:** 45KB gzipped
- **Lazy load:** Liste sayfasında toggle açılınca `dynamic import('leaflet')`
- **Tile provider:** OpenStreetMap free tile server
- **Geocode:** Nominatim API (OSM, free, rate-limited 1 req/sec)

### 9.2 Liste Sayfasında Harita

```
┌── Harita 400px height ─────────────────────────────┐
│ [Pin: Merkez - Kadıköy]                              │
│        [Pin: Şube A - Beşiktaş]                      │
│             [Pin: Şube B - Üsküdar]                  │
│                                                       │
│ Tile: OSM standard                                    │
│ Pin tıklama: scroll'da o şube kartına git           │
│ Pin hover: mini info popup (şube adı + adres)        │
└───────────────────────────────────────────────────────┘
```

### 9.3 Detay Sayfasında Harita

```
🗺 Konum
   📍 Caferağa Mah. Bahariye Cad. No 47/3, Kadıköy
   [Haritada gör]  ← lazy expand button

   [▼ Açıldığında 300×400 harita + tek pin]
```

### 9.4 Yeni / Düzenle Formunda Pin Koy

**Yöntem 1: Adresten otomatik bul (Nominatim API)**

```js
const result = await fetch(
  `https://nominatim.openstreetmap.org/search?q=${address}&format=json&limit=1`
);
// result[0].lat, result[0].lon
```

**Yöntem 2: Harita üstüne tıkla**

```js
map.on('click', (e) => {
  setPin(e.latlng);
  reverseGeocode(e.latlng); // adres alanını doldur
});
```

**Yöntem 3: Atla**

`branches.latitude` ve `longitude` NULL olabilir. Liste sayfasında haritada görünmez ama temel stok takip her şey çalışır.

> **⚠ Vitrin için zorunlu (2026-05-13 kararı):** Tenant "Vitrin'de görün" toggle'ı açtığında, **en az bir şubenin lat/lng'si zorunlu**. Aksi takdirde:
> - Vitrin başvuru otomatik reddedilir (validation failed: `MISSING_BRANCH_COORDINATES`)
> - Mesaj: *"Vitrin'de en yakın pet shop sıralaması için en az bir şubenin haritada konumu olmalı. Şubeler ekranından konum belirle."*
> - Pet shop, en az bir şubeye lat/lng eklediğinde yeniden başvurabilir
>
> **Backend trigger:** `companies.storefront_status = 'approved'` geçişinde, ilişkili `branches` tablosunda en az bir kayıt için `latitude IS NOT NULL AND longitude IS NOT NULL` koşulu zorunlu (server-side check, RLS policy değil). Validation pass olmazsa state `pending` kalır. (Detay enum: `DATABASE-SCHEMA.md storefrontStatusEnum` — MANTIK-HATALARI K1 düzeltmesi)
>
> Sebep: Merkezi vitrin'de "en yakın pet shop" sıralaması PostGIS `ST_Distance` ile yapılır. Konumsuz pet shop her aramada en sona düşer ve müşteri tarafından bulunmaz — bu hem müşteri hem pet shop için kötü deneyim.

---

## 10. State Management

### 10.1 TanStack Query

```ts
const { data: branches } = useQuery({
  queryKey: ['branches'],
  queryFn: fetchBranches,
});

const { data: stats } = useQuery({
  queryKey: ['branches', 'stats'],
  queryFn: fetchBranchStats,
  refetchInterval: 60_000,  // KPI'lar 1dk refresh
});
```

### 10.2 Realtime

- Yeni şube eklenince listede görünür
- Branch_inventory değişiminde kart KPI güncellenir

---

## 11. API Endpoints

| Endpoint | Method | Açıklama |
|---|---|---|
| `/api/admin/branches` | GET | Liste + stats |
| `/api/admin/branches` | POST | Yeni şube + auto branch_inventory rows |
| `/api/admin/branches/[id]` | GET | Detay |
| `/api/admin/branches/[id]` | PATCH | Düzenle |
| `/api/admin/branches/[id]/deactivate` | POST | Pasif et (stok 0 ise) |
| `/api/admin/branches/[id]/reactivate` | POST | Geri aç |
| `/api/admin/branches/[id]/transfer-all` | POST | Tüm stoğu başka şubeye taşı |
| `/api/admin/branches/[id]/assign-manager` | POST | Müdür ata |
| `/api/admin/branches/geocode` | POST | Nominatim proxy (rate limit) |

---

## 12. Empty State

```
[kedi+pin mascot]
İkinci şubeni eklemeye hazır mısın?
Stok ayrı havuz, transfer yapılabilir, raporlar şube karşılaştırma alabilir.
[+ İkinci Şubeyi Ekle]
```

Tek şubeli tenant'ta zaten menü gizli. Ama doğrudan `/admin/branches` URL ile gelirse bu empty state.

---

## 13. Responsive

- **Desktop:** Kart grid 3-col veya 4-col (1280+)
- **Tablet:** 2-col kart grid
- **Mobile:** 1-col kart, harita full-width

---

## 14. Test Senaryoları

### BRN-001 — Tek şubeli tenant: sidebar Şubeler gizli
### BRN-002 — İkinci şube eklenince sidebar otomatik aktif
### BRN-003 — Kart grid default, tablo toggle
### BRN-004 — Yeni şube: temel form bölümleri
### BRN-005 — Yeni şube: branch_inventory satırları otomatik yaratılır
### BRN-006 — Yeni variant: tüm şubelerde branch_inventory satırı
### BRN-007 — Müdür ata: mevcut user
### BRN-008 — Müdür ata: yeni davet (mini-modal)
### BRN-009 — Müdür atanmamış uyarı kart'ta
### BRN-010 — Haritada göster toggle: Leaflet lazy load
### BRN-011 — Yeni şube formu: adres geocode (Nominatim)
### BRN-012 — Yeni şube formu: harita üstüne tıkla pin
### BRN-013 — Şube detay sekmeler (Stok/Hareketler/Satışlar/Kullanıcılar)
### BRN-014 — Soft delete: stok varsa transfer akışına yönlendir
### BRN-015 — Soft delete: stok 0 ise direkt kapat
### BRN-016 — Pasif şube geri aç
### BRN-017 — Branch_inventory KDV override YOK (R5)
### BRN-018 — Harita pin tıklama scroll kart'a
### BRN-019 — Multi-branch transfer drawer şube müdürü kaynak sabit
### BRN-020 — Şube müdürü: Şubeler sayfasına 403

---

## 15. Faz 1 ile Tutarlılık

| Faz 1 | Bu doküman | Durum |
|---|---|---|
| §16 kart grid default | Aynen | ✅ |
| §16 R5 harita opsiyonel + lazy | Aynen | ✅ |
| §16 KDV override şube YOK | Aynen | ✅ |
| §16 Leaflet + OSM | Aynen | ✅ |
| §16 branch_inventory tetiklemeleri | Aynen | ✅ |
| Tek şube tenant menü gizli | Aynen | ✅ |
| Soft delete + stok kontrolü | Aynen | ✅ |

---

## 16. Sıradaki

⏭ **EKRAN-TEDARIKCILER.md**

---

*Son güncelleme: 2026-05-12.*
