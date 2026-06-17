# PLAN — Mimari Sağlamlaştırma + Frontend State (Doğru Orta Yol)

> **Kaynak:** 2026-06-17 mimari denetim (2 review) + state management tartışması.
> **Felsefe filtresi:** Her madde CLAUDE.md #1 kuralından geçti — tek geliştirici, sade tut, 3. parti > custom, otomatize et.
> **Ana tez:** Mühendislik titizliği bugüne kadar *tenant-içi eşzamanlılığa* (var olmayan problem) harcanmış; *tenant-arası izolasyon* (kesin problem) elle `WHERE company_id` disiplinine bırakılmış. Bu plan dengeyi düzeltir + state'i bozmadan hızlandırır.

## Durum & Kapsam

Bu plan iki konuşmayı tek yol haritasına birleştirir:
1. **Mimari denetim** (8 boyut, NOW/SOON/LATER aksiyon listesi)
2. **State management** — Zustand çalışma-belleği fikri reddedildi; **doğru orta yol** onaylandı: referans verisi cache + transactional optimistic-onaylı yazma.

**Test prensibi (kullanıcı vurguladı — hiçbir şey atlanmaz):** Her faz `unit` (vitest) + gerektiğinde `integration` (gerçek DB) + `browser smoke` (playwright / preview) içerir. Faz tamamlanmadan testler yeşil + `typecheck` + `lint` 0 error.

**Sıralama prensibi:** ucuz + güvenli + yüksek-getiri önce. Büyük taş (RLS) sona kadar bekletilmez ama en invaziv olduğu için Faz 4'te, önüne ucuz bir güvenlik ağı (Faz 4A) konarak gelir.

---

## FAZ 0 — Ölçüm & Doğrulama (yarım gün, kod yok)

> Optimize etmeden ölç. Varsayımlarla iş yapma.

| # | Görev | Çıktı |
|---|---|---|
| 0.1 | **Gerçek darboğazı ölç.** Admin panelde sayfa geçişi + liste sorgusu latency'sini ölç (Vercel Speed Insights + `db logger` dev'de zaten açık). "Hız problemi nerede?" sorusunu veriyle yanıtla. | Hangi sayfaların yavaş hissettirdiğinin listesi. Eğer darboğaz RSC re-fetch ise → Faz 2 çözer; eğer transactional yazma ise → zaten ms düzeyinde (Faz 2C). |
| 0.2 | **DATABASE_URL hedefini doğrula.** Pooler mı (transaction-mode pgBouncer/Supavisor) yoksa direct mi? `prepare:true` kararı buna bağlı. | Karar: prepare flag + pool max değeri (Faz 1C). |
| 0.3 | **PITR backup teyidi.** Supabase + Aiven'da point-in-time recovery açık mı? Stok ledger'ı için veri kaybı ölümcül. | Ekran görüntüsü / ayar teyidi. Açık değilse → **hemen aç** (kod değil, panel ayarı). |
| 0.4 | **Cleanup cron'ları çalışıyor mu?** `vitrin_events` / `ai_messages` / `audit_logs` 90g retention cron'u gerçekten tetikleniyor mu (süperadmin KPI'dan teyit). | Çalışmıyorsa append-heavy tablolar en büyüğü olur — Faz 3'e not. |
| 0.5 | **Tenant-scoped sorgu envanteri.** `grep -rn "companyId" src/lib` → 114 site. Faz 4 kapsamı için bir liste çıkar (hangi tablolar tenant-scoped, hangileri global). | Faz 4 için master liste. |

**Test:** Yok (ölçüm fazı). Çıktı: `docs/DEVAM-REHBERI.md`'ye baseline metrikleri yaz.

---

## FAZ 1 — Ucuz & Yüksek-Getiri DB Güvenliği (yarım–1 gün)

> Saatlik iş, gerçek güvenlik. "Şimdi yap" listesinin kalbi.

### 1A — DB CHECK Constraint'leri
**Problem:** Şema yorumları "DB CHECK Sprint 4" diyor ama **CHECK yok**. Invariant yalnız tek Zod yolunda. Süperadmin DB-fix / script / gelecek action bypass eder.

**Migration `0032_data_integrity_checks.sql`:**
```sql
-- Veresiye satışta müşteri zorunlu
ALTER TABLE petstockpro.stock_movements
  ADD CONSTRAINT chk_credit_requires_customer
  CHECK (payment_method <> 'credit' OR customer_ref IS NOT NULL);

-- Stok eksiye düşemez
ALTER TABLE petstockpro.branch_inventory
  ADD CONSTRAINT chk_stock_qty_nonneg CHECK (stock_qty >= 0);

-- Para alanları negatif olamaz
ALTER TABLE petstockpro.product_variants
  ADD CONSTRAINT chk_prices_nonneg CHECK (cost_price >= 0 AND sale_price >= 0);
ALTER TABLE petstockpro.stock_movements
  ADD CONSTRAINT chk_movement_money_nonneg
  CHECK ((unit_cost IS NULL OR unit_cost >= 0) AND (unit_price IS NULL OR unit_price >= 0));
```
> ⚠ Migration öncesi mevcut veride ihlal var mı kontrol et (`SELECT ... WHERE NOT (<check>)`). Varsa önce temizle, sonra constraint ekle.

**Test:**
- `src/lib/stock/movements.test.ts`'e ekle: credit + customerRef NULL → DB insert reddi (integration, gerçek DB).
- branch_inventory stock_qty=-1 manuel INSERT → reddedilir.
- Mevcut 1782 testin yeşil kaldığını doğrula (constraint geçerli veriyi kırmamalı).

### 1B — Ledger Immutability (gerçek, niyet değil)
**Problem:** "Immutable" yalnız helper update/delete export etmediği için. `psql` / süperadmin aracı ledger'ı değiştirebilir.

**Migration `0033_ledger_immutability.sql`:**
```sql
CREATE OR REPLACE FUNCTION petstockpro.block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Bu tablo append-only — UPDATE/DELETE yasak (%, id=%)', TG_TABLE_NAME, OLD.id;
END; $$ LANGUAGE plpgsql;

-- stock_movements: reversedById UPDATE'i hariç tutulmalı! (reversal pointer set ediliyor)
-- Çözüm: reversedById dışındaki sütun değişimini blokla.
CREATE OR REPLACE FUNCTION petstockpro.block_ledger_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'stock_movements append-only — DELETE yasak';
  END IF;
  -- Sadece reversedById set edilebilir (immutable mantığı: orijinal değişmez, pointer eklenir)
  IF NEW.* IS DISTINCT FROM OLD.* THEN
    IF (NEW.reversed_by_id IS DISTINCT FROM OLD.reversed_by_id)
       AND (to_jsonb(NEW) - 'reversed_by_id') = (to_jsonb(OLD) - 'reversed_by_id') THEN
      RETURN NEW; -- sadece reversedById değişti, izin ver
    END IF;
    RAISE EXCEPTION 'stock_movements append-only — yalnız reversed_by_id güncellenebilir';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_ledger BEFORE UPDATE OR DELETE ON petstockpro.stock_movements
  FOR EACH ROW EXECUTE FUNCTION petstockpro.block_ledger_mutation();

CREATE TRIGGER trg_block_audit BEFORE UPDATE OR DELETE ON petstockpro.audit_logs
  FOR EACH ROW EXECUTE FUNCTION petstockpro.block_mutation();
```
> **Kritik:** `reverseStockMovement` orijinal kayda `reversedById` set ediyor (movements.ts:692). Trigger bunu bozmamalı — yukarıdaki fonksiyon o tek sütunu beyaz-listeler. Audit_logs hiç UPDATE almaz → tam blok.

**Test:**
- Integration: reversal akışı (movements.test.ts) hâlâ geçer (reversedById set OK).
- Ledger satırına `quantity` UPDATE denemesi → exception.
- Ledger DELETE → exception. audit_logs UPDATE/DELETE → exception.

### 1C — Connection / Pooler / Prepare Düzeltmesi
**Problem:** `db/client.ts` yorumu "Cloudflare Workers + Hyperdrive" diyor (bayat — deploy artık Vercel). `prepare:true` + transaction-mode pooler = "prepared statement already exists" yük altında. `max:10` × N serverless instance = bağlantı fırtınası.

**Görevler:**
1. Faz 0.2 sonucuna göre: pooler arkasındaysa `prepare:false` + `?pgbouncer=true` (veya Supavisor); direct/session-mode ise `prepare:true` kalır.
2. Serverless için `max`'ı düşür (örn. 1–5; Vercel Fluid Compute instance reuse ile).
3. **Bayat yorumu güncelle** — gerçek deploy (Vercel) + gerçek pooler stratejisini yaz.
4. `package.json`'daki ölü `cf:*` script'lerini ve `wrangler` referanslarını temizle (deploy Vercel).

**Test:**
- Yük smoke: paralel 20 istek (basit script) → "prepared statement" hatası YOK.
- `npm run build` + Vercel preview deploy yeşil.

**Commit sınırı:** Faz 1 sonunda — `feat(db): integrity checks + ledger immutability + connection hardening`. (memory: otomatik commit+push)

---

## FAZ 2 — Frontend State: Doğru Orta Yol (1–1.5 gün) ✅ ONAYLANDI

> Onaylanan karar: **referans verisi cache'le, transactional veriyi server-otoriter + optimistic-onaylı tut.** Zustand çalışma-belleği fikri reddedildi (sessiz stok bozulması riski).

### 2A — Zustand Kaldır
**Problem:** `zustand@5.0.2` `src/` içinde **0 import**. Ölü bağımlılık.

**Görevler:**
1. `npm rm zustand` + lockfile güncelle.
2. `grep -rn "zustand" src/` → 0 teyit (zaten 0).
3. `npm run build` + `typecheck` yeşil.

**Test:** Build + mevcut test suite yeşil (hiçbir şey ona bağlı değil → kırılmaz).

### 2B — Referans Verisi Cache Katmanı
**Kapsam:** kategoriler, markalar (global, neredeyse statik), şubeler, temel ayarlar. Bunlar her navigasyonda yeniden çekilmemeli.

**Görevler:**
1. `src/lib/queries/keys.ts`'e **`referenceKeys`** ekle:
   ```ts
   export const referenceKeys = {
     all: ['reference'] as const,
     categories: () => [...referenceKeys.all, 'categories'] as const,
     brands: () => [...referenceKeys.all, 'brands'] as const,
     branches: () => [...referenceKeys.all, 'branches'] as const,
     settings: () => [...referenceKeys.all, 'settings'] as const,
   };
   ```
2. Read-only veri kaynağı — iki seçenek, **tercih (a)**:
   - **(a)** RSC'de mevcut `listCategories`/`listBrands`/`listBranches` ile çek → `HydrationBoundary` + `dehydrate` ile client'a geçir (ekstra API yok, SSR taze + client cache). Tercih: en az kod, RSC grain'ine uygun.
   - (b) `/api/reference/*` route handler'ları + client `useQuery`. Daha çok kod; sadece pure-client widget ihtiyacı doğarsa.
3. Client hook'lar: `src/lib/queries/use-reference.ts` — `useCategories()`, `useBrands()`, `useBranches()`, `useSettings()`. **Per-query `staleTime: Infinity` (veya 30 dk)** + mutation sonrası manuel `invalidateQueries(referenceKeys.categories())`. Global default (60s) DEĞİŞMEZ.
4. Kategori/marka/şube CRUD server action'larına (süperadmin için global, şube tenant için) başarı sonrası ilgili `referenceKeys` invalidate sinyali ekle (revalidatePath zaten var; client cache için query invalidation).

**Test:**
- `use-reference.test.ts` (unit): hook staleTime Infinity, mutation sonrası invalidate çağrısı.
- Browser smoke: ürün ekleme formunda kategori/marka dropdown'ı **navigasyonlar arası yeniden fetch etmiyor** (Network tab — ikinci girişte istek yok). preview_network ile kanıt.

### 2C — Transactional Optimistic-Onaylı Pattern (referans implementasyon)
**Kapsam:** stok hareketleri, ürün vitrin toggle gibi transactional yazmalar. **Async/fire-and-forget DEĞİL** — optimistic apply + server await + hata'da rollback. (Zaten `list-row-toggle` + `notifications-list`'te var → kanonik hale getir, çoğalt.)

**Görevler:**
1. `docs/`'a kısa "PATTERN" notu: transactional mutation = `useMutation` + `onMutate` (optimistic setQueryData) + `onError` (rollback) + `onSettled` (invalidate). **Asla** store-as-truth, **asla** decoupled write.
2. Bir kanonik örnek seç (öneri: stok hareketi drawer'ı) ve bu deseni net uygula + yorumla — gelecekteki kopya-yapıştır şablonu.
3. Stok hareketi gibi **ledger** yazmalarında optimistic UI gösterilse bile, başarı ancak server `ok:true` dönünce "kesin" sayılır (UI "kaydediliyor…" → "kaydedildi ✓"). Rollback toast (SWAL) hata'da stok sayısını eski haline alır.

**Test:**
- `*.test.ts` (unit): onMutate optimistic flip + onError rollback (mevcut notifications-list pattern'i referans).
- Browser smoke: stok çıkışı → UI anında düşer → server fail (ör. yetersiz stok mock) → **rollback** + hata toast. preview_screenshot kanıt.

### 2D — Kural Dokümantasyonu (drift önleme)
**Görev:** `docs/`'a "State Management Kuralı" tek-sayfa:
- Server state → RSC + Server Actions + TanStack (island).
- Referans verisi → uzun staleTime cache (2B).
- URL state → searchParams.
- Efemerel UI state → useState; Zustand YOK.
- **Yasak:** "login'de her şeyi store'a yükle", async/fire-and-forget transactional yazma, store-as-source-of-truth.

**Commit sınırı:** Faz 2 sonunda — `refactor(state): zustand kaldır + referans cache + optimistic transactional pattern`.

---

## FAZ 3 — Stok Bütünlüğü Reconcile (yarım–1 gün)

> Sistemin çekirdek vaadi "kayıtlı stok = gerçek". Ledger ↔ cache uyumu DB'de garanti değil; bir kez bile bozulursa kimse fark etmez. Ucuz sigorta.

### 3A — Reconcile Sorgusu (on-demand)
**Görev:** `src/lib/stock/reconcile.ts`:
```sql
-- branch_inventory.stockQty == SUM(stock_movements.quantity) per (branch, variant) mı?
SELECT bi.company_id, bi.branch_id, bi.variant_id, bi.stock_qty AS cached,
       COALESCE(SUM(sm.quantity), 0) AS ledger_sum
FROM petstockpro.branch_inventory bi
LEFT JOIN petstockpro.stock_movements sm
  ON sm.branch_id = bi.branch_id AND sm.variant_id = bi.variant_id
GROUP BY bi.company_id, bi.branch_id, bi.variant_id, bi.stock_qty
HAVING bi.stock_qty <> COALESCE(SUM(sm.quantity), 0);
```
> ⚠ Reversal kayıtları ledger toplamına dahil (reversal +/- ile zaten nötrlenir). Doğrula: reversed orijinal + reversal birlikte net 0 etkili olmalı.

**Index gereksinimi:** Migration `0034` — `stock_movements (variant_id, branch_id)` composite index (reconcile sorgusu için; review 1 §6.3 boşluğu).

### 3B — Gece Cron + Alert
**Görev:** `src/lib/cron/reconcile-stock.ts` — Vercel Cron (`vercel.json` / `vercel.ts` crons). Drift bulunursa Telegram **critical** alert + `system_errors`'a kayıt. Süperadmin `/admin/superadmin` KPI'da "Stok tutarlılık: ✓ / ⚠ N sapma" kartı.

### 3C — Denormalize Sayaç Reconcile
**Görev:** Aynı job içinde `products.totalStockQty` == `SUM(branch_inventory.stockQty over variants)` ve `branch_inventory.totalSoldQty` tutarlılığını kontrol et. Sapmada alert + opsiyonel auto-repair (recompute).

**Test:**
- `reconcile.test.ts` (integration): kasıtlı drift yarat (manuel stockQty UPDATE — Faz 1B trigger branch_inventory'yi bloklamıyor, sadece ledger) → reconcile sapmayı bulur.
- Tutarlı durumda → 0 sapma.
- Cron handler unit test (alert tetikleme).

**Commit:** `feat(stock): ledger-cache reconciliation cron + drift alert`.

---

## FAZ 4 — Multi-Tenant İzolasyon Ağı (1.5–2.5 gün) 🔴 BÜYÜK TAŞ

> Denetimin 1 numaralı bulgusu. RLS dekoratif — app owner rolüyle bağlanıp RLS'i bypass ediyor; izolasyon %100 elle `WHERE company_id`. Tek unutulan cümle = sessiz cross-tenant sızıntı. ~114 site varken yap, 300 olunca değil.
>
> **Fazlı:** Önce ucuz ağ (4A — bu hafta), sonra yapısal duvar (4B).

### 4A — Tipli Tenant-Scoped Wrapper + Test Guard (ucuz ağ, önce)
**Görev:**
1. `src/lib/db/tenant.ts` — `tenantDb(companyId)` wrapper veya en az bir konvansiyon: tenant tablosuna atılan her helper `companyId: string` zorunlu parametre alır (zaten büyük ölçüde böyle).
2. **Test guard:** `src/lib/db/tenant-guard.test.ts` — tüm `src/lib/*/manage.ts` + list/get helper'larının imzasında `companyId` olduğunu statik doğrula (AST veya basit grep-test). Yeni eklenen tenant helper companyId almıyorsa test kırmızı.
3. **Lint kuralı (opsiyonel):** tenant tablosuna `.where` olmadan `.select().from(products)` çağrısını yakalayan custom ESLint kuralı (ROI marjinal — test guard yeterli olabilir).

**Test:** Guard testinin kendisi (mevcut helper'lar geçer, sahte companyId'siz helper kırmızı).

### 4B — Gerçek RLS (yapısal duvar)
**Hedef:** Unutulan `WHERE company_id` **sızdırmak yerine 0 satır** döndürsün.

**Görevler:**
1. **Yeni DB rolü** `app_user` (LOGIN, **NOBYPASSRLS**, owner değil) — runtime bu rolle bağlanır. `drizzle-kit migrate` + seed owner rolüyle çalışmaya devam eder (bypass).
2. Tenant tablolarının her birine politika (script'le üret):
   ```sql
   CREATE POLICY tenant_isolation ON petstockpro.products
     USING (company_id = current_setting('app.current_company_id', true)::uuid);
   -- current_setting(..., true) → unset ise NULL → company_id = NULL → 0 satır (fail-closed ✓)
   ```
   Tüm tenant tabloları: products, product_variants, product_images, branch_inventory, stock_movements, branches, suppliers, stocktakes, stocktake_items, vitrin_events, notifications, subscriptions, invoices, audit_logs, storefront_settings, user_permissions, ai_usage, ai_messages, vitrin_reports, vitrin_whatsapp_feedback.
3. **Global/referans tabloları** (cities, districts, brands, categories, catalog_seed_products) → `app_user`'a permissive SELECT politikası (tenant filtresi yok).
4. **Per-request enjeksiyon** — `db/client.ts` veya bir `withTenant(companyId, fn)` helper'ı: her istekte transaction aç, `SELECT set_config('app.current_company_id', $1, true)` (true=tx-local), sorguları çalıştır. **prepare:false gerekir** (Faz 1C ile uyumlu) çünkü pooler transaction mode + set_config.
5. **Impersonation** → süperadmin'in seçtiği companyId `set_config`'e geçer → DB-zorlamalı (cookie-trust değil).
6. **Özel yollar** (cron, webhook, vitrin public read/insert) → bunlar tenant-session'sız çalışır:
   - Cron/webhook → owner rolü (bypass) veya operasyona özel `set_config`.
   - Vitrin public read → `storefrontStatus='approved'` + `vitrinPublished=true` için ayrı anon-okuma politikası.

**Test (en kritik yeni test):**
- `src/lib/db/rls.test.ts` (integration, app_user bağlantısı): 
  - Tenant A session'ı (`set_config A`) → tenant B'nin ürünlerini SELECT → **0 satır** (sızıntı yok).
  - Unset company → tüm tenant tabloları **0 satır** (fail-closed).
  - Owner rolü (migrator) → tüm satırları görür (bypass intact).
  - Global tablolar (cities/brands) → app_user okuyabilir.
  - Vitrin public → sadece approved+published.
- Mevcut 1782 test owner/normal yolla geçmeye devam etmeli (regression).

**Risk/rollback:** En invaziv faz. **Staging'de tam test → sonra prod.** Rollback: politikaları DROP + runtime'ı owner rolüne geri al (tek env değişikliği). Her tablo politikası ayrı migration breakpoint.

**Commit:** 4A ayrı (`test(db): tenant-scope guard`), 4B ayrı (`feat(db): real RLS tenant isolation via SET LOCAL`).

---

## FAZ 5 — Veri Modeli Temizliği (1 gün)

### 5A — `branches.isActive` + `status` → Tek Kaynak
**Problem:** İki alan, "elle sync" — drift bekliyor.
**Görev:** `status` otorite. `isActive`'i ya kaldır ya generated column yap:
```sql
ALTER TABLE petstockpro.branches DROP COLUMN is_active;
-- veya geri-uyum gerekiyorsa:
-- ALTER TABLE ... ALTER COLUMN is_active ... GENERATED ALWAYS AS (status <> 'inactive') STORED;
```
Kodda `isActive` okuyan yerleri `status`'a taşı (`branches/status.ts`, `manage.ts`, UI).
**Test:** branch CRUD + status değişim testleri; `isActive` referansı kalmadığını grep ile doğrula.

### 5B — Yanlış Şema Yorumlarını Düzelt
**Görev:** Faz 1A gerçek CHECK'leri ekledikten sonra, `schema/index.ts`'teki "(DB CHECK Sprint 4)" / "trigger Sprint 4" yorumlarını **gerçekle hizala** (artık var) veya yanıltıcı olanları sil. Var olmayan "background job" yorumlarını (totalStockQty vs.) gerçeğe çevir.
**Test:** Yok (yorum); typecheck yeşil.

### 5C — `companies` Silmeyi İki-Adım / Soft-Delete
**Problem:** Her yerde `onDelete cascade` → yanlış bir `DELETE companies` ödeyen tenant'ı + ledger'ı siler (invoices restrict ama products/movements cascade).
**Görev:** Süperadmin hard-delete'i iki-adım onay + `companies.deletedAt` soft-delete + grace period. Gerçek hard-delete ayrı, audit'li, gecikmeli.
**Test:** Soft-delete akışı (unit + browser smoke); hard-delete iki-adım gate.

**Commit:** `refactor(schema): single branch-state source + honest comments + safe tenant delete`.

---

## FAZ 6 — Bilinçli Ertelenenler (YAPMA — dokümante et)

> Bunları **şimdi inşa etme.** Tetikleyici geldiğinde aç. Erken yapmak CLAUDE.md #1 ihlali.

| Madde | Tetikleyici (ne zaman aç) |
|---|---|
| **Optimistic Concurrency** (version kolon, edit formları) | İlk gerçek "lost update" şikayeti/incident'i. Stok azaltma için ASLA (FOR UPDATE yeter). 95% tek-kullanıcı → muhtemelen hiç. |
| **STAFF/şube authz granülaritesi** (branchId gate) | Çok-kullanıcılı tenant gerçekten staff'ı şubeye kısıtlamak isteyince. |
| **JWT role bayatlaması** (server-side role check / kısa TTL) | Personel yönetimi gerçek özellik olunca. |
| **Partitioning** (vitrin_events / ai_messages / audit_logs, pg_partman) | Tablolar milyonlarca satıra ulaşınca. Önce 90g cron'un çalıştığını teyit (Faz 0.4). |
| **animalTypes/tags jsonb → normalize** (join tablo veya GIN) | Vitrin'de hayvan-türü filtresi özellik olunca. |
| **Local-first sync engine** (Replicache/ElectricSQL/RxDB) | Gerçek offline gereksinimi doğarsa. Zustand+fetch ile elle YAPMA. |

---

## Önerilen Sıra & Süre

| Faz | İçerik | Süre | Bağımlılık |
|---|---|---|---|
| 0 | Ölçüm + PITR + pooler teyidi | 0.5 gün | — |
| 1 | DB CHECK + immutability + connection | 0.5–1 gün | 0.2 (pooler kararı) |
| 2 | Zustand kaldır + referans cache + optimistic pattern | 1–1.5 gün | — (paralel olabilir) |
| 3 | Stok reconcile cron | 0.5–1 gün | 1 (immutability ile uyum) |
| 4A | Tenant-scope test guard | 0.5 gün | — |
| 4B | Gerçek RLS | 1.5–2 gün | 1C (prepare:false), staging |
| 5 | Şema temizliği | 1 gün | 1A (5B için) |
| 6 | Ertele (doküman) | — | — |

**Toplam aktif iş:** ~6–8 gün. **Önce yapılacak 3:** Faz 1 (ucuz güvenlik) + Faz 2 (onaylanan state) + Faz 4A (ucuz tenant ağı). Faz 4B en yüksek değer ama en dikkatli — staging şart.

## Cross-Cutting Test Stratejisi

- **Unit (vitest):** her yeni helper + Zod + reconcile mantığı + optimistic onMutate/onError.
- **Integration (gerçek DB):** CHECK constraint reddi, immutability trigger, RLS cross-tenant 0-satır (en kritik), reconcile drift tespiti.
- **Browser smoke (playwright/preview):** referans cache re-fetch yok, optimistic+rollback toast, branch status, soft-delete.
- **Regression:** her faz sonunda tüm suite (şu an 1782) + typecheck + lint 0 error.
- **Migration güvenliği:** her DDL öncesi ihlal-veri taraması; CONCURRENTLY/owner-bağımlı migration'lar manuel apply (CLAUDE.md pattern), staging → prod.

## Açık Kullanıcı Bloker / Kararlar
- Faz 0.2: pooler mı direct mi? (prepare kararı)
- Faz 0.3: PITR açık mı? (açık değilse hemen aç)
- Faz 4B: ayrı `app_user` DB rolü oluşturma + DATABASE_URL ayrımı (runtime vs migrator) — env değişikliği gerektirir.
