# PetStockPro — Supabase Setup Rehberi

**Durum:** Domain alındı (petstockpro.com Cloudflare), Supabase proje hazır
**Schema:** `petstockpro` (mevcut Supabase projesinde yeni schema)
**Region:** 📍 **`eu-central-1` (Frankfurt, Almanya)** — 2026-05-14 onaylandı

> Bu doküman Supabase projesinde **PetStockPro için özel schema** kurma, RLS aktivasyon ve Drizzle bağlantı adımlarını içerir.

---

## 0. Region — Frankfurt (eu-central-1)

**Karar (2026-05-14):** Supabase projesi **Frankfurt (eu-central-1)** region'ında. Detaylı gerekçe: `DEPLOYMENT.md §2.3`.

**Mevcut proje kontrol:** Supabase Dashboard → Project Settings → General → Region:
- Eğer projeden `eu-central-1` görünüyorsa ✅ tamam
- Eğer **farklı region** görünüyorsa → yeni proje aç (Supabase region migration desteği yok), eski projeyi sil

**Latency benchmark (Sprint 0 verification):**
```bash
# İstanbul'dan ortalama:
curl -w "@curl-format.txt" -o /dev/null -s https://[project-ref].supabase.co
# Beklenen: ~30-50ms
```

**KVKK uyumu için kayıt formu checkbox + aydınlatma metni** Sprint 2'de (auth.html) implement edilir. Detay: `DEPLOYMENT.md §2.3` 3 katman.

---

## 1. Supabase Project Hazırlık

Kullanıcı zaten Supabase projesini açmış. **Mevcut proje** kullanılacak, sadece **yeni schema** içinde tablolar.

### 1.1 Schema Stratejisi

**Neden ayrı schema?**
- Mevcut Supabase projesinde başka tablolar olabilir
- `petstockpro` schema'sı içine sadece PetStockPro tabloları
- Diğer projelerden izolasyon
- Drizzle config'i schema-aware

### 1.2 Schema Oluşturma SQL

Supabase Dashboard > SQL Editor'da çalıştır:

```sql
-- 1. Yeni schema yarat
CREATE SCHEMA IF NOT EXISTS petstockpro;

-- 2. Search path ayarı (her session'da)
-- (Drizzle config'inde de belirtilecek)

-- 3. Schema'da extensions (2026-05-13 revize — vitrin gereksinimleriyle genişledi)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;       -- gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA public;        -- ürün arama (fuzzy + GIN index)
CREATE EXTENSION IF NOT EXISTS "postgis" SCHEMA public;        -- ⭐ Vitrin yakınlık sorgusu ("en yakın pet shop")
-- 2026-05-14 MANTIK-HATALARI S4: earthdistance KALDIRILDI. PostGIS tek extension.
-- CREATE EXTENSION IF NOT EXISTS "earthdistance";  -- kullanılmıyor
CREATE EXTENSION IF NOT EXISTS "moddatetime" SCHEMA public;    -- updated_at otomatik trigger
CREATE EXTENSION IF NOT EXISTS "pg_jsonschema" SCHEMA public;  -- JSONB validation (working_hours, vb.)
CREATE EXTENSION IF NOT EXISTS "unaccent" SCHEMA public;       -- TR karakter unaccent (arama için "Üsküdar" → "uskudar")

-- 4. anon ve authenticated rollerine schema kullanma izni
GRANT USAGE ON SCHEMA petstockpro TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA petstockpro TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA petstockpro TO anon;

-- 5. Default privileges (gelecekte yaratılan tablolar için)
ALTER DEFAULT PRIVILEGES IN SCHEMA petstockpro
  GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA petstockpro
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA petstockpro
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- 6. petstockpro schema'sını Supabase API'sine expose et
-- (Supabase Dashboard > Settings > API > Exposed schemas: ekleyin "petstockpro")
```

### 1.3 Supabase Dashboard Konfigürasyonu

1. **Settings > API > Exposed schemas:**
   ```
   public, petstockpro
   ```
   ("public" yine kalsın — Supabase auth.users tablosu public'te çalışır)

2. **Settings > API > Database password:** Save (env'ye koy)

3. **Settings > API > JWT Secret:** Save (env'ye `SUPABASE_JWT_SECRET` olarak koy)

4. **Authentication > Settings:**
   - Site URL: `https://petstockpro.com`
   - Redirect URLs:
     - `http://localhost:3000/api/auth/callback/*`
     - `https://petstockpro.com/api/auth/callback/*`
     - `https://www.petstockpro.com/api/auth/callback/*`
     - <!-- MANTIK-HATALARI O1: wildcard `*.petstockpro.com` kaldırıldı (tenant subdomain iptal, 2026-05-13) -->
     - <!-- MANTIK-HATALARI O1: `super.petstockpro.com` kaldırıldı (süperadmin tek /admin URL'i kullanır, 2026-05-14) -->

5. **Storage > Create buckets:**
   - `product-images` (public read, authenticated write)
   - `tenant-logos` (public read, authenticated write)
   - `documents` (private, dekontlar vb.)

---

## 2. Drizzle Config Schema-Aware

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT!,  // migration için direct connection
  },
  schemaFilter: ['petstockpro'],
  verbose: true,
  strict: true,
});
```

Drizzle schema dosyalarında schema belirt:

```ts
// src/db/schema/tenant.ts
import { pgSchema } from 'drizzle-orm/pg-core';

export const petstockpro = pgSchema('petstockpro');

export const companies = petstockpro.table('companies', {
  // kolonlar...
});
```

---

## 3. Drizzle Client Connection

```ts
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Connection — pooled (DATABASE_URL Supabase pooler kullanıyor)
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,    // Supabase pooler "Transaction" mode için
  max: 1,            // serverless için tek connection
});

export const db = drizzle(client, { schema });
```

---

## 4. Supabase Client (RLS için)

```ts
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';

export function createClient(supabaseAccessToken?: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: supabaseAccessToken
          ? { Authorization: `Bearer ${supabaseAccessToken}` }
          : {},
      },
      db: {
        schema: 'petstockpro',  // RLS'in çalıştığı schema
      },
    }
  );
}
```

---

## 5. RLS JWT Custom Claims (Auth.js → Supabase)

Auth.js JWT'sini Supabase'in tanıyacağı formatta sign etmemiz gerekir.

> **2026-05-14 MANTIK-HATALARI KT2-1:** `is_superadmin` JWT claim'i **kaldırıldı**. Tek kaynak gerçeklik = `role` (O6 düzeltmesinin yarım kalmış kısmı tamamlandı). PostgREST `role` claim'i Supabase auth için 'authenticated' / 'service_role' bekler; **bizim app role'ümüz (`'SUPERADMIN' | 'ADMIN' | 'STAFF' | 'BAYI_ADMIN'`) `user_role` claim'i olarak yazılır.**

```ts
// src/lib/auth/supabase-jwt.ts
import { SignJWT } from 'jose';

export async function signSupabaseJwt(user: {
  sub: string;
  company_id: string;
  branch_id?: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'STAFF' | 'BAYI_ADMIN';  // 2026-05-14 KT2-1: is_superadmin → role
  email: string;
}) {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);

  return await new SignJWT({
    sub: user.sub,
    aud: 'authenticated',
    role: user.role === 'SUPERADMIN' ? 'service_role' : 'authenticated',  // PostgREST level (Supabase auth)
    user_role: user.role,                                                   // App level (RLS politikaları okur — KT2-1)
    email: user.email,
    company_id: user.company_id,
    branch_id: user.branch_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}
```

Auth.js callback'inde session'a inject:

```ts
// src/lib/auth/config.ts
session: async ({ session, token }) => {
  // ...
  session.supabaseAccessToken = await signSupabaseJwt({
    sub: token.sub,
    company_id: token.companyId,
    branch_id: token.branchId,
    role: token.role,  // 2026-05-14 KT2-1: tek kaynak
    email: token.email,
  });
  return session;
}
```

---

## 6. RLS Helper Functions (DB içi)

```sql
-- petstockpro schema içinde
CREATE OR REPLACE FUNCTION petstockpro.auth_company_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.company_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION petstockpro.auth_branch_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.branch_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- 2026-05-14 MANTIK-HATALARI KT2-1: is_superadmin claim → user_role claim (tek kaynak)
CREATE OR REPLACE FUNCTION petstockpro.auth_is_superadmin() RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_setting('request.jwt.claim.user_role', true), '') = 'SUPERADMIN';
$$ LANGUAGE SQL STABLE;

-- Genel role accessor — ADMIN/STAFF/BAYI_ADMIN ayrımı RLS'te de lazım
CREATE OR REPLACE FUNCTION petstockpro.auth_user_role() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.user_role', true), '');
$$ LANGUAGE SQL STABLE;
```

DATABASE-SCHEMA.md'deki politikalar bu fonksiyonları kullanır.

---

## 7. Migration Akışı

```bash
# Schema değişti, migration üret
npx drizzle-kit generate

# Migration apply
npx drizzle-kit migrate

# RLS politikaları manuel (drizzle/rls/*.sql)
psql $DATABASE_URL_DIRECT -f drizzle/rls/001_enable_rls.sql
psql $DATABASE_URL_DIRECT -f drizzle/rls/002_helper_functions.sql
# ...

# Drizzle Studio (DB GUI)
npx drizzle-kit studio
```

---

## 8. Test Bağlantısı (Sprint 0'da)

```ts
// scripts/test-connection.ts
import 'dotenv/config';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

async function test() {
  const result = await db.execute(sql`SELECT current_schema(), version();`);
  console.log(result);
}

test();
```

```bash
npx tsx scripts/test-connection.ts
```

Beklenen çıktı:
```
[{ current_schema: 'petstockpro', version: 'PostgreSQL 15.x ...' }]
```

---

## 9. Realtime Aktivasyon

Supabase Dashboard > Database > Replication:
- `petstockpro.stock_movements` → INSERT aktive et
- `petstockpro.branch_inventory` → UPDATE aktive et
- `petstockpro.notifications` → INSERT aktive et

(Realtime sadece aktif tablolarda çalışır)

---

## 10. Storage Bucket Policies

> **2026-05-21 not (6. tur YT6-8):** Ürün görselleri için Supabase Storage **kullanılmıyor** — Cloudflare R2'ye taşındı (5. tur YT5-2/3 kararı, bkz. EKRAN-URUNLER §7.3 + DEPLOYMENT.md §0/§7.1). Supabase Storage sadece e-Arşiv PDF için (`invoice-archives` bucket — Sprint 14 Nilvera entegrasyonu).

```sql
-- invoice-archives: e-Arşiv PDF (Nilvera), sadece tenant'ın kendi tenant_id klasörü
-- Public read YOK (KVKK + ticari gizlilik). Server-side signed URL ile indirilir.
CREATE POLICY "Tenant private invoice archives" ON storage.objects
  FOR ALL USING (
    bucket_id = 'invoice-archives'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
  );

-- documents: tenant'ın kendi belgeleri (lojistik, KVKK ek belgeler vb. — opsiyonel)
CREATE POLICY "Tenant private documents" ON storage.objects
  FOR ALL USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
  );
```

---

## 11. Sıradaki Adımlar

1. ✅ Bu doküman okundu
2. ⏭ Supabase Dashboard'da §1.2 SQL çalıştırılacak (Sprint 0'da)
3. ⏭ §1.3 Exposed schemas + auth + storage konfigürasyon
4. ⏭ Drizzle config + connection test (Sprint 0'da)
5. ⏭ RLS politikaları (Sprint 1'de)

---

*Son güncelleme: 2026-05-12.*
