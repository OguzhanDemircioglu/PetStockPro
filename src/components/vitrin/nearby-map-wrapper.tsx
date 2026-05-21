'use client';

import dynamic from 'next/dynamic';
import type { NearbyStorefrontMapPoint } from './nearby-map';
import { PetSpinner } from '@/components/ui/pet-spinner';

/**
 * Leaflet SSR-incompatible (window/document erişimi). Bu wrapper ile
 * `dynamic({ ssr: false })` üzerinden sadece client'ta yüklenir.
 *
 * Bundle: leaflet + react-leaflet ~46KB gzipped, sadece bu component'i
 * render eden sayfalarda load edilir.
 */

const NearbyMap = dynamic(() => import('./nearby-map'), {
  ssr: false,
  loading: () => (
    <div
      data-testid="nearby-map-loading"
      className="grid h-[360px] place-items-center rounded-2xl border border-line bg-paper text-center"
    >
      <PetSpinner size="md" tone="cat" label="Harita yükleniyor…" />
      <p className="mt-2 text-[12.5px] text-ink-4">Harita yükleniyor...</p>
    </div>
  ),
});

interface Props {
  storefronts: NearbyStorefrontMapPoint[];
  userLocation?: { lat: number; lng: number } | null;
}

export function NearbyMapWrapper(props: Props) {
  return <NearbyMap {...props} />;
}
