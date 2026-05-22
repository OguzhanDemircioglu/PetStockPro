/**
 * Cloudflare Vectorize index setup (idempotent).
 *
 * Akış:
 *   1. CF_VECTORIZE_INDEX env oku (default 'petstockpro-user-manual')
 *   2. getVectorizeIndex çağır — varsa describe + log + return
 *   3. Yoksa createVectorizeIndex (1024 dim, cosine, bge-m3 multilingual)
 *   4. Sonra kullanıcıya .env'e CF_VECTORIZE_INDEX= ekle uyarısı bas
 *
 * Idempotent: tekrar çalışırsa create atlar, sadece describe yapar.
 *
 * Çalıştırma:
 *   npx tsx scripts/setup-vectorize-index.ts
 */
import 'dotenv/config';
import {
  createVectorizeIndex,
  getVectorizeIndex,
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
} from '../src/lib/ai/cf-client';

const DEFAULT_INDEX_NAME = 'petstockpro-user-manual';

async function main(): Promise<void> {
  const indexName = process.env.CF_VECTORIZE_INDEX || DEFAULT_INDEX_NAME;
  console.log(`[vectorize] Hedef index: "${indexName}"`);
  console.log(`[vectorize] Embedding model: ${EMBEDDING_MODEL} (${EMBEDDING_DIM} dim, cosine)`);

  console.log('[vectorize] Mevcut index kontrol ediliyor...');
  const existing = await getVectorizeIndex(indexName);
  if (existing) {
    console.log('[vectorize] ✓ Index zaten var, oluşturulmayacak:');
    console.log(`  name:        ${existing.name}`);
    console.log(`  dimensions:  ${existing.config?.dimensions}`);
    console.log(`  metric:      ${existing.config?.metric}`);
    console.log(`  created_on:  ${existing.created_on}`);
    if (existing.config?.dimensions !== EMBEDDING_DIM) {
      console.warn(
        `  ⚠ UYARI: index dimensions (${existing.config?.dimensions}) ${EMBEDDING_DIM} ile uyumsuz. ` +
          'Embedding model değişti mi? Index drop + recreate gerekebilir.',
      );
    }
  } else {
    console.log('[vectorize] Index yok, oluşturuluyor...');
    const created = await createVectorizeIndex({
      name: indexName,
      dimensions: EMBEDDING_DIM,
      metric: 'cosine',
      description: 'PetStockPro USER-MANUAL.md RAG chunks (bge-m3 multilingual)',
    });
    console.log('[vectorize] ✓ Index oluşturuldu:');
    console.log(`  name:        ${created.name}`);
    console.log(`  dimensions:  ${created.config?.dimensions}`);
    console.log(`  metric:      ${created.config?.metric}`);
  }

  if (!process.env.CF_VECTORIZE_INDEX) {
    console.log('');
    console.log('[vectorize] NOT: CF_VECTORIZE_INDEX env değişkeni .env\'de yok.');
    console.log(`           Şu satırı .env'e ekle:`);
    console.log(`           CF_VECTORIZE_INDEX=${indexName}`);
  }
  console.log('');
  console.log('[vectorize] Sonraki adım: npx tsx scripts/seed-vectorize.ts');
}

main().catch((e) => {
  console.error('[vectorize] FATAL:', (e as Error).message);
  process.exit(1);
});
