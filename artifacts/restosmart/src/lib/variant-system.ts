const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const CACHE_KEY = "rs_variants_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface VariantEntry {
  id: number;
  variantKey: string;
  copyText: string;
}

interface VariantCache {
  ts: number;
  bizType: string;
  data: Record<string, VariantEntry>;
}

// Module-level cache (shared across all hooks in the session)
let memCache: VariantCache | null = null;
// Pending fetch promise to deduplicate concurrent fetches
let pendingFetch: Promise<Record<string, VariantEntry>> | null = null;
// Track which variant IDs have had impressions fired this session
const impressionsFired = new Set<number>();

function getBizType(): string {
  return (typeof window !== "undefined" ? localStorage.getItem("restosmart_owner_business_type") : null) ?? "restaurant";
}

function readSessionCache(bizType: string): Record<string, VariantEntry> | null {
  // Check memory cache first
  if (memCache && memCache.bizType === bizType && Date.now() - memCache.ts < CACHE_TTL) {
    return memCache.data;
  }
  // Try sessionStorage
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed: VariantCache = JSON.parse(raw);
      if (parsed.bizType === bizType && Date.now() - parsed.ts < CACHE_TTL) {
        memCache = parsed;
        return parsed.data;
      }
    }
  } catch {}
  return null;
}

function writeSessionCache(bizType: string, data: Record<string, VariantEntry>) {
  const cache: VariantCache = { ts: Date.now(), bizType, data };
  memCache = cache;
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

async function fetchVariants(bizType: string): Promise<Record<string, VariantEntry>> {
  const cached = readSessionCache(bizType);
  if (cached) return cached;

  if (pendingFetch) return pendingFetch;

  pendingFetch = fetch(`${API_BASE}/api/variants/active?businessType=${encodeURIComponent(bizType)}`)
    .then(r => r.ok ? r.json() : {})
    .catch(() => ({}))
    .then(data => {
      writeSessionCache(bizType, data);
      pendingFetch = null;
      return data;
    });

  return pendingFetch;
}

// Fire impression for a variant (once per variant id per session)
export function trackVariantImpression(variantId: number) {
  if (impressionsFired.has(variantId)) return;
  impressionsFired.add(variantId);
  try {
    fetch(`${API_BASE}/api/variants/impression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId }),
    }).catch(() => {});
  } catch {}
}

// Fire click for a variant (isConversion = true means user upgraded)
export function trackVariantClick(variantId: number, isConversion = false) {
  try {
    fetch(`${API_BASE}/api/variants/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, isConversion }),
    }).catch(() => {});
  } catch {}
}

// React hook: returns { variants, loaded } where variants is the full map
import { useState, useEffect } from "react";

export function useVariants() {
  const [variants, setVariants] = useState<Record<string, VariantEntry>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const bizType = getBizType();
    const cached = readSessionCache(bizType);
    if (cached) {
      setVariants(cached);
      setLoaded(true);
      return;
    }
    fetchVariants(bizType).then(data => {
      setVariants(data);
      setLoaded(true);
    });
  }, []);

  return { variants, loaded };
}

// Convenience: get copy text for an element with a fallback
export function getVariantCopy(
  variants: Record<string, VariantEntry>,
  elementType: string,
  fallback: string
): { copy: string; variantId: number | null } {
  const entry = variants[elementType];
  if (!entry) return { copy: fallback, variantId: null };
  return { copy: entry.copyText, variantId: entry.id };
}
