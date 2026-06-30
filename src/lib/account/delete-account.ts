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
 *   - E-POSTA SERBEST BIRAKILIR: tenant'ın tüm kullanıcılarının e-postası + PII'si
 *     anonimleştirilir → aynı e-posta ile TEKRAR KAYIT olunabilir (KVKK silme hakkı).
 *     Gerçek satır-silme bilinçli olarak İMKÂNSIZ: audit_logs + stock_movements
 *     immutability trigger (0033) DELETE'i RAISE EXCEPTION ile durdurur + invoices/
 *     movements FK 'restrict' (KVKK 5y / vergi 10y). "Komple silme" = PII erasure +
 *     e-posta release; finansal/denetim iskeleti yasal olarak korunur.
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

/**
 * Tenant sahibinin kendi hesabını silmesi. Atomik: abonelik sonlandır + plan FREE +
 * company soft-delete + audit. Tek transaction (kısmi silme imkânsız).
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
      // 5a. Canlı abonelik(ler)i anında sonlandır (kalan ödenmiş gün yanar).
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

      // 5b. PII erasure + e-posta serbest bırak (KVKK silme hakkı + aynı e-posta ile
      //     tekrar kayıt). Tenant'ın TÜM kullanıcılarının e-postası benzersiz bir
      //     'deleted_<id>@deleted.invalid'e çevrilir + kimlik/PII temizlenir. users.email
      //     UNIQUE artık orijinali serbest bırakır → registerNewTenant aynı e-postayı kabul eder.
      //     (Satır FK'leri — audit/movement — immutability trigger nedeniyle KALIR; anonim iskelet.)
      await tx
        .update(users)
        .set({
          email: sql`concat('deleted_', ${users.id}, '@deleted.invalid')`,
          passwordHash: null,
          name: null,
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
