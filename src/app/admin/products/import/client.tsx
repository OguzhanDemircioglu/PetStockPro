'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import ExcelJS from 'exceljs';
import {
  validateImport,
  mapRawRow,
  type ValidationResult,
  type ValidationContext,
  type NormalizedRow,
} from '@/lib/products/import-validate';
import { swalError, swalHtml, swalSuccess } from '@/lib/ui/swal';

interface Props {
  existingCategoryNames: string[];
  sktRequiredCategoryNames: string[];
  existingBrandNames: string[];
  existingProductNames: string[];
  existingSkus: string[];
  existingBarcodes: string[];
  /** -1 = Infinity (PRO+) */
  planLimit: number;
  currentProductCount: number;
}

export function ImportClient(props: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const ctx: ValidationContext = {
    existingCategoryNames: props.existingCategoryNames,
    sktRequiredCategoryNames: props.sktRequiredCategoryNames,
    existingBrandNames: props.existingBrandNames,
    existingProductNamesLower: new Set(props.existingProductNames.map((n) => n.toLocaleLowerCase('tr-TR'))),
    existingSkus: new Set(props.existingSkus),
    existingBarcodes: new Set(props.existingBarcodes),
    planProductLimit: props.planLimit === -1 ? Infinity : props.planLimit,
    currentProductCount: props.currentProductCount,
  };

  async function handleFile(file: File) {
    setParsing(true);
    setResult(null);
    setFileName(file.name);

    try {
      const wb = new ExcelJS.Workbook();
      const arr = await file.arrayBuffer();
      await wb.xlsx.load(arr);
      const ws = wb.worksheets[0];
      const sheetName = ws?.name ?? '';

      // Header row 2 (template), data 3+ — ama esnek: row 1 header da olabilir
      let headerRowIdx = 2;
      const headersRow2 = ws.getRow(2).values as unknown[];
      const headersAt2 = (headersRow2 ?? []).slice(1).map((v) => String(v ?? '').trim()).filter(Boolean);
      if (headersAt2.length === 0) {
        // belki row 1
        headerRowIdx = 1;
      }
      const headerRow = ws.getRow(headerRowIdx).values as unknown[];
      const headers = (headerRow ?? []).slice(1).map((v) => String(v ?? '').trim());

      // Data rows: header'dan sonra başlar, ilk 5 örnek satır kullanıcı şablonu sildiyse zaten yok
      const rawRows: Array<Record<string, unknown>> = [];
      const startData = headerRowIdx + 1;
      for (let r = startData; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        // boş satırları atla
        const vals = (row.values as unknown[]).slice(1);
        const allEmpty = vals.every((v) => v === null || v === undefined || String(v).trim() === '');
        if (allEmpty) continue;
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          if (h) obj[h] = vals[i];
        });
        rawRows.push(mapRawRow(obj));
      }

      const validation = validateImport({
        fileName: file.name,
        fileSize: file.size,
        sheetName,
        headers,
        rawRows,
        ctx,
      });
      setResult(validation);

      // Dosya seviyesinde bloker varsa modal
      const blocker = validation.fileErrors.filter((e) => e.code !== 'header_extra');
      if (blocker.length > 0) {
        await swalError(
          'Excel yüklenemedi',
          blocker.map((e) => e.message).join('\n'),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
      await swalError('Excel okunamadı', msg);
    } finally {
      setParsing(false);
    }
  }

  async function handleUpload() {
    if (!result) return;
    const validRows = result.rows
      .filter((r) => r.errors.length === 0 && r.normalized)
      .map((r) => r.normalized as NormalizedRow);

    if (validRows.length === 0) {
      await swalError('Yüklenecek satır yok', 'Tüm satırlarda hata var. Düzeltip tekrar yükle.');
      return;
    }

    const { error, valid, total } = result.summary;
    let confirmed = true;
    if (error > 0) {
      confirmed = await swalHtml({
        title: `⚠ ${error} satırda hata var`,
        icon: 'warning',
        html: `
          <div style="text-align:left;font-size:14px;line-height:1.6">
            <div><b>Geçerli:</b> ${valid} satır</div>
            <div><b>Hatalı:</b> ${error} satır (atlanacak)</div>
            <div><b>Toplam:</b> ${total} satır</div>
          </div>
          <div style="margin-top:12px;font-size:13px;color:#6b7280">
            Sadece geçerli ${valid} satır yüklenecek. Hatalıları düzeltip yeniden yükleyebilirsin.
          </div>
        `,
        confirmText: `Sadece ${valid} satırı yükle`,
        cancelText: 'İptal',
      });
    } else {
      confirmed = await swalHtml({
        title: '✅ Yükleme onayı',
        icon: 'question',
        html: `<div style="font-size:14px"><b>${valid} ürün</b> yüklenecek.<br/>Vitrin başlangıçta kapalı olur — sonradan tek tek "Satışa Aç" ile yayınlayabilirsin.</div>`,
        confirmText: `${valid} ürünü yükle →`,
        cancelText: 'İptal',
      });
    }

    if (!confirmed) return;

    startTransition(async () => {
      try {
        const res = await fetch('/api/products/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: validRows }),
        });
        const data = (await res.json()) as { ok?: boolean; inserted?: number; error?: string };
        if (res.ok && data.ok) {
          await swalSuccess(
            `✅ ${data.inserted} ürün eklendi`,
            'Vitrin başlangıçta kapalı — Ürünler sayfasından her birine görsel ekleyip "Satışa Aç" yapabilirsin.',
          );
          window.location.href = '/admin/products';
        } else {
          await swalError('Yükleme başarısız', data.error ?? 'Bilinmeyen hata');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
        await swalError('Yükleme başarısız', msg);
      }
    });
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={'/admin/products' as never} className="text-xs text-ink-4 hover:text-cart">
            ← Ürünlere dön
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-cart">
            📥 Excel&apos;den ürün içeri aktar
          </h1>
          <p className="mt-2 text-[14px] text-ink-2">
            Şablonu indir, doldur, yükle. <strong>Vitrin başlangıçta kapalı</strong> olur —
            sonradan görsel ekleyip <em>Satışa Aç</em> ile yayınlanır.
          </p>
        </div>
        <a
          href="/admin/products/import/template"
          download
          className="inline-flex items-center gap-2 rounded-xl border border-cat/40 bg-cat-soft px-4 py-2.5 text-[13.5px] font-bold text-cat-7 hover:bg-cat hover:text-white"
        >
          📥 Şablonu indir (.xlsx)
        </a>
      </header>

      {/* DROP-ZONE */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        data-testid="import-dropzone"
        className="cursor-pointer rounded-2xl border-2 border-dashed border-cat/40 bg-cat-soft/30 p-10 text-center transition-colors hover:bg-cat-soft/60"
      >
        <div className="text-4xl">📤</div>
        <p className="mt-2 text-[15px] font-bold text-cart">
          {fileName ?? 'Excel dosyasını buraya sürükle veya tıkla'}
        </p>
        <p className="mt-1 text-[12.5px] text-ink-3">.xlsx · max 5 MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={onPick}
        />
      </div>

      {parsing && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-[13.5px] font-bold text-arrow-7">
          ⏳ Excel okunuyor…
        </div>
      )}

      {result && (
        <ResultSummary
          result={result}
          onUpload={handleUpload}
          uploading={isPending}
        />
      )}
    </main>
  );
}

function ResultSummary({
  result,
  onUpload,
  uploading,
}: {
  result: ValidationResult;
  onUpload: () => void;
  uploading: boolean;
}) {
  const blocker = result.fileErrors.filter((e) => e.code !== 'header_extra');
  if (blocker.length > 0) {
    return (
      <div className="rounded-2xl border border-danger/40 bg-danger-soft p-5" data-testid="import-blocker">
        <h2 className="text-[15px] font-bold text-danger-7">Excel yüklenemedi</h2>
        <ul className="mt-2 flex flex-col gap-1 text-[13.5px] text-danger-7">
          {blocker.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      </div>
    );
  }

  const { total, valid, error } = result.summary;

  return (
    <div className="flex flex-col gap-4" data-testid="import-result">
      {/* Özet bar */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Toplam" value={total} tone="ink" />
        <SummaryCard label="Geçerli" value={valid} tone="success" />
        <SummaryCard label="Hatalı" value={error} tone="error" />
      </div>

      {/* Aksiyon */}
      {valid > 0 && (
        <button
          type="button"
          onClick={onUpload}
          disabled={uploading}
          data-testid="import-upload-btn"
          className="self-start inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-3 text-[14px] font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-px transition-transform disabled:opacity-60"
        >
          {uploading ? '⏳ Yükleniyor…' : `${valid} ürünü yükle →`}
        </button>
      )}

      {result.fileErrors
        .filter((e) => e.code === 'header_extra')
        .map((e, i) => (
          <div
            key={i}
            className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-2 text-[13px] text-arrow-7"
          >
            {e.message}
          </div>
        ))}

      {/* Satır tablosu */}
      <div className="overflow-hidden rounded-2xl border border-line bg-paper">
        <table className="w-full text-[13px]">
          <thead className="bg-line-soft text-left text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
            <tr>
              <th className="w-16 px-3 py-2">Satır</th>
              <th className="w-12 px-3 py-2">Durum</th>
              <th className="px-3 py-2">Ürün Adı</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Hatalar / Uyarılar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.rows.map((r) => {
              const ok = r.errors.length === 0;
              const tone = ok ? (r.warnings.length > 0 ? 'warning' : 'success') : 'error';
              return (
                <tr
                  key={r.rowNumber}
                  data-testid={`import-row-${r.rowNumber}`}
                  data-status={tone}
                  className={ok ? '' : 'bg-danger-soft/30'}
                >
                  <td className="px-3 py-2 font-mono text-ink-3">{r.rowNumber}</td>
                  <td className="px-3 py-2 text-center">
                    {tone === 'success' && <span title="Geçerli">✅</span>}
                    {tone === 'warning' && <span title="Uyarı var">⚠️</span>}
                    {tone === 'error' && <span title="Hatalı">🚫</span>}
                  </td>
                  <td className="px-3 py-2">{String(r.raw.name ?? '—')}</td>
                  <td className="px-3 py-2 font-mono text-[12.5px]">
                    {String(r.raw.sku ?? '—')}
                  </td>
                  <td className="px-3 py-2">
                    {r.errors.length === 0 && r.warnings.length === 0 && r.info.length === 0 && (
                      <span className="text-ink-4">—</span>
                    )}
                    <ul className="flex flex-col gap-0.5">
                      {r.errors.map((e, i) => (
                        <li key={`e-${i}`} className="text-[12.5px] text-danger-7">
                          🚫 {e.message.replace(`Satır ${r.rowNumber} · `, '')}
                        </li>
                      ))}
                      {r.warnings.map((e, i) => (
                        <li key={`w-${i}`} className="text-[12.5px] text-arrow-7">
                          {e.message.replace(`Satır ${r.rowNumber} · `, '')}
                        </li>
                      ))}
                      {r.info.map((e, i) => (
                        <li key={`i-${i}`} className="text-[12.5px] text-cat-7">
                          {e.message.replace(`Satır ${r.rowNumber} · `, '')}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ink' | 'success' | 'error';
}) {
  const cls =
    tone === 'success'
      ? 'border-arrow/40 bg-arrow-soft text-arrow-7'
      : tone === 'error'
        ? 'border-danger/40 bg-danger-soft text-danger-7'
        : 'border-line bg-paper text-cart';
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-[11.5px] font-bold uppercase tracking-wider opacity-75">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}
