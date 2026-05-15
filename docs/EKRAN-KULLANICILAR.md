# Ekran: Kullanıcılar

**URL:** Liste `/admin/users`, Detay drawer `?detail=[id]`
**Sidebar yeri:** Kaynaklar grubu, 3. sıra · 👥 Kullanıcılar
**Erişim:** SADECE bayi sahibi (ADMIN branch_id=NULL). Şube müdürü Faz 2'de kendi şubesinin STAFF'ını yönetebilecek.
**Referans:** Faz 1 `FAZ1-TASARIM-KARARLARI.md` §24 · §6 (Roller)
**Tasarım sistemi:** `TASARIM-SISTEMI.md`

> Kullanıcılar ekranı tenant'ın çalışanlarını + admin seviyelerini yönetir. Davet akışı + rol atama + 2FA + son giriş + aktif oturum.

---

## 1. Layout

```
┌─────────┬──────────────────────────────────────────────────┐
│ Sidebar │ Topbar                                             │
│         ├──────────────────────────────────────────────────┤
│         │ KPI: 👥 4 toplam · 🔑 2 ADMIN · 👤 0 STAFF (F2)  │
│         │ Filtre: [Rol ▼] [Şube ▼] [Durum ▼] [Arama]      │
│         │                                  [+ Davet Et]    │
│         │                                                    │
│         │ Tablo:                                             │
│         │ Avatar │ Ad │ Rol │ Şube │ Son giriş │ 2FA │ ⚙   │
│         │                                                    │
└─────────┴──────────────────────────────────────────────────┘
```

## 2. KPI

```
👥 4 kullanıcı   ·   🔑 2 ADMIN   ·   👤 0 STAFF (Faz 2)
```

## 3. Tablo

| Kolon | İçerik |
|---|---|
| Avatar | 32×32 (Auth.js Google avatar veya initials gradient) |
| Ad | Adı + e-postası alt satır küçük gri |
| Rol | Pill: ADMIN (bayi sahibi/şube müdürü) veya STAFF |
| Şube | "Tüm şubeler" veya şube adı |
| Son giriş | Relative ("2 dk önce" hover'da tarih) |
| 2FA | ✓ aktif / ✗ kapalı |
| chevron | Detay drawer |

Hover satır → 👁 Detay · ✏ Düzenle · 🔑 Şifre sıfırla · ⋯ Daha

## 4. Davet Akışı — Hibrit (Email veya Link) — 2026-05-14 kullanıcı kararı

**Karar:** Admin iki davet yönteminden birini seçer. Email aktif personel (şube müdürü) için varsayılan; davet linki kasiyer (STAFF, email kullanmayan) için pratik.

### 4.0 Mini-Modal

```
┌── 👥 Yeni Kullanıcı Davet Et ────────────────────┐
│                                                    │
│ E-posta *  [ahmet@petshop.com]                    │
│            💡 Her tenant için ayrı email gerekir  │
│            (users.email UNIQUE — MANTIK-HATALARI  │
│            K3 politikası). Aynı kişi 2 pet shop   │
│            açacaksa Gmail "+" alias kullanabilir  │
│            (ahmet+mavi@gmail.com).                │
│                                                    │
│ Rol *      ◉ Bayi sahibi (ADMIN, branch_id=NULL)  │
│            ○ Şube müdürü (ADMIN, branch_id=X)     │
│            ○ Kasiyer (STAFF, branch_id=X)         │
│                                                    │
│ Şube       [Merkez ▼]   (müdür/kasiyer için)      │
│                                                    │
│ Davet yöntemi * — 2026-05-14 hibrit:               │
│ ◉ 📧 E-posta gönder                                │
│     Brevo otomatik gönderim, 7 gün TTL             │
│     (varsayılan — şube müdürü için ideal)          │
│ ○ 🔗 Davet linki üret (elden ileteceğim)           │
│     12 haneli token + URL kopya, 24 saat TTL       │
│     (kasiyer için ideal — admin WhatsApp/SMS ile  │
│      iletir, kasiyerin email kullanması gerekmez)  │
│                                                    │
│ Davet mesajı (opsiyonel)                          │
│ [textarea — kişisel not, sadece email'de geçer]   │
│                                                    │
│       [İptal]  [Davet Oluştur]                    │
└────────────────────────────────────────────────────┘
```

### 4.1 Davet Akışı — Email Yöntemi (varsayılan)

1. **Admin "Davet Oluştur" tıklar (yöntem = email):**
   - `users` tablosuna row INSERT
   - `status='invited'`, `password_hash=NULL`, `invite_method='email'`
   - `invite_token = crypto.randomUUID()` (varchar 36, hex)
   - `invite_expires_at = NOW() + INTERVAL '7 days'`
   - `invited_by_id = ctx.user.id`
2. **Brevo SMTP otomatik e-posta:**
   - Subject: `PetStockPro'ya davet edildin!`
   - Link: `https://petstockpro.com/accept-invite?token=...`
   - Davet mesajı (opsiyonel) email body'de
3. **Davet alan kullanıcı:**
   - Linke tıklar → `/accept-invite?token=...` sayfası
   - Sayfada: ad-soyad onay + şifre belirle (Şifre Politikası §2.5)
   - "Kabul Et" → `status='active'`, `email_verified=NOW()`, `password_hash` set
4. **Süre dolarsa:** `status='expired_invite'` (pg_cron günlük job), "Yeniden Davet" butonu detay drawer'da

### 4.2 Davet Akışı — Link Yöntemi (yeni, kasiyer için pratik)

1. **Admin "Davet Oluştur" tıklar (yöntem = link):**
   - `users` tablosuna row INSERT (email yine girilir — DB constraint zorunlu)
   - `status='invited'`, `password_hash=NULL`, `invite_method='link'`
   - `invite_token = crypto.randomUUID()` (varchar 36)
   - `invite_expires_at = NOW() + INTERVAL '24 hours'` ⚠ kısa süre (link WhatsApp'a düşene kadar)
   - `invited_by_id = ctx.user.id`
   - **E-posta gönderilmez** (Brevo çağrısı yok)
2. **Modal kapanırken:**
   ```
   ┌── ✅ Davet linki üretildi ──────────────────────┐
   │                                                   │
   │ Aşağıdaki linki ve geçici kodu çalışanına        │
   │ WhatsApp / SMS ile gönder. 24 saat geçerli.       │
   │                                                   │
   │ 🔗 https://petstockpro.com/accept-invite?token=  │
   │    abc123def456...xyz                             │
   │                                                   │
   │              [📋 Linki Kopyala]                    │
   │                                                   │
   │ 💡 Çalışanın bu linkten kayıt formunu açar, ad   │
   │ soyad + şifre belirler. Kayıt sonrası hesap      │
   │ aktife geçer.                                     │
   │                                                   │
   │              [Kapat]                              │
   └───────────────────────────────────────────────────┘
   ```
3. **Davet alan kullanıcı:**
   - Admin elden iletmiş (WhatsApp/SMS), linke tıklar
   - `/accept-invite?token=...` sayfası açılır
   - Ad-soyad onay + şifre belirle + (opsiyonel) email düzeltme (admin girmişken kasiyerin gerçek emailini girmesine izin ver)
   - "Kabul Et" → `status='active'`, `email_verified=NOW()` (link akışında implicit), `password_hash` set
   - **invite_token tek kullanımlık:** Token kullanıldığında `invite_token=NULL` set, ikinci tıklama 410 Gone
4. **Süre dolarsa:** `status='expired_invite'`, admin "Yeniden Davet" tıklar → yeni link üretilir

### 4.3 Karşılaştırma Tablosu

| Konu | 📧 Email | 🔗 Link |
|---|---|---|
| Süre (TTL) | 7 gün | 24 saat (kısa — elden gönderim) |
| Brevo SMTP çağrısı | Var | YOK |
| Admin elden gönderim | YOK | WhatsApp/SMS (admin sorumluluğu) |
| Token kullanımı | Tek kullanımlık | Tek kullanımlık |
| Davet mesajı (kişisel not) | Email body'de | Yok (admin WhatsApp'tan kendi yazar) |
| Email değiştirme (kabul anında) | YOK (gönderilen email = sabit) | Var (admin "geçici email" girmiş olabilir) |
| Audit log | `user.invited` + `metadata.method='email'` | `user.invited` + `metadata.method='link'` |
| Önerilen hedef | Şube müdürü | Kasiyer (STAFF) |

### 4.4 Davet Durumları

### 4.2 Davet Durumları

| Status | Görünüm |
|---|---|
| `invited` | "Davet bekliyor · 5 gün kaldı" sarı badge |
| `active` | normal kullanıcı |
| `inactive` | "Pasif" gri badge |
| `expired_invite` | "Davet süresi doldu" kırmızı badge + "Yeniden Davet" |

---

## 5. Detay Drawer

```
┌── Ahmet Şahin ──────────────────────────[×]┐
│ ahmet@petshop.com · Şube müdürü · Merkez    │
├──────────────────────────────────────────────┤
│ Profil                                       │
│   E-posta: ahmet@petshop.com                │
│   Telefon: 0532 xxx xxxx                    │
│   Rol: ADMIN (branch_id=Merkez)             │
│   Üyelik: 7 Mart 2026 (2 ay)                │
│                                              │
│ Güvenlik                                     │
│   2FA: ✗ Kapalı  [Aktive Et öner]          │
│   Son giriş: 07 May 14:32 · İstanbul        │
│   IP: 78.187.xx.xx · Chrome 130/Win11       │
│                                              │
│ Aktif oturumlar (2)                          │
│   • Chrome Win · İstanbul · 2 dk önce       │
│     [Bu oturumu kapat]                       │
│   • Safari iPhone · İstanbul · 1 sa önce    │
│     [Bu oturumu kapat]                       │
│                                              │
│ Aksiyonlar                                   │
│   [Rol/şube değiştir]                       │
│   [Şifre sıfırla] (e-posta linki)           │
│   [Yeniden davet] (sadece invited)          │
│   [Pasif yap]                                │
│                                              │
│ Son hareketler (audit feed)                  │
│   07 May 14:32 · Stok Girişi: +24 R.Canin  │
│   07 May 14:00 · Ürün güncelledi: Whiskas   │
│   07 May 13:45 · Giriş yapıldı              │
│   ...                                        │
└──────────────────────────────────────────────┘
```

## 6. Rol / Şube Değiştirme

```
┌── Ahmet Şahin · Rol değiştir ───────────────┐
│ Mevcut: ADMIN · Merkez                       │
│                                              │
│ Yeni rol:                                    │
│ ○ Bayi sahibi (branch_id=NULL)              │
│ ◉ Şube müdürü (branch_id=X)                 │
│ ○ STAFF (Faz 2 disabled)                    │
│                                              │
│ Yeni şube: [Şube A ▼]                       │
│                                              │
│ ⚠ Bu değişiklik etkili olacak:              │
│ • Ahmet Merkez'i artık göremeyecek          │
│ • Sadece Şube A'yı yönetecek                │
│ • Ahmet'in açık oturumlarına bildirim gider │
│                                              │
│ Sebep (audit için): [_____]                  │
│                                              │
│       [İptal]  [Değiştir]                   │
└──────────────────────────────────────────────┘
```

**Backend:**
- `users.role` + `users.branch_id` UPDATE
- `audit_logs` entry (before/after state)
- Aktif oturumlara WebSocket ile bildirim → otomatik logout (yeni JWT)
- Telegram bildirimi (kullanıcı bot'a bağlıysa): "Rolün değişti: ..."
- E-posta bildirimi

## 7. Hard Delete YOK

Audit log referansları (`audit_logs.user_id`) + ledger entries (`stock_movements.created_by`) var.

**Sadece "Pasif yap":**
- `users.is_active = false`
- Oturumlar invalide olur
- Giriş yapamaz
- Tablo'da "Pasif" filtresinde görünür

**Kullanıcı kendini pasif edemez:**
- Backend gate: `if (request.user.id === target.user.id) throw 403`
- UI: kendi satırında "Pasif" buton disabled

## 8. 2FA Akışı

Kullanıcı kendi profilinde `/admin/settings/security` (Ayarlar §25.5) altında 2FA aktif eder. Bu Kullanıcılar ekranında **sadece görüntülenir**:

```
2FA: ✓ Aktif (TOTP)  veya  ✗ Kapalı [Kullanıcıya 'aktive et' hatırlatması gönder]
```

SUPERADMIN ve bayi sahibi için 2FA **önerilir** (zorunlu değil MVP'de — Faz 2'de zorunlu yapılabilir).

## 9. Şube Müdürü Atama Etkileri

`users.branch_id` set edilince:
- O şubenin verisini görür (Stok Hareketleri, Düşük Stok, vs.)
- Diğer şubelerin verisi gizli (RLS politikası)
- Şubeler ekranı sidebar'da gizli (sadece bayi sahibi görür)
- Telegram bildirim "Yeni şube müdürü atandı: Ahmet → Merkez"

## 10. State + API

```ts
const { data: users } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
```

| Endpoint | Method | Açıklama |
|---|---|---|
| `/api/admin/users` | GET / POST | Liste / Yeni davet (POST body: `{email, role, branchId, inviteMethod: 'email'\|'link', message?}`) |
| `/api/admin/users/invite` | POST | **Birleşik davet endpoint** — `inviteMethod` body'den okur. `email` → Brevo SMTP gönderim + response `{status:'sent'}`. `link` → token üretir, e-posta gönderme, response `{status:'created', token, url, expiresAt}` (admin frontend'de kopya butonu) |
| `/api/admin/users/[id]` | GET / PATCH | Detay / Güncelle |
| `/api/admin/users/[id]/deactivate` | POST | Pasif yap |
| `/api/admin/users/[id]/reactivate` | POST | Yeniden aktif |
| `/api/admin/users/[id]/reset-password` | POST | E-posta link (her zaman email yöntem) |
| `/api/admin/users/[id]/resend-invite` | POST | Yeniden davet — body: `{method: 'email'\|'link'}`. Mevcut token expire edilir, yeni token üretilir |
| `/api/admin/users/[id]/sessions` | GET | Aktif oturumlar |
| `/api/admin/users/[id]/sessions/[sid]` | DELETE | Oturum kapat |
| `/api/admin/users/[id]/audit` | GET | Son hareketler |
| `/api/auth/accept-invite` | POST | Davet kabul + şifre belirle (body: `{token, password, firstName, lastName, email?}` — email sadece link yönteminde değiştirilebilir) |

**Audit log entries (`audit_logs.action`):**
- `user.invited` · metadata: `{method: 'email'\|'link', expiresAt, invitedById}`
- `user.invite_link_revoked` · admin manuel link iptal (gönderdiği yere ulaşamadıysa)
- `user.invite_accepted` · metadata: `{method, acceptedAt, ipHash}`
- `user.invite_expired` · pg_cron auto-expire (günlük job)
- `user.invite_resent` · metadata: `{oldMethod, newMethod, expiresAt}`

**Rate-limit (Cloudflare Workers KV — abuse koruma):**
- Davet oluşturma: aynı tenant'tan **saatte max 10** (kötü niyetli admin spam koruma)
- Davet kabul (accept-invite): aynı IP'den **dakikada max 5** (token brute-force koruma)
- 24 saat içinde 50+ başarısız `accept-invite` → süperadmin alert (sistem genelinde)

## 11. Empty State

```
[kedi+kullanıcı mascot]
Ekibini davet et
Stok takibini tek başına değil, ekip olarak yap.
İlk ekip arkadaşını davet et.
[+ İlk Daveti Gönder]
```

(Sadece bayi sahibi tek kullanıcı olduğunda. Şu an bu durum mümkün çünkü minimum tenant 1 user'la başlar.)

## 12. Test Senaryoları

- USR-001 KPI 3 metrik
- USR-002 Davet (email yöntem): Brevo SMTP gönderilir, 7 gün TTL, audit `user.invited` metadata.method='email'
- USR-003 Davet (link yöntem): token üretilir + URL response döner, Brevo çağrısı YOK, 24 saat TTL, audit metadata.method='link'
- USR-004 Davet kabul (email yöntem): linkten gelen kullanıcı şifre belirler → aktif
- USR-005 Davet kabul (link yöntem): kullanıcı email düzeltebilir + ad-soyad + şifre belirler → aktif
- USR-006 Davet süresi doldu (email 7g / link 24s): status='expired_invite', "Yeniden Davet" butonu görünür
- USR-007 Yeniden davet: eski token expire, yeni token + yeni TTL — method değiştirilebilir (email → link veya tersi)
- USR-008 Davet token tek kullanımlık: 2. tıklama 410 Gone
- USR-009 Davet linki kopya: modal'da [📋 Linki Kopyala] butonu clipboard'a yazar
- USR-010 Rate-limit: aynı tenant saatte 10+ davet → 429 Too Many Requests
- USR-011 accept-invite brute-force: aynı IP dakikada 5+ başarısız token → 429
- USR-012 Rol değiştir: bayi sahibi → şube müdürü, oturumlara bildirim + auto logout
- USR-013 Şube değiştir: oturumlara bildirim + auto logout
- USR-014 2FA durumu görüntüleme
- USR-015 Aktif oturumlar: 2 cihaz
- USR-010 Oturum kapat (uzaktan)
- USR-011 Şifre sıfırla (e-posta linki)
- USR-012 Kendi pasif yapamaz (403)
- USR-013 Pasif yap → oturumlar invalide
- USR-014 Hard delete YOK (API 405)
- USR-015 Audit feed: son hareketler
- USR-016 Şube müdürü Kullanıcılar sayfasına 403

## 12.5 Yetki Matrisi (2026-05-14 — MANTIK-HATALARI S1 düzeltmesi)

> STAFF rolü kasiyer olarak tanımlandı. Tüm rol yetkileri tek tabloda. RLS politikaları (DATABASE-SCHEMA §4) bu matrisi yansıtır.

| Yetki | SUPERADMIN | ADMIN (bayi sahibi) | ADMIN (şube müdürü) | STAFF (kasiyer) | BAYI_ADMIN (Faz 3) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Tenant ayarları** (şirket profili, vitrin profili) | ✅ | ✅ | ❌ | ❌ | 👁 |
| **Plan + Fatura + Abonelik** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Ürün** CREATE/UPDATE/DELETE | ✅ | ✅ (tüm şubeler) | ✅ (kendi şubesi) | ❌ | 👁 |
| **Ürün** fiyat değiştir | ✅ | ✅ | ✅ (kendi şubesi) | ❌ | 👁 |
| **Stok hareketleri** görüntüle | ✅ | ✅ (tüm) | ✅ (kendi şubesi) | ✅ (kendi şubesi) | 👁 |
| **Satış** kaydet (Stok Çıkışı) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Stok girişi** (mal kabul) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Transfer** (şubeler arası) | ✅ | ✅ | ✅ (kendi şubesinden) | ❌ | ❌ |
| **Sayım** başlat | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Sayım** katıl (sayma) | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Düşük stok** görüntüle + sipariş | ✅ | ✅ | ✅ (kendi şubesi) | 👁 (sipariş YOK) | 👁 |
| **Sipariş ver** (tedarikçiye) | ✅ | ✅ | ✅ (şube içi) | ❌ | ❌ |
| **Tedarikçi** CRUD | ✅ | ✅ | ❌ | ❌ | 👁 |
| **Kullanıcı** davet/yönet | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Şube** CRUD | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Raporlar** | ✅ | ✅ (tüm şubeler) | ✅ (kendi şubesi) | ❌ | 👁 |
| **Vitrin Profili** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Vitrin Metrikleri** | ✅ | ✅ | 👁 (kendi şubesi) | ❌ | 👁 |
| **Süperadmin menüler** (sistem) | ✅ | ❌ | ❌ | ❌ | ❌ |

**Notasyon:** ✅ tam yetki · 👁 sadece okuma · ❌ erişim yok

**STAFF (kasiyer) tasarım felsefesi:**
- Kasiyer **operasyonel iş** yapar: kasa satışı, sayım katılımı, düşük stok görüş
- Yönetimsel iş YOK: ürün eklemez, fiyat değiştirmez, sipariş vermez, tedarikçi yönetmez
- Şube'ye bağlı (`branchId` zorunlu) — sadece kendi şubesindeki stokla çalışır
- "Üst soru" gerektiren işlerde şube müdürüne yönlendirilir (UI'da disabled buton + tooltip)

**RLS uygulama (Sprint 1):**
```sql
-- Örnek: stock_movements INSERT
CREATE POLICY stock_movements_insert_staff ON stock_movements
  FOR INSERT WITH CHECK (
    (auth.role() = 'STAFF' AND type = 'sale' AND branch_id = auth.branch_id())
    OR (auth.role() = 'ADMIN' AND (auth.branch_id() IS NULL OR branch_id = auth.branch_id()))
    OR auth.is_superadmin()
  );
```

---

## 13. Faz 1 Uyumu

✅ §24 yapı korundu. **STAFF rolü kasiyer olarak aktive** (2026-05-14, MANTIK-HATALARI S1) — Faz 2'ye saklamak yerine MVP'de aktif. Yetki matrisi §12.5.

## 14. Sıradaki

⏭ EKRAN-RAPORLAR.md
