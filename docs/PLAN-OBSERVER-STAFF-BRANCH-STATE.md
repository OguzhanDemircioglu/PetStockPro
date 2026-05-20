# PLAN — Observer + Staff Yetkileri + Şube 3-State

**Tarih:** 2026-05-20 (gece-en-geç)
**Durum:** Tasarım onaylandı, implementasyon yeni session'da başlayacak
**Tahmini süre:** ~9-10 saat (3-4 tur)
**Branch:** `cray61`
**Bağımlılık:** Mevcut `cray61` HEAD = `711be26`

---

## 🎯 Hedef

Mevcut SUBE_MUDURU rolü, STAFF yetki sistemi, Şube isActive boolean — hepsi yeniden tasarlanıyor:

1. **SUBE_MUDURU → OBSERVER** (read-only multi-branch viewer)
2. **STAFF → "Çalışan"** UI etiketi + granular permission matrix
3. **Şube state** boolean'dan 3-state'e (`active` | `holiday` | `inactive`)
4. **Faz 3 BAYI_ADMIN multi-tenant viewer İPTAL** — Observer onun yerini aldı

---

## 📐 Tasarım Kararları (Onaylandı 2026-05-20)

### A. Rol Yeniden Adlandırma

| Eski | Yeni DB | Yeni UI Etiketi |
|---|---|---|
| `BAYI_SAHIBI` | aynı | **"Bayi Admin"** |
| `SUBE_MUDURU` | **`OBSERVER`** | **"İzleyici"** |
| `STAFF` | aynı | **"Çalışan"** |
| `BAYI_ADMIN` (Faz 3) | **kaldırıldı** | — |
| `SUPERADMIN` | aynı | "Süperadmin" |

### B. Observer (İzleyici) Davranışı

- **Sadece okur** — hiçbir CRUD aksiyonu yok
- Tenant'ın tüm şubelerinin verilerini görür (multi-branch view)
- **Davet akışı:** Bayi Admin link gönderir → İzleyici tıklar → hesap açar → **otomatik aktif** (tek yönlü)
- Eski SUBE_MUDURU yetkileri (şube CRUD) **iptal**

### C. STAFF (Çalışan) Default Yetkileri

**ON (otomatik):**
- `sale.create` — satış kaydet (stock_out type=sale)
- `variant.view` — variant ve fiyat okuma
- `customer_ref.write` — müşteri referans yazma

**OFF (Bayi Admin tek tek açar):**
- `stock_in.create` — alım/giriş
- `stock_out.waste` — fire
- `stock_out.gift` — hediye
- `stock_out.sample` — numune
- `stock_out.internal` — dahili kullanım
- `stock_out.return` — iade
- `transfer.create` — şubeler arası transfer
- `stocktake.create` — sayım başlat
- `discount.apply` — indirim uygula
- `credit_sale.create` — veresiye
- `vitrin.manage` — vitrin aç/kapat
- `price.edit` — variant fiyat değiştir

**UI:** `/admin/settings/users` her satırda **"⚙ Yetkiler"** buton → modal (13 toggle).

### D. Şube 3-State

| State | Davranış |
|---|---|
| **active** (yeşil) | Normal — vitrin'de görünür, tüm aksiyonlar açık |
| **holiday** (sarı) | Vitrin'de "🏖 Tatilde" rozet + "Satıcıya sor" disabled + ürün sayfasında "Bu şube tatilde, sipariş alamaz" banner. Admin paneli aktif (operasyon devam edebilir — sayım, stok hareketi). Manuel toggle (süre yok). |
| **inactive** (gri) | Vitrin'den tamamen çekilir + admin'de TÜM aksiyonlar kilitli (read-only ekranlar) + uyarı modal pasifleştirirken. Manuel toggle (re-activate yapılabilir). |

**Mevcut `isActive` boolean** → migration ile `branch_status` enum'a geçer:
- `isActive=true` → `status='active'`
- `isActive=false` → `status='inactive'`

### E. Şube Ekleme Wizard

2. step: **"Çalışan ekle"** öner (opsiyonel)
- Skip varsa uyarı: "Birden fazla şubeyi tek başına yönetmek zor olabilir"
- Pas geçilir, sonradan `/admin/settings/users`'tan eklenebilir

### F. Pasif Şube Atanmış Kullanıcılar

- Login yapabilir
- **Read-only ekranlar** görür (atama korunur, branch_id NULL'a düşmez)
- Her aksiyon buton/form **disabled**
- Sticky banner: "Bu şube pasif. Yalnızca görüntüleyebilirsin."

---

## 🗂 9-Fazlı Uygulama Planı

### **FAZ 1 — Schema Migration + Permissions** (~1.5 saat)

#### 1.1 Migration 0019 — `observer_branch_status_permissions`

**SQL:**
```sql
-- 1. userRole enum: SUBE_MUDURU → OBSERVER rename
ALTER TYPE petstockpro.user_role RENAME VALUE 'SUBE_MUDURU' TO 'OBSERVER';

-- 2. BAYI_ADMIN value drop (Faz 3 iptal)
-- Postgres enum value drop limited; alternatif: yeni enum yaratıp swap.
-- Önce mevcut BAYI_ADMIN'li user kontrolü:
-- SELECT count(*) FROM users WHERE role='BAYI_ADMIN'; --> 0 olmalı
-- Sonra:
-- ALTER TYPE petstockpro.user_role ... (workaround: ADD VALUE yapamayız drop için)
-- Bu işlem postpone — value kalsın, sadece UI'da gösterilmesin.

-- 3. branch_status enum
CREATE TYPE petstockpro.branch_status AS ENUM ('active', 'holiday', 'inactive');

ALTER TABLE petstockpro.branches
  ADD COLUMN status petstockpro.branch_status NOT NULL DEFAULT 'active';

UPDATE petstockpro.branches
  SET status = CASE WHEN is_active = true THEN 'active'::petstockpro.branch_status
                     ELSE 'inactive'::petstockpro.branch_status END;

-- isActive korunur (geri uyumluluk + status ile sync)

-- 4. user_permissions tablosu
CREATE TABLE petstockpro.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES petstockpro.users(id) ON DELETE CASCADE,
  permission_key varchar(60) NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  granted_by_id uuid REFERENCES petstockpro.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_key)
);

CREATE INDEX idx_user_permissions_user ON petstockpro.user_permissions(user_id);

-- RLS ekle (server-side helper user_id check edecek)
ALTER TABLE petstockpro.user_permissions ENABLE ROW LEVEL SECURITY;

-- 5. observer_invitations için ek mu? Hayır — invite_method='link' mevcut.
-- Davet edilen kullanıcı OBSERVER rolüne otomatik atanır (Bayi Admin davette role seçer).
```

#### 1.2 Drizzle Schema (src/db/schema/index.ts)

```ts
// userRoleEnum güncelle (mevcut 'SUBE_MUDURU' → 'OBSERVER')
export const userRoleEnum = petstockproSchema.enum('user_role', [
  'BAYI_SAHIBI',
  'OBSERVER', // eski SUBE_MUDURU
  'STAFF',
  'SUPERADMIN',
  'BAYI_ADMIN', // legacy, UI'da yok — postpone drop
]);

// branch_status enum (yeni)
export const branchStatusEnum = petstockproSchema.enum('branch_status', [
  'active',
  'holiday',
  'inactive',
]);

// branches tablo: status field
status: branchStatusEnum('status').notNull().default('active'),

// userPermissions tablo
export const userPermissions = petstockproSchema.table('user_permissions', { ... });
```

#### 1.3 Permission Key Constants (`src/lib/users/permission-keys.ts`)

```ts
export const PERMISSION_KEYS = {
  // Default ON for STAFF
  SALE_CREATE: 'sale.create',
  VARIANT_VIEW: 'variant.view',
  CUSTOMER_REF_WRITE: 'customer_ref.write',
  // Default OFF for STAFF
  STOCK_IN_CREATE: 'stock_in.create',
  STOCK_OUT_WASTE: 'stock_out.waste',
  STOCK_OUT_GIFT: 'stock_out.gift',
  STOCK_OUT_SAMPLE: 'stock_out.sample',
  STOCK_OUT_INTERNAL: 'stock_out.internal',
  STOCK_OUT_RETURN: 'stock_out.return',
  TRANSFER_CREATE: 'transfer.create',
  STOCKTAKE_CREATE: 'stocktake.create',
  DISCOUNT_APPLY: 'discount.apply',
  CREDIT_SALE_CREATE: 'credit_sale.create',
  VITRIN_MANAGE: 'vitrin.manage',
  PRICE_EDIT: 'price.edit',
} as const;

export const STAFF_DEFAULT_ON: readonly string[] = [
  PERMISSION_KEYS.SALE_CREATE,
  PERMISSION_KEYS.VARIANT_VIEW,
  PERMISSION_KEYS.CUSTOMER_REF_WRITE,
];

// Türkçe label
export const PERMISSION_LABELS: Record<string, string> = {
  'sale.create': 'Satış kaydet',
  'variant.view': 'Ürün ve fiyat görüntüle',
  // ...
};
```

#### 1.4 Test

`src/lib/users/permission-keys.test.ts` — 13 key + label kapsama testi (4 test).

#### 1.5 Faz 1 Çıktısı

- Migration 0019 hazırlanır (kullanıcıya **chat üzerinden gösterilir, kullanıcı çalıştırır** — DDL kuralı)
- Drizzle schema güncel
- 13 permission key + label sabit
- 4 unit test pass
- Git: 1 commit

---

### **FAZ 2 — Backend Helper'lar + Permission Gate** (~1.5 saat)

#### 2.1 `src/lib/users/permissions.ts`

```ts
export async function getUserPermissions(userId, db): Promise<string[]>
export async function hasPermission(userId, key, db): Promise<boolean>
export async function setPermission(userId, key, enabled, grantedById, db): Promise<void>
export async function setBulkPermissions(userId, keys, grantedById, db): Promise<void>

// STAFF role default — yeni invite edilen STAFF için 3 default ON kayıt
export async function applyStaffDefaults(userId, grantedById, db): Promise<void>

// BAYI_SAHIBI ve SUPERADMIN her zaman tüm yetkilere sahip — check helper bypass eder
```

**Unit test:** 12 test (lookup / set / bulk / default apply / role bypass).

#### 2.2 `src/lib/branches/status.ts`

```ts
export type BranchStatus = 'active' | 'holiday' | 'inactive';

export async function setBranchStatus(
  companyId, branchId, status: BranchStatus, db
): Promise<Result>;

// Validation:
// - active → holiday: serbest
// - active → inactive: son aktif şube ise reject (mevcut last_active_branch check)
// - inactive → active: serbest (re-activate)
// - holiday → active: serbest
// - holiday → inactive: serbest

export async function assertBranchOperational(
  branchId, db, requireActive?: boolean
): Promise<void>;
// requireActive=true → sadece 'active'
// requireActive=false (default) → 'active' veya 'holiday' (pasif değil)
// throw → server action 403
```

**Unit test:** 10 test (her geçiş + son aktif check + assert).

#### 2.3 Permission Gate — 14 server action'a ekleme

| Action | Gate |
|---|---|
| `recordStockIn` | `hasPermission(stock_in.create)` veya BAYI_SAHIBI/OBSERVER-not-allowed |
| `recordStockOut` (sale) | `hasPermission(sale.create)` |
| `recordStockOut` (waste/gift/sample/internal/return) | her subtype için ayrı key |
| `recordTransfer` | `hasPermission(transfer.create)` |
| `recordStocktake` (drawer) | `hasPermission(stocktake.create)` |
| `startStocktake` (sayım oturumu) | `hasPermission(stocktake.create)` |
| `createProduct` | BAYI_SAHIBI only |
| `updateProduct` | BAYI_SAHIBI veya `price.edit` |
| `publishProduct` | `vitrin.manage` |
| `unpublishProduct` | `vitrin.manage` |

**Pasif şube gate:** Her stock action helper'da `assertBranchOperational(branchId)` (pasif şube'de stok hareketi yasak).

**Unit test:** 10 test (her gate'in reject + allow path'i).

#### 2.4 Observer Role Gate

`OBSERVER` role hiçbir mutation yapamaz — `lib/auth/role-gate.ts`'e yeni helper:
```ts
export function assertNotObserver(session): void {
  if (session?.user?.role === 'OBSERVER') {
    throw new Error('observer_read_only');
  }
}
```

Her mutation server action başında çağrılır.

#### 2.5 Faz 2 Çıktısı

- 3 yeni lib dosyası
- 14 server action'a gate eklendi
- 32+ unit test pass
- Git: 1 commit

---

### **FAZ 3 — Türkçe Etiket Güncellemeleri** (~30 dk)

Tüm UI'da 4 etiket global replace:

| Pattern | Yeni |
|---|---|
| `'Şube Müdürü'` veya `'şube müdürü'` | `'İzleyici'` |
| `'SUBE_MUDURU'` (string literal) | `'OBSERVER'` |
| `'Çalışan'` (mevcut "STAFF") UI'da kalır | (zaten doğru) |
| `'STAFF'` UI etiketleri | `'Çalışan'` |
| `'Bayi Sahibi'` → `'Bayi Admin'` | yeni etiket |

**Etkilenen dosyalar (tahmini ~25):**
- `/admin/settings/users/page.tsx` (rol dropdown + listede)
- `/admin/settings/users/invite-form.tsx`
- `/admin/branches/[id]/page.tsx` (şube ekibi)
- `EKRAN-KULLANICILAR.md` (doküman)
- ...

**Agent paralel batch:** 25 dosya etiket güncelleme tek tur'da.

**Test:** Snapshot/grep ile validation (eski etiket kalıntı YOK).

#### 3.1 Faz 3 Çıktısı

- ~25 dosya etiket güncel
- Browser smoke (`/admin/settings/users` UI'da "İzleyici" + "Çalışan" + "Bayi Admin" göründüğünü doğrula)
- Git: 1 commit

---

### **FAZ 4 — Şube State UI (Admin Panel)** (~1.5 saat)

#### 4.1 `/admin/branches` Liste

- Mevcut kart grid'inde **3-state badge:** 🟢 Aktif / 🟡 Tatilde / ⚫ Pasif
- Her kartta hızlı toggle: aktif → tatilde / aktif → pasif / pasif → aktif
- Tatilde rozet: "🏖 Tatilde"

#### 4.2 `/admin/branches/[id]/edit` Düzenleme

- "Şube durumu" section (3 radio veya dropdown)
- **Tatil moduna alma:** anında uygulanır, uyarı yok (esnek)
- **Pasif moduna alma:** uyarı modal (SWAL)
  - "Şubeyi pasifleştirmek üzeresin. Bu işlem sonucunda:"
  - "• Vitrin'den tamamen çekilir"
  - "• Tüm aksiyonlar kilitli olur (ürün ekleme dahil)"
  - "• Atanmış X kullanıcı sadece okuyabilir"
  - "Devam etmek istiyor musun?"

#### 4.3 `/admin/branches/[id]` Detay Sayfa

- Pasif şube'de tüm aksiyon butonları **disabled**
- Sticky banner üstte: "⚠ Bu şube pasif. Yalnızca görüntüleyebilirsin."

#### 4.4 Stok hareketleri / Sayım / Transfer

- Drawer dropdown'larında pasif şube **görünmez** (mevcut filter)
- Tatildeki şube **görünür** (operasyon devam edebilir)

#### 4.5 Permission Gate Entegrasyonu (UI yan)

- Pasif şube ID seçilince form submit edemez (HTML disabled veya server reject)

#### 4.6 Test

**Unit:** `branches/manage.ts` setBranchStatus + 10 test (mevcut).
**Browser smoke (4 senaryo):**
1. Branch list → "Tatile al" → vitrin'de rozet
2. Branch edit → Pasif radio → SWAL uyarı → onay → DB status='inactive'
3. Pasif şube /admin/branches/[id] → tüm butonlar disabled + banner
4. Stok hareketi drawer'da pasif şube dropdown'ta yok

#### 4.7 Faz 4 Çıktısı

- 3-state UI canlı
- Browser smoke 4 senaryo
- Git: 1 commit

---

### **FAZ 5 — Vitrin Tatil/Pasif** (~1 saat)

#### 5.1 Şube kartı (`/vitrin/...`)

- Tatildeki şube kartında **"🏖 Tatilde"** rozet (sarı tonu)
- "Satıcıya sor" buton **disabled** + tooltip "Şube tatilde, mesaj atamazsın"

#### 5.2 Ürün detay sayfası (`/vitrin/magaza/[slug]/urun/[productSlug]`)

- Şube tatildeyse üstte **bariz uyarı banner:**
  ```
  🏖 Bu şube şu anda tatilde
  Sipariş veya rezervasyon alınamaz. Tekrar açıldığında bilgilendirileceksin.
  ```
- WhatsApp link disabled

#### 5.3 Cross-tenant arama / kategori (`/vitrin/ara`, `/vitrin/kategori/...`)

- Tatildeki şube **listede** görünür ama "Tatilde" badge ile gri opacity
- Pasif şube ürünleri **listede yok** (mevcut filter `status='active'`)

#### 5.4 SEO + Google snippet

- Schema.org markup'a `temporarilyClosed: true` ekle (tatil mod)
- Meta description'a "Tatilde" prefix ekle (opsiyonel)

#### 5.5 Test

**Browser smoke (3 senaryo):**
1. Şube tatile alındı → `/vitrin/magaza/[slug]` → "Tatilde" rozet + disabled WhatsApp
2. Tatil şubenin ürün sayfası → bariz uyarı banner
3. Şube pasif → `/vitrin/[il]` listesinde yok

#### 5.6 Faz 5 Çıktısı

- Vitrin tatil/pasif rendering canlı
- 3 browser smoke
- Git: 1 commit

---

### **FAZ 6 — Çalışan Yetki Modal** (~1.5 saat)

#### 6.1 `/admin/settings/users` Geliştirme

- Her STAFF row'da **"⚙ Yetkiler"** buton
- Tıklayınca modal açılır (SWAL HTML veya custom dialog)

#### 6.2 Yetki Modal İçeriği

```
ÇALIŞAN YETKİLERİ — Ahmet Demir (ahmet@petshop.com)

✅ Satış kaydet                 [toggle ON]
✅ Ürün ve fiyat görüntüle      [toggle ON]
✅ Müşteri referans yazma       [toggle ON]
─────────────────────────────────────────
☐ Alım (stock-in)              [toggle OFF]
☐ Fire kaydet                  [toggle OFF]
☐ Hediye olarak çıkış          [toggle OFF]
☐ Numune çıkışı                [toggle OFF]
☐ Dahili kullanım çıkışı       [toggle OFF]
☐ İade kaydet                  [toggle OFF]
☐ Şubeler arası transfer       [toggle OFF]
☐ Sayım başlat                 [toggle OFF]
☐ İndirim uygula               [toggle OFF]
☐ Veresiye satış               [toggle OFF]
☐ Vitrin yönetimi              [toggle OFF]
☐ Variant fiyat değiştirme     [toggle OFF]

[Kapat]  [Kaydet]
```

#### 6.3 Server Action

```ts
export async function updateUserPermissionsAction(
  userId: string,
  permissions: Record<string, boolean>,
): Promise<{ ok: boolean; error?: string }>
```

- BAYI_SAHIBI yetkisi gerekli
- Audit log: `user.permissions_updated`
- Toast bildirimi sonrası

#### 6.4 Çalışan Davet Form Genişletme

`invite-form.tsx` → STAFF rolü seçilince hint:
> "💡 Çalışan eklendikten sonra yetkilerini /admin/settings/users'tan kişi bazlı güncelleyebilirsin."

#### 6.5 Test

**Unit:** `lib/users/permissions.ts` + server action gate (8 test).
**Browser smoke (3 senaryo):**
1. STAFF davet → otomatik 3 default ON yetki DB'de
2. Modal aç → 2 yetki ekle → kaydet → DB'de güncel
3. Yetki olmadan stock-in dene → toast "Bu yetkiniz yok"

#### 6.6 Faz 6 Çıktısı

- Yetki modal canlı
- 3 browser smoke
- Git: 1 commit

---

### **FAZ 7 — Şube Ekleme Wizard "Çalışan Ekle" Step** (~30 dk)

#### 7.1 `/admin/branches/new` Çoklu Step

- Mevcut tek-form → 2-step wizard
- **Step 1:** Şube bilgileri (mevcut form)
- **Step 2:** "Bu şubeye çalışan eklemek ister misin?"
  - "Evet" → mini invite form (email + role default STAFF)
  - "Atla" → uyarı: "Birden fazla şubeyi tek başına yönetmek zor olabilir. Sonradan /admin/settings/users'tan ekleyebilirsin."
  - Continue

#### 7.2 Onboarding wizard etkilenmez

İlk şube onboarding'de açıldığı için bu yeni step **sadece sonraki şube ekleme**de tetiklenir.

#### 7.3 Test

**Browser smoke (2 senaryo):**
1. 2. şube ekle → step 2 → çalışan davet → success
2. 2. şube ekle → step 2 atla → uyarı SWAL

#### 7.4 Faz 7 Çıktısı

- Wizard step 2 canlı
- Git: 1 commit

---

### **FAZ 8 — Observer Davet Flow** (~45 dk)

#### 8.1 Davet Form (`/admin/settings/users/invite-form.tsx`)

- Role dropdown: `OBSERVER` seçeneği eklendi
- "İzleyici, tüm şubelerinizi sadece görüntüler — hiçbir aksiyon yapamaz" hint

#### 8.2 Davet Email/Link

- Mevcut `invite_method='link'` flow
- Link 24h TTL, kabul edince OBSERVER rolü atanır
- Hesap açılınca otomatik aktif (tek yönlü)

#### 8.3 Observer Login Sonrası UI

- Sidebar: tüm menüler **görünür ama disabled aksiyonlarla**
- Topbar'da rol badge: "🔍 İzleyici"
- "Hiçbir aksiyon yapamazsın" sticky banner üstte

#### 8.4 Backend Gate

- Her mutation action'da `assertNotObserver(session)` çağrısı (Faz 2'de eklendi)

#### 8.5 Test

**Browser smoke (2 senaryo):**
1. Bayi Admin → OBSERVER davet → link → kabul → otomatik aktif
2. OBSERVER login → dashboard görünür → "Yeni ürün" butonu disabled → CRUD action'lar throw

#### 8.6 Faz 8 Çıktısı

- Observer davet + login flow
- 2 browser smoke
- Git: 1 commit

---

### **FAZ 9 — Tests + Browser Smoke + Doküman + Push** (~1 saat)

#### 9.1 Tüm Test Suite

```bash
npx vitest run --no-coverage --reporter=dot
# Beklenen: 1503 + ~60 yeni = 1560+ test pass
```

#### 9.2 Final Browser Smoke (10 senaryo)

1. ✅ Schema migration uygulandı, eski user role hâlâ login (`SUBE_MUDURU` → `OBSERVER` migration sonrası)
2. ✅ Şube state badge'leri (`/admin/branches` 3 farklı şube)
3. ✅ Tatil moduna alma → vitrin rozet
4. ✅ Pasif moduna alma → uyarı modal + vitrinden çekilme
5. ✅ Pasif şube admin paneli → tüm aksiyon disabled
6. ✅ STAFF yetki modal → yetki ekleme → DB güncel
7. ✅ STAFF stock-in yetkisiz → toast "Yetkiniz yok"
8. ✅ STAFF stock-in yetkili → action başarılı
9. ✅ OBSERVER davet + login → read-only
10. ✅ Şube ekleme wizard step 2 çalışan ekle

#### 9.3 Doküman Güncelleme

| Dosya | İçerik |
|---|---|
| `DATABASE-SCHEMA.md` | userRole enum güncel + branch_status enum + user_permissions tablo |
| `EKRAN-KULLANICILAR.md` | Yeni rol matrisi (Bayi Admin / Observer / Çalışan / Süperadmin) + yetki modal |
| `EKRAN-SUBELER.md` | 3-state UI + Tatil + Pasif davranışları |
| `EKRAN-PUBLIC-VITRIN.md` | Tatilde rozet + Satıcıya sor disabled + ürün sayfa uyarı |
| `EKRAN-AYARLAR.md` | Yetki tab açıklama |
| `PLAN-KADEMELERI.md` | Rol matrisi |
| `CLAUDE.md` | Ana karar tablosuna kaydet (2026-05-21 satırı) |
| `DEVAM-REHBERI.md` | Tüm 9 faz özet + browser smoke kanıtları |

#### 9.4 Git

- 9 fazın commit'leri (her faz ayrı) zaten yapıldı
- Final docs commit: tek seferde
- Push: `git push origin cray61`

#### 9.5 Faz 9 Çıktısı

- 1560+ test pass
- 10 browser smoke pass
- 8 doküman güncel
- Push edildi

---

## 🌐 Browser Smoke Senaryoları (Tam Liste)

Tüm faz'lar boyunca yapılacak smoke testleri:

### Schema + Migration
- [ ] Eski `SUBE_MUDURU` kullanıcı login → role artık `OBSERVER`
- [ ] `branch_status` enum 3 değer DB'de mevcut
- [ ] `user_permissions` tablosu ve index'i mevcut

### Şube State
- [ ] `/admin/branches` 3-state badge render
- [ ] Aktif → Tatil → DB status='holiday'
- [ ] Aktif → Pasif → SWAL uyarı + DB status='inactive'
- [ ] Pasif → Aktif → re-activate başarılı
- [ ] Pasif şube /admin/branches/[id] → tüm butonlar disabled
- [ ] Pasif şube /admin/products/new → "şube seç" dropdown'ta yok
- [ ] Tatildeki şube /admin/stock-movements → drawer'da görünür

### Vitrin
- [ ] `/vitrin/magaza/[slug]` tatil → "🏖 Tatilde" rozet + Satıcıya sor disabled
- [ ] `/vitrin/magaza/[slug]/urun/[productSlug]` tatil → bariz uyarı banner
- [ ] `/vitrin/[il]` pasif şube → görünmez
- [ ] `/vitrin/ara?q=mama` → tatil şube gri opacity + Tatilde badge

### Çalışan Yetkileri
- [ ] STAFF davet → 3 default ON yetki DB'de
- [ ] `/admin/settings/users` STAFF row → "⚙ Yetkiler" buton
- [ ] Modal aç → 13 toggle render
- [ ] Yetki ekle → kaydet → DB güncel + toast
- [ ] STAFF login → stock-in dene (yetkisiz) → toast "Yetkiniz yok"
- [ ] BAYI_SAHIBI o yetki açar → STAFF tekrar dene → başarılı
- [ ] Audit log: `user.permissions_updated` görünür

### Observer
- [ ] Bayi Admin OBSERVER davet → link gönder
- [ ] Linke tıklama → hesap aç → otomatik aktif
- [ ] OBSERVER login → sidebar görünür ama action disabled
- [ ] OBSERVER "+ Yeni ürün" tıkla → action gate "observer_read_only"
- [ ] Topbar rol badge: "🔍 İzleyici"

### Şube Ekleme Wizard
- [ ] 2. şube ekle → step 2 → "Çalışan ekle"
- [ ] "Atla" → SWAL uyarı "Tek başına 2 şubeyi yönetmek zor"
- [ ] Çalışan davet step 2 → success

### Etiket Doğrulama
- [ ] `/admin/settings/users` → "İzleyici" + "Çalışan" + "Bayi Admin" görünür
- [ ] `SUBE_MUDURU` veya "Şube Müdürü" UI'da YOK
- [ ] Topbar tenant adı + rol etiketi doğru

---

## 🧪 Test Kapsamı

### Yeni Unit Test'ler (Tahminen +60)

| Dosya | Test Sayısı |
|---|---|
| `lib/users/permission-keys.test.ts` | 4 |
| `lib/users/permissions.test.ts` | 12 |
| `lib/branches/status.test.ts` | 10 |
| `lib/branches/manage.test.ts` (mevcut, eklemeler) | +5 (status geçişleri) |
| Server action gate testleri | +15 (her gate için) |
| Observer role gate | +6 |
| **Toplam yeni** | **~52** |

**Sonuç:** 1503 → ~1555 test pass.

### Mevcut Test'ler

- Etkilenmemeli — etiket değişiklikleri unit test'lere yansımamalı (test'ler iş mantığı kontrol eder, UI string'i değil)
- Sadece `SUBE_MUDURU` literal beklentisi olan testler → `OBSERVER`'a güncellenir

---

## 📚 Doküman Güncellemeleri (Detay)

### 1. `docs/DATABASE-SCHEMA.md`

**Bölüm 3.1 — userRole enum:**
```diff
- 'BAYI_SAHIBI', 'SUBE_MUDURU', 'STAFF', 'SUPERADMIN', 'BAYI_ADMIN'
+ 'BAYI_SAHIBI', 'OBSERVER', 'STAFF', 'SUPERADMIN'
+ (BAYI_ADMIN değer olarak kaldı ama UI'da yok — Faz 3 iptal)
```

**Bölüm 3.2 — branches tablo:**
```diff
+ status branch_status NOT NULL DEFAULT 'active'
+ Enum: active | holiday | inactive
+ isActive korunur (geri uyumluluk, status=='active' ile sync)
```

**Yeni Bölüm 3.6 — user_permissions tablo:**
```
- id, user_id, permission_key, enabled, granted_by_id, granted_at
- 13 permission key sabit
- STAFF default 3 ON kayıt insert helper
```

### 2. `docs/EKRAN-KULLANICILAR.md`

**Bölüm 12.5 — Rol matrisi güncel:**
```
| Rol         | Read | Stok | Satış | Sayım | Transfer | Vitrin | CRUD |
|---|---|---|---|---|---|---|---|
| BAYI_SAHIBI | ✓    | ✓    | ✓     | ✓     | ✓        | ✓      | ✓    |
| OBSERVER    | ✓    | ✗    | ✗     | ✗     | ✗        | ✗      | ✗    |
| STAFF       | ✓    | *    | ✓†    | *     | *        | *      | ✗    |
| SUPERADMIN  | ✓    | ✓    | ✓     | ✓     | ✓        | ✓      | ✓    |

* = yetki bazlı (Bayi Admin tek tek açar)
† = sale subtype default ON, diğer subtype'lar yetki bazlı
```

**Yeni bölüm: Çalışan Yetkileri Modal**
- 13 toggle açıklaması
- Default ON/OFF tablosu
- Audit log integration

### 3. `docs/EKRAN-SUBELER.md`

**Yeni bölüm: 3-State Mod**
- active / holiday / inactive davranışları
- UI badge'ler (kart + edit modal)
- Pasif modunda admin paneli read-only

### 4. `docs/EKRAN-PUBLIC-VITRIN.md`

**Yeni alt-bölüm: Tatilde / Pasif Şube Davranışı**
- Vitrin kart "🏖 Tatilde" rozet
- Satıcıya sor button disabled state
- Ürün detay sayfası uyarı banner
- Cross-tenant search gri opacity

### 5. `docs/EKRAN-AYARLAR.md`

**Bölüm 5 — Kullanıcılar tab güncel:**
- Her STAFF row'da "⚙ Yetkiler" buton
- Modal screenshot/şema

### 6. `docs/PLAN-KADEMELERI.md`

**Bölüm 3.2 — Rol kademeleri:**
- BAYI_ADMIN Faz 3 iptal notu
- Observer eklendi

### 7. `CLAUDE.md`

**Ana karar tablosuna 2026-05-21 satırı ekle:**
```
| Observer/Şube state/Yetki | 2026-05-21: SUBE_MUDURU→OBSERVER rename, branch_status 3-state, STAFF granular permissions, Faz 3 BAYI_ADMIN iptal | EKRAN-KULLANICILAR + EKRAN-SUBELER + DATABASE-SCHEMA |
```

### 8. `docs/DEVAM-REHBERI.md`

**Yeni tur başlığı: "2026-05-21 — Observer + Yetki + Şube State Refactor"**
- 9 fazın tamamı özet
- Browser smoke kanıtları
- Etkilenen dosya listesi

**Önceki tur özetleri (eksik 12 commit'in işlenmesi):**
- 711be26 settle-credit smoke fix
- d80d893 aria-invalid 36 form
- b7bd70e SWAL modal→toast
- 4e4d997 security role=alert→status
- 62bd594 SWAL refactor 41 dosya
- c88a55c +79 edge case test
- 56c7269 Excel import
- 4fbff90 xlsx locale
- d2ebd33 xlsx dd/mm/yyyy
- 0b37c5c CSV→Excel
- 37f42cf bayi-admin iskelet
- d3cea77 Karar A+C pricing

---

## ⚠ Risk + Dikkat Edilecekler

### 1. Migration Geri Uyumluluk
- `SUBE_MUDURU` → `OBSERVER` rename **DDL**, kullanıcı çalıştıracak (memory kuralı)
- Mevcut JWT'ler `SUBE_MUDURU` taşıyabilir — JWT refresh veya re-login gerekebilir
- Auth.js callback'lerinde role lookup DB'den (JWT cache değil)

### 2. Permission Cache Stratejisi
- Her server action'da DB query maliyetli
- Çözüm: session.permissions cache (login sonrası DB'den getir, JWT'ye gömme — büyük JWT)
- Veya kısa-süreli in-memory cache (5 dk TTL)
- **MVP:** Her action'da DB query (basit, sonra optimize)

### 3. Pasif Şube Stok Kaybı
- Pasif modunda branch_inventory korunur (kayıp yok)
- Re-activate'te eski stok hâlâ orada
- **Doküman not:** "Pasifleştirilmeden önce stok'u başka şubeye transfer etmek önerilir"

### 4. Observer + Tatil Şube Kombinasyonu
- Observer tatildeki şubeyi de okuyabilir (sadece read, problem yok)
- Pasif şube'de bile read-only erişim var (Observer'a açık)

### 5. Faz 3 BAYI_ADMIN Cleanup
- `userRoleEnum`'da değer kalır (Postgres enum drop limited)
- `/admin/bayi/page.tsx` placeholder dosyası **silinir**
- `EKRAN-SUPERADMIN.md` §2.5.4 Bayi Admin yönetimi bölümü güncellenir veya kaldırılır

### 6. Tests Düzeltme
- Mevcut testlerde `'SUBE_MUDURU'` literal kullanılan yerler güncellenir
- Grep: `grep -rln 'SUBE_MUDURU' src/` → tek tek dönüştür

---

## ✅ Bitirme Kriteri (Definition of Done)

- [ ] Migration 0019 uygulandı (kullanıcı çalıştırdı)
- [ ] 1555+ test pass
- [ ] Lint + typecheck 0 error
- [ ] 10 browser smoke senaryosu pass
- [ ] 8 doküman güncel
- [ ] Git push origin cray61
- [ ] DEVAM-REHBERI yeni session bağlamı için hazır

---

## 🚀 Yeni Session Başlangıç Yöntemi

Yeni session açtığında ilk yapılacak:

```
1. cd D:\Projeler\PetStockPro
2. claude
3. İlk komut: "PLAN-OBSERVER-STAFF-BRANCH-STATE.md oku ve Faz 1'e başla"
```

Claude bu plan dosyasını okuyup tüm bağlamı yükler.

---

*Plan yazıldı: 2026-05-20. İmplementasyon: yeni session (2026-05-21+).*
*Sorumluluk: Bayi Admin (Oğuzhan).*
*Tahmini bitirme: 3-4 tur, ~9-10 saat efektif geliştirme.*
