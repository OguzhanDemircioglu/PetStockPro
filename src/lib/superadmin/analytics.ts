/**
 * Süperadmin Analytics — Vitrin events + Tenant activity metrics.
 *
 * Pure helper. Returns 2 stat sets for the superadmin dashboard:
 * 1) vitrin event funnel + top viewed tenants + product views breakdown
 * 2) tenant activity: DAU (24h logins) + 7g/30g actives + last-activity buckets
 */

import { sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';

export interface VitrinEventStats {
  /** Window for the stats (days). */
  windowDays: number;
  /** Funnel counts in the window. */
  profileView: number;
  productView: number;
  listingImpression: number;
  whatsappClick: number;
  /** Conversion rate (whatsapp_click / profile_view). 0–100 percent. */
  conversionRate: number;
  /** Top 5 tenants by combined views (profile + product). */
  topTenants: TopTenantByViews[];
}

export interface TopTenantByViews {
  companyId: string;
  companyName: string;
  companySlug: string;
  totalViews: number;
  whatsappClicks: number;
}

export interface TenantActivityStats {
  /** Active tenants in the last 24 hours (had any stock movement OR login). */
  activeLast24h: number;
  /** Active in last 7 days. */
  activeLast7d: number;
  /** Active in last 30 days. */
  activeLast30d: number;
  /** Distribution: never / >30d / 7-30d / 1-7d / <24h */
  distribution: {
    today: number;
    week: number;
    month: number;
    older: number;
    never: number;
  };
  /** 5 least-active tenants (oldest last-activity) — possibly churning. */
  inactiveTenants: InactiveTenant[];
}

export interface InactiveTenant {
  companyId: string;
  companyName: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  lastActivityAt: Date | null;
  daysSinceActivity: number | null;
  createdAt: Date;
}

/**
 * Vitrin events analytics (system-wide, last N days).
 *
 * Uses petstockpro.vitrin_events. Counts each event_type with COUNT(*)
 * and groups top tenants by total views.
 */
export async function getVitrinEventStats(
  db: DbClient,
  windowDays: number = 7,
): Promise<VitrinEventStats> {
  const cutoffSql = sql.raw(`(NOW() - INTERVAL '${windowDays} days')`);

  const funnelRows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN event_type = 'profile_view' THEN 1 ELSE 0 END), 0)::int AS profile_view,
      COALESCE(SUM(CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END), 0)::int AS product_view,
      COALESCE(SUM(CASE WHEN event_type = 'listing_impression' THEN 1 ELSE 0 END), 0)::int AS listing_impression,
      COALESCE(SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0)::int AS whatsapp_click
    FROM petstockpro.vitrin_events
    WHERE created_at >= ${cutoffSql}
  `)) as unknown as Array<{
    profile_view: number;
    product_view: number;
    listing_impression: number;
    whatsapp_click: number;
  }>;
  const funnel = funnelRows[0];

  const topRows = (await db.execute(sql`
    SELECT
      ve.company_id,
      c.name AS company_name,
      c.slug AS company_slug,
      COUNT(*)::int AS total_views,
      COALESCE(SUM(CASE WHEN ve.event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0)::int AS whatsapp_clicks
    FROM petstockpro.vitrin_events ve
    JOIN petstockpro.companies c ON c.id = ve.company_id
    WHERE ve.created_at >= ${cutoffSql}
      AND ve.event_type IN ('profile_view', 'product_view', 'listing_impression')
    GROUP BY ve.company_id, c.name, c.slug
    ORDER BY total_views DESC
    LIMIT 5
  `)) as unknown as Array<{
    company_id: string;
    company_name: string;
    company_slug: string;
    total_views: number;
    whatsapp_clicks: number;
  }>;

  const profileView = funnel?.profile_view ?? 0;
  const whatsappClick = funnel?.whatsapp_click ?? 0;
  const conversionRate =
    profileView > 0 ? (whatsappClick / profileView) * 100 : 0;

  return {
    windowDays,
    profileView,
    productView: funnel?.product_view ?? 0,
    listingImpression: funnel?.listing_impression ?? 0,
    whatsappClick,
    conversionRate,
    topTenants: topRows.map((r) => ({
      companyId: r.company_id,
      companyName: r.company_name,
      companySlug: r.company_slug,
      totalViews: r.total_views,
      whatsappClicks: r.whatsapp_clicks,
    })),
  };
}

/**
 * Tenant activity metrics (system-wide).
 *
 * "Active" = had at least 1 stock_movement OR audit_log entry in the window.
 * Buckets by max(stock_movements.created_at, audit_logs.created_at) per tenant.
 */
export async function getTenantActivityStats(
  db: DbClient,
): Promise<TenantActivityStats> {
  const rows = (await db.execute(sql`
    WITH last_activity AS (
      SELECT company_id, MAX(created_at) AS last_at
      FROM (
        SELECT company_id, created_at FROM petstockpro.stock_movements
        UNION ALL
        SELECT company_id, created_at FROM petstockpro.audit_logs WHERE company_id IS NOT NULL
      ) e
      GROUP BY company_id
    )
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      c.plan,
      la.last_at AS last_activity_at,
      c.created_at
    FROM petstockpro.companies c
    LEFT JOIN last_activity la ON la.company_id = c.id
    ORDER BY la.last_at DESC NULLS LAST
  `)) as unknown as Array<{
    company_id: string;
    company_name: string;
    plan: 'FREE' | 'PRO' | 'PRO_PLUS';
    last_activity_at: Date | string | null;
    created_at: Date | string;
  }>;

  const now = Date.now();
  let activeLast24h = 0;
  let activeLast7d = 0;
  let activeLast30d = 0;
  const dist = { today: 0, week: 0, month: 0, older: 0, never: 0 };

  for (const r of rows) {
    if (!r.last_activity_at) {
      dist.never += 1;
      continue;
    }
    const ageMs = now - new Date(r.last_activity_at).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const ageDays = ageHours / 24;
    if (ageHours <= 24) {
      dist.today += 1;
      activeLast24h += 1;
      activeLast7d += 1;
      activeLast30d += 1;
    } else if (ageDays <= 7) {
      dist.week += 1;
      activeLast7d += 1;
      activeLast30d += 1;
    } else if (ageDays <= 30) {
      dist.month += 1;
      activeLast30d += 1;
    } else {
      dist.older += 1;
    }
  }

  // Inactive: anything older than 7 days OR never, sorted oldest first (limit 5).
  const inactive: InactiveTenant[] = rows
    .map((r) => {
      const last = r.last_activity_at ? new Date(r.last_activity_at) : null;
      const days = last
        ? Math.floor((now - last.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        companyId: r.company_id,
        companyName: r.company_name,
        plan: r.plan,
        lastActivityAt: last,
        daysSinceActivity: days,
        createdAt: new Date(r.created_at),
      };
    })
    .filter((r) => r.daysSinceActivity === null || r.daysSinceActivity >= 7)
    .sort((a, b) => {
      // never (null) goes last; otherwise oldest first
      if (a.daysSinceActivity === null && b.daysSinceActivity === null) return 0;
      if (a.daysSinceActivity === null) return 1;
      if (b.daysSinceActivity === null) return -1;
      return b.daysSinceActivity - a.daysSinceActivity;
    })
    .slice(0, 5);

  return {
    activeLast24h,
    activeLast7d,
    activeLast30d,
    distribution: dist,
    inactiveTenants: inactive,
  };
}
