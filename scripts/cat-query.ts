import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: true });
import { db } from '../src/lib/db/client';
import { categories } from '../src/db/schema';
async function m() {
  const cats = await db.select({ id: categories.id, slug: categories.slug, name: categories.name }).from(categories);
  console.log(cats.map(c => `${c.slug} - ${c.name}`).join('\n'));
  process.exit(0);
}
m();
