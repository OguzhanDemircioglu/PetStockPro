'use client';

import { useMemo, useState, useTransition } from 'react';
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

export function StocktakeWorkflow({ detail }: { detail: StocktakeDetail }) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
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
          <input
            type="search"
            placeholder="🔍 Ara: ürün, variant, SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[200px] rounded-xl border-[1.5px] border-line bg-white px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </section>
      )}

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
    </>
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
