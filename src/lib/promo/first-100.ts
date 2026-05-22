/**
 * İlk 100 Promo helper'ları.
 *
 * Kural:
 *   - E-posta verify olan ilk 100 BAYI_SAHIBI tenant'ı 3 ay ücretsiz PRO alır
 *   - claimPromoSlot: atomik SQL (race-condition safe, 100 cap)
 *   - getPromoStatus: UI banner için (BAYI_SAHIBI gate caller'da)
 *   - getExpiringPromos: cron T-7/T-1 hatırlatma için
 *   - revertExpiredPromos: cron T+0 plan='FREE' revert
 *
 * 2026-05-22 karar matriksi:
 *   1. Otomatik tetikleme (kayıt sırasına göre)
 *   2. E-posta verify olduğunda count
 *   3. T-7 + T-1 email + T+0 plan='FREE' otomatik revert (mevcut FREE limit reject CTA güçlenir)
 *   4. UI: Pano banner BAYI_SAHIBI only + Süperadmin metric
 *   5. Mevcut 8 test tenant promo DIŞINDA (sadece bundan sonra verify olanlar)
 */
import { sql, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { companies } from '@/db/schema';

type Db = PostgresJsDatabase<Record<string, unknown>>;

export const PROMO_SLOT_LIMIT = 100;
export const PROMO_DURATION_MONTHS = 3;
export const PROMO_REMINDER_7_DAYS = 7;
export const PROMO_REMINDER_1_DAY = 1;

export interface PromoStatus {
  /** Bu tenant promo claim etmiş mi? */
  eligible: boolean;
  /** Promo aktif mi? (until > now) */
  active: boolean;
  /** Bitiş zamanı (UTC). */
  until: Date | null;
  /** Slot numarası (1-100). */
  slotNumber: number | null;
  /** Kalan gün (active=true ise). */
  daysRemaining: number | null;
  /** Promo dolmuş ama plan revert henüz olmadı (cron geç kaldıysa). */
  expiredPendingRevert: boolean;
}

/**
 * E-posta verify anında çağrılır. Atomik UPDATE — race-condition safe.
 * Sonuç: claim edildi mi + slot numarası.
 *
 * Logic:
 *   - companyId zaten eligible ise no-op (idempotent)
 *   - Eligible count < 100 ise: bu company'ye eligible=true + plan='PRO' + until=now+3 ay set
 *   - Eligible count >= 100 ise: hiçbir şey yapma
 *
 * Tek statement, race-safe — Postgres UPDATE WHERE clause subquery aynı snapshot içinde okunur.
 */
export async function claimPromoSlot(
  db: Db,
  companyId: string,
): Promise<{ claimed: boolean; slotNumber: number | null }> {
  const result = await db.execute<{ slot: number }>(sql`
    WITH next_slot AS (
      SELECT COUNT(*) + 1 AS n
      FROM petstockpro.companies
      WHERE promo_first_100_eligible = true
    )
    UPDATE petstockpro.companies
    SET
      promo_first_100_eligible = true,
      promo_first_100_slot_number = (SELECT n FROM next_slot),
      promo_first_100_until = NOW() + (${PROMO_DURATION_MONTHS}::text || ' months')::interval,
      plan = 'PRO',
      updated_at = NOW()
    WHERE id = ${companyId}
      AND promo_first_100_eligible = false
      AND (SELECT n FROM next_slot) <= ${PROMO_SLOT_LIMIT}
    RETURNING promo_first_100_slot_number AS slot;
  `);

  const rows = result as unknown as { slot: number }[];
  if (rows.length === 0) {
    return { claimed: false, slotNumber: null };
  }
  return { claimed: true, slotNumber: rows[0].slot };
}

export async function getPromoStatus(
  db: Db,
  companyId: string,
): Promise<PromoStatus> {
  const [row] = await db
    .select({
      eligible: companies.promoFirst100Eligible,
      until: companies.promoFirst100Until,
      slotNumber: companies.promoFirst100SlotNumber,
      expiredHandledAt: companies.promoExpiredHandledAt,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!row || !row.eligible) {
    return {
      eligible: false,
      active: false,
      until: null,
      slotNumber: null,
      daysRemaining: null,
      expiredPendingRevert: false,
    };
  }

  const now = new Date();
  const until = row.until;
  const active = until !== null && until > now;
  const daysRemaining = active && until
    ? Math.max(0, Math.ceil((until.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : null;
  const expiredPendingRevert =
    !active && until !== null && until <= now && row.expiredHandledAt === null;

  return {
    eligible: row.eligible,
    active,
    until,
    slotNumber: row.slotNumber,
    daysRemaining,
    expiredPendingRevert,
  };
}

/** Süperadmin paneli için: kaç slot kullanıldı + 4 kategori sayı. */
export interface PromoSystemStats {
  totalSlotsUsed: number;
  slotsRemaining: number;
  activePromos: number;
  expiredHandled: number;  // plan='FREE' revert edildi
  expiredPending: number;  // until geçti ama cron henüz revert etmedi
}

export async function getPromoSystemStats(db: Db): Promise<PromoSystemStats> {
  const [row] = await db.execute<{
    total: number;
    active: number;
    expired_handled: number;
    expired_pending: number;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE promo_first_100_eligible)::int AS total,
      COUNT(*) FILTER (WHERE promo_first_100_eligible AND promo_first_100_until > NOW())::int AS active,
      COUNT(*) FILTER (WHERE promo_first_100_eligible AND promo_expired_handled_at IS NOT NULL)::int AS expired_handled,
      COUNT(*) FILTER (WHERE promo_first_100_eligible AND promo_first_100_until <= NOW() AND promo_expired_handled_at IS NULL)::int AS expired_pending
    FROM petstockpro.companies
  `) as unknown as Array<{ total: number; active: number; expired_handled: number; expired_pending: number }>;

  const total = row?.total ?? 0;
  return {
    totalSlotsUsed: total,
    slotsRemaining: Math.max(0, PROMO_SLOT_LIMIT - total),
    activePromos: row?.active ?? 0,
    expiredHandled: row?.expired_handled ?? 0,
    expiredPending: row?.expired_pending ?? 0,
  };
}

/**
 * Cron job: T+0 — plan='FREE' revert + idempotent mark.
 * @returns Revert edilen tenant sayısı.
 */
export async function revertExpiredPromos(db: Db): Promise<{ revertedIds: string[] }> {
  const result = await db.execute<{ id: string }>(sql`
    UPDATE petstockpro.companies
    SET
      plan = 'FREE',
      promo_expired_handled_at = NOW(),
      updated_at = NOW()
    WHERE promo_first_100_eligible = true
      AND promo_first_100_until <= NOW()
      AND promo_expired_handled_at IS NULL
    RETURNING id;
  `);
  const rows = result as unknown as { id: string }[];
  return { revertedIds: rows.map((r) => r.id) };
}

export interface ExpiringPromoInfo {
  companyId: string;
  ownerEmail: string | null;
  ownerName: string | null;
  companyName: string;
  daysRemaining: number;
  until: Date;
}

/**
 * Cron job: T-N gün öncesi hatırlatma için tenant'ları çek.
 * @param daysBeforeExpiry 7 veya 1 (T-7 veya T-1)
 * @param reminderFlag promoReminder7Sent veya promoReminder1Sent (idempotent)
 */
export async function getExpiringPromos(
  db: Db,
  daysBeforeExpiry: 7 | 1,
): Promise<ExpiringPromoInfo[]> {
  const reminderColumn = daysBeforeExpiry === 7 ? 'promo_reminder_7_sent' : 'promo_reminder_1_sent';
  // Window: T-daysBefore (1 günlük slice). Aynı gün içinde herhangi bir saat'te cron çalıştığında yakalanmalı.
  // Sliding window: until BETWEEN now + (N-1)*day AND now + N*day
  const result = await db.execute(sql.raw(`
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      c.promo_first_100_until AS until,
      u.email AS owner_email,
      u.name AS owner_name,
      EXTRACT(DAY FROM (c.promo_first_100_until - NOW()))::int AS days_remaining
    FROM petstockpro.companies c
    LEFT JOIN petstockpro.users u
      ON u.company_id = c.id AND u.role = 'BAYI_SAHIBI'
    WHERE c.promo_first_100_eligible = true
      AND c."${reminderColumn}" = false
      AND c.promo_first_100_until > NOW()
      AND c.promo_first_100_until <= NOW() + INTERVAL '${daysBeforeExpiry} days'
  `));

  const rows = result as unknown as Array<{
    company_id: string;
    company_name: string;
    until: Date;
    owner_email: string | null;
    owner_name: string | null;
    days_remaining: number;
  }>;

  return rows.map((r) => ({
    companyId: r.company_id,
    companyName: r.company_name,
    ownerEmail: r.owner_email,
    ownerName: r.owner_name,
    daysRemaining: r.days_remaining,
    until: r.until,
  }));
}

/** Hatırlatma email gönderildi → bayrağı set et (idempotent). */
export async function markReminderSent(
  db: Db,
  companyId: string,
  daysBeforeExpiry: 7 | 1,
): Promise<void> {
  if (daysBeforeExpiry === 7) {
    await db
      .update(companies)
      .set({ promoReminder7Sent: true, updatedAt: new Date() })
      .where(eq(companies.id, companyId));
  } else {
    await db
      .update(companies)
      .set({ promoReminder1Sent: true, updatedAt: new Date() })
      .where(eq(companies.id, companyId));
  }
}

/** Reject mesajı CTA için: bu tenant'ın promo geçmişi var mı? */
export async function hadPromoBefore(db: Db, companyId: string): Promise<boolean> {
  const [row] = await db
    .select({ eligible: companies.promoFirst100Eligible })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return Boolean(row?.eligible);
}

export interface ProductLimitContext {
  /** Plan limit'i aştı mı? (FREE plan'da 50 üstünde mi) */
  exceeded: boolean;
  /** Mevcut ürün sayısı. */
  currentCount: number;
  /** Plan limit'i. */
  limit: number;
  /** Tenant'ın plan'ı. */
  plan: string;
  /** Promo geçmişi var mı (UI CTA'sını değiştirir). */
  hadPromo: boolean;
  /** Promo aktif mi (eğer aktifse limit aşımı tetiklenmez). */
  promoActive: boolean;
}

/**
 * Ürün ekleme öncesi plan limit check + promo context.
 * createProduct ve benzeri action'larda guard olarak kullanılır.
 */
export async function getProductLimitContext(
  db: Db,
  companyId: string,
): Promise<ProductLimitContext> {
  // Tek query — tenant info + count + promo status
  const result = await db.execute<{
    plan: string;
    promo_eligible: boolean;
    promo_until: Date | null;
    product_count: number;
  }>(sql`
    SELECT
      c.plan,
      c.promo_first_100_eligible AS promo_eligible,
      c.promo_first_100_until AS promo_until,
      (SELECT COUNT(*)::int FROM petstockpro.products p
        WHERE p.company_id = c.id AND p.deleted_at IS NULL) AS product_count
    FROM petstockpro.companies c
    WHERE c.id = ${companyId}
  `);

  const rows = result as unknown as Array<{
    plan: string;
    promo_eligible: boolean;
    promo_until: Date | null;
    product_count: number;
  }>;

  if (rows.length === 0) {
    return {
      exceeded: false,
      currentCount: 0,
      limit: 50,
      plan: 'FREE',
      hadPromo: false,
      promoActive: false,
    };
  }

  const row = rows[0];
  const now = new Date();
  const promoActive = row.promo_eligible && row.promo_until !== null && row.promo_until > now;

  // Plan limit
  const limit = row.plan === 'PRO' ? 500 : row.plan === 'PRO_PLUS' ? Number.POSITIVE_INFINITY : 50;

  // Promo aktifken plan='PRO' olur → limit 500. Promo bittikten sonra plan='FREE' → limit 50.
  // Bu yüzden exceeded = currentCount >= limit. Promo aktifken zaten limit yüksek olduğu için sorun yok.
  const exceeded = Number.isFinite(limit) && row.product_count >= limit;

  return {
    exceeded,
    currentCount: row.product_count,
    limit,
    plan: row.plan,
    hadPromo: row.promo_eligible,
    promoActive,
  };
}
