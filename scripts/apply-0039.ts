/**
 * Migration 0039 (function search_path hardening) — Aiven'a doğrudan apply.
 * Tek seferlik, sonra silinebilir. (apply-0028.ts deseni.)
 *
 * Local DATABASE_URL → Aiven (src/lib/db/client.ts: "LOCAL DEV → Aiven").
 * Host + önce/sonra proconfig yazdırır → doğru DB'ye uygulandığı kanıtlanır.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';

const FUNCS = [
  'set_updated_at',
  'audit_logs_immutable',
  'stock_movements_immutable',
  'tr_slug',
];

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  // Hedef host (kimlik bilgisi BASMADAN — sadece hostname)
  let host = '(parse error)';
  try {
    host = new URL(url).hostname;
  } catch {
    /* ignore */
  }
  console.log(`[apply-0039] Target host: ${host}`);

  const sqlPath = resolve(
    process.cwd(),
    'src/db/migrations/0039_function_search_path_hardening.sql',
  );
  const sqlText = await readFile(sqlPath, 'utf8');
  console.log(`[apply-0039] Read ${sqlPath} (${sqlText.length} chars)`);

  const client = postgres(url, { prepare: false });

  const q = async () =>
    client<Array<{ proname: string; proconfig: string[] | null }>>`
      SELECT p.proname, p.proconfig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'petstockpro' AND p.proname = ANY(${FUNCS})
      ORDER BY p.proname
    `;

  const before = await q();
  console.log(
    '[apply-0039] BEFORE:',
    before.map((r) => `${r.proname}=${r.proconfig ?? 'NULL'}`),
  );

  await client.unsafe(sqlText);
  console.log('[apply-0039] ✓ Migration applied');

  const after = await q();
  console.log(
    '[apply-0039] AFTER:',
    after.map((r) => `${r.proname}=${r.proconfig ?? 'NULL'}`),
  );

  await client.end();
})().catch((e) => {
  console.error('[apply-0039] FAIL:', (e as Error).message);
  process.exit(1);
});
