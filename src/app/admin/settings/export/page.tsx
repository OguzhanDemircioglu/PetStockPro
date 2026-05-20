import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { SettingsShell } from '@/components/settings-shell';

/**
 * Verilerimi İndir hub — KVKK Madde 11 veri taşıma hakkı.
 *
 * EKRAN-AYARLAR §2.6'da planlanan: tek sayfada tüm CSV export linkleri.
 * İlerde "Hepsini ZIP olarak indir" (Sprint 14+) ek özellik.
 *
 * Şu an her link ayrı route handler — kullanıcı dilediği veriyi tek tek
 * indirir, .xlsx dosyası Excel/LibreOffice'ta direkt açılır (Türkçe başlık,
 * tarih/para formatı, auto-filter, freeze header).
 */
export default async function ExportHubPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const datasets: ExportCardProps[] = [
    {
      href: '/admin/products/export',
      emoji: '',
      title: 'Ürün kataloğu',
      desc: 'Tüm ürünler — ad / kategori / marka / variant / stok / fiyat / vitrin durumu',
      filename: 'urunler-<tarih>.xlsx',
    },
    {
      href: '/admin/stock-movements/export',
      emoji: '📦',
      title: 'Stok hareketleri (ledger)',
      desc: 'Tüm stok hareketleri — giriş/çıkış/transfer/sayım + müşteri/tedarikçi/belge no',
      filename: 'stok-hareketleri-<tarih>.xlsx',
    },
    {
      href: '/admin/reports/export?days=90&kind=daily',
      emoji: '📊',
      title: 'Günlük satış raporu (90 gün)',
      desc: 'Her gün için satış adedi + ciro + işlem sayısı',
      filename: 'gunluk-satis-90gun.xlsx',
    },
    {
      href: '/admin/reports/export?days=90&kind=top',
      emoji: '🏆',
      title: 'En çok satan variantlar (90 gün)',
      desc: 'Top 50 variant — toplam adet + ciro + satış sayısı',
      filename: 'en-cok-satan-90gun.xlsx',
    },
    {
      href: '/admin/audit-log/export',
      emoji: '📜',
      title: 'Denetim kayıtları (audit log)',
      desc: 'Tüm aksiyonlar — kim ne zaman ne yaptı (KVKK 5 yıl saklama)',
      filename: 'audit-log-<tarih>.xlsx',
    },
    {
      href: '/admin/branches/export',
      emoji: '🏪',
      title: 'Şubeler',
      desc: 'Şube listesi — şehir / ilçe / WhatsApp / aktif variant / toplam stok',
      filename: 'subeler-<tarih>.xlsx',
    },
    {
      href: '/admin/suppliers/export',
      emoji: '🏢',
      title: 'Tedarikçiler',
      desc: 'Tedarikçi listesi — VKN / yetkili / IBAN / lead time / ödeme koşulu',
      filename: 'tedarikciler-<tarih>.xlsx',
    },
    {
      href: '/admin/categories/export',
      emoji: '📂',
      title: 'Kategoriler',
      desc: 'Kategori listesi — emoji / KDV oranı / SKT zorunluluğu / sıralama',
      filename: 'kategoriler-<tarih>.xlsx',
    },
    {
      href: '/admin/brands/export',
      emoji: '🏷',
      title: 'Markalar',
      desc: 'Marka listesi — slug / logo URL / ürün sayısı',
      filename: 'markalar-<tarih>.xlsx',
    },
  ];

  return (
    <SettingsShell
      current="export"
      title="Verilerimi İndir"
      description="KVKK Madde 11 — kişisel ve işletme verilerini her zaman indirebilirsin. Excel (.xlsx) dosyaları Türkçe başlıklar, tarih/para formatı ve filtre özellikleriyle hazırdır."
    >
      <div className="flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          {datasets.map((d) => (
            <ExportCard key={d.href} {...d} />
          ))}
        </div>

        <section className="rounded-2xl border border-line bg-paper p-5 text-xs text-ink-3">
          <h2 className="mb-2 text-sm font-bold text-cart">ℹ Bilgi</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>İndirme limiti: her dosya en fazla 5.000 satır içerir.</li>
            <li>
              Excel (.xlsx) format — TR locale tarih, ₺ para formatı,
              auto-filter, freeze header, zebra striping.
            </li>
            <li>
              Ledger ve audit log <strong>append-only</strong> — silinmiş
              kayıtlar da görünür (KVKK denetim için zorunlu).
            </li>
            <li>
              Veri taşıma hakkı: bu Excel dosyalarını başka bir sisteme
              aktarabilirsin (Excel/LibreOffice/Google Sheets uyumlu).
            </li>
          </ul>
        </section>
      </div>
    </SettingsShell>
  );
}

interface ExportCardProps {
  href: string;
  emoji: string;
  title: string;
  desc: string;
  filename: string;
}

function ExportCard({ href, emoji, title, desc, filename }: ExportCardProps) {
  return (
    <a
      href={href}
      download
      data-export-link={href}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-paper p-4 hover:border-cat hover:shadow-sm transition-shadow"
    >
      <span className="grid h-14 w-14 place-items-center rounded-xl bg-cat-soft text-3xl">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-cart group-hover:text-cat">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-ink-3">{desc}</p>
        <p className="mt-1 font-mono text-[12px] text-ink-4">{filename}</p>
      </div>
      <span className="rounded-xl bg-cat px-3 py-2 text-xs font-bold text-white group-hover:bg-cat-2">
        ⬇ İndir
      </span>
    </a>
  );
}
