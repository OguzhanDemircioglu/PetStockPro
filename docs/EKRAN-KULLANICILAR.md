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

## 4. Davet Akışı (Mini-Modal)

```
┌── 👥 Yeni Kullanıcı Davet Et ────────────────┐
│                                                 │
│ E-posta *  [ahmet@petshop.com]                 │
│            💡 Her tenant için ayrı email gerekir│
│            (users.email UNIQUE — MANTIK-HATALARI│
│            K3 politikası). Aynı kişi 2 pet shop │
│            açacaksa Gmail "+" alias kullanabilir│
│            (ahmet+mavi@gmail.com).              │
│                                                 │
│ Rol *      ◉ Bayi sahibi (ADMIN, branch_id=NULL)│
│                Tüm şubeler, kullanıcı ekleme,  │
│                plan yönetimi, vitrin profili   │
│            ○ Şube müdürü (ADMIN, branch_id=X)  │
│                Sadece atandığı şubeyi yönetir  │
│                Plan yükseltme yok              │
│            ○ Kasiyer (STAFF, branch_id=X)      │
│                Sadece satış kaydeder, sayıma   │
│                katılır. Ürün eklemez/silmez,   │
│                fiyat değiştiremez, tedarikçi   │
│                ile uğraşmaz. Mahalle pet shop  │
│                veya 2+ vardiya için ideal.     │
│                                                 │
│ Şube       [Merkez ▼]                          │
│            (Sadece "Şube müdürü" rolünde)      │
│                                                 │
│ Davet mesajı (opsiyonel)                       │
│ [textarea — kişisel not]                       │
│                                                 │
│       [İptal]  [Davet Gönder]                  │
└─────────────────────────────────────────────────┘
```

### 4.1 Davet Akışı Detayı

1. **Davet gönder:** `users` tablosuna row eklenir (`status: invited`, `password: null`)
2. **E-posta:** Brevo SMTP ile davet linki gönderilir
   - Subject: `PetStockPro'ya davet edildin!`
   - Link: `https://petstockpro.com/accept-invite?token=...` (Auth.js Magic Link benzeri, 7 gün TTL)
3. **Davet alan kullanıcı:** Link tıklar → şifre belirleme sayfası → "Kabul Et" → aktif
4. **Davet süresi dolarsa:** Link expired, "Yeniden davet et" butonu (drawer'da)

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

| Endpoint | Method |
|---|---|
| `/api/admin/users` | GET/POST |
| `/api/admin/users/invite` | POST (e-posta gönder) |
| `/api/admin/users/[id]` | GET/PATCH |
| `/api/admin/users/[id]/deactivate` | POST |
| `/api/admin/users/[id]/reactivate` | POST |
| `/api/admin/users/[id]/reset-password` | POST (e-posta link) |
| `/api/admin/users/[id]/resend-invite` | POST |
| `/api/admin/users/[id]/sessions` | GET (aktif oturumlar) |
| `/api/admin/users/[id]/sessions/[sid]` | DELETE (oturum kapat) |
| `/api/admin/users/[id]/audit` | GET (son hareketler) |
| `/api/auth/accept-invite` | POST (davet kabul + şifre belirle) |

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
- USR-002 Davet: e-posta gönderilir
- USR-003 Davet linki 7 gün TTL
- USR-004 Davet kabul: şifre belirle + aktif
- USR-005 Davet süresi doldu: yeniden davet
- USR-006 Rol değiştir: bayi sahibi → şube müdürü
- USR-007 Şube değiştir: oturumlara bildirim + auto logout
- USR-008 2FA durumu görüntüleme
- USR-009 Aktif oturumlar: 2 cihaz
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
