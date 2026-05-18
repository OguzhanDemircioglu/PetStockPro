'use client';

import { useEffect, useMemo, useState } from 'react';
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
  /**
   * Mobile/desktop'ta navigator.geolocation.watchPosition ile kullanıcının
   * hareketine göre marker'ı sticky update et. Permission API zaten 'granted'
   * ise otomatik aktif; 'denied' veya 'prompt' ise yapılmaz (kullanıcı önce
   * NearbyToggle ile izin vermeli). URL değişmez — sadece harita marker'ı.
   * Default: true.
   */
  enableLiveTracking?: boolean;
}

// Leaflet default marker icon path bug — webpack/Next.js'te asset path bozulur, manuel set.
const PET_SHOP_ICON = L.divIcon({
  className: 'pp-pet-shop-marker',
  html: '<div style="background:#d44a14;border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:grid;place-items:center;color:#fff;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,.25);font-family:sans-serif;font-size:13px;">🏪</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/**
 * User marker — heading verilirse 36x36 (pusula okuyla), yoksa 24x24 (sade 📍).
 * Heading 0-360° (kuzeyden saat yönünde derece). CSS rotate'i de aynı semantikte.
 */
function buildUserIcon(heading: number | null): L.DivIcon {
  if (heading == null || !Number.isFinite(heading)) {
    return L.divIcon({
      className: 'pp-user-marker',
      html: '<div style="background:#22c55e;border:2px solid #fff;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;color:#fff;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,.25);font-family:sans-serif;font-size:14px;">📍</div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }
  // Heading varsa: yeşil daire + dönen ok (Apple Maps benzeri)
  const html = `
    <div style="position:relative;width:36px;height:36px;">
      <div style="position:absolute;inset:6px;background:#22c55e;border:2px solid #fff;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:11px;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,.25);font-family:sans-serif;">📍</div>
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" style="position:absolute;inset:0;transform:rotate(${heading}deg);transform-origin:center;pointer-events:none;">
        <path d="M18 1.5 L21.5 8 L18 6.2 L14.5 8 Z" fill="#22c55e" stroke="#fff" stroke-width="1.2" stroke-linejoin="round" />
      </svg>
    </div>
  `;
  return L.divIcon({
    className: 'pp-user-marker',
    html,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

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
  const msg = encodeURIComponent(`Merhaba, ${shopName} vitrini üzerinden ulaşıyorum. `);
  return `https://wa.me/${e164}?text=${msg}`;
}

export default function NearbyMap({
  storefronts,
  userLocation,
  enableLiveTracking = true,
}: Props) {
  const validPoints = useMemo(
    () =>
      storefronts.filter(
        (s): s is NearbyStorefrontMapPoint =>
          Number.isFinite(s.locationLat) && Number.isFinite(s.locationLng),
      ),
    [storefronts],
  );

  // Canlı konum takibi: initial prop'tan başla, watchPosition ile güncelle.
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number } | null>(
    userLocation ?? null,
  );

  // Compass heading (deviceorientation): 0-360° kuzeyden saat yönü
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!enableLiveTracking) return;
    if (typeof navigator === 'undefined') return;
    if (!('geolocation' in navigator)) return;

    let watchId: number | null = null;
    let cancelled = false;

    const startWatch = () => {
      if (cancelled) return;
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLiveLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Hata sessizce yutulur — kullanıcı NearbyToggle'da görüyor zaten
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
    };

    const perms = (navigator as Navigator).permissions;
    if (perms && typeof perms.query === 'function') {
      perms
        .query({ name: 'geolocation' as PermissionName })
        .then((res) => {
          if (res.state === 'granted') startWatch();
          // 'prompt' veya 'denied' → watch başlatma; kullanıcı önce NearbyToggle'a tıklamalı
        })
        .catch(() => {
          // Permissions API yok → watch başlatma (eski browser fallback)
        });
    }

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [enableLiveTracking]);

  // Prop user location değişirse liveLocation reset.
  // useEffect içinde setState — React/Next 19 'set-state-in-effect' kuralı genellikle
  // derive-state-from-props anti-pattern'i için. Burada watchPosition akışı ile prop
  // akışını birleştiriyoruz (gerçek senkronizasyon) — false positive, disable.
  useEffect(() => {
    if (userLocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveLocation(userLocation);
    }
  }, [userLocation?.lat, userLocation?.lng]);

  // DeviceOrientation — mobile'da pusulayı dinle (kuzey 0°)
  useEffect(() => {
    if (!enableLiveTracking) return;
    if (typeof window === 'undefined') return;

    let throttleTimer: number | null = null;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // iOS Safari: webkitCompassHeading (0=kuzey, saat yönü)
      // Standart: alpha (z-axis 0-360, 0 = device "Y axis" north — saatin tersine);
      // alpha'yı kuzey-saat yönü pusulaya çevir: 360 - alpha
      const iosHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      let h: number | null = null;
      if (typeof iosHeading === 'number' && Number.isFinite(iosHeading)) {
        h = iosHeading;
      } else if (typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
        h = (360 - event.alpha) % 360;
      }
      if (h == null) return;
      // 100ms throttle — divIcon her render'da Marker re-mount ediyor
      if (throttleTimer != null) return;
      throttleTimer = window.setTimeout(() => {
        throttleTimer = null;
      }, 100);
      setHeading(h);
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if (throttleTimer != null) window.clearTimeout(throttleTimer);
    };
  }, [enableLiveTracking]);

  const effectiveUserLocation = liveLocation ?? userLocation ?? null;
  const userIcon = useMemo(() => buildUserIcon(heading), [heading]);

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

        {effectiveUserLocation && (
          <Marker
            position={[effectiveUserLocation.lat, effectiveUserLocation.lng]}
            icon={userIcon}
          >
            <Popup>
              <strong>Senin konumun</strong>
              {enableLiveTracking && liveLocation && (
                <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>
                  🛰 Canlı takip aktif
                </div>
              )}
              {heading != null && (
                <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>
                  🧭 Bakış yönü: {Math.round(heading)}°
                </div>
              )}
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
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                        </svg>
                        Satıcıya sor
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <FitBoundsToMarkers points={validPoints} userLocation={effectiveUserLocation} />
      </MapContainer>
    </div>
  );
}
