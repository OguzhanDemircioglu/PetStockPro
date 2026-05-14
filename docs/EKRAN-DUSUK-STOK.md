# Ekran: Düşük Stok

**URL:** `/admin/inventory/low-stock`
**Sidebar yeri:** Envanter grubu, 4. sıra · ⚠ Düşük Stok
**Erişim:** ADMIN (bayi sahibi tüm şubeler, şube müdürü kendi şubesi) + STAFF (kasiyer — read-only, kendi şubesi; "Sipariş Hazırla" CTA gizli — sadece yöneticiye bildirir). Tam yetki matrisi: `EKRAN-KULLANICILAR.md §12.5` (2026-05-14 OT2-5).
**Otoritatif referans:** Faz 1 `FAZ1-TASARIM-KARARLARI.md` §11.4 + §20 R6
**Tasarım sistemi:** `TASARIM-SISTEMI.md`

> Düşük Stok ekranı **eylem odaklıdır**: "Şimdi ne sipariş etmeliyim?" sorusunun cevabı. R6 ile toplu sipariş akışı sade-tut yapıldı (multi-step magic yok, sıralı drawer'lar).

---

## 1. Layout

```
┌─────────┬──────────────────────────────────────────────────┐
│         │ Topbar (Yönetim > Envanter > Düşük Stok)         │
│ Sidebar ├──────────────────────────────────────────────────┤
│         │ ┌─ Üst bar (3 KPI + Toplu Sipariş CTA) ──────────┐│
│         │ │ 🔴 2 Kritik │ 🟠 5 Yakında │ ⛔ 1 Tükendi      ││
│         │ │                  [📥 Toplu Sipariş Hazırla] →││
│         │ └────────────────────────────────────────────────┘│
│         │ ┌─ Filtre (collapsed) ──────────────────────────┐│
│         │ │ Kategori · Hayvan · Marka · Şube · Tedarikçi ⋯││
│         │ └────────────────────────────────────────────────┘│
│         │ ┌─ Ana tablo ──────────────────────────────────┐│
│         │ │ ☑│img│Ürün+SKU│Şube│Mevcut/Eşik│Eksik│Öneri│Alış││
│         │ │ ☑│   │Royal C.│Mer.│   2/10 🔴 │ -8  │ 18  │₺180││
│         │ │ ...                                            ││
│         │ └────────────────────────────────────────────────┘│
│         │ Sticky bulk bar (seçili 1+ varsa)                 │
│         │                                                    │
│         │ + Toplu Sipariş Hazırla akışı (R6)                │
└─────────┴──────────────────────────────────────────────────┘
```

## 2. Üst Bar — 3 KPI + CTA

```
🔴 Kritik: 2    🟠 Yakında: 5    ⛔ Tükendi: 1    [📥 Toplu Sipariş Hazırla]
```

**KPI'lar tıklanabilir → filtre uygular:**
- 🔴 Kritik (`?level=critical`) — stok < eşik × 0.33
- 🟠 Yakında (`?level=warn`) — stok < eşik
- ⛔ Tükendi (`?level=out`) — stok = 0

**Toplu Sipariş Hazırla CTA:**
- Primary button (`btn-cat`)
- Seçili 1+ ürün varsa aktif (sticky bulk bar'da da aynı)
- Seçili 0 ürün: disabled + tooltip "En az 1 ürün seç"

---

## 3. Filtre Paneli (Collapsed)

```
Kategori:      [Mama ▼] [Aksesuar ▼]   (multi)
Hayvan türü:   🐱 🐶 🐦 🐟 🐰 🦎      (multi-checkbox)
Marka:         [Royal Canin ▼]         (autocomplete)
Şube:          [Tüm şubeler ▼]         (multi)
Tedarikçi:     [autocomplete]
Kritiklik:     ◉ Tümü  ○ Kritik+Tükendi  ○ Yakında
Son alım:      ◉ Tümü  ○ 30g+ önce      (uzun süre alınmamış)
☐ Auto-reorder eşiği aktif olanlar      (Faz 2 özellik, MVP'de gri/disabled)
```

---

## 4. Ana Tablo

### 4.1 Kolonlar

| Kolon | Genişlik | İçerik |
|---|---|---|
| ☑ | 40px | Bulk seçim |
| 🖼 | 56px | 48×48 ürün/hayvan görseli |
| **Ürün** | flex | Ad + SKU + variant + tedarikçi + son alım |
| **Şube** | 110px | Şube adı + ikon (multi-branch tenant) |
| **Mevcut/Eşik** | 130px | Kritiklik dot + `2 / 10` formatı |
| **Eksik** | 80px | `eşik − mevcut` (sayı + dot) |
| **Önerilen** | 100px | Akıllı sipariş adedi (`(eşik × 2) − mevcut`) |
| **Birim alış** | 100px | Son alış fiyatı |
| **chevron** | 32px | Detay aç |

### 4.2 Ürün Hücresi Detayı

```
[img] Royal Canin Adult Kedi 2kg
      SKU: RC-K-ADL-2KG · Tedarikçi: Ahmet Petshop
      Son alım: 18g önce  (30g+ ise kırmızı uyarı)
```

**Son alım 30g+ kırmızı:** "60g önce" → `--danger` color, italic. "5g önce" → `--text-3`, normal.

**Tedarikçi yoksa:** "Tedarikçi atanmadı · ⚠" — toplu sipariş yapılamayacağı uyarısı.

### 4.3 Mevcut / Eşik Hücresi

```
[🔴] 2 / 10      (kritik)
[🟠] 6 / 10      (yakında)
[⛔]  0 / 10     (tükendi)
```

Renk + dot + sayı kombinasyonu.

### 4.4 Önerilen Sipariş

Akıllı hesap formülü:

```
Önerilen = (eşik × 2) − mevcut

Örnek:
- eşik 10, mevcut 2 → öneri 18
- eşik 5, mevcut 0  → öneri 10
- eşik 20, mevcut 15 (henüz altta değil ama yakın) → öneri 25
```

**Daha akıllı versiyonu (Faz 2'de):**
- Geçmiş satış hızını dikkate al
- Tedarikçi tedarik süresini ekle
- Mevsimsellik etkisi (bayram, yaz/kış)

MVP'de basit formül yeterli.

### 4.5 Sıralama

Default: **Kritiklik → Eksik adet → Tedarikçi**

```sql
ORDER BY
  CASE level
    WHEN 'out' THEN 1     -- Tükendi en üstte
    WHEN 'critical' THEN 2
    WHEN 'warn' THEN 3
  END,
  (threshold - stock_qty) DESC,  -- Daha fazla eksik üste
  supplier_id ASC                  -- Tedarikçi gruplama
```

Kullanıcı override: tüm kolonlar sortable.

### 4.6 Multi-Branch Davranış

Bir variant farklı şubelerde düşükse: **her şube ayrı satır**.

Örnek:
```
Royal Canin Kedi 2kg · Merkez:   2/10  (kritik) · Eksik: 8
Royal Canin Kedi 2kg · Şube A:   1/5   (kritik) · Eksik: 4
Royal Canin Kedi 2kg · Şube B:   0/3   (tükendi)· Eksik: 3
```

Bulk select tüm 3 satırı dahil edebilir → her şube için ayrı sipariş.

### 4.7 Hover Satır Eylemleri

```
👁  📥  🔄  ⋯
```

- **👁 Detay:** Ürün detay drawer (Ürünler ekranındaki)
- **📥 Stok Girişi:** Bu ürün için Stok Girişi drawer pre-filled (önerilen miktar + son tedarikçi)
- **🔄 Transfer:** Multi-branch ise: başka şubeden transfer önerisi
- **⋯ Daha:**
  - 🏷 Eşik düzenle (mini-modal)
  - 📋 Sayım yap
  - 🗄 Arşivle (artık takip edilmesin)

---

## 5. Toplu Sipariş Hazırla (R6 Sade-Tut)

### 5.1 Akış

```
1. Kullanıcı 5 ürün seçer (farklı tedarikçilerden olabilir)
2. "📥 Toplu Sipariş Hazırla" tıklar
3. Sistem tedarikçilere göre gruplar
4. Onay modal'da grupları gösterir
5. Tek tedarikçi → tek drawer multi-line açılır
6. Birden fazla tedarikçi → sıralı drawer'lar (R6)
```

### 5.2 Tedarikçiye Göre Gruplama

Backend hesap:
```
Seçili 5 ürün:
- Royal Canin Kedi 2kg     → Ahmet Petshop (son alımdaki tedarikçi)
- Royal Canin Köpek 10kg   → Ahmet Petshop
- Whiskas 400g             → Royal Toptan
- Felix Pouch              → Royal Toptan
- Trixie Kum Kabı          → VetMarka

Grup 1: Ahmet Petshop (2 ürün, toplam ₺X)
Grup 2: Royal Toptan (2 ürün, toplam ₺Y)
Grup 3: VetMarka (1 ürün, toplam ₺Z)
```

### 5.3 Onay Modal (Birden Fazla Tedarikçi)

```
┌── Toplu Sipariş Hazırla ────────────────────────────┐
│                                                       │
│ 5 ürün için 3 farklı tedarikçi tespit edildi.        │
│                                                       │
│ Her tedarikçi için ayrı stok girişi yapılacak:       │
│                                                       │
│ 1. Ahmet Petshop A.Ş.                                │
│    • Royal Canin Kedi 2kg × 18                       │
│    • Royal Canin Köpek 10kg × 5                      │
│    Tahmini: ₺4.150                                   │
│                                                       │
│ 2. Royal Toptan Ltd.                                 │
│    • Whiskas 400g × 50                               │
│    • Felix Pouch × 30                                │
│    Tahmini: ₺980                                     │
│                                                       │
│ 3. VetMarka Dağıtım                                  │
│    • Trixie Kum Kabı × 10                            │
│    Tahmini: ₺1.250                                   │
│                                                       │
│ Drawer'lar sırayla açılacak.                         │
│ İlk drawer'ı kaydedince ikincisi açılır.             │
│                                                       │
│            [İptal]  [Devam Et →]                     │
└───────────────────────────────────────────────────────┘
```

**R6 önemli vurgu:** Multi-step magic YOK. Drawer'lar **manuel sırayla** açılır:
- 1. drawer açılır (Ahmet Petshop, 2 ürün pre-filled)
- Kullanıcı `Kaydet` → drawer kapanır
- 2. drawer otomatik açılır (Royal Toptan)
- Kullanıcı `Kaydet` → 3. drawer
- Hepsi tamamlanınca: "✓ 3 tedarikçiden toplam 5 ürün stok girişi yapıldı" toast

### 5.4 Tek Tedarikçi Akışı

Eğer tüm seçili ürünler aynı tedarikçiden:
- Onay modal **yok**
- Doğrudan Stok Girişi drawer multi-line açılır:

```
┌── Yeni Stok Girişi ────────────────────────[×]┐
│ Tedarikçi: Ahmet Petshop (toplu sipariş)       │
├──────────────────────────────────────────────────┤
│ Ürün satırları (5 ürün pre-filled):            │
│ ┌──────────────────────────────────────────────┐ │
│ │ # │ Ürün                  │Adet│Birim alış   ││
│ │ 1 │ Royal Canin Kedi 2kg  │ 18 │ ₺180        ││
│ │ 2 │ Royal Canin Köpek 10kg│  5 │ ₺850        ││
│ │ 3 │ Whiskas 400g          │ 50 │ ₺  8        ││
│ │ 4 │ Felix Pouch           │ 30 │ ₺  6        ││
│ │ 5 │ Trixie Kum Kabı       │ 10 │ ₺125        ││
│ └──────────────────────────────────────────────┘ │
│ Toplam: 113 adet · ₺6.380                       │
│                                                  │
│         [İptal]  [Kaydet]                       │
└──────────────────────────────────────────────────┘
```

### 5.5 İptal Akışı

- 1. drawer'da `İptal` → tüm akış iptal
- 2. drawer'da `İptal` → onay modal: "İlk grup kaydedildi. Kalan 2 grup için de iptal mi?"
- Kısmi tamamlama mümkün

### 5.6 Drawer İçi Akış Göstergesi

Multi-tedarikçi akışında drawer header'da progress:

```
┌── Yeni Stok Girişi · 1/3 (Ahmet Petshop) ────[×]┐
```

Header'da "1/3" gösterimi + üstteki onay modal'dan görülen ürünler.

---

## 6. Empty State

### 6.1 Hiç düşük stok yok 🎉

```
┌────────────────────────────────────────┐
│                                          │
│      [kedi+köpek+kalp+sparkle]          │
│                                          │
│        Tüm stok sağlam!                 │
│   Kritik stoğa düşen ürün yok.          │
│   Kedi de köpek de mutlu — bugün        │
│   sipariş gerektiren ürün bulunmuyor.   │
│                                          │
│   💡 Eşikleri ayarlamak istersen:       │
│        [Ürünleri görüntüle]             │
└──────────────────────────────────────────┘
```

### 6.2 Filtre sonucu boş

```
[köpek başını eğmiş]
"Kategori: Aksesuar · Şube: Şube B" için düşük stok yok.
Filtreleri genişlet.
```

---

## 7. State Management

### 7.1 TanStack Query

```ts
const { data } = useQuery({
  queryKey: ['low-stock', filters],
  queryFn: () => fetchLowStock(filters),
  staleTime: 60_000,
});
```

### 7.2 Realtime

```ts
// branch_inventory UPDATE → invalidate
supabase
  .channel('low-stock-watch')
  .on('postgres_changes', {
    event: 'UPDATE',
    table: 'branch_inventory',
    filter: `company_id=eq.${companyId}`
  }, () => queryClient.invalidateQueries(['low-stock']))
  .subscribe();
```

### 7.3 Bulk Selection State

Zustand store:
```ts
type LowStockUI = {
  selectedRows: Set<string>;  // variant_id + branch_id key
  toggleRow: (key: string) => void;
  toggleAll: (keys: string[]) => void;
  clear: () => void;
};
```

---

## 8. API Endpoints

| Endpoint | Method | Açıklama |
|---|---|---|
| `/api/admin/low-stock` | GET | Liste + filtre (variant × branch satırları) |
| `/api/admin/low-stock/group-by-supplier` | POST | Seçili ürünleri tedarikçiye göre grupla (onay modal için) |
| `/api/admin/low-stock/bulk-order/initiate` | POST | Toplu sipariş akışını başlat (session token döndürür) |
| `/api/admin/movements/stock-in` | POST | Drawer submit (Stok Hareketleri ile aynı endpoint) |

**`bulk-order/initiate` response:**
```ts
type BulkOrderSession = {
  sessionId: string;
  groups: Array<{
    supplierId: string;
    supplierName: string;
    items: Array<{ variantId, productName, branchId, recommendedQty, lastCost }>;
    estimatedTotal: number;
  }>;
  currentStep: 0;  // İlk drawer için
};
```

---

## 9. Responsive

### 9.1 Desktop
Tam tablo, 9 kolon.

### 9.2 Tablet
Şube + Eksik tek hücreye stack.

### 9.3 Mobile
Kart liste:
```
┌─────────────────────────────────────┐
│ [🔴] Royal Canin Kedi 2kg           │
│      Merkez · Mevcut 2 / Eşik 10    │
│      Önerilen: 18 adet · ₺180/adet │
│      Tedarikçi: Ahmet Petshop       │
│                  [📥 Sipariş Aç]    │
└─────────────────────────────────────┘
```

Bulk select yok mobilde (UX karmaşık). Sadece tek tek sipariş.

---

## 10. Klavye Kısayolları

| Kısayol | İşlem |
|---|---|
| `↑↓` | Satır gez |
| `Space` | Satır seç (bulk) |
| `Enter` | Detay drawer |
| `o` | Toplu Sipariş Hazırla (seçili varsa) |
| `Ctrl+A` | Tümünü seç |

---

## 11. Erişilebilirlik

- Kritiklik renge ek olarak emoji + ikon
- 🔴/🟠/⛔ semantic anlam screen reader'a iletilir
- Tabloda sıralama yön bilgisi `aria-sort`
- Toplu sipariş akışında her drawer focus management

---

## 12. Performans

| Metrik | Hedef |
|---|---|
| **Liste yükleme** | < 1s (50 düşük stok satırı) |
| **Bulk grup hesabı** | < 500ms |
| **Drawer açılma** | < 100ms |

**DB Query:**
```sql
SELECT bi.*, pv.name, pv.threshold, p.name as parent_name, p.last_supplier_id
FROM branch_inventory bi
JOIN product_variants pv ON pv.id = bi.variant_id
JOIN products p ON p.id = pv.product_id
WHERE bi.company_id = $1
  AND pv.is_active = true
  AND bi.stock_qty < pv.threshold
ORDER BY ...;
```

Index: `(company_id, stock_qty, threshold)` composite.

---

## 13. Test Senaryoları

### LOW-001 — KPI 3 metrik doğru
### LOW-002 — KPI tıklama: filtreli sayfa
### LOW-003 — Filtre: kategori + hayvan multi
### LOW-004 — Tablo sıralama default (kritiklik → eksik)
### LOW-005 — Multi-branch ayrı satırlar
### LOW-006 — Önerilen sipariş hesabı doğru
### LOW-007 — Son alım 30g+ kırmızı uyarı
### LOW-008 — Hover eylemleri
### LOW-009 — Tek ürün için "Stok Girişi" pre-filled drawer
### LOW-010 — Bulk select 5 ürün
### LOW-011 — Toplu Sipariş: tek tedarikçi → tek drawer
### LOW-012 — Toplu Sipariş: 3 tedarikçi → onay modal
### LOW-013 — Sıralı drawer akışı (1/3 → 2/3 → 3/3)
### LOW-014 — Drawer iptal: ilk grup kaydedilmiş, kalanı iptal modal
### LOW-015 — Realtime: başka tab'dan stok girişi → liste güncellenir
### LOW-016 — Empty state: hepsi yolunda mascot
### LOW-017 — Filtre sonucu boş empty
### LOW-018 — Auto-reorder eşik (Faz 2 disabled)
### LOW-019 — Tedarikçi atanmamış ürün toplu siparişe dahil edilmez (uyarı)

---

## 14. Faz 1 ile Tutarlılık

| Faz 1 | Bu doküman | Durum |
|---|---|---|
| §11.4 yapı + KPI | Aynen | ✅ |
| §20 R6 Toplu sipariş sade | Aynen (sıralı drawer) | ✅ |
| Multi-step magic kaldırıldı | Aynen | ✅ |
| Önerilen sipariş `(eşik × 2) − mevcut` | Aynen | ✅ |
| Realtime invalidation | Yeni — Supabase | 🆕 |

---

## 15. Sıradaki Adım

✅ EKRAN-PANO.md
✅ EKRAN-URUNLER.md
✅ EKRAN-STOK-HAREKETLERI.md
✅ EKRAN-DUSUK-STOK.md (bu doküman)
⏭ **EKRAN-SAYIM.md** — Sayım drawer + tam-sayfa workflow

---

*Son güncelleme: 2026-05-12. Faz 1 §11.4 + R6 entegre, multi-step magic sade-tut.*
