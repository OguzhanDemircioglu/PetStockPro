'use client';

import { useState, useTransition } from 'react';
import { testNilveraConnectionAction, type NilveraTestResult } from './nilvera-actions';

export function NilveraConnectionTest() {
  const [result, setResult] = useState<NilveraTestResult | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setResult(await testNilveraConnectionAction());
    });

  return (
    <div className="rounded-2xl border border-line bg-paper p-4" data-testid="nilvera-test">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-3">
          Canlı anahtarla <code className="text-cart">GET /general/Company</code> çağırır —
          satıcı hesabın ünvanı/VKN&apos;si + serie durumu.
        </p>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          data-testid="nilvera-test-btn"
          className="shrink-0 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-4 py-2.5 text-[13px] font-bold text-white shadow-[var(--shadow-cat)] disabled:opacity-60"
        >
          {pending ? 'Test ediliyor...' : 'Bağlantıyı test et'}
        </button>
      </div>

      {result && (
        <div className="mt-4 flex flex-col gap-3" data-testid="nilvera-test-result">
          <div
            className={`rounded-xl border px-3 py-2 text-[13px] font-bold ${
              result.ok
                ? 'border-arrow/40 bg-arrow-soft text-arrow-7'
                : 'border-danger/40 bg-danger-soft text-danger-7'
            }`}
          >
            {result.ok ? '✓ Bağlantı başarılı — canlı anahtar çalışıyor' : '✕ Bağlantı başarısız'}
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
            <Item label="Base URL" value={result.baseUrl} mono />
            <Item
              label="Serie (NILVERA_SERIE)"
              value={result.serieSet ? '✓ Tanımlı' : '⚠ Eksik — fatura kesilemez'}
              tone={result.serieSet ? 'ok' : 'warn'}
            />
            <Item
              label="Satıcı VKN env"
              value={result.sellerVknSet ? '✓ Tanımlı' : '⚠ Eksik'}
              tone={result.sellerVknSet ? 'ok' : 'warn'}
            />
            {result.account && (
              <>
                <Item label="Hesap ünvanı" value={result.account.name ?? '—'} />
                <Item label="Hesap VKN" value={result.account.taxNumber ?? '—'} mono />
                <Item label="Vergi dairesi" value={result.account.taxOffice ?? '—'} />
                <Item label="Şehir" value={result.account.city ?? '—'} />
                <Item
                  label="Aktif"
                  value={result.account.isActive === false ? '✕ Pasif' : '✓ Aktif'}
                  tone={result.account.isActive === false ? 'warn' : 'ok'}
                />
              </>
            )}
          </dl>

          {result.error && (
            <pre className="overflow-x-auto rounded-lg border border-danger/30 bg-danger-soft/30 px-3 py-2 text-[12px] text-danger-7">
              {result.error}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function Item({
  label,
  value,
  mono,
  tone = 'ink',
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'ink' | 'ok' | 'warn';
}) {
  const toneCls = tone === 'ok' ? 'text-arrow-7' : tone === 'warn' ? 'text-cat' : 'text-ink';
  return (
    <div>
      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-ink-4">{label}</dt>
      <dd className={`mt-0.5 font-bold ${toneCls} ${mono ? 'font-mono text-[12px]' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
