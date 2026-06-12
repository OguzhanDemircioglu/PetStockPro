/**
 * Next.js middleware — /admin/superadmin/* yolları için defansif derinlik.
 *
 * Üç katmanlı izin kontrolü zaten var:
 *   1. Sidebar nav grup (admin-sidebar.tsx): SUPERADMIN değilse grup render edilmez
 *   2. Sayfa guard (requireSuperadmin): page.tsx başında session role check + /admin redirect
 *   3. Server action gate (isSuperadmin): her action'da çift kontrol
 *
 * Middleware = 4. katman. Sayfa SSR'a varmadan önce JWT cookie'sini decode eder ve
 * role !== 'SUPERADMIN' ise /admin'e redirect eder. Saldırgan SSR pipeline'da bir
 * bug bulup guard'ı bypass etse bile request middleware'de düşer.
 *
 * NOT: Auth.js v5 JWT strategy ile çalışır — token cookie'sini jose/getToken ile çöz.
 * Edge runtime uyumlu (Cloudflare Workers).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Staging mockup gate: auth/register URL'leri → /yapim-asamasinda
// NEXT_PUBLIC_STAGING_MODE=true ortam değişkeni varsa aktif.
// NOT: /admin gate'lenmez — demo SUPERADMIN auto-login flow için açık olmalı.
// Anonim ziyaretçi /admin'e giderse layout'taki requireSession /login'e
// yönlendirir, /login gate burada zaten staging gate'ler.
const STAGING_GATED_PATHS = [
  // '/login' kasıtlı GATE'lenmez (2026-06-12): login tek giriş kapısı, demo
  // önizleme sol panelinde — staging'de de erişilebilir olmalı. Authed kullanıcı
  // zaten aşağıda "/"'a yönlendirilir.
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-email-change',
  '/cancel-email-change',
  '/accept-invite',
  '/account-locked',
  '/2fa-setup',
  '/onboarding',
];

function shouldGateForStaging(pathname: string): boolean {
  if (process.env.NEXT_PUBLIC_STAGING_MODE !== 'true') return false;
  if (pathname === '/yapim-asamasinda') return false; // sayfanın kendisi
  return STAGING_GATED_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Auth.js v5 JWT session token'ını cookie'den çözer (edge uyumlu). */
function readSessionToken(req: NextRequest) {
  return getToken({
    req,
    secret: process.env.AUTH_SECRET,
    // Auth.js v5 default cookie ismi
    cookieName: process.env.NODE_ENV === 'production'
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token',
  });
}

export async function middleware(req: NextRequest) {
  // Staging gate önce: login/register/admin → yapım aşamasında
  if (shouldGateForStaging(req.nextUrl.pathname)) {
    const gateUrl = req.nextUrl.clone();
    gateUrl.pathname = '/yapim-asamasinda';
    gateUrl.search = '';
    return NextResponse.redirect(gateUrl);
  }

  // Giriş yapmış kullanıcı /login'e gelirse formu görmesin → "/"'a yönlendir.
  // "/" (app/page.tsx) authed kullanıcıyı role + onboarding'e göre route'lar:
  // SUPERADMIN → /admin/superadmin, diğer → /admin (veya /onboarding). Tek
  // doğruluk kaynağı için role hesabını orada bırakıyoruz.
  if (req.nextUrl.pathname === '/login') {
    const loginToken = await readSessionToken(req);
    if (loginToken) {
      const homeUrl = req.nextUrl.clone();
      homeUrl.pathname = '/';
      homeUrl.search = '';
      return NextResponse.redirect(homeUrl);
    }
    return NextResponse.next();
  }

  // Sadece /admin/superadmin/* yollarında kontrol — diğer /admin sayfaları layout'ta
  // requireSession yapıyor zaten.
  if (!req.nextUrl.pathname.startsWith('/admin/superadmin')) {
    return NextResponse.next();
  }

  const token = await readSessionToken(req);

  // Session yok → login
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session var ama SUPERADMIN değil → /admin (kendi tenant pano'su)
  if (token.role !== 'SUPERADMIN') {
    const adminUrl = req.nextUrl.clone();
    adminUrl.pathname = '/admin';
    adminUrl.search = '';
    return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password/:path*',
    '/verify-email/:path*',
    '/verify-email-change/:path*',
    '/cancel-email-change/:path*',
    '/accept-invite/:path*',
    '/account-locked',
    '/2fa-setup',
    '/onboarding',
  ],
};
