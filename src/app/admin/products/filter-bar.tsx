'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
}
interface BrandOption {
  id: string;
  name: string;
}

interface Initial {
  q: string;
  category: string;
  brand: string;
  status: 'active' | 'inactive' | 'all';
  vitrin: 'on' | 'off' | '';
}

interface Props {
  categories: CategoryOption[];
  brands: BrandOption[];
  initial: Initial;
}

export function FilterBar({ categories, brands, initial }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initial.q);
  const [pending, startTransition] = useTransition();

  const apply = (override: Partial<Initial>) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    const merged = { ...initial, ...override };

    if (merged.q && merged.q.trim().length > 0) next.set('q', merged.q.trim());
    else next.delete('q');
    if (merged.category) next.set('category', merged.category);
    else next.delete('category');
    if (merged.brand) next.set('brand', merged.brand);
    else next.delete('brand');
    if (merged.status && merged.status !== 'all') next.set('status', merged.status);
    else next.delete('status');
    if (merged.vitrin) next.set('vitrin', merged.vitrin);
    else next.delete('vitrin');

    // Hata banner'larını temizle
    next.delete('created');
    next.delete('updated');
    next.delete('deleted');

    const qs = next.toString();
    startTransition(() => {
      router.push((qs.length > 0 ? `/admin/products?${qs}` : '/admin/products') as never);
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    apply({ q });
  };

  const activeFilterCount = [
    initial.q,
    initial.category,
    initial.brand,
    initial.status !== 'all' ? initial.status : '',
    initial.vitrin,
  ].filter(Boolean).length;

  return (
    <section
      className="rounded-2xl border border-line bg-white p-4"
      data-testid="product-filter-bar"
    >
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <label
            htmlFor="filter-q"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            🔍 Ara
          </label>
          <input
            id="filter-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ürün adı veya SKU"
            data-testid="filter-q"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>

        <div className="min-w-[180px]">
          <label
            htmlFor="filter-category"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Kategori
          </label>
          <select
            id="filter-category"
            value={initial.category}
            onChange={(e) => apply({ category: e.target.value })}
            data-testid="filter-category"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="">Tümü</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? `${c.emoji} ` : ''}{c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[160px]">
          <label
            htmlFor="filter-brand"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Marka
          </label>
          <select
            id="filter-brand"
            value={initial.brand}
            onChange={(e) => apply({ brand: e.target.value })}
            disabled={brands.length === 0}
            data-testid="filter-brand"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15 disabled:opacity-60"
          >
            <option value="">{brands.length === 0 ? 'Marka yok' : 'Tümü'}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[120px]">
          <label
            htmlFor="filter-status"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Durum
          </label>
          <select
            id="filter-status"
            value={initial.status}
            onChange={(e) =>
              apply({ status: e.target.value as Initial['status'] })
            }
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="all">Hepsi</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
        </div>

        <div className="min-w-[140px]">
          <label
            htmlFor="filter-vitrin"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Vitrin
          </label>
          <select
            id="filter-vitrin"
            value={initial.vitrin}
            onChange={(e) =>
              apply({ vitrin: e.target.value as Initial['vitrin'] })
            }
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="">Hepsi</option>
            <option value="on">✓ Yayında</option>
            <option value="off">Kapalı</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-cat px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60"
        >
          {pending ? '...' : 'Ara'}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              apply({ q: '', category: '', brand: '', status: 'all', vitrin: '' });
            }}
            data-testid="filter-clear"
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-ink-3 hover:bg-line-soft"
          >
            × Temizle ({activeFilterCount})
          </button>
        )}
        <a
          href={`/admin/products/export${
            params?.toString() ? `?${params.toString()}` : ''
          }`}
          download
          data-testid="products-export"
          className="ml-auto rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-cart hover:bg-cat-soft"
        >
          ⬇ CSV
        </a>
      </form>
    </section>
  );
}
