'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import type { BranchActionState } from './actions';

interface CityOption {
  id: number;
  name: string;
}

interface DistrictOption {
  id: string;
  name: string;
}

interface Initial {
  name?: string | null;
  cityId?: number | null;
  districtId?: string | null;
  address?: string | null;
  whatsappPhone?: string | null;
}

interface Props {
  action: (
    prev: BranchActionState | null,
    formData: FormData,
  ) => Promise<BranchActionState>;
  cities: CityOption[];
  initial?: Initial;
  /** Edit modunda district'i ön-yüklemek için */
  initialDistricts?: DistrictOption[];
  submitLabel: string;
}

export function BranchForm({
  action,
  cities,
  initial,
  initialDistricts,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<
    BranchActionState | null,
    FormData
  >(action, null);

  const [selectedCityId, setSelectedCityId] = useState<number | null>(
    initial?.cityId ?? null,
  );
  const [districts, setDistricts] = useState<DistrictOption[]>(
    initialDistricts ?? [],
  );
  const [districtsLoading, setDistrictsLoading] = useState(false);

  useEffect(() => {
    if (selectedCityId === null) return;
    // Eğer initial city ile aynıysa ve districts hazırsa, fetch atma
    if (selectedCityId === initial?.cityId && initialDistricts) return;

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
  }, [selectedCityId, initial?.cityId, initialDistricts]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="Şube adı *" htmlFor="name">
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={120}
          defaultValue={initial?.name ?? ''}
          placeholder="Merkez, Kadıköy, Anadolu vs."
          data-testid="branch-name"
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="İl *" htmlFor="cityId">
          <select
            id="cityId"
            name="cityId"
            required
            value={selectedCityId ?? ''}
            onChange={(e) => setSelectedCityId(parseInt(e.target.value, 10) || null)}
            data-testid="branch-city"
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="" disabled>
              — Seç —
            </option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="İlçe *" htmlFor="districtId">
          <select
            id="districtId"
            name="districtId"
            required
            disabled={districtsLoading || districts.length === 0}
            defaultValue={initial?.districtId ?? ''}
            data-testid="branch-district"
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15 disabled:opacity-60"
          >
            <option value="" disabled>
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

      <Field label="Adres" htmlFor="address">
        <textarea
          id="address"
          name="address"
          rows={2}
          maxLength={500}
          defaultValue={initial?.address ?? ''}
          placeholder="Mahalle, sokak, no..."
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </Field>

      <Field label="WhatsApp telefonu" htmlFor="whatsappPhone">
        <input
          id="whatsappPhone"
          name="whatsappPhone"
          type="text"
          maxLength={20}
          defaultValue={initial?.whatsappPhone ?? ''}
          placeholder="+905XXXXXXXXX veya 05XXXXXXXXX"
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
        <p className="mt-1 text-[12.5px] text-ink-4">
          Vitrin müşterileri buraya WhatsApp mesajı atar.
        </p>
      </Field>

      {state?.message && (
        <div
          role="alert"
          className={`rounded-lg px-3 py-2 text-sm font-bold ${
            state.ok ? 'bg-arrow-soft text-arrow-7' : 'bg-danger-soft text-danger-7'
          }`}
          data-testid="branch-alert"
        >
          <p>{state.ok ? '✓' : '✕'} {state.message}</p>
          {state.issues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[12.5px] font-normal">
              {state.issues.map((i, k) => (
                <li key={k}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          data-testid="branch-submit"
          className="flex-1 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] disabled:opacity-60"
        >
          {pending ? 'Kaydediliyor...' : submitLabel}
        </button>
        <Link
          href={'/admin/branches' as never}
          className="rounded-xl border border-line bg-paper px-6 py-3 text-sm font-bold text-ink-3 hover:bg-line-soft"
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}

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
