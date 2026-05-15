# Ekran: Raporlar

**URL'ler:**
- Liste: `/admin/reports`
- Detay: `/admin/reports/sales`, `/profit-loss`, `/best-sellers`, `/dead-stock`, `/branch-comparison`

**Sidebar yeri:** Analiz grubu, 1. sıra · 📈 Raporlar
**Erişim:** ADMIN (bayi sahibi tüm raporlar, şube müdürü sadece kendi şubesi). **STAFF (kasiyer) erişimi YOK** — sidebar'da Raporlar menüsü gizli, doğrudan URL ile 403 Forbidden (yetki matrisi: `EKRAN-KULLANICILAR.md §12.5`, 2026-05-14 OT2-5).
**Referans:** Faz 1 `FAZ1-TASARIM-KARARLARI.md` §21-22 · Tasarım `TASARIM-SISTEMI.md`

> Faz 1 R: **Hibrit yapı** (kart grid özet + drilldown detay). **Top 6 kritik rapor** MVP'de (Açık Krediler eklendi 2026-05-14 S2), diğer 5 (ABC, kategori, devir, tedarikçi, SKT) Faz 2'ye saklı.

---

## 1. Liste Sayfası Layout

```
┌─────────┬──────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Yönetim > Analiz > Raporlar)             │
│         ├──────────────────────────────────────────────────┤
│         │ Üst filtre: Periyot · Şube · [⬇ Toplu PDF][⬇XLS]│
│         │ Üst KPI: 💰 Net kâr · 🛒 Ciro · 🔄 Devir hızı  │
│         │                                                    │
│         │ Bento grid (6 rapor kartı, col-4'er — Açık Krediler eklendi 2026-05-14 S2):│
│         │ [📊 Satış] [💰 Kâr/Zarar] [🏆 En çok satan]      │
│         │ [🪦 Ölü Stok] [🏢 Şube kıyas] [💳 Açık Krediler] │
│         │ Her kart: ana metrik + delta + sparkline + Detay→│
└─────────┴──────────────────────────────────────────────────┘
```

## 2. Üst Bar

```
Periyot:  ◉ Bu ay  ○ Geçen ay  ○ Son 7g  ○ Son 30g  ○ Özel [_]─[_]
Şube:     [Tüm şubeler ▼]
                                  [⬇ Toplu PDF] [⬇ Excel]
```

**Toplu PDF:** 6 raporun tek dokümanda derlemesi (kapak + her rapor 1 sayfa).
**Excel:** Her rapor ayrı sheet'te.

## 3. Üst KPI Şeridi

```
💰 Net kâr (bu ay)   🛒 Ciro (bu ay)    🔄 Devir hızı
   ₺12.450             ₺38.500            1.4× / ay
   ▲+%18 ay-ay         ▲+%23              ▼-%5
```

Tıklayınca ilgili detay rapora gider.

## 4. 6 Rapor Kartı (2026-05-14 — S2 + YT-4)

### 4.1 📊 Satış Raporu

```
┌─────────────────────────────┐
│ 📊 Satış Raporu              │
│ Periyot: Bu ay               │
├─────────────────────────────┤
│ ₺38.500                       │
│ ▲+%23 dünden                  │
│                              │
│ [Sparkline son 7 gün]        │
│                              │
│       Detay →                 │
└─────────────────────────────┘
```

### 4.2 💰 Kâr/Zarar

Ana metrik: Net kâr ₺12.450 · Marj %32

### 4.3 🏆 En Çok Satan

Ana metrik: 1. Royal Canin 2kg (180 adet ₺45.000)

### 4.4 🪦 Ölü Stok

Ana metrik: 8 ürün hareketsiz · Bağlı sermaye ₺18.200

### 4.5 🏢 Şube Karşılaştırma

Ana metrik: En güçlü: Merkez (₺18.500), Şube B düşüş ▼-%12

### 4.6 💳 Açık Krediler (2026-05-14 — MANTIK-HATALARI S2 eklendi)

> Veresiye satışları takip eder. `stock_movements WHERE payment_method='credit' AND credit_paid_at IS NULL` üzerinden gruplama.

Ana metrik: 12 açık kredi · Toplam **₺3.420** · En eski 47 gün önce

```
Açık krediler tablosu:
┌─────────────────────────────────────────────────────────┐
│ Müşteri (customer_ref)   │ Tarih      │ Tutar │ Gün  │
├──────────────────────────┼────────────┼───────┼──────┤
│ Ayşe T. · 0532***1234    │ 28 Nis 2026│ ₺250  │ 16   │
│ Veresiye - Anonim         │ 12 Nis 2026│ ₺420  │ 32   │
│ Mehmet K. · 0535***5678   │ 3 Nis 2026 │ ₺180  │ 41   │
│ ...                                                      │
│ TOPLAM                                       ₺3.420  47g│
└─────────────────────────────────────────────────────────┘

Yaş analizi:
  0-15 gün:  ₺520   (3 kayıt) — yeni
  16-30 gün: ₺1.450 (4 kayıt) — orta
  31-60 gün: ₺1.250 (4 kayıt) — eski
  60+ gün:   ₺200   (1 kayıt) — riskli (kırmızı uyarı)

[Krediyi kapama]: Tıklayınca müşteri ödeme yaptı → `credit_paid_at = NOW()` set.
  Audit log: 'sale.credit_settled' (kim kapadı, hangi tarih)

[CSV/Excel] [PDF]
```

> Faz 3'te müşteri DB açılınca bu rapor "müşteri başına borç" grupla, müşteri kartında "Açık bakiye 850₺" göster.

## 5. Detay Rapor Sayfaları

### 5.1 Satış Raporu (`/admin/reports/sales`)

```
Filtre: Periyot · Şube · Ödeme tipi · Kategori

Ana chart (col-8): Line chart 30 gün ciro
  Hover: adet/ciro/ortalama sepet

Yan widget'lar (col-4):
  • Donut: ödeme tipi (Nakit %42, Kart %38, Havale %15, Kredi %5)
  • Bar: şube ciro
  • Donut: kategori dağılım

Tablo:
  Tarih │ Adet │ Ciro │ Ort sepet │ Net marj
  
KPI vurgu: "Ortalama sepet: ₺125 · Upsell sinyali"
```

### 5.2 Kâr/Zarar (`/admin/reports/profit-loss`)

```
Filtre: Periyot · Şube · Kategori

Ana chart: Combo
  • Line: net kâr (yeşil)
  • Bar yeşil: ciro
  • Bar kırmızı: maliyet

Yan widget:
  • Kategori marj bar grafik
  • Top 5 en kârlı ürün
  • Top 5 en az kâr eden (fiyatlama hatası tespiti)

Tablo:
  Ürün │ Adet │ Ciro │ Maliyet │ Marj % │ Net kâr
  
KPI vurgu: "En az kâr: Trixie Kum Kabı %12 (fiyatlama gözden geçir)"
```

### 5.3 En Çok Satan (`/admin/reports/best-sellers`)

```
Filtre: Periyot · Şube · Kategori · Sıralama (adet/ciro)

Ana chart: Top 20 ürün yatay bar (sıralı)

Yan widget:
  • Top 5 trend line (son 3 ay haftalık)
  • Kategori başına top 3
  • Stok yeterli mi alarmı (top satanlar bitiyor mu?)

Tablo:
  Sıra │ Ürün │ Adet │ Ciro │ Toplam % │ Stok durumu

Stok uyarısı: "Royal Canin 2kg #1 satılan ama stok 5 kaldı, sipariş gerek"
```

### 5.4 Ölü Stok (`/admin/reports/dead-stock`)

```
Filtre: Son satış N gün önce (30+/60+/90+/180+) · Şube · Kategori

Ana chart: Gün gruplarına göre dağılım bar

Yan widget:
  • Sermaye batık toplam (cost × stock for dead products)
  • Kategori dağılım

Tablo:
  Ürün │ Son satış │ Stok │ Birim alış │ Toplam değer │ Kaç gün durdu

Aksiyon kolonu (her satır):
  🏷 İndirim öner · 📤 Tedarikçi iade · 🔄 Şube transfer · 🗄 Arşivle

KPI vurgu: "Bu ürünler 90+ gün durdu, ₺18.200 bağlı sermaye"
```

### 5.5 Şube Karşılaştırma (`/admin/reports/branch-comparison`)

```
Filtre: Periyot

Ana chart: Şube ciro bar (bu ay vs geçen ay)

Yan widget:
  • En güçlü şube
  • En hızlı büyüyen
  • Düşüş yaşayan (uyarı)

Tablo:
  Şube │ Ciro │ Net kâr │ Marj │ Aktif ürün │ Düşük stok │ Trend (↑↓)

İleri analiz: Şube × Kategori heatmap (hangi şube hangi kategoride güçlü)
```

## 6. Export

### 6.1 PDF (Tek Rapor)

- Header: PetStockPro logo + Tenant adı + Rapor adı + Periyot
- İçerik: Ana chart (PNG render) + tablo + KPI'lar
- Footer: Üretildi tarih + sayfa N/M
- Üretim: Supabase Edge Function (React-PDF), 5-15 saniye

### 6.2 PDF (Toplu — 6 rapor)

Tek dokümanda:
- Kapak sayfası
- İçindekiler
- 6 rapor (her biri 1-2 sayfa)
- Sonuçlar özeti

Üretim ~30-60 saniye, Supabase Edge Function async (e-posta linki gönderilir).

### 6.3 Excel

- Sheet 1: Özet KPI
- Sheet 2-6: Her rapor için ayrı sheet (tablo data)
- Chart resim olarak embed

## 7. State + API

```ts
const { data } = useQuery({
  queryKey: ['report', type, filters],
  queryFn: () => fetchReport(type, filters),
  staleTime: 300_000,  // 5dk cache (raporlar pahalı)
});
```

| Endpoint | Method |
|---|---|
| `/api/admin/reports/summary` | GET (liste sayfası 6 kart + üst KPI) |
| `/api/admin/reports/sales` | GET (detay) |
| `/api/admin/reports/profit-loss` | GET |
| `/api/admin/reports/best-sellers` | GET |
| `/api/admin/reports/dead-stock` | GET |
| `/api/admin/reports/branch-comparison` | GET |
| `/api/admin/reports/open-credits` | GET (Açık Krediler — 2026-05-14 S2) |
| `/api/admin/reports/open-credits/[movementId]/settle` | POST → `credit_paid_at = NOW()` + audit `sale.credit_settled` |
| `/api/admin/reports/[type]/export` | POST `{format: 'pdf'\|'xlsx'}` |
| `/api/admin/reports/bulk-pdf` | POST → Edge Function tetikle |

## 8. Performans

| Rapor | Tipik süre | Strateji |
|---|---|---|
| Liste 6 kart | < 2s | Pre-aggregated `materialized view` (günlük cron); Açık Krediler için ayrı sorgu (`payment_method='credit' AND credit_paid_at IS NULL`) |
| Satış detay | 30g, < 2s | Index + filter optimization |
| Kâr/Zarar | 30g, < 3s | Cost calculation cached |
| Ölü stok | All-time, < 5s | Last_sold_at indexli |
| Şube kıyas | < 2s | Pre-aggregated |

DB Index'ler:
```sql
CREATE INDEX idx_sm_company_type_date ON stock_movements(company_id, type, created_at DESC);
CREATE INDEX idx_sm_variant_sale ON stock_movements(variant_id, created_at DESC) WHERE type = 'sale';
CREATE INDEX idx_bi_last_sale ON branch_inventory(last_sold_at);
```

## 9. Empty State

```
[köpek+grafik mascot]
Henüz rapor için yeterli veri yok
Birkaç satış kaydı sonra raporlar dolacak.
İlk hafta sonu trendler oluşmaya başlar.
[+ İlk Satışı Kaydet]
```

## 10. Faz 2'ye Saklanan

- ABC Analizi
- Kategori Performansı (detaylı)
- Stok Devir Hızı (detaylı)
- Tedarikçi Performansı
- SKT Yaklaşan (detaylı)

Faz 1 R: "Top 6 MVP (Açık Krediler 2026-05-14 eklendi) + gerçek kullanıcı talebine göre genişle"

## 11. Test Senaryoları

- RPT-001 Liste sayfası 6 kart yüklenir (Açık Krediler dahil — 2026-05-14)
- RPT-002 Üst KPI 3 metrik (net kâr, ciro, devir)
- RPT-003 Periyot filtre değişimi tüm kartları günceller
- RPT-004 Şube filtre: şube müdürü kendi şubesi gizli (zorla)
- RPT-005 Detay sayfa: Satış chart + donut + tablo
- RPT-006 Kâr/Zarar combo chart (line+bar yeşil+bar kırmızı)
- RPT-007 En çok satan top 20 horizontal bar
- RPT-008 En çok satan: stok yetersizliği uyarısı
- RPT-009 Ölü stok: aksiyon kolonu (indirim/iade/transfer/arşivle)
- RPT-010 Şube kıyas: bu ay vs geçen ay bar
- RPT-011 PDF export tek rapor
- RPT-012 Toplu PDF async → e-posta linki
- RPT-013 Excel export sheet'ler
- RPT-014 Empty state: veri yetersiz mascot
- RPT-015 Açık Krediler kartı: 12 açık kredi · ₺3.420 toplam · En eski 47g (2026-05-14 S2 + OT2-3)
- RPT-016 Krediyi kapama → `credit_paid_at = NOW()` set + audit log `sale.credit_settled` + Telegram bildirim (opsiyonel)
- RPT-017 Açık Krediler yaş analizi: 0-15/16-30/31-60/60+ gün band'ları doğru hesaplar
- RPT-018 60+ gün kredi kırmızı uyarı + öncelik vurgusu

## 12. Faz 1 Uyumu

✅ §21 yapı + §22 6 rapor detay
✅ Hibrit yapı (kart grid + drilldown)
✅ Faz 2'ye saklanan listesi

## 13. Sıradaki

⏭ EKRAN-AYARLAR.md
