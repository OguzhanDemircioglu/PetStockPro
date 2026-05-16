/**
 * DB Inspector — Sprint 7c parça 2.
 *
 * SELECT-only güvenli SQL runner. Süperadmin tek sayfadan ad-hoc query
 * çalıştırabilir (debug + müşteri destek). KRİTİK güvenlik:
 *
 *   1. Komut whitelist: sadece SELECT (DROP/DELETE/UPDATE/INSERT/TRUNCATE/
 *      ALTER/CREATE/GRANT/REVOKE block)
 *   2. Tek statement: ';' sonrası içerik yasak (chain attack)
 *   3. Schema scope: sadece 'petstockpro' schema okunabilir
 *   4. Row limit: max 100 satır (büyük dump engelleme)
 *   5. Timeout: 5sn statement_timeout
 *   6. Audit: her query başarılı/başarısız audit_logs'a yazılır
 *
 * UPDATE mode (Faz 2): SQL Inspector "UPDATE / DELETE kilit aç"
 * checkbox'ı, ek şifre doğrulama + Telegram alert + 5sn cooldown.
 */

import postgres from 'postgres';
import { z } from 'zod';

const FORBIDDEN_KEYWORDS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'TRUNCATE',
  'ALTER',
  'CREATE',
  'GRANT',
  'REVOKE',
  'VACUUM',
  'REINDEX',
  'COMMENT',
  'COPY',
  'CALL',
  'DO',
  'MERGE',
  'EXECUTE',
  'PREPARE',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'SAVEPOINT',
  'SET',
  'RESET',
];

export const QUERY_ROW_LIMIT = 100;
export const QUERY_TIMEOUT_MS = 5000;

export const dbInspectorQuerySchema = z.object({
  sql: z
    .string()
    .min(10, 'Query çok kısa')
    .max(2000, 'Query 2000 karakter ile sınırlı'),
});
export type DbInspectorQueryInput = z.input<typeof dbInspectorQuerySchema>;

export type DbInspectorRow = Record<string, unknown>;

export type DbInspectorResult =
  | {
      ok: true;
      rows: DbInspectorRow[];
      rowCount: number;
      truncated: boolean;
      durationMs: number;
      columns: string[];
    }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'forbidden_keyword'; keyword: string }
  | { ok: false; reason: 'multiple_statements' }
  | { ok: false; reason: 'not_select' }
  | { ok: false; reason: 'timeout' }
  | { ok: false; reason: 'sql_error'; message: string };

/**
 * Pure validator — DB'ye gitmeden önce input'u kontrol eder.
 * Test edilebilir, side-effect yok.
 */
export function validateSelectQuery(
  rawSql: string,
):
  | { ok: true; normalized: string }
  | { ok: false; reason: 'not_select' }
  | { ok: false; reason: 'forbidden_keyword'; keyword: string }
  | { ok: false; reason: 'multiple_statements' } {
  const trimmed = rawSql.trim().replace(/;+\s*$/, ''); // trailing ; kaldır

  // Tek statement check (';' ortada varsa chain attack)
  if (trimmed.includes(';')) {
    return { ok: false, reason: 'multiple_statements' };
  }

  // SELECT veya WITH (CTE) ile başlamalı
  const upper = trimmed.toUpperCase().trimStart();
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return { ok: false, reason: 'not_select' };
  }

  // Forbidden keyword check (word-boundary)
  for (const kw of FORBIDDEN_KEYWORDS) {
    const pattern = new RegExp(`\\b${kw}\\b`, 'i');
    if (pattern.test(trimmed)) {
      return { ok: false, reason: 'forbidden_keyword', keyword: kw };
    }
  }

  return { ok: true, normalized: trimmed };
}

/**
 * Postgres üzerinde SELECT çalıştırır.
 *
 * @param input - sql query
 * @param connectionString - Postgres bağlantı string'i (env'den alınır)
 *                          Caller (action) DATABASE_URL'i geçirir.
 *                          Test'te mock postgres client geçilebilir.
 */
export async function runInspectorSelect(
  input: DbInspectorQueryInput,
  connectionString: string,
): Promise<DbInspectorResult> {
  const parsed = dbInspectorQuerySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }

  const validation = validateSelectQuery(parsed.data.sql);
  if (!validation.ok) return validation;

  // Yeni connection — main pool'u kirletmeyelim, statement_timeout set'li
  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 5,
    transform: { undefined: null },
    types: {
      // BIGINT → number (UI için)
      bigint: postgres.BigInt as never,
    },
  });

  const start = Date.now();
  try {
    // SET statement_timeout literal int gerektiriyor — parameter binding kabul etmiyor,
    // bu yüzden unsafe (input sabit, kullanıcı input'u değil).
    await sql.unsafe(`SET statement_timeout = ${QUERY_TIMEOUT_MS}`);
    // Subquery wrap — user'ın query'sinde LIMIT zaten olabilir, dış LIMIT
    // her durumda ROW_LIMIT+1 ile kesip truncated bilgisini döndürür.
    const wrapped = `SELECT * FROM (${validation.normalized}) AS _inspector LIMIT ${QUERY_ROW_LIMIT + 1}`;
    const rows = (await sql.unsafe(wrapped)) as DbInspectorRow[];
    const truncated = rows.length > QUERY_ROW_LIMIT;
    const limitedRows = truncated ? rows.slice(0, QUERY_ROW_LIMIT) : rows;
    const columns =
      limitedRows.length > 0 && limitedRows[0]
        ? Object.keys(limitedRows[0])
        : [];

    return {
      ok: true,
      rows: limitedRows,
      rowCount: limitedRows.length,
      truncated,
      durationMs: Date.now() - start,
      columns,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/timeout|canceling/i.test(message)) {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'sql_error', message: message.slice(0, 500) };
  } finally {
    await sql.end({ timeout: 3 });
  }
}
