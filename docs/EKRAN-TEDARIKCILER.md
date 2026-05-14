# Ekran: Tedarikçiler

**URL:** Liste `/admin/suppliers`, Yeni `/admin/suppliers/new`, Düzenle `/admin/suppliers/[id]/edit`
**Sidebar yeri:** Kaynaklar grubu, 2. sıra · 🏢 Tedarikçiler
**Erişim:** ADMIN (bayi sahibi tam yetki, şube müdürü kendi şubesinin tedarikçi listesini görür)
**Referans:** Faz 1 `FAZ1-TASARIM-KARARLARI.md` §23 · Tasarım `TASARIM-SISTEMI.md`

> Stok girişlerinde tedarikçi **zorunlu** (Faz 1 R1). Pet shop için 5-30 tedarikçi tipik. Soft delete (ledger referansı).

---

## 1. Layout

```
┌─────────┬──────────────────────────────────────────────────┐
│ Sidebar │ Topbar                                             │
│         ├──────────────────────────────────────────────────┤
│         │ KPI: 🏢 8 toplam · ✓ 7 aktif · ⏸ 1 pasif         │
│         │           [Arama] [Durum ▼]    [+ Yeni Tedarikçi] │
│         │                                                    │
│         │ Tablo:                                             │
│         │ Ad │ Yetkili │ Telefon │ Son alım │ Toplam │ ⚙   │
│         │                                                    │
└─────────┴──────────────────────────────────────────────────┘
```

## 2. Üst Bar

```
🏢 8 toplam   ·   ✓ 7 aktif   ·   ⏸ 1 pasif
                          [+ Yeni Tedarikçi]

[🔍 Arama: ad, vergi no, yetkili]   [Durum ▼ Aktif/Pasif/Tümü]
```

## 3. Tablo

| Kolon | Genişlik | İçerik |
|---|---|---|
| Ad | flex | Ad + vergi no küçük gri |
| Yetkili | 140px | Kişi adı + telefon küçük |
| Telefon | 120px | Format `0212 xxx xx xx` |
| Son alım | 110px | "5g önce" relative date |
| Toplam alım | 130px | Lifetime cumulative ₺ |
| Durum | 80px | Pill (Aktif/Pasif) |
| chevron | 32px | Detay drawer |

Hover satır → 👁 Detay · ✏ Düzenle · 📥 Stok Girişi (pre-filled bu tedarikçi)

## 4. Detay Drawer

```
┌── Ahmet Petshop A.Ş. ──────────────────────[×]┐
│ Vergi no: 1234567890 · Pasifleştir            │
├─────────────────────────────────────────────────┤
│ İletişim                                        │
│   Yetkili: Ahmet Bey                            │
│   Telefon: 0212 xxx xx xx                       │
│   E-posta: info@ahmetpet.com                    │
│   Adres: Kadıköy/İstanbul                       │
│                                                  │
│ Operasyon                                        │
│   Tedarik süresi: 7 gün                         │
│   Ödeme: Vadeli 30 gün                          │
│   IBAN: TR12 3456 7890 1234 5678 9012 34        │
│                                                  │
│ İstatistik                                       │
│   Toplam alım: ₺48.250 (180 işlem)              │
│   Son 30g: ₺3.450 (12 işlem)                    │
│   Son 90g: ₺18.200 (45 işlem)                   │
│   Ortalama sepet: ₺268                          │
│                                                  │
│ Son 10 alım (tablo)                             │
│   07 May 14:32 · 24 adet Royal Canin · ₺4.320  │
│   05 May 11:00 · 50 adet Whiskas · ₺400         │
│   ...                                            │
│                                                  │
│ Aksiyonlar                                       │
│   [📥 Stok Girişi (pre-filled)]                 │
│   [✏ Düzenle]                                   │
│   [⏸ Pasifleştir]                               │
└──────────────────────────────────────────────────┘
```

## 5. Yeni / Düzenle Form

```
TEMEL
  Firma adı *      [_________________________]
  Vergi no         [_____________] 10 hane VKN veya 11 hane TC kimlik (şahıs şirketi tedarikçisi)
  Vergi dairesi    [İstanbul Vergi D. ▼]
  Yetkili adı     [_________________________]
  Telefon         [0xxx xxx xx xx] TR format mask
  E-posta         [_________________________]

ADRES
  İl/İlçe         [İstanbul ▼] [Kadıköy ▼]
  Açık adres      [textarea]

OPERASYON
  Tedarik süresi  [7] gün     (varsayılan)
  Ödeme koşulları [Vadeli 30g ▼]
                   ◉ Peşin
                   ○ Vadeli 30 gün
                   ○ Vadeli 60 gün
                   ○ Diğer (custom)
  IBAN            [TR__ ____ ____]  (opsiyonel — havale için)

DURUM
  ☑ Aktif
  Not             [serbest metin]
```

**Validation:**
- Firma adı zorunlu
- Vergi no: 10 hane VKN veya 11 hane TC kimlik no + checksum (`lib/validation/vatNo.ts` helper — MANTIK-HATALARI O3 tek validation kaynağı) — opsiyonel
- Telefon: opsiyonel ama dolu ise TR format
- E-posta: opsiyonel ama dolu ise valid email
- IBAN: opsiyonel ama dolu ise TR IBAN format

## 6. Soft Delete

Hard delete YOK (ledger referansı `stock_movements.supplier_id`).

```
[⏸ Pasifleştir]
   ┌── Tedarikçiyi pasifleştir? ────────────┐
   │ Ahmet Petshop A.Ş.                       │
   │                                          │
   │ Pasif tedarikçiler:                      │
   │ • Stok Girişi autocomplete'de gözükmez │
   │ • Geçmiş alımlar korunur                │
   │ • Raporlarda "Pasif" etiketi ile görünür│
   │                                          │
   │ İstediğinde geri aktif yapabilirsin.     │
   │                                          │
   │   [İptal]  [Pasifleştir]                │
   └──────────────────────────────────────────┘
```

## 7. Empty State

```
[köpek+kasa mascot]
İlk tedarikçini kaydet
Stok girişlerinde tedarikçi zorunlu. Ürün aldığın firmaları ekle.
[+ İlk Tedarikçi]
```

## 8. API

| Endpoint | Method |
|---|---|
| `/api/admin/suppliers` | GET/POST |
| `/api/admin/suppliers/[id]` | GET/PATCH |
| `/api/admin/suppliers/[id]/deactivate` | POST |
| `/api/admin/suppliers/[id]/reactivate` | POST |
| `/api/admin/suppliers/check-vat` | GET (vergi no validation) |

## 9. Test Senaryoları

- SUP-001 KPI 3 metrik
- SUP-002 Arama (ad/vergi no/yetkili)
- SUP-003 Yeni: tüm zorunlu alanlar
- SUP-004 Vergi no validation: 10 hane VKN VEYA 11 hane TC kimlik no kabul; 9/12 hane reddedilir
- SUP-005 Telefon TR format
- SUP-006 IBAN TR format
- SUP-007 Detay drawer: son 10 alım
- SUP-008 İstatistikler (lifetime, 30g, 90g)
- SUP-009 Stok Girişi drawer pre-filled (bu tedarikçi)
- SUP-010 Soft delete: Stok Girişi autocomplete'de görünmez
- SUP-011 Pasif tedarikçi geri aç
- SUP-012 Hard delete YOK (API 405)
- SUP-013 Şube müdürü: kendi şubesinin tedarikçilerini görür
- SUP-014 Empty state: 0 tedarikçi mascot kart

## 10. Faz 1 Uyumu

✅ §23 yapı korundu (Felsefe, Liste, Yeni/Düzenle, Detay Drawer, Soft Delete)

## 11. Sıradaki

⏭ EKRAN-KULLANICILAR.md
