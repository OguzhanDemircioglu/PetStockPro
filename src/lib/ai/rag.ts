/**
 * RAG (Retrieval-Augmented Generation) için yardımcılar.
 *
 * Akış:
 *   1. Kullanıcı sorusu → embedding (bge-m3)
 *   2. Vectorize top-K query → en alakalı N chunk
 *   3. System prompt + chunk içerikleri + user mesajı → Llama 3.1 8B
 *   4. Cevap + retrieved chunk id listesi + token usage döner
 *
 * Felsefe:
 *   - SADECE USER-MANUAL.md içeriğinden cevap (RAG, hallucination kontrolü)
 *   - Kapsam dışı soru → "info@petstockpro.com'a yazabilirsin" yumuşak red
 *   - TR-strict (system prompt explicit Türkçe instruction)
 *   - Score eşiği: top-1 < 0.4 ise düşük güven → "yeterli kaynak yok" davranışı
 */
import {
  chatComplete,
  embedSingle,
  queryVectorize,
  TEXT_MODEL,
  type ChatMessage,
  type VectorizeQueryMatch,
} from './cf-client';

/** Sorulacak top-K chunk sayısı (cost/quality tradeoff). */
export const DEFAULT_TOP_K = 5;

/** En iyi match score bu eşiğin altındaysa "yeterli kaynak yok" akışı tetiklenir. */
export const LOW_CONFIDENCE_THRESHOLD = 0.40;

/** Output token cap (cevap uzunluğu). */
export const DEFAULT_MAX_OUTPUT_TOKENS = 512;

export interface RetrievedChunk {
  id: string;
  score: number;
  breadcrumb: string;
  title: string;
  section: string;
  content: string;
  sourceStartLine: number;
  sourceEndLine: number;
}

export interface RagResult {
  answer: string;
  retrievedChunks: RetrievedChunk[];
  /** Top-1 score < threshold ise true; LLM yine de "bilmiyorum" demesini bekleriz. */
  lowConfidence: boolean;
  /** CF Workers AI token usage (raw, opsiyonel — model bazen vermez). */
  inputTokens?: number;
  outputTokens?: number;
  modelUsed: string;
}

/** Vectorize match → RetrievedChunk (metadata pluck + tip korunur). */
function toRetrievedChunk(m: VectorizeQueryMatch): RetrievedChunk {
  const md = m.metadata ?? {};
  return {
    id: m.id,
    score: m.score,
    breadcrumb: (md.breadcrumb as string) ?? '?',
    title: (md.title as string) ?? '?',
    section: (md.section as string) ?? '?',
    content: (md.content as string) ?? '',
    sourceStartLine: (md.sourceStartLine as number) ?? 0,
    sourceEndLine: (md.sourceEndLine as number) ?? 0,
  };
}

export async function retrieveChunks(
  indexName: string,
  question: string,
  topK: number = DEFAULT_TOP_K,
): Promise<RetrievedChunk[]> {
  const vec = await embedSingle(question);
  const res = await queryVectorize(indexName, vec, topK, 'all');
  return res.matches.map(toRetrievedChunk);
}

/**
 * System prompt — TR-strict + scope-bounded.
 * Kullanıcı sorusu ile birlikte gelen "Kaynaklar" bölümünden cevap üretir.
 */
export function buildSystemPrompt(chunks: RetrievedChunk[]): string {
  const sources = chunks
    .map((c, idx) => `--- KAYNAK ${idx + 1} (${c.breadcrumb}) ---\n${c.content}`)
    .join('\n\n');

  return `Sen PetStockPro'nun AI Asistanısın. Pet shop sahiplerine PetStockPro uygulamasının nasıl kullanıldığı konusunda yardımcı olursun.

ÖNEMLİ KURALLAR:
1. CEVAP TÜRKÇE olmalı. Hiçbir cümle başka dilde olmasın.
2. SADECE aşağıdaki "Kaynaklar" bölümündeki bilgilerden cevap ver. Asla uydurma yapma.
3. **Halüsinasyon koruma:** Kaynaklarda olmayan bilgi UYDURMA. Kaynaktaki bilgileri kendi cümlelerinle özetleyebilirsin (birebir kopyalama şart değil), ama "override yapılır" gibi kaynakta hiç bahsedilmeyen bir özellik UYDURMA. Şüphedeysen "yeterli bilgi yok" de.
4. Eğer soru "Kaynaklar"daki bilgiyle yeterince örtüşmüyorsa şu cevabı ver: "Bu konuyla ilgili PetStockPro kullanım kılavuzunda yeterli bilgi bulamadım. Detaylı yardım için info@petstockpro.com'a yazabilirsin."
5. **Yetki ve süperadmin:** Eğer soru süperadmin yetkileri, bypass aksiyonları, hard delete, plan override, sayım rollback gibi yönetici özellikleri ile ilgiliyse şu cevabı ver: "Bu konu PetStockPro yöneticisi (sahibi) tarafından kullanılır, normal pet shop kullanıcılarına açık değil. Bir sorunun varsa info@petstockpro.com'a yazabilirsin."
6. Kullanıcının sorusuyla doğrudan ilgili olmayan kaynakları görmezden gel.
7. Cevabını kısa, net ve madde işaretleriyle yaz (gerekirse adım adım).
8. **Navigasyon yönergesi (ÇOK ÖNEMLİ):** Kullanıcıyı bir sayfaya yönlendirirken SADECE sol menü adıyla söyle. URL veya path KESİNLİKLE yazma — / ile başlayan hiçbir şey (örn. /admin/products, /api/x). Kaynaklarda URL geçse bile cevabına KOYMA, atla.

   ✅ DOĞRU: "Sol menüden 🛍 Ürünler'e git, sağ üstte 'Excel'den İçeri Aktar' butonuna tıkla."
   ❌ YANLIŞ: "/admin/products/import sayfasına git" veya "Ürünler sayfasına git (/admin/products)"
9. **Tablo gösterme (ÇOK ÖNEMLİ):** Kaynaklarda Markdown tablo (| ... | ... |) olsa bile CEVABINDA tablo yapma. Tablo içeriğini kısa cümlede özetle. Örnek: "11 sütunlu şablon — name, sku, fiyat, stok vs." yeterli. Kullanıcı butonu tıkladığında zaten şablonu indirecek.
10. Kaynaklardaki Markdown başlık (###) veya kod bloğu (\`\`\`) formatlarını koruyabilirsin (ama tabloları HAYIR).

KAYNAKLAR:
${sources}`;
}

/**
 * Tek soru → RAG yanıtı (retrieve + LLM).
 * indexName Vectorize index adı (env'den okunabilir caller tarafında).
 */
export async function askWithContext(
  indexName: string,
  question: string,
  opts?: { topK?: number; maxOutputTokens?: number; temperature?: number },
): Promise<RagResult> {
  const topK = opts?.topK ?? DEFAULT_TOP_K;
  const chunks = await retrieveChunks(indexName, question, topK);

  const topScore = chunks[0]?.score ?? 0;
  const lowConfidence = chunks.length === 0 || topScore < LOW_CONFIDENCE_THRESHOLD;

  const systemPrompt = buildSystemPrompt(chunks);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ];

  const llmRes = await chatComplete(messages, {
    maxTokens: opts?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    temperature: opts?.temperature ?? 0.2,
  });

  return {
    answer: stripUrlPaths(llmRes.response.trim()),
    retrievedChunks: chunks,
    lowConfidence,
    inputTokens: llmRes.usage?.prompt_tokens,
    outputTokens: llmRes.usage?.completion_tokens,
    modelUsed: TEXT_MODEL,
  };
}

/**
 * AI cevabından URL/path kalıntılarını temizle (system prompt 2. katmanı).
 * LLM bazen kaynaktaki URL'i kopyalar (örn. "/admin/products/import sayfasına git").
 * Bu fonksiyon deterministik temizler — tekrar test edilebilir.
 *
 * Cleaned patterns:
 *   - "/admin/...", "/api/...", "/cron/..." gibi yollar
 *   - Parantez içinde URL: "(/admin/products)" → ""
 *   - URL: prefix'i: "URL: /admin/..." → ""
 *   - Markdown tablolar (| Sütun | Açıklama | ... + separator satırı)
 */
export function stripUrlPaths(text: string): string {
  let out = text;
  // Parantez içinde URL: "(/admin/products)" veya "( /admin/x )"
  out = out.replace(/\s*\(\s*\/[a-z][a-z0-9/_-]*\s*\)/gi, '');
  // "URL: /admin/x" veya "URL: /admin/x sayfasına" → boş
  out = out.replace(/URL\s*:\s*\/[a-z][a-z0-9/_-]*\s*/gi, '');
  // Plain "/admin/x sayfasına git" / "/api/x" formundaki kalıntılar
  out = out.replace(/(?:^|[\s,;:.!?])\/[a-z][a-z0-9/_-]+/gi, (match) => {
    return match[0] === '/' ? '' : match[0];
  });
  // Markdown tabloları kaldır: separator satırı (|---|---|) içeren bloklar
  out = stripMarkdownTables(out);
  // Çift boşluk + leading/trailing whitespace temizle
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
  // 3+ boş satırı 2'ye indir
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

/**
 * Markdown tablo bloklarını silen yardımcı.
 *
 * Markdown table = `| ... |` satır + `|---|---|` separator + diğer `|` satırları.
 * Algoritma:
 *   - Tüm satırları gez
 *   - Her satır için "table satırı mı?" (regex `^\s*\|.*\|\s*$`)
 *   - Ardışık table satırları separator satırı içeriyorsa blok olarak sil
 *   - Tek başına "| ... |" (separator yoksa) bırak (tablo değil, olağan içerik)
 */
function stripMarkdownTables(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);
    if (!isTableRow) {
      out.push(line);
      i++;
      continue;
    }
    // Ardışık table satırlarını topla
    let j = i;
    let hasSeparator = false;
    while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
      // Separator pattern: `|---|---|` veya `|:--|:--:|--:|`
      if (/^\s*\|[\s:|-]+\|\s*$/.test(lines[j]) && lines[j].includes('---')) {
        hasSeparator = true;
      }
      j++;
    }
    if (hasSeparator) {
      // Bütün blok tablo — sil
      i = j;
    } else {
      // Separator yok — olağan içerik, bırak
      while (i < j) {
        out.push(lines[i]);
        i++;
      }
    }
  }
  return out.join('\n');
}
