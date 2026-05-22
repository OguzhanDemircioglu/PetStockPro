'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Harita-odaklı pet shop dizini sayfası için Leaflet wrapper.
 *
 * NearbyMap'ten farkı:
 * - Marker icon: 📍 (vitrin layout'taki "Tüm pet shop'lar" butonun solundaki)
 * - Popup YOK — tıklama parent'a callback gönderir, parent altta kart açar
 * - selectedSlug prop ile aktif marker büyük + parlak gösterilir
 */

export interface HaritaShopPoint {
  companyId: string;
  slug: string;
  name: string;
  cityName: string | null;
  districtName: string | null;
  whatsappPhone: string | null;
  aboutShort: string | null;
  locationLat: number;
  locationLng: number;
}

interface Props {
  shops: HaritaShopPoint[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onMarkerScreenPosition?: (pos: { x: number; y: number } | null) => void;
}

// 3 yayılan dalga halkası — varsayılan marker arka plan'sız, sadece pulse + 📍
function pinHtml(opts: { selected: boolean }): string {
  const ringColor = opts.selected ? 'rgba(22,160,138,0.55)' : 'rgba(212,74,20,0.55)';
  const pinSize = opts.selected ? 40 : 32;
  const ringSize = opts.selected ? 22 : 18;
  return `
    <div style="position:relative;width:${pinSize}px;height:${pinSize}px;display:grid;place-items:center;pointer-events:none;">
      <div style="position:absolute;top:50%;left:50%;width:${ringSize}px;height:${ringSize}px;background:${ringColor};border-radius:50%;animation:pp-pulse-ring 2.4s ease-out infinite;"></div>
      <div style="position:absolute;top:50%;left:50%;width:${ringSize}px;height:${ringSize}px;background:${ringColor};border-radius:50%;animation:pp-pulse-ring 2.4s ease-out infinite 0.6s;"></div>
      <div style="position:absolute;top:50%;left:50%;width:${ringSize}px;height:${ringSize}px;background:${ringColor};border-radius:50%;animation:pp-pulse-ring 2.4s ease-out infinite 1.2s;"></div>
      <div style="position:absolute;top:50%;left:50%;width:${ringSize}px;height:${ringSize}px;background:${ringColor};border-radius:50%;animation:pp-pulse-ring 2.4s ease-out infinite 1.8s;"></div>
      <div style="position:relative;font-size:${pinSize}px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">📍</div>
    </div>
  `;
}

const PIN_DEFAULT = L.divIcon({
  className: 'pp-harita-marker',
  html: pinHtml({ selected: false }),
  iconSize: [32, 32],
  iconAnchor: [16, 28], // pin ucu altında — emoji'nin alt çizgisinde
});

const PIN_SELECTED = L.divIcon({
  className: 'pp-harita-marker-active',
  html: pinHtml({ selected: true }),
  iconSize: [40, 40],
  iconAnchor: [20, 36],
});

function FitBoundsToMarkers({ shops }: { shops: HaritaShopPoint[] }) {
  const map = useMap();

  useEffect(() => {
    const coords: Array<[number, number]> = shops.map((s) => [s.locationLat, s.locationLng]);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 13);
      return;
    }
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [shops, map]);

  return null;
}

function PanToSelected({ shops, selectedSlug }: { shops: HaritaShopPoint[]; selectedSlug: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedSlug) return;
    const shop = shops.find((s) => s.slug === selectedSlug);
    if (!shop) return;
    map.flyTo([shop.locationLat, shop.locationLng], Math.max(map.getZoom(), 12), {
      duration: 0.6,
    });
  }, [selectedSlug, shops, map]);

  return null;
}

/** Selected marker'ın screen pozisyonunu parent'a iletir + map move/zoom track eder. */
function MarkerPositionTracker({
  shops,
  selectedSlug,
  onPosition,
}: {
  shops: HaritaShopPoint[];
  selectedSlug: string | null;
  onPosition: (pos: { x: number; y: number } | null) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedSlug) {
      onPosition(null);
      return;
    }
    const shop = shops.find((s) => s.slug === selectedSlug);
    if (!shop) {
      onPosition(null);
      return;
    }

    const update = () => {
      const point = map.latLngToContainerPoint([shop.locationLat, shop.locationLng]);
      onPosition({ x: point.x, y: point.y });
    };
    update();
    map.on('move', update);
    map.on('zoom', update);
    map.on('viewreset', update);
    return () => {
      map.off('move', update);
      map.off('zoom', update);
      map.off('viewreset', update);
    };
  }, [selectedSlug, shops, map, onPosition]);

  return null;
}

export default function HaritaMap({ shops, selectedSlug, onSelect, onMarkerScreenPosition }: Props) {
  const validPoints = useMemo(
    () =>
      shops.filter(
        (s): s is HaritaShopPoint =>
          Number.isFinite(s.locationLat) && Number.isFinite(s.locationLng),
      ),
    [shops],
  );

  if (validPoints.length === 0) {
    return (
      <div
        data-testid="harita-empty"
        className="grid h-full place-items-center bg-line-soft text-center"
      >
        <div>
          <div className="text-4xl">🗺</div>
          <p className="mt-2 text-sm text-ink-3">
            Henüz konum bilgisi paylaşan pet shop yok.
          </p>
        </div>
      </div>
    );
  }

  // Default center: TR ortalaması — fitBounds hemen override eder
  const defaultCenter: [number, number] = [39.0, 35.0];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={6}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> katkıda bulunanları'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {validPoints.map((p) => (
        <Marker
          key={p.companyId}
          position={[p.locationLat, p.locationLng]}
          icon={selectedSlug === p.slug ? PIN_SELECTED : PIN_DEFAULT}
          eventHandlers={{
            click: () => onSelect(p.slug),
          }}
        />
      ))}

      <FitBoundsToMarkers shops={validPoints} />
      <PanToSelected shops={validPoints} selectedSlug={selectedSlug} />
      {onMarkerScreenPosition && (
        <MarkerPositionTracker
          shops={validPoints}
          selectedSlug={selectedSlug}
          onPosition={onMarkerScreenPosition}
        />
      )}
    </MapContainer>
  );
}
