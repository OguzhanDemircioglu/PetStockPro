'use client';

import { useActionState, useMemo } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
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
  const saveErrorState = useMemo(
    () =>
      saveState && saveState.ok === false && saveState.message
        ? { error: saveState.message, issues: saveState.issues }
        : null,
    [saveState],
  );
  useSwalOnError(saveErrorState);

  const [testState, testAction, testPending] = useActionState(
    sendTestMessageAction,
    INIT,
  );
  const testErrorState = useMemo(
    () =>
      testState && testState.testOk === false && testState.message
        ? { error: testState.message }
        : null,
    [testState],
  );
  useSwalOnError(testErrorState);

  const saveHasError = !!saveErrorState;

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
            className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3"
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
            aria-invalid={saveHasError || undefined}
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2.5 font-mono text-xs text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
          <p className="mt-1 text-[12px] text-ink-4">
            BotFather&apos;dan alınan token. <code>1234567890:hash</code> formatında.
          </p>
        </div>

        <div>
          <label
            htmlFor="chatId"
            className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3"
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
            aria-invalid={saveHasError || undefined}
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2.5 font-mono text-xs text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
          <p className="mt-1 text-[12px] text-ink-4">
            Bireysel: <code>@userinfobot</code>&apos;a /start at, ID&apos;ni öğren. Grup: bot&apos;u
            ekle, <code>/start</code> at, getUpdates ile chat.id&apos;yi gör (grup ID negatif).
          </p>
        </div>

        {saveState.ok && saveState.message && (
          <div
            role="status"
            data-testid="save-alert"
            className="rounded-xl border border-arrow-7/30 bg-arrow-soft px-4 py-3 text-sm text-arrow-7"
          >
            <div className="font-bold">{saveState.message}</div>
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
        <p className="text-[13.5px] text-ink-3">
          Yukarıdaki form alanlarındaki token + chat ID ile test mesajı gönderir
          (kaydedilmemiş olsa bile). Aktif etmeden önce her zaman test et.
        </p>
        {/* Hidden alanlar: testAction inline kullanır eğer form değerleri varsa */}
        <input type="hidden" name="botToken" value={initialBotToken ?? ''} />
        <input type="hidden" name="chatId" value={initialChatId ?? ''} />
        {testState.testOk && testState.message && (
          <div
            role="status"
            data-testid="test-alert"
            className="rounded-xl border border-arrow-7/30 bg-arrow-soft px-4 py-3 text-sm text-arrow-7"
          >
            {testState.message}
          </div>
        )}
        <div>
          <button
            type="submit"
            disabled={testPending || !initialBotToken || !initialChatId}
            data-testid="test-btn"
            className="rounded-xl border border-cat bg-paper px-4 py-2 text-[14px] font-bold text-cart disabled:opacity-60"
          >
            {testPending ? 'Gönderiliyor…' : '🚀 Test mesajı gönder'}
          </button>
        </div>
      </form>
    </div>
  );
}
