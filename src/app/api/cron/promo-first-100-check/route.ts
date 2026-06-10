/**
 * İlk 100 Promo cron endpoint — günlük 09:00 TR (06:00 UTC) çalışır.
 *
 * 3 iş yapar (sırayla, idempotent):
 *   1. T-7 hatırlatma email (promo_reminder_7_sent = false ve until <= now + 7 gün)
 *   2. T-1 hatırlatma email (promo_reminder_1_sent = false ve until <= now + 1 gün)
 *   3. T+0 plan='FREE' revert + bitiş email (until <= now ve expired_handled_at IS NULL)
 *
 * Auth: Bearer CRON_SECRET (wrangler scheduled binding).
 *
 * Manuel test (dev):
 *   curl -X POST http://localhost:3000/api/cron/promo-first-100-check \
 *     -H "Authorization: Bearer dev-cron-secret"
 */
import { db } from '@/lib/db/client';
import {
  getExpiringPromos,
  markReminderSent,
  revertExpiredPromos,
} from '@/lib/promo/first-100';
import { sendBrevoEmail } from '@/lib/brevo/client';
import {
  buildPromoReminderTemplate,
  buildPromoExpiredTemplate,
} from '@/lib/brevo/templates';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface CronStats {
  reminder7Sent: number;
  reminder1Sent: number;
  expiredReverted: number;
  expiredEmailsSent: number;
  errors: string[];
}

// Vercel Cron GET isteği gönderir → aynı POST iş mantığına yönlendir (CRON_SECRET auth aynı).
export const GET = (req: Request) => POST(req);

export async function POST(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { ok: false, reason: 'cron_disabled', hint: 'CRON_SECRET env yok' },
      { status: 503 },
    );
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const stats: CronStats = {
    reminder7Sent: 0,
    reminder1Sent: 0,
    expiredReverted: 0,
    expiredEmailsSent: 0,
    errors: [],
  };

  const upgradeUrl = `${APP_URL}/admin/settings/billing`;

  // 1. T-7 hatırlatma
  try {
    const t7 = await getExpiringPromos(db, 7);
    for (const p of t7) {
      if (!p.ownerEmail) continue;
      const productCount = await getProductCount(p.companyId);
      try {
        await sendBrevoEmail({
          to: { email: p.ownerEmail, name: p.ownerName ?? p.companyName },
          ...buildPromoReminderTemplate({
            ownerName: p.ownerName,
            companyName: p.companyName,
            daysRemaining: 7,
            promoUntil: p.until,
            upgradeUrl,
            productCount,
          }),
          tags: ['promo-first-100', 'reminder-7'],
        });
        await markReminderSent(db, p.companyId, 7);
        stats.reminder7Sent++;
      } catch (e) {
        stats.errors.push(`T-7 ${p.companyId}: ${(e as Error).message.slice(0, 100)}`);
      }
    }
  } catch (e) {
    stats.errors.push(`T-7 batch: ${(e as Error).message.slice(0, 100)}`);
  }

  // 2. T-1 hatırlatma
  try {
    const t1 = await getExpiringPromos(db, 1);
    for (const p of t1) {
      if (!p.ownerEmail) continue;
      const productCount = await getProductCount(p.companyId);
      try {
        await sendBrevoEmail({
          to: { email: p.ownerEmail, name: p.ownerName ?? p.companyName },
          ...buildPromoReminderTemplate({
            ownerName: p.ownerName,
            companyName: p.companyName,
            daysRemaining: 1,
            promoUntil: p.until,
            upgradeUrl,
            productCount,
          }),
          tags: ['promo-first-100', 'reminder-1'],
        });
        await markReminderSent(db, p.companyId, 1);
        stats.reminder1Sent++;
      } catch (e) {
        stats.errors.push(`T-1 ${p.companyId}: ${(e as Error).message.slice(0, 100)}`);
      }
    }
  } catch (e) {
    stats.errors.push(`T-1 batch: ${(e as Error).message.slice(0, 100)}`);
  }

  // 3. T+0 revert + bitiş email
  try {
    const { revertedIds } = await revertExpiredPromos(db);
    stats.expiredReverted = revertedIds.length;

    for (const companyId of revertedIds) {
      try {
        const [row] = await db.execute<{
          owner_email: string | null;
          owner_name: string | null;
          company_name: string;
          product_count: number;
        }>(sql`
          SELECT
            u.email AS owner_email,
            u.name AS owner_name,
            c.name AS company_name,
            (SELECT COUNT(*)::int FROM petstockpro.products p
              WHERE p.company_id = c.id AND p.deleted_at IS NULL) AS product_count
          FROM petstockpro.companies c
          LEFT JOIN petstockpro.users u ON u.company_id = c.id AND u.role = 'BAYI_SAHIBI'
          WHERE c.id = ${companyId}
        `) as unknown as Array<{
          owner_email: string | null;
          owner_name: string | null;
          company_name: string;
          product_count: number;
        }>;

        if (!row?.owner_email) continue;

        await sendBrevoEmail({
          to: { email: row.owner_email, name: row.owner_name ?? row.company_name },
          ...buildPromoExpiredTemplate({
            ownerName: row.owner_name,
            companyName: row.company_name,
            productCount: row.product_count,
            upgradeUrl,
          }),
          tags: ['promo-first-100', 'expired'],
        });
        stats.expiredEmailsSent++;
      } catch (e) {
        stats.errors.push(`T+0 email ${companyId}: ${(e as Error).message.slice(0, 100)}`);
      }
    }
  } catch (e) {
    stats.errors.push(`T+0 batch: ${(e as Error).message.slice(0, 100)}`);
  }

  return Response.json({ ok: true, stats }, { status: 200 });
}

async function getProductCount(companyId: string): Promise<number> {
  const result = await db.execute<{ c: number }>(sql`
    SELECT COUNT(*)::int AS c FROM petstockpro.products
    WHERE company_id = ${companyId} AND deleted_at IS NULL
  `);
  const rows = result as unknown as Array<{ c: number }>;
  return rows[0]?.c ?? 0;
}
