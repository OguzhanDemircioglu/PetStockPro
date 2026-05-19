import 'dotenv/config';
import type { Config } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment');
}

export default {
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  schemaFilter: ['petstockpro'],
  verbose: true,
  // strict: false → non-interactive (CI/CD friendly).
  // Kritik schema değişikliği yapacaksan `db:generate` ile review et, sonra `db:migrate`.
  strict: false,
} satisfies Config;
