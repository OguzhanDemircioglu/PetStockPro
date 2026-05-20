'use client';

/**
 * Faz 6 (2026-05-21) — Çalışan yetki modal.
 *
 * Plan §6.2 — STAFF satırında "⚙ Yetkiler" buton → SWAL/custom dialog.
 * 15 toggle (3 default ON + 12 default OFF). Submit → setBulkPermissions.
 *
 * Kullanım: <PermissionsModalLauncher userId email displayName /> komponent
 * her STAFF satırında. Tıklayınca dialog açılır, hem mevcut yetki listesini
 * server'dan çeker hem submit eder.
 */

import { useState, useTransition, useEffect } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_LABELS,
  STAFF_DEFAULT_ON,
  type PermissionKey,
} from '@/lib/users/permission-keys';
import { updateUserPermissionsAction, type UpdatePermissionsState } from './actions';

interface Props {
  userId: string;
  email: string;
  displayName: string | null;
  initialEnabled: readonly string[];
}

export function PermissionsModalLauncher({
  userId,
  email,
  displayName,
  initialEnabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<UpdatePermissionsState | null>(null);
  const [pending, startTransition] = useTransition();
  const [permState, setPermState] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const k of ALL_PERMISSION_KEYS) init[k] = initialEnabled.includes(k);
    return init;
  });
  useSwalOnError(state ?? null);

  // Esc ile kapat
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const toggle = (key: PermissionKey) =>
    setPermState((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = () => {
    setState(null);
    const fd = new FormData();
    fd.set('userId', userId);
    for (const [k, v] of Object.entries(permState)) {
      if (v) fd.set(`perm.${k}`, 'on');
    }
    startTransition(async () => {
      const result = await updateUserPermissionsAction(null, fd);
      setState(result);
      if (result.ok) {
        setTimeout(() => setOpen(false), 1200);
      }
    });
  };

  const enabledCount = Object.values(permState).filter(Boolean).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`open-permissions-modal-${userId}`}
        className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[11.5px] font-bold text-cart hover:bg-cat-soft"
      >
        ⚙ Yetkiler
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Çalışan yetkileri"
          data-testid="permissions-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-paper shadow-xl">
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-cat">
                  Çalışan yetkileri
                </div>
                <h2 className="mt-1 text-lg font-bold text-cart">
                  {displayName ?? email}
                </h2>
                <p className="mt-0.5 text-[12px] text-ink-3">
                  {email} · {enabledCount} / {ALL_PERMISSION_KEYS.length} aktif
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                data-testid="permissions-modal-close"
                aria-label="Kapat"
                className="rounded-lg p-1 text-ink-3 hover:bg-line-soft"
              >
                ✕
              </button>
            </header>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {/* Default ON section */}
              <section>
                <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-arrow-7">
                  ✅ Otomatik aktif (3)
                </h3>
                <ul className="mt-2 divide-y divide-line-soft">
                  {STAFF_DEFAULT_ON.map((k) => (
                    <PermissionRow
                      key={k}
                      permKey={k}
                      enabled={permState[k]}
                      onToggle={toggle}
                      defaultOn
                    />
                  ))}
                </ul>
              </section>

              {/* Default OFF section */}
              <section className="mt-5">
                <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
                  ⚙ Bayi Admin&apos;in açtığı (12)
                </h3>
                <ul className="mt-2 divide-y divide-line-soft">
                  {ALL_PERMISSION_KEYS.filter(
                    (k) => !STAFF_DEFAULT_ON.includes(k),
                  ).map((k) => (
                    <PermissionRow
                      key={k}
                      permKey={k}
                      enabled={permState[k]}
                      onToggle={toggle}
                    />
                  ))}
                </ul>
              </section>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
              <div className="text-[12px] text-ink-3">
                {state?.ok && (
                  <span className="font-bold text-arrow-7" data-testid="permissions-saved">
                    ✓ Yetkiler güncellendi ({state.updatedCount} kayıt)
                  </span>
                )}
                {state?.error && (
                  <span className="font-bold text-danger-7">✕ {state.error}</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-bold text-ink-3 hover:bg-line-soft"
                >
                  Kapat
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={pending}
                  data-testid="permissions-modal-save"
                  className="rounded-lg bg-gradient-to-br from-cat to-cat-2 px-4 py-1.5 text-[12.5px] font-bold text-white shadow-sm hover:-translate-y-0.5 transition-transform disabled:opacity-60"
                >
                  {pending ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function PermissionRow({
  permKey,
  enabled,
  onToggle,
  defaultOn = false,
}: {
  permKey: PermissionKey;
  enabled: boolean;
  onToggle: (key: PermissionKey) => void;
  defaultOn?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="text-[10.5px] text-ink-4">{permKey}</code>
          {defaultOn && (
            <span className="rounded bg-arrow-soft px-1.5 py-0.5 text-[9px] font-bold text-arrow-7">
              DEFAULT
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[13px] text-ink">
          {PERMISSION_LABELS[permKey]}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onToggle(permKey)}
        data-testid={`perm-toggle-${permKey}`}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          enabled ? 'bg-arrow' : 'bg-line'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </li>
  );
}
