# Ekran: Ürünler

**URL:**
- Liste: `/admin/products`
- Yeni: `/admin/products/new`
- Düzenle: `/admin/products/[id]/edit`
- Detay drawer: liste üzerinde slide-in (URL `?detail=[id]`)

**Sidebar yeri:** Envanter grubu, 2. sıra · 📦 Ürünler
**Erişim:** ADMIN (bayi sahibi tam yetki, şube müdürü ürün **ekleme/düzenleme** evet ama **silme** yok)
**STAFF (kasiyer) erişimi (2026-05-14 OT2-5):** STAFF Ürünler ekranını **görür ama read-only** (CRUD/CRUD aksiyonları gizli — `+ Yeni Ürün`, `✏ Düzenle`, `🗑 Arşivle`, fiyat değiştir, Satışa Aç toggle). Sadece liste + filtre + detay görüntüleme. Tam yetki matrisi: `EKRAN-KULLANICILAR.md §12.5`.
**Otoritatif referans:** Faz 1 `FAZ1-TASARIM-KARARLARI.md` §11.3 + §15 (Variant)
**Tasarım sistemi:** `TASARIM-SISTEMI.md`

> Ürünler ekranı stok takibinin **kataloğudur**. Pano'dan sonra günde en çok açılan sayfa. Variant sistemi MVP'de tam aktif (parent + boyut variantları).

---

## 1. Liste Sayfası Layout

```
┌─────────┬──────────────────────────────────────────────────┐
│         │ Topbar (Yönetim > Envanter > Ürünler)            │
│ Sidebar ├──────────────────────────────────────────────────┤
│         │ ┌─ Üst bar (KPI şeridi + CTA) ──────────────────┐│
│         │ │ 📦 35 ürün │ ⚠ 5 düşük │ ⏰ 3 SKT │ ⛔ 1 tük. │ + Yeni Ürün │
│         │ │ [Plan progress: FREE 47/50 · PRO 380/500 · PRO+ ∞] ││
│         │ └────────────────────────────────────────────────┘│
│         │ ┌─ Filtre paneli (collapsed default) ───────────┐│
│         │ │ [Arama: /Ctrl+F]    [Kategori][Marka][Şube]…  ││
│         │ └────────────────────────────────────────────────┘│
│         │ ┌─ Tablo (sticky header) ───────────────────────┐│
│         │ │ ☑│img│Ürün         │Kategori│Stok    │Fiyat  ││
│         │ │ ☑│   │Royal Canin  │Mama    │47 ⚠    │₺250   ││
│         │ │   │   │   3 varyant │+ R.Canin│           │   ││
│         │ │ ...                                          ││
│         │ └────────────────────────────────────────────────┘│
│         │ [Sayfalama: 1-50 / 87]                            │
│         │                                                    │
│         │ Bulk action bar (sticky alt, seçili 1+ varsa)    │
│         │                                                    │
└─────────┴──────────────────────────────────────────────────┘
```

## 2. Üst Bar — KPI Şeridi + Plan + CTA

### 2.1 KPI Şeridi (4 mini KPI)

Sağdan sola yatay flex:

```
[📦 Toplam: 35]  [⚠ Düşük: 5]  [⏰ SKT: 3]  [⛔ Tükendi: 1]
```

- Her KPI tıklanabilir → ilgili filtre uygulanır
- 13px Bold sayı + 11px label
- Renk:
  - Toplam: `--text` (nötr)
  - Düşük: `--cat-700` (turuncu uyarı)
  - SKT: `--bars-700` (mavi info)
  - Tükendi: `--danger` (kırmızı kritik)

### 2.2 Plan Progress Bar

3-tier B (2026-05-14): **FREE 50 / PRO 500 / PRO+ ∞**. Plan'a göre 3 görünüm:

```
FREE Plan  [████████████████░░] 47/50 ürün       [PRO'ya yükselt →]
PRO Plan   [██████████████░░░░] 380/500 ürün     [PRO+'ya yükselt →]
PRO+ Plan  [∞ Sınırsız]         1.247 aktif ürün
```

**Dolum + renk mantığı (FREE & PRO için):**
- 0-79% yeşil (`--cat-700` ring soft)
- 80-99% turuncu uyarı (`--cat-700` solid)
- 100% kırmızı (`--danger`), `+ Yeni Ürün` disabled

**PRO+ özel görünüm:**
- Progress bar YOK (limit yok) — `∞ Sınırsız` rozet + toplam aktif ürün sayısı
- "Yükselt" CTA YOK (en üst kademe)
- Renk: nötr `--text-muted`

**CTA mantığı:**
- FREE → "PRO'ya yükselt (500 ürün)" buton (her zaman görünür, %80+'da vurgu turuncu)
- PRO → "PRO+'ya yükselt (sınırsız)" buton (sadece %80+'da görünür, altında gizli)
- PRO+ → CTA gizli

### 2.3 "+ Yeni Ürün" CTA

- Primary button (`btn-cat` turuncu gradient)
- Tıklama → `/admin/products/new` (yeni sayfa, drawer değil)
- Plan limit doluysa: buton **disabled** + tooltip:
  - FREE: "FREE 50 doldu, PRO'ya yükselt (500 ürün) veya bir ürün arşivle"
  - PRO: "PRO 500 doldu, PRO+'ya yükselt (sınırsız) veya bir ürün arşivle"
  - PRO+: limit yok, asla disable olmaz
- Klavye kısayolu: `n` (Pano hero'dakiyle aynı)

---

## 3. Filtre Paneli (Collapsed Default)

```
┌─ [▼] Filtreler  (5 aktif filtre)               [Tümünü Temizle] ┐
│                                                                    │
│ Kategori: ☑ Mama  ☑ Aksesuar  ☐ Oyuncak  ☐ Kum  ☐ Sağlık       │
│ Marka:    [Royal Canin ▼] (autocomplete multi)                    │
│ Hayvan:   🐱 ☑  🐶 ☑  🐦 ☐  🐟 ☐  🐰 ☐  🦎 ☐                │
│ Şube:     [Tüm şubeler ▼] (multi)                                  │
│ Stok:     ◉ Hepsi  ○ Düşük  ○ Tükendi  ○ Normal                 │
│ SKT:      ◉ Hepsi  ○ Yakında (30g)  ○ Geçmiş  ○ SKT'siz         │
│ Durum:    ◉ Aktif  ○ Arşivlenmiş  ○ Hepsi                       │
│ Fiyat:    [₺0 ─────── ₺5000] (range slider)                       │
└────────────────────────────────────────────────────────────────────┘
```

**Davranış:**
- Header click → expand/collapse (smooth 280ms)
- Aktif filtre sayısı header'da chip olarak gösterilir
- Tümünü Temizle → tüm filtreleri reset
- Her filtre değişikliği URL query string'e yansır (shareable link)
- `aria-expanded` doğru set edilir

**URL örnek:**
```
/admin/products?category=mama,aksesuar&hayvan=cat,dog&stock=critical&page=1
```

---

## 4. Arama

**Konum:** Üst bar'da arama input (üst bar'ın altında, filtre paneli üstünde, full-width)

```
[🔍 SKU, isim veya barkod ara…]  (/ veya Ctrl+F shortcut rozeti)
```

- Min 2 karakter
- 200ms debounce
- `/` veya `Ctrl+F` ile focus
- Arama kapsamı: ad, SKU, barkod (EAN-13)
- Eşleşen kelimeler highlight (bold)
- Empty state arama: "X için sonuç bulunamadı"

---

## 5. Tablo

### 5.1 Kolonlar

| Kolon | Genişlik | İçerik |
|---|---|---|
| ☑ | 40px | Bulk seçim checkbox |
| 🖼 | 56px | 48×48 ürün görseli (yoksa kategori SVG ikon) |
| **Ürün** | flex | Ad + SKU + hayvan emoji + SKT badge + variant chip |
| **Kategori** | 140px | Kategori (Bold) + marka alt satır |
| **Stok** | 120px | Toplam adet + dot + eşik (`47 ⚠ /50`) |
| **Fiyat** | 130px | Satış (Bold) + alış (küçük gri) + marj % |
| **Şube** | 100px | Tek şube tenant'ta **gizli** |

**Tek-şube tenant kontrolü:**
```ts
const isMultiBranch = branches.length > 1;
// isMultiBranch ? ['☑', 'img', 'name', 'category', 'stock', 'price', 'branch'] :
//                ['☑', 'img', 'name', 'category', 'stock', 'price']
```

### 5.2 Ürün Hücresi Detayı

```
[img] Royal Canin Adult Kedi 2kg     [3 varyant]
      RC-K-ADL · 8690000123456 · 🐱 · ⏰ 12g
```

- **Ad:** 13.5px Bold, tek satır ellipsis
- **Variant chip:** `[3 varyant]` (Bold) — 10.5px, `--bars-soft` bg, `--bars-700` text
  - 1 variant ise chip yok (tek satır ürün)
  - "Tek" yazısı gri 10px (varyantsız belli olsun)
- **Alt satır:** SKU + barkod + hayvan emoji + SKT badge
  - SKT badge sadece SKT < 30 gün ise: `⏰ 12g` (gün sayısı)
  - SKT < 7 gün: kırmızı, < 30 gün: turuncu

### 5.3 Stok Hücresi — Çift Davranış

**Default görünüm (parent ürün, multi-branch toplam):**
```
47 ⚠ / eşik 50
```

**Tıklama → inline expand (variant + şube matrix):**

Variant'sız ürün:
```
┌── Şube dağılımı ─────────────────┐
│ Merkez:    25 ✓ /eşik 30         │
│ Şube A:    12 ⚠ /eşik 20         │
│ Şube B:    10 🔴 /eşik 15        │
│ TOPLAM:    47 ⚠ /eşik 65         │
│                                    │
│ [📥 Stok Girişi] [🔄 Transfer]   │
└────────────────────────────────────┘
```

Variant'lı ürün (mockup parent grup tarzı):
```
┌── Variant + Şube matrix ──────────────────────────┐
│ Variant     │ Merkez │ Şube A │ Şube B │ Toplam │
│ 400g        │   12   │    8   │    5   │   25 ⚠ │
│ 2kg         │   10 🔴│    5   │    3   │   18 🔴│
│ 10kg        │    3 🔴│    1 🔴│    0 ⛔│    4 🔴│
│ TOPLAM      │   25   │   14   │    8   │   47   │
│                                                   │
│ [📥 Stok Girişi] [🔄 Transfer]                  │
└───────────────────────────────────────────────────┘
```

**Durum dot mantığı:**
- 🔴 Kritik: stok < eşik × 0.33
- ⚠ Düşük: stok < eşik
- ⛔ Tükendi: stok = 0
- ✓ Normal: stok >= eşik

### 5.4 Fiyat Hücresi

**Varyantsız ürün:**
```
₺250  (Bold büyük)
₺180  (küçük, gri — alış)
%39 marj (yeşil — pozitif)
```

**Varyantlı ürün (fiyat aralığı):**
```
₺95 — ₺1.150
%35 — %41 marj
```

- En düşük variant fiyatı — en yüksek
- Marj negatifse kırmızı (alış > satış olamaz validate, ama göstermek için)

### 5.5 "Satışa Aç" Toggle + "Doğrula" Buton (2026-05-13 eklendi, 2026-05-14 kapsam netleştirildi, **2026-05-21 Sprint 3.3 default true fix**)

> **2026-05-21 Sprint 3.3 fix:** `validateForStorefront.DEFAULT_OPTS.requireImage` artık **default true**.
> Önceden edit sayfası explicit `requireImage: true` geçiriyordu ama liste'deki `list-row-toggle` opts
> geçmiyordu → görselsiz ürün vitrin'e açılabiliyordu. Tutarsızlık giderildi.
>
> **Liste-row-toggle "Aç" akışı:** Görselsiz ürün → `validation_failed` + UI'da "⚠ N eksik —
> Doğrula panelinden gör" badge + **1.5 sn sonra `/admin/products/[id]/edit` redirect**
> (Doğrula paneli görsün). Network fail → "Bağlantı hatası" mesajı + rollback (setPublished revert).

> **Kapsam kararı (2026-05-14 — DEVAM-REHBERI mantık hatası #4):** Toggle **parent-level**dır. 50 ürün × 3 variant = 150 toggle UX riski yüksek olduğu için **variant bazlı toggle YOK**. Parent on → tüm aktif variant'lar (`productVariants.isActive=true`) vitrin'de gösterilir.
>
> **Senaryo:** Royal Canin Adult Kedi parent + 3 variant (400g, 2kg, 10kg). Pet shop "400g'ı vitrin'de istemiyorum" derse → variant düzenle → `isActive=false` (arşivle). Vitrin'de 2kg ve 10kg kalır.
>
> **Variant bazlı toggle Faz 2** — gerçek talep gelirse açılır. MVP'de sade tut.

**Her ürün satırının sağında** (hover eylemlerinden ÖNCE, sticky kolon):

```
┌─ Ürün satırı sonu ─────────────────────────────────┐
│  ... önceki kolonlar ...                            │
│                                                      │
│  Satışa Aç:  [⚪ off]   veya   [🟢 on]              │
│  Vitrin:     —                 ✓ Doğrulandı 3g önce │
└──────────────────────────────────────────────────────┘
```

**3 Durum:**

| Toggle | Doğrula | Anlam |
|---|---|---|
| ⚪ Off | Gizli | Ürün vitrin'de değil (default — sadece stok takip) |
| 🟢 On + eksik var | [Doğrula] **disabled** + tooltip | Toggle açıldı ama validation eksik |
| 🟢 On + tamam | [Doğrula] **enabled** | Validation pass, tıklayınca vitrin'e çıkar |
| 🟢 On + Doğrulandı | "✓ Doğrulandı" rozet | Ürün vitrin'de aktif |

**Toggle açıldığında — anlık backend validation:**

```ts
// Server Action: validateProductForVitrin
POST /api/admin/products/[id]/validate-for-vitrin
Response: {
  valid: false,
  missing: [
    { field: 'images', msg: 'En az 1 ürün görseli yükle', icon: '📷' },
    { field: 'sale_price', msg: 'Satış fiyatı boş', icon: '💰' },
    { field: 'sale_price', msg: 'Fiyat 0₺ — geçerli bir değer gir', icon: '💰' },
    { field: 'tenant_vat_no', msg: 'Vergi numarası eksik (şirket profili)', icon: '📋' },
  ]
}
```

**Validation Kuralları:**

```
✓ En az 1 ürün görseli (yoksa fail)
✓ AI image moderation (YT-1, 2026-05-14): görsel pet sektörüne uygun mu?
   - Cloudflare AI Workers (LLaVA-1.5 vision modeli) veya OpenAI Vision API
   - Prompt: "Bu görsel evcil hayvan ürünü mü? (mama/aksesuar/oyuncak/sağlık/akvaryum). Sadece evet/hayır cevap ver."
   - Fail durumu: ürün "Satışa Aç" toggle blocklu + modal "Görsel pet ürünü olarak doğrulanamadı"
   - Süperadmin manuel override butonu (false positive için)
   - Maliyet: ~$0.001-0.005/görsel × 1 görsel (sadece yeni yüklemede çalışır, cached result)
✓ Satış fiyatı > 0 (yoksa fail)
✓ Satış fiyatı 1₺ ≤ x ≤ 50.000₺ (makul aralık)
✓ Ürün adı min 3 karakter
✓ Kategori atanmış (NULL değil)
✓ Marka opsiyonel (önemli değil)
✓ Stok > 0 (en az 1 şubede)
✓ Tenant'ın vergi numarası dolu (yoksa vergi no modal'ı açılır — bkz. EKRAN-AYARLAR)
✓ Tenant'ın storefront_status = 'approved' (pending/disabled/rejected/auto_suspended ise modal yönlendirir — MANTIK-HATALARI K1)
```

**Vitrin'e açıldıktan sonra topluluk modlama (YT-1 hibrit ikinci katman):**

Müşteri vitrin'de ürünü görüp "🚩 Bildir > Yanlış fotoğraf" tıkladığında `vitrin_reports.report_type = 'wrong_photo'` kayıt girer (DATABASE-SCHEMA §3.9.5). Otomatik kural:
- 3 farklı IP'den `wrong_photo` raporu → ürün görsel **otomatik gizlenir** + tenant'a Telegram uyarı + süperadmin Manuel İnceleme'ye düşer
- Süperadmin "Doğru görseldi" derse rapor `dismissed` + IP'lere spam puanı
- Süperadmin "Yanlış görseldi" onaylarsa görsel kalıcı silinir + tenant'ın ürünü `auto_suspended`

**Eksik var → Tooltip + inline mesaj:**

```
[Doğrula] (disabled)
  ↓ hover
┌────────────────────────────────────────────┐
│ Vitrin'e açmak için eksikler:               │
│  📷 En az 1 görsel ekle                     │
│  💰 Satış fiyatı gir (1₺-50000₺)            │
│  📋 Vergi numaranı kaydet (Şirket Profili) │
│                                              │
│ [Eksikleri Düzelt →]  (Ürün edit sayfası)  │
└──────────────────────────────────────────────┘
```

"Eksikleri Düzelt" tıklayınca `/admin/products/[id]/edit` açılır, eksik bölüme **otomatik scroll**.

**Tüm validation PASS → Doğrula tıklama:**

```
[Doğrula] enabled tıkla
  ↓
Server Action: publishToVitrin
  → products.vitrin_published = true
  → products.vitrin_published_at = NOW()
  → products.vitrin_published_by_id = current_user.id
  → audit_log: 'product.publish_to_vitrin'
  → Telegram bildirim (opsiyonel — tenant ayarına göre)
  → Toast: "✓ Royal Canin Adult Kedi 2kg vitrin'de yayında"
```

**Vergi numarası eksikse — özel akış:**

Toggle açıldığında validation'da `tenant_vat_no` eksikse, "Doğrula" tıklamadan önce **modal**:

```
┌── Vergi numarası gerekli ─────────────────────────┐
│                                                     │
│ Vitrin'de ürün satışa açmak için vergi             │
│ mükellefi olmanız gerekiyor.                       │
│                                                     │
│ Vergi numaranızı girin (10 hane VKN veya 11 hane    │
│ TC kimlik no — şahıs şirketi):                      │
│ [__________]                                         │
│                                                     │
│ Vergi dairesi:                                      │
│ [_____________________]                              │
│                                                     │
│ ☑ Vergi mükellefi olduğumu beyan ederim             │
│                                                     │
│   [Sonra]  [Kaydet ve Doğrula]                     │
└──────────────────────────────────────────────────────┘
```

"Sonra" tıklarsa modal kapanır, "Doğrula" disabled kalır. "Kaydet ve Doğrula" tıklarsa companies.vat_no güncellenir ve ürün vitrin'e çıkar.

**Sticky kolon (mobile responsive):**

Mobile'da bu kolon kart bottom'una düşer:
```
┌────────────────────────────────────┐
│ [img] Royal Canin Adult            │
│       Mama · 🐱 · 3 varyant       │
│       Stok: 47 ⚠ · Fiyat: ₺250    │
│ ───────────────────────────────── │
│ Satışa Aç: [🟢 on] · ✓ Doğrulandı│
└────────────────────────────────────┘
```

### 5.6 Stok 0 Durumu — Otomatik Vitrin'den Çekme (2026-05-13)

Pet shop sahibi vitrin'e koyduğu ürünün stoğu bittiğinde **otomatik olarak vitrin'den çekilir** (DATABASE-SCHEMA.md §5.5):

**Trigger:** Her Stok Çıkışı/Transfer sonrası, ürünün tüm şube + variant toplam stoğu = 0 ise:
1. `products.vitrin_published = false`
2. `products.vitrin_auto_unpublished_at = NOW()`
3. `products.vitrin_auto_unpublished_reason = 'STOCK_OUT'`
4. Telegram bildirim: *"⛔ Royal Canin 2kg stoğu bitti, vitrin'den çekildi. Stok ekleyince Satışa Aç toggle ile yeniden açabilirsin."*
5. Ekran içi bildirim 🔔 (Pano dikkat bandı)

**UI'da gösterim:**
- Toggle OFF olur (otomatik)
- Yanında küçük rozet: `⛔ Stok bittiği için 12 May 14:30'da çekildi`
- Tooltip: *"Stok ekleyip 'Satışa Aç' toggle'ını yeniden açabilirsin (otomatik açılmaz)"*

**Kasıt:** Otomatik geri açma YOK. Stok ekledikten sonra **manuel "Satışa Aç" toggle** açılmalı. Kontrol kullanıcıda kalır (yanlış stok girişi → vitrin'de yanlış bilgi olmaması için).

### 5.7 Hover Satır Eylemleri

Satırın üstüne mouse gelince sağ tarafta belirir:

```
👁  ✏  📥  ⋯
```

- **👁 Detay:** Drawer açar (sağdan slide-in, ürün detay)
- **✏ Düzenle:** `/admin/products/[id]/edit` (yeni sayfa)
- **📥 Stok Girişi:** Stok Girişi drawer, ürün pre-filled
- **⋯ Daha fazla menü:**
  - 🛒 Yeni Satış (drawer pre-filled)
  - 🔄 Transfer (sadece multi-branch)
  - 📋 Sayım Başlat (sadece bu ürün)
  - 📋 Kopyala (form pre-filled, yeni ürün)
  - 🗄 Arşivle (soft delete)

### 5.6 Sıralama

Tıklanabilir kolonlar: Ürün adı, Kategori, Stok, Fiyat. Default: oluşturma tarihi DESC.

URL: `?sort=name-asc` veya `?sort=stock-desc`

### 5.7 Sayfalama

50 satır / sayfa default. `?page=2&pageSize=50`

```
[<<] [<] 1-50 / 87 [>] [>>]   [50/sayfa ▼]
```

---

## 6. Detay Drawer (`?detail=[id]`)

Sağdan slide-in, max-width 560px (Pano drawer'dan biraz daha geniş — ürün detay zengin).

### 6.1 Header

```
[← geri]  Royal Canin Adult Kedi Mama 2kg    [✏ Düzenle]  [⋯]  [×]
          RC-K-ADL-2KG · 8690000123456
```

### 6.2 Bölümler

**Bölüm 1: Görsel galeri (480×240px)**
- Drag-drop carousel (max 5 görsel)
- Ana görsel ⭐ rozet
- Hover'da büyütme, tıklama tam ekran

**Bölüm 2: Sınıflandırma**
```
Kategori: Mama > Kedi Maması
Marka: Royal Canin
Hayvan türü: 🐱 Kedi
Etiketler: yetişkin, kuru-mama, premium
```

**Bölüm 3: Fiyat (varyantsız ürün için)**
```
Alış:   ₺180.00
Satış:  ₺250.00  (%10 KDV dahil)
Marj:   %39  · ₺70 birim kar
```

**Bölüm 3 (varyantlı ürün):**
- Liste şeklinde tüm variant'lar: variant adı + satış + alış + marj

**Bölüm 4: Şube stok matrix** (5.3'teki gibi expanded)

**Bölüm 5: Açıklama**
- Markdown desteği (basit — bold, italic, list)
- Boşsa "Açıklama eklenmedi"

**Bölüm 6: Varyantlar (3 ve üzeri ise accordion)**
- < 3 variant: doğrudan liste
- >= 3 variant: accordion collapsed

```
[▼] 3 varyant
   400g  · RC-K-ADL-400G  · ₺95   · stok 25
   2kg   · RC-K-ADL-2KG   · ₺250  · stok 18
   10kg  · RC-K-ADL-10KG  · ₺1150 · stok 4
```

**Bölüm 7: Son 5 hareket**
- Stok hareketleri ledger entries (tarih + tip ikon + miktar + kullanıcı)
- Tıklama: ledger detay drawer (üst üste açılır)

**Bölüm 8: Metadata**
```
Eklenme:    07 Mar 2026, 14:32 · Ahmet
Son güncel: 5 May 2026, 09:15 · Zeynep
Toplam satış (30g): 47 adet · ₺11.750
Stok devir hızı: 1.4× / ay  (orta hız)
Son satış tarihi: 2 dk önce
```

**Bölüm 9 — Footer aksiyonlar:**
```
[Düzenle] [⚙ Eşik mini-modal] [📥 Stok Girişi]  [⋯ daha]
```

### 6.3 Eşik Mini-Modal

⚙ Eşik tıklandığında **küçük modal** açılır (drawer üstüne overlay):

```
┌── Eşik düzenle ────────────────────┐
│                                     │
│ Genel eşik (tüm şubeler için):     │
│ [10] adet                           │
│                                     │
│ ☐ Şube bazlı özelleştir            │
│   ▼ Açıldığında:                   │
│   Merkez:  [15]                    │
│   Şube A:  [10]                    │
│   Şube B:  [5]                     │
│                                     │
│         [İptal]  [Kaydet]          │
└─────────────────────────────────────┘
```

Variant'lı ürün için: variant başına ayrı eşik bölümü.

---

## 7. Yeni / Düzenle Sayfası

**URL:** `/admin/products/new` veya `/admin/products/[id]/edit`

**Layout: 2 kolon**

```
┌─────────────────────────────────────┬────────────────────┐
│ FORM (8 bölüm)                       │ ÖZET (sticky)      │
│                                       │                    │
│ [Bölüm 1: Temel]                     │ 🖼 [ana görsel]   │
│ Ad *                                  │                    │
│ SKU * (auto-suggest)                  │ Royal Canin...    │
│ Barkod (EAN-13)                       │ Mama > Kedi       │
│ Açıklama (markdown)                   │                    │
│                                       │ Satış: ₺250       │
│ [Bölüm 2: Sınıflandırma]             │ Marj: %39         │
│ Kategori * Marka Hayvan türü Tags    │                    │
│                                       │ Variant: 3        │
│ [Bölüm 3: Görseller]                 │                    │
│ Drag-drop max 5                       │ [Validation:      │
│                                       │  ✓ Ad             │
│ [Bölüm 4: Fiyat]                     │  ✓ SKU            │
│ Alış / Satış / KDV / Marj            │  ✓ Kategori       │
│                                       │  ✗ Görsel ekle    │
│ [Bölüm 5: Stok & Eşik]               │  ...]             │
│ Genel eşik / Şube bazlı / Başlangıç │                    │
│                                       │                    │
│ [Bölüm 6: SKT + Lot]                 │                    │
│                                       │                    │
│ [Bölüm 7: Varyantlar]                │                    │
│                                       │                    │
│ [Bölüm 8: Admin notu]                 │                    │
│                                       │                    │
└───────────────────────────────────────┴────────────────────┘

[İptal]              [Taslak Kaydet]      [Yayına Al]
```

### 7.1 Bölüm 1: Temel Bilgiler

```
Ad *           [_________________________]  (max 100)
SKU *          [_____] [🔓 manuel override] [auto-suggest]
Barkod         [_____________] EAN-13 validation
Açıklama       [textarea, markdown destekli]
```

**SKU otomatik suggest:**
- Kategori + marka kısaltma + sıra no
- `RC-K-ADL` (Royal Canin Kedi Adult) gibi
- 🔓 manuel override butonu → input editable

**EAN-13 validation:**
- 13 hane + checksum doğrulama
- Yanlışsa inline kırmızı `Geçerli EAN-13 değil (13 hane + checksum)`

**Çakışma kontrolü:**
- SKU `onBlur` → backend `GET /api/admin/products/check-sku?sku=...&excludeId=...`
- Çakışırsa inline `Bu SKU zaten kullanımda → öneri: RC-K-ADL-2`

### 7.2 Bölüm 2: Sınıflandırma

```
Kategori *     [Mama > Kedi Maması ▼]  (cascading dropdown)
Marka          [Royal Canin ▼ + Yeni]  (autocomplete + inline yeni)
Hayvan türü    🐱 🐶 🐦 🐟 🐰 🦎  (multi-checkbox icon grid)
Etiketler      [yetişkin] [kuru-mama] [+ ekle]  (chip input)
```

**Cascading dropdown:** Kategori 2 seviyeli (ana > alt). Faz 1'de daha derin gerek yok.

**Marka autocomplete:**
- Min 2 karakter → mevcut markalar
- "+ Yeni Marka: 'XYZ'" → inline modal (sadece ad input)
- Anında oluşur, dropdown'a eklenir

**Hayvan türü multi:**
- Icon grid: kedi/köpek/kuş/balık/tavşan/sürüngen
- Multiple checkbox (bazı ürünler iki tür için olabilir — örn "Kedi/Köpek Maması")

### 7.3 Bölüm 3: Görseller

```
┌── Drag & Drop ─────────────────────┐
│  Görselleri buraya sürükle          │
│  veya [Dosya seç]                   │
│                                     │
│  JPG, PNG, WebP · max 2MB her biri │
│  En fazla 5 görsel                 │
└─────────────────────────────────────┘

[img1 ⭐] [img2] [img3] [+]
```

- Drag-drop API + file input fallback
- Max 5 görsel
- Max **5MB** her biri (over → inline error) — Sprint 3.3'te 2MB → 5MB güncellendi
- Sadece JPG/PNG/WebP (over → inline error)
- İlk yüklenen otomatik **ana görsel** (⭐), `setPrimary` action ile değiştir
- Backend: **Cloudflare R2** bucket `petstockpro-images` (S3-compatible, AWS SDK v3 — Sprint 3.3 R2 migration 2026-05-19)
  - Object key pattern: `tenants/{companyId}/{productId}/{uuid}.{ext}` (path traversal koruması Zod regex)
  - Public URL: `R2_PUBLIC_URL` env (örn. `pub-xxxxx.r2.dev` veya custom domain)
  - Cache-Control: `public, max-age=31536000, immutable` (UUID-based key, CDN edge cache)
- Image transformations: Cloudflare R2 doğrudan transformation yok — frontend size hint ile yükler (thumb/medium opsiyonel Faz 2'de Cloudflare Images entegrasyonu)

### 7.4 Bölüm 4: Fiyat

```
Alış fiyatı *  [₺___]   (KDV hariç)
Satış fiyatı * [₺___]   (KDV dahil)
KDV oranı      [%10 ▼]  (kategori bazlı default — mama %10, aksesuar %20)
Birim kar      ₺{satış-alış-kdv}  (canlı hesap, gri)
Marj           %{(satış-alış)/satış × 100}  (yeşil pozitif, kırmızı negatif)
```

**Validasyonlar:**
- Alış > 0
- Satış >= Alış (negatif marj uyarı ama izin verir — promosyon mümkün)
- Marj %0 ise sarı uyarı "Marj sıfır, kontrol et"
- Marj negatif: kırmızı "Zarar satışı"

### 7.5 Bölüm 5: Stok ve Eşik

```
Genel eşik           [10] adet  (bu eşiğin altına düşünce uyarı)

☐ Şube bazlı eşik özelleştir
   ▼ Açıldığında:
   Merkez:    [10]
   Şube A:    [10]
   Şube B:    [5]

Başlangıç stoğu:
   Merkez:    [25]
   Şube A:    [0]
   Şube B:    [0]

  💡 Başlangıç stok > 0 ise otomatik 'Başlangıç Stoğu' tipi ledger entry yaratılır
```

**Başlangıç stoğu mantığı:**
- Form submit edildiğinde, başlangıç stoğu > 0 olan şubeler için **`stocktake_initial` tipi** ledger entry yazılır
- Tedarikçi alanı boş (initial olarak işaretli)
- Sayım hareketi olarak değil, "Başlangıç" olarak görünür

### 7.6 Bölüm 6: SKT + Lot

```
☐ Bu ürün için SKT zorunlu  (kategori bazlı default: mama ✓, aksesuar ✗)

Varsayılan SKT (opsiyonel — her stok girişinde override edilir):
   [____________]  YYYY-MM-DD

Lot/Parti no (opsiyonel):
   [_______________]
```

**Kategori bazlı default zorunluluk:**
- Mama, ilaç → SKT zorunlu (her stok girişinde mecbur)
- Aksesuar, oyuncak → SKT opsiyonel

### 7.7 Bölüm 7: Varyantlar — TAM AKTİF (Faz 1 §15)

```
Bu ürünün varyasyonları var mı?
○ Hayır, tek satır ürün
● Evet, varyantlı

Axis: [Boyut/Ambalaj ▼]  (MVP'de tek axis)

Varyantlar:
┌───┬────────┬──────────────┬────────────┬───────┬───────┬──────┐
│ # │ Etiket │ SKU          │ Barkod     │ Satış │ Alış  │ Eşik │
├───┼────────┼──────────────┼────────────┼───────┼───────┼──────┤
│ 1 │ 400g   │ RC-K-ADL-400G│ 8690...    │ ₺ 95  │ ₺ 60  │  5   │
│ 2 │ 2kg    │ RC-K-ADL-2KG │ 8690...    │ ₺250  │ ₺180  │ 10   │
│ 3 │ 10kg   │ RC-K-ADL-10KG│ 8690...    │ ₺1150 │ ₺850  │  3   │
└───┴────────┴──────────────┴────────────┴───────┴───────┴──────┘

[+ Variant ekle]
```

**Davranış:**
- Hayvan/varyantsız → backend transparent default variant yaratır (kullanıcı görmez, plan limit'te 1 sayılır)
- Varyantlı → her variant ayrı SKU + barkod + fiyat + eşik
- SKU otomatik suggest: `{parent SKU}-{variant etiketi upper}`
- Drag-sırala (variant sırası UI'da)
- 1 variant satırı silmek için: en az 1 variant zorunlu (hep)

**Validasyon:**
- Etiket zorunlu (her variant)
- SKU global UNIQUE
- Barkod opsiyonel, dolu ise EAN-13
- Satış fiyatı >= Alış

**Plan limit etkisi:**
- Parent ürün = 1 sayılır
- Variant'lar bedava (sınırsız — her plan'da)
- 3-tier B (2026-05-14): FREE 50 parent / PRO 500 parent / PRO+ ∞ parent · her parent altında variant sınırsız
- Örnek: PRO tenant 500 parent ürün × ortalama 3 variant = 1.500 SKU pratik kapasite (variant'lar limit'e sayılmaz)

### 7.8 Bölüm 8: Admin Notu (gizli)

```
Sadece admin görür:
[textarea]  (müşteri/staff için görünmez, internal not)
```

### 7.9 Sticky Sağ Özet

```
[ana görsel preview]

Royal Canin Adult Kedi 2kg
Mama > Kedi Maması
🐱 Kedi

Satış: ₺250
Alış:  ₺180
Marj:  %39

Varyant: 3
Şube stoğu: 25 / 0 / 0

────────────────
Validasyon durumu:
✓ Ad
✓ SKU
✓ Kategori
✗ Görsel ekle  ← scroll'da o bölüme gider
✓ Fiyat
✓ Eşik
```

**Footer (sticky):**
```
[İptal]            [Taslak Kaydet]      [Yayına Al]
```

- **Taslak Kaydet:** `is_published = false`, ürün listede görünmez, sadece taslaklarda
- **Yayına Al:** `is_published = true`, validation tam geçmeli
- **İptal:** Kullanıcı `İptal` tıklayınca **eğer değişiklik varsa** "Kaydetmeden çıkmak istediğine emin misin?" modal sorar (sweetalert2)

### 7.10 Auto-Save Taslak

Form 30 saniyede bir background'da taslak olarak kayıt. Sayfa kapatılıp tekrar açıldığında:

```
┌── Devam edilmemiş taslak bulundu ──┐
│                                     │
│ "Royal Canin Adult..." ürünü için   │
│ 5 dakika önce taslak kaydedildi.    │
│                                     │
│ Devam etmek ister misin?            │
│                                     │
│   [Yeni başla]  [Taslağı yükle]    │
└─────────────────────────────────────┘
```

**Implementation:** localStorage key `product-draft-{tenantId}` JSON, 7 gün TTL.

---

## 8. Bulk Actions

☑ ile 1+ ürün seçilince sticky alt bar:

```
─────────────────────────────────────────────────────────
3 ürün seçildi  |  [Eşik değiş] [Kat. ata] [Fiyat değiş] [Arşivle] [Excel] [Kopyala] [⋯]
─────────────────────────────────────────────────────────
```

### 8.1 Eşik Değiştir (Bulk)

Mini-modal:
```
3 ürün için yeni eşik:
○ Genel eşik [_]
○ % artır [_]
○ % azalt [_]
○ Şube bazlı (her şube için input)
```

### 8.2 Kategori/Marka Ata

Mini-modal cascading dropdown.

### 8.3 Fiyat Değiştir (Bulk)

```
3 ürün satış fiyatını:
○ % artır [10] %
○ % azalt [_] %
○ Sabit ekle [_] ₺
○ Sabit çıkar [_] ₺
```

### 8.4 Arşivle (Soft Delete)

```
3 ürünü arşivlemek istediğinden emin misin?
Arşivlenmiş ürünler listede görünmez ama stok hareketleri korunur.
İstediğinde geri açabilirsin.

[İptal]  [Arşivle]
```

**Davranış:**
- `is_active = false`
- Bulk audit log entry
- Ürün listede `Aktif` filtresinde gizli, `Arşivlenmiş` filtresinde görünür
- Stok hareketleri ledger'da korunur, ürün adı + SKU referans korur

### 8.5 Excel'e Aktar

- 3 ürün için CSV/Excel export
- Sütunlar: SKU, Ad, Kategori, Marka, Stok (şube başına), Fiyat, vb.
- Browser download

### 8.6 Kopyala

- 1 ürün seçili ise: form pre-filled, SKU/barkod boş (override gerek)
- Multi seçim için kopyala disabled

### 8.7 Daha Fazla (⋯)

- 📦 Yığın stok girişi (bir tedarikçiden tüm seçili ürünler)
- 🏷 Toplu indirim oluştur
- 📋 Sayım listesine ekle

### 8.8 Toplu Vitrin'e Aç / Çıkar (2026-05-13 eklendi)

Yaz tatili dönüşü, sezon değişimi, toplu stok girişi gibi senaryolarda 30-50 ürünü tek tek "Satışa Aç" toggle açmak çok yorucu. **Bulk versiyonu zorunlu.**

```
┌── Seçili 30 ürünü vitrin'e aç ─────────────────────────┐
│                                                          │
│ Backend toplu validation çalıştırılacak:                │
│  ✓ 24 ürün vitrin'e açılabilir (validation pass)       │
│  ⚠ 6 ürün eksik bilgili — vitrin'e açılamaz             │
│                                                          │
│ Eksik 6 ürün detayı:                                     │
│  • Royal Canin 2kg — 📷 Görsel yok                       │
│  • Whiskas Adult — 💰 Fiyat 0₺                          │
│  • Pro Plan 15kg — 📷 Görsel yok, 💰 Fiyat 0₺           │
│  • ... (3 ürün daha)                                     │
│                                                          │
│  [Eksik ürünleri Excel'e indir]                          │
│                                                          │
│ Eksik olanlar için 3 seçenek:                            │
│  ◉ Sadece 24 valid ürünü vitrin'e aç (eksik olanlar atla)│
│  ○ İptal et, önce eksikleri düzelt                       │
│  ○ Eksik ürünleri "düzenleme listem"e ekle (geçici list)│
│                                                          │
│ Vergi no kontrolü: ✓ Dolu (1234567890)                  │
│                                                          │
│   [İptal]  [✓ 24 Ürünü Vitrin'e Aç]                    │
└──────────────────────────────────────────────────────────┘
```

**Backend:** Tek transaction içinde 24 ürünün `vitrin_published = true`, audit log toplu insert, Telegram bildirim ("24 ürün vitrin'e açıldı"). Eğer tenant'ın vergi no yoksa, vitrin profili yoksa veya KVKK onayı yoksa **batch reddedilir** + hata mesajı.

**Toplu çıkarma:** Aynı şekilde "Vitrin'den Çıkar" — sezon sonu, ürün hattını kapatma için.

**Klavye kısayolu:** Bulk seçim + `V` tuşu → Vitrin'e Aç drawer açılır.

---

## 9. Soft Delete (HARD DELETE YOK)

Mockup-v3 ve Faz 1 kararı: **Ürün hard delete edilmez**.

**Sebep:**
- Ledger'da referans (stock_movements.variant_id)
- Sales geçmişinde referans
- Audit log entries

**Davranış:**
- "Sil" butonu yok (UI'da gizli)
- API `DELETE /admin/products/[id]` → 405 Method Not Allowed
- Sadece arşivleme (`is_active = false`)

**Arşivlenmiş ürün:**
- Listede `Arşivlenmiş` filtresinde görünür
- Yeni satış/giriş drawer'larında autocomplete'de görünmez
- Ledger'da geçmiş hareketleri korunur (ürün adı görünür)
- Detay drawer'da `[Geri aç]` butonu var

---

## 10. Plan Limit Kontrolü

3-tier B (2026-05-14 — `PLAN-KADEMELERI.md §1 + §4`):

| Plan | Aktif ürün limiti | Aşıldığında |
|---|---|---|
| FREE | 50 | `+ Yeni Ürün` disabled, PRO upsell |
| PRO | 500 | `+ Yeni Ürün` disabled, PRO+ upsell |
| PRO+ | ∞ (sınırsız) | Hiç tetiklenmez |

**Server-side helper (otoritatif):**

```ts
// src/lib/plan/limits.ts
export function getPlanLimit(plan: 'FREE' | 'PRO' | 'PRO_PLUS'): number {
  switch (plan) {
    case 'FREE': return 50;
    case 'PRO': return 500;
    case 'PRO_PLUS': return Infinity;
  }
}

export function getUpgradeTarget(plan: 'FREE' | 'PRO' | 'PRO_PLUS'): {
  next: 'PRO' | 'PRO_PLUS' | null;
  label: string;
  limit: string;
} | null {
  switch (plan) {
    case 'FREE': return { next: 'PRO', label: "PRO'ya yükselt", limit: '500 ürün' };
    case 'PRO': return { next: 'PRO_PLUS', label: "PRO+'ya yükselt", limit: 'sınırsız' };
    case 'PRO_PLUS': return null;
  }
}
```

**Trigger noktaları:**
1. `+ Yeni Ürün` buton click
2. Yeni ürün form `Yayına Al` submit
3. Bulk "Kopyala" — N kopya × seçili adet (toplam aşacaksa modal)

### 10.1 %80'e ulaştığında (yumuşak uyarı)

Pano "Aktif Ürün" KPI ring turuncu olur (Pano §3.7).
Ürünler sayfasında üst bar plan progress turuncu.

**Banner — plan'a göre:**

FREE %80 banner:
```
⚠ Limit'e yaklaştın (47/50) · PRO'ya yükselt (500 ürün) →
```

PRO %80 banner:
```
⚠ Limit'e yaklaştın (412/500) · PRO+'ya yükselt (sınırsız) →
```

PRO+: limit mesajı YOK (sınırsız, banner hiç çıkmaz).

### 10.2 %100 doldu (sert blok)

`+ Yeni Ürün` buton **disabled**, plan'a göre tooltip:

FREE %100:
```
FREE 50 doldu (50/50)
PRO'ya yükselt (500 ürün) veya bir ürünü arşivle
```

PRO %100:
```
PRO 500 doldu (500/500)
PRO+'ya yükselt (sınırsız) veya bir ürünü arşivle
```

PRO+: bu state hiç oluşmaz.

**Yeni ürün sayfasına URL ile gidilirse — modal (FREE örneği):**

```
┌── FREE 50 doldu ─────────────────────────────────┐
│                                                    │
│ FREE plan 50 ürün limitine ulaştın. Yeni ürün    │
│ ekleyebilmek için:                                 │
│                                                    │
│ ○ PRO'ya yükselt (500 ürün)                       │
│ ○ Bir ürünü arşivle (limit altına in)             │
│                                                    │
│ Taslak olarak kaydedebilirsin (yayına alınmaz)   │
│                                                    │
│ [Taslak Kaydet]  [PRO'ya yükselt]  [Vazgeç]      │
└────────────────────────────────────────────────────┘
```

**PRO 500 doldu — modal:**

```
┌── PRO 500 doldu ────────────────────────────────┐
│                                                    │
│ PRO plan 500 ürün limitine ulaştın. Yeni ürün    │
│ ekleyebilmek için:                                 │
│                                                    │
│ ○ PRO+'ya yükselt (sınırsız ürün)                 │
│ ○ Bir ürünü arşivle (limit altına in)             │
│                                                    │
│ Taslak olarak kaydedebilirsin (yayına alınmaz)   │
│                                                    │
│ [Taslak Kaydet]  [PRO+'ya yükselt]  [Vazgeç]     │
└────────────────────────────────────────────────────┘
```

**Backend enforcement:**
- API endpoint POST `/admin/products` → `currentActiveCount + 1 > getPlanLimit(tenant.plan)` ise 402 Payment Required + `{ plan, limit, used, upgradeTarget }` body
- PRO+ için check skip (Infinity karşılaştırması her zaman false)
- Drizzle pre-insert check (transaction içinde count + insert)
- Race condition için DB-level trigger (`active_product_count_per_tenant` materialized view veya `BEFORE INSERT` plan limit guard)

---

## 11. Empty State

### 11.1 Hiç ürün yok (yeni tenant)

```
┌─────────────────────────────────────────┐
│                                          │
│         [kedi+köpek mascot]              │
│                                          │
│      İlk ürününü ekle                   │
│ Kataloğun boş. Bir ürün ekleyerek       │
│ stok takibine başla.                    │
│                                          │
│         [+ İlk Ürünü Ekle]              │
└─────────────────────────────────────────┘
```

### 11.2 Filtre sonucu boş

```
┌─────────────────────────────────────────┐
│                                          │
│         [köpek başını eğmiş]            │
│                                          │
│      Filtreyle eşleşen ürün yok         │
│ "mama" + "düşük stok" filtresi için    │
│ sonuç bulunamadı.                      │
│                                          │
│         [Filtreleri Temizle]            │
└─────────────────────────────────────────┘
```

### 11.3 Arama sonucu boş

```
"royal abc" için 0 sonuç
Yazımı kontrol et veya filtre kaldır.
```

---

## 12. State Management

### 12.1 URL → Filter State

URL query params → filter state (server component'te `searchParams` ile):

```ts
const filters = productFiltersSchema.parse({
  category: searchParams.category?.split(','),
  brand: searchParams.brand,
  hayvan: searchParams.hayvan?.split(','),
  branch: searchParams.branch,
  stock: searchParams.stock, // 'all' | 'low' | 'out' | 'normal'
  skt: searchParams.skt,
  status: searchParams.status, // 'active' | 'archived' | 'all'
  priceMin: Number(searchParams.priceMin) || undefined,
  priceMax: Number(searchParams.priceMax) || undefined,
  search: searchParams.q,
  sort: searchParams.sort || 'created-desc',
  page: Number(searchParams.page) || 1,
  pageSize: Number(searchParams.pageSize) || 50,
});
```

### 12.2 TanStack Query

```ts
const { data, isPending } = useQuery({
  queryKey: ['products', filters],
  queryFn: () => fetchProducts(filters),
  staleTime: 30_000,
});
```

### 12.3 Realtime — Yeni ürün eklendiğinde

```ts
supabase.channel('products')
  .on('postgres_changes', { event: 'INSERT', table: 'products', filter: `company_id=eq.${companyId}` },
    () => queryClient.invalidateQueries(['products']))
  .subscribe();
```

### 12.4 Optimistic Update — Eşik değişti

```ts
const mutation = useMutation({
  mutationFn: updateThreshold,
  onMutate: async (newThreshold) => {
    await queryClient.cancelQueries(['products']);
    const prev = queryClient.getQueryData(['products', filters]);
    queryClient.setQueryData(['products', filters], (old) => {
      // optimistically update threshold
    });
    return { prev };
  },
  onError: (err, _, ctx) => queryClient.setQueryData(['products', filters], ctx.prev),
  onSettled: () => queryClient.invalidateQueries(['products']),
});
```

---

## 13. API Endpoint Listesi

| Endpoint | Method | Açıklama |
|---|---|---|
| `/api/admin/products` | GET | Liste + filtre + sort + pagination |
| `/api/admin/products/[id]` | GET | Tek ürün + variants + branch_inventory |
| `/api/admin/products` | POST | Yeni ürün (plan limit kontrolü) |
| `/api/admin/products/[id]` | PATCH | Düzenle |
| `/api/admin/products/[id]/archive` | POST | Soft delete |
| `/api/admin/products/[id]/restore` | POST | Geri aç |
| `/api/admin/products/[id]/duplicate` | POST | Kopyala (yeni ürün form pre-filled) |
| `/api/admin/products/check-sku` | GET | SKU çakışma kontrolü |
| `uploadImageAction` server action | — | Cloudflare R2 upload (multipart formData, `tenants/{companyId}/{productId}/{uuid}.{ext}`) |
| `/api/admin/products/bulk/threshold` | POST | Bulk eşik değiştir |
| `/api/admin/products/bulk/category` | POST | Bulk kategori ata |
| `/api/admin/products/bulk/price` | POST | Bulk fiyat değiştir |
| `/api/admin/products/bulk/archive` | POST | Bulk arşivle |
| `/api/admin/products/export` | GET | CSV/Excel export |
| `/api/admin/categories` | GET/POST | Kategori CRUD |
| `/api/admin/brands` | GET/POST | Marka CRUD |
| `/api/admin/products/[id]/threshold` | PATCH | Tek ürün eşik (mini modal) |

---

## 14. Responsive Davranış

### 14.1 Desktop (>= 1280px)
Tüm kolonlar görünür, hover eylemleri.

### 14.2 Tablet (1024-1279px)
Şube kolonu gizlenir (tablo dar).

### 14.3 Tablet Küçük (768-1023px)
- Kategori + Stok + Fiyat tek hücreye stack
- Filtreler bottom-sheet drawer
- Bulk action bar yine sticky

### 14.4 Mobile (< 768px)
- Tablo yerine **kart liste**:
  ```
  ┌────────────────────────────────────┐
  │ [img] Royal Canin Adult            │
  │       Mama · 🐱 · 3 varyant       │
  │       Stok: 47 ⚠ · Fiyat: ₺250    │
  │                          [⋯]       │
  └────────────────────────────────────┘
  ```
- Hover yerine tıklama menü
- Filtre drawer full-screen

---

## 15. Klavye Kısayolları

| Kısayol | İşlem |
|---|---|
| `/` veya `Ctrl+F` | Arama focus |
| `n` | Yeni ürün sayfası |
| `f` | Filtre panel toggle |
| `↑` `↓` | Tablo satır gezin |
| `Enter` | Seçili satır detay drawer |
| `Space` | Satır seç |
| `Ctrl+A` | Tümünü seç |
| `Esc` | Drawer / modal kapat |
| `Ctrl+S` | Form (yeni/düzenle) kaydet |

---

## 16. Erişilebilirlik

- Tablo `<table>` semantic, `<th scope="col">`
- Filtre paneli `<details>/<summary>` veya `aria-expanded` doğru
- Drag-drop image upload klavye fallback (`<input type="file">`)
- Variant satırları drag-sırala için klavye alternative (↑↓ + Space)
- Empty state mascot `aria-hidden`
- Bulk action bar `<output>` veya `aria-live="polite"`

---

## 17. Performans Hedefleri

| Metrik | Hedef | Strateji |
|---|---|---|
| **LCP (50 ürün)** | < 2s | RSC + Drizzle query optimize |
| **Image lazy-load** | Görseller viewport'a girince | next/image priority={false} |
| **Pagination** | < 300ms switch | Prefetch sonraki sayfa (TanStack Query) |
| **Arama debounce** | 200ms | useDebouncedValue hook |
| **Variant expand** | < 100ms | Local state (DB fetch yok, parent ile gelir) |

---

## 18. Test Senaryoları

### PROD-001 — Liste varsayılan: 35 ürün, 50/sayfa
### PROD-002 — Tek-şube tenant Şube kolonu gizli
### PROD-003 — 4 KPI metrik (toplam/düşük/SKT/tükendi)
### PROD-004 — KPI tıklama: filtreli sayfa
### PROD-005 — Arama `/` shortcut + min 2 karakter
### PROD-006 — Arama SKU ile bulma
### PROD-007 — Arama barkod ile bulma
### PROD-008 — Filtre: kategori multi-select
### PROD-009 — Filtre: hayvan türü 🐱🐶 multi
### PROD-010 — Stok kolonu expand: variant+şube matrix
### PROD-011 — Hover satır eylemleri görünür
### PROD-012 — Detay drawer: tüm bölümler
### PROD-013 — Detay drawer eşik mini-modal
### PROD-014 — Yeni Ürün form: zorunlu alan boş hatası
### PROD-015 — Yeni Ürün barkod EAN-13 validation
### PROD-016 — Yeni Ürün SKU çakışması inline öneri
### PROD-017 — Yeni Ürün görsel >2MB reddi
### PROD-018 — Yeni Ürün görsel format reddi
### PROD-019 — Yeni Ürün auto-save taslak (30sn)
### PROD-020 — Düzenle başlangıç stoğu → `stocktake_initial` ledger
### PROD-021 — Bulk: 5 ürün fiyat değiştir
### PROD-022 — Bulk arşivle (soft delete)
### PROD-023 — Hard delete YOK (API 405)
### PROD-024 — Plan limit blok (3-tier B): FREE 51. ürün, PRO 501. ürün, PRO+ sınırsız geçer
### PROD-025 — İnline edit sadece eşik (diğeri sayfaya yönlendir)
### PROD-026 — Variant ekleme: SKU otomatik suggest
### PROD-027 — Variant ekleme: en az 1 variant zorunlu
### PROD-028 — Variant'lı ürün fiyat aralığı görüntüleme
### PROD-029 — Arşivlenmiş ürün autocomplete'de görünmez
### PROD-030 — Empty state: 0 ürün mascot kart

---

## 19. Faz 1 ile Tutarlılık

| Faz 1 | Bu doküman | Durum |
|---|---|---|
| §11.3 8 form bölümü | Aynen | ✅ |
| §15 Variant tam aktif | Aynen | ✅ |
| Soft delete (hard delete yok) | Aynen | ✅ |
| Plan limit parent = 1, variant bedava | 3-tier B uygulandı (FREE 50 / PRO 500 / PRO+ ∞) | ✅ (2026-05-14) |
| Auto-save taslak 30sn | Aynen | ✅ |
| Tek-şube tenant Şube kolonu gizli | Aynen | ✅ |
| Hover satır eylemleri | Aynen | ✅ |
| Stok kolonu expand | Aynen | ✅ |
| Tone palette (cat/dog/arrow/bars) | Yeni — TASARIM-SISTEMI uygulandı | ✅ |
| Realtime invalidation | Yeni — Supabase Realtime | 🆕 |

---

## 20. Sıradaki Adım

✅ EKRAN-PANO.md
✅ EKRAN-URUNLER.md (bu doküman)
⏭ **EKRAN-STOK-HAREKETLERI.md** — Ledger + 4 hareket drawer'ı

---

*Son güncelleme: 2026-05-14. Mockup-v3 tasarım dili uygulandı, Faz 1 §11.3 + §15 entegre. Plan limit 3-tier B (FREE 50 / PRO 500 / PRO+ ∞) uygulandı.*
