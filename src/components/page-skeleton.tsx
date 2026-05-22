/**
 * PageSkeleton — admin sayfaları için instant loading.tsx skeleton.
 *
 * Next.js her `loading.tsx`'i route shell'i hemen render etmek için kullanır.
 * Kullanıcı sidebar'a tıklayınca: sayfa içeriği data fetch ederken bu skeleton görünür.
 * Kullanıcı algılayışı: tıklama = anında geri bildirim (skeleton).
 *
 * Variant'lar:
 *   - 'page'      → genel sayfa (başlık + 4 KPI + 6-8 satır liste)
 *   - 'table'     → tablo ağırlıklı (başlık + ince filtre bar + table rows)
 *   - 'dashboard' → KPI grid'li (başlık + 4 büyük kart + 2 satır)
 */

interface PageSkeletonProps {
  variant?: 'page' | 'table' | 'dashboard';
  title?: string;
}

export function PageSkeleton({ variant = 'page', title }: PageSkeletonProps) {
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 lg:px-6 lg:py-8"
      role="status"
      aria-busy="true"
      aria-label={title ? `${title} yükleniyor` : 'Sayfa yükleniyor'}
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-line/40 pb-4">
        <div>
          <SkeletonBar w="220px" h="22px" />
          <div className="mt-2">
            <SkeletonBar w="320px" h="13px" />
          </div>
        </div>
        <SkeletonBar w="120px" h="36px" rounded="rounded-xl" />
      </header>

      {variant === 'dashboard' && <DashboardBody />}
      {variant === 'table' && <TableBody />}
      {variant === 'page' && <DefaultBody />}

      <span className="sr-only">Yükleniyor…</span>
    </main>
  );
}

function DefaultBody() {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </section>
      <section className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </section>
    </>
  );
}

function DashboardBody() {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} large />
        ))}
      </section>
      <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <SectionCardSkeleton />
        <SectionCardSkeleton />
      </section>
    </>
  );
}

function TableBody() {
  return (
    <>
      {/* Filter bar */}
      <section className="flex flex-wrap gap-2 rounded-2xl border border-line/40 bg-paper p-3">
        <SkeletonBar w="180px" h="32px" rounded="rounded-lg" />
        <SkeletonBar w="120px" h="32px" rounded="rounded-lg" />
        <SkeletonBar w="100px" h="32px" rounded="rounded-lg" />
      </section>
      {/* Table rows */}
      <section className="overflow-hidden rounded-2xl border border-line/40 bg-paper">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line/30 px-4 py-3 last:border-b-0">
            <SkeletonBar w="40px" h="14px" />
            <SkeletonBar w="220px" h="14px" />
            <SkeletonBar w="80px" h="14px" />
            <SkeletonBar w="60px" h="14px" />
            <div className="ml-auto">
              <SkeletonBar w="80px" h="24px" rounded="rounded-md" />
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function KpiCardSkeleton({ large = false }: { large?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line/40 bg-paper p-4">
      <SkeletonBar w="100px" h="12px" />
      <SkeletonBar w="80px" h={large ? '36px' : '24px'} />
      <SkeletonBar w="140px" h="11px" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-paper p-3">
      <SkeletonBar w="180px" h="14px" />
      <SkeletonBar w="80px" h="12px" />
      <div className="ml-auto">
        <SkeletonBar w="60px" h="20px" rounded="rounded-md" />
      </div>
    </div>
  );
}

function SectionCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line/40 bg-paper p-5">
      <SkeletonBar w="180px" h="14px" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <SkeletonBar w="60%" h="12px" />
          <SkeletonBar w="40px" h="12px" />
        </div>
      ))}
    </div>
  );
}

function SkeletonBar({
  w,
  h,
  rounded = 'rounded',
}: {
  w: string;
  h: string;
  rounded?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-line/50 ${rounded}`}
      style={{ width: w, height: h }}
    />
  );
}
