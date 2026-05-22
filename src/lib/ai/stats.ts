/**
 * AI Asistanı süperadmin istatistikleri.
 * /admin/superadmin sayfasında mini kart için.
 */
import { and, eq, gte, sql, count, avg } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { aiMessages, aiUsage } from '@/db/schema';

type Db = PostgresJsDatabase<Record<string, unknown>>;

export interface AiSystemStats {
  /** Bugün (UTC) için toplam assistant mesajı. */
  todayMessageCount: number;
  /** Son N gün için toplam assistant mesajı. */
  totalMessagesNDays: number;
  /** Son N gün ortalama response time (ms). */
  avgResponseTimeMs: number;
  /** Son N gün toplam input + output token. */
  totalTokensNDays: number;
  /** Bugün aktif (mesaj göndermiş) kullanıcı sayısı. */
  activeUsersToday: number;
  /** Window (gün). */
  windowDays: number;
}

export async function getAiSystemStats(
  db: Db,
  windowDays: number = 7,
): Promise<AiSystemStats> {
  const today = new Date().toISOString().slice(0, 10);
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Bugün assistant mesaj sayısı
  const [todayRow] = await db
    .select({ c: count() })
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.role, 'assistant'),
        gte(aiMessages.createdAt, new Date(today + 'T00:00:00.000Z')),
      ),
    );

  // Son N gün assistant mesajları + ortalama latency + token toplamı
  const [windowRow] = await db
    .select({
      c: count(),
      avgMs: avg(aiMessages.responseTimeMs),
      inputSum: sql<number>`COALESCE(SUM(${aiMessages.inputTokens}), 0)::int`,
      outputSum: sql<number>`COALESCE(SUM(${aiMessages.outputTokens}), 0)::int`,
    })
    .from(aiMessages)
    .where(
      and(eq(aiMessages.role, 'assistant'), gte(aiMessages.createdAt, windowStart)),
    );

  // Bugün aktif user sayısı (ai_usage.date = today, messageCount > 0)
  const [activeRow] = await db
    .select({ c: count() })
    .from(aiUsage)
    .where(eq(aiUsage.date, today));

  return {
    todayMessageCount: todayRow?.c ?? 0,
    totalMessagesNDays: windowRow?.c ?? 0,
    avgResponseTimeMs: Math.round(Number(windowRow?.avgMs ?? 0)),
    totalTokensNDays:
      Number(windowRow?.inputSum ?? 0) + Number(windowRow?.outputSum ?? 0),
    activeUsersToday: activeRow?.c ?? 0,
    windowDays,
  };
}
