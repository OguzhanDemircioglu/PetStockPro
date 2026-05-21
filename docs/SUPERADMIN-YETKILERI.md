# PetStockPro — Süperadmin Yetki Sistemi

**Tarih:** 2026-05-12
**Durum:** Onaylanmış kapsam, MVP'de tam implement
**Kapsam:** Sistem kuralları bypass + Veri düzeltme + Sistem config + Uzak kullanıcı yönetimi
**UI:** Süperadmin Toolbox FAB (impersonation altında sağ alt floating button)
**Referans:** `EKRAN-SUPERADMIN.md` + `DATABASE-SCHEMA.md`

> Süperadmin **iki rol birden** oynar: (1) İmpersonation ile "tenant'ın bayi sahibi" gibi davranır, (2) Sistem kurallarını **bypass eden** süper yetkili kişidir. Bu doküman **(2)'nin** yetki kataloğudur. Her yetki için: tetik koşulu, UI, audit, güvenlik.

---

## 1. Felsefe — Tenant ≠ Süperadmin

| Konu | Tenant (ADMIN) | Süperadmin (sistem sahibi) |
|---|---|---|
| Stok hareketi geri alma | 24 saat (R1) | **Süresiz** + sebep |
| Sayım geri alma | ❌ Yapamaz | **Yapabilir** + zorunlu sebep |
| Hard delete | ❌ Soft delete | **Hard delete** + audit |
| Eksi stok | ❌ Backend reddeder | **Zorla giriş** + sebep |
| Plan limit | ❌ 402 Payment Required | **Override** + tenant'a yansıtmaz |
| Audit log | Görür (kendi tenant) | Görür + export + filtre tüm tenant |
| Audit log düzenleme | ❌ İMMUTABLE | ❌ İMMUTABLE (kimse yapamaz — yasal disiplin) |
| Tenant kullanıcı şifre sıfırla | Bayi sahibi e-posta gönderir | **Anında zorla sıfırla** + e-posta |
| Sistem ayarları | ❌ | **Tam erişim** |
| DB-level veri düzelt | ❌ | **DB Inspector** ile |

**Kural:** Audit log immutable kalır — süperadmin bile değiştiremez. Bu KVKK + yasal güvenlik için kritik. Her override yeni satır olarak audit'e yazılır.

---

## 2. 4 Yetki Kategorisi

### 🔓 Kategori 1: Sistem Kurallarını Bypass

Tenant'ın yetkili olmadığı, sistem kuralı tarafından bloklanan işlemleri **özel olarak** yapma.

#### 1.1 Süresi Geçmiş Hareket Geri Alma

**Senaryo:** Bir tenant 30 gün önceki bir satışı yanlış kaydetmiş, fark ettiğinde 24h penceresi geçmiş. Tenant "karşı hareket gir" diyemiyor (yanlış mesela: müşteri iade etti, ama biz iadeyi başka kayıt olarak girmek istemiyoruz).

**Tenant:** ❌ Buton disabled, "24h geçti"
**Süperadmin:** ✓ "Süresi geçmiş geri al" butonu (impersonation altında Toolbox FAB üzerinden)

**Akış:**
1. Süperadmin tenant'ta impersonation altında Stok Hareketleri'nde hareket detay aç
2. Sağ alt FAB tıkla → Toolbox açılır
3. "Süresi geçmiş geri al (30 gün önce)" butonu
4. Modal: zorunlu sebep (min 30 char) + çift onay
5. Backend `stock_movements.reverse` çağrısı `force=true` flag ile
6. Audit log: `superadmin.bypass.expired_reversal` + sebep + 🚨🚨

#### 1.2 Sayım Geri Alma

**Senaryo:** Sayım yanlış girilmiş, tenant farkı sebep yanlış kategorize etmiş. Tenant tekrar sayım yapmak istemiyor (gerçek stok bilgisi var).

**Tenant:** ❌ "Sayım geri alınamaz" kati kural
**Süperadmin:** ✓ "Sayımı geri al" (Toolbox üzerinden)

**Akış:**
1. Tamamlanmış sayım detay drawer'ı aç
2. Toolbox: "Sayımı geri al" butonu
3. Modal: ⚠ Uyarı: "Bu eylem ledger'da N karşı entry yaratır. Eski sayım entries'i `reversed_by_id` ile işaretlenir, branch_inventory eski değerlere döner."
4. Sebep zorunlu
5. Backend `stocktake.reverse` (yeni endpoint — sadece süperadmin)
6. Audit log: `superadmin.bypass.stocktake_reverse`

#### 1.3 Hard Delete

**Senaryo:** Tenant test verilerini istemiyor, gerçekten silinmeli. Veya GDPR isteği — bir veriyi kalıcı silmek gerek.

**Tenant:** ❌ Sadece soft delete (`is_active = false`)
**Süperadmin:** ✓ Hard delete (DELETE FROM)

**Etkilenen tablolar:**
- `products` (soft → hard)
- `users` (soft → hard) — audit_logs FK'ları ya cascade ya da `created_by_id = NULL`
- `companies` (silme — tüm tenant verisi)
- `suppliers`
- `branches` (sadece stok 0 ise)

**Etkilenmeyen tablolar (asla hard delete edilmez):**
- `audit_logs` ❌ İMMUTABLE
- `stock_movements` ❌ İMMUTABLE (yasal şeffaflık)

**Akış:**
1. Toolbox: "Hard Delete" butonu
2. Modal: ⚠⚠ Bu işlem **kalıcı**, geri alınamaz. Sebep min 50 char.
3. Çift onay + tenant adını yazma confirmation (Github pattern: "type the name to confirm")
4. Backend cascade delete
5. Audit log: `superadmin.bypass.hard_delete` (immutable, kalır)

#### 1.4 Eksi Stoğa Zorla Giriş

**Senaryo:** Sistem 5 ürün stoğu gösteriyor ama tenant fiziki 3 ürün satmış (sistem güncellenememiş). Önce satışı kaydetmek lazım, sayım sonra düzeltir.

**Tenant:** ❌ "Stok yetersiz" error
**Süperadmin:** ✓ "Negative stoğa izin ver" toggle (drawer içinde)

**Akış:**
1. Süperadmin Stok Çıkışı drawer'ı aç (tenant impersonation)
2. Drawer üstünde Toolbox: "🛡 Eksi stoğa izin ver" toggle
3. Toggle açıkken Adet > Stok için validation bypass
4. Submit'te modal: "Bu satıştan sonra stok -2 olacak. Sayım ile düzeltmen gerekecek."
5. Sebep zorunlu
6. Audit log: `superadmin.bypass.negative_stock`

#### 1.5 Plan Limit Aşımı (Tenant Adına Override)

**Senaryo:** Tenant FREE 50 ürün limitinde, PRO'ya yükselmeye karar verdi ama henüz havale gelmedi. Süperadmin "şimdilik aş, sonra plan'ı güncelle" diyebilmeli.

**Tenant:** ❌ Backend 402
**Süperadmin:** ✓ "Plan limit'i bu kayıt için aş" override

**Akış:**
1. Tenant adına yeni ürün eklerken modal: "Plan limit dolu (50/50)"
2. Modal alt: "🛡 Süperadmin: Bu sefer aş" butonu
3. Sebep + süre (geçici override 7 gün veya kalıcı)
4. Geçici: `companies.temporary_limit_override` (datetime till)
5. Audit log: `superadmin.bypass.plan_limit`

#### 1.6 Immutable Hareket Düzeltme (DB Inspector Üzerinden)

**Bu özel durum:** Stok hareketleri immutable. Ama veri girişi sırasında yanlış variant_id seçilmişse, ledger anlamsız.

**Tenant:** ❌ Hareket immutable
**Süperadmin:** ⚠ DB Inspector üzerinden **çok dikkatli** düzeltme — sadece "metadata düzeltme" (ürün adı, not, etc.). **Quantity / before_qty / after_qty asla değiştirilmez** (yasal şeffaflık).

**Akış:**
1. DB Inspector'da (Kategori 2'de detay) `stock_movements` tablosu
2. WHERE id = ... ile satır seç
3. Düzeltilebilir kolonlar: `note`, `reason`, `lot_number` (audit'le)
4. Düzeltilemez kolonlar: `quantity`, `before_qty`, `after_qty`, `created_by_id`, `created_at` (UI'da disabled)
5. Audit: özel `superadmin.dbfix.movement_metadata`

---

### 🔧 Kategori 2: Veri Düzeltme (DB Inspector)

Tenant operasyonel destek için DB-level müdahale aracı.

#### 2.1 DB Inspector Sayfası

**URL:** `/admin/db-inspector` (ADMIN panelinde role-based gating ile — ayrı `/super-admin` URL'i YOK, 2026-05-14)
**Erişim:** Sadece SUPERADMIN, 2FA zorunlu, IP whitelist (Faz 2)

**Layout:**
```
┌────────────────────────────────────────┐
│ Tenant: [Mavi Pet Shop ▼]              │
│ Tablo:  [branch_inventory ▼]            │
├────────────────────────────────────────┤
│ Query (SELECT-only by default):        │
│ SELECT * FROM branch_inventory          │
│ WHERE company_id = 'mavi-pet-uuid'      │
│ AND stock_qty < 0                       │
│                                         │
│ [▶ Çalıştır]  [📝 UPDATE Modu (kilit)] │
└────────────────────────────────────────┘
```

**Default:** SELECT-only — read-only sorgu.
**UPDATE/DELETE/INSERT:** "Kilit" butonu açılır — şifre + sebep + audit. Çoklu adım:
1. Sebep yaz (min 50 char)
2. SQL yaz
3. Preview (etkilenecek satır sayısı)
4. Final onay (kilit + şifre tekrar)
5. Çalıştır
6. Audit: `superadmin.dbfix.update` / `delete` / `insert`

**Güvenlik:**
- Sadece `petstockpro` schema'sı (auth, public.users dışı erişim yok)
- DROP TABLE / TRUNCATE ALL gibi destructive komutlar yasak
- Audit query'lerinde DML/DDL detay kayıt

#### 2.2 Hazır Düzeltme Scripts (Common Issues)

Sık karşılaşılan sorunlar için hazır script kataloğu:

| Sorun | Hazır Script |
|---|---|
| **branch_inventory mismatch** | "Şu variant için tüm branch_inventory'leri stock_movements toplam ile yeniden hesapla" |
| **stocktake_items orphan** | "Tamamlanmamış sayımları temizle" |
| **plan_limit recalculate** | "Aktif ürün sayısını tekrar say" |
| **audit_log gap fill** | "Eksik audit log'ları sentetik üret" (yasal: ❌ yapılmaz) |
| **email verification skip** | "Kullanıcı e-postasını manuel doğrulanmış işaretle" |

Toolbox'tan tek tık: script seç → tenant seç → preview → onay → çalıştır.

#### 2.3 Yedek Geri Yükleme Tetikleyici

**Senaryo:** Bir tenant'ın verisi yanlışlıkla silinmiş (kullanıcı hata). Point-in-time recovery (Supabase Pro tier).

**Akış:**
1. Toolbox: "Yedek geri yükle" → Supabase Dashboard'a yönlendirir (external)
2. Veya: ADMIN panelinin SUPERADMIN-only sidebar grubunda "Tenant snapshot iste" → 24 saatlik PIT recovery talebi
3. Audit: `superadmin.dbfix.restore_request`

---

### ⚙ Kategori 3: Sistem-Level Konfigürasyon

Tüm tenant'ları etkileyen sistem ayarları.

#### 3.1 Sistem Ayarları Sayfası

**URL:** `/admin/system-settings` (ADMIN panelinde SUPERADMIN-only route, 2026-05-14)

**6 bölüm:**

##### 3.1.1 Plan Tiers (3-tier B — 2026-05-21 son revize, TR-only)
```
FREE:    [50]  ürün · [0]      ₺/ay · KDV dahil
PRO:     [500] ürün · [1.000]  ₺/ay · KDV dahil
PRO+:    [∞]   ürün · [2.000]  ₺/ay · KDV dahil
```

Tek farklılaşma: stok limiti. Diğer tüm özellikler (vitrin, çoklu şube, audit, 2FA, asistan, 6 rapor, Nilvera e-Arşiv) tüm planlarda açık.

Tenant'a yansıma: Plan değişimi sonrası tüm tenant'lar yeni limit'i kullanır. Mevcut tenant'lara 30 gün geçiş süresi.
Detay: `PLAN-KADEMELERI.md §1`.

##### 3.1.2 Feature Flags

```
☑ Realtime (Supabase WebSocket)
☑ Telegram bot
☑ Merkezi vitrin (petstockpro.com/vitrin)
☑ PetPro Asistanı (rule-based)
☐ AI talep tahmini — Faz 3
```

PRO+ feature flags (custom domain, custom CSS, API) **YOK** — proje kapsamı dışında.

Her flag tenant override edilebilir veya global olabilir.

##### 3.1.3 Default Kategoriler

Yeni tenant kayıt sırasında otomatik yaratılan kategorileri yönet:
- Mama / Aksesuar / Oyuncak / Kum / Sağlık / Bakım
- Her birinde varsayılan KDV oranı + SKT zorunluluk

##### 3.1.4 Email Şablonları

Brevo SMTP gönderilen tüm e-postaların şablonları:
- Davet
- Şifre sıfırlama
- E-posta doğrulama
- Plan değişikliği
- Düşük stok bildirim (Faz 2)
- Süperadmin notification

##### 3.1.5 Telegram Bot Config

- Bot username
- Webhook URL
- Bot mesaj şablonları
- Komut izin verilen prefix'ler

##### 3.1.6 Sistem Broadcast

Tüm tenant'lara mesaj gönderme:
```
Mesaj: [textarea]
Hedef: ☑ Tüm tenant'lar  ☐ Belirli plan (FREE / PRO)
Kanal: ☑ Ekran içi banner  ☑ Telegram  ☐ E-posta
Süre: [30 dk bakım, "1 hafta açık" gibi]

[Preview]  [Gönder]
```

Audit: `superadmin.system.broadcast`

---

### 👤 Kategori 4: Uzaktan Kullanıcı Yönetimi

Tenant kullanıcılarına müdahale.

#### 4.1 Şifre Sıfırlama (Anında)

**Tenant bayi sahibi:** E-posta linki gönderir, kullanıcı tıklayıp şifresini değiştirir.
**Süperadmin:** **Anında** şifreyi sıfırla — yeni geçici şifre üret + e-posta + Telegram.

**Akış:**
1. Süperadmin tenant detay → kullanıcı listesi
2. Kullanıcı satırında "🛡 Şifre Reset" butonu
3. Modal: zorunlu sebep + ✓ "Kullanıcıya bildir" toggle
4. Yeni rastgele şifre üret (12 char)
5. E-posta + Telegram (bağlıysa)
6. Audit: `superadmin.user.password_force_reset`

#### 4.2 2FA Reset

**Senaryo:** Kullanıcı telefonunu kaybetmiş, 2FA recovery code'larını da kullanmış. Bayi sahibi ona yardım edemiyor (sistem reset için süperadmin gerek).

**Akış:**
1. Toolbox: "2FA Reset" butonu
2. Modal: Sebep + kullanıcının kimlik bilgisi (telefon, e-posta doğrulama)
3. Backend `users.two_fa_enabled = false`, `two_fa_secret = NULL`
4. Kullanıcı bir dahaki girişte 2FA setup tekrar yapar
5. Audit: `superadmin.user.2fa_force_reset`

#### 4.3 Tüm Oturumları Invalidate

**Senaryo:** Kullanıcı hesabı güvenliği şüpheli (örn. çalınan cihaz).

**Akış:**
1. Toolbox: "Tüm oturumları kapat"
2. Backend `DELETE FROM sessions WHERE user_id = ...`
3. Kullanıcı her cihazda otomatik logout
4. Audit: `superadmin.user.sessions_revoke_all`

#### 4.4 Hesabı Zorla Kilitle/Aç

**Senaryo:** Tenant'ın bayi sahibi başka bir kullanıcıyı kilitlemek istiyor ama UI'da bu özellik tenant'a açık değil (sadece pasif yap mümkün).

**Süperadmin:**
- "Kilitle" — kullanıcı login olamaz, JWT reddedilir
- "Aç" — kilit kaldırılır

**Akış:**
1. Toolbox: "🔒 Hesap Kilitle"
2. Sebep + süre (1 saat / 24 saat / süresiz)
3. `users.locked_until` timestamp
4. Audit: `superadmin.user.lock` / `unlock`

#### 4.5 Kullanıcı Hesap Birleştirme (Faz 2'ye saklı)

Aynı kişiye iki tenant'ta hesap varsa birleştirme — karmaşık, Faz 2.

---

## 3. Süperadmin Toolbox FAB — UI Detayı

### 3.1 Görsel

```
                                                ╭──────────────╮
                                                │ 🛡  Toolbox   │
                                                ╰──────────────╯
                                                       │
                                                       ▼
            ┌──────────────────────────────────────────┐
            │  🛡 SÜPERADMIN TOOLBOX                    │
            │  Bağlam: Mavi Pet Shop · Stok Hareketleri│
            ├──────────────────────────────────────────┤
            │                                          │
            │  Bu Sayfada (Stok Hareketleri):          │
            │  ────────────                            │
            │  • Süresi geçmiş hareket geri al          │
            │  • Sayımı geri al                         │
            │  • Eksi stoğa zorla giriş (drawer'da)    │
            │  • Immutable metadata düzelt              │
            │                                          │
            │  Genel:                                  │
            │  ────────                                │
            │  • DB Inspector                          │
            │  • Hard delete (variant/ürün/kullanıcı)  │
            │  • Şifre/2FA reset                       │
            │  • Plan limit override                   │
            │  • Sistem Ayarları →                     │
            │                                          │
            │  ⚠ Her aksiyon 🚨🚨 audit'le              │
            ╰──────────────────────────────────────────╯
                                                       │
                                                       ▼
                                                   [🛡 FAB]
                                                  (sağ alt, sticky)
```

### 3.2 FAB Davranışı

- **Görünürlük:** Sadece SUPERADMIN session'da + impersonation aktifken (veya SUPERADMIN-only `/admin/tenants`, `/admin/audit`, `/admin/db-inspector`, `/admin/system-settings`, `/admin/plan-approval` route'larında). Normal ADMIN sayfalarında FAB hiç render edilmez. **Toolbox FAB ana `/admin` panel sağ alt köşesinde** SUPERADMIN role'lü kullanıcı için sticky görünür.
- **Konum:** `position: fixed; bottom: 24px; right: 24px; z-index: 30`
- **Renk:** Cat gradient (`--cat` → `--cat-700`), pulsing animation 3sn
- **Boyut:** 56×56 (mobile 48×48)
- **İçerik:** 🛡 ikonu + "Toolbox" yazısı küçük
- **Tıklama:** Yukarıya doğru menü açılır (smooth slide-up)

### 3.3 Bağlam-Aware

Toolbox **aktif sayfaya göre** ilgili aksiyonları gösterir:

| Sayfa | Toolbox aksiyonları |
|---|---|
| Stok Hareketleri | Süresi geçmiş geri al · Sayım geri al · Immutable metadata düzelt |
| Ürünler | Hard delete · Plan limit override · Variant axis değiştir |
| Kullanıcılar | Şifre reset · 2FA reset · Oturum kapat · Kilitle |
| Sayım | Sayımı geri al · Tamamlanmamışı temizle |
| Ayarlar | Tenant override settings · Sistem ayarlarına yönlendir |
| SUPERADMIN-only menü (Tenant'lar, Audit, Plan Onay vb.) | DB Inspector · Sistem ayarları · Broadcast |

### 3.4 Modal İskeleti (Her Override İçin)

```
┌────────────────────────────────────────────────┐
│ 🛡 Süperadmin Override                         │
│ Aksiyon: Süresi geçmiş hareketi geri al        │
├────────────────────────────────────────────────┤
│                                                  │
│ ⚠ Bu işlem tenant'ın yapamayacağı bir işlem.   │
│ Tüm aksiyon audit'e işlenir (🚨🚨).             │
│                                                  │
│ Hedef:                                          │
│ • Tenant: Mavi Pet Shop A.Ş.                    │
│ • Hareket: #1248 · 35 gün önce                  │
│ • Etki: Stok 49 → 25 (24 adet geri yüklenir)   │
│                                                  │
│ Sebep (zorunlu, min 30 karakter):              │
│ [textarea]                                       │
│ "Müşteri 30 gün önceki satışı iade etmek       │
│  istiyor, tenant'ın 24h penceresi geçmişti..." │
│                                                  │
│ ☐ Tenant'a bildirim gönder (sessiz mod kapalı)│
│                                                  │
│ ─────────────────────────────────                │
│ Şifrenizi tekrar girin (güvenlik):              │
│ [password input]                                 │
│                                                  │
│   [İptal]  [🛡 Süperadmin olarak onayla]       │
└──────────────────────────────────────────────────┘
```

**Çift onay:** Şifre + checkbox kombinasyonu.
**Sebep validation:** min 30 char + sub-agent ile "anlamlı mı" check (Faz 2 — basit min char yeterli MVP'de).

---

## 4. Audit Log Yapısı

Her override için yeni audit entry:

```sql
INSERT INTO audit_logs (
  company_id,           -- impersonation hedefi
  user_id,              -- süperadmin user_id
  action,               -- 'superadmin.bypass.expired_reversal'
  entity_type,          -- 'stock_movement'
  entity_id,            -- target ID
  before_state,         -- JSON snapshot
  after_state,          -- JSON snapshot
  performed_as_superadmin, -- true
  superadmin_session_id,   -- impersonation session
  superadmin_action_type,  -- NEW: 'bypass' | 'dbfix' | 'system' | 'user'
  superadmin_reason,       -- min 30 char
  superadmin_silent,       -- tenant bildirimi var/yok
  ip_address,
  user_agent
);
```

**`superadmin_action_type` enum:**
- `bypass` — sistem kuralı bypass
- `dbfix` — veri düzeltme
- `system` — sistem-level config
- `user` — uzaktan kullanıcı yönetimi
- `impersonation` — sıradan impersonation (yetki devri)

### 4.1 Audit Görüntüleme

Süperadmin Audit sekmesinde filtre:
```
[Hepsi] [🚨 İmpersonation] [🚨🚨 Bypass] [🚨🚨 DBfix] [🚨🚨 System] [🚨🚨 User]
```

Her satırda **action_type rozet**:
- 🛡 bypass — turuncu
- 🔧 dbfix — mavi
- ⚙ system — antrasit
- 👤 user — yeşil
- 🎭 impersonation — sarı

---

## 5. Güvenlik Katmanları

### 5.1 2FA Zorunlu

Süperadmin hesabı için 2FA **opt-in değil**. İlk kayıt sonrası 2FA aktivasyonu yapılmadan sisteme giremez.

### 5.2 IP Whitelist (Faz 2'de Aktive)

Süperadmin login için IP whitelist:
- Ev IP
- Ofis IP
- Mobil hotspot (range)

Whitelist dışı IP'den login attempt → e-posta + Telegram alarm + 2FA + ek e-posta onay.

### 5.3 Şifre Çift Doğrulama

Her override öncesi şifre tekrar girilir (re-authentication).

### 5.4 Session Süresi

- Normal süperadmin session: 8 saat (idle 30 dk)
- İmpersonation session: 120 dakika (R4)
- Override aksiyonu: her aksiyon için 5 dk geçici elevation (re-auth)

### 5.5 Audit Bütünlüğü

- `audit_logs` tablosu **append-only** (DB trigger ile enforced)
- Süperadmin bile UPDATE/DELETE yapamaz (trigger reddeder)
- Veritabanı seviyesinde `audit_logs` için ayrı backup (haftalık offsite)

### 5.6 Rate Limit

Override aksiyonları için rate limit:
- 5 override / dakika
- 20 override / saat
- Alarm: 10+ override / saat → e-posta + Telegram

---

## 6. UI Mockup'a Yansıması

`preview/super-admin.html`'e **Toolbox FAB örneği** eklenecek:
- Sayfanın sağ altında 🛡 FAB
- Tıklama açılış animasyonu
- Sticky bant + FAB birlikte (impersonation altında ikisi de görünür)

Detay: `EKRAN-SUPERADMIN.md` güncellemesi.

---

## 7. Sprint Plan Etkisi

Sprint 7 (Süperadmin) **büyür**:

| Önceki | Yeni |
|---|---|
| 1.5 hafta | **2.5-3 hafta** |
| Kapsam: Tenant'lar + impersonation + audit + plan onay | + DB Inspector + Sistem Ayarları + Uzak kullanıcı + Toolbox FAB |

Sprint 7'yi 2 ayrı sprint'e bölmek mantıklı:
- **Sprint 7a:** İmpersonation + Tenant tablosu + Plan onay (1.5 hafta)
- **Sprint 7b:** Süperadmin Toolbox + Override aksiyonları + DB Inspector (1.5 hafta)
- **Sprint 7c (opsiyonel):** Sistem Ayarları + Uzak kullanıcı yönetimi (1 hafta)

Toplam Sprint 7 etkisi: **4 hafta**. Toplam plan: 17 → 18 sprint, 22 → 24 hafta.

Detay: `SPRINT-PLAN.md` güncellemesi.

---

## 8. Yapılacaklar Listesi

- [x] `SUPERADMIN-YETKILERI.md` (bu doküman)
- [ ] `EKRAN-SUPERADMIN.md` update — Toolbox FAB bölümü
- [ ] `DATABASE-SCHEMA.md` update:
  - `audit_logs.superadmin_action_type` enum column
  - `companies.temporary_limit_override` datetime column
  - `users.locked_until` datetime column
  - `users.locked_reason` text column
  - `system_settings` tablosu (key-value, sistem-level config)
  - `system_broadcasts` tablosu
- [ ] `SPRINT-PLAN.md` update — Sprint 7'yi 7a/b/c'ye böl
- [ ] `preview/super-admin.html` update — Toolbox FAB görsel örneği

---

## 9. Risk Analizi

| Risk | İhtimal | Etki | Önlem |
|---|---|---|---|
| Süperadmin yanlışlıkla hard delete | Orta | Çok yüksek | Çift onay + tenant adı yazma + audit |
| DB Inspector ile DROP TABLE | Düşük | Çok yüksek | DDL komutları yasak (whitelist sadece DML) |
| Audit log gap (override sırasında crash) | Düşük | Yüksek | Transaction içinde audit + state insert atomic |
| Yetki istismarı (kötü niyetli süperadmin) | Düşük | Yüksek | 2FA + IP whitelist + audit + Telegram alarm |
| Tenant şikayeti — "süperadmin verimi sildi" | Orta | Orta | Tenant'a bildirim (sessiz mod kapalı varsayılan), audit erişimi tenant'a da açık |

---

*Son güncelleme: 2026-05-12. Onaylanmış 4 kategori yetki + Toolbox FAB UI + MVP tam implement kararı.*
