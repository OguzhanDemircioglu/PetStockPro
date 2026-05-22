import 'dotenv/config';
import postgres from 'postgres';

(async () => {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const r = await sql<Array<{ total: number; verified: number }>>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM petstockpro.users u WHERE u.company_id = c.id AND u.email_verified_at IS NOT NULL))::int AS verified
    FROM petstockpro.companies c
  `;
  console.log('Mevcut tenant durumu:', r[0]);
  await sql.end();
})().catch((e) => { console.error(e); process.exit(1); });
