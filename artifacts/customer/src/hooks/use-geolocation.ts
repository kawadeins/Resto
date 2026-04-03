import { useState, useCallback, useEffect } from "react";

export type GeoStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

export type GeoState = {
  status: GeoStatus;
  lat: number | null;
  lng: number | null;
  error: string | null;
};

const STORAGE_KEY = "restosmart_geolocation";

function loadCached(): { lat: number; lng: number } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCache(lat: number, lng: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng }));
  } catch {
    // ignore storage errors
  }
}

/**
 * Haversine formula: real distance in km between two coordinates.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function useGeolocation() {
  const cached = loadCached();
  const [state, setState] = useState<GeoState>({
    status: cached ? "granted" : "idle",
    lat: cached?.lat ?? null,
    lng: cached?.lng ?? null,
    error: null,
  });

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "unavailable", lat: null, lng: null, error: "Geolocation is not supported by your browser." });
      return;
    }

    setState((prev) => ({ ...prev, status: "requesting", error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        saveCache(latitude, longitude);
        setState({ status: "granted", lat: latitude, lng: longitude, error: null });
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location access denied. Please allow location access in your browser settings."
            : err.code === err.POSITION_UNAVAILABLE
            ? "Your location could not be determined."
            : "Location request timed out.";
        setState({ status: "denied", lat: null, lng: null, error: msg });
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const clear = useCallback(() => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setState({ status: "idle", lat: null, lng: null, error: null });
  }, []);

  return { ...state, request, clear };
}
