import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendTelegramAlert } from './client';

const origBotToken = process.env.TELEGRAM_BOT_TOKEN;
const origChatId = process.env.TELEGRAM_SUPERADMIN_CHAT_ID;

beforeEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_SUPERADMIN_CHAT_ID;
});

afterEach(() => {
  if (origBotToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = origBotToken;
  if (origChatId === undefined) delete process.env.TELEGRAM_SUPERADMIN_CHAT_ID;
  else process.env.TELEGRAM_SUPERADMIN_CHAT_ID = origChatId;
  vi.restoreAllMocks();
});

describe('sendTelegramAlert', () => {
  it('Config yoksa + dev/test → mock=true + console log', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await sendTelegramAlert({ text: 'Test mesaj', severity: 'info' });
    expect(result.ok).toBe(true);
    expect(result.mock).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[telegram:mock]'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('INFO'));
  });

  it('Config var + API success → ok=true + messageId', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
    process.env.TELEGRAM_SUPERADMIN_CHAT_ID = '123456';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 }),
    );

    const result = await sendTelegramAlert({ text: 'Real test' });
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe(42);
    expect(result.mock).toBeUndefined();
  });

  it('Config var + API 500 → ok=false (sessiz fail)', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
    process.env.TELEGRAM_SUPERADMIN_CHAT_ID = '123456';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendTelegramAlert({ text: 'Real test' });
    expect(result.ok).toBe(false);
  });

  it('Config var + network error → ok=false (sessiz fail, caller iş etkilenmez)', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
    process.env.TELEGRAM_SUPERADMIN_CHAT_ID = '123456';

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network down'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendTelegramAlert({ text: 'Test' });
    expect(result.ok).toBe(false);
  });
});
