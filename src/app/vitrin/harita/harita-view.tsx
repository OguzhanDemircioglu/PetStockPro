'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { HaritaShopPoint } from '@/components/vitrin/harita-map';

// Leaflet SSR-incompatible — client-only dinamik import
const HaritaMap = dynamic(() => import('@/components/vitrin/harita-map'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-line-soft">
      <div className="text-center">
        <div className="text-2xl">🗺</div>
        <p className="mt-2 text-xs text-ink-3">Harita yükleniyor…</p>
      </div>
    </div>
  ),
});

interface Props {
  shops: HaritaShopPoint[];
}

function buildWhatsappLink(phone: string | null, shopName: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const e164 = digits.startsWith('90') ? digits : `90${digits.replace(/^0/, '')}`;
  const msg = encodeURIComponent(`Merhaba, ${shopName} vitrini üzerinden ulaşıyorum. `);
  return `https://wa.me/${e164}?text=${msg}`;
}

export function HaritaView({ shops }: Props) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selected = selectedSlug ? shops.find((s) => s.slug === selectedSlug) : null;

  return (
    <div className="relative flex h-[calc(100vh-72px)] flex-col">
      <div className="flex-1 overflow-hidden">
        <HaritaMap
          shops={shops}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
        />
      </div>

      {/* Alt kart — marker tıklayınca slide-up */}
      {selected && (
        <div
          data-testid="harita-selected-card"
          className="absolute inset-x-3 bottom-3 z-[400] mx-auto max-w-2xl rounded-2xl border border-line bg-paper p-4 shadow-[0_18px_40px_rgba(0,0,0,.22)] sm:inset-x-6 sm:p-5"
          style={{ animation: 'slide-up-card 0.3s ease-out' }}
        >
          <div className="flex items-start gap-3">
            <div
              aria-hidden
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cat-soft text-2xl"
            >
              📍
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[17px] font-bold tracking-tight text-cart">
                    {selected.name}
                  </h3>
                  {(selected.cityName || selected.districtName) && (
                    <p className="mt-0.5 text-[13px] text-ink-3">
                      📍 {[selected.cityName, selected.districtName].filter(Boolean).join(' / ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSlug(null)}
                  aria-label="Kapat"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-ink-3 hover:border-danger/40 hover:bg-danger-soft hover:text-danger-7"
                >
                  ✕
                </button>
              </div>

              {selected.aboutShort && (
                <p className="mt-2 line-clamp-2 text-[13px] text-ink-2">
                  {selected.aboutShort}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/vitrin/magaza/${selected.slug}` as never}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:-translate-y-px transition-transform"
                >
                  Mağazaya git →
                </Link>
                {(() => {
                  const wa = buildWhatsappLink(selected.whatsappPhone, selected.name);
                  if (!wa) return null;
                  return (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#25d366] px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:-translate-y-px transition-transform"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                      </svg>
                      Satıcıya sor
                    </a>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty hint — hiç pet shop yoksa */}
      {shops.length === 0 && (
        <div className="absolute inset-x-3 top-3 z-[400] mx-auto max-w-md rounded-xl border border-line bg-paper/95 px-4 py-3 text-center text-[13px] text-ink-3 backdrop-blur">
          🗺 Henüz konum paylaşan pet shop yok.{' '}
          <Link href={'/vitrin' as never} className="font-bold text-cat hover:underline">
            Listeye dön →
          </Link>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up-card {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
