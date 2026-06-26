'use client';

import { useRef, useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PetSpinner } from '@/components/ui/pet-spinner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  retrievedChunks?: Array<{ id: string; breadcrumb: string; score: number }>;
  lowConfidence?: boolean;
  error?: boolean;
}

interface ChatResponse {
  ok: boolean;
  answer?: string;
  retrievedChunks?: Array<{ id: string; breadcrumb: string; score: number }>;
  lowConfidence?: boolean;
  error?: string;
  detail?: string;
  retryAfterSeconds?: number;
  plan?: string;
  used?: number;
  limit?: number;
  quota?: { plan: string; used: number; limit: number | null; remaining: number | null };
}

const SUGGESTED_QUESTIONS = [
  { emoji: '🛍', text: 'Vitrin\'e ürün nasıl çıkarırım?' },
  { emoji: '📦', text: 'Stok 0 olunca ne oluyor?' },
  { emoji: '🛡', text: '2FA TOTP nasıl aktive edilir?' },
  { emoji: '💳', text: 'PRO\'ya nasıl geçerim?' },
  { emoji: '📊', text: 'Excel ile toplu ürün yüklemek istiyorum' },
];

interface ChatInterfaceProps {
  userName: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  initialUsage: number;
  dailyLimit: number | null;
}

export function ChatInterface({ userName, plan: _plan, initialUsage, dailyLimit }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [usedCount, setUsedCount] = useState(initialUsage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const capReached = dailyLimit !== null && usedCount >= dailyLimit;

  const askMutation = useMutation({
    mutationFn: async (question: string): Promise<ChatResponse> => {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const json = (await res.json()) as ChatResponse;
      if (!res.ok || !json.ok) {
        const err = new Error(json.error ?? 'unknown_error') as Error & {
          status?: number;
          retryAfterSeconds?: number;
          limit?: number;
          used?: number;
        };
        err.status = res.status;
        err.retryAfterSeconds = json.retryAfterSeconds;
        err.limit = json.limit;
        err.used = json.used;
        throw err;
      }
      return json;
    },
  });

  function sendQuestion(question: string): void {
    const q = question.trim();
    if (!q || askMutation.isPending || capReached) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: q,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    askMutation.mutate(q, {
      onSuccess: (data) => {
        const asstMsg: Message = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.answer ?? '',
          retrievedChunks: data.retrievedChunks,
          lowConfidence: data.lowConfidence,
        };
        setMessages((prev) => [...prev, asstMsg]);
        if (data.quota && typeof data.quota.used === 'number') {
          setUsedCount(data.quota.used);
        }
      },
      onError: (err) => {
        const errAny = err as Error & {
          status?: number;
          retryAfterSeconds?: number;
          limit?: number;
          used?: number;
        };
        let content: string;
        if (errAny.message === 'daily_quota_exceeded') {
          content = `Günlük limit doldu (${errAny.used}/${errAny.limit}). FREE planında günde ${errAny.limit} soru sorabilirsin. Yarın 00:00 (UTC) sıfırlanacak — ya da PRO'ya geç sınırsız sor.`;
          if (errAny.used !== undefined) setUsedCount(errAny.used);
        } else if (errAny.message === 'rate_limited') {
          content = `Çok hızlı soruyorsun. Lütfen ${errAny.retryAfterSeconds ?? 60} saniye bekleyip tekrar dene.`;
        } else if (errAny.message === 'ai_unavailable') {
          content = 'AI servisine ulaşılamıyor. Lütfen birazdan tekrar dene.';
        } else {
          content = 'Üzgünüm, bir sorun oluştu. Lütfen tekrar dene veya info@petstockpro.com\'a yaz.';
        }
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: 'assistant', content, error: true },
        ]);
        console.error('AI chat error:', err);
      },
    });
  }

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, askMutation.isPending]);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    sendQuestion(input);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion(input);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-2xl border border-line/40 bg-paper/40">
      {capReached && (
        <div
          role="status"
          data-testid="ai-cap-banner"
          className="border-b border-danger/40 bg-danger-soft px-4 py-2 text-[12.5px] font-bold text-danger"
        >
          ⛔ Günlük limit doldu ({usedCount}/{dailyLimit}). Yarın 00:00 (UTC)
          sıfırlanır — ya da PRO&apos;ya geç sınırsız sor.
        </div>
      )}

      {/* Mesaj alanı */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
        data-testid="ai-chat-scroll"
      >
        {messages.length === 0 ? (
          <WelcomeScreen
            userName={userName}
            onSuggest={(q) => sendQuestion(q)}
            disabled={askMutation.isPending || capReached}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {askMutation.isPending && (
              <div className="flex items-center gap-2 self-start rounded-2xl rounded-tl-sm border border-line/30 bg-paper/70 px-3 py-2 text-[12.5px] text-ink-4">
                <PetSpinner size="sm" />
                <span>düşünüyor…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-line/40 bg-paper/60 p-3"
        data-testid="ai-chat-form"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              capReached
                ? 'Günlük limit doldu — yarın tekrar dene veya PRO\'ya geç.'
                : 'PetStockPro hakkında bir soru yaz... (Enter ile gönder, Shift+Enter yeni satır)'
            }
            rows={2}
            maxLength={500}
            disabled={askMutation.isPending || capReached}
            className="flex-1 resize-none rounded-xl border border-line/40 bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-cat/40 disabled:opacity-50"
            data-testid="ai-chat-input"
          />
          <button
            type="submit"
            disabled={askMutation.isPending || capReached || input.trim().length < 2}
            className="rounded-xl bg-cat px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-cat-dark disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="ai-chat-send"
          >
            {askMutation.isPending ? '...' : 'Gönder'}
          </button>
        </div>
        <p className="mt-1.5 text-right text-[10.5px] text-ink-4">
          {input.length}/500
        </p>
      </form>
    </div>
  );
}

function WelcomeScreen({
  userName,
  onSuggest,
  disabled,
}: {
  userName: string;
  onSuggest: (q: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 py-12 text-center">
      <div className="text-6xl">🤖</div>
      <div>
        <h2 className="text-[18px] font-bold text-ink">
          Merhaba {userName}! Ben PetStockPro AI Asistanı.
        </h2>
        <p className="mt-1 text-[13px] text-ink-4">
          PetStockPro hakkında her türlü soruyu sorabilirsin. Cevaplar kullanım kılavuzundan.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink-4">
          Önerilen sorular
        </p>
        {SUGGESTED_QUESTIONS.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => onSuggest(s.text)}
            disabled={disabled}
            className="flex items-center gap-2 rounded-xl border border-line/40 bg-paper px-3 py-2.5 text-left text-[13px] text-ink transition hover:border-cat/50 hover:bg-cat-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid={`ai-suggestion-${s.text.slice(0, 20)}`}
          >
            <span>{s.emoji}</span>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'rounded-tr-sm bg-cat text-white'
            : message.error
              ? 'rounded-tl-sm border border-danger/40 bg-danger-soft text-ink'
              : 'rounded-tl-sm border border-line/30 bg-paper text-ink'
        }`}
      >
        {isUser ? (
          <span>{message.content}</span>
        ) : (
          <>
            <MarkdownLite text={message.content} />
            {message.retrievedChunks && message.retrievedChunks.length > 0 && !message.error && (
              <details className="mt-2 text-[11px] text-ink-4">
                <summary className="cursor-pointer hover:text-ink">
                  📚 {message.retrievedChunks.length} kaynak
                  {message.lowConfidence && (
                    <span className="ml-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      düşük güven
                    </span>
                  )}
                </summary>
                <ul className="mt-1.5 ml-3 list-disc space-y-0.5">
                  {message.retrievedChunks.map((c) => (
                    <li key={c.id}>
                      <span className="font-mono text-[10px]">[{c.score.toFixed(2)}]</span>{' '}
                      {c.breadcrumb}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Mini markdown renderer — paragraf + liste (ul/ol) + **bold** + `code`.
 * react-markdown bağımlılığı eklemekten kaçınmak için minimal implementation.
 */
function MarkdownLite({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n+/).filter((p) => p.trim().length > 0);
  return (
    <div className="flex flex-col gap-2">
      {paragraphs.map((p, idx) => {
        const lines = p.split('\n').map((l) => l.trimEnd());
        const isUnordered = lines.length > 0 && lines.every((l) => /^\s*[-*]\s/.test(l));
        const isOrdered = lines.length > 0 && lines.every((l) => /^\s*\d+\.\s/.test(l));
        if (isUnordered) {
          return (
            <ul key={idx} className="list-disc pl-5 marker:text-ink-4">
              {lines.map((l, j) => (
                <li key={j}>
                  <InlineMarkdown text={l.replace(/^\s*[-*]\s/, '')} />
                </li>
              ))}
            </ul>
          );
        }
        if (isOrdered) {
          return (
            <ol key={idx} className="list-decimal pl-5 marker:text-ink-4">
              {lines.map((l, j) => (
                <li key={j}>
                  <InlineMarkdown text={l.replace(/^\s*\d+\.\s/, '')} />
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={idx}>
            <InlineMarkdown text={p} />
          </p>
        );
      })}
    </div>
  );
}

/**
 * Inline: **bold** + `code` parse, diğer karakter olduğu gibi.
 */
function InlineMarkdown({ text }: { text: string }) {
  // Boş satır → newline preserve
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, lineIdx) => (
        <span key={lineIdx}>
          {parseInlineTokens(line).map((t, idx) =>
            t.kind === 'bold' ? (
              <strong key={idx}>{t.text}</strong>
            ) : t.kind === 'code' ? (
              <code key={idx} className="rounded bg-line/30 px-1 py-0.5 font-mono text-[11.5px]">
                {t.text}
              </code>
            ) : (
              <span key={idx}>{t.text}</span>
            ),
          )}
          {lineIdx < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

interface Token {
  kind: 'text' | 'bold' | 'code';
  text: string;
}

/** Inline **bold** ve `code` parse. Sırayla cursor ilerletir. */
function parseInlineTokens(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let buf = '';
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end > 0) {
        if (buf) {
          tokens.push({ kind: 'text', text: buf });
          buf = '';
        }
        tokens.push({ kind: 'bold', text: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > 0) {
        if (buf) {
          tokens.push({ kind: 'text', text: buf });
          buf = '';
        }
        tokens.push({ kind: 'code', text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  if (buf) tokens.push({ kind: 'text', text: buf });
  return tokens;
}
