# Ekran: Stok Hareketleri (Ledger)

**URL:** `/admin/inventory/movements`
**Sidebar yeri:** Envanter grubu, 3. sıra · 📊 Stok Hareketleri
**Erişim:** ADMIN (bayi sahibi + şube müdürü kendi şubesi) + STAFF (kasiyer — sadece kendi şube hareketlerini görür; **sadece "Satış" tipi kaydedebilir** — Stok Girişi/Transfer/Sayım/Geri Alma butonları gizli; ledger read-only). Tam yetki matrisi: `EKRAN-KULLANICILAR.md §12.5` (2026-05-14 OT2-5).
**Otoritatif referans:** Faz 1 `FAZ1-TASARIM-KARARLARI.md` §11.2 + §20 R1/R3
**Tasarım sistemi:** `TASARIM-SISTEMI.md`

> Stok Hareketleri **immutable ledger** — tüm stok değişimlerinin kara kutusu. INSERT-only, UPDATE/DELETE yasak. Geri alma = ters hareket yazılır. R1 ile tek-katman (24 saat herkes + SUPERADMIN süresiz). R3 ile audit hash zinciri **YOK**, basit JSON log.

---

## 1. Layout Genel Bakış

```
┌─────────┬──────────────────────────────────────────────────┐
│         │ Topbar (Yönetim > Envanter > Stok Hareketleri)   │
│ Sidebar ├──────────────────────────────────────────────────┤
│         │ ┌─ Üst bar ─────────────────────────────────────┐│
│         │ │ "Stok Hareketleri" başlık                     ││
│         │ │              [+ Yeni Hareket ▼] [⬇ Excel]    ││
│         │ └────────────────────────────────────────────────┘│
│         │ ┌─ Filtre paneli (collapsed) ───────────────────┐│
│         │ │ Tarih · Tip · Ürün · Şube · Kullanıcı · ⋯    ││
│         │ └────────────────────────────────────────────────┘│
│         │ ┌─ Özet bar (sticky, filtre sonucu) ────────────┐│
│         │ │ 📥 +47 giriş │ 📤 -28 çıkış │ 🔄 8 transfer │📋2 │
│         │ │ Değer akışı: +₺3.450 / -₺2.140 = +₺1.310     ││
│         │ └────────────────────────────────────────────────┘│
│         │ ┌─ Ana tablo ───────────────────────────────────┐│
│         │ │ Tarih│Tip│Ürün│Önce→Sonra│Miktar│Şube│Kullanıcı│
│         │ │ ...                                            ││
│         │ └────────────────────────────────────────────────┘│
│         │ [Sayfalama]                                       │
│         │                                                    │
│         │ + Detay drawer (sağdan slide-in)                  │
│         │ + 4 hareket drawer'ı                              │
└─────────┴──────────────────────────────────────────────────┘
```

## 2. Üst Bar

### 2.1 "+ Yeni Hareket" Dropdown

Primary CTA (`btn-cat` turuncu gradient), dropdown 4 seçenek:

```
[+ Yeni Hareket ▼]
   ├── 📥 Stok Girişi          (i)
   ├── 📤 Çıkış / Satış         (s)
   ├── 🔄 Transfer              (t)
   └── 📋 Sayım Başlat          (c)
```

- Her seçenek tıklayınca ilgili drawer açar
- Klavye kısayolları parantez içinde gösterilir
- Plan limit doluysa Stok Girişi/Satış aktif kalır (mevcut ürünler için), sadece yeni ürün eklemeyi engellemez

### 2.2 Excel Export

`[⬇ Excel]` — Filtreli liste export.
- CSV ve XLSX dosya seçeneği
- Sütunlar: Tarih, Tip, Ürün, SKU, Variant, Önce, Sonra, Miktar, Birim Fiyat, Toplam Değer, Şube, Tedarikçi/Müşteri, Sebep, Not, Kullanıcı, IP, 🚨 Süperadmin
- Default 30 günle limitlenir (büyük tenant'lar için), `?from=...&to=...` ile genişletilebilir

---

## 3. Filtre Paneli (Collapsed)

```
┌─ [▼] Filtreler  (3 aktif)                    [Tümünü Temizle] ┐
│                                                                  │
│ Tarih:       ◉ Son 7g  ○ Son 30g  ○ Bu ay  ○ Özel [_]─[_]    │
│ Tip:         ☑ Giriş  ☑ Çıkış  ☐ Transfer  ☐ Sayım           │
│ Hareket alt-tip (sadece Çıkış): ☐ Satış ☐ Zayiat ☐ İade ⋯     │
│ Ürün:        [autocomplete chip multi]                          │
│ Şube:        [Tüm şubeler ▼]  (multi)                           │
│ Kullanıcı:   [Herkes ▼]                                          │
│ Tedarikçi:   [autocomplete]                                      │
│                                                                  │
│ Özel filtreler:                                                  │
│ ☐ 🚨 Süperadmin işaretli                                        │
│ ☐ ⚠ Sayım farkı (sebebi dolu olan)                              │
│ ☐ ⮌ Geri alınmış hareketler                                     │
│ ☐ ↻ Karşı hareket (geri alma sonucu)                            │
└──────────────────────────────────────────────────────────────────┘
```

**URL persist:**
```
/admin/inventory/movements?from=2026-04-15&type=in,out&product=12,45&superadmin=true
```

**Davranış:**
- Header click → expand/collapse
- Aktif filtre sayısı chip
- Tüm değişiklikler URL query string'e yansır
- "Tümünü Temizle" tek tık reset

---

## 4. Özet Bar (Sticky)

Filtre uygulandıktan sonra sticky bar ana tablonun üstünde:

```
─────────────────────────────────────────────────────────────────
📥 +47 giriş │ 📤 -28 çıkış │ 🔄 8 transfer │ 📋 2 sayım │ Toplam 85 hareket
Değer akışı: Giriş +₺3.450 · Çıkış -₺2.140 · Transfer (nötr) · Net: +₺1.310
─────────────────────────────────────────────────────────────────
```

- 4 tip için sayaç + toplam
- Değer akışı: cost-based hesap
- Filtre boş ise (son 7g default) o periyodun özeti
- Realtime invalidation ile güncellenir

---

## 5. Ana Tablo

### 5.1 Kolonlar

| Kolon | Genişlik | İçerik |
|---|---|---|
| **Tarih** | 130px | `07 May, 14:32` (DateTime, hover'da relative `2 dk önce`) |
| **Tip** | 100px | Renkli rozet ikon + tip adı + işaretler (🚨/⚠/⮌) |
| **Ürün** | flex | Parent ad + variant etiket + SKU küçük gri |
| **Önce → Sonra** | 130px | `25 → 20` formatında |
| **Miktar** | 90px | İşaretli sayı `+24` veya `−3` (yeşil/kırmızı) |
| **Şube** | 100px | Şube adı (tek-şube tenant'ta **gizli**) |
| **Kullanıcı** | 120px | Avatar 24×24 + isim |
| **chevron** | 32px | Detay aç işareti |

### 5.2 Tip Rozet Stilleri

| Tip | Background | Foreground | İkon | İşaret |
|---|---|---|---|---|
| **Giriş** (`t-in`) | `--arrow-soft` | `--arrow-700` | 📥 | + miktar yeşil |
| **Çıkış/Satış** (`t-out`) | `--cat-soft` | `--cat-700` | 📤 / 🛒 | − miktar turuncu |
| **Transfer** (`t-trans`) | `--bars-soft` | `--bars-700` | 🔄 | ↔ miktar mavi |
| **Sayım** (`t-count`) | `--dog-soft` | `--dog` | 📋 | ± miktar antrasit |

### 5.3 Satır İşaretleri

- 🚨 (sol kenar): `performed_as_superadmin = true` → süperadmin impersonation altında yapıldı
- ⚠ (sağ ürün adı yanında): Sayım farkı (fark sebebi dolu)
- ⮌ (tarih solunda): Geri alınmış (karşı hareket var)
- ↻ (tarih solunda): Karşı hareket (başka hareketi geri alma sonucu)

### 5.4 Sıralama

- Default: `created_at DESC` (en yeni en üstte)
- Tıklanabilir: Tarih (yön değiştir), Tip (gruplama), Miktar (büyüklük)

### 5.5 Sayfalama

50 satır/sayfa default. Büyük tenant'larda virtual scroll değil pagination — performance ve URL bookmark'ı için.

### 5.6 Hover Satır

Satırın üstüne mouse gelince:
- Background: `--surface-2` hover renk
- Sağda 3 ikon: 👁 Detay · ⮌ Geri al (eligible ise) · ⋯ menü

---

## 6. Detay Drawer

Bir satıra tıklanınca sağdan slide-in drawer (480px max-width).

### 6.1 Header

```
[← geri]  Stok Girişi #1248                           [⮌ Geri al]  [×]
          07 May 2026, 14:32 · 2 dk önce
```

- Hareket ID (`stock_movements.id`)
- Geri al butonu: koşullu (R1 mantığı, §10)

### 6.2 Bölümler

**Bölüm 1: Ürün + Variant**
```
[img] Royal Canin Adult Kedi
      Variant: 2kg · SKU: RC-K-ADL-2KG · 8690000123456
      Kategori: Mama > Kedi Maması · 🐱 Kedi
```

**Bölüm 2: Miktar + Stok Değişimi**
```
                    Önce       Sonra
Merkez şubesi       25  →     49      (+24)
                              ▲
                              Bu hareket
```

Tek şube: tek satır
Multi-branch transfer'de: iki şube de gösterilir

**Bölüm 3: Değer**
```
Birim alış:   ₺180.00
Toplam alış:  ₺4.320     (24 × ₺180)
[Sadece Giriş için]

Birim satış:  ₺250.00
Toplam ciro:  ₺750.00    (3 × ₺250)
İndirim:      −₺50.00    (%6.7)
Net:          ₺700.00
[Sadece Satış için]
```

**Bölüm 4: Bağlam**
```
Tedarikçi: Ahmet Petshop A.Ş. (Giriş)
Müşteri: 0532***1278 (Satış)
Sebep: SKT Geçmiş (Çıkış / Sayım)
Lot No: LOT-2026-0034
SKT: 2027-03-15
Not: "..."
```

**Bölüm 5: Yapan (Audit)**
```
Kullanıcı: Ahmet Şahin (Bayi sahibi)
Tarih: 07 May 2026, 14:32:18 UTC+3
IP: 78.187.x.x (İstanbul)
Cihaz: Chrome 130 · Windows 11
[🚨 Süperadmin tarafından yapıldı]   ← varsa
   Session: super-2026-05-07-aa12bb
```

**Bölüm 6: Geri Alma Geçmişi**
```
[Bu hareket henüz geri alınmadı]

veya:

⮌ Geri alındı:
   Karşı hareket #1252
   07 May 2026, 15:00 · Ahmet Şahin
   Sebep: "Yanlış miktar"
```

**Footer (eğer geri alma eligible):**
```
[Geri Al]  [Karşı Hareket Gir]  [Kapat]
```

### 6.3 Audit Hash YOK (R3)

Mockup'taki hash zinciri **kaldırıldı** (Faz 1 R3 kararı). Audit log basit JSON:
- before_state
- after_state
- IP, user_agent
- performed_as_superadmin

Hash hesabı yok, validation yok. Yasal denetlenebilirlik için yeterli.

---

## 7. 4 Hareket Drawer'ı

### 7.1 📥 Stok Girişi Drawer (`/admin/operations/stock-in` veya `?action=stock-in`)

```
┌── Yeni Stok Girişi ─────────────────────────[×]┐
│ Tedarikçiden gelen mal kabulü                  │
├──────────────────────────────────────────────────┤
│                                                  │
│ Tarih *           [07 May 2026 ▼]               │
│ Şube *            [Merkez ▼]                    │
│ Tedarikçi *       [autocomplete + Yeni]         │
│ Belge No          [İrsaliye no opsiyonel]       │
│                                                  │
│ Ürün satırları (en az 1):                       │
│ ┌──────────────────────────────────────────────┐ │
│ │ # │ Ürün (autocomplete)        │Adet│Birim alış│SKT │Lot││
│ │ 1 │ Royal Canin Kedi 2kg       │ 24 │ ₺180     │___ │___││
│ │ 2 │ Whiskas 400g · Sığır       │ 50 │ ₺  8     │___ │___││
│ │ 3 │ ...                                              ││
│ │ [+ Satır ekle]                                       ││
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Toplam: 74 adet · ₺4.720                        │
│                                                  │
│ Not (opsiyonel):                                │
│ [textarea]                                       │
│                                                  │
├──────────────────────────────────────────────────┤
│              [İptal]  [Kaydet]  [Kaydet ve Yeni]│
└──────────────────────────────────────────────────┘
```

**Field detayları:**

- **Tedarikçi *:** Autocomplete, min 2 karakter. "+ Yeni tedarikçi" inline modal (ad + telefon minimum, sonra Tedarikçiler ekranından detaylanır).
- **Ürün satırları:**
  - Ürün autocomplete: variant level (`Royal Canin Kedi 2kg`)
  - Adet: integer > 0
  - Birim alış: number > 0, default ürün'ün son alış fiyatı
  - SKT: opsiyonel (kategori bazlı zorunlu — mama/ilaç)
  - Lot: opsiyonel
- **Kaydet ve Yeni:** Form temizlenir ama tedarikçi + şube + tarih korunur

**Validasyon:**
- En az 1 ürün satırı
- Tedarikçi zorunlu
- Her satırda ürün + adet > 0 + birim alış >= 0
- Mama/ilaç kategorisi → SKT zorunlu

**Submit:**
- Backend: Server Action → Drizzle transaction:
  1. `stock_movements` tablosuna 1 entry/satır (N ürün = N entry)
  2. `branch_inventory.stock_qty` artır
  3. `audit_logs` entry
- Realtime → Pano feed güncellenir, KPI'lar refresh
- Toast: "74 adet stok girişi kaydedildi · ledger #1248-1250"

### 7.2 📤 Çıkış / Satış Drawer

```
┌── Yeni Çıkış / Satış ──────────────────────[×]┐
│ Stok çıkışı kaydet                              │
├──────────────────────────────────────────────────┤
│                                                  │
│ Tarih *      [07 May 2026 ▼]                    │
│ Şube *       [Merkez ▼]                         │
│ Tip *        [Satış ▼]                          │
│              ┌────────────────────┐             │
│              │ ◉ Satış            │             │
│              │ ○ Zayiat (fire)    │             │
│              │ ○ Hediye           │             │
│              │ ○ Numune           │             │
│              │ ○ İade (müşteriye) │             │
│              │ ○ Şube içi tüketim │             │
│              │ ○ Diğer (sebep yaz)│             │
│              └────────────────────┘             │
│                                                  │
│ Müşteri    [Misafir alıcı           ]            │
│            💡 İsim/telefon serbest text — Faz 3   │
│            müşteri DB açılana kadar. Veresiye     │
│            (credit) seçilirse ZORUNLU (S2).       │
│                                                  │
│ Ürün satırları:                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ # │ Ürün           │Adet│Birim fiyat│Anlık stok││
│ │ 1 │ Royal Canin 2kg│ 3  │ ₺250      │25→22 ✓  ││
│ │ 2 │ Whiskas 400g   │ 5  │ ₺12       │ 8 → 3 ⚠ ││
│ │ [+ Satır ekle]                                ││
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Toplam: 8 adet · ₺810                           │
│ İndirim:    [%5  ▼] → -₺40.50                   │
│ Net:        ₺769.50                              │
│                                                  │
│ Ödeme tipi *  [Nakit ▼]                         │
│ [Sadece Satış için: Nakit/Kart/Havale/Veresiye]│
│                                                  │
│ ⚠ "Veresiye" (credit) seçilirse:                │
│   • Müşteri alanı ZORUNLU (boş bırakılamaz)     │
│   • Ad + telefon önerilir ("Ahmet Y. 0532...")  │
│   • Tahsil edilince: Raporlar > 💳 Açık Krediler│
│     listesinde "Krediyi kapama" tıkla            │
│     → credit_paid_at set + audit log             │
│                                                  │
│ Not (opsiyonel):                                │
│                                                  │
├──────────────────────────────────────────────────┤
│   [İptal]  [Kaydet]  [Kaydet & Yazdır]          │
└──────────────────────────────────────────────────┘
```

**Tip bazlı görünüm:**
- **Satış:** Müşteri (Faz 2), Birim fiyat, İndirim, Ödeme tipi
- **Zayiat / Hediye / Numune / İade / Şube içi tüketim:** Birim fiyat = 0 (cost-based), ödeme tipi gizli, müşteri yerine "Sebep" textbox
- **Diğer:** "Sebep" textarea zorunlu

**Anlık stok ön-izleme:**
- Her ürün satırında, adet girildikçe **canlı** hesap:
  - `25 → 22 ✓` (yeterli, yeşil)
  - `8 → 3 ⚠` (eşik altına düşüyor, turuncu)
  - `2 → -1 ❌` (eksi stok, kırmızı, **kaydet bloklanır**)

**Eksi stoğa izin YOK:**
- Adet > anlık stok → inline hata `Stok yetersiz: 2 mevcut, 5 isteniyor`
- Submit bloklanır
- Disiplin kuralı (Faz 1 R1)

**Kaydet & Yazdır:**
- Kaydet sonrası browser `window.print()` ile basit makbuz
- PDF üretimi yok (Faz 2 Nilvera e-fatura ile)

**Submit:**
- Server Action → Drizzle transaction:
  1. `stock_movements` entry (N satır)
  2. `branch_inventory.stock_qty` azalt (transaction içinde row lock ile race önler)
  3. `audit_logs` entry
- Concurrent satış edge case: PostgreSQL row-level lock (`SELECT ... FOR UPDATE`)
- Realtime → Pano güncel, düşük stok widget tetiklenir

### 7.3 🔄 Transfer Drawer

```
┌── Yeni Transfer ───────────────────────────[×]┐
│ Şubeler arası stok aktarımı                    │
├──────────────────────────────────────────────────┤
│                                                  │
│ Tarih *           [07 May 2026 ▼]               │
│ Kaynak şube *     [Merkez ▼]                    │
│ Hedef şube *      [Şube A ▼] (kaynak ≠ hedef)   │
│                                                  │
│ Ürün satırları:                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ # │ Ürün           │Adet│Kaynak stok│Sonra││
│ │ 1 │ Royal Canin 2kg│ 5  │ 25 → 20   │ 8→13││
│ │ [+ Satır ekle]                                ││
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Durum:                                           │
│ ◉ Yola çıktı (kaynak'tan düşer, hedefe sonra eklen) │
│ ○ Direkt teslim alındı (anında iki taraf)        │
│                                                  │
│ Tahmini varış: [09 May 2026 ▼] (opsiyonel)      │
│                                                  │
│ Not (opsiyonel):                                │
│                                                  │
├──────────────────────────────────────────────────┤
│              [İptal]  [Kaydet]                  │
└──────────────────────────────────────────────────┘
```

**Validasyon:**
- Kaynak ≠ Hedef (UI: kaynak seçilince hedef dropdown'da disabled)
- Adet > 0 ve <= kaynak stok
- Her satır validate

**Durum kararı:**
- **Yola çıktı:** Sadece kaynak `−adet` ledger entry. Hedef değişmez, transit pool **YOK** (Faz 1 kararı).
  - Hedef şube müdürü "Teslim aldım" tıklayıncaya kadar:
    - Ledger'da hareket görünür (durum: in_transit)
    - Hedef stok değişmez
  - "Teslim aldım" → ikinci ledger entry (hedef `+adet`)
- **Direkt teslim alındı:** İki entry birden (kaynak `−`, hedef `+`), aynı timestamp, transfer_group_id ile ilişkilendirilir.

**Transit hareketler nasıl tamamlanır?**
- Hedef şube müdürü `/admin/operations/transfer` sayfasında "Yola çıktı" filtreli görür
- Her transfer satırında `[Teslim Aldım]` butonu
- Tıklama → onay modal → ikinci ledger entry

### 7.4 📋 Sayım Başlatıcı Drawer

Stok Hareketleri'nden Sayım drawer'ı **başlatıcıdır** — kullanıcıyı sayım tam-sayfa workflow'a yönlendirir (`/admin/inventory/stocktake/[id]`).

```
┌── Yeni Sayım Başlat ───────────────────────[×]┐
│ Fiziki sayım workflow                           │
├──────────────────────────────────────────────────┤
│                                                  │
│ Şube *           [Merkez ▼]                     │
│                                                  │
│ Sayım modu *                                     │
│  ◉ Tam sayım (tüm aktif ürünler)                │
│  ○ Kategori bazlı [Mama ▼]                      │
│  ○ Manuel seçim (sonraki sayfada seç)           │
│                                                  │
│ ☑ Yumuşak kilit                                 │
│   Sayım açıkken satış yapılabilir.              │
│   Sayım listesi otomatik güncellenir.            │
│   (Sert kilit: satış kilitlenir — riskli)       │
│                                                  │
│ Not (opsiyonel):                                │
│ [Aylık sayım, Mayıs 2026]                       │
│                                                  │
├──────────────────────────────────────────────────┤
│         [İptal]  [Başlat → Sayım Sayfasına]    │
└──────────────────────────────────────────────────┘
```

**Submit:**
- `stocktakes` tablosuna yeni row (`status: in_progress`, `started_at: now`)
- `stocktake_items` tablosuna seçilen ürünlerin variant satırları (sistem stoğu snapshot)
- Yönlendirme: `/admin/inventory/stocktake/[id]` (tam sayfa workflow)

Detay: `EKRAN-SAYIM.md`

---

## 8. Empty State

### 8.1 Hiç hareket yok (yeni tenant)

```
┌────────────────────────────────────┐
│                                     │
│        [kedi+köpek+kalp mascot]     │
│                                     │
│         İlk hareketi kaydet         │
│  Stok takibine başlamak için yeni  │
│  hareket gir. Stok girişi tedarik- │
│  çiden, satış müşteriden başlar.   │
│                                     │
│       [+ İlk Hareketi Kaydet]      │
└────────────────────────────────────┘
```

### 8.2 Filtre sonucu boş

```
"Son 7 gün · Tip: Transfer" için sonuç yok.
Filtre genişlet veya 30g'ne bak.
```

---

## 9. Geri Alma (R1 — Tek Katman)

Faz 1 §20 R1: Geri alma artık **tek katman**:

| Rol | Süre limiti |
|---|---|
| **ADMIN** (bayi sahibi + şube müdürü) | **24 saat** |
| **SUPERADMIN** | Süresiz (🚨 audit ile) |

### 9.1 Geri Alma Akışı

1. Detay drawer aç (her hareket için)
2. Sağ üstte `[⮌ Geri al]` buton
3. Eligible ise aktif, değilse disabled + tooltip
4. Tıklama → onay modal:

```
┌── Bu hareketi geri al? ──────────────────────┐
│                                                │
│ Royal Canin Kedi 2kg                           │
│ Stok Girişi · +24 adet · Merkez                │
│ 07 May 2026, 14:32 · 23 saat önce             │
│                                                │
│ Geri alındığında ne olur?                     │
│ • Karşı yönde yeni ledger entry yazılır       │
│ • Stok geri yüklenir (49 → 25)                │
│ • Bu hareket "⮌ Geri alındı" işareti alır    │
│ • Karşı hareket "↻ Karşı hareket" işareti     │
│                                                │
│ Sebep (zorunlu):                               │
│ [Yanlış miktar girilmişti]                     │
│                                                │
│         [İptal]  [⮌ Geri Al]                  │
└────────────────────────────────────────────────┘
```

5. Onay → Server Action:
   - Mevcut hareket: `reversed_by_id` set edilir
   - Yeni entry: `quantity` ters işaretli, `reverses_id` referans
   - `branch_inventory` geri yüklenir
   - Audit log entry

### 9.2 Süresi Geçmiş Geri Alma

24 saat geçmiş ADMIN için:
- Buton **disabled**
- Tooltip: `24 saat süresi geçti. Karşı hareket gir →`
- `[Karşı Hareket Gir]` butonu aktif → Stok Çıkışı drawer açar (tip: İade veya Diğer, sebep pre-filled)

### 9.3 SUPERADMIN Süresiz

Süperadmin paneline impersonation altında veya direkt panel üzerinden:
- 30 gün önceki hareketi bile geri alabilir
- Onay modal'da **🚨 Bu işlem audit'e işlenecek** uyarısı
- `performed_as_superadmin = true` damgası

### 9.4 Sayım Geri Alınamaz

```
[Geri al] butonu hiç görünmez
veya
disabled + tooltip: "Sayım geri alınamaz, tekrar say →"
[Tekrar Say] → Sayım Başlat drawer
```

**Sebep:** Sayım fiziki gerçekliği yansıtır. Geri almak ledger'ı kararsızlaştırır.

---

## 10. Audit Log (Basit — R3)

Faz 1 §20 R3: Audit hash zinciri **KALDIRILDI**. Basit JSON log yeter:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action_type VARCHAR(50),         -- 'stock_movement.create', 'product.update', 'plan.upgrade'
  entity_type VARCHAR(50),          -- 'stock_movement', 'product', 'company'
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT,
  performed_as_superadmin BOOLEAN DEFAULT false,
  superadmin_session_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Hash zinciri YOK:**
- Hash hesaplaması yok
- Önceki entry'ye referans yok
- Validation `mvn audit:verify` gibi tool yok

**Yasal denetlenebilirlik için yeterli:**
- IP + user_agent + timestamp + JSON state hareket bilgisi
- KVKK + e-fatura denetimleri için yeter
- Hash chain ileride yasal baskı olursa Faz 3'te eklenir

---

## 11. State Management

### 11.1 URL → Filter

```ts
const filters = movementFiltersSchema.parse({
  from: searchParams.from || sub30Days,
  to: searchParams.to || today,
  type: searchParams.type?.split(','),
  subtype: searchParams.subtype?.split(','),
  productId: searchParams.product?.split(','),
  branchId: searchParams.branch?.split(','),
  userId: searchParams.user,
  supplierId: searchParams.supplier,
  superadmin: searchParams.superadmin === 'true',
  stocktake_diff: searchParams.stocktake_diff === 'true',
  reversed: searchParams.reversed === 'true',
  page: Number(searchParams.page) || 1,
});
```

### 11.2 TanStack Query + Realtime

```ts
const { data, isPending } = useQuery({
  queryKey: ['movements', filters],
  queryFn: () => fetchMovements(filters),
  staleTime: 30_000,
});

// Realtime: yeni hareket olunca listeyi başa ekle + özet bar invalidate
useEffect(() => {
  const channel = supabase
    .channel('movements-feed')
    .on('postgres_changes', {
      event: 'INSERT',
      table: 'stock_movements',
      filter: `company_id=eq.${companyId}`
    }, (payload) => {
      // Optimistic prepend
      queryClient.setQueryData(['movements', filters], (old) => [payload.new, ...old]);
      // Özet bar invalidate
      queryClient.invalidateQueries(['movements-summary']);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [companyId, filters]);
```

### 11.3 Optimistic Update (Drawer Submit)

Drawer'lar submit edildiğinde:
- Frontend optimistically prepend
- Backend confirm sonra real ID ile replace
- Hata: rollback + toast

---

## 12. API Endpoint Listesi

| Endpoint | Method | Açıklama |
|---|---|---|
| `/api/admin/movements` | GET | Liste + filtre + pagination |
| `/api/admin/movements/[id]` | GET | Tek hareket detayı |
| `/api/admin/movements/summary` | GET | Özet bar (filtreli) |
| `/api/admin/movements/stock-in` | POST | Stok girişi (N satır transaction) |
| `/api/admin/movements/sale` | POST | Satış / çıkış |
| `/api/admin/movements/transfer` | POST | Transfer (yola çıktı) |
| `/api/admin/movements/transfer/[id]/receive` | POST | Transfer "teslim aldım" |
| `/api/admin/movements/[id]/reverse` | POST | Geri al (R1 mantığı) |
| `/api/admin/movements/export` | GET | CSV/Excel export |
| `/api/admin/movements/check-stock` | POST | Anlık stok kontrolü (satış drawer ön-izleme) |

---

## 13. Responsive Davranış

### 13.1 Desktop (>= 1280px)
Tam layout, tüm kolonlar.

### 13.2 Tablet (1024-1279px)
Şube + Kullanıcı tek hücreye stack.

### 13.3 Tablet Küçük (768-1023px)
Tablo yerine kart liste:
```
┌────────────────────────────────────┐
│ 📥 +24  Royal Canin 2kg            │
│ Stok Girişi · Merkez · 2 dk önce   │
│ 25 → 49 · Ahmet                    │
└────────────────────────────────────┘
```

### 13.4 Mobile (< 768px)
- Filtreler bottom-sheet drawer
- Tablo kart liste 1-col
- Drawer'lar full-screen (sağdan değil bottom-sheet)

---

## 14. Klavye Kısayolları

| Kısayol | İşlem |
|---|---|
| `i` | Stok Girişi drawer |
| `s` | Satış drawer |
| `t` | Transfer drawer |
| `c` | Sayım başlat |
| `f` | Filtre toggle |
| `/` | Arama |
| `↑↓` | Satır gez |
| `Enter` | Detay drawer |
| `Esc` | Drawer kapat |
| `Ctrl+Z` | Son hareket geri al (24sa içinde) |

---

## 15. Erişilebilirlik

- Tablo `<table>` semantic
- Filtre paneli `<details>/<summary>`
- Drawer Tab trap
- Tip rozetleri renge ek olarak ikon (renk körlüğü)
- 🚨 işareti `aria-label="Süperadmin tarafından yapıldı"`
- ⮌ Geri al butonu `aria-label`

---

## 16. Performans

| Metrik | Hedef | Strateji |
|---|---|---|
| **LCP** | < 2.5s | Server Component + Drizzle index |
| **Filtre değişikliği** | < 300ms | URL push + RSC streaming |
| **Realtime gecikme** | < 2s | Supabase Realtime native |
| **Drawer açılma** | < 100ms | Local state, no fetch |
| **Stok ön-izleme** | < 200ms | Optimistic + canlı hesap |

### 16.1 DB Index'ler

```sql
CREATE INDEX idx_movements_company_date ON stock_movements(company_id, created_at DESC);
CREATE INDEX idx_movements_company_type ON stock_movements(company_id, type);
CREATE INDEX idx_movements_branch ON stock_movements(branch_id, created_at DESC);
CREATE INDEX idx_movements_variant ON stock_movements(variant_id);
CREATE INDEX idx_movements_supplier ON stock_movements(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_movements_superadmin ON stock_movements(performed_as_superadmin) WHERE performed_as_superadmin = true;
```

---

## 17. Test Senaryoları

### LDG-001 — Boş tenant empty state
### LDG-002 — Filtre paneli collapse/expand
### LDG-003 — Tarih aralığı "Son 7 gün" preset
### LDG-004 — Tip multi-filter: Giriş + Transfer
### LDG-005 — Ürün filtresi autocomplete
### LDG-006 — Süperadmin işaretli filter
### LDG-007 — Sayım farkı filter
### LDG-008 — Filtre URL paylaşımı
### LDG-009 — Sayfalama
### LDG-010 — Sıralama (tarih asc/desc)
### LDG-011 — Detay drawer açılır
### LDG-012 — Detay drawer içeriği (audit hash YOK — R3)
### LDG-013 — Geri alma: ADMIN 24 saat içinde
### LDG-014 — Geri alma: ADMIN 24 saat dışında disabled
### LDG-015 — Geri alma: SUPERADMIN süresiz (🚨)
### LDG-016 — Sayım geri alınamaz
### LDG-017 — Karşı hareket gir yönlendirmesi
### LDG-018 — + Yeni Hareket dropdown 4 tip
### LDG-019 — Stok Girişi: tedarikçi zorunlu
### LDG-020 — Stok Girişi: inline yeni tedarikçi
### LDG-021 — Stok Girişi: lot + SKT
### LDG-022 — Stok Girişi: kategori bazlı SKT zorunlu (mama)
### LDG-023 — Satış: 7 alt-tip dropdown
### LDG-024 — Satış: eksi stok yasak
### LDG-025 — Satış: ödeme tipi sadece Satış için
### LDG-026 — Transfer: kaynak ≠ hedef
### LDG-027 — Transfer: Direkt teslim 2 entry
### LDG-028 — Transfer: Yola çıktı + sonra Teslim Aldım
### LDG-029 — Sayım drawer → tam sayfa yönlendirme
### LDG-030 — Sayım yumuşak kilit
### LDG-031 — Realtime: başka tab'dan satış yapılınca feed güncellenir
### LDG-032 — Concurrent satış: race condition (row lock)
### LDG-033 — Excel export 30g default

---

## 18. Faz 1 ile Tutarlılık

| Faz 1 | Bu doküman | Durum |
|---|---|---|
| §11.2 Stok Hareketleri yapısı | Aynen | ✅ |
| §20 R1 Geri alma tek katman | Aynen | ✅ |
| §20 R3 Audit hash YOK | Aynen | ✅ |
| 4 hareket tipi (Giriş/Çıkış/Transfer/Sayım) | Aynen | ✅ |
| 7 çıkış alt-tipi | Aynen | ✅ |
| Eksi stoğa izin yok | Aynen | ✅ |
| Sayım geri alınamaz | Aynen | ✅ |
| Transit pool YOK | Aynen | ✅ |
| Realtime feed (mockup) | Yeni — Supabase | 🆕 |

---

## 19. Sıradaki Adım

✅ EKRAN-PANO.md
✅ EKRAN-URUNLER.md
✅ EKRAN-STOK-HAREKETLERI.md (bu doküman)
⏭ **EKRAN-DUSUK-STOK.md** — Düşük stok eylem ekranı (R6 toplu sipariş yenilenmiş)

---

*Son güncelleme: 2026-05-12. Faz 1 §11.2 + R1 + R3 entegre, Realtime native eklendi.*
