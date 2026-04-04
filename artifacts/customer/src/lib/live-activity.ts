/**
 * Live Activity Engine
 *
 * Computes a real-time "activity score" for each restaurant from aggregated
 * signals: open-now, availability/busyness, flash deals, time-of-day
 * businessType match, social cues from friends, rating, and partner status.
 *
 * No individual user tracking. All signals are aggregated and deterministic.
 */

import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";
import type { SocialCue } from "@/lib/social-api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityIntensity = "quiet" | "active" | "busy" | "hot" | "trending";

export interface LiveBadge {
  icon: string;
  text: string;
  cls: string;        // tailwind class string for chip
  pulse?: boolean;
}

export interface LiveActivityResult {
  score: number;                        // 0–100
  intensity: ActivityIntensity;
  primaryBadge: LiveBadge | null;       // most prominent badge to show on card
  mapBadge: string | null;              // short label for map popup
  heatColor: string;                    // rgba string for Leaflet Circle fill
  heatStroke: string;                   // rgba string for Leaflet Circle border
  heatRadius: number;                   // metres radius of heat circle
  heatOpacity: number;                  // 0–1
}

// ─── Mode → businessType priority ────────────────────────────────────────────

const MODE_BIZ_MATCH: Record<LifestyleMode, string[]> = {
  morning:   ["cafe"],
  lunch:     ["restaurant"],
  afternoon: ["cafe", "restaurant"],
  evening:   ["restaurant", "bar"],
  night:     ["bar"],
};

// ─── Availability busyness signals ───────────────────────────────────────────

const AVAIL_SCORE: Record<string, number> = {
  full:        28,   // fully booked = hottest signal
  nearly_full: 22,
  limited:     14,
  available:    4,
};

// ─── Badge definitions ────────────────────────────────────────────────────────

const BADGES: Record<string, LiveBadge> = {
  trending:    { icon: "🌟", text: "Trending jetzt",     cls: "bg-purple-100 text-purple-700 border-purple-200", pulse: true },
  hot:         { icon: "🔥", text: "Hot jetzt",          cls: "bg-rose-100 text-rose-700 border-rose-200",       pulse: true },
  busy:        { icon: "⚡", text: "Gerade beliebt",     cls: "bg-amber-100 text-amber-700 border-amber-200" },
  friends_hot: { icon: "👥", text: "Freunde zuletzt aktiv",  cls: "bg-primary/10 text-primary border-primary/25" },
  lunch_rush:  { icon: "🍽️", text: "Lunch-Rush",         cls: "bg-orange-100 text-orange-700 border-orange-200", pulse: true },
  happy_hour:  { icon: "🍸", text: "Happy Hour",         cls: "bg-rose-100 text-rose-700 border-rose-200",       pulse: true },
  cafe_rush:   { icon: "☕", text: "Café-Rush",          cls: "bg-amber-100 text-amber-700 border-amber-200" },
  night_vibe:  { icon: "🌙", text: "Nachtbetrieb",       cls: "bg-indigo-100 text-indigo-700 border-indigo-200", pulse: true },
  morning_hot: { icon: "☀️", text: "Frühstücks-Crowd",  cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  active:      { icon: "•",  text: "Aktiv",              cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

// ─── Heat colour palette ──────────────────────────────────────────────────────

const HEAT_CONFIG: Record<ActivityIntensity, { fill: string; stroke: string; opacity: number; radius: number }> = {
  quiet:    { fill: "rgba(99,102,241,0.04)",  stroke: "rgba(99,102,241,0.08)",  opacity: 0.0, radius: 120 },
  active:   { fill: "rgba(99,102,241,0.10)",  stroke: "rgba(99,102,241,0.20)",  opacity: 0.4, radius: 180 },
  busy:     { fill: "rgba(251,146,60,0.18)",  stroke: "rgba(251,146,60,0.40)",  opacity: 0.6, radius: 240 },
  hot:      { fill: "rgba(239,68,68,0.22)",   stroke: "rgba(239,68,68,0.50)",   opacity: 0.7, radius: 300 },
  trending: { fill: "rgba(168,85,247,0.26)",  stroke: "rgba(168,85,247,0.55)",  opacity: 0.8, radius: 380 },
};

// ─── Mode-specific badge selection ───────────────────────────────────────────

function modeBadge(mode: LifestyleMode, bizType: string, intensity: ActivityIntensity): LiveBadge | null {
  if (intensity === "quiet") return null;
  if (mode === "morning"   && bizType === "cafe")       return BADGES.cafe_rush;
  if (mode === "lunch"     && bizType === "restaurant") return BADGES.lunch_rush;
  if (mode === "evening"   && bizType === "bar")        return BADGES.happy_hour;
  if (mode === "night"     && bizType === "bar")        return BADGES.night_vibe;
  if (intensity === "trending") return BADGES.trending;
  if (intensity === "hot")      return BADGES.hot;
  if (intensity === "busy")     return BADGES.busy;
  return BADGES.active;
}

// ─── Consistent pseudo-random noise (same restaurant, same session) ──────────

function stableNoise(id: number): number {
  // Deterministic ±5 jitter based on restaurant ID so results feel natural
  const h = ((id * 2654435761) >>> 0) % 11;
  return h - 5;
}

// ─── Main scoring function ────────────────────────────────────────────────────

export function scoreLiveActivity(
  restaurant: MarketplaceRestaurant,
  mode: LifestyleMode,
  cues: Record<string, SocialCue> = {},
  flashDeals: MarketplaceFlashDeal[] = [],
): LiveActivityResult {
  let score = 0;
  const bizType: string = (restaurant as any).businessType ?? "restaurant";
  const avail: string | undefined = (restaurant as any).availabilityStatus;

  // 1. Open-now base
  if (restaurant.isOpenNow) score += 18;

  // 2. Availability / busyness — strongest live signal
  if (restaurant.isOpenNow && avail) score += AVAIL_SCORE[avail] ?? 0;

  // 3. Mode × businessType match
  const modeMatches = MODE_BIZ_MATCH[mode] ?? [];
  if (modeMatches[0] === bizType) score += 22;
  else if (modeMatches[1] === bizType) score += 10;
  else if (!modeMatches.includes(bizType)) score -= 8;  // off-peak penalty

  // 4. Flash deal → urgency signal
  if (restaurant.hasActiveFlash) {
    score += 12;
    if (restaurant.flashPercentage && restaurant.flashPercentage >= 20) score += 4;
  }

  // 5. Social cues — friends being here is the strongest social signal
  const cue = cues[String(restaurant.id)];
  if (cue) {
    score += Math.min(cue.count * 15, 30);
  }

  // 6. Rating quality
  if (restaurant.rating >= 4.5) score += 10;
  else if (restaurant.rating >= 4.0) score += 5;
  else if (restaurant.rating < 3.0) score -= 5;

  // 7. Partner / featured trust
  if (restaurant.isPartner)  score += 8;
  if (restaurant.isFeatured) score += 4;

  // 8. Stable noise for natural feel
  score += stableNoise(restaurant.id);

  score = Math.min(100, Math.max(0, score));

  // ── Intensity tier ─────────────────────────────────────────────────────────
  const intensity: ActivityIntensity =
    score >= 80 ? "trending" :
    score >= 62 ? "hot" :
    score >= 44 ? "busy" :
    score >= 25 ? "active" :
    "quiet";

  // ── Badge selection ────────────────────────────────────────────────────────
  let primaryBadge: LiveBadge | null = null;

  // Friends trump everything as primary badge
  if (cue && cue.count > 0 && intensity !== "quiet") {
    primaryBadge = BADGES.friends_hot;
  } else {
    primaryBadge = modeBadge(mode, bizType, intensity);
  }

  // ── Map badge ──────────────────────────────────────────────────────────────
  const mapBadge = intensity === "trending" ? "🌟 Trending"
    : intensity === "hot" ? "🔥 Hot"
    : intensity === "busy" ? "⚡ Beliebt"
    : null;

  // ── Heat map config ────────────────────────────────────────────────────────
  const heat = HEAT_CONFIG[intensity];

  return {
    score,
    intensity,
    primaryBadge,
    mapBadge,
    heatColor:   heat.fill,
    heatStroke:  heat.stroke,
    heatOpacity: heat.opacity,
    heatRadius:  heat.radius,
  };
}

// ─── Bulk ranking helper ──────────────────────────────────────────────────────

export interface ScoredLiveRestaurant {
  restaurant: MarketplaceRestaurant;
  live: LiveActivityResult;
}

export function rankByLiveActivity(
  restaurants: MarketplaceRestaurant[],
  mode: LifestyleMode,
  cues: Record<string, SocialCue> = {},
  flashDeals: MarketplaceFlashDeal[] = [],
): ScoredLiveRestaurant[] {
  return restaurants
    .map(r => ({ restaurant: r, live: scoreLiveActivity(r, mode, cues, flashDeals) }))
    .sort((a, b) => b.live.score - a.live.score);
}

// ─── Section config by mode ───────────────────────────────────────────────────

export interface LiveSectionConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  emoji: string;
  filter: (r: MarketplaceRestaurant) => boolean;
  gradient: string;
  accentCls: string;
}

export function getLiveSections(mode: LifestyleMode): LiveSectionConfig[] {
  const base: LiveSectionConfig[] = [
    {
      id: "hot_now",
      title: "Hot jetzt",
      subtitle: "Stark frequentierte Lokale in Echtzeit",
      icon: "🔥",
      emoji: "🔥",
      filter: r => r.isOpenNow,
      gradient: "from-rose-500/10 via-orange-500/5 to-transparent",
      accentCls: "text-rose-700 bg-rose-100",
    },
  ];

  const modeExtras: Record<LifestyleMode, LiveSectionConfig[]> = {
    morning: [
      {
        id: "cafe_rush",
        title: "Café-Rush",
        subtitle: "Die beliebtesten Cafés heute Morgen",
        icon: "☕",
        emoji: "☕",
        filter: r => (r as any).businessType === "cafe" && r.isOpenNow,
        gradient: "from-amber-500/10 via-yellow-500/5 to-transparent",
        accentCls: "text-amber-700 bg-amber-100",
      },
    ],
    lunch: [
      {
        id: "lunch_rush",
        title: "Lunch-Rush",
        subtitle: "Jetzt stark besucht — buche schnell",
        icon: "🍽️",
        emoji: "🍽️",
        filter: r => (r as any).businessType === "restaurant" && r.isOpenNow,
        gradient: "from-orange-500/10 via-amber-500/5 to-transparent",
        accentCls: "text-orange-700 bg-orange-100",
      },
    ],
    afternoon: [
      {
        id: "afternoon_cafes",
        title: "Nachmittags-Hotspots",
        subtitle: "Kaffee & Kuchen — jetzt voll im Gang",
        icon: "☕",
        emoji: "☕",
        filter: r => (r as any).businessType === "cafe" && r.isOpenNow,
        gradient: "from-amber-400/10 via-orange-400/5 to-transparent",
        accentCls: "text-amber-700 bg-amber-100",
      },
    ],
    evening: [
      {
        id: "evening_hot",
        title: "Hot heute Abend",
        subtitle: "Angesagte Restaurants & Bars jetzt",
        icon: "🌆",
        emoji: "🌆",
        filter: r => r.isOpenNow,
        gradient: "from-violet-500/10 via-primary/5 to-transparent",
        accentCls: "text-violet-700 bg-violet-100",
      },
    ],
    night: [
      {
        id: "nightlife_heat",
        title: "Nightlife-Heatmap",
        subtitle: "Bars & Nachtlokale gerade voll im Gang",
        icon: "🌙",
        emoji: "🌙",
        filter: r => (r as any).businessType === "bar" && r.isOpenNow,
        gradient: "from-indigo-500/10 via-violet-500/5 to-transparent",
        accentCls: "text-indigo-700 bg-indigo-100",
      },
    ],
  };

  return [...(modeExtras[mode] ?? []), ...base];
}
