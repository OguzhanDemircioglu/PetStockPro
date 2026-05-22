/**
 * AI plan limit + rate-limit kontrolü.
 *
 * FREE plan: günlük 10 mesaj cap (env AI_FREE_DAILY_LIMIT ile override).
 * PRO + PRO_PLUS: sınırsız (Infinity).
 *
 * Rate-limit (anti-spam): user başına dakikada 5 mesaj (env AI_RATE_LIMIT_PER_MINUTE).
 * Faz 5 — PLAN-AI-CHATBOT.md.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getTodayUsage } from './usage';
import { getRateLimitStore } from '@/lib/rate-limit/factory';

type Db = PostgresJsDatabase<Record<string, unknown>>;
export type PlanName = 'FREE' | 'PRO' | 'PRO_PLUS';

export const AI_FREE_DAILY_LIMIT = Number(process.env.AI_FREE_DAILY_LIMIT) || 10;
export const AI_RATE_LIMIT_PER_MINUTE = Number(process.env.AI_RATE_LIMIT_PER_MINUTE) || 5;

/**
 * Plan'a göre günlük mesaj cap'i. PRO + PRO+ → Infinity (cap yok).
 */
export function getEffectiveAiQuota(plan: PlanName): number {
  if (plan === 'FREE') return AI_FREE_DAILY_LIMIT;
  return Infinity;
}

export interface QuotaCheckResult {
  allowed: boolean;
  plan: PlanName;
  /** Bugün şu ana kadar gönderilen mesaj sayısı. */
  used: number;
  /** Plan'ın günlük cap'i (Infinity sınırsız demek). */
  limit: number;
  /** Cap'e kalan kaç mesaj. Sınırsızsa Infinity. */
  remaining: number;
}

export async function checkAiDailyQuota(
  db: Db,
  companyId: string,
  userId: string,
  plan: PlanName,
): Promise<QuotaCheckResult> {
  const limit = getEffectiveAiQuota(plan);
  if (limit === Infinity) {
    return { allowed: true, plan, used: 0, limit, remaining: Infinity };
  }
  const usage = await getTodayUsage(db, companyId, userId);
  const used = usage.messageCount;
  return {
    allowed: used < limit,
    plan,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

export interface RateLimitCheckResult {
  allowed: boolean;
  /** Mevcut sayım (artırma öncesi). */
  currentCount: number;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * IP × user başına dakikada N mesaj rate-limit (anti-spam, anti-abuse).
 * Workers KV (production) veya in-memory (dev) backend kullanır.
 */
export async function checkAiRateLimit(
  userId: string,
  ipHash: string,
): Promise<RateLimitCheckResult> {
  const store = getRateLimitStore();
  const key = `ai:${userId}:${ipHash}`;
  const WINDOW_SECONDS = 60;
  const current = await store.get(key);
  if (current >= AI_RATE_LIMIT_PER_MINUTE) {
    return {
      allowed: false,
      currentCount: current,
      limit: AI_RATE_LIMIT_PER_MINUTE,
      retryAfterSeconds: WINDOW_SECONDS,
    };
  }
  const next = await store.increment(key, WINDOW_SECONDS);
  return {
    allowed: true,
    currentCount: next,
    limit: AI_RATE_LIMIT_PER_MINUTE,
    retryAfterSeconds: WINDOW_SECONDS,
  };
}
