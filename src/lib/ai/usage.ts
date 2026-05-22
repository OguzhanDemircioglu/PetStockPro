/**
 * AI mesaj audit + daily usage counter yardımcıları.
 *
 * Tablolar:
 *   ai_messages — her user/assistant mesajının audit + RAG metadata kaydı
 *   ai_usage    — gün başına 1 satır/user/tenant (UPSERT, messageCount ve token sayaçları)
 *
 * Faz 5 plan gate (FREE 10/gün cap) bu helper'ları okur.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { aiMessages, aiUsage } from '@/db/schema';

type Db = PostgresJsDatabase<Record<string, unknown>>;

export interface RecordedMessageRef {
  id: string;
  createdAt: Date;
}

function toIsoDate(d: Date = new Date()): string {
  // YYYY-MM-DD (UTC) — gün sınırı 00:00 UTC. TR localtime kaymasını kabul ediyoruz (kullanıcı için gün sınırı yaklaşık doğru).
  return d.toISOString().slice(0, 10);
}

export async function recordUserMessage(
  db: Db,
  params: {
    companyId: string;
    userId: string;
    content: string;
    retrievedChunkIds?: string[] | null;
  },
): Promise<RecordedMessageRef> {
  const [row] = await db
    .insert(aiMessages)
    .values({
      companyId: params.companyId,
      userId: params.userId,
      role: 'user',
      content: params.content,
      retrievedChunkIds: params.retrievedChunkIds ?? null,
    })
    .returning({ id: aiMessages.id, createdAt: aiMessages.createdAt });
  return row;
}

export async function recordAssistantMessage(
  db: Db,
  params: {
    companyId: string;
    userId: string;
    content: string;
    retrievedChunkIds: string[];
    inputTokens?: number;
    outputTokens?: number;
    modelUsed: string;
    responseTimeMs: number;
  },
): Promise<RecordedMessageRef> {
  const [row] = await db
    .insert(aiMessages)
    .values({
      companyId: params.companyId,
      userId: params.userId,
      role: 'assistant',
      content: params.content,
      retrievedChunkIds: params.retrievedChunkIds,
      inputTokens: params.inputTokens ?? null,
      outputTokens: params.outputTokens ?? null,
      modelUsed: params.modelUsed,
      responseTimeMs: params.responseTimeMs,
    })
    .returning({ id: aiMessages.id, createdAt: aiMessages.createdAt });
  return row;
}

/**
 * Günlük ai_usage UPSERT. Aynı (companyId, userId, date) için varsa increment, yoksa insert.
 * messageCount default 1 artar (bir tam soru = user + assistant). Token sayaçları opsiyonel.
 */
export async function incrementDailyUsage(
  db: Db,
  params: {
    companyId: string;
    userId: string;
    inputTokens?: number;
    outputTokens?: number;
    date?: Date;
  },
): Promise<void> {
  const today = toIsoDate(params.date);
  const inputTok = params.inputTokens ?? 0;
  const outputTok = params.outputTokens ?? 0;

  await db
    .insert(aiUsage)
    .values({
      companyId: params.companyId,
      userId: params.userId,
      date: today,
      messageCount: 1,
      totalInputTokens: inputTok,
      totalOutputTokens: outputTok,
    })
    .onConflictDoUpdate({
      target: [aiUsage.companyId, aiUsage.userId, aiUsage.date],
      set: {
        messageCount: sql`${aiUsage.messageCount} + 1`,
        totalInputTokens: sql`${aiUsage.totalInputTokens} + ${inputTok}`,
        totalOutputTokens: sql`${aiUsage.totalOutputTokens} + ${outputTok}`,
        updatedAt: sql`now()`,
      },
    });
}

export interface DailyUsage {
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export async function getTodayUsage(
  db: Db,
  companyId: string,
  userId: string,
  date: Date = new Date(),
): Promise<DailyUsage> {
  const today = toIsoDate(date);
  const rows = await db
    .select({
      messageCount: aiUsage.messageCount,
      totalInputTokens: aiUsage.totalInputTokens,
      totalOutputTokens: aiUsage.totalOutputTokens,
    })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.companyId, companyId),
        eq(aiUsage.userId, userId),
        eq(aiUsage.date, today),
      ),
    )
    .limit(1);
  if (rows.length === 0) {
    return { messageCount: 0, totalInputTokens: 0, totalOutputTokens: 0 };
  }
  return rows[0];
}
