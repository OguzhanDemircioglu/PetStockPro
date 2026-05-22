'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Süperadmin Toolbox FAB — Sprint 7b.
 *
 * Sağ alt floating button. SUPERADMIN role'lü kullanıcılar her admin sayfasında görür.
 * Tıklanınca menu açılır: bağlam-aware bypass aksiyonları.
 *
 * MVP scope (Sprint 7b ilk parça):
 *   - Sürekli görünür item: Süresi geçmiş hareket geri al (admin/stock-movements ledger)
 *   - Sayfa-bazlı: hard delete (admin/products/[id]), plan override (admin/superadmin)
 *
 * Aksiyonlara tıklandığında ilgili sayfaya gider veya modal açar.
 * Modal flow + actual bypass action wiring: bypass aksiyon 1+'da implement.
 */
interface ToolboxItem {
  key: string;
  emoji: string;
  label: string;
  href: string;
  desc: string;
  danger?: boolean;
}

const ITEMS: ToolboxItem[] = [
  {
    key: 'reverse_expired',
    emoji: '↶',
    label: '24h+ hareket geri al',
    href: '/admin/superadmin/bypass/reverse-expired',
    desc: 'Süresi geçmiş stok hareketini reverse et',
    danger: true,
  },
  {
    key: 'hard_delete',
    emoji: '🗑',
    label: 'Hard delete ürün',
    href: '/admin/superadmin/bypass/hard-delete',
    desc: 'Soft-delete edilmiş ürünü gerçekten sil',
    danger: true,
  },
  {
    key: 'negative_stock',
    emoji: '⛔',
    label: 'Eksi stoğa zorla giriş',
    href: '/admin/superadmin/bypass/negative-stock',
    desc: 'Stock-out check bypass — negatif değer izin',
    danger: true,
  },
  {
    key: 'plan_override',
    emoji: '🎫',
    label: 'Plan limit override',
    href: '/admin/superadmin/bypass/plan-override',
    desc: 'Tenant plan limit\'i geçici olarak yükselt',
  },
  {
    key: 'stocktake_undo',
    emoji: '🔄',
    label: 'Sayım rollback',
    href: '/admin/superadmin/bypass/stocktake-undo',
    desc: 'Tamamlanan sayımı + üretilen stok hareketlerini geri al',
    danger: true,
  },
  {
    key: 'metadata_fix',
    emoji: '✎',
    label: 'Movement metadata düzelt',
    href: '/admin/superadmin/bypass/metadata-fix',
    desc: 'Immutable ledger reason/note düzeltmesi',
  },
  {
    key: 'db_inspector',
    emoji: '🔬',
    label: 'DB Inspector',
    href: '/admin/superadmin/db-inspector',
    desc: 'Read-only ad-hoc SELECT query runner',
  },
  {
    key: 'system_settings',
    emoji: '⚙',
    label: 'Sistem Ayarları',
    href: '/admin/superadmin/system-settings',
    desc: 'Plan tier · env durumu · DB extensions · kategoriler',
  },
];

export function SuperadminToolbox() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Süperadmin Toolbox"
        data-testid="superadmin-toolbox-fab"
        data-open={open ? '1' : '0'}
        className="fixed bottom-20 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-cat to-cat-2 text-2xl text-white shadow-[var(--shadow-cat-lg)] transition-transform hover:scale-110 md:bottom-6 md:right-6"
      >
        🛡
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          data-testid="superadmin-toolbox-backdrop"
        />
      )}

      {open && (
        <div
          className="fixed bottom-[152px] right-4 z-50 flex w-[calc(100vw-2rem)] max-w-[20rem] flex-col gap-1 rounded-2xl border-2 border-cat/40 bg-paper p-2 shadow-2xl md:bottom-24 md:right-6 md:w-80"
          data-testid="superadmin-toolbox-menu"
        >
          <div className="px-3 py-2 text-[13px] font-bold uppercase tracking-wider text-cart">
            🛡 Süperadmin · Bypass aksiyonları
          </div>
          {ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href as never}
              onClick={() => setOpen(false)}
              data-toolbox-item={item.key}
              className={`flex items-start gap-3 rounded-xl border p-2.5 hover:shadow-sm transition-shadow ${
                item.danger
                  ? 'border-danger/30 bg-danger-soft/30 hover:border-danger/60'
                  : 'border-line bg-paper hover:border-cat'
              }`}
            >
              <span className="text-xl">{item.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className={`text-[14px] font-bold ${item.danger ? 'text-danger-7' : 'text-cart'}`}>
                  {item.label}
                </div>
                <div className="text-[12px] text-ink-3">{item.desc}</div>
              </div>
            </Link>
          ))}
          <div className="mt-1 px-3 py-2 text-[11.5px] text-ink-4">
            🚨 Her aksiyon şifre re-auth + zorunlu sebep + audit damga gerektirir.
          </div>
        </div>
      )}
    </>
  );
}
