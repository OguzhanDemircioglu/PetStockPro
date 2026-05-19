/**
 * Drizzle Kit migration history baseline initializer (ONE-TIME).
 *
 * Sorun:
 *   Önceki migrations (0000-0017) Supabase production'a manuel apply edilmiş,
 *   `drizzle.__drizzle_migrations` history tablosu yok. Bu yüzden `db:migrate`
 *   çalışmaz — Drizzle Kit "henüz hiçbir migration apply edilmedi" varsayar
 *   ve hepsini yeniden uygulamaya çalışır → "table already exists" hatası.
 *
 * Çözüm (bu script):
 *   1. `drizzle` schema + `__drizzle_migrations` tablosunu oluştur
 *   2. Journal'daki her entry için SQL dosyasını oku + Drizzle Kit'in iç
 *      SHA256 hash algoritması ile hash hesapla (statement-breakpoint dahil)
 *   3. Bu hash'leri `__drizzle_migrations`'a "applied" olarak insert et
 *   4. Sonraki `npm run db:migrate` sadece YENİ migration'ları uygular (0018+)
 *
 * Bu script idempotent: tekrar çalıştırılırsa zaten var olan hash'leri atlar.
 * Production'da SADECE BİR KEZ çalıştırılır (baseline init için).
 *
 * Çalıştırma:
 *   npx tsx scripts/baseline-drizzle-migrations.ts
 *
 * Drizzle Kit'in hash algoritması (postgres-js/migrator.ts):
 *   hash = sha256(sql_file_content).hex()
 */

import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';

const MIGRATIONS_DIR = resolve(process.cwd(), 'src/db/migrations');
const JOURNAL_PATH = resolve(MIGRATIONS_DIR, 'meta/_journal.json');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env');
}

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface JournalFile {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

async function main(): Promise<void> {
  console.log('[baseline] Reading journal...');
  const journal = JSON.parse(await readFile(JOURNAL_PATH, 'utf8')) as JournalFile;
  console.log(`[baseline] ${journal.entries.length} entries in journal`);

  // Son entry HARİÇ — son entry henüz apply edilmemiş (db:migrate uygulayacak)
  // Bu sayede yeni eklenen migration'lar normal db:migrate disipliniyle apply edilir.
  const baselineEntries = journal.entries.slice(0, -1);
  const skippedLast = journal.entries.at(-1);
  console.log(
    `[baseline] Baseline: ${baselineEntries.length} entries (last entry "${skippedLast?.tag}" excluded — db:migrate will apply it)`,
  );

  // Hash'leri hesapla
  const records: Array<{ idx: number; tag: string; hash: string; when: number }> = [];
  for (const entry of baselineEntries) {
    const sqlPath = resolve(MIGRATIONS_DIR, `${entry.tag}.sql`);
    let content: string;
    try {
      content = await readFile(sqlPath, 'utf8');
    } catch {
      console.log(`[baseline] ⚠ SQL file not found: ${entry.tag}.sql (skip)`);
      continue;
    }
    const hash = createHash('sha256').update(content).digest('hex');
    records.push({ idx: entry.idx, tag: entry.tag, hash, when: entry.when });
  }

  console.log(`[baseline] ${records.length} migrations to baseline:`);
  for (const r of records) {
    console.log(`  idx=${String(r.idx).padStart(2, '0')} ${r.tag.padEnd(45)} ${r.hash.slice(0, 16)}...`);
  }

  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  // Schema + table
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS drizzle;`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    );
  `);
  console.log('[baseline] ✓ drizzle.__drizzle_migrations table ready');

  // Mevcut hash'leri al (idempotency check)
  const existing = await sql<Array<{ hash: string }>>`
    SELECT hash FROM drizzle.__drizzle_migrations
  `;
  const existingSet = new Set(existing.map((e) => e.hash));
  console.log(`[baseline] ${existingSet.size} hashes already in DB`);

  // Yeni hash'leri insert et
  let inserted = 0;
  let skipped = 0;
  for (const r of records) {
    if (existingSet.has(r.hash)) {
      skipped++;
      continue;
    }
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${r.hash}, ${r.when})
    `;
    inserted++;
  }

  console.log(`[baseline] ✓ Inserted ${inserted} new, skipped ${skipped} existing`);

  // Final state
  const final = await sql<Array<{ id: number; hash: string; created_at: string }>>`
    SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id
  `;
  console.log(`[baseline] Final history: ${final.length} entries`);

  await sql.end();
  console.log('[baseline] Done. Next: `npm run db:migrate` will apply only 0018+ migrations.');
}

main().catch((e) => {
  console.error('[baseline] FATAL:', e);
  process.exit(1);
});
