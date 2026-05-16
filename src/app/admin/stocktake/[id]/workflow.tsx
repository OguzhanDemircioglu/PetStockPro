'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  updateCountAction,
  completeStocktakeAction,
  cancelStocktakeAction,
  type CompleteStocktakeState,
  type CancelStocktakeState,
} from './actions';
import type { StocktakeDetail, StocktakeItemDetail } from '@/lib/stocktake/sessions';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  in_progress: { label: '▶ Sürüyor', cls: 'bg-cat-soft text-cart' },
  waiting: { label: '⏸ Beklemede', cls: 'bg-line-soft text-ink-2' },
  completed: { label: '✓ Tamamlandı', cls: 'bg-arrow-soft text-arrow-7' },
  cancelled: { label: '× İptal', cls: 'bg-danger-soft text-danger-7' },
};

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— sebep seç —' },
  { value: 'loss', label: 'Kayıp' },
  { value: 'overage', label: 'Fazlalık' },
  { value: 'wrong_entry', label: 'Yanlış giriş' },
  { value: 'expired', label: 'SKT geçti' },
  { value: 'damage', label: 'Hasar' },
  { value: 'theft', label: 'Hırsızlık' },
  { value: 'other', label: 'Diğer' },
];

type FilterMode = 'all' | 'uncounted' | 'counted' | 'diff';
type ViewMode = 'table' | 'card';

export function StocktakeWorkflow({ detail }: { detail: StocktakeDetail }) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const isOpen = detail.status === 'in_progress' || detail.status === 'waiting';

  const filtered = useMemo(() => {
    return detail.items.filter((i) => {
      if (filter === 'uncounted' && i.countedQty !== null) return false;
      if (filter === 'counted' && i.countedQty === null) return false;
      if (filter === 'diff' && (i.diff === null || i.diff === 0)) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          i.productName.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          (i.variantLabel ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [detail.items, filter, query]);

  const pct =
    detail.totalItems > 0 ? Math.round((detail.countedItems / detail.totalItems) * 100) : 0;

  return (
    <>
      <header className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_LABELS[detail.status]?.cls ?? ''}`}
              >
                {STATUS_LABELS[detail.status]?.label ?? detail.status}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                {detail.mode === 'full' ? 'Tam' : detail.mode} ·{' '}
                {detail.branchName ?? '—'}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-cart">
              Sayım #{detail.id.slice(0, 8)}
            </h1>
            <p className="text-xs text-ink-3">
              Başladı{' '}
              {new Date(detail.startedAt).toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {detail.note ? ` · ${detail.note}` : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-cat" data-stocktake-pct>
              {pct}%
            </div>
            <div className="text-[10.5px] uppercase tracking-wider text-ink-3">
              tamamlandı
            </div>
          </div>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-line-soft">
          <div
            className="h-full bg-gradient-to-r from-cat to-arrow"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11.5px]">
          <span>
            ✓ Sayıldı:{' '}
            <strong className="text-ink" data-counted={detail.countedItems}>
              {detail.countedItems}
            </strong>{' '}
            / {detail.totalItems}
          </span>
          <span>
            ⚠ Fark:{' '}
            <strong className="text-ink" data-diff={detail.diffItems}>
              {detail.diffItems}
            </strong>
          </span>
        </div>

        {isOpen && (
          <div className="mt-5 flex flex-wrap gap-2">
            <CompleteButton stocktakeId={detail.id} disabled={detail.countedItems < detail.totalItems} />
            <CancelButton stocktakeId={detail.id} />
          </div>
        )}
      </header>

      {isOpen && (
        <section className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', 'Tümü', detail.items.length],
                ['uncounted', 'Sayılmadı', detail.totalItems - detail.countedItems],
                ['counted', 'Sayıldı', detail.countedItems],
                ['diff', 'Farklı', detail.diffItems],
              ] as [FilterMode, string, number][]
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                data-filter={key}
                aria-pressed={filter === key}
                className={
                  filter === key
                    ? 'rounded-full bg-cat px-3 py-1.5 text-[11.5px] font-bold text-white'
                    : 'rounded-full border border-line bg-white px-3 py-1.5 text-[11.5px] font-bold text-ink-3 hover:bg-line-soft'
                }
              >
                {label} ({count})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex overflow-hidden rounded-xl border border-line"
              role="tablist"
              aria-label="Görünüm modu"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'table'}
                onClick={() => setViewMode('table')}
                data-view-mode="table"
                className={`px-3 py-1.5 text-[11px] font-bold ${
                  viewMode === 'table' ? 'bg-cat text-white' : 'bg-white text-ink-3 hover:bg-line-soft'
                }`}
              >
                📋 Tablo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'card'}
                onClick={() => setViewMode('card')}
                data-view-mode="card"
                className={`px-3 py-1.5 text-[11px] font-bold ${
                  viewMode === 'card' ? 'bg-cat text-white' : 'bg-white text-ink-3 hover:bg-line-soft'
                }`}
              >
                📱 Tek tek
              </button>
            </div>
            <input
              type="search"
              placeholder="🔍 Ara: ürün, variant, SKU..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-[200px] rounded-xl border-[1.5px] border-line bg-white px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </div>
        </section>
      )}

      {viewMode === 'card' && filtered.length > 0 ? (
        <SwipeCardView
          stocktakeId={detail.id}
          items={filtered}
          editable={isOpen}
        />
      ) : (
        <section className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3">Variant / SKU</th>
                <th className="px-4 py-3 text-right">Sistem</th>
                <th className="px-4 py-3 text-right">Sayılan</th>
                <th className="px-4 py-3 text-right">Fark</th>
                <th className="px-4 py-3">Sebep</th>
                <th className="px-4 py-3 text-center">✓</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-ink-3">
                    Filtreye uyan kayıt yok
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <ItemRow
                    key={item.id}
                    stocktakeId={detail.id}
                    item={item}
                    editable={isOpen}
                  />
                ))
              )}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// SwipeCardView — mobil-öncelikli tek-ürün modu (SPRINT-PLAN §8.5)
// ─────────────────────────────────────────────────────────────────

function SwipeCardView({
  stocktakeId,
  items,
  editable,
}: {
  stocktakeId: string;
  items: StocktakeItemDetail[];
  editable: boolean;
}) {
  const [index, setIndex] = useState(0);
  // Filter değişip items kısalırsa render-time clamp — useEffect+setState
  // cascade'i engellemek için.
  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);
  const item = items[safeIndex];

  // Touch swipe gesture — basit pointer events ile horizontal drag
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const onPointerDown = (e: React.PointerEvent) => {
    // Input elemanı üzerinde swipe yapma — yazı yazılırken kaymasın
    const target = e.target as HTMLElement;
    if (target.closest('input, select, button, [data-no-swipe]')) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = Math.abs(e.clientY - dragStart.current.y);
    // Vertical scroll dominantsa swipe iptal
    if (dy > Math.abs(dx) && dy > 20) {
      dragStart.current = null;
      setDragOffset(0);
      return;
    }
    setDragOffset(dx);
  };

  const onPointerUp = () => {
    if (!dragStart.current) return;
    const dx = dragOffset;
    dragStart.current = null;
    setDragOffset(0);
    const threshold = 80;
    if (dx > threshold && safeIndex > 0) {
      setIndex((i) => Math.max(0, i - 1));
    } else if (dx < -threshold && safeIndex < items.length - 1) {
      setIndex((i) => Math.min(items.length - 1, i + 1));
    }
  };

  if (!item) {
    return (
      <section className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-ink-3">
        Filtreye uyan kayıt yok
      </section>
    );
  }

  const go = (delta: number) => {
    setIndex((i) => Math.max(0, Math.min(items.length - 1, i + delta)));
  };

  return (
    <section
      data-view="card"
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between text-[11px] font-bold text-ink-3">
        <span>
          <span className="text-cart">{safeIndex + 1}</span> / {items.length}
        </span>
        <span className="text-ink-4">← Önceki · Sonraki → · kaydır</span>
      </div>

      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: dragOffset === 0 ? 'transform 200ms ease' : 'none',
          touchAction: 'pan-y',
        }}
        data-card-index={safeIndex}
        data-item-id={item.id}
        className="select-none rounded-2xl border border-line bg-white p-6 shadow-sm"
      >
        <SwipeCard
          key={item.id}
          stocktakeId={stocktakeId}
          item={item}
          editable={editable}
          onSaved={() => {
            if (safeIndex < items.length - 1) go(1);
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={safeIndex === 0}
          data-action="prev-card"
          className="flex-1 rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold text-cart hover:bg-cat-soft disabled:opacity-40"
        >
          ← Önceki
        </button>
        <div className="flex gap-1">
          {items.slice(0, Math.min(12, items.length)).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === safeIndex
                  ? 'bg-cat'
                  : i < safeIndex
                    ? 'bg-arrow-soft'
                    : 'bg-line'
              }`}
            />
          ))}
          {items.length > 12 && <span className="text-[10px] text-ink-4">...</span>}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={safeIndex === items.length - 1}
          data-action="next-card"
          className="flex-1 rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold text-cart hover:bg-cat-soft disabled:opacity-40"
        >
          Sonraki →
        </button>
      </div>
    </section>
  );
}

function SwipeCard({
  stocktakeId,
  item,
  editable,
  onSaved,
}: {
  stocktakeId: string;
  item: StocktakeItemDetail;
  editable: boolean;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [counted, setCounted] = useState<string>(
    item.countedQty == null ? '' : String(item.countedQty),
  );
  const [reason, setReason] = useState<string>(item.reason ?? '');
  const [diff, setDiff] = useState<number | null>(item.diff);
  const [error, setError] = useState<string | null>(null);
  const [savedCounted, setSavedCounted] = useState<string>(
    item.countedQty == null ? '' : String(item.countedQty),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Yeni karta geçildiğinde input otomatik fokus + mobil numpad açılır
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (counted === '') return;
    const formData = new FormData();
    formData.set('countedQty', counted);
    if (reason) formData.set('reason', reason);
    setError(null);
    startTransition(async () => {
      const result = await updateCountAction(stocktakeId, item.id, null, formData);
      if (result.ok) {
        setDiff(result.diff ?? null);
        setSavedCounted(counted);
        // Diff varsa kart aynı kalır (sebep eksik veya hatalı). Diff 0 veya
        // sebep girilmişse otomatik sonraki karta geç.
        if ((result.diff ?? 0) === 0 || reason) {
          onSaved();
        }
      } else if (result.error) {
        setError(result.error);
      }
    });
  };

  const hasDiff = diff !== null && diff !== 0;
  const needsReason = hasDiff && !reason;
  const completed = savedCounted !== '';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold text-cart">{item.productName}</h3>
        {item.variantLabel && (
          <p className="text-xs text-ink-3">{item.variantLabel}</p>
        )}
        <p className="mt-1 font-mono text-[10.5px] text-ink-4">SKU {item.sku}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-line-soft p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Sistem
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink">
            {item.systemQty}
          </div>
        </div>
        <div
          className={`rounded-xl p-3 text-center ${
            diff === null
              ? 'bg-line-soft'
              : diff > 0
                ? 'bg-arrow-soft'
                : diff < 0
                  ? 'bg-cat-soft'
                  : 'bg-line-soft'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Fark
          </div>
          <div
            className={`mt-1 font-mono text-2xl font-bold ${
              diff === null
                ? 'text-ink-4'
                : diff > 0
                  ? 'text-arrow-7'
                  : diff < 0
                    ? 'text-cart'
                    : 'text-ink-3'
            }`}
          >
            {diff === null ? '—' : diff > 0 ? `+${diff}` : diff}
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor={`card-counted-${item.id}`}
          className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
        >
          Sayılan miktar
        </label>
        <input
          ref={inputRef}
          id={`card-counted-${item.id}`}
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={0}
          step={1}
          value={counted}
          disabled={!editable || pending}
          onChange={(e) => setCounted(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="0"
          data-counted-input
          className="mt-1 w-full rounded-xl border-2 border-line bg-white px-4 py-4 text-right font-mono text-3xl font-bold focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      {hasDiff && (
        <div>
          <label
            htmlFor={`card-reason-${item.id}`}
            className={`text-[10.5px] font-bold uppercase tracking-wider ${
              needsReason ? 'text-danger-7' : 'text-ink-3'
            }`}
          >
            Sebep {needsReason ? '*' : ''}
          </label>
          <select
            id={`card-reason-${item.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={!editable || pending}
            data-reason-select
            className={`mt-1 w-full rounded-xl border-2 px-3 py-3 text-sm focus:border-cat focus:outline-none ${
              needsReason ? 'border-danger/40 bg-danger-soft/30' : 'border-line bg-white'
            }`}
          >
            {REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!editable || pending || counted === ''}
        data-action="save-card"
        className="w-full rounded-xl bg-cat px-4 py-3 text-sm font-bold text-white hover:bg-cat-2 disabled:opacity-50"
      >
        {pending ? '...' : completed ? '✓ Güncellendi — Kaydet (Enter)' : '✓ Kaydet (Enter)'}
      </button>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-danger-soft px-3 py-2 text-[11px] text-danger-7"
        >
          {error}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  stocktakeId,
  item,
  editable,
}: {
  stocktakeId: string;
  item: StocktakeItemDetail;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [counted, setCounted] = useState<string>(
    item.countedQty == null ? '' : String(item.countedQty),
  );
  const [reason, setReason] = useState<string>(item.reason ?? '');
  const [diff, setDiff] = useState<number | null>(item.diff);
  const [error, setError] = useState<string | null>(null);
  const [savedCounted, setSavedCounted] = useState<string>(
    item.countedQty == null ? '' : String(item.countedQty),
  );
  const [savedReason, setSavedReason] = useState<string>(item.reason ?? '');

  const submit = () => {
    if (counted === '') return;
    const formData = new FormData();
    formData.set('countedQty', counted);
    if (reason) formData.set('reason', reason);
    setError(null);
    startTransition(async () => {
      const result = await updateCountAction(stocktakeId, item.id, null, formData);
      if (result.ok) {
        setDiff(result.diff ?? null);
        setSavedCounted(counted);
        setSavedReason(reason);
      } else if (result.error) {
        setError(result.error);
      }
    });
  };

  const completed = savedCounted !== '';
  const hasDiff = diff !== null && diff !== 0;
  const needsReason = hasDiff && !reason;
  const isDirty = counted !== savedCounted || reason !== savedReason;

  return (
    <tr
      data-item-id={item.id}
      data-completed={completed ? '1' : '0'}
      className="hover:bg-line-soft"
    >
      <td className="px-4 py-3">
        <div className="text-[12.5px] font-bold text-ink">{item.productName}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-[11px] text-ink-3">{item.variantLabel}</div>
        <div className="font-mono text-[10.5px] text-ink-4">{item.sku}</div>
      </td>
      <td className="px-4 py-3 text-right font-mono">{item.systemQty}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <input
            type="number"
            min={0}
            step={1}
            value={counted}
            disabled={!editable || pending}
            onChange={(e) => setCounted(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            data-counted-input
            className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-right font-mono text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
          />
          {editable && isDirty && counted !== '' && (
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              data-action="save-row"
              aria-label="Bu satırı kaydet"
              className="rounded-md bg-cat px-1.5 py-1 text-[10px] font-bold text-white hover:bg-cat-2 disabled:opacity-50"
            >
              ✓
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {diff === null ? (
          <span className="text-ink-4">—</span>
        ) : diff > 0 ? (
          <span className="text-arrow-7">+{diff}</span>
        ) : diff < 0 ? (
          <span className="text-cart">{diff}</span>
        ) : (
          <span className="text-ink-3">0</span>
        )}
      </td>
      <td className="px-4 py-3">
        {hasDiff ? (
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={!editable || pending}
            data-reason-select
            className={
              needsReason
                ? 'rounded-lg border border-danger/40 bg-white px-2 py-1 text-xs focus:border-cat focus:outline-none'
                : 'rounded-lg border border-line bg-white px-2 py-1 text-xs focus:border-cat focus:outline-none'
            }
          >
            {REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-ink-4">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {pending ? (
          <span className="text-ink-3">…</span>
        ) : completed ? (
          <span className="text-arrow-7">✓</span>
        ) : (
          <span className="text-ink-4">○</span>
        )}
        {error && (
          <div
            role="alert"
            className="absolute mt-1 rounded bg-danger-soft px-2 py-1 text-[10px] text-danger-7"
          >
            {error}
          </div>
        )}
      </td>
    </tr>
  );
}

function CompleteButton({ stocktakeId, disabled }: { stocktakeId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CompleteStocktakeState | null>(null);

  const submit = () => {
    if (disabled) return;
    if (
      !window.confirm(
        'Sayımı tamamla? Diff != 0 olan her variant için stok hareketi üretilecek.',
      )
    ) {
      return;
    }
    setState(null);
    startTransition(async () => {
      const result = await completeStocktakeAction(stocktakeId, null, new FormData());
      setState(result);
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={submit}
        disabled={disabled || pending}
        data-action="complete"
        className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] disabled:opacity-50 hover:-translate-y-0.5 transition-transform"
      >
        {pending ? 'Tamamlanıyor...' : '✓ Sayımı tamamla'}
      </button>
      {state?.error && (
        <div role="alert" className="rounded-lg bg-danger-soft px-3 py-1.5 text-[11px] text-danger-7">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-lg bg-arrow-soft px-3 py-1.5 text-[11px] text-arrow-7">
          ✓ {state.movementsCreated ?? 0} stok hareketi üretildi
        </div>
      )}
    </div>
  );
}

function CancelButton({ stocktakeId }: { stocktakeId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!window.confirm('Sayımı iptal et? Sayılan veriler audit için saklanır, stok hareketi YOK.')) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result: CancelStocktakeState = await cancelStocktakeAction(
        stocktakeId,
        null,
        new FormData(),
      );
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        data-action="cancel"
        className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink-3 hover:bg-danger-soft hover:text-danger-7 disabled:opacity-50"
      >
        {pending ? 'İptal ediliyor...' : '× İptal'}
      </button>
      {error && <div role="alert" className="text-[11px] text-danger-7">{error}</div>}
    </div>
  );
}
