import type { AnchorHTMLAttributes } from 'react';

/**
 * WhatsappButton — resmi WhatsApp yeşili + logo SVG.
 *
 * Brand renkleri (WhatsApp Brand Guidelines):
 *   - Primary green: #25D366
 *   - Dark green (hover): #128C7E
 *   - Beyaz logo
 *
 * Tüm vitrin sayfalarında pet shop'la iletişim için kullanılır. href `wa.me/...`
 * deep link olmalı. target="_blank" + rel="noreferrer" zorunlu (güvenlik).
 */
interface Props
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'> {
  href: string;
  /** Buton üstündeki yazı. Default: "Satıcıya sor" (WhatsApp ikonu + bu yazı). */
  label?: string;
  /** Boyut: 'md' default kart için, 'lg' hero/CTA için, 'sm' compact için */
  size?: 'sm' | 'md' | 'lg';
  /** Buton genişliği: 'auto' içeriğe göre, 'block' tam genişlik */
  width?: 'auto' | 'block';
}

const SIZE_CLS: Record<NonNullable<Props['size']>, string> = {
  sm: 'gap-1.5 px-2.5 py-1.5 text-[12px]',
  md: 'gap-2 px-3.5 py-2 text-[13px]',
  lg: 'gap-2 px-4 py-2.5 text-[14px]',
};

const ICON_SIZE: Record<NonNullable<Props['size']>, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

export function WhatsappButton({
  href,
  label = 'Satıcıya sor',
  size = 'md',
  width = 'auto',
  className,
  ...rest
}: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      data-testid="whatsapp-button"
      className={`inline-flex items-center justify-center rounded-xl bg-[#25D366] font-bold text-white shadow-sm transition-all hover:bg-[#128C7E] hover:-translate-y-px ${
        SIZE_CLS[size]
      } ${width === 'block' ? 'w-full' : ''} ${className ?? ''}`}
      {...rest}
    >
      <WhatsappIcon size={ICON_SIZE[size]} />
      {label}
    </a>
  );
}

/**
 * WhatsApp official logo SVG — phone receiver içinde chat baloncuğu.
 * Path WhatsApp brand asset'inden uyarlandı (Wikimedia public icon).
 */
function WhatsappIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}
