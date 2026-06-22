/**
 * Local geliştirme için SUPERADMIN hesabı oluşturur (idempotent).
 *
 * Local DB (Aiven) boş başlar — `users` tablosunda hiç kayıt yoktur. Bu script
 * `claude@petstockpro.local` / `Test1234!` SUPERADMIN'i ekler (varsa günceller):
 * email doğrulanmış, 2FA kapalı, onboarding tamamlanmış, companyId NULL (sistem
 * geneline ait). Böylece tarayıcıdan login → /admin/superadmin akışı test edilebilir.
 *
 * Kullanım:  npx tsx scripts/create-local-superadmin.ts
 *
 * NOT: companyId NULL bir SUPERADMIN, admin layout guard'ından geçer (bkz.
 * src/app/admin/layout.tsx — companyId yoksa yalnızca SUPERADMIN geçer).
 */
import 'dotenv/config';
import postgres from 'postgres';
import bcryptjs from 'bcryptjs';

const EMAIL = 'claude@petstockpro.local';
const PASSWORD = 'Test1234!';

(async () => {
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    connection: { search_path: 'petstockpro,public' },
  });
  const hash = await bcryptjs.hash(PASSWORD, 12);
  const rows = await sql<Array<{ id: string; email: string; role: string }>>`
    INSERT INTO petstockpro.users
      (email, password_hash, email_verified_at, name, role,
       two_factor_enabled, onboarding_completed_at, kvkk_consented_at,
       created_at, updated_at)
    VALUES
      (${EMAIL}, ${hash}, now(), 'Claude Test', 'SUPERADMIN',
       false, now(), now(), now(), now())
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      email_verified_at = now(),
      role = 'SUPERADMIN',
      two_factor_enabled = false,
      locked_until = NULL,
      failed_login_count = 0,
      onboarding_completed_at = now(),
      updated_at = now()
    RETURNING id, email, role;
  `;
  console.log('SUPERADMIN hazır:', rows[0], `\nGiriş: ${EMAIL} / ${PASSWORD}`);
  await sql.end();
})().catch((e) => { console.error(e); process.exit(1); });
