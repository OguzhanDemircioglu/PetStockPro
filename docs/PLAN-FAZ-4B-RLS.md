# PLAN — Faz 4B: Gerçek RLS Tenant İzolasyonu (Cutover Runbook)

> **Kaynak:** docs/PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE.md §FAZ 4B + 2026-06-18 oturum kararı ("önce güvenli kod hazırlığı").
> **Durum:** 🟡 KOD HAZIR, CUTOVER BEKLİYOR. Hiçbir adım prod'a uygulanmadı.
> **Felsefe filtresi (CLAUDE.md #1):** invaziv ama tek seferlik; staging-first; geri alınabilir (tek env değişikliği).

Faz 4A (statik guard) unutulan `WHERE company_id`'i CI'da yakalar ama **runtime'da sızıntıyı durdurmaz** (RLS dekoratif — runtime owner rolüyle bypass ediyor). 4B yapısal duvar: unutulan filtre **0 satır** (fail-closed).

---

## ✅ Bu oturumda HAZIRLANAN (uygulanmadı, reviewable)

| Artefakt | Ne |
|---|---|
| `src/db/migrations/0035_rls_tenant_isolation.sql` | GRANT + ENABLE RLS + 27 politika (17 scoped + 3 child + companies/users + 5 global). **Journal'a girmez, UYGULANMADI.** |
| `src/lib/db/with-tenant.ts` | `withTenant(companyId, fn, client)` (tx + GUC) + `withOwner(fn)` + `TenantTx`/`TenantDb` tipleri. **Canlı path'e bağlı değil → prod davranışı değişmedi.** |
| `src/lib/db/rls.test.ts` | Cross-tenant 0-satır + fail-closed integration testi. `RLS_TEST_*` env yoksa **skip**. |
| `src/lib/db/tenant.ts` (Faz 4A) | Tablo sınıflandırması — 0035'in girdisi. |

---

## 🔑 Mimari karar: İKİ BAĞLANTI

Runtime aynı anda iki role ihtiyaç duyar:

| Bağlantı | Rol | Kullanım |
|---|---|---|
| `DATABASE_URL` | **`app_user`** (NOBYPASSRLS) | Varsayılan `db` — tüm tenant request'leri (`withTenant`) |
| `DATABASE_URL_OWNER` | **`postgres`** (owner, bypass) | `withOwner` — özel yollar (aşağıda) + `drizzle-kit migrate` |

`client.ts` Phase 2'de iki pool export eder: `db` (app_user) + `dbOwner` (owner). `withOwner` `dbOwner`'ı kullanır.

---

## 🚧 ÖZEL YOLLAR — `withOwner` ZORUNLU (tenant-session YOK)

Bunlar `app.current_company_id` GUC'u olmadan çalışır → app_user altında RLS 0 satır verir → **owner bağlantısı (RLS bypass) gerekir.** Hepsi tenant-guard.test.ts'in muaf tuttuğu bölgelerle örtüşür:

- **auth** (`lib/auth/*`, login/register/verify/reset) — oturum yok; users/companies'i email/token ile sorgular.
- **companies/users OLUŞTURMA** (register, invite, onboarding) — yeni id GUC'a eşit değil → WITH CHECK reddeder.
- **cron** (`api/cron/*`, `lib/cron`, `billing/renewals`, `*-reconcile`, `cleanup/retention`, `stock/reconcile`) — tüm tenant'lar.
- **webhook** (`api/webhooks/paytr`, `billing/orchestrator`) — merchant_oid ile girer.
- **süperadmin** (`lib/superadmin/*`, `ai/stats`) — kasıtla cross-tenant. (Impersonation → `withTenant(seçilenCompanyId)` ile DB-zorlamalı.)
- **vitrin public** (`lib/vitrin/*`, `api/vitrin/*`) — anon, onaylı tüm tenant'lar (storefrontStatus filtreleri korur).
- **global tablo YAZMA** (brands/categories CRUD — süperadmin). app_user globalleri yalnız OKUR.
- **sessions / processed_webhooks / system_errors** — app_user'dan REVOKE edildi (owner-only).

---

## 📋 CUTOVER — iki fazlı (staging → prod)

> **🔑 EN KRİTİK İÇGÖRÜ:** Kod retrofit'ini (Phase 1) **owner bağlantısı altında** yap — owner RLS'i bypass ettiği için `withTenant`/`withOwner` sarmalı davranışı DEĞİŞTİRMEZ (set_config zararsız, 0035 henüz zorlamıyor). Böylece atlanmış call-site **app_user fail-closed yapmadan ÖNCE** staging smoke'da yakalanır. Enforcement (Phase 2) ancak retrofit %100 bittikten sonra açılır.

### PHASE 1 — Retrofit (owner altında, davranış değişmez, incremental shippable)

1. **`withTenant` retrofit** — tenant server-action + RSC page sınırlarında `db` kullanan her yeri sar:
   ```ts
   const rows = await withTenant(session.user.companyId, (tx) =>
     listSuppliers(session.user.companyId, tx));
   ```
   Tenant helper imzalarını `db: DbClient` → `db: TenantDb` ile genişlet (tip-only, runtime'sız) — hem owner hem tx kabul etsin. (~114 call-site; tenant.ts + Faz 4A guard envanteri kılavuz.)
2. **`withOwner` retrofit** — yukarıdaki özel yolları `withOwner`'a taşı (Phase 1'de `dbOwner` henüz yok → default `db`; Phase 2'de `dbOwner` inject edilir).
3. Her dilimden sonra: `typecheck` + `lint` + `test:run` yeşil. **Owner altında deploy → davranış birebir aynı.** Atlanan yer varsa Phase 2 staging smoke'da fail-closed ile çıkar.
4. **Tam staging smoke** (owner): tüm admin sayfaları + login + onboarding + vitrin + cron/webhook. Hepsi çalışmalı (henüz enforcement yok).

### PHASE 2 — Enforcement (staging önce, sonra prod)

5. **STEP 0 — `app_user` rolü** (Aiven staging + Supabase, owner ile):
   ```sql
   CREATE ROLE app_user LOGIN PASSWORD '<güçlü-parola>' NOBYPASSRLS;
   ```
6. **STEP 1 — env** (staging): `DATABASE_URL_OWNER` = mevcut owner URL ekle; `client.ts` `dbOwner` pool export etsin + `withOwner` onu kullansın. (`DATABASE_URL`'i henüz app_user'a ÇEVİRME.)
7. **STEP 2 — 0035 uygula** (staging owner ile, node-postgres/execute_sql; journal'a EKLEME).
8. **STEP 3 — `rls.test.ts`** (staging):
   ```
   RLS_TEST_DATABASE_URL=<app_user@staging> RLS_TEST_COMPANY_A=<uuid> RLS_TEST_COMPANY_B=<uuid> \
     npx vitest run src/lib/db/rls.test.ts
   ```
   Cross-tenant 0-satır + fail-closed + global-read GEÇMELİ.
9. **STEP 4 — env flip** (staging): `DATABASE_URL` = app_user. Deploy. **Enforcement AÇIK.**
10. **STEP 5 — tam staging smoke** (app_user): her sayfa + login + onboarding + vitrin + impersonation + cron/webhook. Atlanan call-site → "boş liste / 0 kayıt" olarak görünür → `withTenant`/`withOwner` eksik, düzelt, tekrar.
11. **STEP 6 — PROD**: STEP 0 + 0035 apply + `DATABASE_URL_OWNER` ekle + deploy (kod) → izle → `DATABASE_URL` app_user'a çevir → izle (system_errors + 0-kayıt şikayeti).

---

## ↩ Rollback (acil)

Enforcement sonrası sorun → **runtime `DATABASE_URL`'i owner'a geri çevir** (tek env değişikliği, anında etki) → uygulama owner ile RLS bypass eder, eski davranış. Kod (`withTenant`/`withOwner` sarmalı) owner altında zararsız kaldığı için geri alınması gerekmez. İsteğe bağlı: 0035 politikalarını DROP + DISABLE RLS.

---

## ❓ Cutover öncesi netleşecek kararlar

1. **`dbOwner` pool boyutu** — owner çoğu request'te kullanılmaz (yalnız özel yollar); serverless'ta `max: 1` yeter mi?
2. **Impersonation** — süperadmin tenant'a girince `withTenant(targetCompanyId)` mı yoksa `withOwner` + audit mi? (Öneri: `withTenant` → DB-zorlamalı izolasyon + impersonation audit.)
3. **Auth.js session adapter** — session okuma owner-path; adapter'ı `dbOwner`'a bağlamanın en temiz yolu (custom adapter client).
4. **Aiven free-tier** — staging için ayrı bir DB/branch mi, mevcut Aiven mi? (Cutover sırasında local dev'i bozmamak için ayrı şema/branch önerilir.)
5. **Global yazma** — brands/categories süperadmin CRUD `withOwner` ile mi, yoksa app_user'a dar bir write policy mi? (Öneri: `withOwner` — yüzey küçük.)

---

## 🧪 Test stratejisi

- **Unit (CI, şimdi):** `with-tenant.ts` egzersizi `rls.test.ts` içinde (env yoksa skip). Faz 4A guard yeni call-site'ları companyId disiplinine zorlar.
- **Integration (staging):** `rls.test.ts` — cross-tenant 0-satır (en kritik), fail-closed unset/'' GUC, global-read, ardışık-context sızdırmazlık.
- **Smoke (staging, app_user):** her sayfa boş-değil; login/onboarding/vitrin/impersonation/cron/webhook çalışır.
- **Regression:** tüm suite owner altında (Phase 1) + app_user altında (Phase 2) yeşil.
