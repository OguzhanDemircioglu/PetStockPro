import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';

/**
 * Verilerimi İndir hub — KVKK Madde 11 veri taşıma hakkı.
 *
 * EKRAN-AYARLAR §2.6'da planlanan: tek sayfada tüm CSV export linkleri.
 * İlerde "Hepsini ZIP olarak indir" (Sprint 14+) ek özellik.
 *
 * Şu an her link ayrı route handler — kullanıcı dilediği veriyi tek
 * tek indirir, Excel'de TR locale ile direkt açılır (UTF-8 BOM).
 */
export default async function ExportHubPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const datasets: ExportCardProps[] = [
    {
      href: '/admin/products/export',
      emoji: '🐾',
      title: 'Ürün kataloğu',
      desc: 'Tüm ürünler — ad / kategori / marka / variant / stok / fiyat / vitrin durumu',
      filename: 'urunler-<tarih>.csv',
    },
    {
      href: '/admin/stock-movements/export',
      emoji: '📦',
      title: 'Stok hareketleri (ledger)',
      desc: 'Tüm stok hareketleri — giriş/çıkış/transfer/sayım + müşteri/tedarikçi/belge no',
      filename: 'stok-hareketleri-<tarih>.csv',
    },
    {
      href: '/admin/reports/export?days=90&kind=daily',
      emoji: '📊',
      title: 'Günlük satış raporu (90 gün)',
      desc: 'Her gün için satış adedi + ciro + işlem sayısı',
      filename: 'gunluk-satis-90gun.csv',
    },
    {
      href: '/admin/reports/export?days=90&kind=top',
      emoji: '🏆',
      title: 'En çok satan variantlar (90 gün)',
      desc: 'Top 50 variant — toplam adet + ciro + satış sayısı',
      filename: 'en-cok-satan-90gun.csv',
    },
    {
      href: '/admin/audit-log/export',
      emoji: '📜',
      title: 'Denetim kayıtları (audit log)',
      desc: 'Tüm aksiyonlar — kim ne zaman ne yaptı (KVKK 5 yıl saklama)',
      filename: 'audit-log-<tarih>.csv',
    },
    {
      href: '/admin/branches/export',
      emoji: '🏪',
      title: 'Şubeler',
      desc: 'Şube listesi — şehir / ilçe / WhatsApp / aktif variant / toplam stok',
      filename: 'subeler-<tarih>.csv',
    },
    {
      href: '/admin/suppliers/export',
      emoji: '🏢',
      title: 'Tedarikçiler',
      desc: 'Tedarikçi listesi — VKN / yetkili / IBAN / lead time / ödeme koşulu',
      filename: 'tedarikciler-<tarih>.csv',
    },
    {
      href: '/admin/categories/export',
      emoji: '📂',
      title: 'Kategoriler',
      desc: 'Kategori listesi — emoji / KDV oranı / SKT zorunluluğu / sıralama',
      filename: 'kategoriler-<tarih>.csv',
    },
    {
      href: '/admin/brands/export',
      emoji: '🏷',
      title: 'Markalar',
      desc: 'Marka listesi — slug / logo URL / ürün sayısı',
      filename: 'markalar-<tarih>.csv',
    },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
          Admin · Ayarlar · Verilerimi İndir
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Verilerimi İndir
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          KVKK Madde 11 — kişisel ve işletme verilerinizi her zaman
          indirebilirsiniz. Aşağıdaki CSV dosyaları{' '}
          <strong>Excel TR locale</strong> ile direkt açılır (UTF-8 BOM,
          noktalı virgül delimiter).
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {datasets.map((d) => (
          <ExportCard key={d.href} {...d} />
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 text-xs text-ink-3">
        <h2 className="mb-2 text-sm font-bold text-cart">ℹ Bilgi</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>İndirme limiti: her CSV dosyası en fazla 5.000 satır içerir.</li>
          <li>UTF-8 BOM + ; delimiter — Excel TR&apos;de doğru karakter görünür.</li>
          <li>
            Ledger ve audit log <strong>append-only</strong> — silinmiş
            kayıtlar da görünür (KVKK denetim için zorunlu).
          </li>
          <li>
            Veri taşıma hakkı: bu CSV&apos;leri başka bir sisteme aktarabilirsin.
          </li>
        </ul>
      </section>

      <Link
        href={'/admin/settings' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Ayarlara dön
      </Link>
    </main>
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
      className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 hover:border-cat hover:shadow-sm transition-shadow"
    >
      <span className="grid h-14 w-14 place-items-center rounded-xl bg-cat-soft text-3xl">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-cart group-hover:text-cat">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-ink-3">{desc}</p>
        <p className="mt-1 font-mono text-[10.5px] text-ink-4">{filename}</p>
      </div>
      <span className="rounded-xl bg-cat px-3 py-2 text-xs font-bold text-white group-hover:bg-cat-2">
        ⬇ İndir
      </span>
    </a>
  );
}
