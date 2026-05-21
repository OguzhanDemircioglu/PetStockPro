'use client';

import { useState } from 'react';
import { useSwalOnErrorString } from '@/lib/ui/use-swal-on-error';

const REASON_OPTIONS: Array<{
  value: string;
  label: string;
  emoji: string;
}> = [
  { value: 'wrong_photo', label: 'Yanlış fotoğraf', emoji: '📷' },
  { value: 'wrong_info', label: 'Yanlış bilgi', emoji: '⚠' },
  { value: 'spam', label: 'Spam / reklam', emoji: '🚫' },
  { value: 'duplicate', label: 'Tekrar eden ilan', emoji: '👥' },
  { value: 'inappropriate', label: 'Uygunsuz içerik', emoji: '⛔' },
  { value: 'closed_shop', label: 'Mağaza kapanmış', emoji: '🔒' },
  { value: 'other', label: 'Diğer', emoji: '💭' },
];

interface Props {
  companyId: string;
  targetType: 'storefront' | 'product';
  productId?: string;
  label?: string;
}

export function ReportButton({
  companyId,
  targetType,
  productId,
  label = '🚩 Bu içeriği bildir',
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  useSwalOnErrorString(error, 'Bildirim hatası');
  const hasError = !!error;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError('Bir sebep seç.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/vitrin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          targetType,
          productId: productId ?? undefined,
          reason,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (typeof data.remainingInWindow === 'number') {
          setRemaining(data.remainingInWindow);
        }
        setDone(true);
      } else {
        if (data.reason === 'rate_limit_exceeded') {
          const max = data.max ?? 5;
          const windowHours = data.windowHours ?? 24;
          setError(
            `Bu pet shop için günlük şikayet sınırına ulaştın (${max}/${max}). ${windowHours} saat içinde yeniden gönderebilirsin.`,
          );
        } else if (data.reason === 'invalid_input') {
          setError('Geçersiz giriş — sebep veya hedef eksik.');
        } else {
          setError('Şikayet kaydedilemedi. Sonra tekrar dene.');
        }
      }
    } catch {
      setError('Ağ hatası. Sonra tekrar dene.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        data-testid="report-success"
        className="rounded-xl border border-arrow/30 bg-arrow-soft/50 px-4 py-3 text-center text-sm text-arrow-7"
      >
        ✓ Bildiri alındı — incelemeye gönderildi. Teşekkürler 
        {remaining !== null && (
          <div
            data-testid="report-remaining"
            className="mt-1.5 text-[12.5px] font-bold text-arrow-7/80"
          >
            {remaining === 0
              ? '⚠ Bu pet shop için günlük şikayet hakkın doldu (5/5). 24 saat içinde yeniden gönderemezsin.'
              : `Bu pet shop için kalan: ${remaining}/5 şikayet (24 saat içinde).`}
          </div>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="report-trigger"
        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3 py-2 text-[13px] font-bold text-ink-3 hover:border-danger hover:text-danger-7 transition-colors"
      >
        {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="report-form"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4"
    >
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-cart">🚩 Bildirimde bulun</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink-4 hover:text-cart"
        >
          × Vazgeç
        </button>
      </header>

      <div>
        <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-ink-3">
          Sebep *
        </label>
        <div
          role="radiogroup"
          aria-label="Bildirim sebebi"
          aria-invalid={hasError || undefined}
          className="grid grid-cols-2 gap-1.5"
        >
          {REASON_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-[12.5px] transition-colors ${
                reason === opt.value
                  ? 'border-cat bg-cat-soft/40 font-bold text-cart'
                  : 'border-line bg-paper text-ink-2 hover:bg-line-soft'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={opt.value}
                checked={reason === opt.value}
                onChange={(e) => setReason(e.target.value)}
                data-reason={opt.value}
                className="sr-only"
              />
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="report-note"
          className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-ink-3"
        >
          Açıklama (opsiyonel, max 1000)
        </label>
        <textarea
          id="report-note"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Ekstra detay yazabilirsin…"
          data-testid="report-note"
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2 text-[13.5px] focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
        />
      </div>

      <p className="text-[11.5px] text-ink-4">
        KVKK uyumlu anonim kayıt. IP adresinin hash&apos;i tutulur, kimlik
        bilgisi alınmaz.
      </p>

      <button
        type="submit"
        disabled={submitting || !reason}
        data-testid="report-submit"
        className="rounded-xl bg-danger px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
      >
        {submitting ? 'Gönderiliyor…' : '🚩 Şikayeti gönder'}
      </button>
    </form>
  );
}
