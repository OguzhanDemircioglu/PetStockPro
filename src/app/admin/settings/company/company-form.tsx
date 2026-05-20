'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { ModerationWarning } from '@/components/moderation/moderation-warning';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import { updateCompanyAction, type CompanyActionState } from './actions';

interface CityOption {
  id: number;
  name: string;
}

interface DistrictOption {
  id: string;
  name: string;
}

interface Initial {
  name: string;
  vatNo: string | null;
  whatsappPhone: string | null;
  cityId: number | null;
  districtId: string | null;
  locationLat: string | null;
  locationLng: string | null;
}

interface Props {
  initial: Initial;
  cities: CityOption[];
  initialDistricts: DistrictOption[];
}

export function CompanyForm({ initial, cities, initialDistricts }: Props) {
  const [state, formAction, pending] = useActionState<
    CompanyActionState | null,
    FormData
  >(updateCompanyAction, null);
  const errorState = useMemo(
    () =>
      state && !state.ok && state.message
        ? { error: state.message, issues: state.issues }
        : null,
    [state],
  );
  useSwalOnError(errorState);

  const hasError = !!errorState;

  const [selectedCityId, setSelectedCityId] = useState<number | null>(
    initial.cityId,
  );
  const [districts, setDistricts] = useState<DistrictOption[]>(initialDistricts);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [lat, setLat] = useState<string>(initial.locationLat ?? '');
  const [lng, setLng] = useState<string>(initial.locationLng ?? '');
  const [geoStatus, setGeoStatus] = useState<string>('');

  const detectLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('✕ Tarayıcı konum erişimini desteklemiyor');
      return;
    }
    setGeoStatus('📍 Konum alınıyor...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGeoStatus(`✓ ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} alındı`);
      },
      (err) => {
        setGeoStatus(`✕ ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    if (selectedCityId === null) return;
    if (selectedCityId === initial.cityId && initialDistricts.length > 0) return;

    const ctrl = new AbortController();
    let active = true;
    (async () => {
      if (active) setDistrictsLoading(true);
      try {
        const res = await fetch(
          `/api/locations/districts?cityId=${selectedCityId}`,
          { signal: ctrl.signal },
        );
        const data: DistrictOption[] = await res.json();
        if (active) setDistricts(data);
      } catch {
        if (active) setDistricts([]);
      } finally {
        if (active) setDistrictsLoading(false);
      }
    })();
    return () => {
      active = false;
      ctrl.abort();
    };
  }, [selectedCityId, initial.cityId, initialDistricts.length]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Section title="🏢 Firma">
        <Field label="Firma adı *" htmlFor="name">
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={255}
            defaultValue={initial.name}
            data-testid="company-name"
            aria-invalid={hasError || undefined}
            className={fieldClasses}
          />
        </Field>
        <Field label="Vergi numarası (VKN/TC)" htmlFor="vatNo">
          <input
            id="vatNo"
            name="vatNo"
            type="text"
            maxLength={11}
            defaultValue={initial.vatNo ?? ''}
            placeholder="10 hane VKN veya 11 hane TC"
            data-testid="company-vat-no"
            className={`${fieldClasses} font-mono`}
          />
          <p className="mt-1 text-[12.5px] text-ink-4">
            Vitrin&apos;de ürün yayınlamak için zorunlu.
          </p>
        </Field>
      </Section>

      <Section title="📞 İletişim & Konum">
        <Field label="WhatsApp telefonu" htmlFor="whatsappPhone">
          <input
            id="whatsappPhone"
            name="whatsappPhone"
            type="text"
            maxLength={20}
            defaultValue={initial.whatsappPhone ?? ''}
            placeholder="+90... veya 0..."
            className={`${fieldClasses} font-mono`}
          />
          <p className="mt-1 text-[12.5px] text-ink-4">
            Vitrin müşterileri bu numaraya mesaj atar.
          </p>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="İl" htmlFor="cityId">
            <select
              id="cityId"
              name="cityId"
              value={selectedCityId ?? ''}
              onChange={(e) => setSelectedCityId(parseInt(e.target.value, 10) || null)}
              data-testid="company-city"
              className={fieldClasses}
            >
              <option value="">— Seç —</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="İlçe" htmlFor="districtId">
            <select
              id="districtId"
              name="districtId"
              disabled={districtsLoading || districts.length === 0}
              defaultValue={initial.districtId ?? ''}
              className={`${fieldClasses} disabled:opacity-60`}
            >
              <option value="">
                {districtsLoading
                  ? 'Yükleniyor...'
                  : districts.length === 0
                  ? 'Önce il seç'
                  : '— Seç —'}
              </option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-1 rounded-xl border border-line bg-line-soft/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold uppercase tracking-wider text-ink-3">
              📍 Konum (yakındakiler için)
            </span>
            <button
              type="button"
              onClick={detectLocation}
              data-testid="detect-location-btn"
              className="rounded-lg border border-cat/40 bg-paper px-2.5 py-1 text-[12px] font-bold text-cart hover:bg-cat hover:text-white"
            >
              Konumumu kullan
            </button>
          </div>
          <p className="mt-1 text-[12px] text-ink-4">
            Müşteriler vitrin&apos;de &quot;Yakındakileri göster&quot; tıkladığında bu
            koordinata göre sıralanır. Google Maps&apos;ten kopyalayabilir veya yukarıdaki
            tuşla otomatik alabilirsin.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Enlem" htmlFor="locationLat">
              <input
                id="locationLat"
                name="locationLat"
                type="text"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="41.0082"
                data-testid="location-lat"
                className={`${fieldClasses} font-mono`}
              />
            </Field>
            <Field label="Boylam" htmlFor="locationLng">
              <input
                id="locationLng"
                name="locationLng"
                type="text"
                inputMode="decimal"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="28.9784"
                data-testid="location-lng"
                className={`${fieldClasses} font-mono`}
              />
            </Field>
          </div>
          {geoStatus && (
            <p
              data-testid="geo-status"
              className={`mt-1.5 text-[12.5px] ${geoStatus.startsWith('✓') ? 'text-arrow-7' : geoStatus.startsWith('✕') ? 'text-danger-7' : 'text-ink-3'}`}
            >
              {geoStatus}
            </p>
          )}
        </div>
      </Section>

      {state?.moderationFlags?.flagged && (
        <ModerationWarning result={state.moderationFlags} />
      )}
      {state?.ok && state.message && (
        <div
          role="status"
          className="rounded-lg bg-arrow-soft px-3 py-2 text-sm font-bold text-arrow-7"
          data-testid="company-alert"
        >
          <p>✓ {state.message}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        data-testid="company-submit"
        className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] disabled:opacity-60"
      >
        {pending ? 'Kaydediliyor...' : 'Bilgileri güncelle'}
      </button>
    </form>
  );
}

const fieldClasses =
  'w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15';

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-paper p-5">
      <h2 className="mb-3 text-base font-bold text-cart">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
