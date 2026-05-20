'use client';

import { useActionState } from 'react';
import type { StorefrontSettingsRow } from '@/lib/storefront/settings';
import { ModerationWarning } from '@/components/moderation/moderation-warning';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import { saveStorefrontAction, type StorefrontFormState } from './actions';

interface Props {
  initial: StorefrontSettingsRow | null;
}

export function StorefrontForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState<StorefrontFormState | null, FormData>(
    saveStorefrontAction,
    null,
  );
  useSwalOnError(state);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6" data-testid="storefront-form">
      {state?.ok && (
        <div
          role="status"
          className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7"
        >
          ✓ Vitrin profili kaydedildi
        </div>
      )}
      {state?.moderationFlags?.flagged && (
        <ModerationWarning result={state.moderationFlags} />
      )}

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="mb-3 text-sm font-bold text-cart">🌐 Yayın durumu</h2>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="isEnabled"
            defaultChecked={initial?.isEnabled ?? false}
            disabled={pending}
            data-testid="storefront-enabled"
            className="mt-1 h-4 w-4 cursor-pointer rounded border-line text-cat focus:ring-2 focus:ring-cat/30"
          />
          <span>
            <span className="text-sm font-bold text-ink">Vitrin yayında</span>
            <span className="mt-0.5 block text-xs text-ink-3">
              İşaretliyse pet shop profilin <code>/vitrin/magaza/[slug]</code> URL&apos;inde
              halka görünür olur (vitrin yapısı Sprint 12 sonrası).
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="mb-3 text-sm font-bold text-cart">📝 Hakkında</h2>
        <Field
          name="aboutContent"
          label="Bio + çalışma saatleri (max 2000 karakter)"
          placeholder="Mavi Pet Shop İzmir Aliağa'da 5 yıldır hizmet vermektedir. Hafta içi 09:00-21:00, hafta sonu 10:00-22:00..."
          defaultValue={initial?.aboutContent ?? ''}
          multiline
          disabled={pending}
          maxLength={2000}
        />
        <Field
          name="metaDescription"
          label="SEO açıklaması"
          helperText="Google'da pet shop'un adı arandığında başlığın altında çıkacak özet yazı. Müşteriye 1-2 cümlede sen kimsin, hangi şehirde ve ne sattığını anlat. Boş bırakırsan Google &quot;Hakkında&quot; yazısının ilk 160 karakterini kullanır. (max 300 karakter)"
          placeholder="İzmir Aliağa'da pet shop. Mama, oyuncak, aksesuar..."
          defaultValue={initial?.metaDescription ?? ''}
          multiline
          disabled={pending}
          maxLength={300}
        />
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="mb-3 text-sm font-bold text-cart">📞 İletişim</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="contactWhatsapp"
            label="WhatsApp"
            placeholder="+90 5XX XXX XX XX"
            defaultValue={initial?.contactWhatsapp ?? ''}
            disabled={pending}
          />
          <Field
            name="contactPhone"
            label="Telefon"
            placeholder="+90 5XX XXX XX XX"
            defaultValue={initial?.contactPhone ?? ''}
            disabled={pending}
          />
          <Field
            name="contactTelegram"
            label="Telegram kullanıcı adı"
            placeholder="mavipetshop"
            defaultValue={initial?.contactTelegram ?? ''}
            disabled={pending}
          />
          <Field
            name="contactEmail"
            label="E-posta"
            type="email"
            placeholder="info@mavipet.com"
            defaultValue={initial?.contactEmail ?? ''}
            disabled={pending}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="mb-3 text-sm font-bold text-cart">🌐 Sosyal medya</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="socialInstagram"
            label="Instagram"
            placeholder="kullaniciadi (instagram.com/...)"
            defaultValue={initial?.socialInstagram ?? ''}
            disabled={pending}
          />
          <Field
            name="socialFacebook"
            label="Facebook"
            placeholder="sayfa-adi (facebook.com/...)"
            defaultValue={initial?.socialFacebook ?? ''}
            disabled={pending}
          />
          <Field
            name="socialTwitter"
            label="X (Twitter)"
            placeholder="kullaniciadi"
            defaultValue={initial?.socialTwitter ?? ''}
            disabled={pending}
          />
          <Field
            name="socialTiktok"
            label="TikTok"
            placeholder="kullaniciadi"
            defaultValue={initial?.socialTiktok ?? ''}
            disabled={pending}
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          data-testid="storefront-submit"
          className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
        >
          {pending ? 'Kaydediliyor...' : '💾 Vitrin profilini kaydet'}
        </button>
        {pending && <span className="text-xs text-ink-3">Lütfen bekle...</span>}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  helperText,
  placeholder,
  defaultValue,
  type = 'text',
  multiline = false,
  disabled = false,
  maxLength,
}: {
  name: string;
  label: string;
  /** Label altında küçük gri açıklama metni — alanın ne işe yaradığını anlatır. */
  helperText?: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  multiline?: boolean;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12.5px] font-bold uppercase tracking-wider text-ink-3">{label}</span>
      {helperText && (
        <span className="text-[11.5px] leading-snug text-ink-3">{helperText}</span>
      )}
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={4}
          className="rounded-xl border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      ) : (
        <input
          type={type}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className="rounded-xl border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      )}
    </label>
  );
}
