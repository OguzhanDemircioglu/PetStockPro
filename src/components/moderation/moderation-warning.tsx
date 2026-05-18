/**
 * Moderation uyarı banner'ı — server action'dan dönen ModerationResult'i UI'da gösterir.
 *
 * "Uyar pattern": form action başarılı olmuş (kayıt yapılmış), sadece kullanıcıya
 * "içeriğinde uygunsuz olabilecek ifade var" uyarısı verir. Block etmez.
 *
 * Süperadmin audit log üzerinden takip eder.
 *
 * Kullanım:
 * ```tsx
 * {state?.moderationFlags && <ModerationWarning result={state.moderationFlags} />}
 * ```
 */

import type { ModerationReason } from '@/lib/moderation/check';

export interface ModerationSummary {
  flagged: boolean;
  fieldsFlagged?: string[];
  reasons?: ModerationReason[];
}

interface Props {
  result: ModerationSummary;
}

const CATEGORY_LABEL: Record<string, string> = {
  profanity: 'küfür',
  insult: 'hakaret',
  sexual: 'cinsel içerik',
  scam: 'dolandırıcılık belirtisi',
  harassment: 'taciz',
  'harassment/threatening': 'tehdit içeren taciz',
  hate: 'nefret söylemi',
  'hate/threatening': 'nefret + tehdit',
  'sexual/minors': 'küçüklere yönelik cinsel içerik',
  violence: 'şiddet',
  'violence/graphic': 'grafik şiddet',
  'self-harm': 'kendine zarar',
  'self-harm/intent': 'kendine zarar niyeti',
  'self-harm/instructions': 'kendine zarar talimatı',
  illicit: 'yasadışı içerik',
  'illicit/violent': 'yasadışı şiddet',
};

export function ModerationWarning({ result }: Props) {
  if (!result.flagged) return null;

  const uniqueCategories = Array.from(
    new Set((result.reasons ?? []).map((r) => CATEGORY_LABEL[r.category] ?? r.category)),
  );

  const fields = result.fieldsFlagged ?? [];

  return (
    <div
      role="alert"
      data-testid="moderation-warning"
      className="rounded-xl border border-bars/40 bg-bars-soft/60 px-4 py-3 text-sm text-bars-7"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-base leading-tight">⚠</span>
        <div className="flex-1">
          <div className="font-bold">
            Uygunsuz olabilecek ifade tespit edildi
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed">
            Kayıt yapıldı ama içeriğini düzeltmeni öneririz — herkese açık bir yerde
            paylaşırsa hem işletmen hem PetStockPro etkilenir. Süperadmin&apos;e otomatik
            bildirildi.
          </p>
          {fields.length > 0 && (
            <p className="mt-1.5 text-[12.5px]">
              <strong>İlgili alan:</strong>{' '}
              {fields.map((f, i) => (
                <span key={f}>
                  <span className="rounded bg-paper/80 px-1.5 py-0.5 font-mono text-[11.5px]">
                    {f}
                  </span>
                  {i < fields.length - 1 && ' · '}
                </span>
              ))}
            </p>
          )}
          {uniqueCategories.length > 0 && (
            <p className="mt-1.5 text-[12.5px]">
              <strong>Kategori:</strong> {uniqueCategories.join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
