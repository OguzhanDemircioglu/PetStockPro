'use client';

import dynamic from 'next/dynamic';
import type { NearbyStorefrontMapPoint } from './nearby-map';

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
      <div>
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-cat/30 border-t-cat" />
        <p className="mt-2 text-[12.5px] text-ink-4">Harita yükleniyor...</p>
      </div>
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
