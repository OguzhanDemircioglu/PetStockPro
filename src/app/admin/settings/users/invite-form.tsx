'use client';

import { useActionState, useMemo, useState } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import { inviteUserAction, type InviteUserState } from './actions';

interface BranchOption {
  id: string;
  name: string;
  /** O şubede zaten atanmış müdür varsa adı, yoksa null */
  managerName: string | null;
}

interface Props {
  branchOptions: BranchOption[];
}

function InviteResult({ state }: { state: InviteUserState }) {
  const [copied, setCopied] = useState(false);
  if (!state.ok) return null;

  return (
    <div className="mt-3 rounded-xl border border-arrow/40 bg-arrow-soft p-4">
      <h3 className="text-sm font-bold text-arrow-7">
        ✓ {state.email} davet edildi
      </h3>
      <p className="mt-1 text-[13px] text-ink-2">
        🔗 Aşağıdaki davet linkini kullanıcıya WhatsApp / SMS / kopya-yapıştır
        ile gönder. <strong>24 saat</strong> geçerli.
      </p>
      {state.acceptUrl && (
        <div className="mt-3 flex items-stretch gap-1">
          <code
            className="flex-1 truncate rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[12.5px] text-ink-2"
            data-testid="invite-accept-url"
          >
            {state.acceptUrl}
          </code>
          <button
            type="button"
            onClick={async () => {
              if (state.acceptUrl) {
                await navigator.clipboard.writeText(state.acceptUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
            className="rounded-lg border border-cat bg-cat px-3 py-2 text-[12.5px] font-bold text-white hover:-translate-y-0.5 transition-transform"
          >
            {copied ? '✓' : '📋'} {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
        </div>
      )}
      <p className="mt-2 text-[12px] text-ink-4">
        Süresi:{' '}
        {state.expiresAt
          ? new Date(state.expiresAt).toLocaleString('tr-TR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
          : '—'}
      </p>
    </div>
  );
}

export function InviteUserForm({ branchOptions }: Props) {
  const [state, formAction, pending] = useActionState<InviteUserState | null, FormData>(
    inviteUserAction,
    null,
  );
  useSwalOnError(state);
  const [role, setRole] = useState<'SUBE_MUDURU' | 'STAFF'>('STAFF');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const hasError = !!(state && state.ok !== true && state.error);

  // SUBE_MUDURU rolündeyken: müdürü atanmamış şubeler seçilebilir
  // STAFF rolündeyken: tüm aktif şubeler seçilebilir (opsiyonel)
  const branchSelectOptions = useMemo(() => {
    if (role === 'SUBE_MUDURU') {
      // Sadece müdürsüz şubeler
      return branchOptions.map((b) => ({
        ...b,
        disabled: b.managerName !== null,
        label: b.managerName ? `${b.name} (zaten: ${b.managerName})` : b.name,
      }));
    }
    return branchOptions.map((b) => ({
      ...b,
      disabled: false,
      label: b.name,
    }));
  }, [role, branchOptions]);

  const branchRequired = role === 'SUBE_MUDURU';
  const allBranchesHaveManager =
    role === 'SUBE_MUDURU' && branchOptions.length > 0 &&
    branchOptions.every((b) => b.managerName !== null);

  return (
    <form action={formAction} className="rounded-2xl border border-line bg-paper p-5">
      <h2 className="text-sm font-bold text-cart">➕ Yeni kullanıcı davet et</h2>
      <p className="mt-1 text-[12.5px] text-ink-3">
        Davet için <strong>24 saatlik link</strong> üretilir. Link&apos;i
        kullanıcıya WhatsApp / SMS / elden ilet (email gönderilmez).
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="invite-email" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
            Email *
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            disabled={pending}
            data-testid="invite-email"
            aria-invalid={hasError || undefined}
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
          />
        </div>
        <div>
          <label htmlFor="invite-name" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
            İsim (opsiyonel)
          </label>
          <input
            id="invite-name"
            name="name"
            type="text"
            maxLength={120}
            disabled={pending}
            data-testid="invite-name"
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
            Rol *
          </label>
          <select
            id="invite-role"
            name="role"
            required
            disabled={pending}
            value={role}
            onChange={(e) => {
              setRole(e.target.value as 'SUBE_MUDURU' | 'STAFF');
              setSelectedBranchId('');
            }}
            data-testid="invite-role"
            aria-invalid={hasError || undefined}
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
          >
            <option value="STAFF">💼 Kasiyer (STAFF)</option>
            <option value="SUBE_MUDURU">🏪 Şube Müdürü</option>
          </select>
        </div>
        <div>
          <label htmlFor="invite-branch" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
            Şube {branchRequired && <span className="text-danger">*</span>}
          </label>
          <select
            id="invite-branch"
            name="branchId"
            required={branchRequired}
            disabled={pending || branchOptions.length === 0}
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            data-testid="invite-branch"
            aria-invalid={(branchRequired && hasError) || undefined}
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15 disabled:opacity-50"
          >
            <option value="">
              {branchRequired ? '— Şube seç —' : '— Atama yok (opsiyonel) —'}
            </option>
            {branchSelectOptions.map((b) => (
              <option key={b.id} value={b.id} disabled={b.disabled}>
                {b.label}
              </option>
            ))}
          </select>
          {allBranchesHaveManager && (
            <p
              role="status"
              data-testid="all-branches-have-manager"
              className="mt-1 text-[11.5px] font-bold text-bars-7"
            >
              ⚠ Tüm şubelerin zaten müdürü var — STAFF olarak davet etmen
              gerek veya önce mevcut müdürlerden birini kaldır.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[12px] text-ink-4">
          Audit log&apos;a yazılır. Şube Müdürü atandığı şubenin tüm modüllerine
          erişir; STAFF sadece satış kaydı + sayıma katılır.
        </p>
        <button
          type="submit"
          disabled={pending || (branchRequired && allBranchesHaveManager)}
          data-testid="invite-submit"
          className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:-translate-y-0.5 transition-transform disabled:opacity-60"
        >
          {pending ? '⏳ Davet hazırlanıyor...' : '🔗 Davet linki üret'}
        </button>
      </div>

      {state?.ok && <InviteResult state={state} />}
    </form>
  );
}
