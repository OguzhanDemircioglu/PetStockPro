import Link from 'next/link';
import type { Metadata } from 'next';
import { AdminSidebar } from '@/components/admin-sidebar';

/**
 * /panel-onizleme — DB'siz STATİK bayi paneli mockup'u.
 *
 * "Login'den tıklanınca dolu görünen" önizleme. Gerçek admin paneli (/admin)
 * tenant DB'sinden beslenir; bu sayfa ise tamamen sabit (hardcoded) veriyle
 * dolu bir Pano izlenimi verir — hiçbir DB/auth bağı YOK. Böylece:
 *   - Asli /vitrin boş kalır (gerçek tenant verisi yok),
 *   - DB'de demo data tutulmaz,
 *   - Ama önizleme her zaman "dolu" görünür.
 *
 * Gerçek `AdminSidebar` (prop-only client component) yeniden kullanılır →
 * görsel olarak gerçek panele birebir benzer. Topbar burada sadeleştirilmiş
 * (NotificationBell / logout gibi DB/oturum bağımlı parçalar dışarıda).
 */
export const metadata: Metadata = {
  title: 'Bayi Paneli — Önizleme · PetStockPro',
  description: 'PetStockPro bayi yönetim panelinin canlı önizlemesi (demo veriler).',
  robots: { index: false, follow: false },
};

// ---- Statik demo veriler (hardcoded — DB yok) -------------------------------
const DEMO = {
  tenantName: 'Mavi Pet Shop',
  plan: 'PRO' as const,
  productCount: 84,
  productLimit: 500,
  lowStockCount: 3,
  unread: 2,
  todaySales: 12,
  todayRevenue: 3480,
  totalStock: 1247,
  activeVariants: 96,
  branchCount: 2,
  lowStock: [
    { product: 'Royal Canin Maxi Adult 15kg', variant: 'Standart', branch: 'Merkez Şube', qty: 2, threshold: 5 },
    { product: 'Whiskas Ton Balıklı 2kg', variant: 'Standart', branch: 'Merkez Şube', qty: 0, threshold: 8 },
    { product: 'Catit Pixi Mama Otomatı 5L', variant: 'Standart', branch: 'Kadıköy Şube', qty: 3, threshold: 5 },
  ],
  activity: [
    { icon: '📥', cls: 'bg-arrow-soft text-arrow-7', product: 'Pro Plan Tavuklu 10kg', variant: 'Standart', branch: 'Merkez Şube', sub: 'Giriş', qty: 24 },
    { icon: '📤', cls: 'bg-cat-soft text-cart', product: 'Bentonit Kedi Kumu 10L', variant: 'Lavanta', branch: 'Merkez Şube', sub: 'Satış', qty: -3 },
    { icon: '📤', cls: 'bg-cat-soft text-cart', product: 'Trixie Tüy Toplama Eldiveni', variant: 'Standart', branch: 'Kadıköy Şube', sub: 'Satış', qty: -1 },
    { icon: '🔁', cls: 'bg-line-soft text-ink-2', product: 'Acana Wild Coast 6kg', variant: 'Standart', branch: 'Merkez → Kadıköy', sub: 'Transfer', qty: 6 },
    { icon: '📋', cls: 'bg-line-soft text-ink-2', product: 'Kitten Vitamin Şurup 50ml', variant: 'Standart', branch: 'Merkez Şube', sub: 'Sayım', qty: -2 },
  ],
  orderSuggestions: [
    { product: 'Whiskas Ton Balıklı 2kg', variant: 'Standart', branch: 'Merkez Şube', stock: 0, threshold: 8, supplier: 'Royal Canin Türkiye', cost: '145', qty: 24 },
    { product: 'Royal Canin Maxi Adult 15kg', variant: 'Standart', branch: 'Merkez Şube', stock: 2, threshold: 5, supplier: 'Mama Dünyası A.Ş.', cost: '620', qty: 10 },
  ],
};

export default function PanelOnizlemePage() {
  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <AdminSidebar
        tenantName={DEMO.tenantName}
        plan={DEMO.plan}
        productCount={DEMO.productCount}
        productLimit={DEMO.productLimit}
        lowStockCount={DEMO.lowStockCount}
        unreadNotifications={DEMO.unread}
        isSuperadmin={false}
        isImpersonating={false}
      />

      <div className="flex min-h-screen flex-1 min-w-0 flex-col">
        {/* DEMO bandı — dürüstlük: bu gerçek veri değil */}
        <div
          data-testid="preview-demo-banner"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-cat/30 bg-cat-soft px-4 py-2 text-[12.5px] font-bold text-cart sm:px-6"
        >
          <span>🛡 Bayi paneli önizlemesi — örnek (demo) verilerle dolduruldu, gerçek hesap değil.</span>
          <span className="flex gap-2">
            <Link href={'/register' as never} className="rounded-lg bg-cat px-3 py-1 text-white hover:bg-cat-2">
              Ücretsiz başla
            </Link>
            <Link href={'/login' as never} className="rounded-lg border border-cat/40 bg-paper px-3 py-1 text-cart hover:bg-cat-soft">
              Giriş
            </Link>
          </span>
        </div>

        {/* Sade statik topbar (gerçek AdminTopbar'ın DB/oturum bağımlı parçaları olmadan) */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-paper/75 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15.5px] font-bold tracking-tight text-cart">Pano</div>
            <div className="hidden truncate text-[12px] font-bold text-ink-3 sm:block">Önizleme · {DEMO.tenantName}</div>
          </div>
          <Link
            href={'/vitrin' as never}
            target="_blank"
            rel="noreferrer noopener"
            className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-arrow to-arrow-2 px-3 py-2 text-[13px] font-bold text-white shadow-[var(--shadow-arrow)] hover:-translate-y-px transition-transform"
          >
            <span aria-hidden>🏪</span> Vitrin ↗
          </Link>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cat to-cart text-[12.5px] font-bold text-white border-2 border-paper">
            MP
          </span>
        </header>

        <div className="flex-1">
          <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 lg:px-6 py-8 lg:py-10">
            {/* HERO */}
            <section
              className="relative grid items-center gap-6 overflow-hidden rounded-3xl px-8 py-9 text-white shadow-[0_22px_50px_rgba(212,74,20,.32)] md:grid-cols-[1fr_auto]"
              style={{
                background:
                  'radial-gradient(circle at 88% 30%, rgba(255,255,255,.18), transparent 60%), linear-gradient(135deg, #d44a14 0%, #ed6a2c 55%, #d44a14 100%)',
              }}
            >
              <div className="absolute top-[22px] left-8 z-10 flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wider text-white/85">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-arrow-2" />
                Tüm sistemler çalışıyor
              </div>
              <div className="relative z-10 min-w-0 pt-4">
                <div className="text-[12.5px] font-bold uppercase tracking-wider opacity-85">Bugün · {DEMO.tenantName}</div>
                <h1 className="mt-3 text-3xl lg:text-4xl font-bold leading-tight tracking-tight">
                  {DEMO.todaySales} satış · {DEMO.todayRevenue.toLocaleString('tr-TR')} ₺ ciro
                </h1>
                <p className="mt-2 max-w-xl text-[15px] leading-relaxed opacity-92">
                  <strong className="rounded-md bg-white/20 px-2 py-0.5">{DEMO.lowStockCount} ürün</strong> eşik altında —
                  PetPro Asistanı sipariş + transfer önerilerini aşağıda hazırladı.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[14px] font-bold text-cart shadow-md">＋ Hızlı stok girişi</span>
                  <span className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-4 py-2.5 text-[14px] font-bold text-white backdrop-blur">Satışı detaylı gör →</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 text-[12.5px]">
                  <span className="rounded-full border border-white/30 bg-white px-3 py-1 font-bold text-cart">
                    📍 {DEMO.branchCount} aktif şube · {DEMO.totalStock.toLocaleString('tr-TR')} adet stok
                  </span>
                  <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 font-bold opacity-90">
                    {DEMO.productCount} ürün ({DEMO.productLimit})
                  </span>
                </div>
              </div>
            </section>

            <ZoneLabel emoji="⚡" label="Bu Hafta" />
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <KpiBold tone="cat" label="Bugünkü ciro" value={`${DEMO.todayRevenue.toLocaleString('tr-TR')} ₺`} sub={`${DEMO.todaySales} satış · bugün`} emoji="💰" />
              <KpiBold tone="cart" label="Toplam stok" value={DEMO.totalStock.toLocaleString('tr-TR')} sub={`${DEMO.activeVariants} aktif variant`} emoji="📦" />
              <KpiBold tone="danger" label="Düşük stok" value={String(DEMO.lowStockCount)} sub="eşik altı variant — eylem gerek" emoji="⚠" />
            </section>

            {/* STOCK STRIP */}
            <article className="grid items-center gap-4 rounded-2xl border border-line bg-paper p-5 lg:grid-cols-[1.5fr_1fr_auto]">
              <div>
                <span className="text-[12px] font-bold uppercase tracking-wider text-ink-4">Envanter</span>
                <div className="mt-1 font-mono text-2xl font-bold text-cart">{DEMO.totalStock.toLocaleString('tr-TR')} adet</div>
                <p className="mt-1 text-[13px] text-ink-3">{DEMO.branchCount} aktif şube · {DEMO.activeVariants} variant</p>
              </div>
              <div>
                <span className="text-[12px] font-bold uppercase tracking-wider text-ink-4">Plan kullanımı</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-2xl font-bold text-cart">{DEMO.productCount}</span>
                  <span className="text-[13.5px] text-ink-4">/ {DEMO.productLimit}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft">
                  <div className="h-full bg-cat" style={{ width: `${Math.min(100, (DEMO.productCount / DEMO.productLimit) * 100)}%` }} />
                </div>
              </div>
              <span className="rounded-xl border border-cat/40 bg-cat-soft px-4 py-2 text-[13px] font-bold text-cart">Ürünleri yönet →</span>
            </article>

            {/* ALERT */}
            <article className="flex flex-wrap items-center gap-4 rounded-2xl border-l-4 border-danger bg-danger-soft/40 px-5 py-4">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-danger text-white text-lg">⚠</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-danger-7">{DEMO.lowStockCount} ürün eşik altında veya tükenmek üzere</div>
                <div className="text-[13px] text-ink-3">PetPro Asistanı {DEMO.orderSuggestions.length} sipariş önerisi hazırladı — aşağıda incele.</div>
              </div>
              <span className="rounded-xl bg-cat px-4 py-2 text-[13px] font-bold text-white">Düşük stoğa git →</span>
            </article>

            {/* PetPro sipariş önerileri */}
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-cat">🤖 PetPro Asistanı · Sipariş Önerileri</h2>
              <article className="rounded-2xl border-2 border-cat/30 bg-gradient-to-br from-cat-soft/40 to-arrow-soft/30 p-4">
                <p className="mb-3 text-[12.5px] text-ink-3">Eşik altı stoklar + son tedarikçiden yeniden sipariş önerisi:</p>
                <ul className="divide-y divide-line-soft text-xs">
                  {DEMO.orderSuggestions.map((s) => (
                    <li key={s.product} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-ink">{s.product} <span className="text-[11.5px] font-normal text-ink-3">· {s.variant}</span></div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                          <span>📍 {s.branch}</span><span>·</span>
                          <span className={s.stock === 0 ? 'text-danger-7 font-bold' : ''}>Stok: {s.stock} / eşik {s.threshold}</span>
                          <span>·</span><span className="text-arrow-7">🚚 {s.supplier} ({s.cost}₺ son alış)</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11.5px] text-ink-4">Öneri</div>
                        <div className="font-mono text-base font-bold text-cart">+{s.qty}</div>
                      </div>
                      <span className="rounded-lg border border-cat/40 bg-paper px-2.5 py-1.5 text-[12px] font-bold text-cart">📥 Giriş yap</span>
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            {/* İki kart: düşük stok + son hareketler */}
            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-line bg-paper p-5">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-3">⚠ Düşük stok</h2>
                <ul className="divide-y divide-line-soft text-sm">
                  {DEMO.lowStock.map((item) => (
                    <li key={item.product} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-ink">{item.product}</div>
                        <div className="text-[12.5px] text-ink-3">{item.variant} · {item.branch}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-mono text-base font-bold ${item.qty === 0 ? 'text-danger-7' : 'text-cat'}`}>{item.qty}</div>
                        <div className="text-[11.5px] text-ink-4">/ {item.threshold} eşik</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-2xl border border-line bg-paper p-5">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-3">🕒 Son hareketler</h2>
                <ul className="divide-y divide-line-soft text-xs">
                  {DEMO.activity.map((a, i) => (
                    <li key={i} className="flex items-center gap-3 py-2">
                      <span className={`grid h-8 w-8 place-items-center rounded-full text-sm ${a.cls}`}>{a.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-ink">{a.product} <span className="text-[11.5px] font-normal text-ink-3">{a.variant}</span></div>
                        <div className="text-[11.5px] text-ink-4">{a.branch} · {a.sub}</div>
                      </div>
                      <div className={`font-mono text-sm font-bold ${a.qty > 0 ? 'text-arrow-7' : 'text-danger-7'}`}>{a.qty > 0 ? '+' : ''}{a.qty}</div>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function ZoneLabel({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="mt-2 flex items-center gap-3 text-[12.5px] font-bold uppercase tracking-wider text-ink-4">
      <span>{emoji} {label}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
    </div>
  );
}

function KpiBold({ tone, label, value, sub, emoji }: { tone: 'cat' | 'cart' | 'arrow' | 'danger'; label: string; value: string; sub: string; emoji: string }) {
  const toneCls: Record<string, string> = {
    cat: 'bg-gradient-to-br from-cat to-cat-2 shadow-[0_12px_32px_rgba(212,74,20,.18)]',
    cart: 'bg-gradient-to-br from-cart to-cart-2 shadow-[0_12px_32px_rgba(72,30,80,.18)]',
    arrow: 'bg-gradient-to-br from-arrow to-arrow-7 shadow-[0_12px_32px_rgba(22,160,138,.18)]',
    danger: 'bg-gradient-to-br from-danger to-danger-7 shadow-[0_12px_32px_rgba(196,49,49,.20)]',
  };
  return (
    <article className={`relative overflow-hidden rounded-2xl p-6 text-white ${toneCls[tone]}`}>
      <div className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-lg">{emoji}</div>
      <span className="text-[12.5px] font-bold uppercase tracking-wider opacity-85">{label}</span>
      <div className="mt-2 font-mono text-4xl font-bold leading-none tracking-tight">{value}</div>
      <div className="mt-2 text-[13px] opacity-90">{sub}</div>
    </article>
  );
}
