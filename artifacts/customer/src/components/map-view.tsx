/**
 * MapView — Interactive map with:
 * - Live heat map circles (activity intensity)
 * - Friend Radar zones (friend activity per restaurant)
 * - Live activity badges in popups
 * - Instant Plan "Plan here" button on popups
 * Powered by Leaflet + OpenStreetMap. No API key required.
 */
import { useEffect, useRef, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import { Link } from "wouter";
import { Star, Navigation, TrendingDown, Users, Zap } from "lucide-react";
import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";
import type { SocialCue, RadarZone } from "@/lib/social-api";
import { scoreLiveActivity, type ActivityIntensity } from "@/lib/live-activity";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [48.2093, 16.3726]; // Wien, Innere Stadt
const DEFAULT_ZOOM = 13;

function safeCoords(lat?: number | null, lng?: number | null): [number, number] {
  const la = typeof lat === "number" && isFinite(lat) ? lat : DEFAULT_CENTER[0];
  const lo = typeof lng === "number" && isFinite(lng) ? lng : DEFAULT_CENTER[1];
  return [la, lo];
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// ─── Heat config ──────────────────────────────────────────────────────────────

const HEAT_STYLES: Record<ActivityIntensity, { color: string; fillOpacity: number; weight: number; radius: number }> = {
  quiet:    { color: "rgba(99,102,241,0.0)",  fillOpacity: 0.00, weight: 0, radius: 100 },
  active:   { color: "#6366f1",               fillOpacity: 0.07, weight: 1, radius: 160 },
  busy:     { color: "#f97316",               fillOpacity: 0.13, weight: 1.5, radius: 220 },
  hot:      { color: "#ef4444",               fillOpacity: 0.18, weight: 2, radius: 280 },
  trending: { color: "#a855f7",               fillOpacity: 0.22, weight: 2, radius: 360 },
};

// Radar zone is always a friend-blue semi-transparent circle
const RADAR_STYLE = { color: "#6366f1", fillOpacity: 0.09, weight: 2, radius: 400 };

// ─── Marker factory ───────────────────────────────────────────────────────────

function createMarkerIcon(
  emoji: string,
  hasFlash: boolean,
  isOpen: boolean,
  intensity: ActivityIntensity,
  hasFriends: boolean,
): L.DivIcon {
  const borderColor =
    intensity === "trending" ? "#a855f7" :
    intensity === "hot"      ? "#ef4444" :
    intensity === "busy"     ? "#f97316" :
    hasFlash                 ? "#ef4444" :
    isOpen                   ? "hsl(var(--primary))" :
    "#d1d5db";

  const glowColor =
    intensity === "trending" ? "rgba(168,85,247,0.5)" :
    intensity === "hot"      ? "rgba(239,68,68,0.45)" :
    intensity === "busy"     ? "rgba(249,115,22,0.4)" :
    hasFlash                 ? "rgba(239,68,68,0.35)" :
    isOpen                   ? "rgba(99,102,241,0.3)" :
    "rgba(0,0,0,0.12)";

  const pulseAnim = (intensity === "hot" || intensity === "trending") ? `
    <div style="
      position:absolute; inset:-6px; border-radius:50%;
      border:2px solid ${borderColor}; opacity:0.35;
      animation:mrkr-pulse 2s ease-out infinite;
    "></div>
  ` : "";

  return L.divIcon({
    className: "",
    html: `
      <style>
        @keyframes mrkr-pulse {
          0%   { transform: scale(0.9); opacity: 0.5; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(0.9); opacity: 0; }
        }
      </style>
      <div style="position:relative; width:46px; height:46px;">
        ${pulseAnim}
        <div style="
          width:46px; height:46px;
          display:flex; align-items:center; justify-content:center;
          background:white; border-radius:50%;
          border:2.5px solid ${borderColor};
          box-shadow:0 4px 14px ${glowColor};
          font-size:21px; cursor:pointer; position:relative;
        ">
          ${emoji}
          ${hasFlash ? `<div style="
            position:absolute; top:-4px; right:-4px;
            width:14px; height:14px; border-radius:50%;
            background:#ef4444; border:2px solid white;
          "></div>` : ""}
          ${hasFriends && !hasFlash ? `<div style="
            position:absolute; top:-4px; right:-4px;
            width:14px; height:14px; border-radius:50%;
            background:#6366f1; border:2px solid white;
            font-size:8px; color:white; display:flex; align-items:center; justify-content:center;
            font-weight:800;
          ">👥</div>` : ""}
        </div>
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -26],
  });
}

// ─── User location dot ────────────────────────────────────────────────────────

const userLocationIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.25);animation:loc-pulse 1.5s ease-out infinite;"></div>
      <div style="position:absolute;inset:4px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5);"></div>
    </div>
    <style>@keyframes loc-pulse{0%{transform:scale(0.8);opacity:0.8}100%{transform:scale(2.2);opacity:0}}</style>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -12],
});

// ─── Map controller ───────────────────────────────────────────────────────────

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const last = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!last.current || Math.abs(last.current[0] - center[0]) > 0.0001 || Math.abs(last.current[1] - center[1]) > 0.0001) {
      map.flyTo(center, zoom, { animate: true, duration: 1.2 });
      last.current = center;
    }
  }, [center, zoom, map]);
  return null;
}

function BoundsController({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords.map(([la, lo]) => L.latLng(la, lo))), { padding: [48, 48], maxZoom: 15 });
      fitted.current = true;
    }
  }, [coords, map]);
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapViewRestaurant extends MarketplaceRestaurant {
  distance?: number;
}

interface MapViewProps {
  restaurants: MapViewRestaurant[];
  userLat?: number | null;
  userLng?: number | null;
  flashDeals?: MarketplaceFlashDeal[];
  mode?: LifestyleMode;
  cues?: Record<string, SocialCue>;
  radarZones?: RadarZone[];
  showHeatMap?: boolean;
  showFriendRadar?: boolean;
  email?: string;
}

// ─── Main MapView ─────────────────────────────────────────────────────────────

export function MapView({
  restaurants, userLat, userLng,
  flashDeals = [], mode = "afternoon", cues = {}, radarZones = [],
  showHeatMap = true, showFriendRadar = true, email,
}: MapViewProps) {
  const hasUserLocation = typeof userLat === "number" && isFinite(userLat) && typeof userLng === "number" && isFinite(userLng);
  const center: [number, number] = hasUserLocation ? [userLat!, userLng!] : DEFAULT_CENTER;

  const restaurantsWithCoords = useMemo(() => restaurants.filter(r => r.lat != null && r.lng != null), [restaurants]);
  const markerCoords = useMemo<[number, number][]>(() => restaurantsWithCoords.map(r => safeCoords(r.lat, r.lng)), [restaurantsWithCoords]);

  // Pre-compute live scores for all restaurants
  const liveScores = useMemo(() =>
    Object.fromEntries(
      restaurantsWithCoords.map(r => [r.id, scoreLiveActivity(r, mode, cues, flashDeals)])
    ),
    [restaurantsWithCoords, mode, cues, flashDeals]
  );

  // Build radar map keyed by restaurant ID
  const radarMap = useMemo(() => new Map(radarZones.map(z => [z.restaurantId, z])), [radarZones]);

  // Count hot places for legend
  const hotCount = Object.values(liveScores).filter(s => s.intensity === "hot" || s.intensity === "trending").length;
  const radarCount = radarZones.length;

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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {hasUserLocation && <MapController center={center} zoom={DEFAULT_ZOOM} />}
        {!hasUserLocation && markerCoords.length > 1 && <BoundsController coords={markerCoords} />}

        {/* User location */}
        {hasUserLocation && (
          <Marker position={[userLat!, userLng!]} icon={userLocationIcon}>
            <Popup>
              <div className="text-sm font-semibold text-blue-600 flex items-center gap-1.5 px-1 py-0.5">
                <Navigation className="w-3.5 h-3.5" />
                Mein Standort
              </div>
            </Popup>
          </Marker>
        )}

        {/* ── Heat map circles ── */}
        {showHeatMap && restaurantsWithCoords.map(r => {
          const live = liveScores[r.id];
          if (!live || live.intensity === "quiet") return null;
          const heat = HEAT_STYLES[live.intensity];
          const coords = safeCoords(r.lat, r.lng);
          return (
            <Circle
              key={`heat-${r.id}`}
              center={coords}
              radius={heat.radius}
              pathOptions={{ color: heat.color, fillColor: heat.color, fillOpacity: heat.fillOpacity, weight: heat.weight }}
            />
          );
        })}

        {/* ── Friend Radar zones ── */}
        {showFriendRadar && radarZones.map(zone => {
          if (!zone.lat || !zone.lng) return null;
          return (
            <Circle
              key={`radar-${zone.restaurantId}`}
              center={[zone.lat, zone.lng]}
              radius={RADAR_STYLE.radius + zone.friendCount * 80}
              pathOptions={{
                color: RADAR_STYLE.color,
                fillColor: RADAR_STYLE.color,
                fillOpacity: Math.min(RADAR_STYLE.fillOpacity + zone.friendCount * 0.03, 0.22),
                weight: RADAR_STYLE.weight,
                dashArray: "6 4",
              }}
            />
          );
        })}

        {/* ── Restaurant markers ── */}
        {restaurantsWithCoords.map(r => {
          const coords = safeCoords(r.lat, r.lng);
          const live = liveScores[r.id];
          const radar = radarMap.get(r.id);
          const hasFriends = !!radar && radar.friendCount > 0;
          const icon = createMarkerIcon(
            r.cuisineEmoji || "🍽️",
            r.hasActiveFlash ?? false,
            r.isOpenNow ?? false,
            live?.intensity ?? "quiet",
            hasFriends,
          );

          return (
            <Marker key={r.id} position={coords} icon={icon}>
              <Popup className="leaflet-popup-custom" minWidth={240} maxWidth={280}>
                <div className="font-sans">
                  {/* Header */}
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-2xl leading-none mt-0.5">{r.cuisineEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm leading-tight text-gray-900 line-clamp-2">{r.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{r.cuisine}</p>
                    </div>
                  </div>

                  {/* Live activity badge */}
                  {live && live.mapBadge && (
                    <div className="mb-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                        live.intensity === "trending" ? "bg-purple-100 text-purple-700" :
                        live.intensity === "hot"      ? "bg-rose-100 text-rose-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {live.mapBadge}
                      </span>
                    </div>
                  )}

                  {/* Friend radar signal */}
                  {hasFriends && (
                    <div className="mb-2 flex items-center gap-1.5 bg-primary/8 rounded-xl px-2.5 py-1.5">
                      <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-xs font-bold text-primary">
                        {radar!.friendCount === 1
                          ? `${radar!.friendNames[0]} war hier`
                          : `${radar!.friendCount} Freunde waren hier`}
                      </span>
                    </div>
                  )}

                  {/* Status badges */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    <span className={`inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${r.isOpenNow ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {r.isOpenNow ? "Geöffnet" : "Geschlossen"}
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
                    {(r as any).distance !== undefined && (
                      <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                        <Navigation className="w-3 h-3" />
                        {formatDistance((r as any).distance)}
                      </span>
                    )}
                  </div>

                  {/* Availability */}
                  {r.isOpenNow && (r as any).availabilityStatus && (r as any).availabilityStatus !== "closed" && (
                    <div className="mb-2">
                      {(r as any).availabilityStatus === "available" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Tische verfügbar
                        </span>
                      )}
                      {(r as any).availabilityStatus === "limited" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Wenige Plätze
                        </span>
                      )}
                      {(r as any).availabilityStatus === "nearly_full" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> Fast ausgebucht
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mb-1 line-clamp-1">{r.address}, {r.city}</p>
                  <p className="text-xs text-gray-400 mb-3">{r.openTime} – {r.closeTime}</p>

                  {/* CTAs */}
                  <div className="space-y-2">
                    <Link href={`/restaurant/${r.id}`}>
                      <button
                        className="w-full text-xs font-semibold py-2 px-4 rounded-lg text-white"
                        style={{ background: "hsl(var(--primary))" }}
                      >
                        Ansehen &amp; Buchen
                      </button>
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ── Heat map legend ── */}
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-md border text-xs space-y-1.5 max-w-[160px]">
        <div className="font-extrabold text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Legende</div>
        {hotCount > 0 && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500 opacity-70 border border-purple-300" />
              <span className="text-gray-600">Trending ({hotCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-400 opacity-70" />
              <span className="text-gray-600">Sehr beliebt</span>
            </div>
          </>
        )}
        {radarCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-primary border-dashed bg-primary/10" />
            <span className="text-gray-600">Freunde aktiv</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
          <span className="text-gray-600">Mein Standort</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-white" />
          <span className="text-gray-600">Blitzangebot</span>
        </div>
      </div>

      {/* ── Heat map toggle label ── */}
      {showHeatMap && hotCount > 0 && (
        <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-md border flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-rose-500" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <span className="text-[11px] font-extrabold text-rose-700">Heatmap LIVE</span>
        </div>
      )}
    </div>
  );
}
