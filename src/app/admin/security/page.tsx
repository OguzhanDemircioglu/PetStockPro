import { redirect } from 'next/navigation';

/**
 * /admin/security — 2026-06-27: Hesap & Güvenlik tek sekmede birleşti.
 *
 * Bu rota geriye dönük uyumluluk için /admin/account'a yönlendirir (eski
 * bookmark'lar, 2FA disable redirect'i, dokümandaki linkler kırılmasın diye).
 * `?2fa=disabled` başarı parametresi korunarak iletilir.
 */
export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ '2fa'?: string }>;
}) {
  const params = await searchParams;
  const suffix = params['2fa'] === 'disabled' ? '?2fa=disabled' : '';
  redirect(`/admin/account${suffix}` as never);
}
