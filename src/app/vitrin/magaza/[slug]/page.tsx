import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { db } from '@/lib/db/client';
import {
  buildWhatsappLink,
  getStorefrontBySlug,
  listStorefrontProducts,
} from '@/lib/vitrin/public';
import { trackVitrinEventAsync } from '@/lib/vitrin/track';
import { FeedbackBalloon } from './feedback-balloon';
import { WhatsappLinkScript } from './whatsapp-link-script';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sf = await getStorefrontBySlug(slug, db);
  if (!sf) return { title: 'Pet shop bulunamadı — PetStockPro Vitrin' };
  return {
    title: `${sf.name} — ${sf.cityName ?? 'Türkiye'} | PetStockPro Vitrin`,
    description:
      sf.metaDescription ??
      sf.aboutContent?.slice(0, 160) ??
      `${sf.name} pet shop'unun PetStockPro vitrin profili. WhatsApp ile direkt iletişim.`,
  };
}

export default async function StorefrontProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sf = await getStorefrontBySlug(slug, db);
  if (!sf) notFound();

  const products = await listStorefrontProducts(sf.companyId, db, 48);

  // KVKK anonim tracking — profile_view + product_view (ilk 5 ürün listelendi)
  const hdrs = await headers();
  const xff = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip');
  const ip = xff ? xff.split(',')[0].trim() : undefined;
  const ua = hdrs.get('user-agent') ?? undefined;
  const referrer = hdrs.get('referer') ?? undefined;

  trackVitrinEventAsync(
    {
      companyId: sf.companyId,
      eventType: 'profile_view',
      ipAddress: ip,
      userAgent: ua,
      referrerUrl: referrer,
    },
    db,
  );

  const waPhone = sf.contactWhatsapp ?? sf.companyWhatsapp;
  const whatsappUrl = buildWhatsappLink(
    waPhone,
    `Merhaba ${sf.name}, vitrin'den size yazıyorum.`,
  );

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <Link
        href={'/vitrin' as never}
        className="text-xs font-bold text-cat hover:underline"
        data-testid="back-link"
      >
        ← Tüm pet shop&apos;lar
      </Link>

      <section
        className="rounded-3xl bg-gradient-to-br from-cat-soft/40 to-arrow-soft/30 p-6 lg:p-8"
        data-testid="storefront-hero"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-cart" data-storefront-name>
              {sf.name}
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              📍{' '}
              {[sf.districtName, sf.cityName].filter(Boolean).join(', ') ||
                'Konum belirtilmemiş'}
            </p>
          </div>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer noopener"
              data-testid="hero-whatsapp"
              className="rounded-xl bg-arrow px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-arrow-7 transition-colors"
            >
              💬 WhatsApp ile yaz
            </a>
          )}
        </div>

        {sf.aboutContent && (
          <article
            className="mt-5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2"
            data-testid="storefront-about"
          >
            {sf.aboutContent}
          </article>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="contact-grid">
        {(sf.contactPhone || sf.companyWhatsapp) && (
          <ContactCard
            emoji="📞"
            label="Telefon"
            value={sf.contactPhone ?? sf.companyWhatsapp}
            href={
              sf.contactPhone
                ? `tel:${sf.contactPhone.replace(/[^\d+]/g, '')}`
                : undefined
            }
          />
        )}
        {waPhone && whatsappUrl && (
          <ContactCard
            emoji="💬"
            label="WhatsApp"
            value={waPhone}
            href={whatsappUrl}
          />
        )}
        {sf.contactTelegram && (
          <ContactCard
            emoji="✈️"
            label="Telegram"
            value={`@${sf.contactTelegram.replace(/^@/, '')}`}
            href={`https://t.me/${sf.contactTelegram.replace(/^@/, '')}`}
          />
        )}
        {sf.contactEmail && (
          <ContactCard
            emoji="✉️"
            label="E-posta"
            value={sf.contactEmail}
            href={`mailto:${sf.contactEmail}`}
          />
        )}
        {sf.socialInstagram && (
          <ContactCard
            emoji="📷"
            label="Instagram"
            value={`@${sf.socialInstagram.replace(/^@/, '')}`}
            href={`https://instagram.com/${sf.socialInstagram.replace(/^@/, '')}`}
          />
        )}
        {sf.socialFacebook && (
          <ContactCard
            emoji="📘"
            label="Facebook"
            value={sf.socialFacebook}
            href={`https://facebook.com/${sf.socialFacebook}`}
          />
        )}
      </section>

      <section data-testid="products-section">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-3">
          🛍 Vitrin&apos;deki ürünler ({products.length})
        </h2>
        {products.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-white py-12 text-center">
            <div className="text-5xl">🐾</div>
            <p className="mt-4 text-sm text-ink-3">
              Bu pet shop henüz vitrin&apos;e ürün eklemedi.
            </p>
            <p className="mt-1 text-[12px] text-ink-4">
              Stoğunda olan ürünleri WhatsApp&apos;tan sorabilirsin.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <li
                key={p.productId}
                data-product-id={p.productId}
                data-product-slug={p.slug}
              >
                <Link
                  href={`/vitrin/magaza/${sf.slug}/urun/${p.slug}` as never}
                  className="flex h-full flex-col rounded-2xl border border-line bg-white p-4 hover:border-cat hover:shadow-md transition-all"
                >
                  <h3 className="text-sm font-bold text-cart">{p.productName}</h3>
                  {p.defaultVariantLabel && (
                    <p className="text-[10.5px] text-ink-3">
                      {p.defaultVariantLabel}
                    </p>
                  )}
                  {p.defaultSalePrice && Number(p.defaultSalePrice) > 0 && (
                    <p className="mt-2 font-mono text-base font-bold text-cart">
                      {Number(p.defaultSalePrice).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      ₺
                    </p>
                  )}
                  <span className="mt-auto pt-2 text-[10.5px] font-bold text-cat">
                    Detayı gör →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-2xl border border-line bg-paper p-4 text-[11.5px] leading-relaxed text-ink-3">
        ⚖️ <strong>PetStockPro</strong> sadece pet shop&apos;ların iletişim
        bilgilerini listeler. Sipariş, ödeme veya kargo bizimle değil, doğrudan
        pet shop ile yapılır. Sorunlu deneyimleri{' '}
        <Link
          href={'/vitrin' as never}
          className="text-cat underline hover:text-cart"
        >
          bize bildir
        </Link>{' '}
        — moderation Sprint 12 ext.
      </p>

      <WhatsappLinkScript />
      <FeedbackBalloon companyId={sf.companyId} companySlug={sf.slug} />
    </main>
  );
}

function ContactCard({
  emoji,
  label,
  value,
  href,
}: {
  emoji: string;
  label: string;
  value: string | null;
  href?: string;
}) {
  if (!value) return null;
  const inner = (
    <article className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 hover:border-cat hover:shadow-sm transition-all">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-cat-soft text-lg">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
          {label}
        </span>
        <span className="truncate text-[12.5px] font-bold text-cart">
          {value}
        </span>
      </div>
    </article>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" data-contact={label}>
        {inner}
      </a>
    );
  }
  return <div data-contact={label}>{inner}</div>;
}
