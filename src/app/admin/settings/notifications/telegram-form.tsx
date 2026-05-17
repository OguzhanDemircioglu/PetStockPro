'use client';

import { useActionState } from 'react';
import {
  saveTelegramConfigAction,
  sendTestMessageAction,
  type NotificationsFormState,
} from './actions';

export interface TelegramFormProps {
  initialBotToken: string | null;
  initialChatId: string | null;
}

const INIT: NotificationsFormState = {};

export function TelegramForm({
  initialBotToken,
  initialChatId,
}: TelegramFormProps) {
  const [saveState, saveAction, savePending] = useActionState(
    saveTelegramConfigAction,
    INIT,
  );
  const [testState, testAction, testPending] = useActionState(
    sendTestMessageAction,
    INIT,
  );

  // Maskeli görünüm: token kaydedilmişse "•••••• son 6 karakter"
  const maskedToken =
    initialBotToken && initialBotToken.length >= 6
      ? `••••••${initialBotToken.slice(-6)}`
      : '';

  return (
    <div className="flex flex-col gap-6">
      <form action={saveAction} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="botToken"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Bot token *
          </label>
          <input
            id="botToken"
            name="botToken"
            type="text"
            autoComplete="off"
            spellCheck={false}
            defaultValue={initialBotToken ?? ''}
            placeholder={maskedToken || '1234567890:ABCdef...'}
            data-testid="tg-bot-token"
            required
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2.5 font-mono text-xs text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
          <p className="mt-1 text-[10.5px] text-ink-4">
            BotFather&apos;dan alınan token. <code>1234567890:hash</code> formatında.
          </p>
        </div>

        <div>
          <label
            htmlFor="chatId"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Chat ID *
          </label>
          <input
            id="chatId"
            name="chatId"
            type="text"
            autoComplete="off"
            spellCheck={false}
            defaultValue={initialChatId ?? ''}
            placeholder="987654321 veya -1001234567890 (grup)"
            data-testid="tg-chat-id"
            required
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2.5 font-mono text-xs text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
          <p className="mt-1 text-[10.5px] text-ink-4">
            Bireysel: <code>@userinfobot</code>&apos;a /start at, ID&apos;ni öğren. Grup: bot&apos;u
            ekle, <code>/start</code> at, getUpdates ile chat.id&apos;yi gör (grup ID negatif).
          </p>
        </div>

        {saveState.message && (
          <div
            role="alert"
            data-testid="save-alert"
            className={
              saveState.ok
                ? 'rounded-xl border border-arrow-7/30 bg-arrow-soft px-4 py-3 text-sm text-arrow-7'
                : 'rounded-xl border border-danger-7/30 bg-danger-soft px-4 py-3 text-sm text-danger-7'
            }
          >
            <div className="font-bold">{saveState.message}</div>
            {saveState.issues && saveState.issues.length > 0 && (
              <ul className="mt-1 ml-4 list-disc text-[12px]">
                {saveState.issues.map((iss) => (
                  <li key={iss}>{iss}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={savePending}
            data-testid="save-btn"
            className="rounded-xl bg-cat px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60"
          >
            {savePending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>

      <hr className="border-line" />

      <form action={testAction} className="flex flex-col gap-3">
        <p className="text-[12px] text-ink-3">
          Yukarıdaki form alanlarındaki token + chat ID ile test mesajı gönderir
          (kaydedilmemiş olsa bile). Aktif etmeden önce her zaman test et.
        </p>
        {/* Hidden alanlar: testAction inline kullanır eğer form değerleri varsa */}
        <input type="hidden" name="botToken" value={initialBotToken ?? ''} />
        <input type="hidden" name="chatId" value={initialChatId ?? ''} />
        {testState.message && (
          <div
            role="alert"
            data-testid="test-alert"
            className={
              testState.testOk
                ? 'rounded-xl border border-arrow-7/30 bg-arrow-soft px-4 py-3 text-sm text-arrow-7'
                : 'rounded-xl border border-danger-7/30 bg-danger-soft px-4 py-3 text-sm text-danger-7'
            }
          >
            {testState.message}
          </div>
        )}
        <div>
          <button
            type="submit"
            disabled={testPending || !initialBotToken || !initialChatId}
            data-testid="test-btn"
            className="rounded-xl border border-cat bg-paper px-4 py-2 text-[12.5px] font-bold text-cart disabled:opacity-60"
          >
            {testPending ? 'Gönderiliyor…' : '🚀 Test mesajı gönder'}
          </button>
        </div>
      </form>
    </div>
  );
}
