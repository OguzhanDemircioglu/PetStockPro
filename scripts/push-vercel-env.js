// Vercel env vars bulk push — .env okur, vercel env add ile production'a yükler.
// Idempotent: existing env varsa skip (already exists).
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function buildPoolerUrl(direct) {
  const m = direct.match(/^postgresql:\/\/([^:]+):([^@]+)@db\.([^.]+)\.supabase\.co:5432\/postgres/);
  if (!m) return direct;
  const [, , pass, projectRef] = m;
  return `postgresql://postgres.${projectRef}:${encodeURIComponent(pass)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
}

const env = {
  ...parseEnv(path.resolve(process.cwd(), '.env')),
  ...parseEnv(path.resolve(process.cwd(), '.env.local')),
};

const VARS = {
  // Plain
  NEXT_PUBLIC_STAGING_MODE: 'true',
  NEXT_PUBLIC_APP_URL: 'https://petstockpro.com',
  NEXT_PUBLIC_APP_DOMAIN: 'petstockpro.com',
  NEXT_PUBLIC_SITE_URL: 'https://petstockpro.com',
  BOOTSTRAP_SKIP: '1',
  STAGING_DEMO_BAYI_EMAIL: 'demo-bayi@petstockpro.local',
  STAGING_DEMO_BAYI_PASSWORD: 'DemoBayi123!',
  CF_VECTORIZE_INDEX: 'petstockpro-user-manual',
  NEXT_PUBLIC_SUPABASE_URL: env.SUPABASE_URL || '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '',
  // Secrets (from .env)
  DATABASE_URL: env.DATABASE_URL ? buildPoolerUrl(env.DATABASE_URL) : '',
  AUTH_SECRET: env.AUTH_SECRET || '',
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || '',
  BREVO_API_KEY: env.BREVO_API_KEY || '',
  BREVO_SENDER_EMAIL: env.BREVO_SENDER_EMAIL || '',
  BREVO_SENDER_NAME: env.BREVO_SENDER_NAME || '',
  CF_ACCOUNT_ID: env.CF_ACCOUNT_ID || '',
  CF_API_TOKEN: env.CF_API_TOKEN || '',
  OPENAI_API_KEY: env.OPENAI_API_KEY || '',
  CRON_SECRET: env.CRON_SECRET || '',
};

let added = 0, skipped = 0, errored = 0;
for (const [key, value] of Object.entries(VARS)) {
  if (!value) {
    console.log(`  ⊘ ${key}: boş, skip`);
    skipped++;
    continue;
  }
  // vercel env add KEY production (interactive) → stdin pipe ile value
  const res = spawnSync('vercel', ['env', 'add', key, 'production'], {
    input: value + '\n',
    encoding: 'utf8',
    shell: true,
  });
  const out = (res.stdout || '') + (res.stderr || '');
  if (res.status === 0) {
    console.log(`  ✓ ${key}`);
    added++;
  } else if (/already exists/i.test(out)) {
    console.log(`  ⊙ ${key}: zaten var`);
    skipped++;
  } else {
    console.log(`  ✕ ${key}: ${out.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 100)}`);
    errored++;
  }
}
console.log(`\nÖzet: ${added} eklendi, ${skipped} skip, ${errored} hata`);
