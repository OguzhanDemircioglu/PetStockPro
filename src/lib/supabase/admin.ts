/**
 * Supabase admin client — server-side only.
 *
 * service_role JWT ile authenticate olur. RLS politikalarını bypass eder,
 * Storage bucket'larına yazma yetkisi vardır. ASLA client component'e import
 * etme — `'use server'` action / API route / server component'lerde kullan.
 *
 * Tek instance (singleton) — Workers/Next.js her request'te yeni client
 * yaratmaktansa module-level reuse eder.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      'SUPABASE_URL (veya NEXT_PUBLIC_SUPABASE_URL) tanımlı değil — env eksik',
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY tanımlı değil — server-side storage işlemleri için zorunlu',
    );
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      // Server-side, session yenilemesine veya cookie persist'e gerek yok
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return adminClient;
}
