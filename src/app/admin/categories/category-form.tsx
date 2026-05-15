'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { CategoryActionState } from './actions';

interface Initial {
  name?: string;
  emoji?: string | null;
  vatRate?: string | null;
  sktRequired?: boolean;
  displayOrder?: number;
}

interface Props {
  action: (
    prev: CategoryActionState | null,
    formData: FormData,
  ) => Promise<CategoryActionState>;
  initial?: Initial;
  submitLabel: string;
}

export function CategoryForm({ action, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<
    CategoryActionState | null,
    FormData
  >(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-[80px_1fr] gap-3">
        <div>
          <label
            htmlFor="emoji"
            className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
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
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-3 text-center text-lg focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
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
            placeholder="Kedi maması, Köpek tasması..."
            data-testid="category-name"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="vatRate"
            className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            KDV oranı
          </label>
          <select
            id="vatRate"
            name="vatRate"
            defaultValue={initial?.vatRate ?? ''}
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="">— Belirtilmedi —</option>
            <option value="1.00">%1 (kitap, ilaç)</option>
            <option value="8.00">%8 (eski oran)</option>
            <option value="10.00">%10 (pet gıda - mama/snack)</option>
            <option value="20.00">%20 (genel — aksesuar/oyuncak/sağlık)</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="displayOrder"
            className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Sıralama
          </label>
          <input
            id="displayOrder"
            name="displayOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={initial?.displayOrder ?? 100}
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-line-soft px-3.5 py-3 text-sm text-ink-2">
        <input
          type="checkbox"
          name="sktRequired"
          defaultChecked={initial?.sktRequired ?? false}
          className="h-[18px] w-[18px] accent-cat"
        />
        <span>
          <strong className="text-cart">SKT zorunlu</strong> — mama, ilaç,
          şampuan gibi son kullanma tarihi olan kategoriler için
        </span>
      </label>

      {state?.message && (
        <div
          role="alert"
          className={`rounded-lg px-3 py-2 text-sm font-bold ${
            state.ok ? 'bg-arrow-soft text-arrow-7' : 'bg-danger-soft text-danger-7'
          }`}
          data-testid="category-alert"
        >
          <p>{state.ok ? '✓' : '✕'} {state.message}</p>
          {state.issues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[11px] font-normal">
              {state.issues.map((i, k) => (
                <li key={k}>{i}</li>
              ))}
            </ul>
          )}
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
          className="rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink-3 hover:bg-line-soft"
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
