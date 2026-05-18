/**
 * ModerationQueryBanner — server action redirect query param'larından banner.
 *
 * Kullanım:
 * ```tsx
 * <ModerationQueryBanner
 *   moderation={params.moderation}
 *   fields={params.fields}
 *   entityLabel="Marka"
 * />
 * ```
 *
 * Tüm admin list sayfalarında tek satır banner. ModerationWarning component'i
 * (helper-driven, ModerationResult prop ile) ayrı durumlar için tutuldu.
 */

interface Props {
  /** searchParams.moderation === 'flagged' kontrolü için. */
  moderation?: 'flagged' | string;
  /** Virgülle ayrılmış field listesi (örn: "Marka adı"). */
  fields?: string;
  /** "Marka" / "Şube" / "Tedarikçi" vb. — banner mesajında geçer. */
  entityLabel?: string;
}

export function ModerationQueryBanner({ moderation, fields, entityLabel }: Props) {
  if (moderation !== 'flagged') return null;
  return (
    <div
      role="alert"
      data-testid="moderation-warning"
      className="rounded-xl border border-bars/40 bg-bars-soft/60 px-4 py-3 text-sm text-bars-7"
    >
      <div className="font-bold">⚠ Uygunsuz olabilecek ifade tespit edildi</div>
      <p className="mt-1 text-[12.5px] leading-relaxed">
        {entityLabel ? `${entityLabel} kaydedildi` : 'Kayıt yapıldı'}
        {' '}ama içeriğini düzeltmeni öneririz. Süperadmin&apos;e otomatik bildirildi.
      </p>
      {fields && (
        <p className="mt-1.5 text-[12.5px]">
          <strong>İlgili alan:</strong>{' '}
          <span className="rounded bg-paper/80 px-1.5 py-0.5 font-mono text-[11.5px]">
            {fields}
          </span>
        </p>
      )}
    </div>
  );
}
