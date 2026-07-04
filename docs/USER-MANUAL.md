# PetStockPro Kullanım Kılavuzu

> Pet shop sahipleri, çalışanları ve müşteriler için kapsamlı kullanım rehberi.
> Bu kılavuz uygulamadaki her ekran, her özellik ve sık karşılaşılan durumları açıklar. Bir sorunuz olursa önce ilgili bölümü, ardından §19 Sık Sorulan Sorular bölümünü kontrol edebilirsin.

---

## İçindekiler

1. Hızlı Başlangıç (5 dakikada PetStockPro)
2. Hesap ve Güvenlik
3. Onboarding (Hesap kurma sonrası 3 adım)
4. Pano (Dashboard)
5. Ürünler
6. Stok Hareketleri
7. Sayım Workflow (Guided Stocktake)
8. Düşük Stok
9. Şubeler (Branch'ler)
10. Tedarikçiler
11. Müşteriler ve Veresiye
12. Raporlar
13. Vitrin — Sahip Tarafı (Storefront Yönetimi)
14. Vitrin — Müşteri Tarafı (Public Storefront)
15. Plan ve Fatura
16. Ayarlar
17. Kullanıcılar ve Yetki
18. Süperadmin (Sahibinden kısa bilgi)
19. Sık Sorulan Sorular (50+ kategorize edilmiş)
20. Sorun Giderme
21. AI Asistanı (Chatbot)

---

## 1. Hızlı Başlangıç (5 dakikada PetStockPro)

PetStockPro pet shop'lara stok takibi, satış kaydı ve isteğe bağlı olarak merkezi vitrin'de görünürlük sağlayan bir bulut servisidir. Aşağıdaki adımlarla hesabını açıp ilk ürününü vitrin'e koyabilirsin.

### Adım 1: Hesap aç

`petstockpro.com` adresine git ve sağ üstteki **"Yeni Hesap Aç"** butonuna tıkla. İstenen bilgiler:

- Pet shop adı (vitrin'de görünecek isim)
- E-posta
- Şifre (en az 8 karakter + 1 rakam + 1 büyük harf)
- KVKK Aydınlatma Metni onayı
- Veri lokasyonu açık rızası (verilerin Avrupa Birliği veri merkezinde saklandığı için zorunlu)

"Hesap Oluştur" tıklarsın → e-posta adresine doğrulama bağlantısı gelir.

### Adım 2: E-postanı doğrula

Gelen e-postadaki **"E-postamı Doğrula"** butonuna tıkla. Bu işlem 24 saat içinde yapılmazsa bağlantı geçersiz olur (yenisini "Yeniden Gönder" ile alabilirsin).

### Adım 3: Onboarding'i tamamla

Doğrulama sonrası otomatik olarak onboarding wizard açılır:

- **Adım 1 — İlk şube:** Şube adı, il, ilçe ve WhatsApp numarası gir
- **Adım 2 — İlk ürün (opsiyonel):** İstersen ilk ürününü ekle, istemezsen "Atla"
- **Adım 3 — Vitrin profili (opsiyonel):** Vitrin'de görünmek istersen slug seç, istemezsen "Atla"

### Adım 4: İlk ürünü ekle

Sol menüden **Ürünler → "+ Yeni Ürün"** tıkla. Zorunlu alanlar: ürün adı, kategori, satış fiyatı, başlangıç stoğu. Kaydet.

### Adım 5: Ürünü vitrin'e aç

Ürünler listesinde ilgili ürünün satırında **"Aç"** toggle'ını tıkla. Eksik bir bilgi varsa (görsel, vergi numarası, fiyat) sistem seni uyarır. Tüm gereklilikler tamamsa ürün anında vitrin'de yayında olur.

### Adım 6: İlk satışı kaydet

Sol menü → **Stok Hareketleri → "Çıkış / Satış" drawer**. Şube, ürün, miktar, ödeme tipini seç. Kaydet. Stok otomatik düşer, gerekirse vitrin'den otomatik çekilir (stok 0 olursa).

---

## 2. Hesap ve Güvenlik

### 2.1 Kayıt (Register)

URL: `/register`

Kayıt formunda istenen bilgiler:

| Alan | Kural |
|---|---|
| Pet shop adı | 3-100 karakter |
| E-posta | Geçerli format, her tenant için ayrı (aynı e-postayı iki kez kullanamazsın) |
| Şifre | Min 8 karakter, 1 rakam, 1 büyük harf, bilinen veri sızıntılarında bulunmamış olmalı |
| Şifre tekrar | Aynı şifre |
| KVKK Aydınlatma Metni onayı | Zorunlu checkbox |
| Veri lokasyonu açık rızası | Zorunlu checkbox (KVKK Madde 9) |
| Bot koruması | Cloudflare Turnstile widget (görünmez/otomatik) |

#### "Aynı kişinin iki pet shop'u var, ne yapayım?"

Her tenant için ayrı e-posta gerekli. Gmail kullanıyorsan `+` alias kullanabilirsin:

- `ahmet+mavipet@gmail.com`
- `ahmet+pati@gmail.com`

İkisi de aynı gerçek kutuya düşer ama sistemde ayrı sayılır.

### 2.2 Login (Giriş)

URL: `/login`

E-posta + şifre + (2FA aktifse) 6 haneli kod ile giriş yaparsın.

#### Kalan hak banner sistemi

Yanlış şifre girdiğinde sistem seni şu şekilde uyarır:

- **1. yanlış:** "E-posta veya şifre hatalı" (banner yok)
- **2. yanlış:** Aynı mesaj (parmak hatası olabilir)
- **3. yanlış:** 🟡 "3 hakkın kaldı."
- **4. yanlış:** 🟠 "2 hakkın kaldı. ⚠ Şifreni unuttun mu? → Şifremi Unuttum"
- **5. yanlış:** 🔴 "1 hakkın kaldı. ⚠ Bir sonraki yanlışta hesabın 1 saat kilitlenecek."
- **6. yanlış:** 🔒 Hesap 1 saat kilitlenir + e-postana uyarı gelir

#### Kilitli hesap

Hesabın kilitlendiyse `/account-locked` sayfasına yönlendirilirsin. Bu sayfada:

- HH:MM:SS geri sayım sayacı görürsün
- "Şifremi Unuttum" butonu bypass yapar (kilidi delip yeni şifre belirleyebilirsin)
- Süre dolunca otomatik kilit açılır

#### 24 saat kalıcı kilit

24 saat içinde 3 kez art arda kilitlenmek (yani 15 başarısız deneme) sistem tarafından **ciddi saldırı sinyali** olarak değerlendirilir. Bu durumda:

- Hesap 24 saat boyunca kalıcı kilitlenir
- E-postana acil uyarı gönderilir ("Hesabına 3 kez art arda saldırı denendi")
- Süperadmine kritik alarm düşer
- "Şifremi Unuttum" yine kullanılabilir

### 2.3 Şifremi Unuttum

URL: `/forgot-password`

E-posta adresini gir, Turnstile doğrulama yap, "Sıfırlama Bağlantısı Gönder" tıkla. **Hesap kilitli olsa bile bu akış çalışır** (lock'u bypass eder).

⚠️ E-posta enumeration koruması: E-posta hatalı veya yok olsa bile sistem aynı "Eğer e-posta kayıtlıysa, sıfırlama bağlantısı gönderildi" mesajını gösterir. Bu yüzden gelen e-postayı kontrol et — eğer 5 dakika içinde gelmediyse muhtemelen yanlış e-posta yazdın.

#### Şifre sıfırlama TTL

Sıfırlama linki **30 dakika** geçerlidir. Bu süre dolarsa yeni link almak için tekrar `/forgot-password` formunu doldurman gerekir.

### 2.4 İki Faktörlü Doğrulama (2FA TOTP)

#### 2FA aktive et

`/admin/security` → **"2FA Aktive Et"** butonu → 3 adımlı wizard:

1. **QR Kod:** Google Authenticator, Microsoft Authenticator veya Authy gibi bir uygulama ile QR kodu okut. Manuel kurulum için altta "Manuel Secret" anahtarı da görünür.
2. **Doğrulama:** Uygulamadan gelen 6 haneli kodu gir.
3. **Recovery Codes:** Sistem sana 8 adet tek kullanımlık recovery kodu verir (örn: `ABCD-EFGH`). Bunları güvenli bir yere yaz (kağıda, şifre yöneticisine). Telefon kaybolursa bunlarla giriş yapabilirsin.

#### 2FA ile giriş

Şifre doğru girildikten sonra ikinci ekran açılır:

- 6 haneli TOTP kodu gir, ya da
- "Recovery code kullan" linkine tıkla ve 8 karakterli kodlardan birini gir

Recovery kodları tek kullanımlık — kullanıldıktan sonra silinir.

#### 2FA kapat veya recovery code yenile

`/admin/security` → "2FA Kapat" veya "Recovery Kodları Yenile" butonu. Her iki işlem de TOTP doğrulaması ister (güvenlik için). Recovery yenileme eski 8 kodu siler, yeni 8 kod üretir.

> 🔒 **Güvenlik notu:** 2FA aktif tüm hesaplar için **kuvvetle önerilir**. Süperadmin Telegram'a "2FA kapatıldı" alarmı düşer.

### 2.5 Email Değiştir

`/admin/account` → "E-posta Değiştir" formuna yeni e-postayı + mevcut şifreni gir.

**Çift e-posta akışı:**

1. **Yeni e-postaya** doğrulama bağlantısı gönderilir (24 saat geçerli)
2. **Eski e-postaya** bilgilendirme + "İptal Et" bağlantısı gönderilir (saldırı şüphesi için)
3. Yeni e-postadaki bağlantıya tıklarsan değişim **kesinleşir**
4. Eski e-postadaki "İptal Et" bağlantısına tıklarsan değişim **iptal** olur + süperadmine kritik alarm düşer

Bu çift onay, hesap ele geçirildiyse fark etme şansı verir.

### 2.6 Aktif Oturumlar

`/admin/security` → "Aktif Oturumlar" panelinde tüm cihazlarda aktif girişlerini görebilir, ayrı ayrı kapatabilirsin. Şifre sıfırlama ya da rol değişikliği sonrası tüm oturumlar otomatik kapanır.

---

## 3. Onboarding (Hesap kurma sonrası 3 adım)

E-postan doğrulandıktan sonra otomatik olarak `/onboarding` sayfasına yönlendirilirsin. Üç adımlı wizard.

### Adım 1: İlk şube (zorunlu)

```
Şube adı *       [Merkez]
İl *             [İstanbul ▼]
İlçe *           [Kadıköy ▼]   (il seçince otomatik yüklenir)
Açık adres       [opsiyonel]
WhatsApp         [+90 5XX XXX XX XX]
```

WhatsApp formatı: `+90` ile başlamalı ya da `0` ile (örn. `0532 1234567`). Boşluk önemli değil.

💡 **İl ve ilçe önemli:** Vitrin'de "Yakındaki pet shop'lar" sıralaması bu konuma göre çalışır.

### Adım 2: İlk ürün (opsiyonel)

İstersen ilk ürününü buradan ekleyebilirsin. Zorunlu alanlar: ürün adı, kategori, satış fiyatı. Atlamak için **"Atla"** linkine tıkla.

### Adım 3: Vitrin profili (opsiyonel)

Vitrin'de görünmek istersen:

- **Slug:** Pet shop'unun URL'sindeki kısa ad (örn. `mavi-pet-shop` → `petstockpro.com/vitrin/magaza/mavi-pet-shop`). Pet shop adından otomatik üretilir, değiştirebilirsin.
- **Kapak ve logo:** Opsiyonel (sonra Ayarlar'dan da yükleyebilirsin)
- **Kısa açıklama:** Maksimum 160 karakter

Atlamak için **"Vitrin'i Sonra Aç"** linkine tıkla. Ayarlar → Vitrin Profili'nden istediğin zaman aktive edebilirsin.

Üç adım tamamlanınca `/admin` (Pano) sayfasına yönlendirilirsin.

---

## 4. Pano (Dashboard)

URL: `/admin`

Pano her giriş yaptığında ilk gördüğün ekran. İşletmenin günlük nabzını tek bakışta gösterir.

### 4.1 Üst karşılama bandı (Hero)

Saat dilimine göre dinamik karşılama:

- 06:00-12:00 → "İyi sabahlar, [adın] 👋"
- 12:00-18:00 → "İyi günler"
- 18:00-23:00 → "İyi akşamlar"
- 23:00-06:00 → "Geceniz iyi olsun"

Hero'da ayrıca son 24 saatteki hareket sayısı ve plan limitine yaklaşma uyarısı görünür.

### 4.2 4 KPI kartı

```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Toplam   │ │ Toplam   │ │ Bugünkü  │ │ Düşük    │
│ ürün     │ │ stok     │ │ satış    │ │ stok     │
│ 47       │ │ 1.247    │ │ ₺4.820   │ │ 5 ürün   │
│ /50 plan │ │ 3 şube   │ │          │ │ ⚠ Kritik │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

| KPI | Anlam |
|---|---|
| Toplam ürün | Aktif (arşivlenmemiş) parent ürün sayısı, plan limitiyle birlikte |
| Toplam stok | Tüm şubelerdeki tüm variantların toplam adet |
| Bugünkü satış | Bugün 00:00'dan itibaren kaydedilen satışların ciro toplamı |
| Düşük stok | Eşik altına düşen variantların sayısı |

### 4.3 Plan progress bar

Toplam ürün KPI'ında plan ilerleme çubuğu:

- 🟢 Yeşil (%0-60): Plan'da yer var
- 🟠 Turuncu (%60-80): Limit'e yaklaştın
- 🔴 Kırmızı (%80-100): Limit dolmak üzere → PRO'ya yükselt
- ⛔ Doldu (%100): Yeni ürün ekleyemezsin (yükselt veya arşivle)

PRO+ planında bu çubuk yerine "∞ Sınırsız" rozeti görünür.

### 4.4 Düşük stok widget

Pano'da sağda kompakt liste:

- En kritik 5 ürün (stok / eşik karşılaştırması)
- Her ürün tıklanabilir → ürün detayına gider
- "Transfer önerisi" linki (multi-branch tenant için)
- Hepsi yolundaysa "Hepsi yolunda! Kritik stoğu tükenen ürün yok" mascot kartı görünür

### 4.5 PetPro Asistan önerileri

Sistem 3 tip akıllı öneri üretir:

| Öneri tipi | Tetik koşulu | Aksiyon |
|---|---|---|
| 📥 **Sipariş** | Bir ürünün satış hızı yüksek + stok eşik altına düşüyor | "X adet sipariş öner" → Stok Girişi drawer pre-filled açılır |
| 🔄 **Transfer** | Bir şubede fazla, başkasında eksik (multi-branch) | "Transfer aç" → Transfer drawer pre-filled |
| 🏷 **İndirim** | Bir ürünün son kullanma tarihi 30 günden az kaldı | "İndirim oluştur" — SKT 15 günden azsa %20, 15-30 gün arası %10 öneri |

Öneri yoksa "Bugün öneri yok! Stok dengesi mükemmel" mesajı görünür.

### 4.6 Son bildirimler widget

Son 5 bildirim feed'i (stok girişi, satış, transfer, sayım, vitrin aktivitesi). "Tümünü gör →" linki `/admin/notifications` sayfasına yönlendirir.

### 4.7 Son hareketler feed

Tüm şubelerden anlık akış (8 satır). Her satırda:

- Hareket tipi ikon (📥 giriş / 📤 çıkış / 🔄 transfer / 📋 sayım)
- Ürün adı + miktar chip (+24 adet / −3 adet / ↔ 5 adet)
- Detay (tedarikçi, müşteri, transfer yönü, sayım sebebi)
- Relative zaman ("2 dk önce")

Süperadmin tarafından yapılan hareketlerde sol kenarda 🚨 rozeti görünür.

### 4.8 Bildirim çanı (Bell)

Sol üst menüde 🔔 ikon. Okunmamış bildirim sayısı kırmızı badge'de görünür. Tıklayınca dropdown açılır, "Tümünü oku" ile hepsini tek tıkta okundu işaretleyebilirsin (bell badge anında sıfırlanır).

### 4.9 Conditional süperadmin link

Eğer hesabın SUPERADMIN rolündeyse Pano üst menüsünde 🛡 **Süperadmin** linki görünür. Normal pet shop sahipleri bu linki **görmez**.

---

## 5. Ürünler

URL: `/admin/products`

Ürünler stok takibinin kalbidir. Burada parent ürünleri ve variant'larını yönetirsin.

### 5.1 Liste sayfası

#### Üst bar

```
[📦 47 ürün] [⚠ 5 düşük] [⏰ 3 SKT yaklaşıyor] [⛔ 1 tükendi]
[Plan: FREE 47/50 ████████░ ]  [+ Yeni Ürün] [Excel'e Aktar] [Excel'den İçeri Aktar PRO]
```

KPI'lar tıklanabilir → ilgili filtre uygulanır.

#### Filtreler

```
Arama: [SKU, isim veya barkod ara...]
Kategori: [Mama] [Aksesuar] [Oyuncak] [Kum] [Sağlık]
Marka:    [autocomplete]
Hayvan:   [🐱] [🐶] [🐦] [🐟] [🐰] [🦎]
Şube:     [Tüm şubeler ▼]
Stok:     ◉ Hepsi  ○ Düşük  ○ Tükendi  ○ Normal
SKT:      ◉ Hepsi  ○ Yakında (30g)  ○ Geçmiş
Durum:    ◉ Aktif  ○ Arşivlenmiş  ○ Hepsi
Vitrin:   ◉ Hepsi  ○ Yayında  ○ Kapalı
Fiyat:    [₺0 ─────── ₺5000]
```

Tüm filtre değişiklikleri URL'e yansır — paylaşılabilir link.

#### Tablo kolonları

| Kolon | İçerik |
|---|---|
| ☑ | Bulk seçim |
| 🖼 | 48×48 ürün görseli |
| Ürün | Ad + SKU + hayvan emoji + SKT badge + variant sayısı |
| Kategori | Kategori + marka |
| Stok | Toplam adet + eşik dot (🔴 kritik / ⚠ düşük / ✓ normal / ⛔ tükendi) |
| Fiyat | Satış (büyük) + alış (gri küçük) + marj % |
| Şube | Şube adı (tek-şube tenant'ta gizli) |
| Vitrin | "Aç" / "Aktif ✓ Doğrulandı" toggle |

#### Stok hücresi expand

Bir ürünün stok hücresine tıkladığında inline expand açılır — variant × şube matrix'i:

```
┌── Variant + Şube matrix ──────────────────────┐
│ Variant │ Merkez │ Şube A │ Şube B │ Toplam   │
│ 400g    │   12   │    8   │    5   │   25 ⚠   │
│ 2kg     │   10 🔴│    5   │    3   │   18 🔴  │
│ 10kg    │    3 🔴│    1 🔴│    0 ⛔│    4 🔴  │
│ TOPLAM  │   25   │   14   │    8   │   47     │
│ [📥 Stok Girişi] [🔄 Transfer]                │
└─────────────────────────────────────────────────┘
```

### 5.2 Yeni ürün ekleme

`/admin/products/new` — 8 bölümlü form.

#### Bölüm 1: Temel bilgiler

- **Ürün adı** (zorunlu, 3-100 karakter)
- **SKU** (otomatik öneri verir, manuel override edilebilir)
- **Barkod** (opsiyonel, EAN-13 doğrulanır)
- **Açıklama** (markdown destekli)

SKU otomatik öneri pattern: `[KATEGORI]-[MARKA]-[SIRA]` (örn. `RC-K-ADL` = Royal Canin Kedi Adult).

#### Bölüm 2: Sınıflandırma

- **Kategori** (zorunlu, 2 seviyeli — Mama → Kedi Maması)
- **Marka** (opsiyonel, dropdown — listede yoksa süperadmine bildir, pet shop sahipleri marka ekleyemez)
- **Hayvan türü** (multi-checkbox: 🐱 🐶 🐦 🐟 🐰 🦎)
- **Etiketler** (chip input)

> ⚠️ **Önemli (2026-05-22):** Marka ve kategori sistemde **global** tutulur. Pet shop sahipleri yeni marka veya kategori ekleyemez. Eğer ihtiyacın olan marka listede yoksa süperadmine bildir (Telegram veya e-posta), kısa süre içinde eklenir.

#### Bölüm 3: Görseller

- Drag-drop yükleme (sürükle bırak veya "Dosya seç")
- **JPG, PNG, WebP** kabul edilir
- **Maksimum 5 MB** her bir görsel için
- **En fazla 5 görsel** her ürün için
- İlk yüklenen otomatik ana görsel olur (⭐), istediğini ana yapabilirsin
- Sürükle-bırak ile sırasını değiştirebilirsin

#### Bölüm 4: Fiyat

- **Alış fiyatı** (KDV hariç, > 0)
- **Satış fiyatı** (KDV dahil, ≥ alış olmalı)
- **KDV oranı** (kategori bazlı default — mama %10, aksesuar %20)
- **Marj** otomatik hesaplanır (canlı, yeşil pozitif / kırmızı negatif)

#### Bölüm 5: Stok ve eşik

- **Genel eşik** (bu eşiğin altına düşünce düşük stok uyarısı)
- **Şube bazlı eşik özelleştir** (opsiyonel — şube başına farklı eşik)
- **Başlangıç stoğu** (her şube için ayrı ayrı)

Başlangıç stoğu > 0 olan şubeler için otomatik "Başlangıç Stoğu" tipi stok hareketi yaratılır.

#### Bölüm 6: Son kullanma tarihi (SKT) + Lot

- ☑ Bu ürün için SKT zorunlu (kategori bazlı default — mama/ilaç için açık, aksesuar için kapalı)
- Varsayılan SKT (opsiyonel — her stok girişinde override edilir)
- Lot/Parti no (opsiyonel)

#### Bölüm 7: Variant'lar

Bu ürünün variant'ları var mı?

- **Hayır, tek satır:** Sistem transparent default variant yaratır, sen göremezsin
- **Evet, variantlı:** Her variant ayrı SKU + barkod + fiyat + eşik

Variant tablosu:

```
# │ Etiket │ SKU          │ Barkod  │ Satış │ Alış │ Eşik │
1 │ 400g   │ RC-K-ADL-400G│ 8690... │ ₺95   │ ₺60  │  5   │
2 │ 2kg    │ RC-K-ADL-2KG │ 8690... │ ₺250  │ ₺180 │ 10   │
3 │ 10kg   │ RC-K-ADL-10KG│ 8690... │ ₺1150 │ ₺850 │  3   │
```

Variant başına SKU **global benzersizdir** — aynı SKU başka variant tarafından kullanılamaz.

#### Bölüm 8: Admin notu (gizli)

Müşterilere ve çalışanlara görünmeyen, sadece sahibin gördüğü dahili not.

#### Sticky özet ve validasyon

Sağ kolonda canlı özet + validasyon checklist:

```
✓ Ad
✓ SKU
✓ Kategori
✗ Görsel ekle  ← tıklayınca o bölüme scroll
✓ Fiyat
✓ Eşik
```

Tüm zorunlu alanlar doluysa **"Yayına Al"** butonu aktif olur. Eksik alanlar varsa **"Taslak Kaydet"** ile devam edebilirsin (yayına alınmaz).

#### Otomatik taslak kaydı

Form 30 saniyede bir background'da taslak olarak kaydedilir. Sayfa kapanıp tekrar açılırsa "Devam edilmemiş taslak bulundu — Yükle?" prompt görünür. Taslaklar 7 gün saklanır.

### 5.3 Ürün düzenleme

`/admin/products/[id]/edit` — 6 bölümlü tek sayfa (yeni ürün formuyla benzer ama önceden doldurulmuş).

Üst section'lar:

1. **Temel bilgiler** (ad, SKU, kategori, marka)
2. **Default variant** (fiyat, eşik)
3. **Storefront** (vitrin durumu + Doğrula validation panel)
4. **Variant'lar** (ekle, düzenle, sırala, sil)
5. **Görseller** (yükle, sırala, ana yap, sil)
6. **Ürünü sil** (soft delete)

### 5.4 Variant yönetimi

#### Yeni variant ekle

Düzenle sayfasında "Variant'lar" bölümünde **"+ Yeni Variant"** linkine tıkla. Inline form açılır:

- Etiket (örn. "400g", "XL Boy")
- SKU (otomatik öneri verir)
- Barkod (opsiyonel)
- Alış / satış fiyatı
- Eşik (şube bazlı override edilebilir)

#### Default variant

Her ürünün bir "default" variant'ı vardır (★ rozet). Vitrin'de o variant'ın fiyatı gösterilir.

- Default'u değiştirmek için variant satırında **"★ Default Yap"** butonu
- **Pasif variant default olamaz** — önce aktif yap
- Sadece 1 variant aktifken o variant'ı pasifleştiremezsin (en az 1 aktif zorunlu)

#### Variant sil

Variant'ı silmek için **🗑** butonuna tıkla. Default variant silinemez (önce başka variant'ı default yap).

#### Variant sırala

Drag-drop ile variant sırasını değiştir. Vitrin'de bu sırayla görünür.

### 5.5 Satışa Aç toggle ve Doğrula validation

Ürünler listesinde her satırın sağında "Aç / Kapat" toggle vardır. Tıkladığında sistem otomatik validation yapar:

#### Doğrula kontrolü (5 madde)

| Kontrol | Anlam |
|---|---|
| 🏢 Vergi numarası | Şirket profilinde vergi no dolu olmalı (10 hane VKN veya 11 hane TC) |
| 📦 Aktif variant | En az 1 aktif variant olmalı |
| 💰 Geçerli fiyat | Satış fiyatı 1₺-50.000₺ aralığında olmalı |
| 📂 Kategori | Kategori atanmış olmalı |
| 📷 Görsel | En az 1 ürün görseli yüklenmiş olmalı |

#### Eksik varsa

```
[Aç] tıkla → "⚠ 2 eksik — Doğrula panelinden gör"
       ↓ 1.5 saniye sonra otomatik redirect
   /admin/products/[id]/edit (Doğrula paneli görünür)
```

Düzenle sayfasında Doğrula panelinde ✓ / ✕ checklist'i görürsün. Eksikleri tamamlayıp tekrar "Aç" tıkla.

#### Hepsi tamamsa

```
[Aç] tıkla → anında "✓ Doğrulandı 3g önce" rozet + ürün vitrin'de yayında
```

#### Vergi numarası yoksa özel akış

Eğer şirket profilinde vergi no yoksa, "Aç" tıkladığında özel modal açılır:

```
┌── Vergi numarası gerekli ────────────────────────┐
│                                                    │
│ Vitrin'de ürün satışa açmak için vergi             │
│ mükellefi olmanız gerekiyor.                       │
│                                                    │
│ Vergi numaranızı girin (10 hane VKN veya          │
│ 11 hane TC kimlik no — şahıs şirketi):             │
│ [__________]                                       │
│                                                    │
│ Vergi dairesi: [____________]                      │
│                                                    │
│ ☑ Vergi mükellefi olduğumu beyan ederim            │
│                                                    │
│   [Sonra]  [Kaydet ve Doğrula]                     │
└────────────────────────────────────────────────────┘
```

"Sonra" tıklarsan modal kapanır, toggle Off kalır. "Kaydet ve Doğrula" tıklarsan vergi no kaydedilir, ürün vitrin'e açılır.

> 💡 **Önemli:** Sadece stok takip için kullanan tenant'a vergi no zorunlu değil. Sadece vitrin'de görünmek istiyorsan gereklidir.

### 5.6 Stok 0 → otomatik vitrin'den çekme

Stoğun 0'a düşen ürünler otomatik olarak vitrin'den çekilir:

1. Toggle Off olur
2. Yanında küçük rozet: "⛔ Stok bittiği için 12 Mayıs 14:30'da çekildi"
3. Telegram bildirimi gelir: "⛔ Royal Canin 2kg stoğu bitti, vitrin'den çekildi"
4. Pano dikkat bandında 🔔 görünür

Stok ekledikten sonra ürün **otomatik geri açılmaz** — sen manuel olarak toggle'ı tekrar açmalısın. Bu kasıtlı bir tercih: yanlış stok girişi yapıldığında vitrin'de yanlış bilgi olmaması için.

### 5.7 Excel'den toplu içeri aktarma (PRO özelliği)

`/admin/products/import` — PRO ve PRO+ tenant'lar için.

**FREE plan'da bu özellik yok** — sayfa "⭐ PRO ÖZELLİĞİ" panelini ve "Manuel ekle" CTA'sını gösterir.

#### Adımlar

1. **Şablon indir:** 11 sütunlu xlsx şablonu indir (5 örnek satırla birlikte)
2. **Doldur:** Excel'de ürünleri ekle (max 500 satır)
3. **Yükle:** Drag-drop ya da "Dosya seç"
4. **Önizleme:** Sistem 15+ kuralla doğrulama yapar — hatalar varsa satır bazında listelenir
5. **Onayla:** Hatasız satırlar import edilir, hatalı satırlar atlanır

Şablon sütunları:

| Sütun | Açıklama |
|---|---|
| name | Ürün adı (zorunlu) |
| sku | SKU (zorunlu, benzersiz) |
| barcode | Barkod (opsiyonel) |
| category_slug | Kategori (mevcut listeden — yoksa hata) |
| brand_slug | Marka (mevcut listeden — yoksa hata) |
| animal_types | Hayvan türü (csv: kedi, kopek) |
| sale_price | Satış fiyatı (₺) |
| cost_price | Alış fiyatı (₺) |
| threshold | Eşik (adet) |
| initial_stock | Başlangıç stoğu (adet) |
| vat_rate | KDV oranı (10 / 20) |

⚠️ İmport edilen ürünler **vitrin'de kapalı** olarak gelir (görsel yüklenmeden vitrin'e açılamaz).

### 5.8 Ürün soft delete

Ürünleri tamamen silemezsin (geçmiş satışlarda referans var). Bunun yerine **arşivlersin**:

- Düzenle sayfasında "Ürünü Sil" bölümünden
- Bulk seçim → "Arşivle" butonundan

Arşivlenmiş ürün:

- Listede "Arşivlenmiş" filtresinde görünür
- Otomatik vitrin'den çekilir
- Stok hareketlerinde geçmiş kayıtları korunur
- İstediğinde "Geri Aç" ile aktife alabilirsin

---

## 6. Stok Hareketleri

URL: `/admin/stock-movements`

Stok hareketleri **değiştirilemez bir defter (immutable ledger)** olarak tutulur. Bir hareketi tamamen silemezsin — sadece geri alabilirsin (24 saat içinde) veya karşı hareket yazabilirsin.

### 6.1 Ledger (defter) listesi

Son 100 hareket görünür. Her satır:

```
Tarih           Tip          Ürün                Önce → Sonra   Δ        Şube      Notlar    İşlem
07 May 14:32   📥 Giriş     Royal Canin 2kg    25 → 49        +24      Merkez    Tedarikçi  [↶]
07 May 14:25   📤 Satış     Whiskas 400g       8 → 5          -3       Şube A    Müşteri    [↶]
07 May 14:18   🔄 Transfer  Pro Plan 15kg      18 → 13        ↔ 5      Merkez→B  Yola çıktı [↶]
07 May 14:02   📋 Sayım     Felix Pouch        12 → 10        -2       Merkez    Kayıp      —
```

#### Filtre seçenekleri

- Tarih aralığı (Son 7g, 30g, Bu ay, Özel)
- Tip (Giriş, Çıkış, Transfer, Sayım)
- Alt-tip (Satış, Zayiat, Hediye, Numune vs.)
- Ürün
- Şube
- Kullanıcı
- Tedarikçi
- Süperadmin işaretli
- Sayım farkı olanlar
- Geri alınmış olanlar

### 6.2 Stok Girişi drawer (📥)

Tedarikçiden gelen mal kabulü için kullanılır.

#### Alanlar

| Alan | Açıklama |
|---|---|
| Şube | Hangi şubeye giriş yapıldı |
| Variant | Hangi ürün/variant (autocomplete) |
| Miktar | Adet (> 0) |
| Birim alış fiyatı | Bu girişteki alış (ürün'ün son alış fiyatı default) |
| Tedarikçi | Autocomplete + "+ Yeni Tedarikçi" inline |
| Belge no | İrsaliye numarası (opsiyonel) |
| Lot no | Üretim parti no (opsiyonel) |
| Son kullanma tarihi | Mama/ilaç kategorisinde zorunlu |
| Not | Serbest metin |

#### Kaydet

- Stok hareketi defteri'ne 1 entry eklenir
- Şube envanteri güncellenir
- Pano feed anında güncellenir
- Düşük stok widget'ı tetiklenir (yeterli stok varsa düşer)
- Toast: "Stok girişi kaydedildi"

### 6.3 Stok Çıkışı / Satış drawer (📤)

Çıkış tipi seçilince form değişir:

#### Çıkış tipleri

| Tip | Anlam | Ekstra alanlar |
|---|---|---|
| **Satış** | Müşteriye satış | Birim fiyat, ödeme tipi, müşteri ref |
| **Zayiat (fire)** | Bozulmuş, kırık | Sebep |
| **Hediye** | Müşteri hediyesi | Müşteri ref (opsiyonel) |
| **Numune** | Tedarikçi numunesi | Müşteri ref (opsiyonel) |
| **İade (müşteriye)** | Satıştan dönüş | Müşteri ref, sebep |
| **Şube içi tüketim** | Hayvan deneme/temizlik | Sebep |
| **Diğer** | Yukarıda olmayan | Sebep (zorunlu) |

#### Ödeme tipleri (sadece Satış için)

- 💵 Nakit
- 💳 Kart
- 🏦 Havale/EFT
- 📝 Veresiye

#### ⚠️ Veresiye satış kuralı

Eğer ödeme tipi **Veresiye** seçildiyse **müşteri referansı zorunludur** (boş bırakılamaz):

- Ad + telefon önerilir: "Ahmet Y. 0532 1234567"
- "Misafir alıcı" gibi anonim kayıt veresiyede kabul edilmez
- Boş bırakırsan: "Veresiye satışta müşteri zorunlu" hatası

Daha sonra müşteri ödeme yapınca **Raporlar → Açık Krediler → "Krediyi Kapama"** ile kapatabilirsin.

#### Anlık stok ön-izleme

Adet girdikçe canlı stok hesaplaması:

- `25 → 22 ✓` (yeterli, yeşil)
- `8 → 3 ⚠` (eşik altına düşüyor, turuncu)
- `2 → -1 ❌` (eksi stok, kırmızı — **kayıt bloklanır**)

#### Eksi stoğa izin yok

Mevcut stoktan fazla çıkış yapamazsın. "Stok yetersiz: 2 mevcut, 5 isteniyor" hatası alırsın. Bu disiplin kuralıdır — gerçeklikten kopmasın diye.

### 6.4 Transfer drawer (🔄)

Şubeler arası stok aktarımı için kullanılır.

#### Alanlar

- **Kaynak şube** (zorunlu)
- **Hedef şube** (zorunlu, kaynak ile aynı olamaz)
- **Variant** (autocomplete)
- **Miktar** (kaynak şubedeki mevcut stoktan fazla olamaz)
- **Not** (opsiyonel)

#### Transfer pair (çift kayıt)

Transfer her zaman **iki entry** olarak yazılır:

```
Entry 1: Merkez → −5 adet (kaynak'tan düşüldü)
Entry 2: Şube A → +5 adet (hedefe eklendi)
```

İki entry **aynı transfer grubu ID'sine** bağlıdır. Geri alındığında ikisi birden geri alınır (pair handling).

### 6.5 Sayım drawer (📋 Quick Add)

Hızlı tek-variant sayım düzeltmesi için. Çoğunlukla **Sayım Workflow** kullanılır (§7).

- Şube + variant + sayılan adet (countedQty)
- Fark (delta) hesaplanır: countedQty − mevcut
- Fark 0 ise kayıt oluşmaz ("Sayım sistemdeki miktarla aynı — düzeltme yok")
- Fark + ise giriş yönlü, − ise çıkış yönlü hareket yazılır
- Sebep (loss/overage/wrong_entry/expired/damage/theft/other)

### 6.6 Geri alma (Reverse) — 24 saat kuralı

Her hareketin sağında **↶ Geri Al** butonu vardır.

| Rol | Süre limit |
|---|---|
| Bayi sahibi / çalışan | **24 saat** içinde geri alabilir |
| Süperadmin | Süresiz (🚨 audit kaydı düşer) |

#### Geri alma akışı

1. Hareket satırında **↶** ikonu tıkla (24 saat içinde aktif, sonra gri)
2. Onay modal açılır — sebep gir
3. Yeni bir "Geri alma" hareketi yazılır (ters yönlü)
4. Orijinal hareket "✓ Geri alındı" rozet alır, yeni hareket "↶ Geri alma" rozet alır

#### Süresi geçmiş geri alma

24 saat geçtiyse ↶ butonu disabled olur. Tooltip: "24 saat süresi geçti. Karşı hareket gir →"

Karşı hareket yazmak için yeni bir Stok Çıkışı (tipi: İade veya Diğer) kaydı oluşturursun.

#### Sayım geri alınamaz

Sayım hareketleri için ↶ butonu yoktur. Sayım fiziki gerçeği yansıtır — geri almak ledger'ı kararsızlaştırır. Yeniden say yapman gerekir.

#### Transfer geri alma

Transfer geri alındığında **iki entry birden** geri alınır (pair):

- Hem kaynak hem hedef şubedeki stok tersine döner
- İki yeni "Geri alma" entry yazılır, aynı yeni transfer grubu ID'si ile
- Her iki şubede yeterli stok yoksa geri alma reddedilir

---

## 7. Sayım Workflow (Guided Stocktake)

URL: `/admin/stocktake`

Sayım, fiziki gerçeği sisteme yansıtma sürecidir. Tam-sayfa workflow ile tek tek ürünleri sayarak farkları kaydedersin.

### 7.1 Yeni sayım başlatma

`/admin/stocktake/new` → form:

- **Şube** (zorunlu)
- **Mod:** "Tam sayım" (default — tüm aktif variant'lar) — Kategori/Manuel modlar Faz 2'ye saklı
- **Not** (opsiyonel — örn. "Mayıs 2026 aylık sayım")

"Başlat" tıklayınca:

1. Sistem tüm aktif variant'lardan snapshot alır (anlık sistem stoğu)
2. `/admin/stocktake/[id]` workflow sayfasına yönlendirir

### 7.2 Workflow tam sayfa

```
┌──────────────────────────────────────────────────────┐
│ Sayım #4f26d35e · Aylık · Merkez                      │
│ Başladı: 07 May 14:32 · 23 dk önce                     │
│                                                         │
│ [██████████░░░░░░░░░░] 85 / 198 ürün · %43           │
│ ✓ Sayıldı: 85   ⚠ Fark: 3   ⏸ Atlandı: 2            │
│                                                         │
│ Filtreler: [Tümü] [Sayılmadı] [Sayıldı] [Farklı]     │
│ Arama: [_____________]                                 │
│                                                         │
│ Ürün                          │Sistem│Sayılan│Fark│✓   │
│ Royal Canin Kedi 2kg          │  10  │ [9]   │ -1 │[Kayıp▼]│
│ Whiskas 400g                  │  25  │ [25]  │  0 │ ✓ │
│ Felix Pouch                   │  18  │ [   ] │    │    │
│ ...                                                     │
│                                                         │
│ [💾 Beklemede Kaydet] [⏸ Daha Sonra] [✓ Tamamla]    │
└──────────────────────────────────────────────────────┘
```

### 7.3 Her satır için

- **Sayılan input:** Sen sayım yaparken raftaki adedi girersin (0-999.999)
- **Fark:** Otomatik hesaplanır (sayılan − sistem)
- **Sebep dropdown:** Fark ≠ 0 ise zorunlu

#### Sebep listesi (7 enum)

| Sebep | Anlam |
|---|---|
| Kayıp | Bulunamıyor, görünmüyor |
| Fazla | Sistemde olmayan fazlalık |
| Hatalı kayıt | Giriş/çıkış yanlış yapılmış |
| SKT geçmiş | Atılmış / iade edilmiş |
| Hasar | Kırık, açılmış |
| Çalıntı | Kayboldu, çalındı |
| Diğer | Yukarıda yok — serbest text alanı açılır |

### 7.4 Ara kayıt

- Her satırda "✓ Save" tıklayarak ya da Enter tuşuyla satırı kaydedebilirsin
- Sayım otomatik 30 saniyede bir background'da kaydedilir
- Sayfa kapansa veya sekme değişse dahi veriler kaybolmaz

### 7.5 Tamamlama (Complete)

Tüm ürünler sayıldıktan sonra (counted / total = %100) **"✓ Tamamla"** butonu aktif olur.

Sayılmayan ürün varsa modal: "X ürün sayılmadı, devam etmek istiyor musun?" (reddet veya devam et seçimleri).

Tamamlandığında:

1. Her fark için **stok hareketi defteri'ne entry** yazılır (sebep ile birlikte)
2. Şube envanteri sayılan değere set edilir
3. Stoğu 0'a düşen ürünler otomatik vitrin'den çekilir
4. Sayım durumu "completed" olur (geri alınamaz)
5. Audit log kayıtları düşer

### 7.6 İptal (Cancel)

Sayımı tamamlamadan iptal edersen tüm sayılan değerler kaybolur, hareket yazılmaz, sayım "cancelled" durumuna geçer.

> ⚠️ **Önemli:** Sayım **geri alınamaz** (sadece iptal edilebilir, o da tamamlamadan önce). Tamamlandı durumuna geldikten sonra "Tekrar Say" ile yeni bir sayım açabilirsin.

### 7.7 Yumuşak kilit (softLock)

> Bu özellik Faz 2'ye saklı. MVP'de sayım açıkken başka kullanıcılar normal satış yapabilir (yumuşak kilit otomatik aktif). Sistem stoğu güncellenir, sayım listesi anlık yenilenir.

---

## 8. Düşük Stok

URL: `/admin/low-stock`

"Şimdi ne sipariş etmeliyim?" sorusunun cevabı.

### 8.1 Üst KPI

```
🔴 Kritik: 2    🟠 Yakında: 5    ⛔ Tükendi: 1
```

KPI'lar tıklanabilir → filtre uygular.

### 8.2 Liste

Variant bazında gruplanır (aynı variant farklı şubelerde farklı satırlar olur). Her satırda:

| Bilgi | İçerik |
|---|---|
| Ürün | Ad + SKU + tedarikçi + son alım |
| Şube | Şube adı (multi-branch için) |
| Mevcut/Eşik | `2 / 10` formatında (kritiklik dot) |
| Eksik | `eşik − mevcut` |
| Önerilen sipariş | `(eşik × 2) − mevcut` formülü |
| Birim alış | Son alış fiyatı |

Sıralama: Tükendi → Kritik → Yakında → eksiklik miktarına göre azalan.

### 8.3 Hızlı aksiyonlar

Her satırda hover ile aksiyon ikonları:

- **👁 Detay** → Ürün detay sayfası
- **📥 Stok Girişi** → Drawer pre-filled (önerilen miktar + son tedarikçi)
- **🔄 Transfer** → Multi-branch tenant'lar için: başka şubeden transfer önerisi

### 8.4 Transfer önerisi panel

Bir variant bir şubede fazla, başkasında eksikse sistem otomatik öneri yapar:

```
Düşük stok variantları için 3 öneri var:
• Royal Canin 2kg: Önerilen transfer Şube B → Merkez +5 adet [Aç]
• Whiskas 400g: Önerilen transfer Şube A → Merkez +3 adet [Aç]
• Pro Plan 15kg: Önerilen transfer Merkez → Şube B +2 adet [Aç]
```

**[Aç] butonu** Transfer drawer'ı önceden doldurulmuş halde açar — sen sadece onaylarsın.

### 8.5 Empty state

Hiç düşük stok yoksa: "✓ Tüm stoklar yeterli — kedi de köpek de mutlu!" mascot kartı görünür.

---

## 9. Şubeler (Branch'ler)

URL: `/admin/branches`

Tenant'ın şubelerini yönetir.

### 9.1 Liste — kart grid

Her şube bir kart olarak görünür:

```
┌──────────────────────────┐
│ Merkez                    │
│ [🟢 Aktif]                │
│ 📍 İstanbul / Kadıköy     │
│ 📞 +90 532 1234567        │
│                           │
│ 47 variant · 1247 stok    │
│ [Detay →]                 │
└──────────────────────────┘
```

### 9.2 Şube ekleme

`/admin/branches/new` — form:

| Alan | Açıklama |
|---|---|
| Şube adı | Zorunlu, 2-100 karakter |
| İl | 81 il dropdown |
| İlçe | İl seçildikten sonra otomatik yüklenir (974 ilçe) |
| Açık adres | Opsiyonel textarea |
| WhatsApp | `+90` veya `0` ile başlamalı (regex doğrulaması) |

#### Plan limiti

- **FREE plan:** Sadece 1 şube (ek şube ekleyemezsin)
- **PRO ve PRO+:** Sınırsız şube

FREE plan'da `/admin/branches/new` açtığında "⭐ PRO ÖZELLİĞİ" paneli görünür + "Mevcut: 1 / 1 şube" + "PRO'ya geç" CTA.

### 9.3 Şube durum (3-state)

Her şube 3 durumdan birinde olabilir:

| Durum | Anlam | Vitrin etkisi |
|---|---|---|
| 🟢 **Aktif** | Normal çalışıyor | Vitrin'de görünür, satış kabul ediyor |
| 🌴 **Tatilde** | Geçici kapalı | Vitrin'de "Bu şube tatilde" banner, WhatsApp butonu disabled |
| 🔴 **Pasif** | Kapatıldı, transfer yok | Vitrin'de **görünmez (404)**, stok donar |

#### Son aktif şube koruması

Tenant'ın **en az 1 aktif şubesi** olmalı — son aktif şubeyi tatile veya pasife alamazsın. "Son aktif şube — pasifleştirilemez" hatası alırsın.

### 9.4 Şube detay

`/admin/branches/[id]` — 4 KPI + variant matrix + son hareketler + ekip kartı:

```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Variant  │ │ Toplam  │ │ Bugünkü │ │ Düşük   │
│ sayısı   │ │ stok    │ │ satış   │ │ stok    │
│ 47       │ │ 1247    │ │ ₺2840   │ │ 5       │
└─────────┘ └─────────┘ └─────────┘ └─────────┘

Variant stoğu tablosu (şubedeki tüm ürünler)
Son 8 hareket
Ekip kartı (müdür + çalışanlar listesi)
```

### 9.5 Şube düzenleme

`/admin/branches/[id]/edit` — il, ilçe, adres, WhatsApp değiştirilebilir. İl değiştirilirse ilçe seçimi sıfırlanır.

### 9.6 Şube ekleme wizard step 2: Çalışan ekle

Yeni şube ekledikten sonra ikinci adımda **"Bu şubeye çalışan ekle"** seçeneği görünür:

```
Şube oluştu ✓
Şimdi bir çalışan eklemek ister misin?

○ Şube müdürü ekle (e-posta davet — 7 gün geçerli)
○ Kasiyer ekle (link davet — 24 saat geçerli)
○ Sonra eklerim
```

Detay: §17 Kullanıcılar ve Yetki.

---

## 10. Tedarikçiler

URL: `/admin/suppliers`

Pet shop'unun mal aldığı firmaları yönetir.

### 10.1 Liste

Tablo kolonları:

| Kolon | İçerik |
|---|---|
| Ad | Firma + iletişim kişisi |
| VKN | Vergi numarası |
| Telefon | İletişim |
| E-posta | İletişim |
| Lead gün | Tedarik süresi (sipariş → teslim) |
| Ödeme tipi | 💵 Peşin / 📆 30 gün / 📆 60 gün / ➕ Diğer |
| Toplam giriş | Şimdiye kadar bu tedarikçiden gelen toplam adet |
| Durum | Aktif / Pasif |

### 10.2 Yeni tedarikçi

`/admin/suppliers/new` — 4 bölümlü form:

#### Bölüm 1: Firma

- **Tedarikçi adı** (zorunlu, 2-100 karakter)
- **VKN** (opsiyonel, 10 veya 11 hane)
- **Vergi dairesi** (opsiyonel)

#### Bölüm 2: İletişim

- **İletişim kişisi** (opsiyonel)
- **Telefon** (`+90` veya `0` prefix)
- **E-posta** (geçerli format)
- **İl** (dropdown 81 il)
- **Adres** (opsiyonel)

#### Bölüm 3: Ticari koşullar

- **Lead time (gün):** Sipariş verince kaç günde teslim eder (0-365)
- **Ödeme tipi:**
  - 💵 Peşin (cash)
  - 📆 30 gün (net 30)
  - 📆 60 gün (net 60)
  - ➕ Diğer
- **IBAN** (opsiyonel, TR + 24 hane regex doğrulaması)

#### Bölüm 4: Not

Serbest metin — dahili not.

### 10.3 Tedarikçi düzenleme + silme

Aynı form ile düzenle. Tedarikçiyi tamamen silemezsin (stok girişlerinde referans var) — sadece pasif yaparsın. Pasif tedarikçi Stok Girişi drawer dropdown'unda görünmez ama geçmiş hareketler korunur.

### 10.4 Stok Girişi drawer'ında tedarikçi seçimi

Stok Girişi yaparken **Tedarikçi** alanı autocomplete'i tüm aktif tedarikçilerden çeker. Listede yoksa "+ Yeni Tedarikçi" inline modal ile hızlı ekleyebilirsin (ad + telefon minimum, sonra detayları tedarikçi sayfasından doldurursun).

---

## 11. Müşteriler ve Veresiye

### 11.1 Müşteri kavramı

PetStockPro müşteri tablosu tutmaz (Faz 2'de eklenir). Bunun yerine **müşteri referansı** olarak serbest text kullanırsın:

- "Ahmet Y. 0532 1234567"
- "Anonim müşteri"
- "Veresiye - Ayşe K. 0535 9876543"

Bu metin satışta `customer_ref` alanına yazılır.

### 11.2 Veresiye satış

Stok Çıkışı drawer'da ödeme tipi olarak **"Veresiye"** seçtiğinde:

- **Müşteri referansı zorunlu** olur (boş bırakılamaz)
- Sistem "Veresiye satışta müşteri zorunlu" hatası verir
- Önerilen format: Ad + telefon ("Ahmet Y. 0532 1234567")

### 11.3 Açık krediler raporu (PRO özelliği)

`/admin/reports` → "Açık Krediler" bölümü.

Aşağıdaki tabloyu görürsün:

```
Açık krediler (toplam ₺3.420, 12 açık kredi):

Müşteri (ref)            Tarih         Tutar    Gün
Ayşe T. · 0532***1234   28 Nis 2026  ₺250     16
Veresiye - Anonim        12 Nis 2026  ₺420     32
Mehmet K. · 0535***5678  03 Nis 2026  ₺180     41
...
```

#### Aging band

```
0-15 gün:   ₺520   (3 kayıt) — yeni
16-30 gün:  ₺1.450 (4 kayıt) — orta
31-60 gün:  ₺1.250 (4 kayıt) — eski
60+ gün:    ₺200   (1 kayıt) — riskli (kırmızı uyarı)
```

#### Krediyi Kapama

Her satırda **"Krediyi Kapama"** butonu. Tıklayınca:

1. `credit_paid_at = NOW()` set edilir
2. Audit log'a kayıt düşer
3. Rapor listesinden çıkar (artık ödendi)

### 11.4 Top müşteriler raporu

PRO+ rapor — en çok harcayan müşteriler listesi (customer_ref bazında grupla, toplam ciro sıralı).

### 11.5 Saat-bazlı satış (busiest hours)

Heatmap olarak hangi saatlerde en çok satış yapıldığını gösterir. Personel planlaması için faydalı.

---

## 12. Raporlar

URL: `/admin/reports`

PRO ve PRO+ özelliği. FREE plan'da bu sayfa "⭐ PRO ÖZELLİĞİ" paneli + 7 madde özellik listesi gösterir.

### 12.1 Üst bar

```
Periyot: [7 gün] [30 gün] [90 gün] [Özel]
[⬇ Toplu xlsx]
```

### 12.2 4 KPI (üst şerit)

| KPI | Anlam |
|---|---|
| Toplam adet | Seçili periyotta satılan toplam adet |
| Toplam ciro | Seçili periyotta toplam satış cirosu |
| Satış sayısı | Kaç satış işlemi yapıldı |
| Ortalama sepet | Ciro / satış sayısı |

### 12.3 Dönem karşılaştırma

```
Bu hafta vs geçen hafta:    ▲ +%18 (₺38.500 → ₺45.430)
Son 30g vs önceki 30g:      ▼ -%5  (₺182k → ₺173k)
```

### 12.4 En çok satan variant'lar (top 10)

```
1. Royal Canin 2kg          180 adet · ₺45.000
2. Whiskas 400g Sığır       145 adet · ₺1.740
3. Pro Plan 15kg             89 adet · ₺75.650
...
```

### 12.5 Günlük breakdown bar grafik

Son 30 günün günlük ciro dağılımı (yatay bar chart).

### 12.6 Stocktake history

Tamamlanan sayımların listesi (tarih, şube, fark sayısı, değer etkisi).

### 12.7 Audit aktivite grafiği

Action tipine göre aktivite sayısı (örn. "stok girişi 87 kez", "satış 134 kez", "ürün güncelleme 12 kez").

### 12.8 Envanter değeri trendi

Anlık envanter değeri (cost × stock) + kategori bazlı dağılım + top variants.

### 12.9 Açık krediler rapor section

§11.3'te detaylı.

### 12.10 Xlsx export

Sağ üstte **"⬇ Toplu xlsx"** butonu — tüm raporları tek dosyada (her rapor ayrı sheet) indirir. Excel için zengin format: TR header, dd/mm/yyyy locale, ₺ para formatı, otomatik filtre, freeze pane, zebra satırlar.

> 💡 FREE plan tenant'lar Pano + temel KPI ile yönetir. Detaylı analitik için PRO'ya geçmen gerekir.

---

## 13. Vitrin — Sahip Tarafı (Storefront Yönetimi)

### 13.1 Vitrin nedir?

PetStockPro merkezi tek bir vitrin sunar: `petstockpro.com/vitrin`. Tüm pet shop'lar burada eşit görünürlükte yer alır (Sahibinden / Yelp modeli). Bir müşteri Google'da "Royal Canin Kedi Mama Üsküdar" arar → senin pet shop'un vitrin'de çıkar → tıklar → WhatsApp deep link ile sana yazar.

**Önemli:** PetStockPro **müşteri-pet shop arası para akışına ASLA dahil olmaz.** Müşteri sana WhatsApp'tan ulaşır, satışı kapıda nakit/kart/havale/kargo ile yaparsın. Komisyon yok, sepet yok, online ödeme yok.

### 13.2 Vitrin'i aktive et

Ayarlar → **Vitrin Profili** sekmesinde:

```
☑ Merkezi vitrin'de görün (master switch)
   Süperadmin onay durumu:  ⏳ Bekleyen / ✅ Onaylı / ❌ Reddedildi

Vitrin slug         [mavi-pet-shop]
                    → petstockpro.com/vitrin/magaza/mavi-pet-shop
Logo                [Yükle]   (200×200, PNG/SVG, max 500KB)
Kapak fotoğrafı     [Yükle]   (1600×400, max 1MB)
Kısa açıklama       [textarea, 160 karakter]

İletişim:
   WhatsApp         [+90 532 xxx xxxx]
   Telefon          [0212 xxx xxxx]

Hazır WhatsApp mesajı:
   [textarea]
   Default: "Merhaba, PetStockPro'da gördüm. {ürün} stokta mı?"

Çalışma saatleri (Faz 2'ye saklı)

Stok visibility:
   ◉ Var/yok  ○ Tam sayı  ○ Gösterme
```

### 13.3 Vitrin durumu (5 state)

| Durum | Anlam |
|---|---|
| ⏸ **disabled** | Vitrin master switch kapalı |
| ⏳ **pending** | Onay bekleniyor (yeni başvuru) |
| ✅ **approved** | Onaylı, vitrin'de görünür |
| ❌ **rejected** | Süperadmin reddetti — sebep bildirilir |
| 🔒 **auto_suspended** | Otomatik askıya alındı (örn. çok şikayet, görsel sorunu) |

#### Otomatik onay

Validation pass eden başvurular **otomatik onaylanır** — süperadmin manuel onay yapmaz (1.000 tenant'a manuel onay imkansız). Sadece otomatik reddedilenler süperadmin'in "Manuel İnceleme" alt-sekmesine düşer.

### 13.4 Vitrin limit (plan bazlı)

3-tier B planlamasıyla (2026-05-22 Karar A revize):

| Plan | Vitrin'de gösterilebilecek ürün sayısı |
|---|---|
| **FREE** | **10 ürün** |
| **PRO** | **500 ürün** |
| **PRO+** | **Sınırsız** |

FREE plan'da 11. ürünü vitrin'e açmak istediğinde "Vitrin limitin doldu (10/10). PRO'ya yükselt" hatası alırsın.

### 13.5 Vitrin'e ürün açma (Satışa Aç toggle)

Detay: §5.5.

Özetle: Ürünler listesinde her satırın sağındaki toggle'ı aç → sistem 5 madde validation yapar → eksik varsa düzenle sayfasına yönlendirir → tamamsa anında vitrin'de yayında.

### 13.6 Stok 0 → otomatik çekme

Detay: §5.6.

Bir ürünün stoğu 0'a düştüğünde sistem onu otomatik vitrin'den çeker. Stok ekledikten sonra manuel olarak tekrar açmalısın.

### 13.7 Vitrin metrikleri

`/admin/settings/storefront/metrics` (veya Ayarlar → Vitrin → Metrikler alt-tab):

| KPI | Açıklama |
|---|---|
| 👁 Görüntüleme (home_view) | Ana sayfanın açılma sayısı |
| 🛍 Profil görüntüleme (profile_view) | Pet shop sayfanın açılma sayısı |
| 📦 Ürün görüntüleme (product_view) | Ürün detay sayfanın açılma sayısı |
| 📋 Listeleme görünme (listing_impression) | Liste/arama sonuçlarında görünme |
| 📞 WhatsApp tıklama | "WhatsApp ile İletişim" tıklama sayısı (en değerli metrik!) |
| 📈 Conversion | Görüntüleme → WhatsApp tıklama oranı |

#### Önemli kısıt

PetStockPro **WhatsApp butonuna tıklama** sayar — gerçek satış değil. "47 tıklama → 12 satış" karşılaştırmasını **kendi defterinden** yapacaksın.

### 13.8 WhatsApp deep link

Müşteri vitrin'de "WhatsApp ile İletişim" butonuna basınca:

```
https://wa.me/905321234567?text=Merhaba%2C%20PetStockPro%27da%20gördüm.%20...
```

- Müşterinin WhatsApp uygulaması (veya web) açılır
- Mesaj input'ta **önceden doldurulmuş** gelir
- Müşteri "Gönder" butonuna basar (kendisi)

**Biz mesajı görmüyoruz** — sadece deep link açıyoruz. WhatsApp Business API kullanmıyoruz (ücretsiz, hesap onayı yok, KVKK yok).

### 13.9 Hazır WhatsApp mesajı şablonu

Ayarlar → Vitrin Profili → "Hazır WhatsApp mesajı" textarea'sından özelleştirebilirsin. Değişkenler:

- `{ürün}` — Müşterinin tıkladığı ürün adı
- `{pet shop}` — Senin pet shop adın
- `{şehir}` — Pet shop'unun şehri

Default: `"Merhaba, PetStockPro'da gördüm. {ürün} stokta mı?"`

### 13.10 WhatsApp geri bildirim balonu (5 emoji)

Müşteri WhatsApp butonuna bastıktan sonra sağ alt köşede sticky bir balon görünür:

```
"İletişime geçtiğin için teşekkürler! Pet shop'la nasıldı?"

😊  🙂  😐  😕  😞
```

Tek tıklama = submit. Yorum yok (Faz 2'ye saklı). 1 IP × 1 tenant × 24 saat anti-spam.

Sen Ayarlar → Vitrin → "WhatsApp Geri Bildirimleri" panelinde:

- **Funnel:** WhatsApp tıklama → Submit → Manuel kapatıldı → Görmezden gelindi
- **Rating dağılımı** (5 emoji yüzdesi)
- **Türetilen metrikler:**
  - Ulaşma oranı (% — "Ulaşamadım" 5. emoji düşük olsun)
  - Memnuniyet (% — Çok iyi + İyi / ulaşanlar)
  - Ortalama puan (5 üzerinden)

---

## 14. Vitrin — Müşteri Tarafı (Public Storefront)

URL: `petstockpro.com/vitrin`

Burası **müşterilerin** gördüğü taraf — pet shop sahipleri sadece kendi profillerini buradan önizleyebilir.

### 14.1 Ana sayfa (`/vitrin`)

```
[Header: PetStockPro logo + Arama + İl dropdown + Pet shop sahibi misin? CTA]

[Hero: "Sevdiğin hayvanın ürününü en yakın pet shop'tan al"]
[Konum izni: 📍 Konumumu paylaş  veya  İl seç]

[Yakındaki pet shop'lar — harita + 4 kart] (konum varsa)
[Popüler ürünler 8 kart] (cross-tenant, son 7 gün view bazlı)
[Çok satanlar 8 kart] (cross-tenant, son 30 gün satış bazlı)
[Şehir grid: İstanbul, Ankara, İzmir, Bursa, Antalya, Adana]
[Kategori chip: 🥩 Mama, 🦴 Aksesuar, 🛁 Bakım, 🎾 Oyuncak, 💊 Sağlık, 🏠 Kafes]

[Pet shop sahibi misin? CTA → /register (FREE 50 ürünle başla)]
```

#### Konum tespiti

3 katmanlı:

1. **URL'den** (en kesin) — müşteri `/vitrin/istanbul/uskudar` yazdıysa
2. **Browser Geolocation API** — kullanıcı izniyle koordinat
3. **IP fallback** — şehir seviyesi tahmin

#### "Yakındaki pet shop'lar" sıralaması

Mesafe %40 + Stok ✓ %25 + Son güncelleme %15 + Profil tamlığı %10 + Üye yaşı %10. "Neden bu sırada?" linki algoritmayı açıklar (şeffaflık).

### 14.2 Arama (`/vitrin/ara`)

```
[Arama formu: Ürün/marka ara + İl + Kategori dropdown]

[Aktif filtre chip'leri — tek tıkla kaldır]

[Sonuçlar grid — her kart: ürün + variant + fiyat + pet shop + city/district + WhatsApp]
[Sayfalama]
```

Empty states:

- `empty-no-query` — "Aramaya başlamak için bir şey yaz"
- `empty-no-result` — "X için sonuç bulunamadı"

### 14.3 İl/ilçe sayfa

URL: `/vitrin/[il]` veya `/vitrin/[il]/[ilce]`

İstanbul / Üsküdar gibi belirli bir lokasyondaki pet shop'lar + ürünleri.

### 14.4 Kategori sayfa

URL: `/vitrin/kategori/[slug]` (örn. `/vitrin/kategori/mama`)

Cross-tenant tüm pet shop'ların ilgili kategorideki ürünleri.

### 14.5 Marka sayfa

URL: `/vitrin/marka/[slug]` (örn. `/vitrin/marka/royal-canin`)

Cross-tenant — birden fazla pet shop bu markayı satıyorsa hepsi listelenir.

### 14.6 Ürün detay sayfası (cross-tenant kıyaslama!)

URL: `/vitrin/urun/[slug]`

```
[Galeri (sol) + Ürün bilgi (sağ)]

[Pet shop kıyaslama tablosu — sıralı: en iyi seçim önde]
Pet Shop           │ Mesafe │ Stok    │ Fiyat │ İletişim
Mavi Pet (Üsküdar) │ 1.2 km │ ✓ Var   │ ₺250  │ [📞 WhatsApp]
Pati Shop (Kdk)    │ 3.5 km │ ⚠ Az(2) │ ₺245  │ [📞 WhatsApp]
Mama Dünyası       │ 8.1 km │ ⛔ Yok  │ ₺260  │ —

[Tek satıcı varsa: "Bu ürünü sadece 1 pet shop satıyor — fiyat" notu]

[Aynı kategoriden öneriler 4 kart]
[🚩 Şikayet butonu]
```

#### Şeffaflık: "Neden bu sırada?"

Sıralama algoritmasını gösterir (mesafe + stok + güncellik + profil tamlığı + üye yaşı). Müşteri açıp inceleyebilir.

### 14.7 Pet shop profili (`/vitrin/magaza/[slug]`)

```
[Storefront hero — kapak + logo + pet shop adı + WhatsApp CTA]
[Holiday banner (Faz 8 — eğer tüm aktif şubeler tatildeyse)]

[Pet shop hakkında + iletişim bilgileri 3 kolon]

[Ürünler section — marka bazlı grupla + brand anchor nav]
Royal Canin (12 ürün) →
Whiskas (8 ürün) →
Pro Plan (5 ürün) →

[Her ürün kart: görsel + ad + variant + fiyat + WhatsApp]
```

### 14.8 Şikayet butonu (🚩)

Her ürün/pet shop sayfasında 🚩 "Şikayet et" butonu. Müşteri:

- "Yanlış fotoğraf"
- "Yanıltıcı fiyat"
- "Stokta yok dedi ama gösteriyor"
- "Diğer (textbox)"

Şikayet eden müşterinin IP'si 30 gün anti-spam tutulur. 3 farklı IP'den "wrong_photo" → ürün görsel otomatik gizlenir + süperadmin Manuel İnceleme'ye düşer.

### 14.9 KVKK çerez banner

İlk ziyarette altta opt-in çerez banner görünür (analytics çerezi için). Reddedersen sadece zorunlu çerezler aktif kalır. GDPR cookie banner **yok** (TR-only, sadece KVKK).

### 14.10 Konum izni opsiyonel

Konum vermek **zorunlu değil**. Vermezsen "Yakındaki pet shop'lar" yerine "Türkiye'deki pet shop'lar" başlığıyla genel popüler listelerden başlarsın.

---

## 15. Plan ve Fatura

### 15.1 Plan tablosu (3-tier B — TR-only)

> **Karar tarihi: 2026-05-22 (Karar A revize) — Pricing tarihi: 2026-05-21 (son revize)**

| Özellik | FREE | PRO | PRO+ |
|---|:---:|:---:|:---:|
| **Stok limiti** | 50 ürün | 500 ürün | Sınırsız |
| **Vitrin limiti** | 10 ürün | 500 ürün | Sınırsız |
| **Şube sayısı** | 1 şube | Sınırsız | Sınırsız |
| **Excel ürün import** | ❌ Manuel only | ✅ | ✅ |
| **Gelişmiş raporlar** | ❌ Pano + temel KPI | ✅ Tam Raporlar | ✅ |
| Variant sistemi | ✅ | ✅ | ✅ |
| Vitrin (merkezi) | ✅ (10 ürün limit) | ✅ | ✅ |
| WhatsApp deep link | ✅ | ✅ | ✅ |
| Vitrin metrikleri | ✅ | ✅ | ✅ |
| Satışa Aç toggle + Doğrula | ✅ | ✅ | ✅ |
| Otomatik vitrin çekme (stok 0) | ✅ | ✅ | ✅ |
| Stok hareketleri ledger | ✅ | ✅ | ✅ |
| Sayım workflow | ✅ | ✅ | ✅ |
| Geri alma 24 saat | ✅ | ✅ | ✅ |
| Transfer (multi-branch) | — (1 şube) | ✅ | ✅ |
| PetPro Asistan | ✅ | ✅ | ✅ |
| Düşük stok + transfer önerisi | ✅ | ✅ | ✅ |
| 2FA TOTP | ✅ | ✅ | ✅ |
| Audit log | ✅ | ✅ | ✅ |
| Kullanıcı sayısı | ∞ | ∞ | ∞ |
| Telegram bildirim | ✅ | ✅ | ✅ |
| Nilvera e-Arşiv | ✅ (önkoşullu) | ✅ | ✅ |
| KVKK veri export (xlsx) | ✅ | ✅ | ✅ |
| **Aylık fiyat** | **0 ₺** | **1.000 ₺** | **2.000 ₺** |

Fiyatlar **KDV dahil** (2026 KDV oranı %20).

### 15.2 Pricing tarihçesi

| Tarih | Karar | Pricing |
|---|---|---|
| Faz 1 §7 | Legacy 50/200/∞ | — |
| 2026-05-12 | 20/100/∞ 3-tier | İptal |
| 2026-05-13 | 50/∞ 2-tier (PRO+ rafa) | İptal |
| 2026-05-14 | 3-tier B (TR-only) | 750 / 1.750 ₺ |
| 2026-05-20 Karar C | Fiyat artırma | 1.250 / 2.250 ₺ |
| **2026-05-21 (son revize)** | "Fiyat artırmayalım" | **1.000 / 2.000 ₺** |

### 15.3 PRO'ya nasıl geçerim?

**MVP (manuel):**

1. Ayarlar → Plan + Fatura → "PRO'ya Yükselt" tıkla
2. IBAN bilgisi modal'da görünür
3. Havale yap + dekont yükle
4. Süperadmin onaylar → plan **anında aktif**

**Faz 2 (otomatik — iyzico Subscription):**

1. "PRO'ya Yükselt" → iyzico hosted checkout açılır
2. Kart bilgisi gir → 3D Secure doğrulama (banka SMS)
3. Başarılı → webhook ile plan anında aktif
4. Aylık otomatik tahsilat (iyzico tarafı, sen müdahale etmezsin)

### 15.4 3D Secure ödeme

Tüm kart işlemleri 3D Secure ile yapılır (zorunlu).

- Bankan SMS'le doğrulama kodu gönderir
- Yanlış kodda 3 deneme hakkın var
- Kart limit / blokeli ise iyzico reddeder
- Kart bilgisi **bize hiç gelmez** (iyzico hosted, PCI DSS bizim sorumluluğumuz değil)

### 15.5 Plan iptal

Ayarlar → Plan + Fatura → "⛔ Aboneliği Sonlandır":

1. İki onay sorulur
2. **Dönem sonuna kadar** plan aktif kalır
3. Dönem bitince otomatik FREE'ye düşer
4. Veriler korunur (90 gün geri açma mümkün)

#### Plan düşmesi sonrası limit aşımı

PRO+ (∞) → PRO (500) düşersen:

- 500'den fazla ürün "Pasif modda" görünür
- 30 gün içinde hangilerini aktif tutmak istediğini seçersin
- Seçim yapmazsan sistem en yeni 500 ürünü aktif tutar

### 15.6 Cayma hakkı (14 gün)

Tüketici mevzuatı uyarınca abonelik için **14 gün cayma hakkın** vardır. İlk abonelik kaydından sonra 14 gün içinde iptal edersen tam iade alırsın. 14 gün sonrası iptal **dönem sonuna kadar aktif** kalır (oransal iade yok).

### 15.7 E-Arşiv fatura (Nilvera)

PetStockPro Türkiye yasal e-Arşiv entegratörü Nilvera ile entegre. Senin abonelik faturaların:

- Otomatik kesilir
- Müşterine (sana) PDF link e-postasıyla gelir
- Maliye'ye GİB sistemine iletilir
- Ayarlar → Plan + Fatura → "Faturalarım" listesinde geçmiş PDF'leri görebilirsin

#### Senin satışlarının e-Arşiv kesilmesi (önkoşullu)

Eğer **kendi satışların için** e-Arşiv kesmek istersen:

1. **Vergi mükellefi olmak** — şirket veya şahıs şirketi
2. **Mali mühür sertifikası** — TÜBİTAK Kamu SM (~750 ₺/yıl)
3. **GİB e-Arşiv başvurusu** — gib.gov.tr üzerinden (1-2 hafta onay)
4. **Nilvera kontör paketi** — kullanım başına ücret

Bu şartları sağladıysan Stok Çıkışı drawer'ında "E-Arşiv fatura kes" toggle'ı açılabilir. Sağlamadıysan toggle disabled — onboarding modal şartları açıklar.

### 15.8 Vergi numarası zorunluluğu

Vergi no sadece şu durumda zorunludur:

- Ürünleri **vitrin'de satışa açmak** istiyorsan ("Satışa Aç" toggle tetikleyici)
- **PRO veya PRO+ planına geçmek** istiyorsan (fatura için)

Sadece stok takip için kullanan tenant'a vergi no zorunlu değil. Hesabın asla otomatik askıya alınmaz.

---

## 16. Ayarlar

URL: `/admin/settings`

Sol sidebar 9 link (SettingsShell):

```
📊 Genel Bakış
🏢 Firma Bilgileri
🌐 Vitrin Profili
👥 Kullanıcılar
🔔 Bildirimler (Telegram)
👤 Hesap
🔒 Güvenlik
📜 Audit Log
⬇ Verilerimi İndir
```

### 16.1 Genel Bakış

4 durum kartı (StatusCard):

- **Firma:** VKN dolu mu, eksik mi
- **Hesap:** pendingEmail var mı (e-posta değişimi bekliyor mu)
- **2FA:** Aktif mi, pasif mi
- **Plan:** Mevcut plan + kalan limit

4 veri linki (DataLink): Kategori sayısı, marka sayısı, şube sayısı, tedarikçi sayısı.

### 16.2 Firma Bilgileri

```
Logo                [yüklenmiş logo preview] [Değiştir]
                    Max 500KB · PNG/SVG · 200×200+

Şirket adı *        [Mavi Pet Shop A.Ş.]
Yasal unvan         [Mavi Hayvan Bakım Ürünleri Tic. Ltd. Şti.]

Vergi numarası      [1234567890]
                    10 hane VKN | 11 hane TC (şahıs şirketi)
                    ⚠ Vitrin için zorunlu, stok takip için opsiyonel

Vergi dairesi       [Kadıköy Vergi Dairesi]

İl                  [İstanbul ▼]
İlçe                [Kadıköy ▼]   (il'e bağlı cascade)
Açık adres          [textarea]

İletişim:
Telefon             [0212 xxx xx xx]
E-posta             [info@mavipet.com]
WhatsApp            [+90 532 xxx xxxx]
```

İlk kez vergi numarası eklendiğinde `vatRequiredAt = NOW()` set edilir (Satışa Aç validation gate ile bağlantılı).

### 16.3 Vitrin Profili

§13.2'de detaylı.

### 16.4 Kullanıcılar

§17'de detaylı.

### 16.5 Bildirimler (Telegram)

```
Telegram Bot Bağlama (3 adım):

1. Telegram'da @PetStockProBot'u aç → /start yaz
2. Bot sana 6 haneli kod verir (örn. PSP-487293)
3. Buraya gir: [______]   [Doğrula]

Bağlı bot: ✅ @PetStockProBot (Ahmet Pet Shop)

Bildirim tipleri:
☑ Düşük stok uyarısı (eşik altına düşünce)
☑ Stok 0 — vitrin'den otomatik çekme
☑ Yeni satış (her satış)
☐ Transfer tamamlandı
☑ Sayım tamamlandı
☑ Plan limit yaklaşıyor (%80)
☑ Plan tahsilat başarısız
☑ Yeni vitrin şikayeti (vitrin_reports)
☑ Hesap güvenlik (2FA kapatıldı, email değişti, vs.)
```

### 16.6 Hesap

E-posta değişimi (§2.5).

### 16.7 Güvenlik

- 2FA aktive et / kapat
- Recovery kodları yenile
- Aktif oturumlar listesi + kapatma
- Son giriş geçmişi (IP, cihaz, lokasyon)

### 16.8 Audit Log

`/admin/audit-log` — tüm sistem aktivitelerinin kaydı.

#### Filtre

- Action tipi (26 farklı action — stok girişi, ürün düzenleme, vs.)
- Entity (product, stock_movement, branch, vs.)
- Kullanıcı
- Tarih aralığı

#### Görünüm

Tabloda her satır:

```
07 May 14:32  📥 Stok girişi  Ahmet  Royal Canin 2kg (+24)  [Göster JSON]
07 May 14:25  📝 Ürün düzenle  Zeynep  Whiskas 400g  [Göster JSON]
07 May 13:45  🔓 Login  Ahmet  IP 78.187.x.x · Chrome 130/Win11
```

"Göster JSON" — afterState detaylarını açar (before/after değerleri).

Süperadmin tarafından yapılan aksiyonlar 🚨 işaretli görünür.

### 16.9 Verilerimi İndir (KVKK Madde 11)

KVKK veri taşıma hakkın gereği — verilerini istediğin zaman xlsx olarak indirebilirsin:

7 xlsx export route:

1. **Ürünler** (`.xlsx` zengin format, 12 sütun)
2. **Stok hareketleri** (filtre URL param)
3. **Şubeler**
4. **Tedarikçiler**
5. **Satış raporu (Günlük breakdown)**
6. **Top selling variantlar**
7. **Audit log**

Excel formatı: TR header, dd/mm/yyyy locale, ₺ para formatı, otomatik filtre, freeze pane, zebra satırlar.

> 💡 Marka ve kategori export'ları yoktur (bunlar sistem genelinde sabit veridir).

---

## 17. Kullanıcılar ve Yetki

URL: `/admin/settings/users`

### 17.1 Roller

3 ana rol:

| Rol | Türkçe etiket | Yetki |
|---|---|---|
| **BAYI_SAHIBI** | Bayi Admin | Tüm sistem yetkisi, üst yönetim |
| **OBSERVER** | İzleyici | Read-only; tüm tenant'ı görür ama hiçbir aksiyon yapamaz |
| **STAFF** | Çalışan | Sınırlı yetki, kendi şubesi için 3 default ON aksiyon (satış kaydet, variant gör, müşteri ref yaz) + 12 OFF (admin tarafından ayrı ayrı açılabilir) |

#### Bayi Admin (sahip)

Tek bir bayi admin olur (kayıt sahibi). Tüm yetki.

#### İzleyici (Observer)

İzleme amaçlı: Muhasebeci, dış danışman, ortak vs. için. Tüm verileri görür ama:

- Stok girişi yapamaz
- Satış kaydedemez
- Ürün ekleyemez/değiştiremez
- Vitrin açıp kapatamaz
- Sayım yapamaz

Top bar'da "🔍 İzleyici" rozeti + sticky banner görünür. Her UI sayfasında aksiyon butonları gizli olur.

#### Çalışan (Staff)

Tipik kasiyer kullanıcı. Default 3 yetki ON:

| Yetki | Açıklama |
|---|---|
| `sale.create` | Satış kaydedebilir (Stok Çıkışı drawer) |
| `variant.view` | Variant detayını görebilir |
| `customer_ref.write` | Müşteri referansı yazabilir |

12 ek yetki OFF (admin "Permissions" modal'dan açabilir):

- Stok girişi
- Transfer yap
- Sayım katıl
- Sayım tamamla
- Ürün düzenle
- Vitrin yönet
- Veresiye satış
- Müşteri ödemesi kapama (credit settle)
- Düşük stok eylem
- Tedarikçi yönet
- Raporlar gör
- Audit log gör

### 17.2 Davet hibrit (Email veya Link)

Yeni kullanıcı eklemek için 2 yöntem:

#### 📧 Email daveti (varsayılan)

- Brevo SMTP ile otomatik e-posta gönderilir
- 7 gün geçerli
- Aktif personel (şube müdürü) için ideal
- Davet alan kişi: link tıklar → ad-soyad + şifre belirle → hesap aktif

#### 🔗 Link daveti (yeni)

- Sistem 12 haneli token + URL üretir
- 24 saat geçerli
- Email gönderme yok
- Sen URL'yi WhatsApp/SMS ile çalışana iletirsin
- Çalışan: link tıklar → ad-soyad + şifre belirle (+ opsiyonel e-posta düzeltme)
- Kasiyer için ideal (email kullanmayanlar)

#### Davet formu

```
E-posta *    [ahmet@petshop.com]

Rol *        ◉ Bayi sahibi
             ○ Şube müdürü (eski OBSERVER yerine kullanılan eski isim)
             ○ Kasiyer (STAFF)

Şube         [Merkez ▼]   (müdür/kasiyer için)

Davet yöntemi *
◉ 📧 E-posta gönder (7 gün)
○ 🔗 Davet linki üret (24 saat)

Davet mesajı (opsiyonel)
[textarea — sadece email'de geçer]

[İptal]  [Davet Oluştur]
```

### 17.3 Yetki modal (15 toggle)

Bir çalışanın yetkilerini değiştirmek için "Yetki" butonuna tıkla. 15 toggle açılır:

```
✓ Satış kaydedebilir (default ON)
✓ Variant detayı görebilir (default ON)
✓ Müşteri ref yazabilir (default ON)
☐ Stok girişi yapabilir
☐ Transfer yapabilir
☐ Sayım katılabilir
☐ Sayım tamamlayabilir
☐ Ürün düzenleyebilir
☐ Vitrin yönetebilir
☐ Veresiye satış yapabilir
☐ Müşteri ödemesi kapatabilir
☐ Düşük stok aksiyonu alabilir
☐ Tedarikçi yönetebilir
☐ Raporlar görebilir
☐ Audit log görebilir
```

### 17.4 Şube ataması

- **Bayi Admin:** Şube ataması yok (tüm şubeler)
- **İzleyici:** Şube ataması yok (tenant geneli)
- **Çalışan (STAFF):** Bir şubeye ZORUNLU atanır (kendi şube hareketlerini görür)

### 17.5 Kullanıcı durumları

| Durum | Anlam |
|---|---|
| `invited` | Davet bekliyor (yeşil/sarı badge) |
| `active` | Aktif kullanıcı |
| `inactive` | Pasif (giriş yapamaz) |
| `expired_invite` | Davet süresi doldu (kırmızı badge + "Yeniden Davet" butonu) |

### 17.6 Hard delete YOK

Kullanıcıları silemezsin (audit log + stok hareketlerinde referans var). Sadece **"Pasif yap"** edebilirsin.

#### Kendini pasif yapamazsın

Backend gate: Kullanıcı kendi hesabını pasif yapamaz (UI'da buton disabled).

---

## 18. Süperadmin (Sahibinden kısa bilgi)

> Bu bölüm sadece bilgi amaçlı — süperadmin paneli pet shop sahibinden gizlidir, sadece PetStockPro yöneticisi (sahibi) erişebilir.

### 18.1 Felsefe

Süperadmin **operasyonel müdür değil**, PetStockPro sahibinin **kişisel kontrol + müdahale paneli**. 1.000 tenant'a manuel destek imkansız — sistem self-service tasarlanır, süperadmin sadece kritik müdahaleler için.

### 18.2 URL yapısı

Süperadmin için **ayrı login yok, ayrı subdomain yok**. Aynı `/admin` URL'i ama:

- Eğer hesabın SUPERADMIN rolündeyse sidebar'da ek menüler görünür
- Pet shop kullanıcıları bu menüleri **görmez**

### 18.3 Süperadmin özellikleri (özet)

| Özellik | Açıklama |
|---|---|
| **Tenant izleme** | 50 tenant satır + 8 KPI (toplam aktif, FREE/PRO oranı, kayıt akışı, vs.) |
| **Vitrin moderation** | Otomatik onay + manuel inceleme alt-sekmesi (sadece otomatik reddedilenler düşer) |
| **Errors paneli** | Sistem hatalar (90 gün retention, PII strip, threshold burst alert) |
| **DB Inspector** | Read-only SQL query (audit'lı) |
| **6 Bypass aksiyon** | Hard delete / plan override / negatif stok / reverse expired / stocktake undo / metadata fix |
| **Toolbox FAB** | Sağ alt sticky 4 kategori yetki (bypass / DB fix / sistem config / uzak kullanıcı) |
| **Tenant'a girme** | Impersonation — "ekrandan bakıp yardım et" (audit'lı, 🚨 işaretli) |

---

## 19. Sık Sorulan Sorular (SSS)

### 19.1 Hesap soruları (10 soru)

#### "Şifremi unuttum, ne yapayım?"

`/forgot-password` sayfasına git, e-postanı gir, Turnstile doğrulamasını yap, "Sıfırlama Bağlantısı Gönder" tıkla. Hesabın kilitli olsa bile bu akış çalışır.

#### "2FA kapanırsa nasıl giriş yaparım?"

Önce normal şifrenle dene → 2FA istenirse "Recovery code kullan" linkine tıkla → 8 karakterli recovery kodlarından birini gir. Recovery kodları tek kullanımlıktır.

#### "Recovery kodlarımı kaybettim, ne yapayım?"

`/admin/security` → "Recovery Kodları Yenile" — TOTP doğrulaması yaparak yeni 8 kod üretirsin. Eskileri otomatik silinir.

#### "Telefonumu kaybettim ve recovery kodum yok, ne yapayım?"

Bu çok kritik bir durumdur. PetStockPro destek ekibine (`info@petstockpro.com`) ulaş. Kimlik doğrulama sonrası (kayıt sırasındaki e-posta, son giriş bilgileri vs.) süperadmin 2FA'yı kapatabilir.

#### "E-posta değiştirmek istiyorum, eski hesabım kaybolur mu?"

Hayır — sadece e-posta değişir, hesap aynı kalır. `/admin/account` → yeni e-posta + şifre → çift onay akışı (yeni e-postaya doğrulama + eski e-postaya bilgi). Yeni e-postadaki linke tıklarsan değişim kesinleşir.

#### "Hesabım kilitlendi, kaç saat beklemem gerek?"

İlk 5 yanlış denemede 1 saat kilitlenir. 24 saat içinde 3 kez art arda kilitlenirsen 24 saat kalıcı kilit aktiftir. Süre dolunca otomatik açılır. "Şifremi Unuttum" akışı her durumda lock'u bypass eder.

#### "Kalan hak banner ne demek?"

3. yanlış şifre denemesinden itibaren formda banner görünür: "3 hakkın kaldı", "2 hakkın kaldı", "1 hakkın kaldı". Bir sonraki yanlış denemen hesabı kilitler. Şifreyi hatırlayamıyorsan "Şifremi Unuttum" linkine tıkla.

#### "Yeni hesap açmak için hangi e-postayı kullanayım?"

Geçerli bir e-posta — Gmail, Outlook, kurumsal vs. fark etmez. Her tenant için **ayrı bir e-posta** gerekir (aynı e-postayla iki pet shop açamazsın). Gmail kullanıyorsan `+` alias yöntemi var: `ahmet+mavipet@gmail.com` ve `ahmet+pati@gmail.com` ayrı sayılır.

#### "Hesabımı silmek istiyorum"

KVKK Madde 7 unutulma hakkı gereği hesabını silebilirsin. Önce **"Verilerimi İndir"** ile tüm xlsx export'ları al, sonra `info@petstockpro.com` adresine "Hesap silme talebi" e-postası gönder. 30 gün içinde tüm verilerin silinir (audit log + yasal saklama yükümlülüğü olan veriler hariç).

#### "Hesabıma yetkisiz giriş şüphesi var, ne yapayım?"

1. Hemen şifreni değiştir (`/admin/security` → "Şifre Değiştir")
2. `/admin/security` → "Aktif Oturumlar" → tüm oturumları kapat
3. 2FA aktif değilse hemen aktive et
4. E-posta değiştirme akışındaki "İptal Et" linkini kontrol et — sen değil saldırgan başlattıysa
5. `info@petstockpro.com` adresine bildir

### 19.2 Ürün soruları (12 soru)

#### "Ürün eklerken vergi numarası soruyor, niye?"

Vergi numarası sadece **ürünü vitrin'de satışa açmak** için zorunludur. Sadece stok takip için kullanıyorsan vergi no girmeden tüm ürünleri ekleyebilirsin.

#### "Ürün vitrin'e neden çıkmıyor?"

Doğrula validation 5 maddeden birinde takılıyor olabilir. Ürün düzenle sayfasında "Storefront" bölümünde checklist'i kontrol et:

- 🏢 Vergi numarası (şirket profilinde dolu mu?)
- 📦 Aktif variant (en az 1?)
- 💰 Geçerli fiyat (1₺-50.000₺ aralığında?)
- 📂 Kategori (atanmış mı?)
- 📷 Görsel (en az 1 yüklendi mi?)

Eksik olan ✕ ile işaretli görünür. Tamamladıktan sonra "Aç" toggle'ını tekrar tıkla.

#### "Variant ne demek? Ürün ile variant arasındaki fark nedir?"

**Parent ürün** = ana ürün (örn. "Royal Canin Adult Kedi Maması"). **Variant** = parent'ın boyut/ambalaj çeşitleri (örn. 400g, 2kg, 10kg). Her variant ayrı SKU + fiyat + stok'a sahiptir ama plan limit'e parent olarak sayılır — variant'lar bedavadır.

#### "Görsel limiti nedir?"

Her ürün için maksimum **5 görsel** (her biri max 5 MB). Kabul edilen formatlar: JPG, PNG, WebP. Drag-drop ile sırasını değiştirebilirsin. İlk yüklenen otomatik ana görsel olur (⭐) — istediğini ana yapabilirsin.

#### "Ürünü hard delete etmek istiyorum, mümkün mü?"

Hayır. Stok hareketleri ve audit log'da referans var, bu yüzden tamamen silinemez. Bunun yerine **arşivlersin** (`is_active = false`). Arşivlenmiş ürünler listede "Arşivlenmiş" filtresinde görünür, vitrin'den otomatik çekilir, ama geçmiş hareketleri korunur.

#### "Excel'den toplu ürün eklemek istiyorum, nasıl?"

`/admin/products/import` sayfasına git. **PRO veya PRO+ planına geçmiş olman gerekir** (FREE plan'da bu özellik yok). 11 sütunlu xlsx şablonu indir, doldur, yükle. Sistem 15+ kuralla doğrulama yapar, hatalı satırlar bildirilir, hatasız satırlar import edilir.

#### "Yeni marka eklemek istiyorum, nereden?"

Pet shop sahipleri yeni marka ekleyemez — markalar sistem genelinde **global** tutulur (1.000 pet shop × 95 marka = 95K duplicate row olmasın diye). İhtiyacın olan marka yoksa süperadmine bildir (`info@petstockpro.com` veya Telegram), kısa süre içinde eklenir. Mevcut markalar dropdown'da listede görünür.

#### "Yeni kategori eklemek istiyorum, nereden?"

Aynı kural — kategoriler de sistem genelinde global. Pet shop kendi kategorisini ekleyemez. Sistemde 16 default kategori vardır (Kuru Mama, Yaş Mama, Aksesuar, Oyuncak, Sağlık vs.). Eksik kategori varsa süperadmine bildir.

#### "Ürün fiyatını değiştirdim ama vitrin'de güncellenmiyor"

Vitrin sayfası birkaç dakika cache'lenir (performans için). Değişikliğin yansıması 5-10 dakika sürebilir. Eğer hala görünmüyorsa tarayıcı cache'ini temizle (Ctrl+Shift+R).

#### "Variant fiyatını sıfırlasam ne olur?"

Satış fiyatı 0 olan variant vitrin'e açılamaz ("Geçerli fiyat" Doğrula kontrolünde takılır). Eğer geçici olarak ücretsiz hediye ürün için 0 fiyat kullanmak istiyorsan, o variant'ı pasif yap veya satış fiyatını 0.01₺ yap.

#### "Ürünü kopyalamak istiyorum, nasıl?"

Ürün düzenle sayfasında "Kopyala" butonu — yeni ürün formu pre-filled açılır, SKU ve barkod boş kalır (override gerek). Sistem otomatik yeni SKU önerir.

#### "Stoğum 0 oldu, vitrin'e nasıl geri açarım?"

Stok girişi yap (Stok Hareketleri → Stok Girişi drawer veya Düşük Stok sayfası → "Stok Girişi" linki). Stok 0'dan yukarı çıktığında ürün **otomatik açılmaz** — sen Ürünler sayfasında satırın sağındaki "Aç" toggle'ını manuel olarak tıklarsın. Bu kasıtlı bir tercih — yanlış stok girişi yapıldığında vitrin'de hatalı bilgi olmaması için.

### 19.3 Stok soruları (10 soru)

#### "Stok 0 olunca ne olur?"

3 şey olur:

1. **Ürün otomatik vitrin'den çekilir** (`vitrin_auto_unpublished_reason = 'stock_zero'`)
2. **Telegram bildirimi gelir**: "⛔ [ürün] stoğu bitti, vitrin'den çekildi"
3. **Pano dikkat bandında 🔔 görünür**

Stok ekledikten sonra manuel olarak Ürünler sayfasından "Aç" toggle'ı ile tekrar açarsın.

#### "Bir stok hareketini geri almanın süresi nedir?"

Normal kullanıcılar (bayi sahibi, çalışan) için **24 saat**. Hareket satırında ↶ ikonu varsa içindesin. Süperadmin süresiz geri alabilir (🚨 audit kaydı düşer).

#### "Transfer geri alındığında ne olur?"

Transfer iki entry olarak yazılır (kaynak ve hedef). Geri al'a basınca **ikisi birden** geri alınır (pair handling). Hem kaynak hem hedef şubedeki stok eski haline döner. Her iki şubede yeterli stok yoksa geri alma reddedilir.

#### "Sayımı iptal edersem ne olur?"

Sayım "cancelled" durumuna geçer. **Hiçbir stok hareketi yazılmaz** — sayım sırasında girdiğin değerler kaybolur. Sayım açıkken yapılan diğer hareketler (satış, giriş, transfer) etkilenmez, onlar zaten kaydedilmiştir.

#### "Satış kaydetmek için müşteri eklemem gerek mi?"

Hayır — müşteri tablosu yok. Sadece **müşteri referansı** olarak serbest text yazarsın (örn. "Ahmet Y. 0532 1234567", "Misafir müşteri"). Sadece **veresiye satışta** müşteri referansı zorunlu (boş bırakılamaz).

#### "Eksi stok girebilir miyim?"

Hayır. Stok çıkışı mevcut stoktan fazla olamaz. "Stok yetersiz: 2 mevcut, 5 isteniyor" hatası alırsın. Bu disiplin kuralıdır — gerçeklikten kopmasın diye. Eğer stok hesabın yanlışsa önce **sayım** yapman gerekir.

#### "Geri alınmış bir hareketi tekrar geri alabilir miyim?"

Hayır. Bir kez geri alınmış hareket "✓ Geri alındı" rozet alır, ↶ butonu gizlenir. Yeni bir hareket yazmak istiyorsan elle Stok Girişi/Çıkışı yaparsın.

#### "Sayımı yarıda bırakırsam veriler kaybolur mu?"

Hayır. Sayım otomatik 30 saniyede bir background'da kaydedilir. Sayfa kapansa veya sekme değişse dahi veriler kaybolmaz. Tekrar `/admin/stocktake` sayfasına gittiğinde "Aktif sayımlar" listesinde görürsün, "Devam Et →" linkiyle açabilirsin.

#### "Stok hareketim audit log'a düşüyor mu?"

Evet — her stok hareketi (giriş, çıkış, transfer, sayım, geri alma) audit log'a kayıt düşer. Detaylar: kullanıcı, IP, tarih, before/after değerleri. `/admin/audit-log` sayfasından görebilirsin.

#### "Çoklu şubeden tek seferde satış kaydedebilir miyim?"

Hayır — her satış bir şubeden kaydedilir. Bir müşteri farklı şubelerdeki ürünlerden alışveriş yapıyorsa her şube için ayrı satış girersin. Bu defter mantığını temiz tutar.

### 19.4 Vitrin soruları (10 soru)

#### "Vitrin limit nedir?"

| Plan | Vitrin limit |
|---|---|
| FREE | 10 ürün |
| PRO | 500 ürün |
| PRO+ | Sınırsız |

Limiti aştığında 11. ürünü açmaya çalışırsan "Vitrin limitin doldu" hatası alırsın.

#### "Vitrin slug'ımı değiştirebilir miyim?"

Evet, Ayarlar → Vitrin Profili → "Vitrin slug" alanını düzenleyebilirsin. Ancak eski URL'lerin (Google indeks, müşteriye paylaştıkların) **çalışmaz** olur. Mümkünse ilk slug'ı dikkatli seç.

#### "WhatsApp nasıl çalışır?"

Müşteri vitrin'de "WhatsApp ile İletişim" butonuna tıklar → telefonunda/bilgisayarında WhatsApp uygulaması/web açılır → mesaj input'ta önceden doldurulmuş gelir → müşteri "Gönder" butonuna basar. Biz mesajı görmüyoruz, sadece deep link açıyoruz. WhatsApp Business API kullanmıyoruz (bu sebeple ücretsiz ve KVKK temizdir).

#### "Müşteri benden nasıl sipariş verir?"

Müşteri sana WhatsApp'tan yazar — sen ondan adresini, kart bilgisini, kargo tercihini vs. sorarsın. Sipariş süreci tamamen senin kontrolünde:

- Kapıda nakit/kart
- Havale/EFT
- Kargo (yurt içi)
- Mağazadan teslim alma

**PetStockPro sipariş alıp ödeme almıyor** — biz sadece dizin/bağlantı kurucuyuz.

#### "Müşteri satın aldıktan sonra ne yapmam gerekiyor?"

Pet shop admin paneline gir → Stok Hareketleri → Stok Çıkışı drawer → Satış → variant + adet + ödeme tipi + müşteri ref → Kaydet. Stok otomatik düşer, gerekirse vitrin'den otomatik çekilir.

#### "Vitrin metrikleri gerçek satış sayısı mı?"

Hayır — sadece **WhatsApp butonuna tıklama** sayısı. "47 tıklama → 12 gerçek satış" karşılaştırmasını kendi defterinden yaparsın. (Bu kasıtlı bir tercih — sipariş takibi yapsaydık komisyon alıyor sayılırdık.)

#### "Vitrin başvurum reddedildi, sebep ne?"

Genelde otomatik reddedilen başvurular vergi numarası eksik, görsel uygunsuz, vitrin profil bilgisi eksik gibi temel sebeplerdir. Reddedildiğinde sistem sana sebep gönderir. Süperadmin Manuel İnceleme alt-sekmesinde gözden geçirir.

#### "Vitrin'e açtığım ürün bir gün sonra otomatik kapandı, niye?"

Muhtemelen stok 0'a düştü — sistem otomatik vitrin'den çeker. Pano dikkat bandında 🔔 görünür: "⛔ [ürün] stoğu bitti, vitrin'den çekildi". Stok ekleyip "Aç" toggle'ını manuel tekrar aç.

#### "Vitrin sıralamasında öne çıkmak için ne yapayım?"

Sıralama algoritması: Mesafe %40 + Stok ✓ %25 + Son güncelleme %15 + Profil tamlığı %10 + Üye yaşı %10. Avantaj sağlamak için:

- **Stok dolu tut** — "Stok ✓" işareti büyük etken
- **Sık güncelle** — Her stok girişi ürünü "yeni" gösterir
- **Profili tamamla** — Logo, kapak, açıklama eksiksiz olsun
- **Coğrafi tercih yok** — Müşteri lokasyonuna en yakın pet shop'lar otomatik öncelikli

**Sponsorlu listeleme yok** — eşit rekabet felsefesi (para vererek üst sırada görünemezsin).

#### "Vitrin'de ürün için yorum yazılabilir mi?"

Hayır — yorum sistemi yok (Faz 2'ye saklı). Sadece WhatsApp tıklamasından sonra müşteriye 5 emoji sticky balon gösterilir (😊/🙂/😐/😕/😞). Bu rating'i Ayarlar → Vitrin → "WhatsApp Geri Bildirimleri" panelinde görürsün.

### 19.5 Plan soruları (9 soru)

#### "PRO'ya geçtikten sonra ne olur?"

- Stok limit 50 → 500 ürün
- Vitrin limit 10 → 500 ürün
- Şube sayısı 1 → Sınırsız
- Excel ürün import açılır
- Gelişmiş raporlar (`/admin/reports`) açılır
- Tüm diğer özellikler aynı (vitrin, audit, 2FA, asistan, e-Arşiv vs.)

#### "Aboneliği iptal edersem hemen mi düşer?"

Hayır — **dönem sonuna kadar** PRO/PRO+ aktif kalır. Dönem bitince otomatik FREE'ye düşer. Verilerin ve ürünlerin **silinmez**; sadece FREE vitrin limitini (10) aşan ürünler otomatik vitrin'den çekilir (silinmez, PRO'ya dönünce tekrar yayınlanır). Plan limitini aştığın sürece **yeni ürün ve yeni stok ekleyemezsin** — ürün silerek limite düşersin ya da planını yükseltirsin.

#### "14 gün cayma hakkı nasıl çalışır?"

Tüketici mevzuatı gereği abonelik için 14 gün cayma hakkın var. İlk abonelik kaydından sonra 14 gün içinde iptal edersen tam iade alırsın. 14 gün sonrası iptal dönem sonuna kadar aktif kalır (oransal iade yok, kullandığın günler için ücret alınır).

#### "E-Arşiv başvurusu nasıl yapılır?"

E-Arşiv için 4 önkoşul:

1. **Vergi mükellefi olmak** (şirket veya şahıs şirketi)
2. **Mali mühür sertifikası** — TÜBİTAK Kamu SM (~750 ₺/yıl)
3. **GİB e-Arşiv başvurusu** — gib.gov.tr üzerinden (1-2 hafta onay)
4. **Nilvera kontör paketi** — kullanım başına ücret

Sadece stok takip için kullanıyorsan bu adımları atlayabilirsin — Nilvera entegrasyonu Settings'te disabled görünür.

#### "Kart bilgilerim güvenli mi?"

Evet — kart bilgilerin **bize hiç gelmez**. **PayTR** ödeme altyapısını kullanıyoruz; kart bilgisi doğrudan PayTR'a gider. PayTR BDDK lisanslı ödeme kuruluşudur ve PCI DSS sertifikalıdır. İlk ödemede 3D Secure (banka SMS doğrulama); sonraki yenilemeler saklı kartla otomatik çekilir.

#### "Ödemem başarısız oldu, ne yapmalıyım?"

3 olası sebep:

1. **3D Secure SMS yanlış** — banka kodunu yanlış girdin, tekrar dene
2. **Kart limit yetersiz** — banka kartının limiti aşıldı veya bloklu, banka ile görüş
3. **Kart süresi dolmuş** — Settings'ten yeni kart bilgisini gir

PayTR yenileme başarısız olursa sistem otomatik tekrar dener (1., 3. ve 5. gün) ve sana "kartını güncelle" e-postası gönderir. Denemeler tükenirse plan FREE'ye düşer. Kartını güncellersen sorun çözülür.

#### "PRO ile PRO+ arasında nasıl geçiş yaparım? Ne zaman ücret alınır?"

Ayarlar → Abonelik'te geçersin. **Yükseltme (PRO → PRO+) ile düşürme (PRO+ → PRO) FARKLI çalışır:**

**⬆ Yükseltme (PRO → PRO+) — ANINDA:**
- "PRO+ planına hemen yükselt" dersin. İki plan arasındaki **fark** (PRO+ 2.000 − PRO 1.000 = **1.000 ₺**) hemen tahsil edilir ve planın **anında** PRO+ olur (dönem tarihlerin değişmez).
- Kayıtlı kartın varsa fark **saklı karttan otomatik** çekilir; kartın kayıtlı değilse **kart formu (PayTR)** açılır, farkı orada ödersin.
- Geçen günler düşülmez, her zaman **tam fark** alınır (oransal/proration hesabı yok). **Bir sonraki yenilemede** artık tam PRO+ ücreti (2.000 ₺) çekilir.

**⬇ Düşürme (PRO+ → PRO) — DÖNEM SONUNDA:**
- "PRO planına geç (dönem sonunda)" dersin. Geçiş anında **hiçbir ücret alınmaz/iade edilmez** — sadece "X tarihinde geçecek" işaretlenir (iptal edebilirsin).
- Dönem sonundaki yenilemede yeni planın (PRO 1.000 ₺) ücreti çekilir; o zamana kadar PRO+ özelliklerini kullanmaya devam edersin.

#### "Plan düşmesi sonrası fazla ürünlerime ne olur?"

PRO+ (∞) → PRO (500) düşersen — ya da FREE'ye düşersen — **ürünlerin silinmez**, hepsi listede durur. Ama:

- Yeni planın **vitrin limitini** aşan ürünler otomatik vitrin'den çekilir (en eskiler; silinmez, `plan_downgrade` sebebiyle kapatılır, tekrar yayınlanabilir).
- Plan **ürün limitini** (PRO 500 / FREE 50) aştığın sürece **yeni ürün ve yeni stok ekleyemezsin** — net bir hata mesajı görürsün (örn. "Ürün limitini aştın: 700/500").
- Açmak için: ürün silerek sayını limite (500'e) düşür **veya** planını yükselt.
- Satış/çıkış serbesttir (stoğunu eritmene engel yok). Veri kaybolmaz.

#### "Faturamı nereden indirebilirim?"

Ayarlar → Plan + Fatura → "Faturalarım" — tüm geçmiş e-Arşiv faturalarının PDF link'leri burada. Nilvera tarafından otomatik kesilir, sana e-postayla da gelir.

### 19.6 KVKK soruları (5 soru)

#### "Verilerimi nasıl silerim?"

KVKK Madde 7 unutulma hakkı:

1. Önce `/admin/settings/data` → "Verilerimi İndir" — tüm verilerini xlsx olarak al
2. `info@petstockpro.com` adresine "Hesap silme talebi" e-postası gönder
3. 30 gün içinde tüm verilerin silinir (audit log + yasal saklama yükümlülüğü olan veriler hariç — bunlar anonymize edilir)

#### "Müşteri bilgilerini saklamak zorunda mıyım?"

KVKK gereği müşteri kişisel verisi (telefon, ad, vs.) saklamak için **açık rıza** gerekir. PetStockPro müşteri tablosu tutmaz (Faz 2) — `customer_ref` serbest text alanına yazdığın müşteri ad/telefon bilgisi senin kendi kararındır. Müşteri ile yaptığın WhatsApp konuşması da kendi telefonunda kalır (biz görmüyoruz).

#### "Verilerim nerede saklanıyor?"

Verilerin **Frankfurt (Almanya)** veri merkezinde saklanır (AB içi). Bu sebeple kayıt formunda "Veri lokasyonu açık rızası" checkbox zorunludur (KVKK Madde 9 yurt dışı aktarım).

#### "Müşteri benim hakkımda şikayet ederse ne olur?"

Müşteri vitrin'de "🚩 Şikayet" butonuyla şikayet edebilir. 3 farklı IP'den aynı şikayeti gelirse ürün görseli otomatik gizlenir ve süperadmin "Manuel İnceleme" alt-sekmesine düşer. Süperadmin "Doğru görseldi" derse şikayet `dismissed` olur. "Yanlış" derse görsel silinir ve ürün `auto_suspended` durumuna geçer.

#### "Müşterimden KVKK onayı almam gerek mi?"

Eğer satış sırasında müşterinin kişisel verisini topluyorsan (örn. veresiye için telefon, kargo için adres), KVKK Aydınlatma yükümlülüğün vardır. Önerilen yöntem: Mağazada görünür yerde KVKK aydınlatma metni asmak. PetStockPro bu süreçte aracı değil — pet shop'un kendi KVKK uyumudur.

---

## 20. Sorun Giderme (Troubleshooting)

### 20.1 Login sorunu

**Problem:** "E-posta veya şifre hatalı" mesajı

**Olası sebepler:**

1. Şifreyi yanlış yazdın → "Şifremi Unuttum" akışını dene
2. E-posta yanlış yazılmış (typo) → kontrol et
3. Hesap kilitli (5+ yanlış deneme) → `/account-locked` sayfasında bekle veya "Şifremi Unuttum" ile bypass yap
4. Hesap pasif duruma alınmış → süperadmine ulaş

### 20.2 E-posta gelmedi

**Problem:** Kayıt sonrası doğrulama e-postası gelmedi

**Olası sebepler ve çözümler:**

1. **Spam klasörünü kontrol et** — gönderici: `noreply@petstockpro.com`
2. **24 saat TTL** dolmuş olabilir — `/verify-email` sayfasında "Yeniden Gönder" butonuna tıkla (60 sn cooldown)
3. **E-posta yanlış yazılmış** — `/verify-email` sayfasında "E-posta düzelt" linkine tıkla (sadece doğrulanmamışken)
4. **Brevo gönderim sorunu** — e-posta sunucularımız nadiren yavaş olabilir, 5-10 dk bekle

### 20.3 Vitrin'e ürün çıkmıyor

**Problem:** "Aç" toggle açtım ama ürün vitrin'de görünmüyor

**Çözüm:** Ürün düzenle sayfasında "Storefront" → Doğrula panel checklist'i kontrol et. 5 madde:

1. ✓ Vergi numarası dolu mu (Şirket profili)
2. ✓ En az 1 aktif variant var mı
3. ✓ Satış fiyatı 1₺-50.000₺ aralığında mı
4. ✓ Kategori atanmış mı
5. ✓ En az 1 görsel yüklenmiş mi

Eksikleri tamamla, tekrar "Aç" tıkla.

### 20.4 Stok hesabı yanlış görünüyor

**Problem:** Sistem 50 diyor ama rafta 45 var

**Çözüm:** Sayım yap (`/admin/stocktake/new`). Şubeyi seç → "Başlat" → tek tek say → sebep dropdown'undan "Kayıp" veya uygun sebebi seç → Tamamla. Sistem stoğu sayılan değere ayarlar, fark için stok hareketi yazılır.

### 20.5 Şube ekleyemiyorum

**Problem:** "+ Yeni Şube" butonu disabled veya hata

**Olası sebep:** FREE plan'da sadece 1 şube hakkın var. Ek şube için PRO veya PRO+'ya geçmen gerekir. Sayfada "⭐ PRO ÖZELLİĞİ" paneli görünür.

### 20.6 Excel import çalışmıyor

**Problem:** "Excel'den İçeri Aktar" butonu görünmüyor veya disabled

**Olası sebep:** FREE plan'da Excel import yok — sadece manuel ürün ekleme. PRO veya PRO+'ya geçmen gerekir.

**Diğer sorunlar (PRO/PRO+ kullanıcılar için):**

- **Şablon dışı dosya** — sadece sistem şablonu kullan
- **Boş satır** — şablondaki boş satırları sil
- **Geçersiz kategori/marka slug** — listede olmayan kategori/marka yazılmış
- **Negatif fiyat** — 0 veya negatif fiyat reddedilir
- **Dosya boyutu > 5 MB** — şablonu daralt

### 20.7 Rapor sayfası boş

**Problem:** `/admin/reports` sayfası "⭐ PRO ÖZELLİĞİ" paneli gösteriyor

**Olası sebep:** FREE plan'da gelişmiş raporlar yok. Pano + temel KPI yeterli olur. Detaylı analitik için PRO veya PRO+'ya geç.

### 20.8 WhatsApp deep link açılmıyor

**Problem:** Vitrin'de WhatsApp butonuna basıyorum ama bir şey olmuyor

**Olası sebepler:**

1. **WhatsApp uygulaması yüklü değil** — masaüstündeyse `web.whatsapp.com` ile çalışır, mobilde uygulama gerek
2. **Telefon numarası formatı yanlış** — `+90` veya `0` ile başlamalı, boşluk olabilir ama özel karakter olmamalı
3. **Tarayıcı popup engellemiş** — adres çubuğunda "popups blocked" uyarısı varsa izin ver

### 20.9 iyzico ödeme başarısız

**Problem:** "Ödeme reddedildi" hatası

**Olası sebepler:**

1. **3D Secure SMS yanlış kod** — yeniden dene, banka SMS bekle
2. **Kart limit aşıldı** — bankana danış, limit yükselt
3. **Kart bloklu** — banka şüpheli işlem koruması, banka ile görüş
4. **Kart süresi dolmuş** — yeni kart bilgisini gir
5. **Yetersiz bakiye** — kart hesabını kontrol et

### 20.10 KVKK indirme yavaş

**Problem:** "Verilerimi İndir" tıkladım ama xlsx indirmesi uzun sürüyor

**Olası sebep:** Büyük tenant'lar (1000+ ürün, 10K+ stok hareketi) için indirme **30 dakikaya kadar** sürebilir. Sistem export'u arka planda hazırlar, hazır olunca e-postana bağlantı gönderir. Tarayıcıyı kapatıp daha sonra e-postadan indirebilirsin.

### 20.11 Pano yavaş yükleniyor

**Problem:** `/admin` açılması uzun sürüyor

**Olası sebepler:**

1. **İnternet bağlantısı yavaş** — Pano çoğunlukla cache'lenmiş içerikten gelir, ilk yükleme yavaşsa sonrakiler hızlı olur
2. **Cache temizle** — tarayıcı cache (Ctrl+Shift+R)
3. **TanStack Query refetch** — sayfa odağa geldiğinde otomatik yenileme yapmaz (`refetchOnWindowFocus: false`), elle Pano sayfasını yenile
4. **Browser console errors** — F12 → Console — varsa süperadmine bildir

### 20.12 Telegram bot bağlanmıyor

**Problem:** `/admin/settings/notifications` → 6 haneli kod giriyorum ama "kod hatalı" hatası

**Olası sebepler:**

1. **6 haneli kod yanlış yazıldı** — bot'tan gelen kodu kopyala-yapıştır yap
2. **Kodun süresi dolmuş** — bot'tan tekrar `/start` yaz, yeni kod al
3. **Aynı bot başka tenant'ta bağlı** — bir Telegram chat sadece 1 tenant'a bağlanabilir

### 20.13 2FA TOTP kodu reddediliyor

**Problem:** Authenticator'dan kod giriyorum ama "2FA kodu hatalı" hatası

**Olası sebepler:**

1. **Saat eşitleme** — Authenticator uygulamasının saati senin telefonunun saatiyle eşleşmeli. TOTP 30 saniyelik bir pencerede çalışır.
2. **Kod kullanım anında değişti** — 30 saniyede yeni kod üretilir, hızlıca gir
3. **Yanlış hesap** — Authenticator'da birden fazla hesap varsa doğru olanı seç
4. **2FA secret bozuk** — `/admin/security` → "2FA Kapat" + tekrar aktive et (recovery code lazım olur)

### 20.14 Ürün görseli yüklenmiyor

**Problem:** Drag-drop sonrası "Yükleme başarısız" hatası

**Olası sebepler:**

1. **Dosya boyutu > 5 MB** — küçült (online resim sıkıştırıcı kullan)
2. **Format desteklenmiyor** — sadece JPG, PNG, WebP
3. **Maksimum 5 görsel** — silmen gerekiyor
4. **İnternet kesintisi** — yeniden dene
5. **Browser ad blocker** — bazı ad blocker'lar upload'ı engeller, devre dışı bırak

### 20.15 Süperadmin link görünmüyor

**Problem:** Pano üst menüsünde 🛡 "Süperadmin" linki yok

**Olası sebep:** Hesabın **SUPERADMIN rolü değil**. Bu link sadece PetStockPro yönetimi (sahibi) tarafından kullanılır. Normal pet shop sahipleri ve çalışanlar görmez.

### 20.16 Ürün veya stok ekleyemiyorum ("limit aşıldı" hatası)

**Problem:** Yeni ürün eklerken veya stok girişi yaparken "Ürün limitini aştın (örn. 700/500)" gibi bir hata alıyorsun.

**Sebep:** Plan **ürün limitini** aşmış durumdasın. Bu genelde **plan düşüşünden** sonra olur — örneğin PRO+ (sınırsız) iken 700 ürün eklemişsin, sonra PRO'ya (500 limit) geçmişsin. Mevcut 700 ürün silinmez ama limitin (500) üstünde olduğun için sistem **yeni ürün eklemeyi ve yeni stok girişini bloke eder** (kasıtlı — planınla uyumlu hâle gelmen için).

**Çözüm (üçünden biri):**

1. **Ürün sayını limite düşür** — gereksiz/eski ürünleri sil (`/admin/products` → ürün → Sil). 500'e (veya FREE'de 50'ye) indiğinde ekleme tekrar açılır.
2. **Planını yükselt** — PRO → PRO+ (sınırsız) veya FREE → PRO. Ayarlar → Abonelik. (Plan değişimi dönem sonunda geçerli olur.)
3. **Sadece satış yap** — satış/stok çıkışı her zaman serbesttir; mevcut stoğunu eritip ürün sayını doğal yoldan azaltabilirsin.

> Not: Bu durumda vitrin'deki limit-üstü ürünler de otomatik kapatılmış olabilir (vitrin'e "plan düşüşü" sebebiyle çekilmiş). Limite indikten veya yükselttikten sonra bunları `/admin/products` → Satışa Aç ile tekrar yayınlayabilirsin.

---

## 21. AI Asistanı (Chatbot)

URL: `/admin/ai`

Sol menüde **"🤖 AI Asistanı"** linkine tıklayınca PetStockPro hakkında doğal dilde soru sorabileceğin bir chat sayfası açılır. Asistan **sadece bu kullanım kılavuzundaki bilgilerle** cevap verir — uydurma yapmaz.

### 21.1 Nasıl kullanılır?

- Welcome ekranında 5 önerilen soru görürsün ("Vitrin'e ürün nasıl çıkarırım?", "Stok 0 olunca?", "2FA TOTP nasıl?", "PRO'ya nasıl geçerim?", "Excel ile toplu yükleme"). Tıkla → otomatik gönderilir.
- Veya alt input'a soru yaz (2-500 karakter), **Enter** ile gönder. **Shift+Enter** yeni satır.
- Cevap geldiğinde, balonun altında **"📚 N kaynak"** detayı aç → hangi kılavuz bölümlerinden cevabın üretildiğini görürsün.
- Kaynaklar düşük skorlu ise **"düşük güven"** rozeti çıkar. Bu durumda asistan büyük olasılıkla "yeterli bilgi bulamadım" der.

### 21.2 Plan limitleri

| Plan | Günlük mesaj | Dakikada |
|---|---|---|
| FREE | **10 mesaj** (00:00 UTC sıfırlanır) | 5 (anti-spam) |
| PRO | Sınırsız | 5 |
| PRO+ | Sınırsız | 5 |

- **FREE plan sayacı** sayfa üst sağında "FREE plan: 3/10 bugün" şeklinde görünür. Kalan ≤5 ise turuncu, ≤2 ise kırmızı tonda uyarır.
- 10/10'a ulaşınca input alanı **kilitlenir**, ⛔ banner "Günlük limit doldu" görünür. Yarın 00:00 UTC'da sıfırlanır.
- Anti-spam: dakikada 5 mesajdan fazla gönderirsen 60 sn beklemen istenir.

### 21.3 Kapsam — neyi cevaplar, neyi cevaplamaz?

**Cevaplar:**
- PetStockPro uygulamasının her ekranı, her özelliği (bu kılavuzun §1-§20 arası tüm konular)
- Hesap + güvenlik (2FA, şifremi unuttum, kilitli hesap)
- Ürün + stok + sayım + transfer + raporlar
- Vitrin (sahip tarafı + müşteri tarafı)
- Plan + fatura + Excel import + KVKK veri indirme

**Cevaplamaz:**
- PetStockPro dışı konular (hava durumu, dolar kuru, başka uygulamalar)
- Senin tenant'ına özel veriler (kaç ürünün var, hangi satışın oldu — Asistan canlı veriye bakmaz, sadece dokümandan cevap verir)
- Kullanım kılavuzunda olmayan ileri seviye konular

**Kapsam dışı sorularda:** "Bu konuyla ilgili PetStockPro kullanım kılavuzunda yeterli bilgi bulamadım. Detaylı yardım için destek@petstockpro.com'a yazabilirsin." cevabı verir.

### 21.4 Teknoloji — nasıl çalışıyor?

- **Embedding:** Cloudflare Workers AI (`bge-m3` multilingual, 1024 boyutlu vektör, Türkçe destekli)
- **LLM:** `Llama 3.1 8B Instruct` (Cloudflare Workers AI)
- **Vector store:** Cloudflare Vectorize (USER-MANUAL.md'nin 182 chunk'ı önceden embed edilip indekslenmiştir)
- **RAG (Retrieval-Augmented Generation):** Sorduğun soru → embedding → en alakalı 5 chunk → LLM'e kaynak olarak verilir → Türkçe cevap

Cevap genelde 1-3 saniyede gelir. Latency >10sn ise "Sistem yoğun, tekrar dene" mesajı görürsün.

### 21.5 Gizlilik

- Sorduğun her soru ve verilen cevap **audit log'a kaydedilir** (`ai_messages` tablo): tenant + user ID + tarih + soru + cevap + hangi kaynaklar kullanıldı + kaç token harcandı.
- **Tenant izolasyonu:** Asistan başka tenant'ların verilerini görmez. Bu zaten teknik olarak imkânsız çünkü Asistan kullanım kılavuzunu okur, canlı veri tabanına bakmaz.
- **3. taraf:** Sorular Cloudflare Workers AI'ya gönderilir (Cloudflare EU bölgesi). Cloudflare bu verileri model eğitimi için kullanmaz (kurumsal sözleşme).
- **KVKK:** AI mesajları kişisel veri kapsamında değildir (sadece sistem kullanımı). Yine de "Verilerimi İndir" ile audit log'u indirebilirsin.

### 21.6 Sınırlamalar

- **Halüsinasyon yok ama yetersizlik var:** Asistan uydurma yapmaz ama bazı detaylı sorularda "yeterli bilgi bulamadım" diyebilir. Önerimiz: soruyu farklı kelimelerle yeniden sor veya destek email'ine yaz.
- **Canlı veri yok:** "Kaç ürünüm var?" gibi tenant verisini sormak işe yaramaz. O bilgi için Pano sayfasını veya Ürünler listesini kullan.
- **Hatırlama yok:** Her soru bağımsızdır, önceki sorunu hatırlamaz. Tek mesajda tam bağlam ver.

---

## Son Söz

Bu kılavuz PetStockPro'nun mevcut tüm özelliklerini kapsar. Yeni özellikler ve değişiklikler eklendikçe doc da güncellenecek.

Daha detaylı bilgi veya sorun için:

- 📧 E-posta: `info@petstockpro.com`
- 📱 Telegram: `@PetStockProDestek`
- 💬 Sol menüde **AI Asistan** sekmesinden sor (chatbot bu kılavuzu kullanır)

**Önemli ilkelerimiz:**

- ✅ **Eşit rekabet** — Vitrin'de para vererek üst sıraya çıkamazsın
- ✅ **Açık fiyatlama** — Tüm planlar şeffaf, gizli ücret yok
- ✅ **Para akışında değiliz** — Müşteri-pet shop arası ödeme bize gelmez
- ✅ **KVKK uyumlu** — Verilerin Avrupa'da, açık rıza zorunlu
- ✅ **Self-service** — Çoğu işi kendin yaparsın, destek bizden bağımsız

İyi satışlar! 🐾

---

*Son güncelleme: 2026-05-22.*
*Kılavuz versiyonu: 1.0 (MVP)*
