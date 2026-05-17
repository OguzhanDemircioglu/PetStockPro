'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Props {
  /** Mevcut filter aktif mi? URL'de lat+lng var ise. */
  active: boolean;
  /** Aktifse: km cinsinden radius (default 25). */
  currentRadiusKm?: number;
  /** Aktifse: yaklaşık konum text'i (gösterim için). */
  currentLabel?: string;
}

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export function NearbyToggle({ active, currentRadiusKm = 25, currentLabel }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>('');
  const [selectedRadius, setSelectedRadius] = useState<number>(currentRadiusKm);

  const requestLocation = (radius: number) => {
    if (!('geolocation' in navigator)) {
      setStatus('✕ Tarayıcı konum desteklemiyor');
      return;
    }
    setStatus('📍 Konum alınıyor...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const next = new URLSearchParams(params.toString());
        next.set('lat', lat);
        next.set('lng', lng);
        next.set('r', String(radius));
        next.delete('page'); // konum değişti → sayfa 1
        next.delete('city'); // konum yakınlık şehirden öncelikli, çakışmasın
        setStatus(`✓ Konum alındı, yakındakiler listeleniyor`);
        startTransition(() => {
          router.push(`${pathname}?${next.toString()}` as never);
        });
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: '✕ Konum izni reddedildi',
          2: '✕ Konum alınamadı',
          3: '✕ Konum zaman aşımı',
        };
        setStatus(msgs[err.code] ?? `✕ ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const clear = () => {
    const next = new URLSearchParams(params.toString());
    next.delete('lat');
    next.delete('lng');
    next.delete('r');
    next.delete('page');
    setStatus('');
    startTransition(() => {
      const str = next.toString();
      router.push(`${pathname}${str ? `?${str}` : ''}` as never);
    });
  };

  return (
    <section
      data-testid="nearby-toggle"
      data-nearby-active={active ? '1' : '0'}
      className="rounded-2xl border border-line bg-paper p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-cat">
            📍 Yakındakileri göster
          </h2>
          <p className="mt-1 text-[11px] text-ink-3">
            {active && currentLabel
              ? `Mevcut: ${currentLabel} · ${currentRadiusKm}km yarıçap`
              : 'Konum izni verirsen mesafeye göre sıralanır (KVKK: koordinatın sunucuda saklanmaz)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {active ? (
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              data-testid="nearby-clear"
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-[11.5px] font-bold text-ink-3 hover:bg-line-soft disabled:opacity-50"
            >
              × Temizle
            </button>
          ) : (
            <button
              type="button"
              onClick={() => requestLocation(selectedRadius)}
              disabled={pending}
              data-testid="nearby-detect"
              className="rounded-xl bg-cat px-3 py-1.5 text-[11.5px] font-bold text-white shadow-sm hover:bg-cat-2 disabled:opacity-50"
            >
              📡 Konumumu paylaş
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
          Yarıçap:
        </span>
        {RADIUS_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setSelectedRadius(r);
              if (active) {
                // Mevcut konum varsa, sadece radius'u güncelle (yeniden lat/lng iste değil)
                const next = new URLSearchParams(params.toString());
                next.set('r', String(r));
                next.delete('page');
                startTransition(() => {
                  router.push(`${pathname}?${next.toString()}` as never);
                });
              } else {
                requestLocation(r);
              }
            }}
            data-radius={r}
            aria-pressed={selectedRadius === r}
            className={
              selectedRadius === r
                ? 'rounded-full bg-cat px-2.5 py-1 text-[10.5px] font-bold text-white'
                : 'rounded-full border border-line bg-paper px-2.5 py-1 text-[10.5px] font-bold text-ink-3 hover:bg-line-soft'
            }
          >
            {r}km
          </button>
        ))}
      </div>
      {status && (
        <p
          data-testid="nearby-status"
          className={`mt-2 text-[11px] ${
            status.startsWith('✓')
              ? 'text-arrow-7'
              : status.startsWith('✕')
                ? 'text-danger-7'
                : 'text-ink-3'
          }`}
        >
          {status}
        </p>
      )}
    </section>
  );
}
