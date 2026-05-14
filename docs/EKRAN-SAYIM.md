# Ekran: Sayım

**URL'ler:**
- Liste: `/admin/inventory/stocktake`
- Tam-sayfa workflow: `/admin/inventory/stocktake/[id]`
- Geçmiş: `/admin/inventory/stocktake/history`

**Sidebar yeri:** Envanter grubu, 5. sıra · 📋 Sayım
**Erişim:** ADMIN (bayi sahibi tüm şubeler, şube müdürü kendi şubesi)
**Otoritatif referans:** Faz 1 `FAZ1-TASARIM-KARARLARI.md` §11.5
**Tasarım sistemi:** `TASARIM-SISTEMI.md`

> Sayım, **fiziki gerçeği** sisteme yansıtma sürecidir. Drawer **başlatıcıdır**, gerçek iş tam-sayfa workflow'da yapılır. Sayım **geri alınamaz** (tekrar say). Yumuşak kilit ile sayım açıkken satışa devam edilebilir.

---

## 1. Layout — Liste Sayfası

```
┌─────────┬──────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Yönetim > Envanter > Sayım)              │
│         ├──────────────────────────────────────────────────┤
│         │ ┌─ Üst bar ─────────────────────────────────────┐│
│         │ │ "Sayım" başlık · [+ Yeni Sayım Başlat]        ││
│         │ └────────────────────────────────────────────────┘│
│         │ ┌─ Aktif sayımlar (varsa) ───────────────────────┐│
│         │ │ 📋 Aylık sayım · Merkez · %43 tamamlandı       ││
│         │ │     85/198 ürün sayıldı · 2 dk önce            ││
│         │ │                       [Devam Et →]              ││
│         │ └────────────────────────────────────────────────┘│
│         │ ┌─ Geçmiş sayımlar (tablo) ─────────────────────┐│
│         │ │ Başlangıç│Bitiş │Şube │Mod │SKU │Fark│Yapan  ││
│         │ │ 05 May   │05May │Mer. │Tam │198 │ 3  │ Ahmet ││
│         │ │ 01 Apr   │01Apr │ŞubA │Kat │ 45 │ 1  │ Zey   ││
│         │ └────────────────────────────────────────────────┘│
└─────────┴──────────────────────────────────────────────────┘
```

## 2. Yeni Sayım Başlatma

### 2.1 Drawer (Stok Hareketleri'nden de erişilebilir)

Faz 1 §11.2'deki Sayım drawer ile aynı — bkz. `EKRAN-STOK-HAREKETLERI.md §7.4`.

Özet:
```
┌── Yeni Sayım Başlat ─────────────[×]┐
│ Şube *           [Merkez ▼]          │
│ Sayım modu *     ◉ Tam               │
│                  ○ Kategori          │
│                  ○ Manuel seçim      │
│ ☑ Yumuşak kilit (sayım+satış)       │
│ Not              [Aylık sayım]       │
│       [İptal]  [Başlat → Sayım]     │
└──────────────────────────────────────┘
```

**Submit sonrası:**
- `stocktakes` row oluşturulur (status: `in_progress`)
- Sayım kapsamı kararı:
  - **Tam:** Tenant + şubenin tüm aktif variant'ları → `stocktake_items` snapshot
  - **Kategori:** Seçili kategori variant'ları
  - **Manuel:** Tam-sayfa'da kullanıcı ürünleri seçer
- Yönlendirme: `/admin/inventory/stocktake/[id]`

### 2.2 Manuel Seçim Akışı

Manuel seçildiyse, tam-sayfa açılır ama tablo boş gelir:

```
[Manuel Sayım · Merkez · Beklemede]
Sayılacak ürünleri ekle:
[Arama: ürün, SKU, barkod...] [Filtre: kategori/marka]
[+ Seçili ürünleri ekle]
```

Ürünler seçildikten sonra sayım başlar.

---

## 3. Tam-Sayfa Workflow

**URL:** `/admin/inventory/stocktake/[id]`

```
┌─────────────────────────────────────────────────────────────┐
│ [← Çıkış · taslak korunur]                                   │
│                                                                │
│ Sayım #1248 · Aylık · Merkez                       [⏸ Durdur]│
│ Başladı: 07 May 14:32 · 23 dk önce                            │
│ ☑ Yumuşak kilit aktif                                          │
│                                                                │
│ ─── Ilerleme ─────────────────────────────────────────         │
│ [██████████░░░░░░░░░░] 85 / 198 ürün · %43                    │
│ ✓ Sayıldı: 85 · ⚠ Fark: 3 · ⏸ Atlandı: 2                    │
│                                                                │
│ ─── Filtre ────────────────────────────────────────────       │
│ [Tümü] [Sayılmadı] [Sayıldı] [Farklı]   [Arama: ___] [▼ Sort]│
│                                                                │
│ ─── Ürün tablosu ──────────────────────────────────────       │
│ Ürün                          │Sistem│Sayılan│Fark│Sebep│✓    │
│ ─────────────────────────────────────────────────────────     │
│ Royal Canin Kedi              │      │       │    │      │    │
│ ▼ 400g                        │  25  │ [25 ] │  0 │  —   │ ✓ │
│ ▼ 2kg                         │  10  │ [9 ] │ -1 │[Kayıp▼]│ ✓ │
│ ▼ 10kg                        │   4  │ [4 ] │  0 │  —   │ ✓ │
│ Whiskas 400g · Sığır          │  25  │ [   ] │    │      │    │
│ Felix Pouch                   │  18  │ [   ] │    │      │    │
│ ...                                                            │
│                                                                │
│ ─── Footer (sticky) ───────────────────────────────────       │
│ [💾 Beklemede Kaydet] [⏸ Daha Sonra]  [✓ Sayımı Tamamla]    │
└────────────────────────────────────────────────────────────────┘
```

### 3.1 Üst Bilgi

```
Sayım #1248 · Aylık · Merkez
Başladı: 07 May 14:32 · 23 dk önce
☑ Yumuşak kilit aktif
```

- **Yumuşak kilit göstergesi:** Sayım açıkken yapılan satışlar sistem stoğunu günceller, sayım listesi anlık yenilenir
- Sert kilit (yumuşak kapatılırsa): "Satışlar bu şubede kilitli" uyarı

### 3.2 Sayım İlerleme Bar

```
[██████████░░░░░░░░░░] 85 / 198 ürün · %43

✓ Sayıldı: 85   ⚠ Fark: 3   ⏸ Atlandı: 2
```

- Progress bar gradient (`--cat` → `--arrow`)
- Sayılan: input dolu satırlar
- Fark: sayılan ≠ sistem
- Atlandı: kullanıcı "atla" işaretledi (kayıp sebebi yazılmamış)

### 3.3 Filtre Pills

```
[Tümü] [Sayılmadı] [Sayıldı] [Farklı] [Atlandı]
```

Aktif filtre primary renkli (`--cart`). Sayımın orta-sonu için "Farklı"ya filtrele, ne fark olduğunu inceleme.

### 3.4 Arama + Sort

- Arama: Variant veya SKU veya barkod (örn raf üstündeki barkodu okut)
- Sort: Default ürün adı asc, alternatif kategori/şube

### 3.5 Ürün Tablosu

**Kolonlar:**

| Kolon | Genişlik | İçerik |
|---|---|---|
| Ürün | flex | Parent + variant (accordion grup) |
| Sistem stoğu | 90px | Sayım başlangıcında snapshot |
| Sayılan | 120px | Sayısal input (number type) |
| Fark | 70px | Hesaplama `sayılan − sistem` |
| Sebep | 140px | Dropdown (fark > 0 ise zorunlu) |
| ✓ | 40px | Tamamlandı işareti |

**Parent grup:**
```
▼ Royal Canin Kedi             [3 variant]
   ├── 400g    │ 25 │ [25] │  0 │  —    │ ✓
   ├── 2kg     │ 10 │ [ 9] │ -1 │ Kayıp │ ✓
   └── 10kg    │  4 │ [ 4] │  0 │  —    │ ✓
```

- Parent collapse/expand (default expanded)
- Variant satırları indented
- Parent satırı kendisi sayılmaz, sadece grup başlığı

**Tek variant ürün:**
```
Whiskas 400g · Sığır            │ 25 │ [25] │  0 │ — │ ✓
```

### 3.6 Sayılan Input

- Number type, integer only, >= 0
- Default boş (placeholder: `___`)
- Otomatik focus chain: Tab veya Enter ile sıradaki satıra atla
- Eksi sayı engellenir (`pattern="\d*"`)

### 3.7 Fark Hesabı

```
sayılan = 9, sistem = 10 → Fark: -1 (kırmızı)
sayılan = 11, sistem = 10 → Fark: +1 (yeşil)
sayılan = 10 = sistem → Fark: 0 (gri)
```

- Fark 0 ise sebep dropdown gri/disabled (gerek yok)
- Fark ≠ 0 ise sebep **zorunlu** (boş bırakırsa "✓ tamamla" disabled)

### 3.8 Fark Sebebi Dropdown

7 seçenek (Faz 1 §11.2 R3 ile uyumlu):

```
[Sebep seç ▼]
   ├── Kayıp (görünmüyor, yok)
   ├── Fazla (sistemde olmayan fazlalık)
   ├── Hatalı kayıt (giriş/çıkış hatalı yapılmış)
   ├── SKT geçmiş (atılmış)
   ├── Hasar (kırık/açılmış)
   ├── Çalıntı
   └── Diğer (textarea açar)
```

"Diğer" seçilirse altta serbest metin alanı belirir.

### 3.9 Beklemede Kaydet

`[💾 Beklemede Kaydet]` butonu:
- Mevcut sayım state'i `stocktakes.status = waiting` olarak set eder
- Tüm sayılan değerler `stocktake_items` tablosuna kaydedilir
- Sayım açık kalır, başka zaman devam edilebilir
- "Aktif sayımlar" listesinde gösterilir

**Otomatik ara kayıt:**
- Her 30 saniyede bir background'da kaydedilir
- Sayfa kapansa bile veriler kayıp olmaz
- Status `in_progress` kalır (waiting değil)

### 3.10 Sayımı Tamamla — Onay Modal

`[✓ Sayımı Tamamla]` → onay modal:

```
┌── Sayımı tamamla? ──────────────────────────────────┐
│                                                       │
│ Sayım #1248 · Aylık · Merkez                          │
│ 198 ürün sayıldı                                       │
│ 3 fark tespiti                                          │
│                                                       │
│ ⚠ DİKKAT: Sayım tamamlanınca **geri alınamaz**.      │
│                                                       │
│ Her fark için ledger'a entry yazılacak:              │
│                                                       │
│ ✓ Royal Canin 2kg     −1 adet  · Kayıp               │
│ ✓ Felix Pouch         +2 adet  · Fazla               │
│ ✓ Whiskas 400g        −5 adet  · SKT Geçmiş          │
│                                                       │
│ Bu hareketlerin değer etkisi: −₺245 (envanter)       │
│                                                       │
│ Devam etmek istiyor musun?                            │
│                                                       │
│         [İptal]  [✓ Tamamla ve Kaydet]              │
└───────────────────────────────────────────────────────┘
```

**Backend:**
- Server Action: transaction içinde
  1. `stocktakes.status = completed`, `closed_at = now`
  2. Her fark satırı için `stock_movements` (type: stocktake, quantity: fark) entry
  3. `branch_inventory.stock_qty` güncellenir (sayılan değere set)
  4. `audit_logs` entry
- Geri yönlendirme: Sayım listesine + toast "Sayım tamamlandı"

### 3.11 Yumuşak Kilit — Canlı Güncelleme

Sayım açıkken başka kullanıcı (örn satış noktasında) satış yaparsa:

```
Sayım listesi satırı:
Royal Canin 2kg  │  10  │ [9] │ -1 │ Kayıp │ ✓

→ Aniden satış yapılırsa (yumuşak kilit ile):
Royal Canin 2kg  │  ⚠ 9  │ [9] │  0 │  —   │ ✓
                   ↑ Sistem stoğu 10 → 9 (satış)
                   Bildirim: "Sistem stoğu güncellendi: 10 → 9. Sayılanı kontrol et"
```

**Sarı bilgi notu (geçici toast üst sağ):**
```
⚠ Sistem güncellendi
"Royal Canin 2kg" satış ile 1 azaldı.
Sayılan: 9 → güncel sistem: 9 → Fark: 0 ✓
[Sayılanı koruyacaksan dokunma]
```

### 3.12 Sert Kilit

Yumuşak kilit kapalıysa sayım sırasında:
- Aynı şubede yeni satış drawer açılırsa:
  ```
  ⛔ Bu şubede sayım açık · satış kilitli
  
  Sayım açıkken yumuşak kilit kapalı olduğu için satış yapılamaz.
  Sayımı tamamla veya yumuşak kilite geç.
  ```
- Diğer şubeler etkilenmez

---

## 4. Mobile Swipe-Card Workflow

Mobile'de tablo yerine **swipe card** UX:

```
┌─────────────────────────────────────┐
│  [85/198]  Aylık · Merkez           │
│  [Sayılmadı 113] [Fark 3]           │
│                                       │
│  ┌─────────────────────────────────┐│
│  │ Royal Canin Kedi 2kg            ││
│  │ SKU: RC-K-ADL-2KG               ││
│  │ Sistem: 10                       ││
│  │                                   ││
│  │ Sayılan:  [_______]              ││
│  │           [Numpad açık]          ││
│  │                                   ││
│  │ Fark: ___                        ││
│  │ Sebep: [seç ▼]                   ││
│  │                                   ││
│  │ [⏸ Atla] [✓ Sıradaki →]         ││
│  └─────────────────────────────────┘│
└───────────────────────────────────────┘
```

- Swipe sağ → sıradaki ürün
- Swipe sol → önceki ürün
- Numpad otomatik açılır (input type="number")
- Barkod tarayıcı entegrasyonu (Faz 3): kamera ile barkod oku → ürün doğrudan açılır

---

## 5. Sayım Listesi (Aktif + Geçmiş)

URL: `/admin/inventory/stocktake`

### 5.1 Aktif Sayımlar (Yukarıda Vurgulu)

```
📋 Aktif Sayımlar (2)

┌── Aylık sayım · Merkez ─────────────────[Devam Et →]┐
│ Başlatıldı: 07 May 14:32 · 23 dk önce                │
│ İlerleme: 85/198 (%43) · 3 fark · 2 atlandı           │
└────────────────────────────────────────────────────────┘

┌── Kategori sayımı · Şube B ─────────────[Devam Et →]┐
│ Başlatıldı: 05 May 10:15 · 2 gün önce (waiting)      │
│ İlerleme: 28/45 (%62) · 0 fark                        │
└────────────────────────────────────────────────────────┘
```

### 5.2 Geçmiş Sayımlar Tablosu

```
Başlangıç │ Bitiş    │ Şube  │ Mod   │ SKU │ Fark │ Etki   │ Yapan │
05 May    │ 05 May   │ Mer.  │ Tam   │ 198 │   3  │ −₺245  │ Ahmet │ [👁]
01 Apr    │ 01 Apr   │ ŞubA  │ Kat.  │  45 │   1  │ +₺ 50  │ Zeynep│ [👁]
```

- 👁 tıklama: Sayım detay drawer (tamamlanmış sayımın listesi + ledger entry'leri)

### 5.3 Sayım Detay Drawer

```
Sayım #1247 (tamamlandı)
05 May 2026, 09:00 - 11:30

İlerleme: 198/198 (%100)
3 fark, 195 doğru
Etki: −₺245 (envanter değeri)

Farklar:
- Royal Canin 2kg     −1  · Kayıp     · ₺180
- Felix Pouch         +2  · Fazla     · −₺12
- Whiskas 400g        −5  · SKT       · ₺ 60
                                       ────────
                                  Toplam: −₺228 (cost-based)

Yapan: Ahmet Şahin · 07 May 11:30
[Ledger entries: 3 hareket] → tıklama Stok Hareketleri filtreli
```

---

## 6. Empty State

### 6.1 Hiç sayım yok

```
[köpek+clipboard mascot]
İlk sayımını başlat
Stok takibinin sağlığı için periyodik sayım yap.
Aylık veya çeyreklik öneririz.
[+ Yeni Sayım Başlat]
```

---

## 7. State Management

### 7.1 Tam-sayfa local state

```ts
type StocktakeUI = {
  items: Record<variantId, {
    countedQty: number | null;
    reason: ReasonEnum | null;
    customReason: string | null;
    skipped: boolean;
  }>;
  filter: 'all' | 'pending' | 'counted' | 'diff' | 'skipped';
  search: string;
  autoSaveTimestamp: number;
};
```

Otomatik kaydet 30 saniye debounce.

### 7.2 Realtime (Yumuşak Kilit)

```ts
// Sistem stoğu değişikliğini dinle
supabase
  .channel(`stocktake-${stocktakeId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    table: 'branch_inventory',
    filter: `branch_id=eq.${branchId}`
  }, (payload) => {
    // Sistem stoğu değişti, sayım listesini güncelle
    updateSystemQty(payload.new.variant_id, payload.new.stock_qty);
    showToast(`Sistem stoğu güncellendi: ${variant} ${old} → ${new}`);
  })
  .subscribe();
```

---

## 8. API Endpoints

| Endpoint | Method | Açıklama |
|---|---|---|
| `/api/admin/stocktake` | POST | Yeni sayım başlat (drawer submit) |
| `/api/admin/stocktake/[id]` | GET | Sayım detay + items |
| `/api/admin/stocktake/[id]/items` | PATCH | Counted_qty + reason güncelle (auto-save) |
| `/api/admin/stocktake/[id]/pause` | POST | Beklemede kaydet |
| `/api/admin/stocktake/[id]/complete` | POST | Tamamla + ledger entry üret |
| `/api/admin/stocktake/active` | GET | Aktif sayımlar listesi |
| `/api/admin/stocktake/history` | GET | Geçmiş sayımlar tablosu |

---

## 9. Responsive

- Desktop: Tam tablo, accordion parent grup
- Tablet: Tablo dar kolonlar
- Mobile: Swipe card (§4)

---

## 10. Klavye Kısayolları

| Kısayol | İşlem |
|---|---|
| `Tab` / `Enter` | Sıradaki input |
| `Shift+Tab` | Önceki input |
| `Esc` | Filtre/arama temizle |
| `Ctrl+S` | Beklemede kaydet |
| `↓` | Sonraki ürün (filtre uygulanmış) |
| `↑` | Önceki ürün |
| `Space` (sebep dropdown'da) | Aç |

---

## 11. Performans

- Sayım büyük (1000+ ürün) tenant'lar için **virtual scroll** (TanStack Virtual)
- Auto-save 30s debounce + optimistic local state
- Realtime listener sayım açıkken aktif, kapanınca disconnect

---

## 12. Test Senaryoları

### CNT-001 — Sayım başlat: drawer submit + yönlendirme
### CNT-002 — Tam sayım modu: tüm variant'lar tabloda
### CNT-003 — Kategori modu: seçili kategori variantları
### CNT-004 — Manuel mod: ürün ekleme akışı
### CNT-005 — Sayılan input → fark hesabı
### CNT-006 — Fark 0: sebep disabled
### CNT-007 — Fark ≠ 0: sebep zorunlu
### CNT-008 — Sebep "Diğer": textarea açılır
### CNT-009 — Tab/Enter ile sıradaki satıra atla
### CNT-010 — Filtre: Sayılmadı/Sayıldı/Farklı pills
### CNT-011 — Arama: SKU ile sayım listesinde bul
### CNT-012 — Beklemede kaydet → liste başka oturumda devam edebilir
### CNT-013 — Auto-save 30s background
### CNT-014 — Tamamla onay modal: fark özeti + uyarı
### CNT-015 — Tamamla: ledger entries üretilir
### CNT-016 — Sayım geri alınamaz (Stok Hareketleri'nde buton disabled)
### CNT-017 — Yumuşak kilit aktif: paralel satış → sistem güncelleme + toast
### CNT-018 — Sert kilit: paralel satış engelleniyor
### CNT-019 — Mobile swipe card UX
### CNT-020 — Geçmiş sayım detay drawer
### CNT-021 — Aktif sayım listede vurgulu görünür
### CNT-022 — Birden çok aktif sayım paralel (farklı şubelerde)

---

## 13. Faz 1 ile Tutarlılık

| Faz 1 | Bu doküman | Durum |
|---|---|---|
| §11.5 yarı tasarlandı tamamlandı | ✅ tam tasarım |
| Drawer başlatıcı + tam-sayfa | Aynen | ✅ |
| Yumuşak kilit | Aynen | ✅ |
| Sayım geri alınamaz | Aynen | ✅ |
| 7 fark sebebi | Aynen | ✅ |
| Ara kayıt "Beklemede" | Aynen | ✅ |
| Mobile swipe-card | Yeni — eklendi | 🆕 |
| Realtime yumuşak kilit canlı | Yeni — Supabase | 🆕 |

---

## 14. Sıradaki Adım

✅ EKRAN-PANO/URUNLER/STOK-HAREKETLERI/DUSUK-STOK
✅ EKRAN-SAYIM.md (bu doküman)
⏭ **EKRAN-SUBELER.md** — Şubeler CRUD + harita + branch_inventory

---

*Son güncelleme: 2026-05-12. Faz 1 §11.5 tam, Realtime yumuşak kilit + mobile swipe eklendi.*
