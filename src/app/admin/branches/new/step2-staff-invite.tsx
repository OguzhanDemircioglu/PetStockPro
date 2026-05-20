'use client';

/**
 * Faz 7 (2026-05-21) — Yeni şube wizard Step 2: "Çalışan ekle veya atla".
 *
 * Plan §7.1 — Mini invite formu STAFF rolünde (Çalışan), opsiyonel.
 * Atla seçeneği için SWAL uyarı: "Tek başına 2 şubeyi yönetmek zor olabilir".
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import { inviteUserAction, type InviteUserState } from '../../settings/users/actions';

interface Props {
  branchId: string;
  branchName: string;
}

export function Step2StaffInvite({ branchId, branchName }: Props) {
  const router = useRouter();
  const [state, setState] = useState<InviteUserState | null>(null);
  const [pending, startTransition] = useTransition();
  const [emailValue, setEmailValue] = useState('');
  const [nameValue, setNameValue] = useState('');
  useSwalOnError(state ?? null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState(null);
    const fd = new FormData();
    fd.set('email', emailValue);
    if (nameValue) fd.set('name', nameValue);
    fd.set('role', 'STAFF');
    fd.set('branchId', branchId);

    startTransition(async () => {
      const result = await inviteUserAction(null, fd);
      setState(result);
      if (result.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Çalışan davet edildi',
          html:
            `<div class="text-sm"><strong>${result.email}</strong> için 24 saat geçerli link üretildi.</div>` +
            (result.acceptUrl
              ? `<input class="mt-3 w-full rounded border border-line bg-paper px-2 py-1 text-xs font-mono" readonly value="${result.acceptUrl}" onclick="this.select()" />`
              : ''),
          confirmButtonText: 'Şubelere dön',
        });
        router.push('/admin/branches?created=success');
      }
    });
  };

  const handleSkip = async () => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Çalışan eklemeden devam?',
      html:
        '<div class="text-sm text-ink-3">Birden fazla şubeyi tek başına yönetmek zor olabilir. ' +
        'Sonradan <strong>/admin/settings/users</strong> sayfasından çalışan ekleyebilirsin.</div>',
      showCancelButton: true,
      confirmButtonText: 'Atla',
      cancelButtonText: 'Form\'a dön',
      reverseButtons: true,
    });
    if (result.isConfirmed) {
      router.push('/admin/branches?created=success&staff_skipped=1');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-arrow/30 bg-arrow-soft/40 p-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✅</span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-arrow-7">
              ADIM 1 — TAMAM
            </div>
            <div className="text-sm font-bold text-arrow-7">
              {branchName} oluşturuldu
            </div>
          </div>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-line bg-paper p-5"
        data-testid="step2-staff-form"
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">💼</span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-cat">
              ADIM 2 — OPSİYONEL
            </div>
            <h2 className="text-sm font-bold text-cart">
              Bu şubeye çalışan eklemek ister misin?
            </h2>
          </div>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-3">
          Çalışan kullanıcı satış kaydeder, sayıma katılır. Diğer 12 yetkiyi sen
          tek tek açabilirsin (Kullanıcılar sayfasındaki ⚙ Yetkiler modalı).
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="step2-email"
              className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
            >
              Email *
            </label>
            <input
              id="step2-email"
              type="email"
              required
              disabled={pending}
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              data-testid="step2-email"
              aria-invalid={(!!state && !state.ok && !!state.error) || undefined}
              className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
            />
          </div>
          <div>
            <label
              htmlFor="step2-name"
              className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
            >
              İsim (opsiyonel)
            </label>
            <input
              id="step2-name"
              type="text"
              maxLength={120}
              disabled={pending}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              data-testid="step2-name"
              className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending}
            data-testid="step2-skip"
            className="rounded-xl border border-line bg-paper px-4 py-2 text-[12.5px] font-bold text-ink-3 hover:bg-line-soft"
          >
            ⏭ Atla, sonra eklerim
          </button>
          <button
            type="submit"
            disabled={pending || emailValue.length === 0}
            data-testid="step2-submit"
            className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2 text-[13px] font-bold text-white shadow-sm hover:-translate-y-0.5 transition-transform disabled:opacity-60"
          >
            {pending ? '⏳ Davet üretiliyor...' : '🔗 Davet linki üret'}
          </button>
        </div>
      </form>
    </div>
  );
}
