/**
 * Tenant-scope statik guard — Faz 4A (ucuz tripwire, DB değişikliği yok).
 *
 * Amaç: tenant tablosuna (scoped + child) bir sorgu fiili ile dokunan her
 * exported `src/lib` helper'ının `companyId` görmesini CI'da zorlamak. Yeni
 * eklenen bir tenant helper'ı companyId almıyorsa bu test KIRILIR → unutulan
 * `WHERE company_id` kod review'a kalmadan yakalanır.
 *
 * SINIR (bilinçli): Bu bir AĞ, DUVAR değil. Yalnız "companyId mevcut mu"
 * doğrular — "WHERE'de gerçekten kullanıldı mı" DEĞİL (companyId param alıp
 * filtrede unutmak hâlâ mümkün; o false-negative'i Faz 4B gerçek RLS kapatır:
 * unutulan filtre 0 satır döndürür). Bkz. docs/PLAN-MIMARI-...-STATE.md §FAZ 4.
 *
 * Mekanik: yalnız top-level exported fonksiyon/const'lar AST ile taranır
 * (private helper'lar değil — onlara erişen public yüzey companyId taşır).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { is, Table } from 'drizzle-orm';
import * as schema from '@/db/schema';
import {
  TENANT_SCOPED_TABLE_IDS,
  TENANT_CHILD_TABLE_IDS,
  GLOBAL_TABLE_IDS,
  SYSTEM_IDENTITY_TABLE_IDS,
  TENANT_GUARDED_TABLE_IDS,
} from './tenant';

const LIB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────────────────────────────────────────────
// Bilinçli cross-tenant bölgeler — taramadan muaf (gerekçeli).
// ─────────────────────────────────────────────────────────────────

/**
 * Tümüyle cross-tenant/identity alt-dizinler. Bu helper'lar kasıtla tenant
 * sınırını aşar; ayrı katmanda korunurlar.
 */
const EXCLUDED_DIR_SEGMENTS: Record<string, string> = {
  superadmin: 'Süperadmin kişisel izleme/müdahale paneli — kasıtla cross-tenant (requireSuperadmin gate + Faz 4B owner rolü).',
  vitrin: 'Public vitrin — anon, onaylı tüm tenant\'lar arası okuma/yazma; oturum-scoped değil (storefrontStatus filtreleri korur).',
  auth: 'Kimlik katmanı — users/sessions email/id ile, companyId-scoped liste değil.',
};

/**
 * Tek tek cross-tenant dosyalar (webhook girişleri + cron/reconcile — tüm
 * tenant\'lar üzerinde dönen işler, oturum-scoped değil).
 */
const EXCLUDED_FILES: Record<string, string> = {
  'billing/orchestrator.ts': 'PayTR webhook girişi — subscription\'ı merchant_oid/iyzico ref ile bulur, companyId-first değil.',
  'billing/renewals.ts': 'Cron — tüm tenant abonelik yenileme/dunning taraması.',
  'billing/invoice-reconcile.ts': 'Cron — tüm tenant fatura mutabakatı.',
  'billing/downgrade-reconcile.ts': 'Cron — tüm tenant plan-düşürme mutabakatı.',
  'cleanup/retention.ts': 'Cron — cross-tenant TTL log temizliği (RETENTION_RULES).',
  'stock/reconcile.ts': 'Cron — cross-tenant ledger↔cache drift taraması (Faz 3).',
};

/**
 * İnce taneli istisnalar: `relPath#fnName`. Scoped bir dosyada tek bir
 * fonksiyon bilinçli cross-tenant (veya tenant'a farklı bir anahtarla — userId —
 * scope ediliyor) ise buraya gerekçeyle eklenir.
 */
const ALLOWED_FUNCTIONS: Record<string, string> = {
  // Süperadmin AI KPI — tüm tenant'lar arası agregat (/admin/superadmin kartı).
  'ai/stats.ts#getAiSystemStats':
    'Süperadmin cross-tenant AI istatistiği (aiUsage/aiMessages global agregat).',

  // brands + categories GLOBAL (Migration 0026); CRUD SUPERADMIN-only. products
  // dokunuşu yalnız "kaç ürün bu global markayı/kategoriyi kullanıyor" sayımı —
  // kasıtla cross-tenant (global kullanım sayısı, companyId ile scope edilemez).
  'brands/manage.ts#listBrands':
    'Global marka listesi; products = cross-tenant kullanım sayımı (SUPERADMIN CRUD).',
  'brands/manage.ts#deleteBrand':
    'Global marka silme; products = silmeden önce cross-tenant kullanım kontrolü.',
  'categories/manage.ts#listCategories':
    'Global kategori listesi; products = cross-tenant kullanım sayımı (SUPERADMIN CRUD).',
  'categories/manage.ts#deleteCategory':
    'Global kategori silme; products = silmeden önce cross-tenant kullanım kontrolü.',

  // userPermissions userId-keyed (→ users.companyId, 1:1). Sahiplik call-layer'da
  // doğrulanır: yazma yolu (settings/users/actions.ts) hedef user'ı
  // `WHERE users.companyId = session.companyId` ile teyit eder; okuma helper'ları
  // (hasPermission vb.) oturumun KENDİ userId'siyle çağrılır.
  'users/permissions.ts#getUserPermissions':
    'userId-keyed yetki okuma; oturumun kendi userId\'si (cross-tenant input yok).',
  'users/permissions.ts#hasPermission':
    'userId-keyed yetki gate; oturumun kendi userId\'si.',
  'users/permissions.ts#hasAnyPermission':
    'userId-keyed yetki gate; oturumun kendi userId\'si.',
  'users/permissions.ts#setPermission':
    'userId-keyed yetki yazma; hedef user sahipliği call-layer\'da (companyId) doğrulanır.',
  'users/permissions.ts#setBulkPermissions':
    'userId-keyed yetki yazma; hedef user sahipliği call-layer\'da (companyId) doğrulanır.',
  'users/permissions.ts#applyStaffDefaults':
    'userId-keyed; yeni davet edilen user aynı tenant\'ta oluşturulur (sahiplik içkin).',
  'users/permissions.ts#clearAllPermissions':
    'userId-keyed; test/debug cleanup (prod\'da user-delete cascade kullanılır).',
};

// ─────────────────────────────────────────────────────────────────
// AST analiz — saf fonksiyon (sentinel test edilebilir).
// ─────────────────────────────────────────────────────────────────

export interface ScopeViolation {
  file: string;
  fn: string;
  table: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `from(T)` / `insert(T)` / `update(T)` / `delete(T)` / `*Join(T,` / `${T}` (sql). */
function usesTableInQuery(fnText: string, table: string): boolean {
  const t = escapeRe(table);
  const verb = new RegExp(
    `(?:from|insert|update|delete|[A-Za-z]*[Jj]oin)\\s*\\(\\s*${t}\\b`,
  );
  const sqlInterp = new RegExp(`\\$\\{\\s*${t}[\\s.}]`);
  return verb.test(fnText) || sqlInterp.test(fnText);
}

function hasCompanyId(fnText: string): boolean {
  return /\bcompanyId\b/.test(fnText);
}

interface ExportedUnit {
  name: string;
  text: string;
}

/** Top-level exported fonksiyon + const bildirimleri (text dahil). */
function exportedUnits(sf: ts.SourceFile): ExportedUnit[] {
  const out: ExportedUnit[] = [];
  for (const stmt of sf.statements) {
    const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    if (!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;

    if (ts.isFunctionDeclaration(stmt) && stmt.body && stmt.name) {
      out.push({ name: stmt.name.text, text: stmt.getText(sf) });
    } else if (ts.isVariableStatement(stmt)) {
      // arrow / funcExpr / unstable_cache(async ()=>...) sarmalı — hepsi decl text.
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          out.push({ name: decl.name.text, text: decl.getText(sf) });
        }
      }
    }
  }
  return out;
}

/** Tek kaynak dosyasını analiz et — allowlist/exclusion UYGULAMAZ (saf). */
export function analyzeSource(relPath: string, text: string): ScopeViolation[] {
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: ScopeViolation[] = [];
  for (const unit of exportedUnits(sf)) {
    if (hasCompanyId(unit.text)) continue; // companyId görüyor → OK
    for (const table of TENANT_GUARDED_TABLE_IDS) {
      if (usesTableInQuery(unit.text, table)) {
        violations.push({ file: relPath, fn: unit.name, table });
      }
    }
  }
  return violations;
}

// ─────────────────────────────────────────────────────────────────
// Dosya gezgini
// ─────────────────────────────────────────────────────────────────

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

/** LIB_ROOT'a göre POSIX rel path. */
function toRel(full: string): string {
  return full.slice(LIB_ROOT.length + 1).split(sep).join('/');
}

function isExcludedDir(relPath: string): string | null {
  const segs = relPath.split('/');
  for (const seg of segs.slice(0, -1)) {
    if (EXCLUDED_DIR_SEGMENTS[seg]) return seg;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Testler
// ─────────────────────────────────────────────────────────────────

describe('tenant sınıflandırması (tenant.ts SOT)', () => {
  it('her şema tablosu tam olarak bir kategoriye atanmış (drift yok)', () => {
    const allTableIds = Object.entries(schema)
      .filter(([, v]) => is(v, Table))
      .map(([k]) => k)
      .sort();

    const classified = [
      ...TENANT_SCOPED_TABLE_IDS,
      ...TENANT_CHILD_TABLE_IDS,
      ...GLOBAL_TABLE_IDS,
      ...SYSTEM_IDENTITY_TABLE_IDS,
    ].sort();

    // Çakışma yok (her id tek kategoride)
    expect(new Set(classified).size).toBe(classified.length);
    // Eksiksiz + fazlalık yok (yeni tablo eklenince burası sınıflamaya zorlar)
    expect(classified).toEqual(allTableIds);
  });

  it('guard tetik kümesi = scoped + child', () => {
    expect(TENANT_GUARDED_TABLE_IDS).toEqual([
      ...TENANT_SCOPED_TABLE_IDS,
      ...TENANT_CHILD_TABLE_IDS,
    ]);
  });
});

describe('tenant-scope guard (statik AST taraması)', () => {
  it('tenant tablosuna dokunan her exported helper companyId görür', () => {
    const files = listSourceFiles(LIB_ROOT);
    const violations: ScopeViolation[] = [];

    for (const full of files) {
      const rel = toRel(full);
      if (isExcludedDir(rel)) continue;
      if (EXCLUDED_FILES[rel]) continue;
      const text = readFileSync(full, 'utf8');
      for (const v of analyzeSource(rel, text)) {
        if (ALLOWED_FUNCTIONS[`${v.file}#${v.fn}`]) continue;
        violations.push(v);
      }
    }

    if (violations.length > 0) {
      const lines = violations
        .map((v) => `  ✗ ${v.file} → ${v.fn}() '${v.table}' tablosuna companyId'siz dokunuyor`)
        .join('\n');
      throw new Error(
        `Tenant-scope guard ${violations.length} ihlal buldu:\n${lines}\n\n` +
          `Çözüm: helper'a companyId parametresi ekle + WHERE company_id ile filtrele.\n` +
          `Bilinçli cross-tenant ise tenant-guard.test.ts EXCLUDED_FILES / ALLOWED_FUNCTIONS\n` +
          `listesine gerekçeyle ekle.`,
      );
    }
    expect(violations).toEqual([]);
  });

  it('taranan en az 40 dosya var (gezgin gerçekten çalışıyor)', () => {
    const scanned = listSourceFiles(LIB_ROOT)
      .map(toRel)
      .filter((r) => !isExcludedDir(r) && !EXCLUDED_FILES[r]);
    expect(scanned.length).toBeGreaterThan(40);
  });
});

describe('guard sentinel (guard\'ın kendisini doğrular)', () => {
  it('companyId\'siz tenant sorgusunu YAKALAR', () => {
    const bad = [
      "import { products } from '@/db/schema';",
      'export async function leakAll(db) {',
      '  return db.select().from(products);',
      '}',
    ].join('\n');
    const v = analyzeSource('fake/leak.ts', bad);
    expect(v).toEqual([{ file: 'fake/leak.ts', fn: 'leakAll', table: 'products' }]);
  });

  it('companyId\'li tenant sorgusunu GEÇİRİR', () => {
    const good = [
      "import { products } from '@/db/schema';",
      'export async function listMine(companyId, db) {',
      '  return db.select().from(products).where(eq(products.companyId, companyId));',
      '}',
    ].join('\n');
    expect(analyzeSource('fake/ok.ts', good)).toEqual([]);
  });

  it('global tabloya (categories) companyId\'siz dokunmak SORUN DEĞİL', () => {
    const refData = [
      "import { categories } from '@/db/schema';",
      'export async function allCategories(db) {',
      '  return db.select().from(categories);',
      '}',
    ].join('\n');
    expect(analyzeSource('fake/ref.ts', refData)).toEqual([]);
  });

  it('sql template interpolasyonunu (${stockMovements}) tespit eder', () => {
    const sub = [
      "import { stockMovements } from '@/db/schema';",
      'export const totalIn = (db) =>',
      '  db.execute(sql`SELECT SUM(qty) FROM ${stockMovements}`);',
    ].join('\n');
    const v = analyzeSource('fake/sub.ts', sub);
    expect(v).toEqual([{ file: 'fake/sub.ts', fn: 'totalIn', table: 'stockMovements' }]);
  });
});
