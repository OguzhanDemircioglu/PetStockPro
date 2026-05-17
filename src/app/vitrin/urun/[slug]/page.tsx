import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import { getCrossTenantProduct } from '@/lib/vitrin/cross-tenant-product';
import { buildWhatsappLink } from '@/lib/vitrin/public';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCrossTenantProduct(slug, db);
  if (!data) {
    return { title: 'Ürün bulunamadı — PetStockPro Vitrin' };
  }
  const prices = data.offers
    .map((o) => (o.minSalePrice ? Number(o.minSalePrice) : null))
    .filter((p): p is number => p !== null && p > 0);
  const lowPrice = prices.length > 0 ? Math.min(...prices) : null;
  return {
    title: `${data.meta.productName} — Fiyat kıyasla | PetStockPro Vitrin`,
    description:
      data.meta.description?.slice(0, 160) ??
      `${data.meta.productName}${
        lowPrice ? ` (${data.offers.length} pet shop'tan ${lowPrice}₺'den)` : ''
      } — fiyat karşılaştır, WhatsApp ile direkt iletişim.`,
  };
}

export default async function CrossTenantProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCrossTenantProduct(slug, db);
  if (!data) notFound();

  const { meta, offers } = data;

  const validPrices = offers
    .map((o) => (o.minSalePrice ? Number(o.minSalePrice) : null))
    .filter((p): p is number => p !== null && p > 0);
  const lowest = validPrices.length > 0 ? Math.min(...validPrices) : null;
  const highest = validPrices.length > 0 ? Math.max(...validPrices) : null;

  return (
    <main
      className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8"
      data-testid="cross-tenant-product-page"
    >
      <nav
        aria-label="breadcrumb"
        className="flex flex-wrap gap-2 text-[13px] text-ink-3"
      >
        <Link href={'/vitrin' as never} className="hover:text-cart">
          Vitrin
        </Link>
        {meta.categorySlug && meta.categoryName && (
          <>
            <span aria-hidden>›</span>
            <Link
              href={`/vitrin/kategori/${meta.categorySlug}` as never}
              className="hover:text-cart"
            >
              {meta.categoryName}
            </Link>
          </>
        )}
        <span aria-hidden>›</span>
        <span className="text-cart font-bold" data-product-slug={meta.slug}>
          {meta.productName}
        </span>
      </nav>

      <section
        className="rounded-3xl bg-gradient-to-br from-cat-soft/30 to-arrow-soft/20 p-6 lg:p-8"
        data-testid="product-hero"
      >
        <p className="text-[13px] font-bold uppercase tracking-wider text-cat">
          🛍 {offers.length} pet shop&apos;ta satışta
        </p>
        <h1
          className="mt-1 text-3xl font-bold tracking-tight text-cart"
          data-product-name
        >
          {meta.productName}
        </h1>
        <div className="mt-2 flex flex-wrap gap-3 text-[13.5px] text-ink-2">
          {meta.brandName && (
            <span>
              🏷 <strong>{meta.brandName}</strong>
            </span>
          )}
          {meta.categoryName && (
            <span>
              📂 <strong>{meta.categoryName}</strong>
            </span>
          )}
        </div>
        {lowest !== null && highest !== null && (
          <p
            className="mt-3 font-mono text-2xl font-bold text-cart"
            data-testid="price-range-summary"
          >
            {lowest === highest
              ? `${lowest.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`
              : `${lowest.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺ — ${highest.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`}
            <span className="ml-2 text-[13.5px] font-normal text-ink-3">
              fiyat aralığı
            </span>
          </p>
        )}
      </section>

      {meta.description && (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wider text-ink-3">
            📝 Açıklama
          </h2>
          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-2">
            {meta.description}
          </p>
        </section>
      )}

      <section
        className="rounded-2xl border border-line bg-paper"
        data-testid="offers-list"
      >
        <header className="border-b border-line-soft px-5 py-3">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-ink-3">
            🐾 Hangi pet shop&apos;tan? ({offers.length})
          </h2>
          <p className="mt-1 text-[12.5px] text-ink-3">
            En düşük fiyatlı pet shop&apos;tan başlanır. Stok bilgisi sayım
            anına göre — kesin teyit için WhatsApp&apos;tan sor.
          </p>
        </header>
        <ul className="divide-y divide-line-soft">
          {offers.map((offer, i) => {
            const minPrice = offer.minSalePrice
              ? Number(offer.minSalePrice)
              : null;
            const maxPrice = offer.maxSalePrice
              ? Number(offer.maxSalePrice)
              : null;
            const phone = offer.contactWhatsapp ?? offer.companyWhatsapp;
            const askMessage = `Merhaba ${offer.companyName}, vitrin'de ${meta.productName} ürününüzü gördüm — stoğunuzda var mı?`;
            const whatsappUrl = buildWhatsappLink(phone, askMessage);
            const isCheapest = i === 0 && minPrice !== null;
            return (
              <li
                key={offer.companyId}
                data-offer-company={offer.companyId}
                data-min-price={minPrice ?? ''}
                className="flex flex-wrap items-center gap-3 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/vitrin/magaza/${offer.companySlug}` as never}
                      className="truncate text-[15.5px] font-bold text-cart hover:underline"
                    >
                      {offer.companyName}
                    </Link>
                    {isCheapest && (
                      <span
                        data-cheapest-badge
                        className="rounded-full bg-arrow px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white"
                      >
                        En uygun
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-[12.5px] text-ink-3">
                    {(offer.districtName || offer.cityName) && (
                      <span>
                        📍{' '}
                        {[offer.districtName, offer.cityName]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    )}
                    <span>·</span>
                    <span>
                      {offer.variantCount} variant
                      {offer.inStockTotal > 0 ? (
                        <span className="ml-1 text-arrow-7 font-bold">
                          · {offer.inStockTotal} adet stok
                        </span>
                      ) : (
                        <span className="ml-1 text-danger-7 font-bold">
                          · stok için sor
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11.5px] text-ink-4">Fiyat</div>
                  {minPrice !== null && maxPrice !== null ? (
                    <div
                      className="font-mono text-base font-bold text-cart"
                      data-price-min={minPrice}
                      data-price-max={maxPrice}
                    >
                      {minPrice === maxPrice
                        ? `${minPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₺`
                        : `${minPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}—${maxPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺`}
                    </div>
                  ) : (
                    <div className="text-[12.5px] text-ink-4">Sor</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={
                      `/vitrin/magaza/${offer.companySlug}/urun/${offer.productSlug}` as never
                    }
                    data-testid={`offer-detail-${offer.companyId}`}
                    className="rounded-xl border border-line bg-paper px-3 py-2 text-[13px] font-bold text-cart hover:bg-cat-soft"
                  >
                    Detay →
                  </Link>
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      data-testid={`offer-wa-${offer.companyId}`}
                      className="rounded-xl bg-arrow px-3 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-arrow-7"
                    >
                      💬 WhatsApp
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {offers.length === 1 && (
        <section
          className="rounded-2xl border border-line bg-line-soft/30 p-4 text-center text-[13px] text-ink-3"
          data-testid="only-one-offer-note"
        >
          Bu ürünü sadece 1 pet shop satıyor — fiyat kıyaslaması için diğer
          tenantlar da bu ürünü vitrin&apos;e açtığında bu sayfa otomatik
          zenginleşir.
        </section>
      )}
    </main>
  );
}
