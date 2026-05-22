import { db } from '@/lib/db/client';
import { listPublicStorefronts } from '@/lib/vitrin/public';
import { buildVitrinPageMetadata } from '@/lib/vitrin/page-metadata';
import type { HaritaShopPoint } from '@/components/vitrin/harita-map';
import { HaritaView } from './harita-view';

export const revalidate = 60; // 1 dk ISR

export const metadata = buildVitrinPageMetadata({
  title: 'Pet shop haritası — PetStockPro Vitrin',
  description:
    "Türkiye'deki PetStockPro ile çalışan pet shop'ları haritada gör. Marker'a tıkla, mağaza kartından WhatsApp ile yaz.",
  path: '/vitrin/harita',
});

export default async function VitrinHaritaPage() {
  const all = await listPublicStorefronts(db, {});

  // Konum bilgisi olanları filter (harita marker'ları için gerekli)
  const shops: HaritaShopPoint[] = all
    .filter(
      (s) =>
        typeof s.locationLat === 'number' &&
        typeof s.locationLng === 'number' &&
        Number.isFinite(s.locationLat) &&
        Number.isFinite(s.locationLng),
    )
    .map((s) => ({
      companyId: s.companyId,
      slug: s.slug,
      name: s.name,
      cityName: s.cityName,
      districtName: s.districtName,
      whatsappPhone: s.whatsappPhone,
      aboutShort: s.aboutShort,
      locationLat: s.locationLat as number,
      locationLng: s.locationLng as number,
    }));

  return <HaritaView shops={shops} />;
}
