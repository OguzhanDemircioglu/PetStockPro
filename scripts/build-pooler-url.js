// Supabase direct connection URL'i Transaction Pooler URL'ine çevirir.
// Workers TCP outbound için pooler zorunlu (direct connection IPv6/sync TCP destekler ama Workers değil).
// Output: stdout'a pooler URL (secret upload için pipe edilir).
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

const env = parseEnv(path.resolve(process.cwd(), '.env'));
const direct = env.DATABASE_URL;
if (!direct) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

// postgresql://USER:PASS@db.PROJECT_REF.supabase.co:5432/postgres
const match = direct.match(/^postgresql:\/\/([^:]+):([^@]+)@db\.([^.]+)\.supabase\.co:5432\/postgres/);
if (!match) {
  console.error('DATABASE_URL Supabase direct connection değil:', direct.replace(/:[^@]+@/, ':***@').slice(0, 80));
  process.exit(1);
}
const [, user, pass, projectRef] = match;

// Region — Frankfurt EU (CLAUDE.md: Supabase region eu-central-1)
const region = 'eu-central-1';
// Transaction pooler — port 6543, username format: postgres.PROJECT_REF
// NOT: Region prefix Supabase Dashboard'tan doğrulanır (aws-0 / aws-1 / aws-2)
// PetStockPro project'i için aws-1 (Dashboard'tan kontrol edildi 2026-05-23)
const poolerUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(pass)}@aws-1-${region}.pooler.supabase.com:6543/postgres`;

process.stdout.write(poolerUrl);
