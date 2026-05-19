'use client';

import { useActionState, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SeedCatalogAutocomplete } from '@/components/products/seed-catalog-autocomplete';
import type { SearchResult } from '@/lib/catalog/seed-catalog';
import { createProductAction, type CreateProductState } from './actions';

interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
  slug: string;
}

interface BrandOption {
  id: string;
  name: string;
}

interface ProductFormProps {
  categories: CategoryOption[];
  brands: BrandOption[];
  /** R2 public base URL — server'dan prop olarak gelir (NEXT_PUBLIC_ duplicate gerek yok). */
  r2PublicUrl: string;
}

/**
 * SKU önerisi üret — `<BRAND>-<NAME>-<WEIGHT>` format'ında, max 24 char.
 * Marka 1-4 harfli kısaltma (kelime başlarından), name ilk anlamlı kelime (3-4 harf),
 * weight cleanup (boşluksuz, büyük harf).
 */
function suggestSku(brand: string, name: string, weight: string): string {
  const brandAbbr =
    brand
      .split(/\s+/)
      .map((w) => w[0])
      .filter((c) => /[a-zA-Z]/.test(c ?? ''))
      .join('')
      .toUpperCase()
      .slice(0, 4) || 'GEN';

  const brandLower = brand.toLowerCase();
  const nameTokens = name
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, ''))
    .filter((w) => w.length >= 3 && !brandLower.split(/\s+/).includes(w.toLowerCase()));
  const namePart = (nameTokens[0] ?? 'STD').toUpperCase().slice(0, 4);

  const weightAbbr = weight.replace(/\s+/g, '').toUpperCase().slice(0, 4) || 'STD';

  return `${brandAbbr}-${namePart}-${weightAbbr}`;
}

/**
 * Yeni Ürün Form — Sprint 3.0 minimal + Sprint E seed katalog autocomplete.
 */
export function ProductForm({ categories, brands, r2PublicUrl }: ProductFormProps) {
  const [state, formAction, pending] = useActionState<CreateProductState | null, FormData>(
    createProductAction,
    null,
  );

  // Controlled state — autocomplete prefill için
  const [name, setName] = useState(state?.formValues.name ?? '');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>(state?.formValues.categoryId ?? '');
  const [brandId, setBrandId] = useState<string>('');
  const [valueLabel, setValueLabel] = useState('Standart');
  const [sku, setSku] = useState<string>(state?.formValues.sku ?? '');
  const [barcode, setBarcode] = useState('');
  const [salePrice, setSalePrice] = useState(state?.formValues.salePrice ?? '');
  const [missingBrandHint, setMissingBrandHint] = useState<string | null>(null);
  const [catalogBrand, setCatalogBrand] = useState<string>(''); // auto-create için
  const [seedImagePath, setSeedImagePath] = useState<string>('');
  const [seedImagePreviewName, setSeedImagePreviewName] = useState<string | null>(null);

  // Manuel görsel upload — variant section'da file input
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageFromCatalog, setImageFromCatalog] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  // Object URL revoke — sadece blob: URL'ler için (R2 https URL'leri revoke etme)
  const revokeIfBlob = (url: string | null) => {
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) {
      revokeIfBlob(imagePreview);
      setImagePreview(null);
      setImageName(null);
      setImageFromCatalog(false);
      return;
    }
    if (file.size > MAX_SIZE) {
      setImageError(`Dosya 5MB'i geçemez (gönderilen: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      e.target.value = '';
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError('Sadece JPG, PNG veya WebP yükleyebilirsin');
      e.target.value = '';
      return;
    }
    revokeIfBlob(imagePreview);
    setImagePreview(URL.createObjectURL(file));
    setImageName(file.name);
    // Manuel değişiklik — catalog override (yeni dosya manuel kabul edilir, seedImagePath ignore)
    setImageFromCatalog(false);
    setSeedImagePath(''); // server fallback'i de devre dışı bırak
  };

  /**
   * Catalog'tan seçilen görseli UI'da "dosya seçilmiş" gibi göster.
   *
   * NOT: r2.dev public URL preflight CORS desteklemiyor, browser tarafında
   * fetch fail eder. Bu yüzden gerçek File object inject yerine MOCK state:
   * - preview thumb: R2 public URL (img src — CORS gerek yok)
   * - imageName: catalog ürün adı
   * - file input boş kalır
   * Submit'te server seedImagePath'i okur + transferSeedImageToProduct ile
   * R2'den R2'ye direkt server-side kopyalar (CORS yok, sunucu fetch).
   * Kullanıcı dosya seçerse override (manuel yol öncelikli).
   */
  const showCatalogImageAsSelected = (
    imagePath: string,
    productNameForFileName: string,
  ): void => {
    if (!r2PublicUrl) return;
    const url = `${r2PublicUrl}/${imagePath}`;
    const ext = (imagePath.match(/\.(\w+)$/)?.[1] ?? 'webp').toLowerCase();
    const safeName =
      productNameForFileName
        .replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 60) || 'catalog';

    // Önceki manuel preview'ı temizle
    if (imagePreview && !imageFromCatalog) URL.revokeObjectURL(imagePreview);

    setImagePreview(url); // R2 public URL — img src'e direkt verilir
    setImageName(`${safeName}.${ext}`);
    setImageFromCatalog(true);
    setImageError(null);
    // file input'u temizle (kullanıcı isterse seçer)
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Marka / kategori case-insensitive eşleşmesi için preset
  const brandByName = useMemo(() => {
    const m = new Map<string, BrandOption>();
    for (const b of brands) m.set(b.name.toLowerCase(), b);
    return m;
  }, [brands]);

  const categoryBySlug = useMemo(() => {
    const m = new Map<string, CategoryOption>();
    for (const c of categories) m.set(c.slug, c);
    return m;
  }, [categories]);

  const handleSelectSeedProduct = (product: SearchResult) => {
    setName(product.name);
    setValueLabel(product.weight || 'Standart');
    if (product.barcode) setBarcode(product.barcode);
    if (product.description) setDescription(product.description);

    // Marka match — yoksa catalogBrand hidden input ile auto-create yapılır
    const brandMatch = brandByName.get(product.brand.toLowerCase());
    if (brandMatch) {
      setBrandId(brandMatch.id);
      setMissingBrandHint(null);
      setCatalogBrand('');
    } else {
      setBrandId('');
      setMissingBrandHint(product.brand);
      setCatalogBrand(product.brand); // server action otomatik oluşturacak
    }

    // Kategori match
    const catMatch = categoryBySlug.get(product.categorySlug);
    if (catMatch) setCategoryId(catMatch.id);

    // SKU önerisi (kullanıcı boşsa override etme)
    if (!sku.trim()) {
      setSku(suggestSku(product.brand, product.name, product.weight));
    }

    // Seed katalog görseli — UI'da "dosya seçilmiş" gibi göster, server seedImagePath'i kullanır
    if (product.imagePath) {
      setSeedImagePath(product.imagePath);
      setSeedImagePreviewName(`${product.brand} ${product.name}`.slice(0, 60));
      showCatalogImageAsSelected(product.imagePath, `${product.brand}-${product.name}`);
    } else {
      setSeedImagePath('');
      setSeedImagePreviewName(null);
      // Eğer önceki seçimden catalog görsel kalıntısı varsa temizle
      if (imageFromCatalog) {
        setImagePreview(null);
        setImageName(null);
        setImageFromCatalog(false);
      }
    }
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/products' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Ürünlere dön
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Yeni ürün
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Yeni ürün ekle
        </h1>
      </header>

      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
        >
          {state.error}
          {state.issues.length > 1 && (
            <ul className="mt-2 list-inside list-disc text-xs font-normal">
              {state.issues.slice(1).map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Seed catalog autocomplete (form üstünde, opsiyonel) */}
      <section className="rounded-2xl border border-cat/30 bg-cat-soft/30 p-5">
        <SeedCatalogAutocomplete onSelect={handleSelectSeedProduct} disabled={pending} />
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
          Seçtiğin ürünün adı, ağırlığı, barkodu, açıklaması ve SKU önerisi forma
          dolar. Marka tenant&apos;ında varsa otomatik seçilir; yoksa önce marka
          olarak eklemen önerilir.
        </p>
        {missingBrandHint && (
          <div
            role="status"
            data-testid="auto-brand-hint"
            className="mt-3 flex items-center gap-2 rounded-xl border border-arrow/30 bg-arrow-soft/40 px-3 py-2 text-[12.5px] font-bold text-arrow-7"
          >
            <span>
              🆕 &quot;{missingBrandHint}&quot; markası tenant&apos;ında yok —{' '}
              <span className="font-normal">kayıtta otomatik oluşturulacak.</span>
            </span>
          </div>
        )}

      </section>

      <form action={formAction} className="flex flex-col gap-6">
        {/* Seed katalog imagePath — autocomplete onSelect ile set edilir, server'da transfer */}
        <input type="hidden" name="seedImagePath" value={seedImagePath} />
        {/* Catalog brand string — tenant'ta yoksa server action otomatik oluşturur */}
        <input type="hidden" name="catalogBrand" value={catalogBrand} />

        {/* TEMEL BİLGİLER */}
        <section className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-lg font-bold text-cart">📦 Temel bilgiler</h2>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="name"
              >
                Ürün adı *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Royal Canin Adult Kedi Maması"
                required
                disabled={pending}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="description"
              >
                Açıklama
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Ürün hakkında kısa bilgi (vitrin'de gösterilir, opsiyonel)"
                disabled={pending}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="categoryId"
                >
                  Kategori
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  disabled={pending}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                >
                  <option value="">— Seç (opsiyonel) —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="brandId"
                >
                  Marka
                </label>
                <select
                  id="brandId"
                  name="brandId"
                  disabled={pending || brands.length === 0}
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                >
                  <option value="">
                    {brands.length === 0 ? 'Henüz marka yok' : '— Seç (opsiyonel) —'}
                  </option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* VARIANT BİLGİLERİ */}
        <section className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-lg font-bold text-cart">🏷 Stok birimi</h2>
          <p className="mt-1 text-xs text-ink-3">
            İlk variant otomatik default olarak işaretlenir. Sprint 3.1&apos;de birden fazla
            variant (400g/2kg/10kg) eklenebilir.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="valueLabel"
                >
                  Boyut / ambalaj
                </label>
                <input
                  id="valueLabel"
                  name="valueLabel"
                  type="text"
                  placeholder="2kg / Standart / Büyük boy"
                  disabled={pending}
                  value={valueLabel}
                  onChange={(e) => setValueLabel(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="sku"
                >
                  SKU *
                </label>
                <input
                  id="sku"
                  name="sku"
                  type="text"
                  placeholder="RC-AD-KEDI-2KG"
                  required
                  disabled={pending}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>
            </div>

            <div>
              <label
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="barcode"
              >
                Barkod (opsiyonel)
              </label>
              <input
                id="barcode"
                name="barcode"
                type="text"
                placeholder="3033xxxxxxxxx (EAN-13)"
                disabled={pending}
                maxLength={13}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="costPrice"
                >
                  Alış fiyatı (₺)
                </label>
                <input
                  id="costPrice"
                  name="costPrice"
                  type="text"
                  inputMode="decimal"
                  placeholder="120"
                  disabled={pending}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="salePrice"
                >
                  Satış fiyatı (₺) *
                </label>
                <input
                  id="salePrice"
                  name="salePrice"
                  type="text"
                  inputMode="decimal"
                  placeholder="180"
                  required
                  disabled={pending}
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-cat bg-paper px-4 py-3 font-mono text-sm font-bold text-cart focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="threshold"
                >
                  Düşük stok eşiği
                </label>
                <input
                  id="threshold"
                  name="threshold"
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={5}
                  disabled={pending}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>
            </div>

            {/* Ürün görseli — opsiyonel, catalog seçimini override eder */}
            <div className="border-t border-line pt-4">
              <label
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="productImage"
              >
                📷 Ürün görseli (opsiyonel)
              </label>

              <input
                ref={fileInputRef}
                id="productImage"
                name="productImage"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={handleImageChange}
                data-testid="product-image-input"
                className="block w-full text-sm text-ink-3 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cat-soft file:px-4 file:py-2 file:text-sm file:font-bold file:text-cat-7 hover:file:bg-cat/20 disabled:opacity-60"
              />
              <p className="mt-1.5 text-xs text-ink-3">
                JPG / PNG / WebP — max 5 MB.
                {imageFromCatalog && (
                  <span
                    data-testid="catalog-image-note"
                    className="ml-1 font-bold text-arrow-7"
                  >
                    Katalogtan otomatik geldi — değiştirmek için yeni dosya seç.
                  </span>
                )}
              </p>
              {imageError && (
                <p
                  role="alert"
                  data-testid="image-error"
                  className="mt-1.5 text-xs font-bold text-danger-7"
                >
                  ✕ {imageError}
                </p>
              )}
              {imagePreview && (
                <div
                  data-testid="image-preview"
                  className="mt-3 flex items-center gap-3 rounded-xl border border-cat/30 bg-cat-soft/30 p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Yüklenecek görsel önizleme"
                    className="h-20 w-20 rounded-lg object-cover ring-1 ring-line"
                  />
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-cart">{imageName}</div>
                    <div className="text-ink-3">Önizleme — kayıtta R2&apos;ye yüklenecek</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {pending ? 'Kaydediliyor...' : 'Ürünü kaydet'}
          </button>
          <Link
            href={'/admin/products' as never}
            className="rounded-xl border border-line bg-paper px-6 py-3.5 text-sm font-bold text-ink-3 hover:bg-line-soft"
          >
            Vazgeç
          </Link>
        </div>
      </form>
    </main>
  );
}
