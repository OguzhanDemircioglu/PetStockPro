'use client';

import { useActionState, useEffect, useState } from 'react';
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

  const [selectedCityId, setSelectedCityId] = useState<number | null>(
    initial.cityId,
  );
  const [districts, setDistricts] = useState<DistrictOption[]>(initialDistricts);
  const [districtsLoading, setDistrictsLoading] = useState(false);

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
          <p className="mt-1 text-[11px] text-ink-4">
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
          <p className="mt-1 text-[11px] text-ink-4">
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
      </Section>

      {state?.message && (
        <p
          role="alert"
          className={`rounded-lg px-3 py-2 text-sm font-bold ${
            state.ok ? 'bg-arrow-soft text-arrow-7' : 'bg-danger-soft text-danger-7'
          }`}
          data-testid="company-alert"
        >
          {state.ok ? '✓' : '✕'} {state.message}
          {state.issues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[11px] font-normal">
              {state.issues.map((i, k) => (
                <li key={k}>{i}</li>
              ))}
            </ul>
          )}
        </p>
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
  'w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15';

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
        className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-3 text-base font-bold text-cart">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
