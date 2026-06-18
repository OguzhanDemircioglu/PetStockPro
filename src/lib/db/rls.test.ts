/**
 * Faz 4B — RLS cross-tenant izolasyon integration testi.
 *
 * ⚠ STAGING-ONLY: gerçek `app_user` (NOBYPASSRLS) bağlantısı + migration 0035
 *   uygulanmış bir DB gerektirir. Aşağıdaki env'ler set DEĞİLSE tüm blok SKIP
 *   edilir → CI/local (owner bağlantısı) yeşil kalır, sızıntı kanıtı staging'de.
 *
 *   RLS_TEST_DATABASE_URL  → app_user connection string (0035 uygulanmış)
 *   RLS_TEST_COMPANY_A     → seed tenant A companyId (uuid)
 *   RLS_TEST_COMPANY_B     → seed tenant B companyId (uuid, A'dan farklı)
 *
 * Çalıştırma (staging): bkz. docs/PLAN-FAZ-4B-RLS.md §Test.
 *   RLS_TEST_DATABASE_URL=... RLS_TEST_COMPANY_A=... RLS_TEST_COMPANY_B=... \
 *     npx vitest run src/lib/db/rls.test.ts
 */
import { afterAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { products, cities } from '@/db/schema';
import { withTenant } from './with-tenant';

const RLS_URL = process.env.RLS_TEST_DATABASE_URL;
const COMPANY_A = process.env.RLS_TEST_COMPANY_A;
const COMPANY_B = process.env.RLS_TEST_COMPANY_B;

const enabled = Boolean(RLS_URL && COMPANY_A && COMPANY_B);

// app_user bağlantısı — transaction-mode güvenli (prepare:false), tek bağlantı
// (deterministik GUC davranışı için).
const client = enabled
  ? postgres(RLS_URL as string, {
      max: 1,
      prepare: false,
      connection: { search_path: 'petstockpro,public' },
    })
  : null;
const appDb = client ? drizzle(client, { schema }) : null;

afterAll(async () => {
  await client?.end({ timeout: 5 });
});

describe.skipIf(!enabled)('RLS cross-tenant izolasyon (app_user — staging)', () => {
  it('tenant A oturumu, B\'nin ürünlerini açıkça sorgulasa bile 0 satır (sızıntı yok)', async () => {
    const rows = await withTenant(
      COMPANY_A as string,
      (tx) =>
        tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.companyId, COMPANY_B as string)),
      appDb!,
    );
    expect(rows).toHaveLength(0);
  });

  it('tenant B oturumu, A\'nın ürünlerini açıkça sorgulasa bile 0 satır (simetrik)', async () => {
    const rows = await withTenant(
      COMPANY_B as string,
      (tx) =>
        tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.companyId, COMPANY_A as string)),
      appDb!,
    );
    expect(rows).toHaveLength(0);
  });

  it('tenant A oturumu döndürdüğü TÜM ürünler company_id=A (filtre unutulsa bile)', async () => {
    // .where YOK — RLS politikası yine de A'ya kısıtlamalı.
    const rows = await withTenant(
      COMPANY_A as string,
      (tx) =>
        tx
          .select({ companyId: products.companyId })
          .from(products)
          .limit(100),
      appDb!,
    );
    for (const r of rows) {
      expect(r.companyId).toBe(COMPANY_A);
    }
  });

  it('GUC set EDİLMEDEN (withTenant dışı) tenant tablosu 0 satır (fail-closed)', async () => {
    const rows = await appDb!.transaction((tx) =>
      tx.select({ id: products.id }).from(products).limit(5),
    );
    expect(rows).toHaveLength(0);
  });

  it('GUC geçersiz/boş → 0 satır (NULLIF guard, hata değil)', async () => {
    const rows = await appDb!.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.current_company_id', '', true)`);
      return tx.select({ id: products.id }).from(products).limit(5);
    });
    expect(rows).toHaveLength(0);
  });

  it('global tablo (cities) tenant context\'inde okunabilir (permissive read)', async () => {
    const rows = await withTenant(
      COMPANY_A as string,
      (tx) => tx.select({ id: cities.id }).from(cities).limit(1),
      appDb!,
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('withTenant farklı GUC değerleri arasında sızdırmaz (ardışık çağrı izolasyonu)', async () => {
    // A context'i bittikten sonra B context'i A'yı görmemeli (is_local reset).
    const aRows = await withTenant(
      COMPANY_A as string,
      (tx) => tx.select({ companyId: products.companyId }).from(products).limit(20),
      appDb!,
    );
    const bRows = await withTenant(
      COMPANY_B as string,
      (tx) => tx.select({ companyId: products.companyId }).from(products).limit(20),
      appDb!,
    );
    expect(aRows.every((r) => r.companyId === COMPANY_A)).toBe(true);
    expect(bRows.every((r) => r.companyId === COMPANY_B)).toBe(true);
  });
});

// enabled=false iken en az 1 test çalışmalı (vitest "no test" hatasını önle).
describe('RLS test guard', () => {
  it(enabled ? 'staging env set — gerçek RLS testleri aktif' : 'staging env yok — RLS testleri skip (beklenen)', () => {
    expect(typeof enabled).toBe('boolean');
  });
});
