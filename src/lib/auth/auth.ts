/**
 * Auth.js v5 (next-auth) — PetStockPro auth config
 *
 * Sprint 0: temel iskelet — credentials provider + JWT signer (jose ile Cloudflare Workers uyumlu)
 * Sprint 2'de detaylanacak: Cloudflare Turnstile + HIBP + 2FA + email verification +
 * brute-force lock + hibrit davet kabul.
 *
 * Otoritatif: docs/EKRAN-AUTH.md, docs/TECH-STACK.md §3.9c
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db/client';

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
      async authorize(_credentials) {
        // TODO Sprint 2: bcryptjs ile password verification + brute-force lock check
        // TODO Sprint 2: HIBP check + Turnstile verification
        // TODO Sprint 2: email verification status check
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // TODO Sprint 2: user_role JWT claim (KT2-1) + company_id
        token.userRole = (user as { role?: string }).role ?? 'STAFF';
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { role?: string }).role = token.userRole as string;
      }
      return session;
    },
  },
});
