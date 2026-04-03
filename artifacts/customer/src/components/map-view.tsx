/**
 * MapView — Interactive restaurant map powered by Leaflet + OpenStreetMap.
 * No API key required. Uses custom DivIcon markers for premium look.
 * Mobile-friendly, gracefully handles missing coordinates.
 */
import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import { Link } from "wouter";
import { Star, Navigation, TrendingDown } from "lucide-react";
import type { MarketplaceRestaurant } from "@workspace/api-client-react";

// London default
const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278];
const DEFAULT_ZOOM = 13;

// Safely parse lat/lng — fallback to London center if missing/invalid
function safeCoords(lat?: number | null, lng?: number | null): [number, number] {
  const la = typeof lat === "number" && isFinite(lat) ? lat : DEFAULT_CENTER[0];
  const lo = typeof lng === "number" && isFinite(lng) ? lng : DEFAULT_CENTER[1];
  return [la, lo];
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// Create restaurant pin: emoji-based DivIcon
function createRestaurantIcon(emoji: string, hasFlash: boolean, isOpen: boolean): L.DivIcon {
  const ring = hasFlash
    ? "border-red-500 bg-red-50"
    : isOpen
    ? "border-primary bg-primary/5"
    : "border-gray-300 bg-gray-50";
  const shadow = hasFlash ? "shadow-red-200" : "shadow-primary/20";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
        border-radius: 50%;
        border: 2.5px solid ${hasFlash ? "#ef4444" : isOpen ? "hsl(var(--primary))" : "#d1d5db"};
        box-shadow: 0 4px 12px rgba(0,0,0,0.18);
        font-size: 20px;
        cursor: pointer;
        position: relative;
        transition: transform 0.15s;
      ">
        ${emoji}
        ${hasFlash ? `<div style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ef4444;
          border: 2px solid white;
        "></div>` : ""}
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24],
  });
}

// User location pulsing blue dot
const userLocationIcon = L.divIcon({
  className: "",
  html: `
    <div style="position: relative; width: 20px; height: 20px;">
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: rgba(59, 130, 246, 0.25);
        animation: pulse-ring 1.5s ease-out infinite;
      "></div>
      <div style="
        position: absolute;
        inset: 4px;
        border-radius: 50%;
        background: #3b82f6;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(59,130,246,0.5);
      "></div>
    </div>
    <style>
      @keyframes pulse-ring {
        0% { transform: scale(0.8); opacity: 0.8; }
        100% { transform: scale(2.2); opacity: 0; }
      }
    </style>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -12],
});

// Pan map to new center when user location changes
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const lastCenter = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (
      lastCenter.current === null ||
      Math.abs(lastCenter.current[0] - center[0]) > 0.0001 ||
      Math.abs(lastCenter.current[1] - center[1]) > 0.0001
    ) {
      map.flyTo(center, zoom, { animate: true, duration: 1.2 });
      lastCenter.current = center;
    }
  }, [center, zoom, map]);

  return null;
}

// Fit map bounds to show all restaurant markers
function BoundsController({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!fitted.current && coords.length > 1) {
      const bounds = L.latLngBounds(coords.map(([la, lo]) => L.latLng(la, lo)));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      fitted.current = true;
    }
  }, [coords, map]);

  return null;
}

export interface MapViewRestaurant extends MarketplaceRestaurant {
  distance?: number;
}

interface MapViewProps {
  restaurants: MapViewRestaurant[];
  userLat?: number | null;
  userLng?: number | null;
}

export function MapView({ restaurants, userLat, userLng }: MapViewProps) {
  const hasUserLocation = typeof userLat === "number" && typeof userLng === "number" && isFinite(userLat) && isFinite(userLng);
  const center: [number, number] = hasUserLocation ? [userLat!, userLng!] : DEFAULT_CENTER;

  const restaurantsWithCoords = useMemo(() =>
    restaurants.filter(r => r.lat !== undefined && r.lng !== undefined),
    [restaurants]
  );

  const markerCoords = useMemo<[number, number][]>(() =>
    restaurantsWithCoords.map(r => safeCoords(r.lat, r.lng)),
    [restaurantsWithCoords]
  );

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border shadow-sm">
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
        zoomControl={true}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        {/* Warm, readable tile style */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Pan to user location on load */}
        {hasUserLocation && <MapController center={center} zoom={DEFAULT_ZOOM} />}

        {/* Fit all restaurants if no user location */}
        {!hasUserLocation && markerCoords.length > 1 && (
          <BoundsController coords={markerCoords} />
        )}

        {/* User location marker */}
        {hasUserLocation && (
          <Marker position={[userLat!, userLng!]} icon={userLocationIcon}>
            <Popup className="leaflet-popup-custom">
              <div className="text-sm font-semibold text-blue-600 flex items-center gap-1.5 px-1 py-0.5">
                <Navigation className="w-3.5 h-3.5" />
                Your location
              </div>
            </Popup>
          </Marker>
        )}

        {/* Restaurant markers */}
        {restaurantsWithCoords.map((r) => {
          const coords = safeCoords(r.lat, r.lng);
          const icon = createRestaurantIcon(r.cuisineEmoji || "🍽️", r.hasActiveFlash ?? false, r.isOpenNow ?? false);

          return (
            <Marker key={r.id} position={coords} icon={icon}>
              <Popup className="leaflet-popup-custom" minWidth={220} maxWidth={260}>
                <div className="font-sans">
                  {/* Header */}
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-2xl leading-none mt-0.5">{r.cuisineEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm leading-tight text-gray-900 line-clamp-2">
                        {r.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">{r.cuisine}</p>
                    </div>
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    <span className={`inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${r.isOpenNow ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {r.isOpenNow ? "Open" : "Closed"}
                    </span>

                    <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {r.rating?.toFixed(1)}
                    </span>

                    {r.hasActiveFlash && r.flashPercentage && (
                      <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-600">
                        <TrendingDown className="w-3 h-3" />
                        {r.flashPercentage}% OFF
                      </span>
                    )}

                    {r.distance !== undefined && (
                      <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                        <Navigation className="w-3 h-3" />
                        {formatDistance(r.distance)}
                      </span>
                    )}
                  </div>

                  {/* Availability chip */}
                  {r.isOpenNow && r.availabilityStatus && r.availabilityStatus !== "closed" && (
                    <div className="mb-2">
                      {r.availabilityStatus === "available" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Tables available now
                        </span>
                      )}
                      {r.availabilityStatus === "limited" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Limited seats left
                        </span>
                      )}
                      {r.availabilityStatus === "nearly_full" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                          Almost full
                        </span>
                      )}
                      {r.availabilityStatus === "full" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {r.nextAvailableSlot ? `Next slot: ${r.nextAvailableSlot}` : "Fully booked"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Address */}
                  <p className="text-xs text-gray-500 mb-3 line-clamp-1">
                    {r.address}, {r.city}
                  </p>

                  {/* Hours */}
                  <p className="text-xs text-gray-400 mb-3">
                    {r.openTime} – {r.closeTime}
                  </p>

                  {/* CTA */}
                  <Link href={`/restaurant/${r.id}`}>
                    <button
                      className="w-full text-xs font-semibold py-2 px-4 rounded-lg text-white"
                      style={{ background: "hsl(var(--primary))" }}
                    >
                      View & Book
                    </button>
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border text-xs space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
          <span className="text-gray-600">Your location</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-white" />
          <span className="text-gray-600">Flash deal active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-gray-300 bg-white" />
          <span className="text-gray-600">Closed now</span>
        </div>
      </div>
    </div>
  );
}
