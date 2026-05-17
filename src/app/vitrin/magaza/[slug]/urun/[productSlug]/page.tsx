import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { db } from '@/lib/db/client';
import {
  buildWhatsappLink,
  getStorefrontBySlug,
  getStorefrontProductDetail,
} from '@/lib/vitrin/public';
import { trackVitrinEventAsync } from '@/lib/vitrin/track';
import { buildProductLd, buildLocalBusinessLd } from '@/lib/vitrin/schema-org';
import { getPublicBaseUrl } from '@/lib/vitrin/sitemap-data';
import { FeedbackBalloon } from '../../feedback-balloon';
import { WhatsappLinkScript } from '../../whatsapp-link-script';
import { ReportButton } from '@/app/vitrin/report-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const product = await getStorefrontProductDetail(slug, productSlug, db);
  if (!product) {
    return { title: 'Ürün bulunamadı — PetStockPro Vitrin' };
  }
  const priceList = product.variants
    .map((v) => Number(v.salePrice))
    .filter((p) => p > 0);
  const minPrice = priceList.length > 0 ? Math.min(...priceList) : null;
  return {
    title: `${product.productName} — ${product.companyName} | PetStockPro Vitrin`,
    description:
      product.description?.slice(0, 160) ??
      `${product.productName}${minPrice ? ` (${minPrice}₺ - ${product.companyName})` : ''}`,
  };
}

export default async function VitrinProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const [storefront, product] = await Promise.all([
    getStorefrontBySlug(slug, db),
    getStorefrontProductDetail(slug, productSlug, db),
  ]);
  if (!storefront || !product) notFound();

  const hdrs = await headers();
  const xff = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip');
  const ip = xff ? xff.split(',')[0].trim() : undefined;
  const ua = hdrs.get('user-agent') ?? undefined;
  const referrer = hdrs.get('referer') ?? undefined;

  trackVitrinEventAsync(
    {
      companyId: product.companyId,
      productId: product.productId,
      eventType: 'product_view',
      ipAddress: ip,
      userAgent: ua,
      referrerUrl: referrer,
    },
    db,
  );

  const defaultVariant =
    product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const waPhone = storefront.contactWhatsapp ?? storefront.companyWhatsapp;
  const askMessage = `Merhaba ${storefront.name}, vitrin'de ${product.productName}${
    defaultVariant ? ` (${defaultVariant.valueLabel})` : ''
  } ürününüzü gördüm — stoğunuzda var mı?`;
  const whatsappUrl = buildWhatsappLink(waPhone, askMessage);

  const priceValues = product.variants
    .map((v) => Number(v.salePrice))
    .filter((p) => Number.isFinite(p) && p > 0);
  const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;
  const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : null;
  const inStockCount = product.variants.filter((v) => v.inStock).length;

  const baseUrl = getPublicBaseUrl();
  const productLd = buildProductLd(product, baseUrl);
  const sellerLd = buildLocalBusinessLd(storefront, baseUrl);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <script
        type="application/ld+json"
        data-testid="ld-product"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productLd),
        }}
      />
      <script
        type="application/ld+json"
        data-testid="ld-seller"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(sellerLd),
        }}
      />
      <nav
        aria-label="breadcrumb"
        className="flex flex-wrap gap-2 text-[11.5px] text-ink-3"
      >
        <Link href={'/vitrin' as never} className="hover:text-cart">
          Vitrin
        </Link>
        <span aria-hidden>›</span>
        <Link
          href={`/vitrin/magaza/${storefront.slug}` as never}
          className="hover:text-cart"
        >
          {storefront.name}
        </Link>
        <span aria-hidden>›</span>
        <span className="text-cart font-bold">{product.productName}</span>
        <span aria-hidden>·</span>
        <Link
          href={`/vitrin/urun/${product.slug}` as never}
          className="text-cat hover:underline"
          data-testid="cross-tenant-compare-link"
        >
          🔁 Tüm pet shop&apos;larda fiyatı karşılaştır
        </Link>
      </nav>

      <section
        className="rounded-3xl bg-gradient-to-br from-cat-soft/30 to-arrow-soft/20 p-6 lg:p-8"
        data-testid="product-hero"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
              🐾 {product.companyName}
            </p>
            <h1
              className="mt-1 text-3xl font-bold tracking-tight text-cart"
              data-product-name
            >
              {product.productName}
            </h1>
            <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-ink-3">
              {product.brandName && (
                <span>
                  🏷 <strong className="text-ink-2">{product.brandName}</strong>
                </span>
              )}
              {product.categoryName && (
                <span>
                  📂 <strong className="text-ink-2">{product.categoryName}</strong>
                </span>
              )}
              <span>
                {inStockCount > 0 ? (
                  <span className="text-arrow-7 font-bold">
                    ✓ {inStockCount} variant stokta
                  </span>
                ) : (
                  <span className="text-danger-7 font-bold">
                    ⚠ Stok bilgisi için pet shop ile görüş
                  </span>
                )}
              </span>
            </div>
            {minPrice !== null && (
              <p className="mt-3 font-mono text-2xl font-bold text-cart" data-testid="price-range">
                {minPrice === maxPrice
                  ? minPrice.toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : `${minPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - ${maxPrice!.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                ₺
              </p>
            )}
          </div>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer noopener"
              data-testid="hero-whatsapp"
              className="rounded-xl bg-arrow px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-arrow-7 transition-colors"
            >
              💬 WhatsApp ile sor
            </a>
          )}
        </div>
      </section>

      {product.description && (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
            📝 Açıklama
          </h2>
          <p
            className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2"
            data-testid="product-description"
          >
            {product.description}
          </p>
        </section>
      )}

      <section
        className="rounded-2xl border border-line bg-paper p-5"
        data-testid="variants-section"
      >
        <h2 className="mb-3 text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
          📦 Variant&apos;lar ({product.variants.length})
        </h2>
        <ul className="flex flex-col divide-y divide-line-soft">
          {product.variants.map((v) => {
            const price = Number(v.salePrice);
            return (
              <li
                key={v.variantId}
                data-variant-id={v.variantId}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-cart">{v.valueLabel}</strong>
                    {v.isDefault && (
                      <span className="rounded-full bg-cat-soft px-1.5 py-0.5 text-[9.5px] font-bold text-cart">
                        ★ Varsayılan
                      </span>
                    )}
                    {!v.inStock && (
                      <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[9.5px] font-bold text-danger-7">
                        Stok yok
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[10.5px] text-ink-4">
                    SKU {v.sku}
                  </p>
                </div>
                <div className="text-right">
                  {price > 0 ? (
                    <p className="font-mono text-base font-bold text-cart">
                      {price.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      ₺
                    </p>
                  ) : (
                    <p className="text-[11.5px] text-ink-4">
                      Fiyat için sor
                    </p>
                  )}
                </div>
                {whatsappUrl && (
                  <a
                    href={
                      buildWhatsappLink(
                        waPhone,
                        `Merhaba ${storefront.name}, ${product.productName} (${v.valueLabel}) hakkında soracağım.`,
                      ) ?? whatsappUrl
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-lg border border-arrow/40 bg-paper px-3 py-1.5 text-[10.5px] font-bold text-arrow-7 hover:bg-arrow-soft"
                  >
                    💬 Bu variant&apos;ı sor
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section
        data-testid="product-report-section"
        className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4"
      >
        <p className="text-[11.5px] leading-relaxed text-ink-3">
          {'⚖️ '}
          <strong>PetStockPro</strong>
          {' sadece dizin sağlar. Fiyat, stok ve sipariş için doğrudan '}
          <strong>{product.companyName}</strong>
          {' ile WhatsApp üzerinden görüş. Bilgiler pet shop tarafından güncellenir.'}
        </p>
        <ReportButton
          companyId={product.companyId}
          targetType="product"
          productId={product.productId}
          label="🚩 Bu ürünü bildir (yanlış foto / bilgi)"
        />
      </section>

      <WhatsappLinkScript />
      <FeedbackBalloon
        companyId={product.companyId}
        companySlug={product.companySlug}
      />
    </main>
  );
}
