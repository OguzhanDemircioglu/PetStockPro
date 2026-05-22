/**
 * Vectorize index'inden eski §18 (Süperadmin) chunk'larını sil.
 *
 * Süperadmin bilgisi RAG ile pet shop kullanıcılarına sızıyor.
 * Bu script eski seed'deki süperadmin chunk id'lerini silip re-seed öncesi temizler.
 *
 * Akış:
 *   1. Mevcut indeksteki TÜM chunk id'lerini çek değil — yerine sabit "süpheli" id listesi sil
 *      (önceki seed'den bilinen §18 chunk'ları: c-137, c-138, c-139, c-140; emniyetli ekstra IDs).
 *   2. Re-seed sonrası yeni chunk id'leri (185 chunk) eski 189'un üst-kümesi olmaz —
 *      §18 atlandığı için aralık değişti. Bu yüzden eski ID'ler yetim kalır.
 *
 * Pratik karar: TÜM eski indeks içeriğini silmek için query+delete cycle daha temiz olur,
 * ama mevcut state'i biliyoruz. Eski seed §18 chunk'ları: c-137..c-141 (yaklaşık 5 chunk).
 *
 * Re-seed yeni id'leri (c-001..c-185) zaten upsert eder. Sadece §18 yetim id'lerini sileriz.
 *
 * Çalıştırma:
 *   npx tsx scripts/purge-superadmin-vectors.ts
 */
import 'dotenv/config';
import { deleteVectors, queryVectorize, embedSingle } from '../src/lib/ai/cf-client';

const INDEX = process.env.CF_VECTORIZE_INDEX || 'petstockpro-user-manual';

// Süperadmin ile ilgili sorular için top-K query yap, dönen chunk id'leri arasından
// breadcrumb'ı "Süperadmin" içeren ID'leri topla (eski seed'den kalanlar dahil).
async function findSuperadminVectorIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const probes = [
    'Süperadmin bypass aksiyonları nedir?',
    'Hard delete ürün nasıl yapılır?',
    'Plan limit override nasıl?',
    'Stocktake rollback',
    'Toolbox FAB kategori',
    'Süperadmin URL yapısı',
    'Süperadmin operasyonel müdür',
    'Süperadmin felsefe',
  ];
  for (const q of probes) {
    const vec = await embedSingle(q);
    const res = await queryVectorize(INDEX, vec, 10, 'all');
    for (const m of res.matches) {
      const bc = (m.metadata?.breadcrumb as string) ?? '';
      const sec = (m.metadata?.section as string) ?? '';
      // §18 prefix VEYA breadcrumb'ta "Süperadmin (Sahibinden" geçen (§20.15 hariç tut)
      const is18 = sec.startsWith('18.') || /18\.\s*Süperadmin/.test(bc);
      const isSensitive = is18 && !bc.includes('20.15');
      if (isSensitive) {
        ids.add(m.id);
        console.log(`  [HIT] ${m.id}: ${bc}`);
      }
    }
  }
  return ids;
}

async function main(): Promise<void> {
  console.log(`[purge] Index: ${INDEX}`);
  console.log('[purge] Süperadmin chunk id\'leri taranıyor...');
  const ids = await findSuperadminVectorIds();
  if (ids.size === 0) {
    console.log('[purge] ✓ Süperadmin chunk bulunamadı, index temiz.');
    return;
  }
  console.log(`[purge] ${ids.size} chunk silinecek: ${Array.from(ids).join(', ')}`);
  const result = await deleteVectors(INDEX, Array.from(ids));
  console.log(`[purge] ✓ Silindi. mutationId=${result.mutationId}`);
  console.log('[purge] Mutation propagation için 5 sn bekle, sonra re-seed çalıştır.');
}

main().catch((e) => {
  console.error('[purge] FATAL:', (e as Error).message);
  process.exit(1);
});
