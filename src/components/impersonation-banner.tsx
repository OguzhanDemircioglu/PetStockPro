import { stopImpersonationAction } from '@/app/admin/superadmin/impersonate-actions';

interface Props {
  companyName: string;
  impersonatorEmail: string;
}

/**
 * ImpersonationBanner — sticky, admin layout'un en üstüne yapışır.
 *
 * SUPERADMIN bir tenant'a "girdiğinde" tüm admin sayfalarının en üstünde
 * görünür. Kırmızı-turuncu gradient + uyarı emoji + tek tıkla çıkış.
 *
 * Server component — form action ile stopImpersonationAction'a bağlı.
 */
export function ImpersonationBanner({ companyName, impersonatorEmail }: Props) {
  return (
    <div
      data-testid="impersonation-banner"
      className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-danger/40 bg-gradient-to-r from-danger-7 via-cat-7 to-danger-7 px-4 py-2 text-white shadow-lg"
    >
      <span aria-hidden className="text-base">
        🎭
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold leading-tight">
          <strong>{impersonatorEmail}</strong> ·{' '}
          <span className="rounded-full bg-white/20 px-2 py-0.5">
            {companyName}
          </span>{' '}
          olarak görüntülüyor
        </div>
        <div className="text-[12px] opacity-85">
          Tüm aksiyonlar audit log&apos;a süperadmin damgasıyla yazılır.
          Görsel tenant erişimi — kullanıcının gördüğü ekran aynısı.
        </div>
      </div>
      <form action={stopImpersonationAction}>
        <button
          type="submit"
          data-testid="impersonation-stop"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/15 px-3 py-1.5 text-[13px] font-bold text-white backdrop-blur transition-colors hover:bg-white/30"
        >
          ✕ Çıkış · Süperadmin&apos;e dön
        </button>
      </form>
    </div>
  );
}
