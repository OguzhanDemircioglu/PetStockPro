/**
 * Auth.js v5 (next-auth) — PetStockPro auth config
 *
 * Sprint 2 detay: Credentials provider tam (bcryptjs + brute-force lock +
 * email verified check) + JWT/Session callback'lerinde companyId + role + branchId inject.
 *
 * Authorize logic dependency injection ile src/lib/auth/authorize.ts'te — test edilebilir.
 *
 * TODO Sprint 2 devamı:
 *   - Cloudflare Turnstile verification (5+ fail sonrası conditional)
 *   - HIBP password check register'da
 *   - 2FA enforcement (twoFactorEnabled=true ise 2. adım)
 *   - Hibrit davet kabul akışı (token → password set)
 *
 * Otoritatif: docs/EKRAN-AUTH.md, docs/TECH-STACK.md §3.9c
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db/client';
import { authorizeCredentials } from './authorize';

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not set in environment');
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'E-posta', type: 'email' },
        password: { label: 'Şifre', type: 'password' },
      },
      async authorize(credentials) {
        // Tüm logic dependency injection ile testable bir helper'da
        return authorizeCredentials(credentials, db);
      },
    }),
  ],
  callbacks: {
    /**
     * JWT callback — user object'ten gelen field'ları token'a inject et.
     * Her request'te bu token JWT'den okunur (jose ile Cloudflare Workers uyumlu).
     */
    async jwt({ token, user }) {
      if (user) {
        token.companyId = user.companyId;
        token.role = user.role;
        token.branchId = user.branchId ?? null;
      }
      return token;
    },

    /**
     * Session callback — client'a expose edilen session.user shape.
     * Server actions ve client component'lar bu user'ı okur.
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub ?? '';
        session.user.companyId = (token.companyId as string | null) ?? null;
        session.user.role = (token.role as string) ?? 'STAFF';
        session.user.branchId = (token.branchId as string | null) ?? null;
      }
      return session;
    },
  },
});
