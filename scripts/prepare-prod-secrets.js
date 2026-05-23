// Production secrets JSON üretici. Sonrasında siliniyor (gitignore).
// Usage: node scripts/prepare-prod-secrets.js > .tmp-secrets.json
const fs = require('fs');
const path = require('path');

function parseEnvFile(filepath) {
  if (!fs.existsSync(filepath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filepath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    // Strip quotes
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = {
  ...parseEnvFile(path.resolve(process.cwd(), '.env')),
  ...parseEnvFile(path.resolve(process.cwd(), '.env.local')),
};

const out = {};
const KEYS = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
  'BREVO_SENDER_NAME',
  'CF_ACCOUNT_ID',
  'CF_API_TOKEN',
  'OPENAI_API_KEY',
  'CRON_SECRET',
];
for (const k of KEYS) {
  if (env[k]) out[k] = env[k];
}

// NEXT_PUBLIC_SUPABASE_URL — SUPABASE_URL'den derive
if (env.SUPABASE_URL) out.NEXT_PUBLIC_SUPABASE_URL = env.SUPABASE_URL;
// NEXT_PUBLIC_SUPABASE_ANON_KEY — alt fallback
out.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

// Staging demo credentials (default fallback hardcoded ama explicit set'lemek temiz)
out.STAGING_DEMO_BAYI_EMAIL = 'demo-bayi@petstockpro.local';
out.STAGING_DEMO_BAYI_PASSWORD = 'DemoBayi123!';

// CF Vectorize (AI Chatbot, demo'da kullanılmaz ama referenced)
out.CF_VECTORIZE_INDEX = env.CF_VECTORIZE_INDEX || 'petstockpro-user-manual';

process.stdout.write(JSON.stringify(out, null, 2));
