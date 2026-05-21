'use client';

import { useEffect, useRef, useState } from 'react';
import type { SearchResult } from '@/lib/catalog/seed-catalog';
import { PetSpinner } from '@/components/ui/pet-spinner';

interface Props {
  /** Bir öneri seçildiğinde tetiklenir; parent form alanlarını doldurur. */
  onSelect: (product: SearchResult) => void;
  /** Üst formdan pending durumu (submit'te disable). */
  disabled?: boolean;
}

const DEBOUNCE_MS = 280;

/**
 * Curated seed katalog autocomplete. `/admin/products/new` form'unun üstüne
 * eklenir — kullanıcı barkod yazar veya marka/model aratır, listeden seçince
 * parent `onSelect` callback'i parent form alanlarını doldurur.
 */
export function SeedCatalogAutocomplete({ onSelect, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [serverResults, setServerResults] = useState<SearchResult[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmedQuery = query.trim();
  const hasMinQuery = trimmedQuery.length >= 2;

  // Render-time derived: query <2 ise her halükarda boş + hatasız
  const results: SearchResult[] = hasMinQuery ? serverResults : [];
  const error: string | null = hasMinQuery ? serverError : null;

  // Debounced fetch (sadece valid query'de tetiklenir)
  useEffect(() => {
    if (!hasMinQuery) return;

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setServerError(null);

      fetch(`/api/catalog/search?q=${encodeURIComponent(trimmedQuery)}&limit=8`, {
        signal: ac.signal,
        credentials: 'same-origin',
      })
        .then((r) => {
          if (!r.ok) throw new Error(`http_${r.status}`);
          return r.json();
        })
        .then((data: { results: SearchResult[] }) => {
          setServerResults(data.results ?? []);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setServerError('Arama sırasında bir hata oldu, tekrar dene.');
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [trimmedQuery, hasMinQuery]);

  // Dış tıklama → kapat
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSelect = (product: SearchResult) => {
    onSelect(product);
    setOpen(false);
    setQuery('');
    setServerResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[0]);
    }
  };

  const showDropdown = open && (loading || results.length > 0 || error || (query.trim().length >= 2));

  return (
    <div ref={containerRef} className="relative" data-testid="seed-autocomplete">
      <label
        htmlFor="seed-search"
        className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-cat"
      >
        📚 Katalogtan ara (opsiyonel)
      </label>
      <div className="relative">
        <input
          id="seed-search"
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Barkod yaz veya marka/model ara (örn. Royal Canin Persian)"
          disabled={disabled}
          autoComplete="off"
          data-testid="seed-search-input"
          className="w-full rounded-xl border-[1.5px] border-cat/40 bg-paper px-4 py-3 pr-10 text-sm text-ink transition-colors focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15 disabled:opacity-60"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <PetSpinner size="sm" inline tone="cat" label="Katalog aranıyor" />
          </span>
        )}
      </div>

      {showDropdown && (
        <div
          data-testid="seed-results-dropdown"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-96 overflow-auto rounded-xl border border-cat/30 bg-paper shadow-xl"
        >
          {error && (
            <div className="px-3 py-2 text-xs font-bold text-danger-7" role="alert">
              ✕ {error}
            </div>
          )}
          {!loading && !error && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-3 py-3 text-xs text-ink-4">
              Eşleşen seed ürün yok. Kendi ürününü manuel girebilirsin ↓
            </div>
          )}
          {results.map((product) => (
            <button
              key={`${product.brand}-${product.name}`}
              type="button"
              onClick={() => handleSelect(product)}
              data-testid="seed-result-item"
              className="flex w-full items-start gap-3 border-b border-line-soft px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-cat-soft"
            >
              <div className="flex-1 min-w-0">
                <div className="truncate text-[13.5px] font-bold text-ink">{product.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-3">
                  <span className="rounded bg-cat-soft px-1.5 py-0.5 font-bold text-cart">
                    {product.brand}
                  </span>
                  <span>📦 {product.weight}</span>
                  <span className="font-mono opacity-70">{product.categorySlug}</span>
                  {product.barcode && <span className="font-mono opacity-70">🔢 {product.barcode}</span>}
                </div>
              </div>
            </button>
          ))}
          {!loading && results.length > 0 && (
            <div className="border-t border-line-soft px-3 py-1.5 text-[11px] text-ink-4">
              {results.length} sonuç · Enter ile ilkini seç · Esc ile kapat
            </div>
          )}
        </div>
      )}
    </div>
  );
}
