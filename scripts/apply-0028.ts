/**
 * Migration 0028 (First-100 Promo) — Aiven'a doğrudan apply.
 * Tek seferlik, sonra silinebilir.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const sqlPath = resolve(process.cwd(), 'src/db/migrations/0028_first_100_promo.sql');
  const sqlText = await readFile(sqlPath, 'utf8');
  console.log(`[apply-0028] Read ${sqlPath} (${sqlText.length} chars)`);

  const client = postgres(url, { prepare: false });
  await client.unsafe(sqlText);
  console.log('[apply-0028] ✓ Migration applied');

  // Verify
  const cols = await client<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'petstockpro'
      AND table_name = 'companies'
      AND column_name LIKE 'promo_%'
    ORDER BY column_name
  `;
  console.log('[apply-0028] New columns:', cols.map((c) => c.column_name));

  const idxs = await client<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'petstockpro'
      AND tablename = 'companies'
      AND indexname LIKE 'idx_companies_promo%'
    ORDER BY indexname
  `;
  console.log('[apply-0028] New indexes:', idxs.map((i) => i.indexname));

  await client.end();
})().catch((e) => {
  console.error('[apply-0028] FAIL:', (e as Error).message);
  process.exit(1);
});
