'use client';

import { useState } from 'react';
import { downloadRecoveryCodesTxt } from '@/lib/auth/recovery-codes';

interface Props {
  codes: readonly string[];
  /** TXT başlığında geçer (opsiyonel). */
  email?: string;
  /** İndirilen dosya adı (default: `petstockpro-yedek-kodlar.txt`). */
  filename?: string;
}

/**
 * Recovery code listesi için ortak 3-buton paneli: Kopyala / TXT indir / Yazdır.
 *
 * Tüketiciler:
 * - /2fa-setup wizard step 3
 * - /admin/security regenerate panel
 *
 * Davranış:
 * - "📋 Kopyala" → clipboard'a `\n`-ayrılmış liste yazar, 2 sn "✓ Kopyalandı" feedback.
 * - "📥 TXT indir" → `formatRecoveryCodesAsText` ile dosya, anchor click ile download.
 * - "🖨 Yazdır" → `window.print()` (kullanıcı sayfa içeriğini yazdırır).
 */
export function RecoveryCodesActions({ codes, email, filename }: Props) {
  const [copied, setCopied] = useState(false);
  const safeFilename = filename ?? 'petstockpro-yedek-kodlar.txt';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API yoksa sessizce yut (download yedek)
    }
  };

  const handleDownload = () => {
    downloadRecoveryCodesTxt(codes, safeFilename, { email });
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        data-testid="recovery-copy"
        onClick={handleCopy}
        className="rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-ink-2 transition-colors hover:bg-line-soft"
      >
        {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
      </button>
      <button
        type="button"
        data-testid="recovery-download"
        onClick={handleDownload}
        className="rounded-xl border border-cat/30 bg-cat-soft px-3 py-2.5 text-xs font-bold text-cart transition-colors hover:bg-cat hover:text-white"
      >
        📥 TXT indir
      </button>
      <button
        type="button"
        data-testid="recovery-print"
        onClick={() => window.print()}
        className="rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-ink-2 transition-colors hover:bg-line-soft"
      >
        🖨 Yazdır
      </button>
    </div>
  );
}
