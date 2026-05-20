'use client';

import { useActionState, useMemo } from 'react';
import Link from 'next/link';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import type { SupplierActionState } from './actions';

interface Initial {
  name?: string;
  vatNo?: string | null;
  vatOffice?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  district?: string | null;
  leadTimeDays?: number;
  paymentTerms?: 'cash' | 'net_30' | 'net_60' | 'other';
  iban?: string | null;
}

interface Props {
  action: (
    prev: SupplierActionState | null,
    formData: FormData,
  ) => Promise<SupplierActionState>;
  initial?: Initial;
  submitLabel: string;
}

export function SupplierForm({ action, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<
    SupplierActionState | null,
    FormData
  >(action, null);
  const errorState = useMemo(
    () =>
      state && !state.ok && state.message
        ? { error: state.message, issues: state.issues }
        : null,
    [state],
  );
  useSwalOnError(errorState);

  const hasError = !!errorState;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Section title="🏢 Firma">
        <Field label="Tedarikçi adı *" htmlFor="name">
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={255}
            defaultValue={initial?.name ?? ''}
            placeholder="Royal Canin TR, Mama Toptan Ltd. vs."
            data-testid="supplier-name"
            aria-invalid={hasError || undefined}
            className={fieldClasses}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="VKN / TC" htmlFor="vatNo">
            <input
              id="vatNo"
              name="vatNo"
              type="text"
              maxLength={11}
              defaultValue={initial?.vatNo ?? ''}
              placeholder="10 veya 11 hane"
              className={`${fieldClasses} font-mono`}
            />
          </Field>
          <Field label="Vergi dairesi" htmlFor="vatOffice">
            <input
              id="vatOffice"
              name="vatOffice"
              type="text"
              maxLength={100}
              defaultValue={initial?.vatOffice ?? ''}
              placeholder="Kadıköy, Şişli, ..."
              className={fieldClasses}
            />
          </Field>
        </div>
      </Section>

      <Section title="📞 İletişim">
        <Field label="Yetkili kişi" htmlFor="contactName">
          <input
            id="contactName"
            name="contactName"
            type="text"
            maxLength={100}
            defaultValue={initial?.contactName ?? ''}
            placeholder="Mehmet Bey"
            className={fieldClasses}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefon" htmlFor="phone">
            <input
              id="phone"
              name="phone"
              type="text"
              maxLength={20}
              defaultValue={initial?.phone ?? ''}
              placeholder="+90... veya 0..."
              className={`${fieldClasses} font-mono`}
            />
          </Field>
          <Field label="E-posta" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              maxLength={255}
              defaultValue={initial?.email ?? ''}
              placeholder="info@firma.com"
              className={fieldClasses}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Şehir" htmlFor="city">
            <input
              id="city"
              name="city"
              type="text"
              maxLength={100}
              defaultValue={initial?.city ?? ''}
              className={fieldClasses}
            />
          </Field>
          <Field label="İlçe" htmlFor="district">
            <input
              id="district"
              name="district"
              type="text"
              maxLength={100}
              defaultValue={initial?.district ?? ''}
              className={fieldClasses}
            />
          </Field>
        </div>
      </Section>

      <Section title="💼 Ticari koşullar">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tedarik süresi (gün)" htmlFor="leadTimeDays">
            <input
              id="leadTimeDays"
              name="leadTimeDays"
              type="number"
              min={0}
              max={365}
              defaultValue={initial?.leadTimeDays ?? 7}
              className={`${fieldClasses} font-mono`}
            />
          </Field>
          <Field label="Ödeme koşulu" htmlFor="paymentTerms">
            <select
              id="paymentTerms"
              name="paymentTerms"
              defaultValue={initial?.paymentTerms ?? 'net_30'}
              className={fieldClasses}
            >
              <option value="cash">Peşin</option>
              <option value="net_30">30 gün vadeli</option>
              <option value="net_60">60 gün vadeli</option>
              <option value="other">Diğer</option>
            </select>
          </Field>
        </div>
        <Field label="IBAN" htmlFor="iban">
          <input
            id="iban"
            name="iban"
            type="text"
            maxLength={26}
            defaultValue={initial?.iban ?? ''}
            placeholder="TR000000000000000000000000"
            className={`${fieldClasses} font-mono`}
          />
        </Field>
      </Section>

      <Section title="📝 Not">
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={1000}
          placeholder="Ek bilgi, anlaşmalar, vs."
          className={`${fieldClasses} text-sm`}
        />
      </Section>

      {state?.ok && state.message && (
        <div
          role="status"
          className="rounded-lg bg-arrow-soft px-3 py-2 text-sm font-bold text-arrow-7"
          data-testid="supplier-alert"
        >
          <p>✓ {state.message}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          data-testid="supplier-submit"
          className="flex-1 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] disabled:opacity-60"
        >
          {pending ? 'Kaydediliyor...' : submitLabel}
        </button>
        <Link
          href={'/admin/suppliers' as never}
          className="rounded-xl border border-line bg-paper px-6 py-3 text-sm font-bold text-ink-3 hover:bg-line-soft"
        >
          Vazgeç
        </Link>
      </div>
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
