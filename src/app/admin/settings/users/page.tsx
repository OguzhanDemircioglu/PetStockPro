import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listCompanyUsers } from '@/lib/users/manage';
import { branches, users as usersTable } from '@/db/schema';
import { SettingsShell } from '@/components/settings-shell';
import { InviteUserForm } from './invite-form';

// Faz 1 (2026-05-21) — SUBE_MUDURU → OBSERVER key rename (Migration 0021).
// Türkçe etiket "Şube Müd." → "İzleyici" Faz 3'te değişecek.
const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  BAYI_SAHIBI: { label: '🏪 Sahibi', cls: 'bg-arrow-soft text-arrow-7' },
  OBSERVER: { label: '🏪 Şube Müd.', cls: 'bg-cat-soft text-cart' },
  STAFF: { label: '💼 Kasiyer', cls: 'bg-line-soft text-ink-2' },
  SUPERADMIN: { label: '🛡 Super', cls: 'bg-danger-soft text-danger-7' },
  BAYI_ADMIN: { label: '👥 Bayi Adm', cls: 'bg-cat-soft text-cart' },
};

const METHOD_BADGE: Record<string, string> = {
  email: '📧 email',
  link: '🔗 link',
};

export default async function UsersSettingsPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const users = await listCompanyUsers(session.user.companyId, db);

  // Şubeler — her şube için mevcut OBSERVER (legacy "müdür") var mı bilgisi
  const branchRows = await db
    .select({
      id: branches.id,
      name: branches.name,
      isActive: branches.isActive,
    })
    .from(branches)
    .where(eq(branches.companyId, session.user.companyId))
    .orderBy(branches.name);
  const managerByBranchId = new Map<string, string>();
  const existingManagers = await db
    .select({ branchId: usersTable.branchId, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(and(eq(usersTable.companyId, session.user.companyId), eq(usersTable.role, 'OBSERVER')));
  for (const m of existingManagers) {
    if (m.branchId) managerByBranchId.set(m.branchId, m.name ?? m.email);
  }
  const branchOptions = branchRows
    .filter((b) => b.isActive)
    .map((b) => ({
      id: b.id,
      name: b.name,
      managerName: managerByBranchId.get(b.id) ?? null,
    }));

  const canInvite =
    session.user.role === 'BAYI_SAHIBI' || session.user.role === 'SUPERADMIN';
  const now = new Date();

  return (
    <SettingsShell
      current="users"
      title="👥 Kullanıcılar"
      description="Ekip kullanıcılarını yönet — davet et, rol ata, davet bekleyenleri takip et."
    >
      <div className="flex flex-col gap-5">
        {canInvite ? (
          <InviteUserForm branchOptions={branchOptions} />
        ) : (
          <div className="rounded-2xl border border-line bg-paper p-4 text-[13.5px] text-ink-3">
            Davet etme yetkisi sadece <strong>Sahibi</strong>&apos;ndedir.
          </div>
        )}

        <article className="rounded-2xl border border-line bg-paper p-5" data-testid="users-list">
          <h2 className="text-sm font-bold text-cart">
            👥 Ekip kullanıcıları ({users.length})
          </h2>
          {users.length === 0 ? (
            <p className="mt-3 rounded-lg bg-paper p-4 text-center text-xs text-ink-3">
              Henüz kullanıcı yok.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <th className="border-b-2 border-line bg-paper px-2 py-2 text-left font-bold text-cart">
                      Email
                    </th>
                    <th className="border-b-2 border-line bg-paper px-2 py-2 text-left font-bold text-cart">
                      İsim
                    </th>
                    <th className="border-b-2 border-line bg-paper px-2 py-2 text-left font-bold text-cart">
                      Rol
                    </th>
                    <th className="border-b-2 border-line bg-paper px-2 py-2 text-left font-bold text-cart">
                      Durum
                    </th>
                    <th className="border-b-2 border-line bg-paper px-2 py-2 text-left font-bold text-cart">
                      Davet
                    </th>
                    <th className="border-b-2 border-line bg-paper px-2 py-2 text-left font-bold text-cart">
                      Tarih
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const role = ROLE_BADGE[u.role] ?? {
                      label: u.role,
                      cls: 'bg-line-soft text-ink-3',
                    };
                    const hasPassword = !!u.passwordHash;
                    const invitePending = !hasPassword;
                    const locked = !!u.lockedUntil && new Date(u.lockedUntil) > now;
                    const invExpires = u.passwordResetExpiresAt;
                    const invExpired =
                      invitePending && invExpires
                        ? new Date(invExpires).getTime() < now.getTime()
                        : false;
                    return (
                      <tr
                        key={u.id}
                        data-user-id={u.id}
                        className="border-b border-line-soft"
                      >
                        <td className="px-2 py-2 font-bold text-ink">{u.email}</td>
                        <td className="px-2 py-2 text-ink-2">{u.name ?? '—'}</td>
                        <td className="px-2 py-2">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[11.5px] font-bold ${role.cls}`}
                          >
                            {role.label}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {locked ? (
                            <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[11.5px] font-bold text-danger-7">
                              🔒 Kilitli
                            </span>
                          ) : invitePending ? (
                            invExpired ? (
                              <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[11.5px] font-bold text-danger-7">
                                ⏱ Süresi doldu
                              </span>
                            ) : (
                              <span className="rounded-full bg-cat-soft px-1.5 py-0.5 text-[11.5px] font-bold text-cart">
                                ⏳ Davet bekliyor
                              </span>
                            )
                          ) : u.emailVerifiedAt ? (
                            <span className="rounded-full bg-arrow-soft px-1.5 py-0.5 text-[11.5px] font-bold text-arrow-7">
                              ✓ Aktif
                            </span>
                          ) : (
                            <span className="rounded-full bg-cat-soft px-1.5 py-0.5 text-[11.5px] font-bold text-cart">
                              ⚠ Email doğrulanmamış
                            </span>
                          )}
                          {u.twoFactorEnabled && (
                            <span className="ml-1 rounded-full bg-arrow-soft px-1.5 py-0.5 text-[11.5px] font-bold text-arrow-7">
                              🛡 2FA
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-[12.5px] text-ink-3">
                          {u.inviteMethod
                            ? (METHOD_BADGE[u.inviteMethod] ?? u.inviteMethod)
                            : '—'}
                        </td>
                        <td className="px-2 py-2 text-[12px] text-ink-4">
                          {new Date(u.createdAt).toLocaleDateString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
    </SettingsShell>
  );
}
