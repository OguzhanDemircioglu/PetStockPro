/**
 * Smoke: migration 0027 (ai_usage + ai_messages) Aiven'da apply edildi mi?
 * Çalıştırma: npx tsx scripts/smoke-migration-0027.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const sql = postgres(url, { prepare: false });

  const tables = await sql<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'petstockpro' AND table_name IN ('ai_usage', 'ai_messages')
    ORDER BY table_name
  `;
  console.log('AI tables found:', tables.map((t) => t.table_name));

  const enums = await sql<Array<{ typname: string }>>`
    SELECT typname FROM pg_type WHERE typname = 'ai_message_role'
  `;
  console.log('AI enums found:', enums.map((e) => e.typname));

  const idxs = await sql<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'petstockpro' AND tablename IN ('ai_usage', 'ai_messages')
    ORDER BY indexname
  `;
  console.log('AI indexes:', idxs.map((i) => i.indexname));

  await sql.end();
}

main().catch((e) => {
  console.error('FAIL:', (e as Error).message);
  process.exit(1);
});
