/**
 * Self-service hesap silme — BAYI_SAHIBI (tenant sahibi) kendi hesabını siler.
 *
 * "Hesabımı sil" = tenant'ı soft-delete et (companies.deletedAt). Sahibin hesabı
 * tenant'ın kökü olduğu için bu aksiyon TÜM tenant'ı pasifleştirir. SUPERADMIN
 * (companyId=NULL) ve STAFF/OBSERVER bu akışı KULLANAMAZ → not_owner.
 *
 * Karar (2026-06-30):
 *   - Onay = şifre re-auth (firma adı yazma yok).
 *   - Aktif abonelik varsa silme akışının KENDİSİ sonlandırır — kullanıcıyı önce
 *     "iptal et"e zorlamayız (friction + güvensiz). Tekrarlayan tahsilatı bu projede
 *     PayTR değil bizim cron'umuz başlatır (runBillingRenewals); aboneliği
 *     status=expired yapmak çekimi kesin durdurur. Kalan ödenmiş gün YANAR (iade yok).
 *   - Soft-delete geri alınabilir (süperadmin restoreCompany + 7 gün grace) ama
 *     kullanıcıya self-restore YOK.
 *   - OPERASYONEL VERİ FİZİKSEL SİLİNİR: ürün/varyant/şube/stok hareketi/sayım/
 *     envanter/vitrin/AI/bildirim/oturum/yetki — hepsi gerçekten silinir (purge).
 *     stock_movements değişmez defter olduğu için migration 0040 ile tek istisna:
 *     SET LOCAL app.purge_mode='on' yalnız bu tx'te DELETE'e izin verir.
 *   - E-POSTA SERBEST BIRAKILIR: tüm kullanıcı satırlarının e-postası + PII'si
 *     anonimleştirilir → aynı e-posta ile TEKRAR KAYIT olunabilir (KVKK silme hakkı).
 *   - YASAL İSKELET KALIR: subscriptions + invoices + audit_logs (vergi 10y / KVKK)
 *     + users/company anonim satırları (audit/invoice FK 'restrict' onları sabitler).
 *
 * Bağlı tüketiciler:
 *   - auth: deletedAt dolu tenant'ın login'i engellenir (authorizeCredentials).
 *   - renewals cron: deletedAt IS NULL guard (silinmiş tenant asla çekilmez).
 *   - vitrin public + süperadmin tenant listesi: deletedAt filtreleri (mevcut).
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { companies, subscriptions, users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { writeAuditLog } from '@/lib/audit/log';

/**
 * Silmede sonlandırılacak abonelik statüleri — açık bir ödeme ilişkisi temsil eden
 * her şey (cron'un çekebileceği active/past_due + askı + yarım kalmış checkout).
 */
const TERMINATE_STATUSES = ['active', 'past_due', 'suspended', 'incomplete'] as const;

/**
 * "Aktif (ödenen) abonelik" sayılan statüler — UI'da silme uyarısını göstermek için
 * (incomplete hariç: henüz tahsilat yok).
 */
const LIVE_PAID_STATUSES = ['active', 'past_due', 'suspended'] as const;

export type DeleteAccountResult =
  | { ok: true; companyId: string }
  | {
      ok: false;
      reason: 'not_found' | 'not_owner' | 'wrong_password' | 'already_deleted' | 'unknown';
    };

export interface DeleteOwnAccountInput {
  userId: string;
  password: string;
}

/** Drizzle transaction client tipi (db.transaction callback parametresi). */
type Tx = Parameters<Parameters<DbClient['transaction']>[0]>[0];

/**
 * Tenant'ın operasyonel verisini FK-güvenli sırada (children → parents) FİZİKSEL siler.
 * KEEP: subscriptions, invoices, audit_logs (yasal/finansal) + users/company (anonim
 * iskelet). stock_movements silinebilmesi için çağıran tx'te SET LOCAL app.purge_mode='on'
 * olmalı (migration 0040 — değişmez defterin tek istisnası: hesap purge'ü).
 */
async function purgeTenantOperationalData(tx: Tx, companyId: string): Promise<void> {
  await tx.execute(sql`DELETE FROM petstockpro.stock_movements WHERE company_id = ${companyId}`);
  await tx.execute(sql`DELETE FROM petstockpro.stocktakes WHERE company_id = ${companyId}`); // cascade: stocktake_items
  await tx.execute(sql`DELETE FROM petstockpro.vitrin_whatsapp_feedback WHERE company_id = ${companyId}`);
  await tx.execute(sql`DELETE FROM petstockpro.vitrin_reports WHERE company_id = ${companyId}`);
  await tx.execute(sql`DELETE FROM petstockpro.vitrin_events WHERE company_id = ${companyId}`);
  await tx.execute(sql`DELETE FROM petstockpro.notifications WHERE company_id = ${companyId}`);
  await tx.execute(sql`DELETE FROM petstockpro.ai_messages WHERE company_id = ${companyId}`);
  await tx.execute(sql`DELETE FROM petstockpro.ai_usage WHERE company_id = ${companyId}`);
  await tx.execute(sql`DELETE FROM petstockpro.storefront_settings WHERE company_id = ${companyId}`);
  await tx.execute(sql`DELETE FROM petstockpro.branch_inventory WHERE company_id = ${companyId}`);
  await tx.execute(
    sql`DELETE FROM petstockpro.user_permissions WHERE user_id IN (SELECT id FROM petstockpro.users WHERE company_id = ${companyId})`,
  );
  await tx.execute(
    sql`DELETE FROM petstockpro.sessions WHERE user_id IN (SELECT id FROM petstockpro.users WHERE company_id = ${companyId})`,
  );
  await tx.execute(sql`DELETE FROM petstockpro.products WHERE company_id = ${companyId}`); // cascade: product_variants, product_images
  await tx.execute(sql`DELETE FROM petstockpro.suppliers WHERE company_id = ${companyId}`);
  await tx.execute(sql`DELETE FROM petstockpro.branches WHERE company_id = ${companyId}`);
}

/**
 * Tenant sahibinin kendi hesabını silmesi. Atomik: abonelik sonlandır + operasyonel veri
 * FİZİKSEL purge + e-posta release/anonimleştir + company soft-delete + audit. Tek transaction.
 */
export async function deleteOwnAccount(
  input: DeleteOwnAccountInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<DeleteAccountResult> {
  // 1. Kullanıcı + rol + şifre hash
  const userRows = await db
    .select({
      id: users.id,
      role: users.role,
      companyId: users.companyId,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  const user = userRows[0];
  if (!user) return { ok: false, reason: 'not_found' };

  // 2. Yalnızca tenant sahibi. SUPERADMIN (companyId=NULL) + STAFF/OBSERVER → not_owner.
  if (user.role !== 'BAYI_SAHIBI' || !user.companyId) {
    return { ok: false, reason: 'not_owner' };
  }
  const companyId = user.companyId;

  // 3. Şifre re-auth
  if (!user.passwordHash) return { ok: false, reason: 'wrong_password' };
  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) return { ok: false, reason: 'wrong_password' };

  // 4. Tenant durumu
  const companyRows = await db
    .select({ id: companies.id, deletedAt: companies.deletedAt })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const company = companyRows[0];
  if (!company) return { ok: false, reason: 'not_found' };
  if (company.deletedAt) return { ok: false, reason: 'already_deleted' };

  // 5. Tek transaction
  try {
    await db.transaction(async (tx) => {
      // 5a. Immutable ledger purge-mode aç (YALNIZ bu tx) — stock_movements fiziksel
      //     silinebilsin (migration 0040). SET LOCAL tx commit/rollback'te sıfırlanır.
      await tx.execute(sql`SET LOCAL app.purge_mode = 'on'`);

      // 5b. Canlı abonelik(ler)i anında sonlandır (kalan ödenmiş gün yanar). KEEP — yasal.
      //     status=expired → findDueSubscriptions 'due' saymaz → çekim imkânsız.
      const liveSubs = await tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.companyId, companyId),
            inArray(subscriptions.status, [...TERMINATE_STATUSES]),
          ),
        );
      for (const sub of liveSubs) {
        await tx
          .update(subscriptions)
          .set({
            status: 'expired',
            cancelAtPeriodEnd: true,
            cancelledAt: now,
            pendingMerchantOid: null,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));
        await writeAuditLog(
          {
            companyId,
            userId: user.id,
            action: 'subscription.cancelled',
            entityType: 'subscription',
            entityId: sub.id,
            afterState: { status: 'expired', reason: 'account_deleted' },
          },
          tx,
          now,
        );
      }

      // 5c. Operasyonel veriyi FİZİKSEL purge et (ürün/varyant/şube/stok/sayım/vitrin/
      //     AI/oturum/yetki...). Yalnız subscriptions/invoices/audit_logs + anonim
      //     users/company kalır.
      await purgeTenantOperationalData(tx, companyId);

      // 5d. PII erasure + e-posta serbest bırak (KVKK silme hakkı + aynı e-posta ile
      //     tekrar kayıt). Tenant'ın TÜM kullanıcılarının e-postası benzersiz bir
      //     'deleted_<id>@deleted.invalid'e çevrilir + kimlik/PII temizlenir. users.email
      //     UNIQUE artık orijinali serbest bırakır → registerNewTenant aynı e-postayı kabul eder.
      //     (users satırı audit_logs.userId RESTRICT nedeniyle KALIR; anonim iskelet.)
      await tx
        .update(users)
        .set({
          email: sql`concat('deleted_', ${users.id}, '@deleted.invalid')`,
          passwordHash: null,
          name: null,
          branchId: null,
          pendingEmail: null,
          pendingEmailToken: null,
          emailVerificationToken: null,
          passwordResetToken: null,
          twoFactorSecret: null,
          twoFactorSetupSecret: null,
          twoFactorRecoveryCodes: null,
          updatedAt: now,
        })
        .where(eq(users.companyId, companyId));

      // 5c. Plan FREE + company soft-delete
      await tx
        .update(companies)
        .set({ plan: 'FREE', deletedAt: now, updatedAt: now })
        .where(eq(companies.id, companyId));
      await writeAuditLog(
        {
          companyId,
          userId: user.id,
          action: 'company.self_deleted',
          entityType: 'company',
          entityId: companyId,
          afterState: { deletedAt: now.toISOString(), terminatedSubscriptions: liveSubs.length },
        },
        tx,
        now,
      );
    });
    return { ok: true, companyId };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Tenant'ın canlı (ödenen) bir aboneliği var mı? — silme onayında "abonelik iptal
 * edilecek" uyarısını koşullu göstermek için.
 */
export async function hasActivePaidSubscription(
  companyId: string,
  db: DbClient,
): Promise<boolean> {
  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.companyId, companyId),
        inArray(subscriptions.status, [...LIVE_PAID_STATUSES]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
