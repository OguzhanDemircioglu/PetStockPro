/**
 * Cloudflare Workers AI + Vectorize HTTP client (REST API).
 *
 * Env:
 *   CF_ACCOUNT_ID  - Cloudflare account ID (= R2_ACCOUNT_ID, aynı hesap)
 *   CF_API_TOKEN   - API token with "Workers AI - Read" + "Vectorize - Edit" yetkileri
 *
 * Workers AI:
 *   POST /accounts/{id}/ai/run/{model_id}  — embedding, text-generation, vb.
 *
 * Vectorize v2:
 *   POST /accounts/{id}/vectorize/v2/indexes         — index create
 *   GET  /accounts/{id}/vectorize/v2/indexes/{name}  — index describe
 *   POST /accounts/{id}/vectorize/v2/indexes/{name}/upsert  — bulk upsert (NDJSON)
 *   POST /accounts/{id}/vectorize/v2/indexes/{name}/query   — top-K nearest
 */

const CF_BASE = 'https://api.cloudflare.com/client/v4';

export interface CfEnv {
  accountId: string;
  apiToken: string;
}

export function getCfEnv(): CfEnv {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  if (!accountId) {
    throw new Error('CF_ACCOUNT_ID env değişkeni tanımlı değil — .env\'e ekle');
  }
  if (!apiToken) {
    throw new Error('CF_API_TOKEN env değişkeni tanımlı değil — .env\'e ekle');
  }
  return { accountId, apiToken };
}

interface CfApiResponse<T> {
  result: T;
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
}

interface CfRequestOptions {
  method?: string;
  body?: unknown;
  bodyText?: string;
  contentType?: string;
}

async function cfRequest<T>(path: string, options: CfRequestOptions = {}): Promise<T> {
  const { accountId, apiToken } = getCfEnv();
  const url = `${CF_BASE}/accounts/${accountId}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
  };
  let body: string | undefined;
  if (options.bodyText !== undefined) {
    body = options.bodyText;
    headers['Content-Type'] = options.contentType ?? 'application/x-ndjson';
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method: options.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
  });
  const text = await res.text();
  let json: CfApiResponse<T>;
  try {
    json = JSON.parse(text) as CfApiResponse<T>;
  } catch {
    throw new Error(`CF API ${res.status} ${path} non-JSON response: ${text.slice(0, 200)}`);
  }
  if (!json.success) {
    const errMsg =
      json.errors?.map((e) => `[${e.code}] ${e.message}`).join('; ') || 'unknown error';
    throw new Error(`CF API ${res.status} ${path} failed: ${errMsg}`);
  }
  return json.result;
}

// === Auth verify ===

interface AccountInfo {
  id: string;
  name?: string;
}

/** Token + account ID doğru mu, basit GET ile check. */
export async function verifyCfAuth(): Promise<AccountInfo> {
  const { accountId } = getCfEnv();
  return cfRequest<AccountInfo>(`/`).catch(() => {
    // bazı token'lar accounts/{id} GET yetkisi vermez ama Workers AI çalışır.
    // Fallback: models list (Workers AI read permission yeterli).
    return cfRequest<{ id: string }>(`/ai/models/search?per_page=1`).then(() => ({ id: accountId }));
  });
}

// === Embeddings ===

export const EMBEDDING_MODEL = '@cf/baai/bge-m3';
/** bge-m3 multilingual, 1024 boyutlu. TR text retrieve için iyi destek. */
export const EMBEDDING_DIM = 1024;

interface EmbeddingResult {
  data: number[][];
  shape: [number, number];
  pooling?: string;
}

/**
 * Birden fazla metin → embedding vector. Tek API çağrısı (batch).
 * Workers AI bge-m3 max ~50 metin / istek (resmi limit ~100 ama güvenli).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const result = await cfRequest<EmbeddingResult>(`/ai/run/${EMBEDDING_MODEL}`, {
    body: { text: texts },
  });
  if (!Array.isArray(result.data) || result.data.length !== texts.length) {
    throw new Error(`Embedding count mismatch: expected ${texts.length}, got ${result.data?.length}`);
  }
  return result.data;
}

export async function embedSingle(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}

// === Text generation (LLM) ===

export const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResult {
  response: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export async function chatComplete(
  messages: ChatMessage[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<ChatResult> {
  return cfRequest<ChatResult>(`/ai/run/${TEXT_MODEL}`, {
    body: {
      messages,
      max_tokens: opts?.maxTokens ?? 512,
      temperature: opts?.temperature ?? 0.3,
    },
  });
}

// === Vectorize ===

export interface VectorizeIndexInfo {
  name: string;
  config?: {
    dimensions: number;
    metric: 'cosine' | 'euclidean' | 'dot-product';
  };
  created_on?: string;
  modified_on?: string;
  description?: string;
}

export async function createVectorizeIndex(params: {
  name: string;
  dimensions: number;
  metric: 'cosine' | 'euclidean' | 'dot-product';
  description?: string;
}): Promise<VectorizeIndexInfo> {
  return cfRequest<VectorizeIndexInfo>('/vectorize/v2/indexes', {
    body: {
      name: params.name,
      config: {
        dimensions: params.dimensions,
        metric: params.metric,
      },
      description: params.description ?? '',
    },
  });
}

/** Yoksa null döner (404 swallow), başka hata throw eder. */
export async function getVectorizeIndex(name: string): Promise<VectorizeIndexInfo | null> {
  try {
    return await cfRequest<VectorizeIndexInfo>(
      `/vectorize/v2/indexes/${encodeURIComponent(name)}`,
    );
  } catch (e) {
    const msg = (e as Error).message;
    if (/\b404\b|not.*found|vectorize_not_found|not_exist/i.test(msg)) return null;
    throw e;
  }
}

export interface VectorizeUpsertItem {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorizeUpsertResult {
  mutationId: string;
  count?: number;
}

export async function upsertVectors(
  indexName: string,
  items: VectorizeUpsertItem[],
): Promise<VectorizeUpsertResult> {
  if (items.length === 0) return { mutationId: 'noop', count: 0 };
  const ndjson = items.map((it) => JSON.stringify(it)).join('\n');
  return cfRequest<VectorizeUpsertResult>(
    `/vectorize/v2/indexes/${encodeURIComponent(indexName)}/upsert`,
    {
      bodyText: ndjson,
      contentType: 'application/x-ndjson',
    },
  );
}

export interface VectorizeQueryMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorizeQueryResult {
  matches: VectorizeQueryMatch[];
  count: number;
}

export interface VectorizeDeleteResult {
  mutationId: string;
  count?: number;
}

/**
 * Vectorize'tan id listesindeki vektörleri sil.
 * CF v2 endpoint: snake_case (`delete_by_ids`).
 */
export async function deleteVectors(
  indexName: string,
  ids: string[],
): Promise<VectorizeDeleteResult> {
  if (ids.length === 0) return { mutationId: 'noop', count: 0 };
  return cfRequest<VectorizeDeleteResult>(
    `/vectorize/v2/indexes/${encodeURIComponent(indexName)}/delete_by_ids`,
    {
      body: { ids },
    },
  );
}

export async function queryVectorize(
  indexName: string,
  vector: number[],
  topK: number = 5,
  returnMetadata: 'none' | 'indexed' | 'all' = 'all',
): Promise<VectorizeQueryResult> {
  return cfRequest<VectorizeQueryResult>(
    `/vectorize/v2/indexes/${encodeURIComponent(indexName)}/query`,
    {
      body: {
        vector,
        topK,
        returnMetadata,
      },
    },
  );
}
