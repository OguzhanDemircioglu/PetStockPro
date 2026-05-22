/**
 * Smoke test: CF API token + Workers AI embedding çalışıyor mu?
 * Çalıştırma: npx tsx scripts/smoke-cf-auth.ts
 * Faz 2 setup tamamlandıktan sonra silinebilir (geçici teşhis).
 */
import 'dotenv/config';
import { embedSingle, EMBEDDING_DIM, getCfEnv } from '../src/lib/ai/cf-client';

async function main(): Promise<void> {
  const env = getCfEnv();
  console.log('[smoke] CF account ID:', env.accountId);
  console.log('[smoke] CF token length:', env.apiToken.length);
  console.log('[smoke] Testing embedding (bge-m3 multilingual)...');
  const vec = await embedSingle('Vitrin urun nasil cikartilir?');
  console.log(`[smoke] OK — ${vec.length} dim (expected ${EMBEDDING_DIM})`);
  console.log('[smoke] First 5 values:', vec.slice(0, 5));
}

main().catch((e) => {
  console.error('[smoke] FAIL:', (e as Error).message);
  process.exit(1);
});
