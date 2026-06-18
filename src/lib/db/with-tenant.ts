/**
 * Faz 4B — Per-request tenant context (RLS köprüsü). HAZIRLIK.
 *
 * ⚠ Bu helper henüz CANLI request yollarına BAĞLANMADI — yalnız `rls.test.ts`
 *   tarafından egzersiz edilir. Prod runtime davranışı DEĞİŞMEZ. Cutover (gerçek
 *   RLS aktivasyonu) docs/PLAN-FAZ-4B-RLS.md runbook'una göre staging-first yapılır.
 *
 * ─────────────────────────────────────────────────────────────────
 * Neden var
 * ─────────────────────────────────────────────────────────────────
 * 4B'de runtime, `app_user` (NOBYPASSRLS, owner DEĞİL) rolüyle bağlanır. RLS
 * politikaları (migration 0035) her tenant satırını `company_id =
 * current_setting('app.current_company_id')::uuid` ile süzer. Bu GUC her request'te
 * **transaction-local** (is_local=true) set edilmeli — set edilmezse politika 0
 * satır döndürür (fail-closed). `withTenant` bu sözleşmeyi tek noktada kapsüller.
 *
 * Kanonik kullanım (cutover sonrası):
 *   const rows = await withTenant(session.user.companyId, (tx) =>
 *     listSuppliers(session.user.companyId, tx));   // tx = RLS-context'li client
 *
 * Özel yollar (tenant-session YOK) → `withOwner` (RLS bypass):
 *   - auth (login/register/verify/reset) — oturum henüz yok, users/companies'i
 *     companyId olmadan sorgular
 *   - cron / webhook — tüm tenant'lar üzerinde döner
 *   - süperadmin — kasıtla cross-tenant
 *   - global tablo YAZMA (brands/categories CRUD — süperadmin)
 *   - vitrin public read/insert — anon, onaylı tüm tenant'lar
 *   Bunlar guard'ın (tenant-guard.test.ts) muaf tuttuğu bölgelerle birebir örtüşür.
 */
import { sql } from 'drizzle-orm';
import type { DbClient } from './client';

/**
 * Default runtime client'ı LAZY çözer (dynamic import). Böylece bu modül,
 * `client.ts`'i (DATABASE_URL gerektirir) import-time'da çalıştırmaz → testler
 * `db` olmadan import edebilir, prod'da yalnız çağrıda yüklenir.
 */
async function defaultClient(): Promise<DbClient> {
  const mod = await import('./client');
  return mod.db;
}

/** Drizzle transaction handle — `withTenant` callback'ine geçer. */
export type TenantTx = Parameters<Parameters<DbClient['transaction']>[0]>[0];

/**
 * Hem singleton `db` hem transaction `tx` kabul eden helper tipi. Cutover'da
 * tenant helper imzaları `DbClient` → `TenantDb` ile genişletilir (tip-only,
 * runtime'sız) → hem owner (`withOwner`) hem RLS-context (`withTenant`) yolundan
 * çağrılabilir.
 */
export type TenantDb = DbClient | TenantTx;

/**
 * Next.js kontrol-akış throw'u mu? `redirect()` → digest 'NEXT_REDIRECT;...',
 * `notFound()` → 'NEXT_NOT_FOUND'. Bunlar GERÇEK hata değil — framework yönlendirmesi.
 */
function isNextControlFlow(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const digest = (e as { digest?: unknown }).digest;
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')
  );
}

/**
 * Tenant-scoped bir iş bloğunu RLS context'i içinde çalıştırır.
 *
 * Transaction açar, `app.current_company_id` GUC'unu **transaction-local** set
 * eder (3. arg true = is_local; transaction bitince otomatik temizlenir, pooled
 * bağlantı sızdırmaz), sonra `fn(tx)`'i çalıştırır. `fn` boyunca tüm sorgular
 * o tenant'a RLS ile kısıtlıdır.
 *
 * ⚠ REDIRECT-SAFE: Server action'lar gövdenin sonunda `redirect()`/`notFound()`
 * çağırır — bunlar throw eder. Düz bir transaction bu throw'da ROLLBACK eder →
 * yapılan INSERT/UPDATE geri alınır ama kullanıcı "başarılı"ya yönlenir = SESSİZ
 * VERİ KAYBI. Bu yüzden Next kontrol-akış throw'unda transaction COMMIT edilir
 * (gerçek iş zaten bitti) ve hata callback dışında yeniden fırlatılır. Gerçek
 * hatalar normal şekilde ROLLBACK eder.
 *
 * @param companyId  Aktif tenant (geçerli uuid — auth session'dan)
 * @param fn         RLS-context'li tx ile çalışan iş bloğu
 * @param client     Bağlantı (default: app_user runtime `db`; test owner/app_user inject eder)
 */
export async function withTenant<T>(
  companyId: string,
  fn: (tx: TenantTx) => Promise<T>,
  client?: DbClient,
): Promise<T> {
  const c = client ?? (await defaultClient());
  let controlFlow: unknown;
  const result = await c.transaction(async (tx) => {
    // is_local=true → yalnız bu transaction. set_config parametrik (SQL injection yok).
    await tx.execute(
      sql`select set_config('app.current_company_id', ${companyId}, true)`,
    );
    try {
      return await fn(tx);
    } catch (e) {
      if (isNextControlFlow(e)) {
        // COMMIT (throw etme) — sonra dışarıda yeniden fırlat.
        controlFlow = e;
        return undefined as T;
      }
      throw e; // gerçek hata → ROLLBACK
    }
  });
  if (controlFlow !== undefined) throw controlFlow;
  return result;
}

/**
 * Tenant-session'sız (cross-tenant / pre-auth) iş bloğu — RLS bypass.
 *
 * ⚠ 4B cutover'da runtime'ın AYRI bir owner/elevated bağlantısı olacak
 *   (`DATABASE_URL_OWNER`); `withOwner` o bağlantıyı kullanmalı. Şimdilik
 *   (RLS aktif değilken) default `db` ile no-op köprü — sadece çağrı yerlerini
 *   işaretlemeye / kademeli retrofit'e yarar. Bkz. PLAN-FAZ-4B-RLS.md §Bağlantı.
 */
export async function withOwner<T>(
  fn: (client: DbClient) => Promise<T>,
  client?: DbClient,
): Promise<T> {
  const c = client ?? (await defaultClient());
  return fn(c);
}
