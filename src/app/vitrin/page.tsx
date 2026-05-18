import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { db } from '@/lib/db/client';
import {
  listPublicStorefronts,
  type ListStorefrontsFilters,
} from '@/lib/vitrin/public';
import { trackVitrinEventAsync } from '@/lib/vitrin/track';
import { listCategoriesWithStorefrontProducts } from '@/lib/vitrin/category-listings';
import { parseLocationQuery } from '@/lib/vitrin/geolocation';
import {
  getPlatformStats,
  listPopularProducts7d,
  listBestSellers,
} from '@/lib/vitrin/stats';
import { buildVitrinPageMetadata } from '@/lib/vitrin/page-metadata';
import { NearbyToggle } from './nearby-toggle';
import { cities as citiesTable, companies, storefrontSettings } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const metadata = buildVitrinPageMetadata({
  title: 'PetStockPro Vitrin — Yakınındaki pet shop\'tan al',
  description:
    "Türkiye'deki pet shop'lar tek vitrin'de. Mamasını yakınındaki pet shop'tan WhatsApp ile sor, online satış yok — direkt iletişim.",
  path: '/vitrin',
});

interface SearchParams {
  q?: string;
  lat?: string;
  lng?: string;
  r?: string;
}

const TR_NUMBER = new Intl.NumberFormat('tr-TR');
function formatPrice(value: string | null): string | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `${TR_NUMBER.format(num)} ₺`;
}

function formatDistance(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Pet shop'u olan şehirleri pet shop count'una göre listele (top N) */
async function listTopCitiesWithStorefronts(
  topN = 8,
): Promise<
  Array<{ slug: string; name: string; storefrontCount: number; productCount: number }>
> {
  const rows = await db
    .select({
      slug: citiesTable.slug,
      name: citiesTable.name,
      storefrontCount: sql<number>`COUNT(DISTINCT ${companies.id})::int`,
    })
    .from(citiesTable)
    .innerJoin(companies, eq(companies.cityId, citiesTable.id))
    .innerJoin(
      storefrontSettings,
      eq(storefrontSettings.companyId, companies.id),
    )
    .where(
      and(
        eq(companies.storefrontStatus, 'approved'),
        eq(storefrontSettings.isEnabled, true),
      ),
    )
    .groupBy(citiesTable.slug, citiesTable.name)
    .orderBy(sql`COUNT(DISTINCT ${companies.id}) DESC`, citiesTable.name)
    .limit(topN);
  // Şu an productCount city-bazlı subquery yapmadık — sıralama ve grid için
  // sadece storefrontCount yeterli, productCount Faz 2'de eklenebilir.
  return rows.map((r) => ({ ...r, productCount: 0 }));
}

export default async function VitrinHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) ?? '';
  const location = parseLocationQuery(params.lat, params.lng, params.r);

  // Nearby pet shop'lar — konum varsa ona göre, yoksa name_asc top 6
  const nearbyFilters: ListStorefrontsFilters = {
    limit: 6,
    offset: 0,
    sort: 'name_asc',
  };
  if (q) nearbyFilters.q = q;
  if (location) nearbyFilters.location = location;

  const [
    stats,
    nearbyStorefronts,
    popularProducts,
    bestSellers,
    topCities,
    categoryStats,
  ] = await Promise.all([
    getPlatformStats(db),
    listPublicStorefronts(db, nearbyFilters),
    listPopularProducts7d(db, { limit: 8 }),
    listBestSellers(db, { limit: 8, windowDays: 30 }),
    listTopCitiesWithStorefronts(8),
    listCategoriesWithStorefrontProducts(db),
  ]);

  // Search event tracking (q varsa)
  if (q) {
    const hdrs = await headers();
    const xff = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip');
    const ip = xff ? xff.split(',')[0].trim() : undefined;
    const ua = hdrs.get('user-agent') ?? undefined;
    for (const sf of nearbyStorefronts.slice(0, 5)) {
      trackVitrinEventAsync(
        {
          companyId: sf.companyId,
          eventType: 'search',
          searchQuery: q,
          ipAddress: ip,
          userAgent: ua,
        },
        db,
      );
    }
  }

  const totalCategoryCount = categoryStats.reduce(
    (sum, c) => sum + c.productCount,
    0,
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-6 lg:py-10">
      {/* ============ HERO ============ */}
      <section
        data-testid="vitrin-hero"
        className="relative grid items-center gap-8 rounded-3xl bg-gradient-to-br from-cat-soft via-paper to-arrow-soft px-6 py-10 lg:grid-cols-[1.3fr_1fr] lg:px-12 lg:py-16"
      >
        <div>
          <div
            data-testid="vitrin-hero-eye"
            className="mb-3 inline-flex items-center gap-2 rounded-full bg-paper/70 px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-cart shadow-sm"
          >
            <span className="grid h-2 w-2 place-items-center">
              <span className="h-2 w-2 animate-ping rounded-full bg-cat" />
            </span>
            Yakınında {nearbyStorefronts.length} pet shop ·{' '}
            {TR_NUMBER.format(stats.productCount)} ürün canlı
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-cart lg:text-5xl">
            Mamasını <span className="text-cat">yakınındaki</span>
            <br />
            pet shop&apos;tan al<span className="text-arrow">.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] text-ink-2">
            Üye olmadan, ödeme yapmadan, anında.{' '}
            <strong className="text-cart">WhatsApp&apos;tan direkt sahibe yaz</strong>
            , fiyat ve stok karşılaştır, en yakını seç.
          </p>

          {/* Hero search bar — sadece pet shop adı/ürün adı q filter (mevcut listPublicStorefronts) */}
          <form
            method="get"
            action="/vitrin"
            className="mt-6 flex flex-wrap items-stretch gap-2 rounded-2xl bg-paper p-2 shadow-[var(--shadow-cat)]"
            data-testid="vitrin-hero-search"
          >
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={100}
              placeholder="Pet shop adı veya ürün ara..."
              data-testid="vitrin-search-input"
              className="min-w-[180px] flex-1 rounded-xl bg-transparent px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-4 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm hover:-translate-y-px transition-transform"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              Ara
            </button>
          </form>
        </div>

        {/* Hero görsel — logo + floating bilgi kartları */}
        <div className="hidden lg:flex relative h-[280px] items-center justify-center">
          <div
            data-testid="vitrin-hero-logo-card"
            className="absolute z-10 grid h-44 w-44 place-items-center rounded-[28px] bg-paper p-4 shadow-[0_14px_34px_rgba(0,0,0,.14)]"
            style={{ transform: 'rotate(-4deg)' }}
          >
            <Image
              src="/logo.webp"
              alt="PetStockPro"
              width={140}
              height={140}
              className="object-contain"
              priority
            />
          </div>
          <div className="absolute -left-4 top-6 flex items-center gap-2 rounded-2xl bg-paper px-3 py-2 text-[12px] font-bold shadow-[0_8px_20px_rgba(0,0,0,.12)]">
            <span className="text-lg">📦</span>
            <div className="leading-tight">
              <div className="text-[10px] font-normal uppercase tracking-wider text-ink-4">
                Canlı stok
              </div>
              <div className="text-cart">
                {TR_NUMBER.format(stats.productCount)} ürün
              </div>
            </div>
          </div>
          <div className="absolute -right-4 top-20 flex items-center gap-2 rounded-2xl bg-paper px-3 py-2 text-[12px] font-bold shadow-[0_8px_20px_rgba(0,0,0,.12)]">
            <span className="text-lg">📍</span>
            <div className="leading-tight">
              <div className="text-[10px] font-normal uppercase tracking-wider text-ink-4">
                Yakın
              </div>
              <div className="text-cart">{stats.cityCount} şehir</div>
            </div>
          </div>
          <div className="absolute bottom-2 left-12 flex items-center gap-2 rounded-2xl bg-paper px-3 py-2 text-[12px] font-bold shadow-[0_8px_20px_rgba(0,0,0,.12)]">
            <span className="text-lg">💬</span>
            <div className="leading-tight">
              <div className="text-[10px] font-normal uppercase tracking-wider text-ink-4">
                WhatsApp
              </div>
              <div className="text-cart">Anında iletişim</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TRUST STRIP ============ */}
      <section
        data-testid="vitrin-trust-strip"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-cat-soft text-2xl">
            📍
          </span>
          <div>
            <div className="text-[18px] font-bold leading-tight text-cart">
              {stats.cityCount} şehir
            </div>
            <div className="text-[12px] text-ink-3">
              Tüm Türkiye&apos;de pet shop&apos;lar
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-arrow-soft text-2xl">
            🏪
          </span>
          <div>
            <div className="text-[18px] font-bold leading-tight text-cart">
              {TR_NUMBER.format(stats.storefrontCount)} pet shop
            </div>
            <div className="text-[12px] text-ink-3">
              Bağımsız esnaf, eşit görünür
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-cat-soft text-2xl">
            📦
          </span>
          <div>
            <div className="text-[18px] font-bold leading-tight text-cart">
              {TR_NUMBER.format(stats.productCount)} ürün
            </div>
            <div className="text-[12px] text-ink-3">Canlı stok bilgisiyle</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-arrow-soft text-2xl">
            💬
          </span>
          <div>
            <div className="text-[18px] font-bold leading-tight text-cart">
              WhatsApp
            </div>
            <div className="text-[12px] text-ink-3">
              Direkt sahibe yaz, hemen al
            </div>
          </div>
        </div>
      </section>

      {/* ============ YAKINDAKI PET SHOP'LAR (km toggle entegre) ============ */}
      <section data-testid="vitrin-nearby-section">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-cart">
              📍 Yakındaki pet shop&apos;lar
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              {location
                ? `Konumuna göre · en yakın ${nearbyStorefronts.length}`
                : 'Konum iznine göre sıralanır'}
            </p>
          </div>
        </div>

        <NearbyToggle
          active={Boolean(location)}
          currentRadiusKm={location?.radiusKm ?? 25}
        />

        {nearbyStorefronts.length > 0 ? (
          <ul
            data-testid="vitrin-nearby-list"
            className="mt-4 grid gap-3 lg:grid-cols-2"
          >
            {nearbyStorefronts.map((sf) => {
              const distanceLabel = formatDistance(sf.distanceKm);
              return (
                <li
                  key={sf.companyId}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-4 hover:border-cat/40 hover:shadow-[var(--shadow-sm)] transition-all"
                  data-tenant-slug={sf.slug}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cat-soft text-2xl">
                    🐾
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/vitrin/magaza/${sf.slug}` as never}
                      className="block truncate text-[15px] font-bold text-cart hover:underline"
                    >
                      {sf.name}
                    </Link>
                    <div className="mt-0.5 truncate text-[12px] text-ink-3">
                      📍{' '}
                      {sf.districtName
                        ? `${sf.districtName}, ${sf.cityName ?? ''}`
                        : sf.cityName ?? 'Konum belirtilmemiş'}
                    </div>
                    <Link
                      href={`/vitrin/magaza/${sf.slug}` as never}
                      className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-cat hover:underline"
                    >
                      Detay & WhatsApp →
                    </Link>
                  </div>
                  {distanceLabel && (
                    <div className="text-right">
                      <div className="text-[16px] font-bold text-cat">
                        {distanceLabel}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-4">
                        mesafe
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-line bg-paper py-12 text-center">
            <div className="text-4xl">🐾</div>
            <p className="mt-2 text-[13px] text-ink-3">
              Bu kriterlerde pet shop bulunamadı.
            </p>
          </div>
        )}

        {/* Harita (statik SVG mockup — gerçek Leaflet Faz 2) */}
        {nearbyStorefronts.length > 0 && (
          <div
            data-testid="vitrin-nearby-map"
            className="relative mt-4 h-[300px] overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-cat-soft/30 to-arrow-soft/30 shadow-sm"
            aria-label="Yakındaki pet shop'lar haritası (yer tutucu)"
          >
            <svg
              viewBox="0 0 800 300"
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 h-full w-full"
              aria-hidden
            >
              {/* Su + park silüetleri */}
              <path
                d="M0,120 Q160,140 320,100 T640,120 L800,100 L800,180 Q600,210 400,170 T0,180 Z"
                fill="#cad8db"
                opacity=".55"
              />
              <path
                d="M80,30 Q240,20 360,70 Q320,130 200,140 Q120,120 80,70 Z"
                fill="#c8d9c4"
                opacity=".4"
              />
              <path
                d="M520,210 Q680,200 760,260 Q720,290 560,290 Q480,270 520,210 Z"
                fill="#c8d9c4"
                opacity=".4"
              />
              {/* Yollar */}
              <path
                d="M0,180 L800,180 M0,240 L800,240 M240,0 L240,300 M520,0 L520,300"
                stroke="#fff"
                strokeWidth="3"
                opacity=".65"
              />
              <path
                d="M0,90 L800,90 M120,0 L120,300 M680,0 L680,300"
                stroke="#fff"
                strokeWidth="2"
                opacity=".4"
              />
            </svg>

            {/* Pin'ler — nearbyStorefronts'tan dağınık konumlar */}
            <div className="absolute inset-0">
              {/* Kullanıcı konumu (eğer location var) */}
              {location && (
                <div
                  className="absolute"
                  style={{ left: '48%', top: '52%' }}
                  aria-label="Senin konumun"
                >
                  <span className="relative grid h-7 w-7 place-items-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-cat/50" />
                    <span className="relative grid h-7 w-7 place-items-center rounded-full bg-cat text-[12px] text-white shadow-md">
                      📍
                    </span>
                  </span>
                </div>
              )}
              {nearbyStorefronts.slice(0, 8).map((sf, idx) => {
                const positions = [
                  { left: '20%', top: '28%' },
                  { left: '36%', top: '64%' },
                  { left: '62%', top: '38%' },
                  { left: '76%', top: '70%' },
                  { left: '28%', top: '78%' },
                  { left: '82%', top: '22%' },
                  { left: '14%', top: '50%' },
                  { left: '90%', top: '48%' },
                ];
                const pos = positions[idx % positions.length];
                return (
                  <Link
                    key={sf.companyId}
                    href={`/vitrin/magaza/${sf.slug}` as never}
                    title={sf.name}
                    className="absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-paper text-[12px] font-bold text-cart shadow-[0_4px_10px_rgba(0,0,0,.25)] ring-2 ring-cat hover:scale-110 transition-transform"
                    style={pos}
                  >
                    {idx + 1}
                  </Link>
                );
              })}
            </div>

            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-paper/95 px-3 py-1 text-[12px] font-bold text-cart shadow-sm">
              <span className="h-2 w-2 rounded-full bg-cat" aria-hidden />
              {nearbyStorefronts.length} pet shop bu bölgede
            </div>
            <div className="absolute bottom-3 right-3 text-[10.5px] uppercase tracking-wider text-ink-4">
              Yer tutucu harita
            </div>
          </div>
        )}
      </section>

      {/* ============ POPÜLER ÜRÜNLER ============ */}
      {popularProducts.length > 0 && (
        <section data-testid="vitrin-popular-products">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight text-cart">
                🔥 Bu hafta popüler
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-3">
                Son 7 günde en çok bakılan ürünler · cross-mağaza
              </p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popularProducts.map((p) => {
              const price = formatPrice(p.defaultSalePrice);
              return (
                <li
                  key={`${p.companyId}-${p.productId}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper hover:border-cat/40 hover:shadow-[var(--shadow-sm)] transition-all"
                  data-product-id={p.productId}
                >
                  <Link
                    href={
                      `/vitrin/magaza/${p.companySlug}/urun/${p.productSlug}` as never
                    }
                    className="block"
                  >
                    <div className="relative grid h-32 place-items-center bg-gradient-to-br from-cat-soft/40 to-arrow-soft/40 text-5xl">
                      🐾
                      <span className="absolute right-2 top-2 rounded-full bg-paper/95 px-2 py-0.5 text-[10.5px] font-bold text-cat shadow-sm">
                        🔥 {p.viewCount}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-3">
                      <h3 className="line-clamp-2 text-[13.5px] font-bold leading-tight text-cart hover:underline">
                        {p.productName}
                      </h3>
                      <div className="truncate text-[11.5px] text-ink-3">
                        {p.companyName}
                        {p.cityName ? ` · ${p.cityName}` : ''}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        {price ? (
                          <span className="text-[14px] font-bold text-cat">
                            {price}
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-ink-4">
                            Fiyat sor
                          </span>
                        )}
                        <span
                          aria-hidden
                          className="text-[16px]"
                          title="WhatsApp'a git"
                        >
                          💬
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ============ ÇOK SATANLAR (satış-based, son 30 gün) ============ */}
      {bestSellers.length > 0 && (
        <section data-testid="vitrin-best-sellers">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight text-cart">
                🏆 Çok satanlar
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-3">
                Son 30 günde en çok satılan ürünler · gerçek satış · cross-mağaza
              </p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {bestSellers.map((p) => {
              const price = formatPrice(p.defaultSalePrice);
              return (
                <li
                  key={`${p.companyId}-${p.productId}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper hover:border-cat/40 hover:shadow-[var(--shadow-sm)] transition-all"
                  data-product-id={p.productId}
                >
                  <Link
                    href={
                      `/vitrin/magaza/${p.companySlug}/urun/${p.productSlug}` as never
                    }
                    className="block"
                  >
                    <div className="relative grid h-32 place-items-center bg-gradient-to-br from-arrow-soft/40 to-cat-soft/30 text-5xl">
                      🐾
                      <span className="absolute right-2 top-2 rounded-full bg-arrow/90 px-2 py-0.5 text-[10.5px] font-bold text-white shadow-sm">
                        🏆 {TR_NUMBER.format(p.totalSold)} adet
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-3">
                      <h3 className="line-clamp-2 text-[13.5px] font-bold leading-tight text-cart hover:underline">
                        {p.productName}
                      </h3>
                      <div className="truncate text-[11.5px] text-ink-3">
                        {p.companyName}
                        {p.cityName ? ` · ${p.cityName}` : ''}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        {price ? (
                          <span className="text-[14px] font-bold text-cat">
                            {price}
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-ink-4">
                            Fiyat sor
                          </span>
                        )}
                        <span
                          aria-hidden
                          className="text-[16px]"
                          title="WhatsApp'a git"
                        >
                          💬
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ============ ŞEHİR GRID ============ */}
      {topCities.length > 0 && (
        <section data-testid="vitrin-city-grid">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight text-cart">
                Şehir seç
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-3">
                {stats.cityCount} şehirde aktif pet shop&apos;lar
              </p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topCities.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/vitrin/${c.slug}` as never}
                  className="block rounded-2xl border border-line bg-paper p-4 hover:border-cat/40 hover:shadow-[var(--shadow-sm)] transition-all"
                >
                  <div className="text-[16px] font-bold text-cart">{c.name}</div>
                  <div className="mt-0.5 text-[12px] text-ink-3">
                    {TR_NUMBER.format(c.storefrontCount)} pet shop
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ============ KATEGORI ÖZET (chip section, küçük) ============ */}
      {categoryStats.length > 0 && (
        <section data-testid="vitrin-category-chips">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight text-cart">
                🛍 Kategoriler ({categoryStats.length})
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-3">
                Yukarıdaki kategori menüsünden alt kategoriye git veya aşağıdaki
                özetten seç ({totalCategoryCount} ürün)
              </p>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2">
            {categoryStats.slice(0, 12).map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/vitrin/kategori/${cat.slug}` as never}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[12.5px] font-bold text-cart hover:border-cat/40 hover:bg-cat-soft"
                >
                  <span aria-hidden>{cat.emoji}</span>
                  {cat.name}
                  <span className="rounded-full bg-cat-soft px-1.5 py-0.5 text-[10.5px] text-cat">
                    {cat.productCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ============ OWNER CTA ============ */}
      <section
        data-testid="vitrin-owner-cta"
        className="grid items-center gap-4 rounded-3xl bg-gradient-to-br from-cart to-cart-7 px-6 py-8 text-white shadow-[0_8px_24px_rgba(26,85,136,.32)] lg:grid-cols-[1.5fr_1fr] lg:px-12 lg:py-10"
      >
        <div>
          <h2 className="text-[24px] font-bold leading-tight">
            Pet shop sahibi misin?
            <br />
            Vitrin&apos;e ücretsiz katıl.
          </h2>
          <p className="mt-3 max-w-xl text-[14px] opacity-90">
            Stoğunu PetStockPro ile yönet, vitrin&apos;de görünür ol.{' '}
            <strong>FREE plan</strong> ile başla — 50 ürüne kadar tamamen
            ücretsiz.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold">
              ✓ 50 ürün ücretsiz
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold">
              ✓ 3 şube
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold">
              ✓ WhatsApp entegre
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold">
              ✓ Komisyon yok
            </span>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 lg:items-end">
          <Link
            href={'/register' as never}
            className="inline-flex items-center justify-center rounded-2xl bg-cat px-6 py-3 text-[15px] font-bold text-white shadow-[var(--shadow-cat)] hover:bg-cat-2 transition-colors"
          >
            Hemen Başla →
          </Link>
          <span className="text-center text-[11.5px] opacity-75">
            Kredi kartı gerekmez
          </span>
        </div>
      </section>
    </main>
  );
}
