import Link from 'next/link';
import { auth } from '@/lib/auth/auth';

const ELIGIBLE_ROLES = new Set([
  'SUPERADMIN',
  'BAYI_SAHIBI',
  'STAFF',
  'BAYI_ADMIN', // Faz 3 multi-tenant viewer
]);

/**
 * Vitrin admin-return-link — sadece auth'lı admin/staff/süperadmin için.
 *
 * Güvenlik notları:
 *
 * 1. **Auth check server-side.** Anonim ziyaretçi için `auth()` null döner,
 *    component `null` render eder — DOM'da hiç eleman olmaz, sayfa kaynağı
 *    görsel olarak da temizdir. (Hem HTML'de hem hydration sonrası.)
 *
 * 2. **Email/rol/companyId DOM'a sızmaz.** Sadece generic "← Admin paneli"
 *    label gösterir, kullanıcı bilgisi client'a render edilmez.
 *
 * 3. **HttpOnly auth cookie**: Auth.js v5 default session token HttpOnly +
 *    SameSite=Lax. Client JS bu cookie'yi okuyamaz, sadece browser otomatik
 *    Request header'a koyar. Server'da `auth()` çözer.
 *
 * 4. **Cache uyarısı**: Vitrin sayfaları DB sorgu yaptığı için zaten dynamic
 *    SSR (force-dynamic değil ama no-store gibi davranır). CDN cache eklenirse
 *    `Vary: Cookie` header gerekir. Şimdilik Cloudflare cache vitrin için
 *    aktif değil — production'da sitemap pre-build sırasında konfigure edilir.
 *
 * 5. **Yetki gate**: Sadece admin panel'e gidebilecek roller (SUPERADMIN /
 *    BAYI_SAHIBI / STAFF / BAYI_ADMIN). Müşteri rolü olsaydı bu set'te yer
 *    almazdı (henüz B2C müşteri rolü yok, ileride gelirse exclude).
 *
 * 6. **Link target**: `/admin` — middleware ve admin layout zaten auth gate'i
 *    uygular. Session expire'sa /admin → /login otomatik. Anonim manipule
 *    edip tıklasa (curl benzeri) zaten engellenir.
 */
export async function VitrinAdminReturnLink() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = (session.user as { role?: string }).role;
  if (!role || !ELIGIBLE_ROLES.has(role)) return null;

  return (
    <Link
      href={'/admin' as never}
      data-testid="vitrin-admin-return-link"
      title="Admin paneline dön"
      className="inline-flex items-center gap-1 rounded-xl border border-cat/40 bg-cat-soft px-2.5 py-1.5 text-[13.5px] font-bold text-cart transition-colors hover:border-cat hover:bg-cat hover:text-white sm:gap-1.5 sm:px-3"
    >
      <span aria-hidden>←</span>
      <span className="sm:hidden">Admin</span>
      <span className="hidden sm:inline">Admin paneli</span>
    </Link>
  );
}
