/**
 * Auth.js v5 type augmentation
 *
 * User shape genişletir: companyId + role + branchId
 * Session.user'a aynı field'ları yansıt
 * JWT token'a aynı field'ları yansıt
 *
 * Otoritatif: docs/EKRAN-AUTH.md §6 + DATABASE-SCHEMA.md §4.1 (JWT claims)
 */

import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User extends DefaultUser {
    companyId: string | null;
    role: string; // 'SUPERADMIN' | 'BAYI_SAHIBI' | 'SUBE_MUDURU' | 'STAFF' | 'BAYI_ADMIN'
    branchId?: string | null;
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
      companyId: string | null;
      role: string;
      branchId?: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    companyId?: string | null;
    role?: string;
    branchId?: string | null;
  }
}
