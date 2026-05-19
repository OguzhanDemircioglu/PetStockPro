import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment');
}

/**
 * Postgres bağlantı havuzu.
 * Supabase Frankfurt (eu-central-1) hedefli, search_path=petstockpro.
 *
 * Connection pooling stratejisi:
 * - Cloudflare Workers'da Hyperdrive kullanılacak (production)
 * - Local dev'de direkt postgres-js
 *
 * NOT: LOCAL_DB_* env vars `.env`'de rezerve — production'a çıktıktan sonra
 * local Aiven/Postgres'e geçiş için. Şu an aktif değil.
 */
const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
  connection: {
    search_path: 'petstockpro,public',
  },
});

export const db = drizzle(queryClient, { schema, logger: process.env.NODE_ENV === 'development' });
export type DbClient = typeof db;
