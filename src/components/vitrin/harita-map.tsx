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
}

// Default marker — 📍 turuncu daire içinde
const PIN_DEFAULT = L.divIcon({
  className: 'pp-harita-marker',
  html: '<div style="background:#d44a14;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:grid;place-items:center;color:#fff;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,.25);font-family:sans-serif;font-size:16px;">📍</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Selected marker — büyük + arrow-yeşil daire (vurgu)
const PIN_SELECTED = L.divIcon({
  className: 'pp-harita-marker-active',
  html: '<div style="background:#16a08a;border:3px solid #fff;border-radius:50%;width:42px;height:42px;display:grid;place-items:center;color:#fff;font-weight:700;box-shadow:0 6px 18px rgba(22,160,138,.55);font-family:sans-serif;font-size:20px;animation:pulse-soft 1.5s ease-out infinite;">📍</div>',
  iconSize: [42, 42],
  iconAnchor: [21, 21],
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

export default function HaritaMap({ shops, selectedSlug, onSelect }: Props) {
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
    </MapContainer>
  );
}
