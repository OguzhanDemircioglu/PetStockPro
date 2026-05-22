/**
 * POST /api/ai/chat — PetStockPro AI Asistanı RAG endpoint.
 *
 * Akış:
 *   1. Auth check (next-auth session, companyId zorunlu)
 *   2. Body Zod validate: { question: 1-500 char }
 *   3. CF_VECTORIZE_INDEX env oku (default 'petstockpro-user-manual')
 *   4. retrieveChunks + askWithContext (RAG)
 *   5. ai_messages 2 satır (user + assistant) + ai_usage upsert
 *   6. JSON response { ok, answer, retrievedChunks, lowConfidence, tokens }
 *
 * Faz 5'te eklenecek:
 *   - FREE plan günlük 10 cap (getTodayUsage + reject)
 *   - IP × user dakikada 5 rate limit
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { askWithContext } from '@/lib/ai/rag';
import {
  recordUserMessage,
  recordAssistantMessage,
  incrementDailyUsage,
} from '@/lib/ai/usage';
import {
  checkAiDailyQuota,
  checkAiRateLimit,
  type PlanName,
} from '@/lib/ai/plan-gate';
import { getCompanyById } from '@/lib/cache/request-scoped';

function getIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? '0.0.0.0';
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_INDEX = 'petstockpro-user-manual';

const bodySchema = z.object({
  question: z
    .string()
    .min(2, 'Soru en az 2 karakter olmalı')
    .max(500, 'Soru en fazla 500 karakter olabilir')
    .trim(),
});

export async function POST(req: Request): Promise<Response> {
  // Auth
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Body parse
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: 'invalid_input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { question } = parsed.data;

  // Rate-limit (IP × user dakikada 5)
  const ipHash = hashIp(getIp(req));
  const rate = await checkAiRateLimit(session.user.id, ipHash);
  if (!rate.allowed) {
    return Response.json(
      {
        ok: false,
        error: 'rate_limited',
        retryAfterSeconds: rate.retryAfterSeconds,
        limit: rate.limit,
      },
      { status: 429, headers: { 'retry-after': String(rate.retryAfterSeconds) } },
    );
  }

  // Plan quota (FREE 10/gün cap, PRO+ sınırsız)
  const company = await getCompanyById(session.user.companyId);
  const plan = (company?.plan ?? 'FREE') as PlanName;
  const quota = await checkAiDailyQuota(
    db,
    session.user.companyId,
    session.user.id,
    plan,
  );
  if (!quota.allowed) {
    return Response.json(
      {
        ok: false,
        error: 'daily_quota_exceeded',
        plan,
        used: quota.used,
        limit: quota.limit,
      },
      { status: 429 },
    );
  }

  // RAG
  const indexName = process.env.CF_VECTORIZE_INDEX || DEFAULT_INDEX;
  const start = Date.now();
  let rag;
  try {
    rag = await askWithContext(indexName, question);
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[api/ai/chat] RAG failed:', msg);
    return Response.json(
      { ok: false, error: 'ai_unavailable', detail: msg.slice(0, 200) },
      { status: 503 },
    );
  }
  const responseTimeMs = Date.now() - start;
  const retrievedIds = rag.retrievedChunks.map((c) => c.id);

  // Audit + usage (fire-and-forget — DB hatası user'a hata göstermez)
  try {
    await recordUserMessage(db, {
      companyId: session.user.companyId,
      userId: session.user.id,
      content: question,
      retrievedChunkIds: retrievedIds,
    });
    await recordAssistantMessage(db, {
      companyId: session.user.companyId,
      userId: session.user.id,
      content: rag.answer,
      retrievedChunkIds: retrievedIds,
      inputTokens: rag.inputTokens,
      outputTokens: rag.outputTokens,
      modelUsed: rag.modelUsed,
      responseTimeMs,
    });
    await incrementDailyUsage(db, {
      companyId: session.user.companyId,
      userId: session.user.id,
      inputTokens: rag.inputTokens ?? 0,
      outputTokens: rag.outputTokens ?? 0,
    });
  } catch (e) {
    console.error('[api/ai/chat] Audit/usage persist failed:', (e as Error).message);
    // user'a hata gösterme — cevap üretildi, sadece persist başarısız
  }

  return Response.json({
    ok: true,
    answer: rag.answer,
    retrievedChunks: rag.retrievedChunks.map((c) => ({
      id: c.id,
      breadcrumb: c.breadcrumb,
      score: Number(c.score.toFixed(3)),
    })),
    lowConfidence: rag.lowConfidence,
    inputTokens: rag.inputTokens,
    outputTokens: rag.outputTokens,
    modelUsed: rag.modelUsed,
    responseTimeMs,
    // Quota (UI sayaç güncelleyebilsin)
    quota: {
      plan,
      used: quota.used + 1, // bu mesaj sonrası yeni used
      limit: quota.limit === Infinity ? null : quota.limit,
      remaining: quota.remaining === Infinity ? null : Math.max(0, quota.remaining - 1),
    },
  });
}
