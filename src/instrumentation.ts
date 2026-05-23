/**
 * Next.js instrumentation hook — Cloudflare Workers deployment için no-op.
 *
 * Eski davranış: Node.js runtime'da boot sırasında migrations + city/district +
 * catalog seed çalıştırırdı. Workers'da gerekli değil:
 *  - Migrations Supabase üzerinden manuel apply edildi
 *  - Seed data zaten DB'de mevcut (cities, districts, catalog_seed_products)
 *  - postgres-js + fs erişimi Workers Webpack bundle'ında crash ediyor
 *
 * Dev modunda manuel bootstrap için: scripts/baseline-drizzle-migrations.ts
 * veya npm run db:seed komutları kullanılır.
 */
export async function register() {
  // Intentional no-op — bkz. yukarıdaki doc.
}
