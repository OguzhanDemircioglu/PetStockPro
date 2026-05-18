'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Props {
  /** Mevcut filter aktif mi? URL'de lat+lng var ise. */
  active: boolean;
  /** Aktifse: km cinsinden radius (default 25). */
  currentRadiusKm?: number;
  /** Aktifse: yaklaşık konum text'i (gösterim için). */
  currentLabel?: string;
}

const RADIUS_OPTIONS = [5, 10, 25, 50];

export function NearbyToggle({ active, currentRadiusKm = 25, currentLabel }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>('');
  const [selectedRadius, setSelectedRadius] = useState<number>(currentRadiusKm);
  const autoPromptedRef = useRef(false);
  // Browser geolocation permission state (granted/denied/prompt/null=unknown).
  // 'granted' ise "Konum izni ver" butonu gizlenir, kullanıcının zaten verdiği
  // izni tekrar isteme prompt'u görünmesin.
  const [permState, setPermState] = useState<PermissionState | null>(null);

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
          1: 'ℹ Konum izni vermedin — yakındaki pet shop\'ları görmek için yukarıdaki butonla istediğinde izin verebilirsin',
          2: '✕ Konum alınamadı',
          3: '✕ Konum zaman aşımı',
        };
        setStatus(msgs[err.code] ?? `✕ ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  /**
   * Mount'ta otomatik konum izni iste — Permissions API state-aware:
   *   - granted: sessizce koordinat al + URL'i güncelle (kullanıcıya hiç prompt
   *     çıkmaz, browser zaten izin vermiş)
   *   - prompt: tarayıcı kullanıcıya konum dialog'u gösterir (her ilk girişte)
   *   - denied: atla, kullanıcı browser ayarından reddetmiş — butonla manuel
   *     denerse açık mesaj gösteririz
   *
   * Permissions API eski tarayıcılarda yok → fallback olarak doğrudan request
   * (eski browser'larda da prompt çıkar). React strict mode'da çift mount koruması
   * için autoPromptedRef.
   *
   * SSR-safe: window/navigator check'i useEffect içinde.
   */
  useEffect(() => {
    if (autoPromptedRef.current) return;
    if (active) return; // Zaten aktif: URL'de lat/lng var
    if (typeof window === 'undefined') return;
    if (!('geolocation' in navigator)) return;
    autoPromptedRef.current = true;

    const tryRequest = () => {
      const perms = (navigator as Navigator).permissions;
      if (!perms || typeof perms.query !== 'function') {
        requestLocation(selectedRadius);
        return;
      }
      perms
        .query({ name: 'geolocation' as PermissionName })
        .then((res) => {
          setPermState(res.state);
          // Permission state değişikliklerini de takip et (kullanıcı browser
          // ayarından açıp/kapatınca buton göster/gizle güncellensin)
          try {
            res.onchange = () => setPermState(res.state);
          } catch {
            /* readonly browsers - noop */
          }
          if (res.state === 'denied') return;
          requestLocation(selectedRadius);
        })
        .catch(() => {
          requestLocation(selectedRadius);
        });
    };
    tryRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once
  }, []);

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
          <h2 className="text-[13.5px] font-bold uppercase tracking-wider text-cat">
            📍 Yakındakileri göster
          </h2>
          <p className="mt-1 text-[12.5px] text-ink-3">
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
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-[13px] font-bold text-ink-3 hover:bg-line-soft disabled:opacity-50"
            >
              × Temizle
            </button>
          ) : permState === 'granted' ? (
            // Tarayıcı izni verilmiş ama URL'de henüz lat/lng yok →
            // tekrar prompt çıkarmak yerine sessiz fetch tetikle
            <button
              type="button"
              onClick={() => requestLocation(selectedRadius)}
              disabled={pending}
              data-testid="nearby-refresh"
              className="rounded-xl border border-arrow/40 bg-arrow-soft px-3 py-1.5 text-[13px] font-bold text-arrow-7 hover:bg-arrow hover:text-white disabled:opacity-50"
            >
              ✓ Konumu yenile
            </button>
          ) : (
            <button
              type="button"
              onClick={() => requestLocation(selectedRadius)}
              disabled={pending}
              data-testid="nearby-detect"
              className="rounded-xl bg-cat px-4 py-2 text-[14px] font-bold text-white shadow-sm hover:bg-cat-2 disabled:opacity-50"
            >
              📍 Konum izni ver
            </button>
          )}
        </div>
      </div>
      <div
        className="mt-3 flex flex-wrap items-center gap-1.5"
        data-testid="nearby-radius-row"
        aria-disabled={!active}
      >
        <span
          className={`text-[12px] font-bold uppercase tracking-wider ${
            active ? 'text-ink-3' : 'text-ink-4'
          }`}
        >
          Yarıçap:
        </span>
        {RADIUS_OPTIONS.map((r) => {
          const isSelected = selectedRadius === r;
          const isDisabled = !active || pending;
          return (
            <button
              key={r}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!active) return; // disable guard
                setSelectedRadius(r);
                const next = new URLSearchParams(params.toString());
                next.set('r', String(r));
                next.delete('page');
                startTransition(() => {
                  router.push(`${pathname}?${next.toString()}` as never);
                });
              }}
              data-radius={r}
              aria-pressed={isSelected}
              className={
                isSelected
                  ? `rounded-full bg-cat px-2.5 py-1 text-[12px] font-bold text-white ${
                      isDisabled ? 'cursor-not-allowed opacity-40' : ''
                    }`
                  : `rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] font-bold text-ink-3 ${
                      isDisabled
                        ? 'cursor-not-allowed opacity-40'
                        : 'hover:bg-line-soft'
                    }`
              }
            >
              {r}km
            </button>
          );
        })}
      </div>
      {status && (
        <p
          data-testid="nearby-status"
          className={`mt-2 text-[12.5px] ${
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
