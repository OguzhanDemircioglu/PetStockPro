'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  branchAction,
  storefrontAction,
  type BranchState,
  type StorefrontState,
} from './actions';

interface CityOption {
  id: number;
  name: string;
}

interface DistrictOption {
  id: string;
  name: string;
}

interface OnboardingWizardProps {
  userEmail: string;
  companyName: string;
  currentSlug: string;
  citiesList: CityOption[];
}

/**
 * Onboarding 2-Step Wizard — Sprint 2.6
 *
 * Step 1: İlk şube ekle (zorunlu — branches INSERT)
 * Step 2: Vitrin profili (opsiyonel — companies.slug update)
 *
 * Sprint 1B sonrası: Step 1.5 "İlk ürün" eklenir (products tablosu sonra).
 */
export function OnboardingWizard({
  userEmail,
  companyName,
  currentSlug,
  citiesList,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);

  const [branchState, branchFormAction, branchPending] = useActionState<
    BranchState | null,
    FormData
  >(async (prev, formData) => {
    const result = await branchAction(prev, formData);
    if (result.ok) setStep(2);
    return result;
  }, null);

  const [storefrontState, storefrontFormAction, storefrontPending] = useActionState<
    StorefrontState | null,
    FormData
  >(storefrontAction, null);

  // İl seçince ilçeleri çek. AbortController ile yarış kontrolü (kullanıcı il'i hızlı değiştirirse).
  useEffect(() => {
    if (selectedCityId === null) return;
    const ctrl = new AbortController();
    let active = true;

    (async () => {
      // setDistrictsLoading state'i bekletilen flag — render mid setState'i değil
      // (lint exempt: bu standart fetch-on-select pattern'ı)
      if (active) setDistrictsLoading(true);
      try {
        const res = await fetch(`/api/locations/districts?cityId=${selectedCityId}`, {
          signal: ctrl.signal,
        });
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
  }, [selectedCityId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-12">
      <div className="w-full max-w-xl rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-between">
          {[1, 2].map((s) => (
            <div key={s} className="flex flex-1 items-center">
              <div
                className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
                  step >= s ? 'bg-cat text-white' : 'bg-line-soft text-ink-4'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              {s < 2 && (
                <div
                  className={`h-0.5 flex-1 ${step > s ? 'bg-cat' : 'bg-line-soft'}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* STEP 1: İlk Şube */}
        {step === 1 && (
          <div>
            <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-cat">
              Adım 1 / 2 — Zorunlu
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-cart">
              İlk şubeni tanımla
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-3">
              <strong className="text-cart">{companyName}</strong> için en az 1 şube ekle
              — pet shop&apos;un fiziki konumu (stok takibi şube bazlı).
            </p>

            {branchState?.error && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
              >
                {branchState.error}
                {branchState.issues.length > 1 && (
                  <ul className="mt-2 list-inside list-disc text-xs font-normal">
                    {branchState.issues.slice(1).map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form action={branchFormAction} className="mt-6 flex flex-col gap-4">
              <div>
                <label
                  className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="branch-name"
                >
                  Şube adı *
                </label>
                <input
                  id="branch-name"
                  name="name"
                  type="text"
                  placeholder="Merkez Şube"
                  required
                  disabled={branchPending}
                  className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
                    htmlFor="city"
                  >
                    İl *
                  </label>
                  <select
                    id="city"
                    name="cityId"
                    required
                    disabled={branchPending}
                    value={selectedCityId ?? ''}
                    onChange={(e) =>
                      setSelectedCityId(e.target.value ? parseInt(e.target.value, 10) : null)
                    }
                    className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                  >
                    <option value="">Seç...</option>
                    {citiesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
                    htmlFor="district"
                  >
                    İlçe *
                  </label>
                  <select
                    id="district"
                    name="districtId"
                    required
                    disabled={branchPending || districtsLoading || districts.length === 0}
                    className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15 disabled:bg-line-soft disabled:text-ink-4"
                  >
                    <option value="">
                      {districtsLoading
                        ? 'Yükleniyor...'
                        : districts.length === 0
                          ? 'Önce il seç'
                          : 'Seç...'}
                    </option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="address"
                >
                  Adres
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={2}
                  placeholder="Atatürk Cad. No:42, daire 5"
                  disabled={branchPending}
                  className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="whatsapp"
                >
                  WhatsApp telefonu (opsiyonel)
                </label>
                <input
                  id="whatsapp"
                  name="whatsappPhone"
                  type="tel"
                  placeholder="0532 555 1234"
                  autoComplete="tel"
                  disabled={branchPending}
                  className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
                <p className="mt-1.5 text-[11px] text-ink-4">
                  Müşteriler vitrin&apos;den buraya yazar (Sprint 12).
                </p>
              </div>

              <button
                type="submit"
                disabled={branchPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(212,74,20,0.34)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {branchPending ? 'Kaydediliyor...' : 'Şubeyi kaydet ve devam et →'}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Vitrin (opsiyonel) */}
        {step === 2 && (
          <div>
            <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-cat">
              Adım 2 / 2 — Opsiyonel
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-cart">
              Vitrin profilini hazırla
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-3">
              Müşteriler seni{' '}
              <strong className="text-cart">petstockpro.com/vitrin/magaza/{currentSlug}</strong>
              &apos;dan bulup WhatsApp&apos;tan ulaşır. Slug&apos;ı şimdi değiştirebilirsin
              ya da sonra hallederim diyebilirsin.
            </p>

            {storefrontState?.error && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
              >
                {storefrontState.error}
              </div>
            )}

            <form action={storefrontFormAction} className="mt-6 flex flex-col gap-4">
              <div>
                <label
                  className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="slug"
                >
                  Vitrin URL slug
                </label>
                <div className="flex items-center gap-1 rounded-xl border-[1.5px] border-line bg-white pl-4 pr-1">
                  <span className="select-none text-sm text-ink-4">
                    /vitrin/magaza/
                  </span>
                  <input
                    id="slug"
                    name="slug"
                    type="text"
                    defaultValue={currentSlug}
                    pattern="[a-z0-9-]+"
                    minLength={3}
                    maxLength={80}
                    disabled={storefrontPending}
                    className="flex-1 bg-transparent py-3 text-sm text-ink focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-ink-4">
                  Sadece küçük harf, rakam ve tire. Sonradan değiştirebilirsin.
                </p>
              </div>

              <div className="rounded-xl bg-paper px-4 py-3 text-[11.5px] leading-relaxed text-ink-3">
                💡 <strong>Hesabın:</strong> {userEmail} → <strong>{companyName}</strong>
              </div>

              <button
                type="submit"
                disabled={storefrontPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(212,74,20,0.34)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {storefrontPending ? 'Kaydediliyor...' : 'Vitrin\'i yayınla ve tamamla →'}
              </button>

              <button
                type="submit"
                name="skip"
                value="true"
                disabled={storefrontPending}
                formNoValidate
                className="text-center text-xs text-ink-4 hover:text-cart"
              >
                Vitrin&apos;i sonra hallederim, panele git →
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
