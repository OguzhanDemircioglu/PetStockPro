# Ekran: Ayarlar

**URL:**
- Tek sayfa, sol sidebar bölüm seçici (Stripe/Linear pattern):
  - `/admin/settings` (default → Şirket Profili)
  - `/admin/settings/plan`
  - `/admin/settings/locale`
  - `/admin/settings/notifications`
  - `/admin/settings/security`
  - `/admin/settings/data`

**Sidebar yeri:** Sistem grubu · ⚙️ Ayarlar
**Erişim:** ADMIN (bayi sahibi tam yetki; şube müdürü sadece kendi profili görür, plan/şirket göremez)
**Referans:** Faz 1 §25 · Tasarım `TASARIM-SISTEMI.md`

> **2026-05-13 ek:** Vitrin Metrikleri ekranı **Ayarlar > Vitrin > Metrikler alt-tab** olarak yer alır. Sidebar'a ayrı item eklenmez (sade tutmak için). Bkz. §2.1c Vitrin Metrikleri.

> **🚨 2026-05-14 revize (pricing 2026-05-21 son):** **3-tier B geri açıldı, TR-only.** Plan tablosu: **FREE 50 ürün (0 ₺) / PRO 500 ürün (1.000 ₺) / PRO+ Sınırsız (2.000 ₺)**, KDV dahil. Önceki 2-tier (PRO+ rafa, 2026-05-13) **iptal edildi**. Pricing tarihçesi: 750/1.750 (2026-05-14) → 1.250/2.250 (Karar C 2026-05-20) → **1.000/2.000 (2026-05-21 son, "fiyat artırmayalım")**. Yurt dışı ödeme (Paddle/USD/EUR) ve EN locale **kapsam dışı**. Detay: `PLAN-KADEMELERI §1` + `DEPLOYMENT §6.4`. Bkz. §2.2 Plan + Fatura.

> Tek sayfa tenant-level configuration. Sol sidebar 6 bölüm seçici, sağda içerik.

---

## 1. Layout

```
┌─────────┬──────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Yönetim > Ayarlar)                        │
│         ├──────────────────────────────────────────────────┤
│         │ ┌─ Settings Sidebar ─┬─ İçerik ─────────────────┐│
│         │ │ 🏢 Şirket Profili   │ Aktif bölüm formu        ││
│         │ │ 💳 Plan + Fatura    │                          ││
│         │ │ 🌐 Yerelleştirme    │ [Form alanları]          ││
│         │ │ 🔔 Bildirim          │                          ││
│         │ │ 🔒 Güvenlik         │ [Kaydet buton sticky]    ││
│         │ │ 📦 Veri / KVKK     │                          ││
│         │ └─────────────────────┴───────────────────────────┘│
└─────────┴──────────────────────────────────────────────────┘
```

## 2. Bölümler

### 2.1 🏢 Şirket Profili (default)

```
Logo                [yüklenmiş logo preview] [Değiştir]
                    Max 500KB · PNG/SVG · 200×200+

Şirket adı *        [Mavi Pet Shop A.Ş.]
Yasal unvan         [Mavi Hayvan Bakım Ürünleri Tic. Ltd. Şti.]

Vergi numarası      [1234567890]                    ← OPSIYONEL (kayıtta)
                    Şirket VKN: 10 hane | Şahıs şirketi TC kimlik no: 11 hane
                    Validation: 10 veya 11 hane + TR VKN/TC checksum
                    ⚠ Bilgi: Ürünleri vitrin'de satışa açmak için doldurmalısınız.
                    Sadece stok takip için kullanıyorsanız boş bırakabilirsiniz.
                    💡 Mahalle pet shop'larının çoğu "şahıs şirketi" — TC kimlik
                    no kullanır, çekinme.
Vergi dairesi       [Kadıköy Vergi Dairesi]         ← Opsiyonel (şahıs şirketi için boş bırakılabilir)

Adres
Ülke *              [Türkiye ▼]
İl                  [İstanbul ▼]    ← cities tablosu (81 il seed)
İlçe                [Kadıköy ▼]     ← districts tablosu (~970 ilçe seed)
Açık adres          [textarea]
Posta kodu          [_____]

İletişim
Telefon             [0212 xxx xx xx]
E-posta             [info@mavipet.com]
Web                 [https://mavipet.com]
WhatsApp            [+90 532 xxx xxxx]              ← Vitrin "Satıcıya Sor" butonu için
                    💡 Biz WhatsApp API kullanmıyoruz — sadece müşteri butona basınca
                    wa.me/... linki açılır, mesajı kullanıcı kendisi gönderir.
```

**Vergi no akışı (2026-05-13 kararı):**

| Aşama | Davranış |
|---|---|
| Kayıt formu | Vergi no SORULMUYOR (sadece şirket adı + email + şifre + il/ilçe) |
| Onboarding | Şirket profili widget — vergi no opsiyonel, atlanabilir |
| 1 ay sonra | E-posta + Telegram + ekran banner: *"Hesabını tamamlamayı unutma"* — askıya almaz, sadece hatırlatır |
| **Ürünler ekranında "Satışa Aç" toggle** | **Tetikleyici** → modal: *"Vitrin'de görünmek için vergi mükellefi olmanız gerekir. Vergi numaranızı girin."* |
| Hesap askıya alma | **ASLA otomatik askıya alınmaz** — sadece stok takip için kullanan tenant'a vergi no zorunlu değil |

**Vergi adresi billing etkisi (2026-05-14 — TR-only):**
- Tenant **TR vergi adresli** olmalı → TRY zorunlu (iyzico Subscription)
- **Yurt dışı tenant kabul edilmiyor** — TR-only kararı (PLAN-KADEMELERI §1 not). Faz 2'de talep gelirse Paddle ile açılabilir.

### 2.1b 🌐 Vitrin Profili (sub-bölüm — Satışa Aç tetikleyici)

Tenant ürünlerini **merkezi vitrin'de** (`petstockpro.com/vitrin`) yayınlamak istiyorsa burada profilini tamamlar. Detay: `EKRAN-PUBLIC-VITRIN.md §12`.

> **2026-05-13 önemli değişiklik:** Önceki "tenant subdomain" (`{slug}.petstockpro.com`) modeli iptal edildi. Pet shop'un kendi mini sitesi YOK — sadece merkezi vitrin'de pet shop profili (`petstockpro.com/vitrin/magaza/{slug}`). Custom domain ve custom CSS **kapsam dışı** (3-tier B'de de geri açılmadı — 2026-05-14).

```
⚠ KVKK onay banner:
  "Vitrin'de görünmek için adres + telefon paylaşımı onayı gerekiyor"
  [Aydınlatma metnini oku]

☑ Merkezi vitrin'de görün (master switch)
   Süperadmin onay durumu:  ⏳ Bekleyen / ✅ Onaylı / ❌ Reddedildi

Profil bilgileri:
   Vitrin slug         [mavi-pet-shop]
                       ↳ petstockpro.com/vitrin/magaza/mavi-pet-shop
   Logo                [Yükle]   (200×200, PNG/SVG, max 500KB)
   Kapak fotoğrafı     [Yükle]   (1600×400, max 1MB)
   Kısa açıklama       [textarea, 160 karakter counter]

İletişim:
   WhatsApp            [+90 532 xxx xxxx]   [Numarayı doğrula]
                       💡 Doğrulama akışı:
                          1. Telegram'da @PetStockProBot'tan onay kodu al (örn. PSP-487293)
                          2. "Numarayı doğrula" tıkla → wa.me/{kendi numaran} açılır
                          3. Hazır mesajı kendi numarana gönder (kodu içerir)
                          4. WhatsApp'tan kendine gelen mesajı geri Telegram bot'a "/dogrula 487293" yaz
                          5. Bot kodu doğrulayınca numara ✓ onaylı olur
                       (Biz WhatsApp Business API kullanmıyoruz, bu yöntem ücretsiz)
   Telefon             [0212 xxx xxxx]

Hazır WhatsApp mesajı:
   [textarea]
   Default: "Merhaba, PetStockPro'da gördüm. {ürün} stokta mı?"
   Değişkenler: {ürün} {pet shop} {şehir}

Çalışma saatleri (7 gün):
   Pzt: [09:00] - [21:00]   ☐ Kapalı
   Sal: ...
   ...
   [Tüm günler aynı] [Pazar kapalı preset]

Stok visibility:
   ◉ Var/yok level (önerilen)  ○ Tam sayı  ○ Gösterme

[👁 Vitrin Profilimi Önizle]
   ↳ Yeni sekme: petstockpro.com/vitrin/magaza/{slug}
```

**Bilgi:**
- Ürün başına "Satışa Aç" toggle Ürünler ekranında — bkz. `EKRAN-URUNLER §5.5`. Tüm ürünler default kapalı, kullanıcı her ürün için bilinçli açar (Doğrula validation gate). Toplu açma için bkz. `EKRAN-URUNLER §8.8`
- **Tek tema** — pet shop'lar merkezi vitrin'de eşit görünür (PetStockPro markası altında)
- **Custom domain YOK / Custom CSS YOK** — kapsam dışı (3-tier B'de de geri açılmadı, 2026-05-14)

### 2.1c 📊 Vitrin Metrikleri (alt-tab)

Pet shop sahibi vitrin performansını burada görür. Veri kaynağı: `vitrin_events` tablosu + `mv_vitrin_daily_metrics` materialized view (DATABASE-SCHEMA §3.8).

```
KPI Bandı (4 kart):
  👁 Bu hafta görüntüleme: 312 (↑15%)
  🖱 Ürün tıklama: 87
  📞 WhatsApp tıklama: 23 (en kıymetli metrik!)
  📈 Conversion: %26 (görüntüleme → WhatsApp)

Trend grafiği (son 30/90 gün, line chart):
  Görüntüleme + WhatsApp tıklama yan yana

En çok ilgi gören 5 ürünüm (tablo):
  Sıra │ Ürün                │ Görüntüleme │ Tıklama │ WhatsApp │ Conv.
  1    │ Royal Canin 2kg     │  34         │  12     │  8       │ %23
  2    │ Whiskas Pouch       │  28         │  10     │  6       │ %21
  3    │ Pro Plan 15kg       │  22         │   8     │  4       │ %18
  ...

Müşteri konumu dağılımı (pie chart):
  İstanbul %62 · Ankara %18 · İzmir %8 · Diğer %12

Saatlik dağılım (heatmap):
  Gün × saat — mesai içi vs gece görüntüleme

Periyot toggle: Bugün / 7g / 30g / 90g / 1y / Özel

[CSV/Excel indir]
```

**Önemli kısıt (2026-05-13 net):** Bu metrikler **WhatsApp butonuna tıklama** sayar — gerçek satış değil. Pet shop sahibi "47 tıklama → 12 satış" karşılaştırmasını **kendi defterinden** yapar. (Bkz. EKRAN-PUBLIC-VITRIN §20.7 — WhatsApp deep link ölçüm sınırı.)

#### 2.1.1 WhatsApp Geri Bildirimleri (2026-05-15 — Sticky Balon)

> **Yeni özellik (2026-05-15):** WhatsApp tıklamasından sonra müşteriye sticky balon gösterilir — 5 emoji seçenek, tek tıklama = submit. Detay UX: `EKRAN-PUBLIC-VITRIN §15`.

```
📊 WhatsApp Geri Bildirimleri (son 30 gün)
┌─────────────────────────────────────────────────┐
│  Funnel:                                         │
│  📞 WhatsApp tıklama         158                 │
│  💬 Balon gösterildi          158 (%100)         │
│  ✅ Submit edildi              72 (%46)          │
│  ✖  Manuel kapatıldı           17 (%11)          │
│  👻 Görmezden gelindi          69 (%44)          │
│                                                  │
│  Rating dağılımı (72 cevap):                     │
│  😊 Çok iyi      33 (%46)  ████████████░░░     │
│  🙂 İyi          24 (%33)  █████████░░░░░░     │
│  😐 Orta          7 (%10)  ███░░░░░░░░░░░░     │
│  😕 Kötü          3 (%4)   █░░░░░░░░░░░░░░     │
│  😞 Ulaşamadım    5 (%7)   ██░░░░░░░░░░░░░     │
│                                                  │
│  Türetilen metric'ler:                           │
│  • Ulaşma oranı: %93 (5 ulaşamadım / 72)         │
│  • Memnuniyet: %85 (Çok iyi + İyi / ulaşanlar)   │
│  • Ortalama puan: 4.1/5                          │
│                                                  │
│  💡 Sinyaller:                                    │
│  ✅ Cevap hızın iyi (%93 ulaşma)                  │
│  ⚠ "Orta + Kötü" %14 — iyileştirme noktası      │
│                                                  │
│  [Detay funnel →] [CSV export →]                 │
└─────────────────────────────────────────────────┘
```

**Pet shop için pratik yorum:**
- **Submit ratio** (%46) sektör benchmark'ından (5-15%) yüksek = müşteriler ilgili
- **Ulaşma oranı** (%93) = pet shop hızlı cevap veriyor (>%90 hedef)
- **Memnuniyet** (%85) = görüşme kalitesi iyi (>%80 hedef)
- **Ortalama puan** (4.1/5) = orta-üst memnuniyet

**Trend grafiği (haftalık):**
```
Rating ortalaması (son 12 hafta):
  4.5 ┤     ╭─╮
  4.0 ┤  ╭──╯ ╰╮ ╭─
  3.5 ┤──╯    ╰─╯
  3.0 ┴─────────────
      W1 W4 W8 W12
```

**Yorum bölümü (Faz 2):** MVP'de yorum yok. Faz 2'de eklenirse anonim yorumlar son 10 listede gösterilir (moderation süperadmin'de).

**Önemli kısıt:** 1 IP × 1 tenant × 24 saat = 1 feedback (anti-spam). Aynı müşteri günde tekrar gelir → balon **gösterilmez** (localStorage + KV check). Bu sebeple `whatsapp_clicks > balloon_shown` olabilir — normal davranış.

### 2.2 💳 Plan + Fatura

> **2026-05-14 not:** 3-tier B (FREE 50 / PRO 500 / PRO+ ∞) geri açıldı, **TR-only**. Önceki 2-tier (PRO+ rafa, 2026-05-13) **iptal edildi**. Otoritatif tablo: `PLAN-KADEMELERI.md §1`. Tüm fiyatlar KDV dahil TRY. Yurt dışı ödeme (Paddle/USD/EUR) **kapsam dışı**.

```
Mevcut plan bandı
┌─────────────────────────────────────────────────────────────┐
│ ✅ Şu an aktifsiniz: FREE Plan                              │
│ 47/50 ürün kullanılıyor (%94)                                │
│ [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░] kırmızı kritik                       │
│ Sonraki tahsilat: — (FREE ücretsiz)                          │
│ Detay: PLAN-KADEMELERI.md                                    │
└─────────────────────────────────────────────────────────────┘

Plan karşılaştırma (3 sütun grid — 3-tier B, TR-only)

┌──────────────────┬──────────────────┬──────────────────┐
│  FREE            │  PRO             │  PRO+            │
│  ───────────     │  ───────────     │  ───────────     │
│  0 ₺ / ay        │  1.000 ₺ / ay    │  2.000 ₺ / ay    │
│  (KDV dahil)     │  (KDV dahil)     │  (KDV dahil)     │
│                  │                  │                  │
│  📦 50 ürün      │  📦 500 ürün     │  📦 Sınırsız     │
│                  │                  │                  │
│  Tüm özellikler: │  Tüm özellikler: │  Tüm özellikler: │
│  ✓ Vitrin        │  ✓ Vitrin        │  ✓ Vitrin        │
│  ✓ Çoklu şube    │  ✓ Çoklu şube    │  ✓ Çoklu şube    │
│  ✓ Sınırsız user │  ✓ Sınırsız user │  ✓ Sınırsız user │
│  ✓ 6 rapor       │  ✓ 6 rapor       │  ✓ 6 rapor       │
│  ✓ Asistan       │  ✓ Asistan       │  ✓ Asistan       │
│  ✓ Audit + 2FA   │  ✓ Audit + 2FA   │  ✓ Audit + 2FA   │
│  ✓ Telegram      │  ✓ Telegram      │  ✓ Telegram      │
│  ✓ e-Arşiv       │  ✓ e-Arşiv       │  ✓ e-Arşiv       │
│                  │                  │                  │
│  Hedef:          │  Hedef:          │  Hedef:          │
│  Mahalle pet     │  Mahalle olgun   │  Büyük zincir,   │
│  shop, denemelik │  + küçük zincir  │  500+ ürün       │
│                  │                  │                  │
│  [✅ Aktif Plan] │  [⬆ PRO'ya Geç]  │  [⬆ PRO+'ya Geç] │
└──────────────────┴──────────────────┴──────────────────┘

Felsefe: "Tüm özellikler tüm planlarda açık. Sadece stok limiti farklı."
         Detay: PLAN-KADEMELERI.md §3

⚠ E-Arşiv fatura: mali mühür + GİB başvuru gerekli (Nilvera entegrasyon)
   Detay: PAYMENT-INTEGRATION.md (TR yasal zorunluluk — tüm faturalar Nilvera üzerinden)

Ödeme yöntemi (TR-only — sadece iyzico)
  MVP:              Manuel havale + IBAN bilgileri
                    "Yükseltmek için info@petstockpro.com ile iletişime geç"
  Faz 2:            [Kart ekle] iyzico Subscription (TR, TRY)

Fatura geçmişi (Nilvera e-Arşiv — TR yasal zorunluluk)
  Tarih │ Plan │ Tutar      │ Durum    │ İşlem
  ──────────────────────────────────────────────
  07Apr │ PRO  │ ₺1.000     │ Ödendi   │ [PDF e-Arşiv]
  07Mar │ PRO  │ ₺1.000     │ Ödendi   │ [PDF e-Arşiv]

  (PRO+ örneği: ₺2.000 — sınırsız stok)

Aboneliği iptal et
  [⛔ Aboneliği Sonlandır]
  → Onay modal: "Dönem sonuna kadar aktif, sonra FREE'ye düşer"

Yükseltme / Downgrade akışı (otoritatif: PLAN-PAYTR-NILVERA.md §9.3)
  FREE → PRO       : Anında aktif (50→500 limit yükselir)
  FREE → PRO+      : Anında aktif (sınırsız)
  PRO  → PRO+      : Anında aktif, TAM fark ücreti (2.000−1.000=1.000₺; proration YOK 2026-07-03).
                     Saklı kart varsa otomatik çekim; yoksa PayTR iframe kart formu açılır.
  PRO+ → PRO       : Dönem sonunda aktif. 500 üstü ürünler `isActive=false` (pasif mod)
                     → vitrin'de zaten görünmezler. Tenant 30 gün içinde hangi 500
                     ürünü aktif tutmak istediğini seçer; seçim yapmazsa sistem
                     en yeni 500'ü tutar (eski olanlar pasif kalır, silinmez).
  PRO  → FREE      : Aynı akış, 50 ürün limit ile.

  📌 Detay: PLAN-KADEMELERI.md §5.3 — 2026-05-14 MANTIK-HATALARI O7 düzeltmesi
     (önceki "vitrin'den çekilir" söylemi yanıltıcıydı, doğru: isActive=false).
```

### 2.3 🌐 Yerelleştirme

```
Arayüz dili *       ◉ Türkçe (TR)
                    💡 EN locale gizli (next-intl yapısı kalır, Faz 2'de açılabilir).
                       Şimdilik TR-only (2026-05-14 kararı, PLAN-KADEMELERI §1 not).
Para birimi *       [TRY] (zorunlu — TR-only)
                    💡 USD / EUR seçenekleri kapsam dışı (TR-only, 2026-05-14).
                       Tüm tenant'lar TR vergi adresli, TRY zorunlu.

Tarih formatı       ◉ 07.05.2026  (TR)  ○ 5/7/2026 (US) ○ 2026-05-07 (ISO)
Saat formatı        ◉ 14:32        ○ 2:32 PM
Sayı formatı        ◉ 1.250,50 (TR)  ○ 1,250.50 (US/EN)

KDV varsayılan      [%20 ▼]   ← Türkiye 2024 Temmuz'da %18 → %20 (MANTIK-HATALARI OT2-2)
  Kategori override
    Mama %10        (gıda — özel oran)
    Aksesuar %20
    Sağlık %20      (veteriner ürünleri — istisna olmayan)
    Diğer %20
  💡 Mama %1 olabilir (kuru/yaş hayvan maması bazı durumlarda) — mali müşavirinizle doğrulayın.
```

### 2.4 🔔 Bildirim

```
Telegram bağlantısı

[Bağlı değilse]
  PetStockProBot'a bağlanmak için:
  1. Telegram'da @PetStockProBot aç
  2. /start yaz
  3. Bot'un verdiği 6 haneli kodu buraya gir:
  Kod: [______]  [Bağla]

[Bağlıysa]
  ✓ Telegram bağlı: @ahmetsahin
  Son test: 2 dk önce
  [Test bildirim gönder]  [Bağlantıyı Kaldır]

Bildirim tipleri (tablo) — 2026-05-14 OT2-1 + YT-5: 5 yeni event eklendi
  Tip                                  │ Ekran │ Telegram │
  Kritik stok düştü                     │  ☑   │   ☑      │
  Stok bitti                            │  ☑   │   ☑      │
  Yüksek tutarlı satış (eşik [₺5000])  │  ☐   │   ☑      │
  Yeni kullanıcı eklendi                │  ☑   │   ☐      │
  Plan limit yaklaşıyor                 │  ☑   │   ☑      │
  Günlük özet (21:00)                   │  ☐   │   ☑      │
  Haftalık özet (Pzt 09:00)             │  ☐   │   ☑      │
  ─────────── Abonelik + Fatura ───────────
  Abonelik ödemesi başarısız (past_due) │  ☑   │   ☑      │ ← subscription_payment_failed
  Abonelik yenilendi (başarılı tahsilat) │  ☐   │   ☑      │ ← subscription_renewed
  Fatura kesildi (e-Arşiv)              │  ☐   │   ☑      │ ← invoice_issued
  ─────────── Vitrin ───────────
  Vitrin onayı geçti                    │  ☑   │   ☑      │ ← vitrin_approved (otomatik onay sonrası)
  Vitrin şikayeti aldın                 │  ☑   │   ☑      │ ← vitrin_report_received (3 IP → otomatik gizleme uyarısı)

⚠ WhatsApp desteklenmiyor (eski karar geçersiz)
⚠ Abonelik ödemesi başarısız bildirimi **kapatılamaz** (zorunlu — past_due durumunda tenant uyarılmalı)
```

**Yeni event'ler için trigger noktaları (2026-05-14 OT2-1):**
- `subscription_payment_failed`: iyzico webhook `payment.failed` → `subscriptions.status = 'past_due'` set → bildirim
- `subscription_renewed`: iyzico webhook `payment.success` → `subscriptions.next_billing_at` ileri kaydırma → bildirim
- `invoice_issued`: Nilvera e-Arşiv kesim başarılı → `invoices` tablosuna kayıt → bildirim (PDF link e-posta)
- `vitrin_approved`: AI validation + storefront_status = 'approved' geçişi → bildirim (1 kez, idempotent)
- `vitrin_report_received`: `vitrin_reports` INSERT trigger (3+ aynı target için) → süperadmin + tenant bildirim

### 2.5 🔒 Güvenlik

> **2026-05-15 revize:** Auth akışları (login, register, email doğrulama, şifremi unuttum, email değiştirme, onboarding, CAPTCHA) `EKRAN-AUTH.md`'ye **taşındı**. Bu bölüm sadece **kullanıcı kendi paneli üzerinden değiştirebileceği** ayarları kapsar (şifre değiştir, 2FA aç/kapat, aktif oturum yönet, hesap kilidi gözden geçir).
>
> **Tam auth akış detayı:** `EKRAN-AUTH.md` — Login + Register + Email Verification + Forgot Password + Change Email + Onboarding + Turnstile + Account Lock + 13 alt-bölüm + 52 test senaryosu.

#### 2.5.1 Şifre Politikası (Referans Özet)

| Kural | Değer | Detay |
|---|---|---|
| Min uzunluk | **8 karakter** | OWASP modern minimum |
| Karmaşıklık | En az 1 rakam + 1 büyük harf | Sözlük saldırısına karşı |
| Hashing | **bcrypt cost 12** (`bcryptjs` — Workers uyumlu) | — |
| Geçmiş şifre kontrolü | Son 3 şifre tekrar kullanılamaz | `users.passwordHistory` jsonb son 3 hash |
| HIBP check | HaveIBeenPwned k-anonymity API | Bilinen veri sızıntısı şifreleri reddedilir |
| Periyodik zorla değişim | **YOK** (NIST 2017+ önerisi) | Zorla değişim güvensiz şifrelere yol açar |

UI'da şifre alanı altında **real-time strength indicator** (zayıf / orta / güçlü) — ek karakter sınıfı bonusu, sözlük kelime ceza. **Tam form akışı:** `EKRAN-AUTH §3` (register) + `§5` (forgot password reset).

#### 2.5.2 Brute Force Koruması (2026-05-15 sıkı policy — kullanıcı kararı)

> **Tam akış detayı:** `EKRAN-AUTH §2 + §10` (kalan hak UX + lock mekaniği + recovery)

| Tetik | Aksiyon |
|---|---|
| 5 başarısız login / 15 dk (IP başına) | Cloudflare Workers KV → **Cloudflare Turnstile** zorunlu (ek katman, hesap bazlı sayaçtan bağımsız) |
| 3+ başarısız login (hesap bazlı) | Frontend "kalan hak" banner: 3 yanlışta "3 hakkın kaldı", 4'te "2 hakkın kaldı + Şifremi Unuttum", 5'te "1 hakkın kaldı + 1 saat lock uyarı" |
| **5 başarısız login (hesap bazlı)** | Hesap **1 SAAT lock** + e-posta uyarı (IP/UA/şehir) + Telegram süperadmin alert + audit log |
| 3 ardışık 1-saat lock (consecutiveLockCount=3) | **24 SAAT kalıcı lock** + acil e-posta + 🚨 Telegram süperadmin kritik alert |
| Şifremi Unuttum tamamlama (lock aktifken bile çalışır) | failedLoginAttempts=0, consecutiveLockCount=0, lockedUntil=NULL — kullanıcı anında giriş yapabilir |
| Süperadmin Toolbox "Kilidi Aç" | Aynı reset + audit + opsiyonel tenant'a Telegram bildirim |

**Sıfırlama:**
- Başarılı login → failedLoginAttempts=0, consecutiveLockCount=0
- Lock süresi geçti → failedLoginAttempts=0 reset (consecutiveLockCount korunur)
- 7 gün hiç lock olmadıysa → consecutiveLockCount=0 (pg_cron weekly cleanup)

**Implementation:**
- IP rate-limit: Cloudflare Workers KV (`login_attempts:{ip}`, TTL 15 dk)
- Hesap rate-limit: `users.failedLoginAttempts` + `lockedUntil` + `consecutiveLockCount` (DB state)
- TOTP yanlışı sayılmaz (şifre doğru, sadece 2FA hatalı) — gerçek brute-force ayırt edilir

**Neden 2 yanlışta banner gösterilmiyor?** Parmak hatasıyla 1-2 yanlış doğal; 3. yanlış gerçek kafa karışıklığı sinyali → kullanıcıya yardımcı olmak şart (kalan hak + Şifremi Unuttum CTA). Detay: `EKRAN-AUTH §2.3` UX pattern.

#### 2.5.3 Şifre Sıfırlama

```
[Şifremi unuttum]
  → E-posta gir
  → Brevo SMTP üzerinden link gönderilir
  → Link: https://petstockpro.com/auth/reset?t=<JWT-30dk>
    • 30 dakika geçerli
    • Tek kullanımlık (kullanıldıktan sonra token blacklist)
    • Token JWT (HS256, jose) — userId + iat + jti
    • Rate-limit: 3 reset isteği/saat/IP
  → Yeni şifre + tekrar (politika §2.5.1 kontrolü)
  → Tüm oturumlar geçersiz (audit log)
  → Giriş yapılır
```

#### 2.5.4 2FA (TOTP — Google Authenticator / Authy)

```
Durum: ✗ Kapalı   veya  ✓ Aktif (kuruldu 2 ay önce)

[Aktive Et]
  → QR kod gösterilir + manual key (otpauth://totp/...)
  → Authenticator'da kaydet
  → 6 haneli kod doğrula
  → 8 recovery code üret (8 × 12 karakter) + indir/print
     • Her recovery code SHA-256 hashed olarak DB'ye yazılır
     • Plain text kullanıcıya SADECE bir kez gösterilir
     • Bir kod kullanıldığında DB'de "used" işaretlenir, geri dönüş yok
  → Aktif

[Recovery code'larımı göster]
  → Yeni 8 kod üret (eski tümünü geçersiz kıl — audit log)
  → Şifre doğrula gerekir

[2FA'yı Kapat]
  → Şifre + güncel TOTP kod doğrula
  → Tüm oturumlar geçersiz kılınır (güvenlik)
  → Audit log entry
```

**TOTP standartı:** RFC 6238 — 30 saniyelik time window, SHA-1, 6 digit. Time drift toleransı ±1 window (±30 sn).

#### 2.5.5 Şifre + 2FA İstatistikleri

```
Şifre
  Son değişiklik: 7 Mart 2026 (2 ay önce)
  Güç skoru: Güçlü (zxcvbn = 4/4)
  [Şifremi değiştir]
    → Mevcut şifre + yeni + onay
    → Yeni şifre §2.5.1 politikasına uymalı
    → 2FA aktifse TOTP kod da gerekli
```

#### 2.5.6 Aktif Oturumlar

```
Aktif oturumlar (2)
  Chrome Win · İstanbul · 2 dk önce (BU CİHAZ)
  Safari iPhone · İstanbul · 1 sa önce  [Çıkış yap]

[Tüm cihazlardan çıkış yap] → şifre doğrula + onay
```

Session expire: 30 gün rolling (her aktivitede yenilenir). 90 gün inaktif → otomatik logout.

#### 2.5.7 Hesap Silme

```
[⛔ Hesabımı Sil]
 → Onay modal + şifre doğrula (2FA varsa TOTP da)
 → 90 gün soft delete (deletedAt = NOW())
 → Bu 90 günde "Hesabımı geri aç" linki ile geri alınabilir
 → 90 gün sonra kalıcı imha (cascade: products, branches, vitrin_events)
 → Audit log 5 yıl anonim saklanır (KVKK madde 138 saklama yükümlülüğü)
```

### 2.6 📦 Veri / KVKK

```
Verilerimi indir (KVKK veri taşıma hakkı)
  Tüm verileri CSV+JSON olarak indir.

  Seçim (en az 1 zorunlu):
  ☑ Ürünler (35 kayıt)
  ☑ Stok hareketleri (1.250 kayıt)
  ☑ Satışlar (320 kayıt)
  ☑ Kullanıcılar (4)
  ☑ Tedarikçiler (8)
  ☑ Şubeler (3)

  [Verilerimi İndir]   ← 2026-05-14 YT-2: "İhracat Hazırla" terim değiştirildi (kullanıcı kafa karışıklığı)
   → Asenkron job (büyük tenant'lar için)
   → E-postaya zip linki gönderilir (~1-5 dakika)
   → Link 24 saat aktif

  ⚠ Rate-limit politikası (MANTIK-HATALARI K4 — DDoS koruma):
   • Günde max 3 export
   • Saatte 1 (cooldown — 60 dk sonra tekrar)
   • Output max 10 MB (üstü "Sadeleştirilmiş çıktı" modu)
   • Aynı anda max 3 aktif job (kuyrukta veya işleniyor)
   • Plan'a göre öncelik: PRO+ > PRO > FREE (FREE bekler, PRO+ hızlı)
   • Limit aşılırsa: "Bugün için limit doldu — yarın tekrar deneyin" toast

  Hata mesajları:
   • Hiç checkbox seçilmemiş → "En az 1 tablo seç" inline error
   • Saatlik limit → "60 dk önce export aldın, X dakika bekle"
   • Günlük limit → "Bugün 3 export aldın, yarın 09:00'da yeniden açılır"

  Son indirme: 5 Mart 2026 (2 ay önce) [Tekrar İndir]

KVKK aydınlatma metni
  [petstockpro.com/kvkk linki]

Veri sahibi hakları
  KVKK kapsamında talepler için: privacy@petstockpro.com

Veri silme talebi
  Yukarıdaki "Hesabımı Sil" akışı veya
  privacy@petstockpro.com'a yazılı talep.
```

## 3. State + API

| Endpoint | Method |
|---|---|
| `/api/admin/settings/company` | GET/PATCH |
| `/api/admin/settings/plan` | GET (mevcut plan + kullanım) |
| `/api/admin/settings/plan/upgrade-request` | POST (manuel yükseltme talebi) |
| `/api/admin/settings/locale` | PATCH |
| `/api/admin/settings/notifications` | GET/PATCH |
| `/api/admin/telegram/bind` | POST (kod doğrula) |
| `/api/admin/telegram/unbind` | DELETE |
| `/api/admin/telegram/test` | POST (test bildirim) |
| `/api/admin/2fa/setup` | POST (QR + recovery codes) |
| `/api/admin/2fa/verify` | POST |
| `/api/admin/2fa/disable` | POST |
| `/api/admin/sessions` | GET |
| `/api/admin/sessions/[id]` | DELETE |
| `/api/admin/account/delete` | POST (90 gün soft delete) |
| `/api/admin/data/export` | POST (asenkron job) |
| `/api/admin/invoices` | GET (fatura geçmişi) |

## 4. SUPERADMIN Ek Ayarlar (Faz 2'de)

Süperadmin için ek ayarlar `/admin/system-settings` altında — ANA `/admin` panelinde SUPERADMIN-only route (2026-05-14 mimari değişikliği: ayrı `/super-admin` URL'i YOK, role-based menü):
- Sistem rate limit
- E-posta şablonları
- Default plan parametreleri
- Telegram bot config

## 5. Kapsam Dışı Bırakılan Özellikler (2026-05-14 — 3-tier B + TR-only)

3-tier B geri açıldı (FREE/PRO/PRO+), **ama** aşağıdaki özellikler hâlâ **kapsam dışı** — PRO+ pricing'i bu özelliklerle değil, sadece **sınırsız stok** ile gerekçelendiriliyor. Felsefe: *"Tüm özellikler tüm planlarda açık. Sadece stok limiti farklı."* (PLAN-KADEMELERI §3)

- ❌ API anahtarları + Webhook'lar
- ❌ Custom domain (kendi domain bağlama)
- ❌ White-label tema / Custom CSS
- ❌ Öncelikli destek
- ❌ **Paddle / USD / EUR ödeme** (yurt dışı kapsamı) — TR-only kararı 2026-05-14
- ❌ **EN locale aktif kullanım** — next-intl yapısı kalır ama UI'da gizli, sadece TR

📅 **Bayi Admin** (multi-tenant viewer) — Faz 3 (plan'dan bağımsız ayrı karar, schema hazır)

## 6. Test Senaryoları

- SET-001 Şirket profili düzenleme
- SET-002 Vergi adresi değişimi → currency etkisi onay
- SET-003 Plan yükseltme: manuel havale akışı
- SET-004 Plan iptal: dönem sonu warning
- SET-005 Locale TR-only (EN seçeneği gizli/disabled, TR-only kararı)
- SET-006 Currency TRY zorunlu (USD/EUR seçeneği yok, TR-only kararı)
- SET-006b Plan karşılaştırma 3 sütun (FREE/PRO/PRO+) görünümü doğru
- SET-006c PRO+ → PRO downgrade akışı: 500+ ürün isActive=false (pasif mod), 30 gün seçim (PLAN-KADEMELERI §5.3 referans)
- SET-007 Telegram bağlama: 3 adım
- SET-008 Telegram test bildirim gönderir
- SET-009 Bildirim tipleri toggle (ekran/Telegram)
- SET-010 2FA aktive: QR + recovery codes
- SET-011 2FA kapat: şifre doğrula
- SET-012 Aktif oturum kapat (uzaktan)
- SET-013 Hesap sil: 90 gün soft delete
- SET-014 Veri export: asenkron + e-posta link
- SET-015 KVKK linkleri çalışıyor

## 7. Faz 1 Uyumu

✅ §25 yapı korundu (6 bölüm + sol sidebar pattern)
✅ Telegram bağlama 3 adım
✅ 2FA TOTP
✅ Hesap silme 90 gün soft delete
✅ Veri export asenkron

## 8. Sıradaki

⏭ EKRAN-SUPERADMIN.md
