'use client';

import { useActionState } from 'react';
import { runInspectorQueryAction, type DbInspectorState } from './actions';

const PRESET_QUERIES = [
  {
    label: 'En son 10 kullanıcı',
    sql: "SELECT id, email, role, created_at FROM petstockpro.users ORDER BY created_at DESC LIMIT 10",
  },
  {
    label: 'Aktif tenant + plan',
    sql: "SELECT id, name, plan, storefront_status, created_at FROM petstockpro.companies ORDER BY created_at DESC LIMIT 20",
  },
  {
    label: 'Son 20 stok hareketi',
    sql: "SELECT id, type, subtype, quantity, before_qty, after_qty, performed_as_superadmin, created_at FROM petstockpro.stock_movements ORDER BY created_at DESC LIMIT 20",
  },
  {
    label: 'Son 20 audit kaydı (süperadmin)',
    sql: "SELECT action, superadmin_action_type, superadmin_reason, created_at FROM petstockpro.audit_logs WHERE performed_as_superadmin = true ORDER BY created_at DESC LIMIT 20",
  },
  {
    label: 'Negatif stok satırları',
    sql: "SELECT bi.branch_id, bi.variant_id, bi.stock_qty FROM petstockpro.branch_inventory bi WHERE bi.stock_qty < 0",
  },
  {
    label: 'Tenant başına ürün sayısı',
    sql: "SELECT c.name, COUNT(p.id)::int AS product_count FROM petstockpro.companies c LEFT JOIN petstockpro.products p ON p.company_id = c.id AND p.deleted_at IS NULL GROUP BY c.id, c.name ORDER BY product_count DESC LIMIT 20",
  },
];

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (v instanceof Date) return v.toLocaleString('tr-TR');
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 100);
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  const s = String(v);
  return s.length > 100 ? s.slice(0, 97) + '…' : s;
}

export function DbInspectorClient() {
  const [state, formAction, pending] = useActionState<DbInspectorState | null, FormData>(
    runInspectorQueryAction,
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="rounded-2xl border border-line bg-paper p-5">
        <label htmlFor="sql" className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-cart">
          SQL Query (SELECT-only · max 100 satır · 5sn timeout)
        </label>
        <textarea
          id="sql"
          name="sql"
          rows={6}
          required
          minLength={10}
          maxLength={2000}
          disabled={pending}
          defaultValue={state?.sql ?? "SELECT id, email, role FROM petstockpro.users LIMIT 10"}
          data-testid="sql-input"
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-[13.5px] focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          spellCheck={false}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[12px] text-ink-4">
            Yasak: DROP / DELETE / UPDATE / INSERT / TRUNCATE / ALTER / CREATE / GRANT / SET …
            Her query audit&apos;e yazılır.
          </p>
          <button
            type="submit"
            disabled={pending}
            data-testid="run-btn"
            className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:-translate-y-0.5 transition-transform disabled:opacity-60"
          >
            {pending ? '⏳ Çalışıyor...' : '▶ Çalıştır'}
          </button>
        </div>
      </form>

      <details className="rounded-2xl border border-line bg-paper p-4" data-testid="presets">
        <summary className="cursor-pointer text-xs font-bold text-cart">
          📋 Hazır query&apos;ler ({PRESET_QUERIES.length})
        </summary>
        <ul className="mt-3 flex flex-col gap-2">
          {PRESET_QUERIES.map((q, i) => (
            <li key={i}>
              <button
                type="button"
                data-testid={`preset-${i}`}
                onClick={(e) => {
                  const ta = e.currentTarget.closest('form, body')?.querySelector(
                    '#sql',
                  ) as HTMLTextAreaElement | null;
                  if (ta) ta.value = q.sql;
                  const inputEvent = new Event('input', { bubbles: true });
                  ta?.dispatchEvent(inputEvent);
                }}
                className="block w-full rounded-lg border border-line bg-paper px-3 py-2 text-left text-[13px] hover:border-cat hover:bg-cat-soft/30 transition-colors"
              >
                <span className="font-bold text-cart">{q.label}</span>
                <code className="block mt-1 text-[11.5px] text-ink-3 truncate">{q.sql}</code>
              </button>
            </li>
          ))}
        </ul>
      </details>

      {state?.error && (
        <div
          role="alert"
          data-testid="error-banner"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
        >
          ✕ {state.error}
          {state.issues && state.issues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[12.5px] font-normal">
              {state.issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state?.ok && state.rows && (
        <article
          className="rounded-2xl border border-arrow/30 bg-paper p-4"
          data-testid="result-panel"
        >
          <div className="mb-3 flex items-center justify-between text-[13px] text-ink-3">
            <span>
              <strong className="text-arrow-7">{state.rowCount}</strong> satır ·{' '}
              <strong>{state.durationMs}ms</strong>
              {state.truncated && (
                <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 font-bold text-danger-7">
                  ⚠ 100 satırda kesildi
                </span>
              )}
            </span>
            <span className="font-mono text-[11.5px] text-ink-4">
              {state.columns?.length ?? 0} kolon
            </span>
          </div>
          {state.rows.length === 0 ? (
            <p className="rounded-lg border border-line bg-paper p-4 text-center text-xs text-ink-3">
              0 satır döndü.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    {state.columns?.map((c) => (
                      <th
                        key={c}
                        className="border-b-2 border-line bg-paper px-2 py-1.5 text-left font-bold text-cart whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-line-soft hover:bg-paper">
                      {state.columns?.map((c) => (
                        <td
                          key={c}
                          className="px-2 py-1.5 font-mono text-[12px] text-ink-2 align-top"
                        >
                          {formatCell(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
