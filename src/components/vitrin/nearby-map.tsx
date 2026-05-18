'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Yakındaki pet shop'lar için interaktif Leaflet haritası.
 *
 * - OpenStreetMap tile layer (ücretsiz, attribution zorunlu)
 * - Pet shop marker'ları + tıklayınca popup (ad + il/ilçe + detay link + WhatsApp)
 * - Kullanıcı konumu varsa ayrı renkli marker (pulsing)
 * - fitBounds — tüm marker'ları kapsayacak şekilde zoom
 *
 * SSR'da render edilmez — `nearby-map-wrapper.tsx` üzerinden `dynamic({ ssr: false })`.
 */

export interface NearbyStorefrontMapPoint {
  companyId: string;
  slug: string;
  name: string;
  cityName: string | null;
  districtName: string | null;
  whatsappPhone: string | null;
  locationLat: number;
  locationLng: number;
  distanceKm: number | null;
}

interface Props {
  storefronts: NearbyStorefrontMapPoint[];
  userLocation?: { lat: number; lng: number } | null;
}

// Leaflet default marker icon path bug — webpack/Next.js'te asset path bozulur, manuel set.
const PET_SHOP_ICON = L.divIcon({
  className: 'pp-pet-shop-marker',
  html: '<div style="background:#d44a14;border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:grid;place-items:center;color:#fff;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,.25);font-family:sans-serif;font-size:13px;">🏪</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const USER_ICON = L.divIcon({
  className: 'pp-user-marker',
  html: '<div style="background:#22c55e;border:2px solid #fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;color:#fff;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,.25);font-family:sans-serif;font-size:14px;">📍</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function FitBoundsToMarkers({
  points,
  userLocation,
}: {
  points: NearbyStorefrontMapPoint[];
  userLocation?: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    const coords: Array<[number, number]> = points.map((p) => [p.locationLat, p.locationLng]);
    if (userLocation) {
      coords.push([userLocation.lat, userLocation.lng]);
    }
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 13);
      return;
    }
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [points, userLocation, map]);

  return null;
}

function formatDistance(km: number | null): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function buildWhatsappLink(phone: string | null, shopName: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const e164 = digits.startsWith('90') ? digits : `90${digits.replace(/^0/, '')}`;
  const msg = encodeURIComponent(`Merhaba, ${shopName} vitrini üzerinden ulaşıyorum. 🐾`);
  return `https://wa.me/${e164}?text=${msg}`;
}

export default function NearbyMap({ storefronts, userLocation }: Props) {
  const validPoints = useMemo(
    () =>
      storefronts.filter(
        (s): s is NearbyStorefrontMapPoint =>
          Number.isFinite(s.locationLat) && Number.isFinite(s.locationLng),
      ),
    [storefronts],
  );

  if (validPoints.length === 0) {
    return (
      <div
        data-testid="nearby-map-empty"
        className="grid h-[300px] place-items-center rounded-2xl border border-line bg-paper text-center"
      >
        <div>
          <div className="text-3xl">🗺</div>
          <p className="mt-2 text-[13px] text-ink-3">
            Pet shop&apos;ların konum bilgisi henüz girilmemiş.
          </p>
        </div>
      </div>
    );
  }

  // Default center: TR ortalaması (Ankara) — fitBounds hemen override eder
  const defaultCenter: [number, number] = [39.0, 35.0];

  return (
    <div
      data-testid="nearby-leaflet-map"
      className="relative h-[360px] overflow-hidden rounded-2xl border border-line shadow-sm"
    >
      <MapContainer
        center={defaultCenter}
        zoom={6}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> katkıda bulunanları'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_ICON}>
            <Popup>
              <strong>Senin konumun</strong>
            </Popup>
          </Marker>
        )}

        {validPoints.map((p) => {
          const wa = buildWhatsappLink(p.whatsappPhone, p.name);
          const distance = formatDistance(p.distanceKm);
          return (
            <Marker key={p.companyId} position={[p.locationLat, p.locationLng]} icon={PET_SHOP_ICON}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <strong style={{ color: '#d44a14', display: 'block' }}>{p.name}</strong>
                  {(p.cityName || p.districtName) && (
                    <div style={{ fontSize: 12, marginTop: 4, color: '#666' }}>
                      📍 {[p.cityName, p.districtName].filter(Boolean).join(' / ')}
                      {distance && ` · ${distance}`}
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <a
                      href={`/vitrin/magaza/${p.slug}`}
                      style={{
                        background: '#d44a14',
                        color: '#fff',
                        padding: '4px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      Detay →
                    </a>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: '#25d366',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <FitBoundsToMarkers points={validPoints} userLocation={userLocation} />
      </MapContainer>
    </div>
  );
}
