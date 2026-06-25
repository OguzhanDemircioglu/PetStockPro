import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment');
}

/**
 * Postgres bağlantı havuzu.
 *
 * Topoloji (2026-06-17):
 * - PRODUCTION → Supabase (Vercel serverless). Serverless'ta DIRECT bağlantı
 *   (db.<ref>.supabase.co:5432) önerilmez — her instance kendi bağlantısını
 *   açar, çok instance = bağlantı fırtınası ("too many connections"). Vercel
 *   DATABASE_URL'i Supabase **transaction-mode pooler**'a ayarlanmalı:
 *   aws-0-<region>.pooler.supabase.com:6543 (user: postgres.<ref>).
 * - LOCAL DEV → Aiven (direct / session mode).
 *
 * `prepare` connection tipine göre OTOMATİK:
 * - Transaction-mode pooler (pgBouncer/Supavisor): prepared statement'lar
 *   paylaşılan bağlantıda çakışır ("prepared statement already exists") →
 *   prepare KAPALI olmalı.
 * - Direct/session (Aiven local, Supabase direct): prepare AÇIK — Postgres plan
 *   cache, per-request planlama 4-12ms → <1ms.
 */
function isTransactionPooler(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      /pooler\./.test(u.hostname) ||                  // Supabase Supavisor
      u.port === '6543' ||                            // pgBouncer transaction portu
      u.searchParams.get('pgbouncer') === 'true'
    );
  } catch {
    return false;
  }
}

const pooled = isTransactionPooler(process.env.DATABASE_URL);

const queryClient = postgres(process.env.DATABASE_URL, {
  // Serverless: instance başına küçük havuz. ÖNCEDEN max:1 idi — ama max:1'de tek
  // bağlantı bir aborted/suspended/timeout isteğinde "checked-out" takılı kalırsa
  // (Fluid Compute instance'ı yeniden kullanır) o instance'taki SONRAKİ tüm istekler
  // boşalmayan bağlantıyı sonsuza kadar bekleyip donuyordu (login + /admin/superadmin
  // 300s hang → 504). max:3 → bir bağlantı wedge olsa bile diğer 2'si çalışır, instance
  // komple kilitlenmez. Supavisor multiplex ettiği için 3 güvenli (storm riski max:10'daydı).
  max: 3,
  idle_timeout: 20,
  // Wedge olan bir bağlantı en geç bu sürede geri dönüştürülür (sonsuza dek takılı kalmaz).
  max_lifetime: 60 * 10,
  connect_timeout: 10,
  prepare: !pooled,
  connection: {
    search_path: 'petstockpro,public',
  },
});

export const db = drizzle(queryClient, { schema, logger: process.env.NODE_ENV === 'development' });
export type DbClient = typeof db;
