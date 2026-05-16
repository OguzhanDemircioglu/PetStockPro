'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * WhatsApp Geri Bildirim Balonu — Sprint 12 ext (EKRAN-PUBLIC-VITRIN §15).
 *
 * Davranış:
 *   - Trigger: WhatsApp linkine tıklandı (window.event 'pp:whatsapp-clicked')
 *   - 5 sn delay sonra sağ alt sticky balon (mobile full-width bottom)
 *   - 5 emoji radio — tek tıklama submit + 1.5sn teşekkür + 500ms fade-out
 *   - × manual close → status='closed_manually'
 *   - beforeunload sendBeacon → status='dismissed' (counter felsefesi)
 *   - localStorage dedup: 1 tenant × 24h (frontend), backend de check eder
 */

interface FeedbackBalloonProps {
  companyId: string;
  companySlug: string;
}

type RatingValue =
  | 'very_good'
  | 'good'
  | 'neutral'
  | 'bad'
  | 'unreached';

const RATING_OPTIONS: Array<{ value: RatingValue; emoji: string; label: string }> = [
  { value: 'very_good', emoji: '😊', label: 'Çok iyi' },
  { value: 'good', emoji: '🙂', label: 'İyi' },
  { value: 'neutral', emoji: '😐', label: 'Orta' },
  { value: 'bad', emoji: '😕', label: 'Kötü' },
  { value: 'unreached', emoji: '😞', label: 'Hiç ulaşamadım' },
];

const DELAY_MS = 5000;
const STORAGE_KEY = 'pp_fb_dismissed_v1';

function isDismissedLocally(companyId: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, number>;
    const ts = map[companyId];
    if (!ts) return false;
    // 24 saat
    return Date.now() - ts < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissedLocally(companyId: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[companyId] = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage erişimi yok — sessiz
  }
}

export function FeedbackBalloon({
  companyId,
  companySlug,
}: FeedbackBalloonProps) {
  const [phase, setPhase] = useState<'idle' | 'open' | 'thanks' | 'closing'>(
    'idle',
  );
  const [submitting, setSubmitting] = useState(false);

  // WhatsApp tıklamasını dinle
  useEffect(() => {
    if (isDismissedLocally(companyId)) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setPhase((p) => (p === 'idle' ? 'open' : p));
      }, DELAY_MS);
    };

    window.addEventListener('pp:whatsapp-clicked', handler);
    return () => {
      window.removeEventListener('pp:whatsapp-clicked', handler);
      if (timer) clearTimeout(timer);
    };
  }, [companyId]);

  // beforeunload → dismissed sendBeacon
  useEffect(() => {
    const dismissHandler = () => {
      if (phase !== 'open') return;
      const payload = JSON.stringify({
        companyId,
        status: 'dismissed',
      });
      try {
        navigator.sendBeacon(
          '/api/vitrin/feedback',
          new Blob([payload], { type: 'application/json' }),
        );
      } catch {
        // Ignore — best-effort
      }
    };
    window.addEventListener('beforeunload', dismissHandler);
    return () => window.removeEventListener('beforeunload', dismissHandler);
  }, [companyId, phase]);

  const submit = useCallback(
    async (status: 'submitted' | 'closed_manually', rating?: RatingValue) => {
      if (submitting) return;
      setSubmitting(true);
      const body: Record<string, unknown> = { companyId, status };
      if (rating) body.rating = rating;
      try {
        await fetch('/api/vitrin/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch {
        // Sessiz — balon yine kapanır
      }
      markDismissedLocally(companyId);
      if (status === 'submitted') {
        setPhase('thanks');
        setTimeout(() => setPhase('closing'), 1500);
        setTimeout(() => setPhase('idle'), 2000);
      } else {
        setPhase('closing');
        setTimeout(() => setPhase('idle'), 300);
      }
      setSubmitting(false);
    },
    [companyId, submitting],
  );

  if (phase === 'idle') return null;

  return (
    <aside
      role="dialog"
      aria-label="WhatsApp geri bildirim"
      data-testid="feedback-balloon"
      data-phase={phase}
      data-company-slug={companySlug}
      className={`fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-line bg-white p-4 shadow-xl transition-all ${
        phase === 'closing' ? 'opacity-0 translate-y-2' : 'opacity-100'
      }`}
    >
      {phase === 'thanks' ? (
        <div
          className="flex flex-col items-center gap-2 py-4"
          data-testid="feedback-thanks"
        >
          <span className="text-4xl">✓</span>
          <p className="text-sm font-bold text-arrow-7">Teşekkürler 🐾</p>
        </div>
      ) : (
        <>
          <header className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-bold text-cart">
                Pet shop sana ulaştı mı?
              </h3>
              <p className="mt-0.5 text-[11px] text-ink-3">
                Tek tıklamayla geri bildirim — sayfada kalıcı.
              </p>
            </div>
            <button
              type="button"
              aria-label="Kapat"
              data-testid="feedback-close"
              onClick={() => submit('closed_manually')}
              disabled={submitting}
              className="-mt-1 -mr-1 rounded-full p-1 text-ink-4 hover:bg-line-soft hover:text-cart disabled:opacity-50"
            >
              ✕
            </button>
          </header>
          <ul className="mt-3 flex justify-between gap-1">
            {RATING_OPTIONS.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  data-testid={`feedback-${opt.value}`}
                  aria-label={opt.label}
                  onClick={() => submit('submitted', opt.value)}
                  disabled={submitting}
                  className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-white text-2xl transition-all hover:scale-110 hover:border-cat hover:bg-cat-soft disabled:opacity-50"
                  title={opt.label}
                >
                  <span aria-hidden>{opt.emoji}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-ink-4 text-center">
            ⓘ Anonim — IP&apos;ler bir yönlü hash&apos;lenir (KVKK uyumlu).
          </p>
        </>
      )}
    </aside>
  );
}
