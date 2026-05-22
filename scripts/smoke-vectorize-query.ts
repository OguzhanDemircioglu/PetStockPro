/**
 * Smoke test: Vectorize query (seed sonrası retrieval doğru çalışıyor mu?)
 * Çalıştırma: npx tsx scripts/smoke-vectorize-query.ts
 * Seed mutation propagation 30-60 sn alır — bu script başında 60 sn bekler.
 */
import 'dotenv/config';
import { embedSingle, queryVectorize } from '../src/lib/ai/cf-client';

const INDEX = process.env.CF_VECTORIZE_INDEX || 'petstockpro-user-manual';
const WAIT_MS = 60_000;

async function smokeQuery(question: string): Promise<void> {
  const vec = await embedSingle(question);
  const res = await queryVectorize(INDEX, vec, 5);
  console.log(`Q: ${question}`);
  console.log(`  matches: ${res.count}`);
  res.matches.forEach((m, i) => {
    const bc = (m.metadata?.breadcrumb as string) ?? '?';
    console.log(`  ${i + 1}. [${m.score.toFixed(3)}] ${m.id}: ${bc}`);
  });
  console.log('');
}

async function main(): Promise<void> {
  console.log(`[smoke] Index: ${INDEX}`);
  console.log(`[smoke] ${WAIT_MS / 1000}sn mutation propagation bekleniyor...`);
  await new Promise((r) => setTimeout(r, WAIT_MS));
  console.log('[smoke] Query test başlıyor.');
  console.log('');
  await smokeQuery('Vitrin urun nasil cikaririm');
  await smokeQuery('Stok 0 olunca ne oluyor');
  await smokeQuery('2FA nasil aktive edilir');
  await smokeQuery('PRO planina nasil gecerim');
  await smokeQuery('Excel ile toplu urun yukleme');
}

main().catch((e) => {
  console.error('[smoke] FATAL:', (e as Error).message);
  process.exit(1);
});
