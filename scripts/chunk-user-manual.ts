/**
 * USER-MANUAL.md → RAG-ready chunk'lar.
 *
 * Akış:
 *   1. docs/USER-MANUAL.md'yi oku
 *   2. src/lib/ai/chunk.ts ile atomik chunk'lara böl
 *   3. İstatistik bas (toplam/ortalama/min/max token, çok küçük/büyük uyarı)
 *   4. scripts/data/user-manual-chunks.json'a yaz
 *
 * Çıktı Faz 2'deki vectorize seed script'inin girdisidir.
 * Idempotent — her çalışmada üretilen JSON identik olur (USER-MANUAL.md değişmediği sürece,
 * `generatedAt` hariç).
 *
 * Çalıştırma:
 *   npx tsx scripts/chunk-user-manual.ts
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import {
  splitChunks,
  parseHeadersSkippingCodeBlocks,
  MAX_CHUNK_TOKENS,
  TARGET_CHUNK_TOKENS,
  MIN_CHUNK_TOKENS,
  TR_CHARS_PER_TOKEN,
} from '../src/lib/ai/chunk';

const SOURCE_PATH = resolve(process.cwd(), 'docs/USER-MANUAL.md');
const OUTPUT_PATH = resolve(process.cwd(), 'scripts/data/user-manual-chunks.json');

async function main(): Promise<void> {
  console.log(`[chunk] Reading ${SOURCE_PATH}`);
  const raw = await readFile(SOURCE_PATH, 'utf8');
  const lines = raw.split('\n');
  console.log(`[chunk] Source lines: ${lines.length}`);

  const headers = parseHeadersSkippingCodeBlocks(lines);
  console.log(`[chunk] Headers parsed: ${headers.length}`);

  const chunks = splitChunks(lines);

  // Stats
  const totalTokens = chunks.reduce((s, c) => s + c.tokenEstimate, 0);
  const totalChars = chunks.reduce((s, c) => s + c.charCount, 0);
  const tokens = chunks.map((c) => c.tokenEstimate);
  const avgTokens = Math.round(totalTokens / Math.max(1, chunks.length));
  const minTok = chunks.length > 0 ? Math.min(...tokens) : 0;
  const maxTok = chunks.length > 0 ? Math.max(...tokens) : 0;
  const small = chunks.filter((c) => c.tokenEstimate < MIN_CHUNK_TOKENS);
  const large = chunks.filter((c) => c.tokenEstimate > MAX_CHUNK_TOKENS);

  console.log('');
  console.log('[chunk] Result summary');
  console.log(`  total chunks:        ${chunks.length}`);
  console.log(`  total chars:         ${totalChars}`);
  console.log(`  total est. tokens:   ${totalTokens}`);
  console.log(`  avg tokens / chunk:  ${avgTokens}`);
  console.log(`  min tokens:          ${minTok}`);
  console.log(`  max tokens:          ${maxTok}`);
  console.log(`  TARGET / MAX:        ${TARGET_CHUNK_TOKENS} / ${MAX_CHUNK_TOKENS}`);
  if (small.length > 0) {
    console.log(`  NOTE: ${small.length} chunk < ${MIN_CHUNK_TOKENS} token (çok kısa):`);
    small.slice(0, 5).forEach((c) =>
      console.log(`    - ${c.id} L${c.sourceStartLine}-${c.sourceEndLine}: "${c.breadcrumb}" (${c.tokenEstimate} tok)`),
    );
    if (small.length > 5) console.log(`    ... +${small.length - 5} daha`);
  }
  if (large.length > 0) {
    console.log(`  WARN: ${large.length} chunk > ${MAX_CHUNK_TOKENS} token (çok büyük):`);
    large.slice(0, 5).forEach((c) =>
      console.log(`    - ${c.id} L${c.sourceStartLine}-${c.sourceEndLine}: "${c.breadcrumb}" (${c.tokenEstimate} tok)`),
    );
  }

  // Section coverage (her H2'den en az 1 chunk üretildi mi kontrol)
  const sections = new Set(chunks.map((c) => c.section).filter((s) => s.length > 0));
  console.log(`  unique sections covered: ${sections.size}`);

  const output = {
    generatedAt: new Date().toISOString(),
    sourceFile: 'docs/USER-MANUAL.md',
    sourceLineCount: lines.length,
    headerCount: headers.length,
    totalChunks: chunks.length,
    totalTokens,
    config: {
      maxChunkTokens: MAX_CHUNK_TOKENS,
      targetChunkTokens: TARGET_CHUNK_TOKENS,
      minChunkTokens: MIN_CHUNK_TOKENS,
      trCharsPerToken: TR_CHARS_PER_TOKEN,
    },
    chunks,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log('');
  console.log(`[chunk] Wrote ${chunks.length} chunks → ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error('[chunk] FATAL:', e);
  process.exit(1);
});
