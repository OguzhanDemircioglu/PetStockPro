import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  telegramConfigSchema,
  getTelegramSettings,
  saveTelegramConfig,
  setTelegramEnabled,
  sendTelegramTestMessage,
} from './settings';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '00000000-0000-0000-0000-000000000001';
const NOW = new Date('2026-05-17T10:00:00Z');

function makeSelectChain(rows: unknown[]) {
  return vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(rows)),
      })),
    })),
  }));
}

function makeUpdateChain(returnRows: unknown[]) {
  return vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(returnRows)),
      })),
    })),
  }));
}

describe('telegramConfigSchema', () => {
  const valid = {
    botToken: '1234567890:AAEhBP0av28w3JzfH2tNh5Ie6sX9aBcDeFgH',
    chatId: '987654321',
  };

  it('valid config parse eder', () => {
    expect(telegramConfigSchema.safeParse(valid).success).toBe(true);
  });

  it('grup chatId negatif olabilir', () => {
    expect(
      telegramConfigSchema.safeParse({ ...valid, chatId: '-1001234567890' })
        .success,
    ).toBe(true);
  });

  it('chatId boş', () => {
    expect(
      telegramConfigSchema.safeParse({ ...valid, chatId: '' }).success,
    ).toBe(false);
  });

  it('chatId harf içerirse reject', () => {
    expect(
      telegramConfigSchema.safeParse({ ...valid, chatId: 'abc' }).success,
    ).toBe(false);
  });

  it('botToken format yanlış', () => {
    expect(
      telegramConfigSchema.safeParse({ ...valid, botToken: 'invalid-token' })
        .success,
    ).toBe(false);
  });

  it('botToken min<20 reject', () => {
    expect(
      telegramConfigSchema.safeParse({ ...valid, botToken: 'a:b' }).success,
    ).toBe(false);
  });

  it('trim whitespace', () => {
    const parsed = telegramConfigSchema.safeParse({
      botToken: `   ${valid.botToken}   `,
      chatId: '   123456   ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.chatId).toBe('123456');
    }
  });
});

describe('getTelegramSettings', () => {
  it('happy — config döner', async () => {
    const row = {
      botToken: '1234567890:hash',
      chatId: '987654321',
      enabled: true,
      configuredAt: NOW,
    };
    const db = { select: makeSelectChain([row]) } as unknown as DbClient;
    const result = await getTelegramSettings(COMPANY, db);
    expect(result).toEqual(row);
  });

  it('row yok → null', async () => {
    const db = { select: makeSelectChain([]) } as unknown as DbClient;
    const result = await getTelegramSettings(COMPANY, db);
    expect(result).toBeNull();
  });
});

describe('saveTelegramConfig', () => {
  it('happy — config kaydedilir, configuredAt set', async () => {
    const set = vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: COMPANY }])),
      })),
    }));
    const db = { update: vi.fn(() => ({ set })) } as unknown as DbClient;

    const result = await saveTelegramConfig(
      COMPANY,
      {
        botToken: '1234567890:AAEhBP0av28w3JzfH2tNh5Ie6sX9aBcDeFgH',
        chatId: '987654321',
      },
      db,
      NOW,
    );
    expect(result).toEqual({ ok: true, configuredAt: NOW });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramBotToken: '1234567890:AAEhBP0av28w3JzfH2tNh5Ie6sX9aBcDeFgH',
        telegramChatId: '987654321',
        telegramConfiguredAt: NOW,
        updatedAt: NOW,
      }),
    );
  });

  it('invalid input → issues', async () => {
    const db = {} as DbClient;
    const result = await saveTelegramConfig(
      COMPANY,
      { botToken: 'invalid', chatId: 'abc' },
      db,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_input');
      expect(result.issues).toBeDefined();
      expect(result.issues!.length).toBeGreaterThan(0);
    }
  });

  it('company bulunamadı → not_found', async () => {
    const db = {
      update: makeUpdateChain([]),
    } as unknown as DbClient;
    const result = await saveTelegramConfig(
      COMPANY,
      {
        botToken: '1234567890:AAEhBP0av28w3JzfH2tNh5Ie6sX9aBcDeFgH',
        chatId: '987654321',
      },
      db,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('setTelegramEnabled', () => {
  it('aç → config'.concat(' var → ok'), async () => {
    const db = {
      select: makeSelectChain([
        { botToken: 'x:yyyyyyyyyyyyyyyyyyy', chatId: '1', enabled: false, configuredAt: NOW },
      ]),
      update: makeUpdateChain([{ id: COMPANY }]),
    } as unknown as DbClient;
    const result = await setTelegramEnabled(COMPANY, true, db, NOW);
    expect(result).toEqual({ ok: true, enabled: true });
  });

  it('aç → config yok → not_configured', async () => {
    const db = {
      select: makeSelectChain([
        { botToken: null, chatId: null, enabled: false, configuredAt: null },
      ]),
    } as unknown as DbClient;
    const result = await setTelegramEnabled(COMPANY, true, db, NOW);
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('kapat — config olmasa da çalışır', async () => {
    const db = {
      update: makeUpdateChain([{ id: COMPANY }]),
    } as unknown as DbClient;
    const result = await setTelegramEnabled(COMPANY, false, db, NOW);
    expect(result).toEqual({ ok: true, enabled: false });
  });
});

describe('sendTelegramTestMessage', () => {
  const fetchMock = vi.fn();
  const origFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  it('configOverride ile inline test', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    });
    const db = {} as DbClient;
    const result = await sendTelegramTestMessage(COMPANY, db, {
      configOverride: { botToken: 'token', chatId: '123' },
    });
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/bottoken/sendMessage',
      expect.any(Object),
    );
  });

  it('config kaydedilmemiş → NOT_CONFIGURED', async () => {
    const db = {
      select: makeSelectChain([
        { botToken: null, chatId: null, enabled: false, configuredAt: null },
      ]),
    } as unknown as DbClient;
    const result = await sendTelegramTestMessage(COMPANY, db);
    expect(result).toEqual({ ok: false, errorCode: 'NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Telegram API 401 → HTTP_401 + description', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ description: 'Unauthorized' }),
    });
    const db = {} as DbClient;
    const result = await sendTelegramTestMessage(COMPANY, db, {
      configOverride: { botToken: 'token', chatId: '123' },
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('HTTP_401');
    expect(result.description).toBe('Unauthorized');
  });

  it('network error → NETWORK', async () => {
    fetchMock.mockRejectedValue(new Error('connect ETIMEDOUT'));
    const db = {} as DbClient;
    const result = await sendTelegramTestMessage(COMPANY, db, {
      configOverride: { botToken: 'token', chatId: '123' },
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NETWORK');
  });
});
