/**
 * Birleşik moderation API — server action'lar buradan tüketir.
 *
 * `moderateText(text, opts)` döner: blacklist (sync) + OpenAI (async fail-open).
 * Result `flagged` true ise kullanıcıya uyarı banner gösterilir (block etmez).
 *
 * Strateji:
 * 1. Boş/null input → flagged=false (no-op)
 * 2. Blacklist sync — ~1ms, key yok
 * 3. OpenAI async — opts.skipOpenAI=true ise atla (perf-critical path için)
 *    veya OPENAI_API_KEY yoksa skipped='no_api_key'
 * 4. İkisinden herhangi biri flagged → flagged=true
 *
 * Sonuç UI'ya gönderilir:
 *   { flagged, reasons: [{source, category, term?}] }
 */

import { checkBlacklist, type BlacklistCategory } from './blacklist';
import {
  moderateWithOpenAI,
  type OpenAICategory,
  type OpenAIModerationResult,
} from './openai';

export interface ModerationReason {
  source: 'blacklist' | 'openai';
  /** blacklist için BlacklistCategory; openai için OpenAICategory */
  category: BlacklistCategory | OpenAICategory;
  /** blacklist için bulunan kelime; openai için undefined */
  term?: string;
}

export interface ModerationResult {
  flagged: boolean;
  reasons: ModerationReason[];
  /** Field/scope label — UI'da "Ürün adı uygunsuz" gibi mesaj için */
  field?: string;
  /** OpenAI skipped olduysa neden (diagnostic). */
  openaiSkipped?: OpenAIModerationResult['skipped'];
}

export interface ModerateOpts {
  /** UI mesajı için field etiketi ("Ürün adı", "Hakkımızda" vb.) */
  field?: string;
  /** OpenAI çağrısını atla — sync-only mod. Default: false (hybrid). */
  skipOpenAI?: boolean;
  /** Test için injection */
  fetchImpl?: typeof fetch;
}

/**
 * Tek bir metni moderate et — blacklist (sync) + OpenAI (async fail-open).
 */
export async function moderateText(
  text: string | null | undefined,
  opts: ModerateOpts = {},
): Promise<ModerationResult> {
  const reasons: ModerationReason[] = [];

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { flagged: false, reasons, field: opts.field };
  }

  // 1. Blacklist sync (her zaman)
  const bl = checkBlacklist(text);
  for (const m of bl.matches) {
    reasons.push({ source: 'blacklist', category: m.category, term: m.term });
  }

  // 2. OpenAI async (skipOpenAI false ise)
  let openaiSkipped: OpenAIModerationResult['skipped'] | undefined;
  if (!opts.skipOpenAI) {
    const oa = await moderateWithOpenAI(text, { fetchImpl: opts.fetchImpl });
    openaiSkipped = oa.skipped;
    for (const cat of oa.categories) {
      reasons.push({ source: 'openai', category: cat });
    }
  }

  return {
    flagged: reasons.length > 0,
    reasons,
    field: opts.field,
    openaiSkipped,
  };
}

/**
 * Çoklu alan moderate et — paralel çağrı, sonuçları birleştir.
 *
 * Örnek:
 * ```ts
 * const r = await moderateFields({
 *   'Ürün adı': name,
 *   'Açıklama': description,
 * });
 * if (r.flagged) { ...uyarı banner }
 * ```
 */
export async function moderateFields(
  fields: Record<string, string | null | undefined>,
  opts: Omit<ModerateOpts, 'field'> = {},
): Promise<{ flagged: boolean; reasons: ModerationReason[]; fieldsFlagged: string[] }> {
  const entries = Object.entries(fields);
  const results = await Promise.all(
    entries.map(([field, text]) => moderateText(text, { ...opts, field })),
  );
  const reasons: ModerationReason[] = [];
  const fieldsFlagged: string[] = [];
  results.forEach((r, idx) => {
    if (r.flagged) {
      fieldsFlagged.push(entries[idx][0]);
      reasons.push(...r.reasons);
    }
  });
  return { flagged: reasons.length > 0, reasons, fieldsFlagged };
}
