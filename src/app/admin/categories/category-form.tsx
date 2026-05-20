'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import type { CategoryActionState } from './actions';

interface Initial {
  name?: string;
  emoji?: string | null;
  sktRequired?: boolean;
  displayOrder?: number;
  parentId?: string | null;
}

export interface ParentOption {
  id: string;
  name: string;
  emoji: string | null;
}

interface Props {
  action: (
    prev: CategoryActionState | null,
    formData: FormData,
  ) => Promise<CategoryActionState>;
  initial?: Initial;
  submitLabel: string;
  /** Mevcut üst kategoriler — alt kategori eklemek için select box'a doldurulur. */
  parentOptions: ParentOption[];
  /**
   * Sıralama selectbox üst sınırı: mevcut max(displayOrder) + 1.
   * Yeni kategori ekleniyorsa default = maxOrder (yani sonuna ekle).
   * Edit ise initial.displayOrder kullanılır.
   */
  maxOrder: number;
}

export function CategoryForm({
  action,
  initial,
  submitLabel,
  parentOptions,
  maxOrder,
}: Props) {
  const [state, formAction, pending] = useActionState<
    CategoryActionState | null,
    FormData
  >(action, null);
  const errorState = useMemo(
    () =>
      state && !state.ok && state.message
        ? { error: state.message, issues: state.issues }
        : null,
    [state],
  );
  useSwalOnError(errorState);

  // 'root' = üst kategori, parentId UUID = alt kategori
  const initialMode: 'root' | 'child' = initial?.parentId ? 'child' : 'root';
  const [mode, setMode] = useState<'root' | 'child'>(initialMode);

  // displayOrder selectbox: 1..maxOrder (yeni eklemede default = maxOrder = en son)
  const defaultOrder = initial?.displayOrder ?? maxOrder;
  // Edit'te mevcut displayOrder maxOrder'dan büyük olabilir → seçeneklere ekle
  const orderOptions = Array.from(
    { length: Math.max(maxOrder, defaultOrder) },
    (_, i) => i + 1,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Mod toggle: Üst / Alt */}
      <div className="flex gap-2" data-testid="category-mode-toggle">
        <button
          type="button"
          onClick={() => setMode('root')}
          data-testid="mode-root"
          aria-pressed={mode === 'root'}
          className={`flex-1 rounded-xl border-2 px-4 py-3 text-[14px] font-bold transition-all ${
            mode === 'root'
              ? 'border-cat bg-cat-soft text-cart shadow-sm'
              : 'border-line bg-paper text-ink-3 hover:border-cat/40'
          }`}
        >
          🗂 Üst kategori ekle
        </button>
        <button
          type="button"
          onClick={() => setMode('child')}
          data-testid="mode-child"
          aria-pressed={mode === 'child'}
          disabled={parentOptions.length === 0}
          className={`flex-1 rounded-xl border-2 px-4 py-3 text-[14px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            mode === 'child'
              ? 'border-cat bg-cat-soft text-cart shadow-sm'
              : 'border-line bg-paper text-ink-3 hover:border-cat/40'
          }`}
        >
          📂 Alt kategori ekle
        </button>
      </div>

      {/* parentId hidden veya select */}
      {mode === 'root' ? (
        <input type="hidden" name="parentId" value="root" />
      ) : (
        <div>
          <label
            htmlFor="parentId"
            className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
          >
            Üst kategori * (hangi kategoriye bağlanacak)
          </label>
          <select
            id="parentId"
            name="parentId"
            required
            data-testid="parent-select"
            defaultValue={initial?.parentId ?? ''}
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="">— Üst kategori seç —</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji ? `${p.emoji} ` : ''}
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[12px] text-ink-3">
            Alt kategori bir üst kategoriye bağlı olmak zorunda. Üst kategori
            silinirse alt kategoriler de silinir (cascade).
          </p>
        </div>
      )}

      <div className="grid grid-cols-[80px_1fr] gap-3">
        <div>
          <label
            htmlFor="emoji"
            className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
          >
            Emoji
          </label>
          <input
            id="emoji"
            name="emoji"
            type="text"
            maxLength={10}
            defaultValue={initial?.emoji ?? ''}
            placeholder="🐱"
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-center text-lg focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
          >
            Kategori adı *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={1}
            maxLength={100}
            defaultValue={initial?.name ?? ''}
            placeholder={
              mode === 'root' ? 'Kedi, Köpek, Kuş...' : 'Kuru mama, Oyuncak...'
            }
            data-testid="category-name"
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="displayOrder"
          className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
        >
          Sıralama (default: sona ekle = {maxOrder})
        </label>
        <select
          id="displayOrder"
          name="displayOrder"
          defaultValue={String(defaultOrder)}
          data-testid="display-order"
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        >
          {orderOptions.map((n) => (
            <option key={n} value={n}>
              {n}
              {n === maxOrder ? ' (en son)' : ''}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[12px] text-ink-3">
          Mevcut max sıra: <strong className="text-cart">{maxOrder}</strong>.
          Yeni kategori default olarak en sona eklenir; daha küçük bir sıra
          seçersen mevcut kategoriler arasına girer.
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-line-soft px-3.5 py-3 text-sm text-ink-2">
        <input
          type="checkbox"
          name="sktRequired"
          defaultChecked={initial?.sktRequired ?? false}
          className="h-[18px] w-[18px] accent-cat"
        />
        <span>
          <strong className="text-cart">SKT zorunlu</strong> — mama, yem,
          vitamin gibi son kullanma tarihi olan kategoriler için
        </span>
      </label>

      {state?.ok && state.message && (
        <div
          role="status"
          className="rounded-lg bg-arrow-soft px-3 py-2 text-sm font-bold text-arrow-7"
          data-testid="category-alert"
        >
          <p>✓ {state.message}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          data-testid="category-submit"
          className="flex-1 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] disabled:opacity-60"
        >
          {pending ? 'Kaydediliyor...' : submitLabel}
        </button>
        <Link
          href={'/admin/categories' as never}
          className="rounded-xl border border-line bg-paper px-6 py-3 text-sm font-bold text-ink-3 hover:bg-line-soft"
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
