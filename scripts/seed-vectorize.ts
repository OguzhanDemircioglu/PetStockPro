/**
 * USER-MANUAL chunks → Cloudflare Vectorize bulk upsert.
 *
 * Akış:
 *   1. scripts/data/user-manual-chunks.json yükle (Faz 1 chunk script çıktısı)
 *   2. CF Workers AI ile her chunk için embedding üret (batch 50)
 *   3. CF Vectorize'a bulk upsert (NDJSON, batch 100)
 *   4. Sonra örnek query smoke test ("Vitrin'e ürün nasıl çıkarırım?")
 *
 * Idempotent: chunk id'leri stabil (c-001, c-002, ...) → upsert (id varsa overwrite).
 *
 * Maliyet tahmini:
 *   - 182 chunk × ~129 token avg = ~23.500 token embedding
 *   - bge-m3 ~$0.012 per 1M token → ~$0.00028 tek seferlik (cents)
 *
 * Çalıştırma:
 *   npx tsx scripts/seed-vectorize.ts
 *
 * Önkoşul: scripts/setup-vectorize-index.ts bir kez çalıştırılmış olmalı (index var olmalı).
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  embedTexts,
  upsertVectors,
  queryVectorize,
  embedSingle,
  EMBEDDING_DIM,
  type VectorizeUpsertItem,
} from '../src/lib/ai/cf-client';

const CHUNKS_PATH = resolve(process.cwd(), 'scripts/data/user-manual-chunks.json');
const DEFAULT_INDEX_NAME = 'petstockpro-user-manual';
const EMBED_BATCH = 50;
const UPSERT_BATCH = 100;

interface Chunk {
  id: string;
  level: number;
  section: string;
  title: string;
  breadcrumb: string;
  content: string;
  charCount: number;
  tokenEstimate: number;
  sourceStartLine: number;
  sourceEndLine: number;
}

interface ChunksFile {
  totalChunks: number;
  chunks: Chunk[];
}

async function embedAll(chunks: Chunk[]): Promise<Array<{ id: string; vector: number[]; chunk: Chunk }>> {
  const out: Array<{ id: string; vector: number[]; chunk: Chunk }> = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH);
    // bge-m3 retrieval için chunk text'inin başına title/breadcrumb context'i ekle (signal güçlendirir)
    const texts = batch.map((c) => `${c.breadcrumb}\n\n${c.content}`);
    process.stdout.write(`\r[seed] Embedding ${i + 1}-${Math.min(i + EMBED_BATCH, chunks.length)}/${chunks.length}...`);
    const vectors = await embedTexts(texts);
    if (vectors.length !== batch.length) {
      throw new Error(`Embedding batch mismatch: ${vectors.length} vs ${batch.length}`);
    }
    for (let j = 0; j < batch.length; j++) {
      const vec = vectors[j];
      if (vec.length !== EMBEDDING_DIM) {
        throw new Error(`Vector dim mismatch: ${vec.length} vs ${EMBEDDING_DIM}`);
      }
      out.push({ id: batch[j].id, vector: vec, chunk: batch[j] });
    }
  }
  process.stdout.write('\n');
  return out;
}

async function upsertAll(
  indexName: string,
  embedded: Array<{ id: string; vector: number[]; chunk: Chunk }>,
): Promise<void> {
  for (let i = 0; i < embedded.length; i += UPSERT_BATCH) {
    const batch = embedded.slice(i, i + UPSERT_BATCH);
    const items: VectorizeUpsertItem[] = batch.map(({ id, vector, chunk }) => ({
      id,
      values: vector,
      metadata: {
        title: chunk.title,
        section: chunk.section,
        breadcrumb: chunk.breadcrumb,
        level: chunk.level,
        sourceStartLine: chunk.sourceStartLine,
        sourceEndLine: chunk.sourceEndLine,
        tokenEstimate: chunk.tokenEstimate,
        // content da metadata'da — retrieval sonrası LLM prompt'a koyacağız
        content: chunk.content,
      },
    }));
    process.stdout.write(`\r[seed] Upserting ${i + 1}-${Math.min(i + UPSERT_BATCH, embedded.length)}/${embedded.length}...`);
    await upsertVectors(indexName, items);
  }
  process.stdout.write('\n');
}

async function smokeQuery(indexName: string, question: string): Promise<void> {
  console.log('');
  console.log(`[smoke] Query: "${question}"`);
  const qVec = await embedSingle(question);
  const res = await queryVectorize(indexName, qVec, 5);
  console.log(`[smoke] Top ${res.matches.length} match:`);
  res.matches.forEach((m, idx) => {
    const breadcrumb = (m.metadata?.breadcrumb as string) ?? '?';
    console.log(`  ${idx + 1}. [${m.score.toFixed(3)}] ${m.id}: ${breadcrumb}`);
  });
}

async function main(): Promise<void> {
  const indexName = process.env.CF_VECTORIZE_INDEX || DEFAULT_INDEX_NAME;
  console.log(`[seed] Index: ${indexName}`);
  console.log(`[seed] Reading ${CHUNKS_PATH}...`);
  const raw = await readFile(CHUNKS_PATH, 'utf8');
  const data = JSON.parse(raw) as ChunksFile;
  console.log(`[seed] ${data.chunks.length} chunk yüklendi.`);

  console.log('[seed] Embedding (bge-m3 multilingual)...');
  const embedded = await embedAll(data.chunks);
  console.log(`[seed] ✓ ${embedded.length} vektör (${EMBEDDING_DIM} dim) üretildi.`);

  console.log('[seed] Vectorize upsert...');
  await upsertAll(indexName, embedded);
  console.log(`[seed] ✓ ${embedded.length} vektör Vectorize'a yazıldı.`);

  // Smoke query (mutation propagation 1-2 saniye gerekebilir)
  console.log('[seed] Mutation propagation için 3 sn bekle...');
  await new Promise((r) => setTimeout(r, 3000));
  await smokeQuery(indexName, 'Vitrin\'e urun nasil cikaririm?');
  await smokeQuery(indexName, 'Stok 0 olunca ne oluyor?');
  await smokeQuery(indexName, '2FA nasil aktive edilir?');
}

main().catch((e) => {
  console.error('[seed] FATAL:', (e as Error).message);
  process.exit(1);
});
