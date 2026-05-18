/**
 * OpenAI Moderation API — async hybrid moderation katmanı.
 *
 * https://platform.openai.com/docs/api-reference/moderations
 *
 * Ücretsiz endpoint, TR/EN/multi-lang destekli. `omni-moderation-latest` modeli
 * 13 kategori (harassment, hate, sexual, violence, self-harm, vb.) flag eder.
 *
 * Stratejisi: **fail-open** — API key yok, timeout veya 500 hata → boş sonuç döner,
 * form action sessizce devam eder. Blacklist sync katmanı zaten yakaladığı için
 * downtime'da kullanıcı engel almaz.
 *
 * Latency: ~150-300ms tipik. Form action içinde sync await ile çağrılır, kullanıcı
 * tarafında "Kaydediliyor..." sırasında çalışır (kabul edilebilir).
 */

export type OpenAICategory =
  | 'harassment'
  | 'harassment/threatening'
  | 'hate'
  | 'hate/threatening'
  | 'sexual'
  | 'sexual/minors'
  | 'violence'
  | 'violence/graphic'
  | 'self-harm'
  | 'self-harm/intent'
  | 'self-harm/instructions'
  | 'illicit'
  | 'illicit/violent';

export interface OpenAIModerationResult {
  /** En az 1 kategori flag oldu mu. */
  flagged: boolean;
  /** Flag olan kategoriler (sadece true olanlar). */
  categories: OpenAICategory[];
  /** Skip nedeni — sadece flagged=false iken doluysa anlam taşır. */
  skipped?: 'no_api_key' | 'timeout' | 'http_error' | 'parse_error' | 'empty_text';
}

const ENDPOINT = 'https://api.openai.com/v1/moderations';
const TIMEOUT_MS = 3000;
const MODEL = 'omni-moderation-latest';

interface ModerationApiResponse {
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
  }>;
}

/**
 * OpenAI Moderation API çağrısı — fail-open.
 *
 * @param text Kullanıcı girişi (max 32K char, daha uzun olursa 32K'ya truncate)
 * @param opts.apiKey OPENAI_API_KEY override (test için)
 * @param opts.fetch fetch impl override (test için)
 */
export async function moderateWithOpenAI(
  text: string,
  opts: {
    apiKey?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<OpenAIModerationResult> {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    return { flagged: false, categories: [], skipped: 'empty_text' };
  }

  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { flagged: false, categories: [], skipped: 'no_api_key' };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: trimmed.slice(0, 32_000),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { flagged: false, categories: [], skipped: 'http_error' };
    }

    let data: ModerationApiResponse;
    try {
      data = await res.json();
    } catch {
      return { flagged: false, categories: [], skipped: 'parse_error' };
    }

    const first = data.results?.[0];
    if (!first) {
      return { flagged: false, categories: [], skipped: 'parse_error' };
    }

    const flagged = first.flagged === true;
    const categoriesObj = first.categories ?? {};
    const categories = Object.entries(categoriesObj)
      .filter(([, v]) => v === true)
      .map(([k]) => k as OpenAICategory);

    return { flagged, categories };
  } catch (err) {
    const isAbort = (err as { name?: string })?.name === 'AbortError';
    return { flagged: false, categories: [], skipped: isAbort ? 'timeout' : 'http_error' };
  } finally {
    clearTimeout(timer);
  }
}
