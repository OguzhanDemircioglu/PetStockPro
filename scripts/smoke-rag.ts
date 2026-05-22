/**
 * RAG smoke: retrieve + LLM uçtan uca.
 * Çalıştırma: npx tsx scripts/smoke-rag.ts
 * Çıktı: 3 örnek soruya Llama 3.1 8B Türkçe cevabı + retrieved chunks + latency.
 */
import 'dotenv/config';
import { askWithContext } from '../src/lib/ai/rag';

const INDEX = process.env.CF_VECTORIZE_INDEX || 'petstockpro-user-manual';

async function ask(q: string): Promise<void> {
  const t0 = Date.now();
  const res = await askWithContext(INDEX, q);
  const ms = Date.now() - t0;
  console.log('━'.repeat(80));
  console.log(`Q: ${q}`);
  console.log(`   (${ms}ms · ${res.inputTokens ?? '?'}/${res.outputTokens ?? '?'} tok · low-conf: ${res.lowConfidence})`);
  console.log('   Sources:');
  res.retrievedChunks.forEach((c, i) =>
    console.log(`     ${i + 1}. [${c.score.toFixed(3)}] ${c.id}: ${c.breadcrumb}`),
  );
  console.log('   Answer:');
  console.log('   ' + res.answer.replace(/\n/g, '\n   '));
  console.log('');
}

async function main(): Promise<void> {
  console.log(`[smoke-rag] Index: ${INDEX}\n`);
  await ask('Vitrin\'e ürün nasıl çıkarırım?');
  await ask('Stok 0 olunca ne oluyor?');
  await ask('2FA TOTP nasıl aktive edilir?');
  await ask('İstanbul\'daki en iyi restoran neresi?'); // kapsam dışı kontrol
}

main().catch((e) => {
  console.error('[smoke-rag] FATAL:', (e as Error).message);
  process.exit(1);
});
