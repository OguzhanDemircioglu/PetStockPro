import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getEffectiveAiQuota,
  checkAiDailyQuota,
  checkAiRateLimit,
  AI_FREE_DAILY_LIMIT,
  AI_RATE_LIMIT_PER_MINUTE,
} from './plan-gate';

vi.mock('./usage', () => ({
  getTodayUsage: vi.fn(),
}));

vi.mock('@/lib/rate-limit/factory', () => ({
  getRateLimitStore: vi.fn(),
}));

import { getTodayUsage } from './usage';
import { getRateLimitStore } from '@/lib/rate-limit/factory';

const mockedGetTodayUsage = vi.mocked(getTodayUsage);
const mockedStore = vi.mocked(getRateLimitStore);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('getEffectiveAiQuota', () => {
  it('FREE → AI_FREE_DAILY_LIMIT', () => {
    expect(getEffectiveAiQuota('FREE')).toBe(AI_FREE_DAILY_LIMIT);
  });

  it('PRO → Infinity', () => {
    expect(getEffectiveAiQuota('PRO')).toBe(Infinity);
  });

  it('PRO_PLUS → Infinity', () => {
    expect(getEffectiveAiQuota('PRO_PLUS')).toBe(Infinity);
  });
});

describe('checkAiDailyQuota', () => {
  it("PRO plan → cap'siz, getTodayUsage çağrılmaz", async () => {
    const res = await checkAiDailyQuota({} as never, 'co', 'u', 'PRO');
    expect(res.allowed).toBe(true);
    expect(res.limit).toBe(Infinity);
    expect(res.remaining).toBe(Infinity);
    expect(mockedGetTodayUsage).not.toHaveBeenCalled();
  });

  it('FREE plan + 0 mesaj → allowed, remaining = limit', async () => {
    mockedGetTodayUsage.mockResolvedValueOnce({
      messageCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    });
    const res = await checkAiDailyQuota({} as never, 'co', 'u', 'FREE');
    expect(res.allowed).toBe(true);
    expect(res.used).toBe(0);
    expect(res.limit).toBe(AI_FREE_DAILY_LIMIT);
    expect(res.remaining).toBe(AI_FREE_DAILY_LIMIT);
  });

  it('FREE plan + limit-1 mesaj → allowed (sınıra çok yakın)', async () => {
    mockedGetTodayUsage.mockResolvedValueOnce({
      messageCount: AI_FREE_DAILY_LIMIT - 1,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    });
    const res = await checkAiDailyQuota({} as never, 'co', 'u', 'FREE');
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(1);
  });

  it("FREE plan + limit mesaj → blocked (cap'e ulaşıldı)", async () => {
    mockedGetTodayUsage.mockResolvedValueOnce({
      messageCount: AI_FREE_DAILY_LIMIT,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    });
    const res = await checkAiDailyQuota({} as never, 'co', 'u', 'FREE');
    expect(res.allowed).toBe(false);
    expect(res.used).toBe(AI_FREE_DAILY_LIMIT);
    expect(res.remaining).toBe(0);
  });

  it('FREE plan + limit üstü → remaining 0 (negative değil)', async () => {
    mockedGetTodayUsage.mockResolvedValueOnce({
      messageCount: AI_FREE_DAILY_LIMIT + 50,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    });
    const res = await checkAiDailyQuota({} as never, 'co', 'u', 'FREE');
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
  });
});

describe('checkAiRateLimit', () => {
  function fakeStore(initialCount: number) {
    return {
      get: vi.fn().mockResolvedValue(initialCount),
      increment: vi.fn().mockResolvedValue(initialCount + 1),
      source: 'memory' as const,
    };
  }

  it('limit altında → allowed, increment çağrılır', async () => {
    const store = fakeStore(2);
    mockedStore.mockReturnValueOnce(store);
    const res = await checkAiRateLimit('u-1', 'ip-hash');
    expect(res.allowed).toBe(true);
    expect(res.currentCount).toBe(3);
    expect(store.increment).toHaveBeenCalled();
  });

  it('limit aşıldı → blocked, increment çağrılmaz', async () => {
    const store = fakeStore(AI_RATE_LIMIT_PER_MINUTE);
    mockedStore.mockReturnValueOnce(store);
    const res = await checkAiRateLimit('u-1', 'ip-hash');
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBe(60);
    expect(store.increment).not.toHaveBeenCalled();
  });

  it('key formatı: ai:{userId}:{ipHash}', async () => {
    const store = fakeStore(0);
    mockedStore.mockReturnValueOnce(store);
    await checkAiRateLimit('user-abc', 'iphash-xyz');
    expect(store.get).toHaveBeenCalledWith('ai:user-abc:iphash-xyz');
    expect(store.increment).toHaveBeenCalledWith('ai:user-abc:iphash-xyz', 60);
  });
});
