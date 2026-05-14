# Ekran: Public Vitrin (Merkezi Pet Shop Dizini)

**Tarih:** 2026-05-13 (yeniden yazıldı — tenant subdomain modeli iptal, merkezi tek vitrin)

**URL Yapısı:**
- **Merkezi tek vitrin:** `petstockpro.com/vitrin` — tüm pet shop'ların ürünleri tek havuzda
- **Tenant subdomain YOK** (önceki `{slug}.petstockpro.com` modeli iptal — 2026-05-13 kararı)
- **Custom domain YOK** (önceki PRO+ özelliği rafa kaldırıldı)
- **i18n:** `/tr/vitrin` prefix-tabanlı — **TR-only şu an aktif** (2026-05-14 kararı). EN locale (`/en/discover`) gizli, next-intl yapısı korunur, Faz 2'de açılabilir.

**Sidebar yeri:** Pet shop admin panelinde değil. Tenant kendi vitrin profilini yönetir → **Ayarlar > Vitrin** alt-bölümü.
**Erişim:** Public (auth gerektirmez) · Yönetim ADMIN bayi sahibi
**Tasarım sistemi:** `TASARIM-SISTEMI.md`
**Marka:** `MARKA-VARLIKLARI.md`

> **Felsefe (2026-05-13 kararı):** PetStockPro müşteri-yüzlü tek bir **dizin** sunar. Müşteri Google'da "Royal Canin Kedi Mama Üsküdar" arar → bizim merkezi vitrin SEO ile çıkar → pet shop'u görür → 📞 "Satıcıya Sor" butonu → WhatsApp deep link açılır → müşteri kendisi pet shop'a yazar. **Marketplace YOK** (biz para işlemiyoruz, sepet yok), **tenant subdomain YOK** (her pet shop'un kendi sitesi yok), sadece tek merkezi dizin.

---

## 1. Plan Etkisi (3-tier B — 2026-05-14)

| Plan | Stok limiti | Aylık fiyat | Vitrin'e dahil olma |
|---|---|---|---|
| **FREE** | 50 ürün | 0 ₺ | ✅ Otomatik (KVKK onayı + süperadmin onayı sonrası) |
| **PRO** | 500 ürün | 750 ₺ (KDV dahil) | ✅ Aynı |
| **PRO+** | Sınırsız | 1.750 ₺ (KDV dahil) | ✅ Aynı |

**Tüm planlar vitrin'e açık.** Plan kısıtlaması YOK — sadece stok limiti farklı.

**Custom domain ve tenant subdomain özellikleri YOK** (custom features kapsam dışı, 3-tier B sade kararı 2026-05-14).

**⚠ Branch lat/lng zorunluluk:** Vitrin başvurusu için tenant'ın en az bir şubesinin lat/lng'si dolu olmalı. Konumsuz pet shop'lar "en yakın" sıralamasında her aramada en sona düşer (kötü deneyim). Bu yüzden vitrin başvuru validation'ı bu koşulu bekler — bkz. `EKRAN-SUBELER.md §9 Yöntem 3` notu.

---

## 2. Müşteri Akışı (Sahibinden / Yelp Modeli)

```
1. Müşteri Google'da arar:
   "Royal Canin Kedi Mama Üsküdar"
       │
       ▼
2. PetStockPro merkezi vitrin SEO ile çıkar:
   petstockpro.com/vitrin/istanbul/uskudar/mama
       │
       ▼
3. Müşteri sayfayı açar — 5 pet shop görür:
   • Mavi Pet Shop · 1.2 km · ✓ Stokta · ₺250
   • Pati Shop    · 3.5 km · ⚠ Az    · ₺245
   • Mama Dünyası · 8.1 km · ⛔ Yok   · ₺260
   ...
       │
       ▼
4. Müşteri pet shop seçer (en yakını veya en ucuzu):
       │
       ▼
5. Ürün detay sayfası açılır:
   petstockpro.com/vitrin/urun/royal-canin-adult-kedi-2kg
   - Ürün galerisi
   - Pet shop bilgisi (adres, çalışma saatleri, harita)
   - Diğer pet shop'larla kıyaslama (3-5 kart)
   - 📞 BÜYÜK "WhatsApp ile Sipariş Ver" butonu
       │
       ▼
6. Müşteri WhatsApp butonuna basar:
   wa.me/905321234567?text=Merhaba%2C%20...
       │
       ▼
7. WhatsApp uygulaması açılır, hazır mesaj input'ta:
   "Merhaba, PetStockPro'da gördüm. Royal Canin Kedi 2kg stokta mı?"
       │
       ▼
8. Müşteri "Gönder" butonuna basar (kendisi)
   ↳ Biz mesajı görmüyoruz
   ↳ WhatsApp Business API kullanmıyoruz
   ↳ Sadece deep link açıyoruz
       │
       ▼
9. Pet shop yanıtlar, satışı kapatır
   (kapıda nakit, kart, havale, kargo)
       │
       ▼
10. Pet shop satışı kendi PetStockPro admin'ine kaydeder
    (Stok Çıkışı drawer)
```

**PetStockPro hiç müdahil olmuyor**, sadece **bağlantı kurucu** (Sahibinden modeli).

---

## 3. URL Yapısı (Merkezi)

```
petstockpro.com/                              ← SaaS landing
petstockpro.com/[locale]/vitrin               ← Merkezi vitrin ana sayfa
  /vitrin                                      ← /tr/vitrin → ana sayfa
  /vitrin/[il]                                 ← /vitrin/istanbul (şehir)
  /vitrin/[il]/[ilce]                          ← /vitrin/istanbul/uskudar (ilçe)
  /vitrin/kategori/[kategori]                  ← /vitrin/kategori/mama
  /vitrin/[il]/[ilce]/[kategori]               ← /vitrin/istanbul/uskudar/mama (kombinasyon)
  /vitrin/urun/[slug-id]                       ← /vitrin/urun/royal-canin-adult-kedi-2kg
  /vitrin/magaza/[slug]                        ← Pet shop profili (cross-tenant)
  /vitrin/arama?q=...                          ← Arama sonuçları
```

**Slug:** Pet shop kayıt sırasında girilen şirket adından otomatik slugify (`mavi-pet-shop`). Çakışma çözümü: `mavi-pet-shop-2`, `mavi-pet-shop-uskudar`. Tenant değiştirebilir (Settings > Vitrin > Slug).

**i18n:** **TR-only şu an aktif** — sadece `/tr/vitrin` route'ları açık (2026-05-14 kararı). EN locale (`/en/discover`) next-intl yapısında hazır ama gizli, Faz 2'de açılabilir (vitrin İngilizce karşılığı "discover" daha SEO-friendly olacak).

---

## 4. Sayfa: Vitrin Ana Sayfa (`/vitrin`)

```
┌─────────────────────────────────────────────────────────────┐
│ Header (lacivert, sticky)                                    │
│ [logo PetStockPro] [Ara: ürün/marka/pet shop] [İl ▼]      │
│                                  [🌓] [Pet shop sahibi misin?↗]│
├─────────────────────────────────────────────────────────────┤
│ ┌─ Info bar (3 mesaj rotation) ─────────────────────────┐ │
│ │ "Türkiye'nin pet shop dizini · 1.247 ürün · 47 şehir"  │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Hero (büyük) ────────────────────────────────────────┐ │
│ │ "Sevdiğin hayvanın ürününü en yakın pet shop'tan al"  │ │
│ │                                                          │ │
│ │ [📍 Konumumu paylaş]   veya   [İl seç ▼]              │ │
│ │                                                          │ │
│ │ (Background: mesh gradient + paw pattern + kedi+köpek) │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Kategori grid (6 büyük kart) ───────────────────────┐ │
│ │ Mama 🥩 · Aksesuar 🦴 · Bakım 🛁                       │ │
│ │ Oyuncak 🎾 · Sağlık 💊 · Kafes/Akvaryum 🏠          │ │
│ │ Her kart: emoji + ad + ürün sayısı                      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Yakındaki pet shop'lar (konum varsa) ───────────────┐ │
│ │ Harita (Leaflet, 320px) + 4 öne çıkan pet shop kartı │ │
│ │ Her kart: logo + isim + uzaklık + ürün sayısı + ✓     │ │
│ │ Tıklama: pet shop profili                               │ │
│ │                                                          │ │
│ │ [Konum yok]: "İl seçin" prompt + 6 ana şehir grid     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Popüler ürünler (8 kart) ───────────────────────────┐ │
│ │ Cross-tenant en çok tıklanan ürünler (vitrin_events)   │ │
│ │ Her kart: ürün resmi + ad + fiyat + pet shop + 📍 km  │ │
│ │ Tıklama: ürün detay (cross-tenant kıyaslama)            │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Şehir grid (Türkiye 6 ana şehir) ──────────────────┐ │
│ │ İstanbul · Ankara · İzmir · Bursa · Antalya · Adana   │ │
│ │ Her tile: foto + şehir adı + pet shop sayısı          │ │
│ │ + "Tüm şehirler" link                                   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ İletişim CTA ────────────────────────────────────────┐ │
│ │ "Pet shop sahibi misin? PetStockPro'ya kayıt ol"      │ │
│ │ [Ücretsiz başla — 50 ürüne kadar FREE]                │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Footer ───────────────────────────────────────────────┐ │
│ │ Hakkımızda · KVKK · ETBİS · Pet shop kaydet           │ │
│ │ © 2026 PetStockPro                                      │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Header Yapısı

- **Sade** — Sepet/login dropdown YOK (mockup-anasayfa'dan farklı)
- Logo → `/`
- Arama input full-text (ürün/marka/pet shop)
- İl dropdown — IP-based pre-fill (MaxMind), kullanıcı değiştirebilir
- ~~Locale switcher (TR/EN)~~ — **TR-only (2026-05-14 MANTIK-HATALARI O2):** UI'da gizli. next-intl yapısı korunur, Faz 2'de EN açılırsa dropdown görünür.
- Dark/light toggle
- "Pet shop sahibi misin?" CTA → `/register` (SaaS taraf)

### 4.2 Hero Banner

- **Background:** Mockup-v3 mesh gradient + paw pattern + kedi/köpek mascot
- **Slogan:** "Sevdiğin hayvanın ürününü en yakın pet shop'tan al" (jenerik, marka yok)
- **CTA:** Konum izni veya il seçim
- "Pet shop'lar değil, **müşteri** odaklı" — copy değişti (tenant subdomain'de pet shop'un kendi sloganı vardı, burada yok)

### 4.3 Kategori Grid

- 6 ana kategori — emoji + ad + ürün sayısı (cross-tenant toplam)
- Tıklama: `/vitrin/kategori/mama`
- Mobile: 2 sütun, desktop: 3 sütun

### 4.4 Yakındaki Pet Shop'lar (Konum Tespit Akışı)

3 katmanlı:

1. **URL'den** (en kesin) — `/vitrin/istanbul/uskudar` müşteri zaten ilçe yazdı
2. **Browser Geolocation API** — kullanıcı izniyle kesin koordinat
   ```ts
   navigator.geolocation.getCurrentPosition(
     (pos) => fetchNearbyShops(pos.coords),
     () => fetchByIpFallback()
   );
   ```
3. **IP-based fallback** — MaxMind GeoLite2 (ücretsiz, şehir seviyesi ~%70 doğru)
4. **Reddedilirse:** İlçe centroid varsayılan (PostGIS hesaplı)

PostGIS sorgusu (en yakın pet shop):
```sql
SELECT b.*,
  ST_Distance(
    ST_MakePoint(b.longitude, b.latitude)::geography,
    ST_MakePoint($user_lng, $user_lat)::geography
  ) / 1000 AS distance_km
FROM branches b
JOIN companies c ON c.id = b.company_id
WHERE c.storefront_status = 'approved'
  AND ST_DWithin(
    ST_MakePoint(b.longitude, b.latitude)::geography,
    ST_MakePoint($user_lng, $user_lat)::geography,
    50000  -- 50 km yarıçap
  )
ORDER BY distance_km ASC
LIMIT 4;
```

### 4.5 Popüler Ürünler

Cross-tenant **vitrin_events** tablosundan (DATABASE-SCHEMA §3.8):
```sql
SELECT p.id, p.name, COUNT(*) AS view_count
FROM vitrin_events ve
JOIN products p ON p.id = ve.product_id
WHERE ve.event_type = 'product_view'
  AND ve.created_at > NOW() - INTERVAL '7 days'
GROUP BY p.id
ORDER BY view_count DESC
LIMIT 8;
```

### 4.6 Şehir Grid

6 ana şehir tile + "Tüm şehirler" link → `/vitrin/sehirler` (81 il listesi).

---

## 5. Sayfa: Şehir/İlçe Filtreli (`/vitrin/[il]/[ilce]?`)

```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                       │
├─────────────────────────────────────────────────────────────┤
│ Breadcrumb: Vitrin > İstanbul > Üsküdar                     │
│                                                              │
│ ┌─ Başlık + filtre ─────────────────────────────────────┐ │
│ │ Üsküdar'daki Pet Shop'lar (12 mağaza · 487 ürün)       │ │
│ │ [Kategori ▼] [Marka ▼] [Hayvan ▼] [Stokta]           │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Harita (320px, sticky) + Pet Shop Listesi (sağ kolon)┐ │
│ │  [Leaflet harita    ]  ┌─ Mavi Pet Shop ──────────┐  │ │
│ │  [12 pin görünür   ]   │ logo · 1.2 km · ⭐ 4.8   │  │ │
│ │  [pin tıklama →    ]   │ Mama · Aksesuar · Sağlık │  │ │
│ │  [popup pet shop  ]    │ 47 ürün · ✓ Stokta var  │  │ │
│ │                         │ [Profili Gör →]           │  │ │
│ │                         └────────────────────────────┘  │ │
│ │                         ┌─ Pati Shop ──────────────┐   │ │
│ │                         │ ...                        │   │ │
│ │                         └────────────────────────────┘   │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Sayfa: Ürün Kategori (`/vitrin/kategori/[slug]`)

Cross-tenant tüm pet shop'ların ilgili kategorideki ürünleri:

```
Vitrin > Mama
487 ürün · 47 pet shop'tan

[Filtre: İl/İlçe · Hayvan · Marka · Fiyat · Stokta]
[Sıralama: ◉ Mesafe  ○ Fiyat ↑  ○ Fiyat ↓  ○ Yeni  ○ İlgi]

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ [img]  │ │ [img]  │ │ [img]  │ │ [img]  │
│        │ │        │ │        │ │        │
│ R.Canin│ │Whiskas │ │Pro Plan│ │ Felix  │
│ 2kg    │ │ 400g   │ │ 15kg   │ │ Pouch  │
│ ₺250   │ │ ₺12    │ │ ₺850   │ │ ₺ 6    │
│ Mavi P.│ │Pati S. │ │Mama D. │ │Kedi K. │
│ 1.2 km │ │ 3.5 km │ │ 8.1 km │ │ 2.3 km │
│ ✓ Stok │ │ ⚠ Az  │ │ ⛔ Yok │ │ ✓ Stok │
└────────┘ └────────┘ └────────┘ └────────┘
```

**Ürün kart yapısı:** ürün + fiyat + pet shop adı + 📍 mesafe + stok durumu (ek satır olarak).

---

## 7. Sayfa: Ürün Detay (`/vitrin/urun/[slug-id]`)

Cross-tenant ürün detayı + kıyaslama:

```
┌─────────────────────────────────────────────────────────────┐
│ Breadcrumb: Vitrin > Mama > Royal Canin Adult Kedi 2kg     │
│                                                              │
│ ┌─ Galeri (sol) ────────┬─ Ürün Bilgi (sağ) ──────────────┐│
│ │                        │                                   ││
│ │  [Ana görsel 480×480]  │  Royal Canin Adult Kedi          ││
│ │                        │  Maması 2kg                       ││
│ │  [thumb][t][t][t]      │                                   ││
│ │                        │  Marka: Royal Canin               ││
│ │                        │  Kategori: Mama                   ││
│ │                        │  Hayvan: 🐱 Kedi                  ││
│ │                        │                                   ││
│ │                        │  3 pet shop'ta mevcut             ││
│ │                        │  Fiyat aralığı: ₺245 - ₺260      ││
│ │                        │                                   ││
│ │                        │  [Kıyasla ↓]                      ││
│ └────────────────────────┴───────────────────────────────────┘│
│                                                             │
│ ┌─ Cross-Tenant Kıyaslama (sıralı: en iyi seçim önde) ───┐│
│ │ Pet Shop          │ Mesafe │ Stok    │ Fiyat │ İletişim││
│ │ Mavi Pet (Üsküdar)│ 1.2 km │ ✓ Var   │ ₺250  │ [📞 WhatsApp]││
│ │ Pati Shop (Kdk)   │ 3.5 km │ ⚠ Az(2) │ ₺245  │ [📞 WhatsApp]││
│ │ Mama Dünyası      │ 8.1 km │ ⛔ Yok   │ ₺260  │ —              ││
│ │                                                                 ││
│ │ Sıralama: Mesafe %40 + Stok %25 + Güncellik %15 + ...         ││
│ │ [Neden bu sırada? ▼]                                            ││
│ └────────────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Ürün Açıklaması ────────────────────────────────────┐ │
│ │ [Markdown render — pet shop'tan alınan ortak metin]    │ │
│ │                                                          │ │
│ │ Teknik bilgiler:                                         │ │
│ │  Marka: Royal Canin                                      │ │
│ │  Kategori: Mama > Kedi Maması                            │ │
│ │  Hayvan türü: Kedi                                       │ │
│ │  Barkod: 8690000123456                                   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Bildiri butonu ───────────────────────────────────────┐ │
│ │ 🚩 Bu ürünü/pet shop'u bildir                            │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Aynı kategoriden öneriler (4 kart) ──────────────────┐ │
│ │ Kategori bazlı algoritma                                  │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 7.1 Sıralama Algoritması

```
1. Mesafe %40 — en yakın önde (PostGIS ST_Distance)
2. Stok ✓ %25 — varsa önde
3. Son güncelleme %15 — 1 saat içi > 1 gün > hafta
4. Profil tamlığı %10 — logo + kapak + açıklama tam
5. Üye yaşı %10 — kuruluş üyesi bonus
```

**Şeffaflık:** "Neden bu sırada?" linki açılır → algoritma açıklama modal.

### 7.2 WhatsApp Deep Link

Müşteri "📞 WhatsApp" butonuna basınca:

```
https://wa.me/{whatsapp_phone}?text={hazır_mesaj_url_encoded}
```

**Hazır mesaj örneği:**
```
Merhaba, PetStockPro'da gördüm.
Royal Canin Adult Kedi 2kg ürününü istiyorum.
Stokta mı?
```

- Pet shop'un WhatsApp uygulaması açılır
- Mesaj input'ta **dolu** gelir
- Müşteri gözden geçirir, "Gönder" butonuna basar (kendisi)
- **Biz mesajı görmüyoruz** — sadece deep link
- **WhatsApp Business API kullanmıyoruz** (ücretsiz, hesap onayı yok, KVKK yok)

Pet shop'un kendi `companies.vitrin_message_template` tanımlaysa onu kullanır, değilse default şablon.

**Tıklama → `vitrin_events` tablosuna `whatsapp_click` kayıt** (DATABASE-SCHEMA §3.8). Pet shop Vitrin Metrikleri ekranında bu sayıyı görür.

---

## 8. Sayfa: Pet Shop Profili (`/vitrin/magaza/[slug]`)

Müşteri pet shop'a tıklayınca açılan sayfa (cross-tenant — pet shop'un kendi sitesi DEĞİL, merkezi vitrin'deki profil):

```
┌─────────────────────────────────────────────────────────────┐
│ Breadcrumb: Vitrin > İstanbul > Üsküdar > Mavi Pet Shop    │
│                                                              │
│ ┌─ Kapak fotoğrafı (1600×400) + logo overlay ──────────┐ │
│ │  [kapak görseli]                                        │ │
│ │  [logo + Mavi Pet Shop · ⭐ 4.8 (47)]                  │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Bilgi bandı ─────────────────────────────────────────┐ │
│ │ 📍 Üsküdar/İstanbul · 🕐 Açık (09:00-21:00)            │ │
│ │ 📞 0212 xxx xxxx · 📞 WhatsApp                         │ │
│ │ Toplam 47 ürün · 1.2 km uzaklıkta                      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Şube seçici (multi-branch pet shop ise) ─────────────┐ │
│ │ Hangi şubeye bakıyorsun?                                 │ │
│ │ [🏠 Üsküdar (1.2 km, en yakın) ▼]                      │ │
│ │   • 🏠 Üsküdar — 1.2 km · 47 ürün                      │ │
│ │   • 🏪 Kadıköy — 3.5 km · 52 ürün                      │ │
│ │   • 🏪 Beşiktaş — 8.1 km · 41 ürün                     │ │
│ │                                                          │ │
│ │ Seçilen şubenin stok ve fiyatı gösterilir.              │ │
│ │ WhatsApp mesajına şube adı eklenir.                      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Harita (Leaflet, 240px) ───────────────────────────────┐│
│ │ Pin: pet shop konumu                                      ││
│ │ [Yol Tarifi Al] (Google Maps)                             ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Hakkımızda ────────────────────────────────────────────┐│
│ │ Pet shop'un kısa açıklaması (160 char + tam metin)        ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Bu Pet Shop'taki Ürünler (filtreli) ──────────────────┐│
│ │ [Kategori ▼][Hayvan ▼][Stokta]                           ││
│ │                                                            ││
│ │ Ürün grid (4 sütun) — sadece bu pet shop'un vitrin'e     ││
│ │ koyduğu ürünler (vitrin_published = true)                 ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Çalışma saatleri (7 gün tablo) ────────────────────────┐│
│ │ Pzt-Cmt 09:00-21:00 · Pzr Kapalı                          ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ İletişim ──────────────────────────────────────────────┐│
│ │ 📞 Telefon · 📞 WhatsApp · 📨 (eğer Telegram kanalı     ││
│ │ varsa — pet shop Settings'ten girer, opsiyonel)            ││
│ │                                                             ││
│ │ ⚠ NOT: Telegram = pet shop sahibinin bildirim kanalı,    ││
│ │ müşteri ile iletişimde kullanılmaz                        ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ 🚩 Bu pet shop'u bildir ─────────────────────────────┐│
└─────────────────────────────────────────────────────────────┘
```

**Önemli:**
- Pet shop'un **kendi sitesi DEĞİL** — bu PetStockPro'nun merkezi vitrindeki **profil sayfası**
- Tek tema, tek tasarım (PetStockPro markası altında)
- Custom CSS YOK, custom domain YOK (PRO+ rafa)

---

## 9. Stok Durumu (Vitrin'de Gösterim)

Pet shop Settings > Vitrin'den stok visibility seçer:

| Seçenek | Görünüm |
|---|---|
| **Var/yok level** (default — önerilen) | ✓ Stokta · ⚠ Az kaldı (≤5) · ⛔ Stok yok |
| **Tam sayı** | "Stokta: 12 adet" (rakibe bilgi açar) |
| **Hiç gösterme** | Sadece fiyat, "Bilgi için ara" |

**Stok 0 davranışı (2026-05-13 kararı):**
- Otomatik: ürünün toplam stoğu 0 olunca `vitrin_published = false`, vitrin'den çekilir
- Pet shop'a Telegram + ekran bildirim
- Manuel "Satışa Aç" toggle ile geri açılır (otomatik geri açma YOK)
- Detay: `EKRAN-URUNLER §5.6`, `DATABASE-SCHEMA §5.5`

---

## 10. SEO

### 10.1 Sayfa Bazlı Meta

Her vitrin sayfası için:
```ts
export const metadata: Metadata = {
  title: 'Royal Canin Adult Kedi Maması 2kg · 3 pet shop · PetStockPro',
  description: '3 pet shop'tan ₺245-260 fiyat aralığında. En yakın: Mavi Pet Shop (Üsküdar, 1.2 km).',
  openGraph: {
    title, description,
    images: [{ url: productImage, width: 1200, height: 630 }],
    siteName: 'PetStockPro',
    type: 'product',
  },
  alternates: {
    canonical: `https://petstockpro.com/tr/vitrin/urun/${slug}`,
    languages: {
      'tr': `/tr/vitrin/urun/${slug}`,
      // 'en': `/en/discover/product/${slug}`, // Faz 2 — TR-only şu an (2026-05-14)
    }
  }
};
```

**Not (2026-05-14 TR-only):** EN locale alternate satırı yorum içinde tutulur — Faz 2'de açılır.

### 10.2 Sitemap — Pre-build Pattern (2026-05-14 — DEVAM-REHBERI mantık hatası #8)

> **Sorun (eski tasarım):** Sitemap'i her request'te dynamic üretmek = 81 il × ~970 ilçe × 6 kategori = ~470K potansiyel URL. **Cloudflare Workers 5 dakika timeout** + 100MB response limit. Dynamic üretim TIMEOUT riski yüksek + hot path'i yavaşlatır (Google crawler'ı bekletir).

**Çözüm:** Pre-build pattern — gece bir kez üret, statik serve et.

#### 10.2.1 Mimari

```
┌──────────────────────────────────────────────────────────────┐
│  pg_cron @ 03:00 Europe/Istanbul (gece)                       │
│       │                                                        │
│       ▼                                                        │
│  Supabase Edge Function: generate-sitemap                     │
│   1. Aktif tenant + ürün + şehir/ilçe sorgula (sadece içerik) │
│   2. URL listesini chunk'la (her chunk 50K URL, ~5MB)          │
│   3. sitemap-index.xml + sitemap-{tenants,products,locations}-N.xml │
│   4. Cloudflare R2 bucket'a yaz (sitemap/)                    │
│       │                                                        │
│       ▼                                                        │
│  Cloudflare Workers route /sitemap*.xml:                      │
│   → R2'dan static fetch + 1 saat edge cache                   │
│   → Workers işi yok, hot path 50ms altı                       │
└──────────────────────────────────────────────────────────────┘
```

#### 10.2.2 URL Yapısı (sitemap-index.xml)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://petstockpro.com/sitemap-tenants-1.xml</loc>
    <lastmod>2026-05-14T03:00:00+03:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://petstockpro.com/sitemap-products-1.xml</loc>
    <lastmod>2026-05-14T03:00:00+03:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://petstockpro.com/sitemap-locations-1.xml</loc>
    <lastmod>2026-05-14T03:00:00+03:00</lastmod>
  </sitemap>
</sitemapindex>
```

#### 10.2.3 İçerik Filtresi (URL bombardımanı önleme)

**Sadece şu kombinasyonlar sitemap'e eklenir:**

- Şehir sayfası → o şehirde **en az 1 aktif tenant** varsa
- İlçe sayfası → o ilçede **en az 1 aktif tenant** varsa
- Kategori × şehir → o şehirde **o kategoride en az 3 vitrin ürünü** varsa
- Pet shop profili → tenant aktif + `storefront_status='approved'` + son 90 gün içinde aktivite (2026-05-14 K1+OT2-6 düzeltmesi)
- Ürün detay → `vitrin_published=true` + stok > 0

Bu filtreyle 470K potansiyel URL → ~10-50K gerçek URL (lansman) → ~200K (Türkiye geneli olgunlaştığında). Tek `sitemap.xml` dosyası 50MB limitini aşmaz (her biri max 50K URL).

#### 10.2.4 Refresh + Invalidation

| Tetik | Davranış |
|---|---|
| Gece 03:00 cron | Full rebuild (Supabase Edge Function → R2) |
| Yeni vitrin ürünü | Sayfa eklenir ama sitemap **bir sonraki cron'da** güncellenir (acil değil) |
| Tenant askıya alındı | Aynı — bir sonraki cron'da düşürülür. Bu arada `robots.txt` ve `noindex` middleware'i yansıtır |
| Manuel rebuild | Süperadmin "Sitemap Şimdi Yenile" butonu (acil durum) — `EKRAN-SUPERADMIN.md` Toolbox |

#### 10.2.5 Workers Route

```ts
// app/sitemap-[name].xml/route.ts
export const runtime = 'edge';

export async function GET(req: Request, { params }: { params: { name: string } }) {
  const r2Key = `sitemap/${params.name}.xml`;
  const obj = await env.SITEMAP_BUCKET.get(r2Key);
  if (!obj) return new Response('Not Found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
```

#### 10.2.6 Maliyet

- **R2 storage:** ~50MB → ücretsiz tier dahil (10GB)
- **R2 egress:** Cloudflare Workers'tan R2'ya **ücretsiz** (aynı network)
- **Edge cache:** 1 saat → Google crawler'a hızlı, manuel invalidation imkanı var
- **Edge Function execution:** Gece 1× × 5dk = ihmal edilir maliyet (Supabase Free tier'ı bile yetiyor)

### 10.3 Schema.org Structured Data

Ürün sayfaları:
```json
{
  "@type": "Product",
  "name": "Royal Canin Adult Kedi Maması 2kg",
  "image": "...",
  "brand": { "@type": "Brand", "name": "Royal Canin" },
  "offers": [
    {
      "@type": "Offer",
      "price": "250.00",
      "priceCurrency": "TRY",
      "availability": "https://schema.org/InStock",
      "seller": { "@type": "PetStore", "name": "Mavi Pet Shop" }
    },
    { /* diğer pet shop'lar */ }
  ]
}
```

LocalBusiness markup pet shop profilleri için (`PetStore` schema.org).

### 10.4 robots.txt

```
User-agent: *
Allow: /vitrin
Disallow: /admin
Sitemap: https://petstockpro.com/sitemap.xml

# 2026-05-14: /super-admin path'i YOK (kaldırıldı). SUPERADMIN role'lü kullanıcı /admin altında role-based menüleri kullanır. /admin zaten disallow olduğu için ayrı bir kuralı yok.
```

---

## 11. Performans + Cache

| Sayfa | Strateji | Cache |
|---|---|---|
| Vitrin ana | RSC + ISR | 1 saat |
| Şehir/ilçe | RSC + ISR | 1 saat |
| Kategori | RSC + ISR | 30 dakika |
| Ürün detay | RSC + ISR | 5 dakika (stok değişince invalidate) |
| Pet shop profili | RSC + ISR | 1 saat |

**CDN (Cloudflare):**
- Tüm static assets edge cache
- HTML sayfaları edge cache (ISR uyumlu)
- API responses cache (5dk)
- Cloudflare Image Resizing (görsel optimizasyon)

**Hedef:** Anasayfa LCP < 2.5s, mobil 3G < 4s.

---

## 12. Tenant Vitrin Yönetimi (Admin Panelde)

Pet shop kendi vitrin profilini buradan yönetir → `/admin/settings → Vitrin`:

```
┌─ Vitrin Ayarları ─────────────────────────────────────┐
│                                                          │
│ ⚠ KVKK onay banner:                                     │
│   "Vitrin'de görünmek için adres+telefon paylaşımı     │
│    onayı gerekiyor" [Aydınlatma metnini oku]           │
│                                                          │
│ ☑ Vitrin'de görün (master switch)                      │
│   Süperadmin onay durumu: ⏳ Bekliyor / ✓ Onaylı       │
│                                                          │
│ Profil bilgileri:                                       │
│   Vitrin slug:    [mavi-pet-shop]                       │
│                   ↳ petstockpro.com/vitrin/magaza/...   │
│   Logo:           [Yükle] (200×200, PNG/SVG, max 500KB)│
│   Kapak fotoğrafı:[Yükle] (1600×400, max 1MB)         │
│   Kısa açıklama:  [textarea, 160 char counter]         │
│                                                          │
│ İletişim:                                                │
│   WhatsApp:       [+90 532 xxx xxxx] [Test mesajı gönder]│
│   Telefon:        [0212 xxx xxxx]                       │
│                                                          │
│ Hazır WhatsApp mesajı:                                   │
│   [textarea]                                              │
│   Default: "Merhaba, PetStockPro'da gördüm. {ürün}     │
│   stokta mı?"                                            │
│   Değişkenler: {ürün} {pet shop} {şehir}                │
│                                                          │
│ Çalışma saatleri (7 gün):                                │
│   Pzt: [09:00] - [21:00]   ☐ Kapalı                    │
│   ... [Tüm günler aynı] [Pazar kapalı] preset          │
│                                                          │
│ Stok visibility:                                          │
│   ◉ Var/yok level  ○ Tam sayı  ○ Gösterme              │
│                                                          │
│ [👁 Vitrin Profilimi Önizle]                            │
│   ↳ Yeni sekme: petstockpro.com/vitrin/magaza/{slug}    │
│                                                          │
│ ⚠ Tehlike Bölgesi                                       │
│   [⛔ Vitrin'den Çık]  (profil pasif, ürünler çekilir) │
└──────────────────────────────────────────────────────────┘
```

**Bilgi:** Ürün başına "Satışa Aç" toggle Ürünler ekranında — bkz. `EKRAN-URUNLER §5.5`.

---

## 13. Vitrin Metrikleri (Pet Shop Admin Tarafı)

Pet shop sahibi `Ayarlar > Vitrin > Metrikler` sekmesinde **vitrin_events** tablosundan agregasyonları görür.

> **2026-05-14 revize (DEVAM-REHBERI mantık hatası #3):** "47 görüntüleme" tek-başına anlamsız — profil mi ürün mü listede mi? **4 ayrı etiket** zorunlu. DATABASE-SCHEMA §3.8 `vitrinEventTypeEnum` 4 ana event_type ayırır.

### 13.1 KPI Bandı — 4 Ana Etiket

```
┌──────────────────────────────────────────────────────────────────────┐
│  👁 PROFİL GÖRÜNTÜLEME       312    ↑ %15                            │
│     /vitrin/magaza/[slug] ziyareti — müşteri pet shop'unu açtı      │
├──────────────────────────────────────────────────────────────────────┤
│  🛍 ÜRÜN GÖRÜNTÜLEME          87    ↑ %8                             │
│     Pet shop ürünü detayda açıldı                                    │
├──────────────────────────────────────────────────────────────────────┤
│  🔍 LİSTEDE GÖSTERİLME      1.240   ↑ %4                             │
│     Aramada/kategoride/yakınımda listelendi (görüntülenmedi)         │
│     Top-of-funnel — sadece exposure                                  │
├──────────────────────────────────────────────────────────────────────┤
│  📞 WHATSAPP TIKLAMA          23    ↑ %30   ★ EN KIYMETLİ           │
│     wa.me/... deep link tıklandı — gerçek ilgi sinyali              │
└──────────────────────────────────────────────────────────────────────┘
```

### 13.2 Conversion Oranları

```
🔍 Listede → 👁 Profil:        25.2%   (1.240 → 312)  ← cazibe
👁 Profil → 🛍 Ürün:           27.9%   (312 → 87)     ← profil ikna
🛍 Ürün → 📞 WhatsApp:         26.4%   (87 → 23)      ← niyet ★
📊 Toplam funnel (exposure→WA): 1.9%   (1.240 → 23)
```

> **Önemli:** "Conversion" ifadesi sadece **WhatsApp tıklamasına kadar** olan dönüşümü ölçer. Tıklama sonrası gerçek satış olup olmadığını PetStockPro **bilmez ve bilmek istemez** — para akışı çizgisi (§13.4) müşteri ↔ pet shop arasındadır.

### 13.3 Ek Metrik Detayları

```
En çok ilgi gören 5 ürünüm (son 30 gün):
  1. Royal Canin 2kg     · 34 ürün görüntüleme · 8 WhatsApp tıklama
  2. Whiskas Pouch       · 28 ürün görüntüleme · 6 WhatsApp tıklama
  3. Pro Plan 15kg       · 22 ürün görüntüleme · 4 WhatsApp tıklama
  ...

Hangi şehirden ziyaretçi (profil görüntüleme bazlı):
  İstanbul (62%) · Ankara (18%) · İzmir (8%) · Diğer (12%)

Telefon tıklama:        12   (📞 phone_click)
Yol tarifi tıklama:      9   (📍 directions_click — Google Maps deep link)

[CSV/Excel indir]
```

### 13.4-pre Etiket Tanım Tablosu (her ekranda referans)

| UI Etiketi | DB event_type | Tetikleyici | Conversion değeri |
|---|---|---|---|
| 👁 Profil görüntüleme | `profile_view` | `/vitrin/magaza/[slug]` sayfası açıldı | Orta — niyet öncesi |
| 🛍 Ürün görüntüleme | `product_view` | Ürün detay sayfası açıldı | Yüksek — niyet sinyali |
| 🔍 Listede gösterilme | `listing_impression` | Aramada/kategoride listelendi, görüntülenmedi | Düşük — exposure |
| 📞 WhatsApp tıklama | `whatsapp_click` | `wa.me/...` tıklandı | **Çok yüksek — gerçek niyet** |
| 📞 Telefon tıklama | `phone_click` | `tel:` link tıklandı | Yüksek |
| 📍 Yol tarifi | `directions_click` | Google Maps deep link tıklandı | Orta-yüksek (fiziksel ziyaret niyeti) |

DATABASE-SCHEMA §3.8'deki `mv_vitrin_daily_metrics` materialized view'dan okur. Her event her 5dk'da agregasyona girer (`pg_cron` refresh).

---

## 13.4 💰 Para Akışı + Yasal Pozisyon (2026-05-14 — KRİTİK ÇİZGİ)

> **Bu çizgi proje boyunca DEĞİŞMEZ:** PetStockPro **alıcı ve satıcı arasındaki para alışverişine ASLA dahil değildir.**

### 13.4.1 İki Para Akışı (karıştırılmasın)

| Akış | Yön | PetStockPro'ya Gelir mi? | Yasal Pozisyon |
|---|---|---|---|
| **B2C — Müşteri → Pet Shop** (ürün satışı) | Kapıda nakit / kart / havale / kargo | ❌ **HİÇ DAHİL DEĞİL** | Biz aracı/yer sağlayıcı/dizin değiliz, ödeme platformu değiliz |
| **B2B — Pet Shop → PetStockPro** (PRO aboneliği) | iyzico Subscription (TR) | ✅ Bizim gelirimiz | Standart SaaS abonelik — KVKK/ETBİS kapsamında (TR-only 2026-05-14, Paddle/yurt dışı Faz 2'ye saklandı) |

### 13.4.2 B2C Para Akışında Bizim Rolümüz: SIFIR

- ❌ **Online sipariş YOK** — vitrin sepet/checkout sunmaz
- ❌ **Ödeme aracılığı YOK** — biz para almıyoruz, transfer etmiyoruz, havale almıyoruz
- ❌ **Komisyon YOK** — pet shop'tan satış yüzdesi almıyoruz
- ❌ **Faturalama YOK** — müşteriye fatura kesmiyoruz, pet shop kendi keser
- ❌ **Kargo YOK** — kargo şirketleriyle anlaşmamız yok
- ❌ **İade/iptal YOK** — biz tarafiyetimiz yok, pet shop ↔ müşteri kendi aralarında çözer

**Bizim rolümüz sadece şu:**
- ✅ Pet shop'un ürün bilgisini dizinde gösteriyoruz
- ✅ Müşteri "📞 Satıcıya Sor" butonuna basınca **WhatsApp deep link** açıyoruz (`wa.me/{numara}`)
- ✅ Hazır mesaj URL parametresinde dolu gelir, müşteri **kendi parmaklarıyla "Gönder"** tuşuna basar
- ✅ Mesajı biz görmüyoruz, biz aracı değiliz
- ✅ Bundan sonrası pet shop ↔ müşteri arasında — bizim haberimiz yok

### 13.4.3 Neden Bu Çizgi Sıkı? (Yasal Sebepler)

Eğer para akışına bir nebze dahil olursak:

| Sorumluluk | Tetikleyici | Yük |
|---|---|---|
| **Ödeme kuruluşu lisansı** (BDDK) | Para tutmak veya transfer etmek | Yıllık milyonlarca ₺ + denetim |
| **Sub-merchant kayıt** (iyzico) | Pet shop adına ödeme almak | Her tenant için onay 1-3 gün, KKDF, vergi karmaşası |
| **Mesafeli satış sözleşmesi** | Aracı pozisyonunda olmak | 14 gün cayma, iade sorumluluğu, müşteri şikayetleri |
| **KKDF / KDV mükellefi** | Para havuzu tutmak | Vergi mükellefiyeti, muhasebe, beyanname |
| **ETBİS aracı kayıt** | Pazaryeri pozisyonu | Bakanlık denetim |

**Dizin (yer sağlayıcı) pozisyonunda kalarak hepsinden kaçınıyoruz** — sadece 5651 sayılı kanun yer sağlayıcı bildirim yeterli.

### 13.4.4 Vitrin Metriklerinde "Sipariş" Kelimesi YOK

Vitrin metrikleri sadece **tıklama** sayar:
- 👁 Görüntüleme
- 🖱 Ürün tıklama
- 📞 WhatsApp tıklama (en kıymetli — gerçek "ilgi" göstergesi)

**"Sipariş" / "satış" sözcüğü vitrin tarafında YOK** — çünkü sipariş bizim sistemden geçmiyor. Pet shop sahibi gerçek satışı kendi defterinden takip eder (Stok Çıkışı drawer'ından kaydeder, bu admin tarafı).

### 13.4.5 Bu Çizgiyi İhlal Edebilecek Özellik Önerileri (RED)

Aşağıdaki özellikler PetStockPro kapsamında **ASLA olmayacak**:
- ❌ Sepet/checkout (vitrin ana sayfasına ekleme)
- ❌ Online ödeme entegrasyonu (müşteri kart bilgisi)
- ❌ "Sipariş yönetimi" panel (bizim sistemden geçen sipariş)
- ❌ Komisyonlu satış modeli (pet shop'tan % almak)
- ❌ Kargo entegrasyonu (Yurtiçi/Aras API)
- ❌ Müşteri loyalty/puan sistemi (müşteri verisi tutmak)
- ❌ Sub-merchant pet shop iyzico hesabı yönetmek

**Eğer ileride "online satış istiyoruz" baskısı gelirse:** Yeni bir ürün (PetStockPro Storefront vs) ayrı proje olarak değerlendirilir, **bu projede asla.**

---

## 13.5 KVKK + Cookie Banner + ETBİS (Müşteri Tarafı, 2026-05-13)

Vitrin'i ziyaret eden anonim müşteri için yasal yükümlülükler:

### 13.5.1 Cookie Banner (ilk ziyarette)

Sayfa altında sticky banner:

```
┌────────────────────────────────────────────────────────────────────┐
│ 🍪 Bu site deneyiminizi iyileştirmek için çerez kullanır.          │
│ Detay: [Aydınlatma metni] · [Çerez politikası]                     │
│                                                                      │
│              [Sadece zorunlu] [Tümünü kabul et]                    │
└──────────────────────────────────────────────────────────────────────┘
```

**Çerez kategorileri:**
- **Zorunlu** (her zaman aktif): session, dil tercihi, tema (varsayılan kabul)
- **Analytics** (opsiyonel): vitrin_events tracking, IP hash topla
- **Pazarlama** (opsiyonel): future use (UTM, retargeting — Faz 2)

**Davranış:**
- Kullanıcı seçim yapana kadar `vitrin_events` tablosuna **anonim event** yazılır (sadece IP olmayan agg sayım)
- "Tümünü kabul" sonrası IP hash + UA + referrer toplanır
- "Sadece zorunlu" sonrası sadece session devam eder, tracking yok

### 13.5.2 KVKK Aydınlatma Metni (`/[locale]/aydinlatma`)

Yasal şablon. Şu konuları içerir:
- Veri sorumlusu: PetStockPro (şirket adı, vergi no, adres)
- Toplanan veri: IP hash, UA, referrer, sayfa görüntüleme, WhatsApp tıklama event
- İşleme amacı: vitrin sıralama optimizasyonu, pet shop'lara metrik sunumu
- Saklama süresi: 12 ay sonra anonim agg
- Veri sahibi hakları: erişim/silme/düzeltme talebi `privacy@petstockpro.com`

### 13.5.3 ETBİS Bildirimi (Yer/İçerik Sağlayıcı)

5651 sayılı kanun gereği:

- PetStockPro **dizin** (yer sağlayıcı + içerik sağlayıcı pozisyonu)
- ETBİS bildirim yapılır (e-Ticaret Bilgi Sistemi)
- **Şikayet/içerik kaldırma kanalı:** `privacy@petstockpro.com` + vitrin'deki "🚩 Bildir" butonu
- Müşteri/3. taraf şikayetinde 24 saat içinde inceleme + kaldırma kararı

**Yasal pozisyon belirsizliği:** Marketplace değil dizin olduğumuz için ETBİS kapsamı net değil. **Yasal danışmana sor (Sprint 16 lansman öncesi)** — 2026'da pet shop dizini için emsal yok.

### 13.5.4 Mesafeli Satış Sözleşmesi YOK

PetStockPro **satıcı değil**, sadece dizin. Müşteri pet shop'a WhatsApp'tan ulaşır, satış pet shop'la müşteri arasında. Mesafeli satış sözleşmesi **pet shop'un sorumluluğu** (PetStockPro değil).

Vitrin altında küçük disclaimer:
*"PetStockPro pet shop'ları listeleyen bir dizin servisidir. Satış işlemleri ve kalite garantisi pet shop'un sorumluluğundadır."*

### 13.5.5 GDPR Uyumu — Faz 2 (TR-only kararıyla şu an pasif)

> **2026-05-14 TR-only revize:** Lansman TR-only olduğu için (PLAN-KADEMELERI.md + DEPLOYMENT.md), GDPR opt-in cookie akışı şu an aktif değil. Sadece KVKK opt-out modeli geçerli. EN locale gizli, EU/US trafiği hedeflenmiyor, KVKK Madde 9 yurt dışı veri aktarım açık rızası da kullanılmıyor (veri TR sınırları içinde — Supabase EU bölge tercihi yapılsa bile pet shop ve müşteri TR'de).
>
> **Faz 2 açılış koşulu:** EN locale açıldığında ve >%5 EU trafiği gelirse cookie banner'a "Reddet" butonu + GDPR opt-in akışı eklenir.

---

## 13.6 Currency Politikası (2026-05-14 TR-only revize)

> **Karar:** Vitrin **sadece TRY (₺)** kullanır, **sadece TR locale aktif**. EN locale gizli (next-intl yapısı korunur ama route açılmaz). Frankfurter API + yurt dışı ziyaretçi disclaimer banner **kaldırıldı** — TR-only lansman kapsamı dışı.

### 13.6.1 Mantık (sadeleşti)

| Senaryo | Davranış |
|---|---|
| TR locale, TR ziyaretçi | `250,00 ₺` → tek doğal akış |

EN locale ve yurt dışı ziyaretçi senaryoları **Faz 2'ye saklandı** (talep ölçülecek).

### 13.6.2 Neden TRY Only?

1. **Pet shop TR'de fiziksel** — gerçek satış TRY üzerinden, müşteri WhatsApp ile pet shop'la görüşüyor.
2. **PetStockPro satıcı değil** (§13.4 para akışı çizgisi) — currency conversion yapsak yanıltıcı.
3. **MVP sade tut** — TR-only lansman (PLAN-KADEMELERI.md + DEPLOYMENT.md otoritatif). Paddle / multi-currency / yurt dışı disclaimer Faz 2'ye saklandı.
4. **EUR/USD göstermek = "sanal satış katalogu"** algısı yaratır → yasal pozisyonu zedeler.

### 13.6.3 Sayı Formatı (TR locale, tek format)

| Locale | Örnek |
|---|---|
| TR | `250,00 ₺` (virgül ondalık, sembol son) |

`Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })` ile otomatik. Etiket: "Fiyat".

### 13.6.4 Faz 2 Açılış Koşulu

Eğer yurt dışı trafiği talebi gelirse Faz 2'de:
- EN locale + `/en/discover` route açılır
- Çoklu currency display (EUR + USD) — bilgilendirme amaçlı, dönüşüm yapılmaz
- Frankfurter API (ECB tabanlı) günde 1× sync
- Yurt dışı ziyaretçi disclaimer banner
- GDPR opt-in cookie akışı (§13.5.5)

Hala pet shop TRY üzerinden satış yapar, PetStockPro para akışına dahil olmaz.

---

## 14. Modlama (Süperadmin Tarafı)

Müşteri "🚩 Bildir" butonuna basınca:
- `vitrin_reports` tablosuna kayıt
- Süperadmin Vitrin Modlama sekmesinde queue'da görünür (EKRAN-SUPERADMIN §2.5)
- Süperadmin: Sil / Geçersiz / Tenant'a uyarı seçenekleri

Otomatik filter:
- Küfür listesi (system_settings)
- Telif şüphesi (marka logo tanıma)
- Spam profil (kelime tekrarı)

---

## 15. State + API

| Endpoint | Method | Cache |
|---|---|---|
| `/api/vitrin/home` | GET | 1h |
| `/api/vitrin/cities` | GET | 24h |
| `/api/vitrin/cities/[slug]` | GET (şehir + ilçe listesi) | 24h |
| `/api/vitrin/search` | GET (full-text + filtre) | 5dk |
| `/api/vitrin/products/[slug-id]` | GET (cross-tenant) | 5dk |
| `/api/vitrin/shops/[slug]` | GET (pet shop profili) | 1h |
| `/api/vitrin/nearby` | GET (lat/lng + yarıçap) | — (lokasyon bağımlı) |
| `/api/vitrin/events` | POST (analytics — view/click) | — |
| `/api/vitrin/report` | POST (modlama bildiri) | — |
| `/api/admin/vitrin/profile` | GET/PATCH (tenant ayar) | — |
| `/api/admin/vitrin/preview` | POST (taslak mode) | — |
| `/api/admin/vitrin/metrics` | GET (vitrin_events agg) | 5dk |

---

## 16. Plan Etkisi (3-tier B — 2026-05-14)

| Plan | Vitrin |
|---|---|
| FREE (50 ürün) | ✅ Aktif (KVKK + süperadmin onay sonrası) |
| PRO (500 ürün, 750 ₺/ay) | ✅ Aynı |
| PRO+ (sınırsız, 1.750 ₺/ay) | ✅ Aynı |

**Tüm planlar aynı görünür** — vitrin'de "öne çıkma" / "Sponsored" özelliği YOK (rekabet eşit, tek tema, eşit görünüm). Plan farkı sadece pet shop'un kataloga kaç ürün ekleyebileceğini etkiler, vitrin sıralamasına etkisi YOK.

---

## 17. Test Senaryoları

- VIT-001 Anasayfa: kategori grid + popüler ürünler + yakınlık
- VIT-002 Konum izni: browser geolocation kabul/red
- VIT-003 IP-based fallback: konum reddedilince şehir tahmini
- VIT-004 İl/ilçe filtreli sayfa: 12 pet shop listele
- VIT-005 Kategori sayfası: cross-tenant 487 ürün
- VIT-006 Ürün detay: 3 pet shop kıyaslama
- VIT-007 Sıralama algoritması: mesafe %40 + stok %25 + ...
- VIT-008 "Neden bu sırada" modal açılır
- VIT-009 WhatsApp deep link: hazır mesaj URL parametre
- VIT-010 vitrin_events: WhatsApp tıklama kaydı
- VIT-011 Pet shop profili: ürünler + harita + iletişim
- VIT-012 Stok 0 ürün vitrin'de görünmez (auto-removed)
- VIT-013 Stok visibility: var/yok level (default)
- VIT-014 Tenant Vitrin Ayarları: KVKK onay + slug + profil
- VIT-015 Süperadmin onay: pending → approved → vitrin'de görünür
- VIT-016 Vitrin Metrikleri ekranı: 4 KPI + en çok ilgi gören
- VIT-017 Bildiri butonu: vitrin_reports kaydı
- VIT-018 SEO: sitemap.xml + structured data + meta tags
- VIT-019 i18n: TR locale tek aktif (TR-only 2026-05-14, EN gizli — Faz 2'de açılacak)
- VIT-020 Mobile responsive: 390px tüm sayfalar
- VIT-021 Performance: anasayfa LCP < 2.5s
- VIT-022 Performance: ürün detay LCP < 2.5s
- VIT-023 PostGIS yakınlık sorgusu: ST_DWithin 50km

---

## 18. Faz 1 Kararlarıyla Uyum

| Faz 1 | Bu doküman | Durum |
|---|---|---|
| "Marketplace YOK" | Online satış YOK, sadece dizin | ✅ |
| "CUSTOMER rolü yok" | Public ziyaretçi anonim, hesap yok | ✅ |
| "Plan kısıtlaması YOK" | Vitrin tüm planlarda | ✅ |
| i18n TR-only (2026-05-14) | Vitrin prefix-based `/tr/vitrin` aktif, `/en/discover` Faz 2 | ✅ |
| Şube odaklı | Branch lat/lng PostGIS yakınlık sorgusu | ✅ |
| **PRO+ rafa kaldırma (2026-05-13)** | Custom domain YOK, tenant subdomain YOK | ✅ |
| **Merkezi tek vitrin (2026-05-13)** | `petstockpro.com/vitrin` Sahibinden modeli | ✅ |

---

## 19. Önceki Tasarım Notu

2026-05-12'de tenant subdomain (`{slug}.petstockpro.com`) + 5 hazır tema + custom domain (PRO+) tasarımı yapılmıştı. **2026-05-13 kararıyla tamamen iptal** — kullanıcı: *"Tek bir vitrin var, her kullanıcının ortak kullandığı tek bir vitrin var"* + *"PRO+ planını şimdilik rafa kaldıralım, satış olmasın, sadece stok takip uygulaması olarak ilerliyelim."*

**Mevcut tasarım (bu doküman):** Merkezi tek vitrin (`petstockpro.com/vitrin`), tek tema, Sahibinden modeli, cross-tenant kıyaslama, WhatsApp deep link.

`preview/vitrin.html` legacy — yeni merkezi vitrin için yeni HTML mockup Sprint 12 öncesi hazırlanır.

---

## 20. Sıradaki

✅ EKRAN-PUBLIC-VITRIN.md (bu doküman — yeniden yazıldı 2026-05-13)
⏭ **preview/vitrin.html** legacy bilgisi → yeni merkezi vitrin mockup (Sprint 12 öncesi)
⏭ Sprint 12 implementation (merkezi vitrin frontend + backend)

---

*Son güncelleme: 2026-05-13. **Merkezi tek vitrin (Sahibinden modeli) için yeniden yazıldı.** Tenant subdomain modeli iptal, PRO+ rafa kaldırıldı.*
