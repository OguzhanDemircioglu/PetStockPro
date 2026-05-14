# Ekran: Süperadmin Paneli

> **🚀 2026-05-14 Mimari Değişikliği — Ayrı sayfa YOK, role-based menü:**
>
> **CLAUDE.md #1 kural (tek geliştirici sade tut)** gereği "Süperadmin Paneli" ayrı bir URL / subdomain / sayfa **değildir**:
> - ❌ `/super-admin` URL'i **kaldırıldı** → tek `/admin` URL'i
> - ❌ `super.petstockpro.com` subdomain **YOK** (DNS'te de yok)
> - ❌ Ayrı login sayfası **YOK** — `/login` → Auth.js → `/admin` (rol fark etmez)
> - ✅ **SUPERADMIN role'lü kullanıcı `/admin` sidebar'ında ek menüler görür:** 🔧 Sistem · 🏢 Tüm Tenant'lar · 📊 Sistem Logları · 🚨 Vitrin Modlama
> - ✅ Normal ADMIN bu menüleri **hiç görmez** (sidebar render zamanında role-based filtre)
> - ✅ Route guard: SUPERADMIN-only sayfalara ADMIN doğrudan URL ile giderse → `403 Forbidden`
> - ✅ JWT claim `user_role='SUPERADMIN'` middleware'de kontrol edilir (2026-05-14 KT2-1: eski `is_superadmin` claim kaldırıldı, tek kaynak)
> - ✅ "Süperadmin paneli" kavramı dokümantasyonda kalır AMA = "ADMIN panelinin SUPERADMIN-only sidebar alt grubu" demektir, ayrı bir sayfa değil
>
> Bu doküman içerikteki **tüm `/super-admin/*` URL referansları `/admin/*` ile değiştirilmiştir.** İmpersonation akışı, Toolbox FAB, 3 sekme, audit, plan onay vb. tüm fonksiyonalite **korunur** — yalnız URL ve "ayrı sayfa" söylemi değişti.

> **🚨 2026-05-13 felsefe netleştirme:** Süperadmin **operasyonel müdür değil**, site sahibinin **kişisel kontrol/müdahale paneli**. Amacı:
> - ✅ İzleme (tenant'lar, audit, sistem sağlığı)
> - ✅ Acil müdahale (kullanıcı yanlış yaptığında — hard delete, plan limit override, sayım geri al, şifre/2FA reset, eksi stok zorlama)
> - ✅ Tenant'a girme (impersonation — "ekrandan bakıp yardım et")
> - ❌ **Operasyonel onay süreçleri YOK** (vitrin başvuru, plan onay → bunlar otomatik olmalı)
>
> Süperadmin günde 5-15 dakika kullanılan bir panel — saat saat queue temizleyen değil. Otomatik akışlar default, süperadmin sadece **anomali** durumlarında devreye girer.

**URL (tüm SUPERADMIN sayfaları `/admin` namespace'i altında — ayrı subdomain/path YOK):**
- Tenant listesi: `/admin/tenants`
- Tenant detay: `/admin/tenants/[id]`
- Audit: `/admin/audit`
- Plan onay: `/admin/plan-approval`
- **DB Inspector:** `/admin/db-inspector` (yeni)
- **Sistem Ayarları:** `/admin/system-settings` (yeni)
- Sistem sağlığı: **harici link** (Supabase Dashboard) — R4

> SUPERADMIN için "panel" = ADMIN sidebar'a eklenen ek alt grup. Login akışı normal ADMIN ile aynı: `/login` → Auth.js → `/admin`. SUPERADMIN role'lü kullanıcı sidebar'da yukarıdaki ek route'ları görür ve tıklayabilir; normal ADMIN bu URL'leri sidebar'da görmez, doğrudan adres çubuğundan girerse `403` alır.

**Sidebar yeri:** ANA `/admin` sidebar'ında **alt grup** — `SUPERADMIN` ikon (kalkan 🛡). Sidebar render'da `user.role === 'SUPERADMIN'` filtre. Normal ADMIN için bu grup hiç render edilmez.
**Erişim:** SADECE SUPERADMIN rolü (tek kişi, site sahibi). JWT'de `user_role='SUPERADMIN'` claim + hard backend check (2026-05-14 KT2-1)
**Referans:** Faz 1 §17 + §20 R4 + **`SUPERADMIN-YETKILERI.md`** (yetki kataloğu)
**Tasarım sistemi:** `TASARIM-SISTEMI.md`

> Süperadmin **iki rol birden** oynar: (1) İmpersonation ile tenant'a kapı açar, (2) **Tenant'ın yapamadığı sistem kurallarını bypass edebilir** (`SUPERADMIN-YETKILERI.md`). Tüm aksiyonlar audit'lenir. 2FA zorunlu.

## ⚠ KAPSAM GÜNCELLEMESİ (2026-05-13)

Süperadmin sadece "tenant'a kapı açan" değil — **tenant'ın yapamadığı işlemleri yapan** kişi. 4 kategori yetki:

1. **Sistem kurallarını bypass:** 24h geri alma sınırı yok say · Sayım geri al · Hard delete · Eksi stoğa zorla · Plan limit override · Immutable metadata düzelt
2. **DB Inspector:** SELECT-only sorgu (default) + kilitli UPDATE/DELETE/INSERT modu · Hazır script kataloğu · PIT recovery tetik
3. **Sistem ayarları:** Plan tier'lar · Feature flags · Default kategoriler · Email şablonlar · Telegram bot · Sistem broadcast
4. **Uzak kullanıcı yönetimi:** Şifre anında reset · 2FA reset · Tüm oturum invalidate · Hesap kilitle/aç

UI'da bu yetkiler **Süperadmin Toolbox FAB** (sağ alt floating button) üzerinden erişilebilir. Detay: `SUPERADMIN-YETKILERI.md` §3.

---

## 1. Layout

```
┌─────────┬──────────────────────────────────────────────────┐
│ Sidebar │ Topbar (PetStockPro · SUPERADMIN moduyla giriş)  │
│         ├──────────────────────────────────────────────────┤
│         │ ─ Sekmeler ────────────────────────────────────  │
│         │ [Tenant'lar] [Audit] [Plan Onay] [Sistem ↗ Aiven]│
│         │                                                    │
│         │ Aktif sekme içeriği                                │
│         │                                                    │
└─────────┴──────────────────────────────────────────────────┘

+ İmpersonation sticky bant (sayım aktifken her sayfada)
```

## 2. Süperadmin Toolbox FAB — Override Yetkileri

İmpersonation altındayken sayfanın **sağ altında sticky FAB** (Floating Action Button):

```
                                                ╭──────────────╮
                                                │ 🛡  Toolbox   │  ← FAB (sağ alt)
                                                ╰──────────────╯
                                                       │ tıkla
                                                       ▼
            ┌──────────────────────────────────────────┐
            │  🛡 SÜPERADMIN TOOLBOX                    │
            │  Bağlam: Mavi Pet Shop · Stok Hareketleri│
            ├──────────────────────────────────────────┤
            │  Bu Sayfada:                              │
            │  • Süresi geçmiş hareket geri al          │
            │  • Sayımı geri al                         │
            │  • Eksi stoğa zorla giriş                 │
            │                                          │
            │  Genel Override:                         │
            │  • DB Inspector                          │
            │  • Hard delete                           │
            │  • Şifre/2FA reset                       │
            │  • Plan limit override                   │
            │  • Sistem Ayarları →                     │
            │                                          │
            │  ⚠ Her aksiyon 🚨🚨 audit'le              │
            ╰──────────────────────────────────────────╯
```

### 2.1 FAB Spesifikasyonu

- **Görünürlük:** SUPERADMIN session + impersonation aktifken (veya `/admin/tenants`, `/admin/audit`, `/admin/db-inspector`, `/admin/system-settings`, `/admin/plan-approval` gibi SUPERADMIN-only rotalarda her zaman). Normal ADMIN sayfalarında FAB **hiç render edilmez**.
- **Konum:** `position: fixed; bottom: 24px; right: 24px; z-index: 30`
- **Renk:** `--cat` gradient + 3s pulse animation
- **Boyut:** 56×56 desktop / 48×48 mobile
- **İkon:** 🛡 (kalkan) + opsiyonel "Toolbox" yazısı küçük
- **Açılış:** Smooth slide-up panel (300ms ease)

### 2.2 Bağlam-Aware Menü

Toolbox **aktif sayfaya göre** ilgili aksiyonları gösterir:

| Sayfa | Toolbox aksiyonları |
|---|---|
| Stok Hareketleri | Süresi geçmiş geri al · Sayım geri al · Immutable metadata düzelt |
| Ürünler | Hard delete · Plan limit override · Variant axis değiştir |
| Kullanıcılar | Şifre reset · 2FA reset · Oturum kapat · Kilitle |
| Sayım | Sayımı geri al · Tamamlanmamışı temizle |
| Ayarlar (tenant) | Tenant override settings · Sistem ayarlarına yönlendir |
| Süperadmin paneli | DB Inspector · Sistem ayarları · Sistem Broadcast |

### 2.3 Her Override için Modal İskeleti

```
┌────────────────────────────────────────────────┐
│ 🛡 Süperadmin Override                         │
│ Aksiyon: Süresi geçmiş hareketi geri al        │
├────────────────────────────────────────────────┤
│ Tenant: Mavi Pet Shop A.Ş.                     │
│ Hedef: Hareket #1248 · 35 gün önce             │
│ Etki: Stok 49 → 25 (24 adet geri yüklenir)    │
│                                                  │
│ Sebep (zorunlu, min 30 char):                  │
│ [textarea]                                       │
│                                                  │
│ ☐ Tenant'a bildirim gönder                      │
│                                                  │
│ Şifrenizi tekrar girin (güvenlik):              │
│ [password input]                                 │
│                                                  │
│   [İptal]  [🛡 Süperadmin olarak onayla]       │
└──────────────────────────────────────────────────┘
```

Detay yetki listesi: `SUPERADMIN-YETKILERI.md`

---

## 3. Sekmeler (2026-05-13 revize — 4 sekme + harici)

> **Önemli:** Vitrin merkezi dizini eklenmesiyle (`petstockpro.com/vitrin` — `EKRAN-PUBLIC-VITRIN §20`), süperadmin'in **vitrin modlama** sorumluluğu doğdu. 3 sekme → **4 sekme**.

### 2.1 Tenant'lar

```
KPI üst şerit:
  🏢 47 toplam tenant · 💳 20 PRO · 27 FREE · ⚠ 2 askıda

Arama: [İsim/e-posta/vergi no]
Filtre: [Plan ▼] [Durum ▼] [Kayıt tarihi ▼]

Tablo:
┌─────────────────────────────────────────────────────────────┐
│ Şirket          │ Plan │ Kullanıcı │ Ürün │ Son aktif│⚙   │
├─────────────────────────────────────────────────────────────┤
│ Mavi Pet Shop   │ PRO  │   4       │ 184  │ 2 dk önce│[⚙] │
│ Pet Butik İzmir │ FREE │   1       │  47  │ 1g önce  │[⚙] │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘

[⚙ menü]: 👁 Detay · 🎭 İmpersonate · 💳 Plan değiştir · ⛔ Askıya al
```

### 2.2 Tenant Detay Drawer

```
┌── Mavi Pet Shop A.Ş. ────────────────────────────[×]┐
│ ID: tenant-aa12bb · vergi: 1234567890                │
│ Üyelik: 7 Mart 2026 (2 ay) · PRO Plan                │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Genel İstatistikler                                   │
│   Kullanıcı: 4 (1 sahip + 3 müdür)                   │
│   Şube: 3                                             │
│   Ürün: 184 (parent), 412 SKU (variant)              │
│   Stok değeri: ₺85.400                               │
│   Toplam hareket (lifetime): 12.450                  │
│   Bu ay aktivite: 850 hareket, ₺38.500 satış          │
│                                                       │
│ Fatura geçmişi                                        │
│   PRO Plan · Aylık ₺500                              │
│   Sonraki tahsilat: 7 Haz 2026                       │
│   Ödenmiş: ₺1.000 (Apr + May)                        │
│   [Fatura geçmişini gör]                             │
│                                                       │
│ Aksiyonlar                                            │
│   [🎭 Bu Tenant'a Gir]                               │
│   [💳 Plan Değiştir]                                 │
│   [⛔ Askıya Al]                                      │
│   [📧 Bayi sahibine mesaj gönder]                    │
│                                                       │
│ Tenant audit (son 30g)                                │
│   850 hareket · 5 kullanıcı login · 2 plan onayı     │
│                                                       │
│ Tehlike bölgesi                                       │
│   [⛔ Tenant'ı Sil]                                  │
│    → 90 gün hard delete confirmation                  │
└───────────────────────────────────────────────────────┘
```

### 2.3 Audit Sekmesi

```
Sistem geneli audit log (tüm tenant'lar)

Filtre: Tenant · Kullanıcı · Tarih · Action type · 🚨 Süperadmin işaretli

Tablo:
Tarih │ Tenant │ Kullanıcı │ Action │ Detay │ IP │ 🚨 │
07May │ MaviPet│ Ahmet     │ stock_movement.create │ +24 R.Canin │ 78.x │ — │
07May │ MaviPet│ SuperAdmin│ stock_movement.create │ +5 (impers.)│ 78.x │🚨 │
...

Export: [⬇ CSV]
```

### 2.4 Plan Onay Sekmesi

```
Manuel havale plan yükseltme onayları

[Beklemede 3] [Onaylanmış] [Reddedilmiş]

Beklemede 3 talep:

┌── Pet Butik · FREE → PRO ────────────────────────────┐
│ Tarih: 5 May 2026                                      │
│ Talep eden: ayse@petbutik.com                          │
│ Talep mesajı: "Bu ay 500₺ havale yaptım, ekte dekont" │
│ Dekont: [📎 dekont.pdf] (görüntüle)                   │
│                                                         │
│   [Reddet]  [Onayla → PRO Aktive Et]                  │
└─────────────────────────────────────────────────────────┘

┌── ... 2 talep daha                                     ┐
```

**Onay sonrası:**
- `companies.plan = 'PRO'`
- `subscriptions` tablosuna kayıt
- Tenant'a e-posta + Telegram bildirim
- Audit log `plan.upgrade.approved` performed_as_superadmin=true

**Faz 2'de:** iyzico Subscription otomatik onay (manuel sadece edge case'lerde)

### 2.5 Vitrin Modlama (4. sekme — 2026-05-14 OTOMATİK ONAY revize)

> **Felsefe:** Vitrin başvuru onayı **otomatik** çalışır. Süperadmin sadece **otomatik reddedilen** veya **müşteri/sistem tarafından bildirilen anomali** durumlarına bakar. Saat saat queue işleyen değil, anomali yöneten panel.

```
KPI üst şerit:
  ✓ Bu hafta otomatik onay: 47 · ⚠ Manuel inceleme: 2 · 🚩 Açık bildirim: 3
  📊 Otomatik onay oranı: %94 (son 30g) · Manuel inceleme ort. süre: 18 saat

Alt-sekmeler:
[Manuel İnceleme (2)] [Bildirimler (3)] [Otomatik Filter (8)] [Onay Logları] [Bayi Admin (Faz 3)]
```

#### 2.5.1 Otomatik Onay Akışı (süperadmin'e değmez — %94)

Pet shop "Vitrin'de görün" toggle'ı açtığında **backend otomatik validation** çalışır:

```
✓ Vergi no formatı doğru (10/11 hane + checksum — şirket VKN veya şahıs TC)
✓ WhatsApp numarası doğrulanmış (Telegram code-based akış, EKRAN-AYARLAR §2.1)
✓ En az bir şubenin lat/lng dolu (PostGIS yakınlık için zorunlu)
✓ Profil tamlığı %80+ (logo + kapak + kısa açıklama + çalışma saatleri)
✓ KVKK onay tarihi var
✓ Otomatik filter temiz (küfür/telif/spam kontrol)

→ Hepsi PASS → companies.storefront_status = 'approved' (ANINDA, süperadmin'e değmez)
→ Tenant'a Telegram + e-posta bildirim ("✓ Vitrin'in yayında")
→ Audit log: storefront.auto_approved (performed_as_superadmin=false)
→ Pet shop merkezi dizinde anında görünür
```

Süperadmin sadece **validation FAIL** olduğunda devreye girer (Manuel İnceleme alt-sekmesi).

#### 2.5.2 Manuel İnceleme Alt-Sekmesi (otomatik reddedilen)

Otomatik validation'da takılan başvurular:

```
Manuel inceleme (2):

┌─ Test Pet Shop Ankara ───────────────────────────────────────┐
│ Tarih: 12 May 2026 · 09:14                                      │
│                                                                  │
│ Otomatik validation sonucu:                                     │
│  ✓ Vergi no: 1234567890                                         │
│  ✗ WhatsApp doğrulanmadı (3 kez denedi, kod gelmedi)           │
│  ✓ En az 1 şubenin lat/lng'si dolu                             │
│  ⚠ Profil tamlığı %72 (kapak fotoğrafı eksik)                  │
│  ✓ KVKK onay 12 May, 09:10                                      │
│  ⚠ Otomatik filter: "test" kelimesi (şüpheli, ayırdedilemez)   │
│                                                                  │
│ Süperadmin kararı:                                              │
│   [👁 Önizle]  [🛡 İmpersonate]  [✓ Manuel Onayla]  [✗ Reddet]│
│                                                                  │
│ Not: Tenant'a "WhatsApp doğrulamayı tekrar dene" hatırlatması   │
│ otomatik gönderildi (3 gün önce). Hala düzeltmedi.              │
└──────────────────────────────────────────────────────────────────┘
```

**Manuel onay** sebep zorunlu (audit için). **Reddet** ile pet shop'a e-posta + Telegram bildirim (eksiklikler net açıklanır).

#### 2.5.3 Bildirimler Alt-Sekmesi

Müşterilerden gelen pet shop/ürün şikayetleri:

```
Açık bildirimler (3):

┌─ Bildirim #45 ─────────────────────────────────────────────────┐
│ Tip: Sahte ürün şüphesi                                          │
│ Hedef: Royal Canin Kedi 2kg @ Test Pet Shop                    │
│ Bildiren IP hash: a1b2c3... (anonim, KVKK)                     │
│ Tarih: 4 May 2026 · 09:12                                        │
│ Açıklama: "Bu ürünün resmi yanlış, Royal Canin orijinal değil"  │
│                                                                   │
│ Tenant geçmişi: 0 önceki bildirim · 2 ay üye                    │
│                                                                   │
│   [👁 Ürünü Görüntüle]  [🛡 Tenant'ı incele]                   │
│   [Sil] [Geçersiz işaretle] [Tenant'a uyarı gönder]             │
└────────────────────────────────────────────────────────────────┘
```

**Aksiyonlar:**
- **Sil:** Ürün vitrin'den çekilir + tenant'a bildirim (`product.removed_by_admin`)
- **Geçersiz:** Bildirim kapanır, ürün etkilenmez
- **Tenant'a uyarı gönder:** Telegram + e-posta uyarı, "3. uyarıda hesap askıya alınır" notu

#### 2.5.4 Otomatik Filter Alt-Sekmesi

Sistem otomatik tespit ettiği şüpheli içerikler:

```
Otomatik filter yakaladıkları (8):

  Tip                    │ Hedef                  │ Sebep                │ Aksiyon
  ─────────────────────────────────────────────────────────────────────────
  Küfür listesi          │ Ürün açıklaması        │ "küfür kelimesi"    │ [İncele]
  Telif şüphesi (resim)  │ Ürün resmi             │ "Royal Canin logo"  │ [İncele]
  Spam profil            │ Pet shop hakkımızda    │ "10x kelime tekrar" │ [İncele]

[Filter sözlüğü düzenle] (system_settings)
```

**Sözlük yönetimi:** `system_settings.value` JSON — küfür kelimeleri, telif markaları, vb.

#### 2.5.5 Onay Logları Alt-Sekmesi (yeni 2026-05-14)

Son 30 gün otomatik + manuel onay geçmişi (raporlama amaçlı):

```
Onay logları (son 30g):
  Tarih  │ Tenant      │ Sonuç           │ Tetikleyici  │ Süre
  ───────────────────────────────────────────────────────────────
  14 May │ Mavi Pet    │ ✓ Auto-onay      │ Sistem       │ 0.3sn
  14 May │ Pati Shop   │ ✓ Auto-onay      │ Sistem       │ 0.4sn
  13 May │ Test Shop   │ ⚠ Manual review  │ Sistem       │ —
  12 May │ Acme Pet    │ ✓ Manuel onay    │ Süperadmin   │ 14sa
  ...

[CSV indir]
```

#### 2.5.6 Bayi Admin İlişkileri Alt-Sekmesi (Faz 3)

> **MVP'de KAPALI — Faz 3'e saklandı (2026-05-13 kararı).** Tablo + enum hazır (DATABASE-SCHEMA §3.9), ama UI Faz 3'te eklenir.

Faz 3'te aktive olunca:
- Bekleyen bayi admin davetleri liste
- Aktif bayi admin ilişkileri (kim kimi izliyor)
- Şikayet/iptal yönetimi
- Bayi admin hesabı oluşturma/silme (süperadmin yetkisi)

### 2.6 Sistem Sağlığı (Harici Link — R4)

```
Topbar'da link butonu: [Sistem Sağlığı ↗]

Tıklama → yeni sekme:
  • Aiven Dashboard (Postgres metrik) veya
  • Supabase Dashboard (DB + Auth + Realtime + Storage)
  • Cloudflare Analytics (CDN + DDoS)
  • Sentry (error tracking)
  • Vercel/CF (build + traffic)

Self-hosted system health UI YOK (R4 kararı — gereksiz tekrar)
```

---

## 3. İmpersonation Akışı

### 3.1 Başlatma

```
Tenant tablosundan tenant seç → 🎭 İmpersonate

┌── Tenant'a Gir ───────────────────────────────┐
│ Mavi Pet Shop A.Ş.                              │
│                                                  │
│ Seviye:                                          │
│   ◉ Şirket bütünü (bayi sahibi yetkisi)        │
│   ○ Belirli şube (şube müdürü yetkisi)         │
│     Şube: [Merkez ▼]                            │
│                                                  │
│ Sebep (zorunlu — audit):                        │
│ [Müşteri destek - "fiyat değiştiremiyorum"]    │
│                                                  │
│ ☑ Sessiz mod (default açık)                     │
│   Tenant'a bildirim gönderilmez.                │
│   Destek için ideal.                            │
│   Kapalıysa tenant anlık toast görür.           │
│                                                  │
│ Süre: 120 dk timeout                             │
│                                                  │
│     [İptal]  [🎭 Gir]                          │
└──────────────────────────────────────────────────┘
```

### 3.2 İmpersonation Sırasında

**Sticky sarı bant** (her sayfada üstte):

```
🚨 SÜPER ADMİN MODU · Mavi Pet Shop'a giriş yaptın · 117dk kaldı · [Çık]
```

- Sarı bg (`--warning`), siyah text, dikkat çekici
- 120 dk timer geri sayım
- "Çık" tıklama → `/admin/tenants`'a geri yönlendirme (SUPERADMIN tenant listesi)
- 5 dk kala uyarı toast: "5 dakika sonra otomatik çıkış"
- Timer dolunca otomatik çıkış + modal "Süren doldu, `/admin/tenants`'a dönüldü"

**Yapılan her aksiyon:**
- `audit_logs.performed_as_superadmin = true`
- `audit_logs.superadmin_session_id = uuid` (session takip)
- Stok Hareketleri feed'inde 🚨 işareti
- Notification (sessiz mod kapalıysa tenant'a)

### 3.3 Sessiz Mod

**Default açık (true):**
- Tenant'a bildirim gönderilmez
- Müşteri destek senaryosu için ideal
- Audit log yine yazılır

**Kapalı (false):**
- Tenant'a anlık toast: "🚨 Süperadmin oturumda — destek incelemesi"
- Telegram bildirim (eğer bağlıysa)
- E-posta bildirim (24 saat içinde özet)
- Transparent operasyon için

### 3.4 Çıkış

```
"Çık" tıkla → onay modal:
  "Mavi Pet Shop'tan çıkış yap?
   Bu oturumda 4 aksiyon kaydedildi.
   Hepsi audit'e işlendi.
   [Vazgeç]  [Çıkış]"
```

Çıkış sonrası:
- JWT impersonation token → süperadmin token
- `/admin/tenants/[id]` detay drawer'a geri dön
- Session özet toast: "Çıkış başarılı · 4 aksiyon kaydedildi"

---

## 4. SUPERADMIN Güvenlik

### 4.1 2FA Zorunlu

- SUPERADMIN için 2FA **zorunlu** (kayıt sonrası ilk girişte aktive etmeden devam edilemez)
- Recovery code'lar offline saklama önerilir
- 2FA kaybedilirse: e-posta + manuel destek

### 4.2 JWT Yapısı

```ts
{
  sub: "user-id",
  email: "...",
  user_role: "SUPERADMIN",     // 2026-05-14 KT2-1: tek kaynak (eski `is_superadmin: true` claim kaldırıldı)
  impersonating: {             // varsa
    company_id: "tenant-...",
    branch_id: null | "branch-...",
    session_id: "super-...",
    started_at: "...",
    expires_at: "...",
    silent: true,
    reason: "Müşteri destek"
  }
}
```

### 4.3 Backend Hard Check

Her SUPERADMIN endpoint'inde:
```ts
if (user.role !== 'SUPERADMIN') throw new ForbiddenError(403);  // 2026-05-14 KT2-1

// İmpersonation altında ek check:
if (request.method === 'WRITE' && user.impersonating) {
  await auditLog.write({
    performed_as_superadmin: true,
    superadmin_session_id: user.impersonating.session_id,
    ...
  });
}
```

### 4.4 IP Whitelist (Opsiyonel Faz 2)

SUPERADMIN için sabit IP listesi (ev + ofis). Bu IP'ler dışından login uyarı + 2FA + e-posta onay.

---

## 5. State + API

| Endpoint | Method |
|---|---|
| `/api/admin/superadmin/tenants` | GET (liste) |
| `/api/admin/superadmin/tenants/[id]` | GET (detay) |
| `/api/admin/superadmin/tenants/[id]/suspend` | POST (askıya al) |
| `/api/admin/superadmin/tenants/[id]/delete` | POST (hard delete 90 gün confirmation) |
| `/api/admin/superadmin/impersonate` | POST (token üret) |
| `/api/admin/superadmin/impersonate/end` | POST (session bitir) |
| `/api/admin/superadmin/audit` | GET (tüm tenant audit) |
| `/api/admin/superadmin/audit/export` | GET (CSV) |
| `/api/admin/superadmin/plan-approval` | GET (beklemede) |
| `/api/admin/superadmin/plan-approval/[id]/approve` | POST |
| `/api/admin/superadmin/plan-approval/[id]/reject` | POST |
| `/api/admin/superadmin/stats` | GET (KPI şeridi) |

> Tüm SUPERADMIN endpoint'leri `/api/admin/*` namespace altında — ayrı `/api/super-admin/*` namespace YOK. Her endpoint başında `if (user.role !== 'SUPERADMIN') return 403` hard check.

---

## 6. Test Senaryoları

- SA-001 SUPERADMIN olmayan ADMIN kullanıcı doğrudan `/admin/tenants`, `/admin/audit`, `/admin/db-inspector` vb. SUPERADMIN-only route'a gider → 403 (sidebar'da da görünmez)
- SA-002 2FA olmayan SUPERADMIN ilk girişte 2FA zorunlu
- SA-003 Tenant tablosu: 47 tenant + filtreler
- SA-004 Tenant detay drawer: istatistikler + audit
- SA-005 İmpersonation başlatma: seviye + sebep + sessiz mod
- SA-006 İmpersonation: sticky sarı bant her sayfada
- SA-007 İmpersonation: timer 120dk, 5dk kala uyarı
- SA-008 İmpersonation: 120dk dolunca auto-çıkış
- SA-009 İmpersonation içinde aksiyon: audit 🚨 + session_id
- SA-010 Sessiz mod açık: tenant'a bildirim YOK
- SA-011 Sessiz mod kapalı: tenant'a anlık toast + Telegram
- SA-012 Çıkış: onay modal + session özet
- SA-013 Audit sekmesi: filtre + 🚨 işaretli
- SA-014 Plan onay: bekleyen 3 talep + dekont
- SA-015 Plan onay onayla: tenant plan değişir + bildirim
- SA-016 Sistem Sağlığı: harici Aiven/Supabase link
- SA-017 Tenant askıya alma: kullanıcı login bloklanır
- SA-018 Tenant silme: 90 gün soft delete confirmation
- SA-019 IP whitelist (Faz 2) — disabled MVP

## 7. Faz 1 Uyumu

✅ §17 İki seviye impersonation (şirket/şube)
✅ §17 R4 4 sekme → 3 sekme + harici Sistem Sağlığı
✅ §17 Sticky sarı bant + 120dk timeout
✅ §17 Sessiz mod default açık
✅ §17 2FA SUPERADMIN için zorunlu
✅ §17 performed_as_superadmin damgası
✅ §17 JWT user_role='SUPERADMIN' + hard backend check (2026-05-14 KT2-1)

## 8. Sıradaki

✅ Tüm 11 ekran tasarım belgesi tamamlandı:
- EKRAN-PANO ✓
- EKRAN-URUNLER ✓
- EKRAN-STOK-HAREKETLERI ✓
- EKRAN-DUSUK-STOK ✓
- EKRAN-SAYIM ✓
- EKRAN-SUBELER ✓
- EKRAN-TEDARIKCILER ✓
- EKRAN-KULLANICILAR ✓
- EKRAN-RAPORLAR ✓
- EKRAN-AYARLAR ✓
- EKRAN-SUPERADMIN ✓ (bu doküman)

⏭ **DATABASE-SCHEMA.md** — Drizzle schema (tüm ekranlar için tablo + ilişki + RLS politikası)
⏭ **Sprint plan revize** (yeni stack)
⏭ **Sprint 0** (proje skeleton)

---

*Son güncelleme: 2026-05-12. Tüm 11 ekran tasarım belgesi tamamlandı.*
