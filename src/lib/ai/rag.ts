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
 *   - Kapsam dışı soru → "destek@petstockpro.com'a yazabilirsin" yumuşak red
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
3. Eğer soru "Kaynaklar"daki bilgiyle yeterince örtüşmüyorsa şu cevabı ver: "Bu konuyla ilgili PetStockPro kullanım kılavuzunda yeterli bilgi bulamadım. Detaylı yardım için destek@petstockpro.com'a yazabilirsin."
4. Kullanıcının sorusuyla doğrudan ilgili olmayan kaynakları görmezden gel.
5. Cevabını kısa, net ve madde işaretleriyle yaz (gerekirse adım adım).
6. Eğer cevabın ek bir adım gerektiriyorsa (örn. "Ayarlar > Firma" sayfasına git), o ekran adını birebir belirt.
7. Kaynaklardaki Markdown başlık (###), kod bloğu (\`\`\`) veya tablo formatlarını koruyabilirsin.

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
    answer: llmRes.response.trim(),
    retrievedChunks: chunks,
    lowConfidence,
    inputTokens: llmRes.usage?.prompt_tokens,
    outputTokens: llmRes.usage?.completion_tokens,
    modelUsed: TEXT_MODEL,
  };
}
