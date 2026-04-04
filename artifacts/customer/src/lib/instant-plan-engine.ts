/**
 * Instant Plan Engine — generates plan suggestions client-side in milliseconds.
 *
 * Uses: live activity scores, time of day, business type, availability,
 * friend social activity, smart offers, and mode selection.
 *
 * Privacy safe: no location tracking, pure ranking from public signals.
 */

import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";
import type { SocialCue, FriendProfile, RadarZone } from "@/lib/social-api";
import { scoreLiveActivity } from "@/lib/live-activity";

// ─── Plan modes ───────────────────────────────────────────────────────────────

export type PlanMode = "quick_coffee" | "lunch_plan" | "night_out" | "group_dinner" | "trending_spot";

export interface PlanModeConfig {
  id: PlanMode;
  label: string;
  emoji: string;
  shortLabel: string;
  bizTypes: string[];
  gradient: string;
  suggestHours: [number, number];   // [start, end] hour range
  groupSize: [number, number];      // [min, max] friends to invite
  durationMins: number;             // suggested duration
}

export const PLAN_MODES: PlanModeConfig[] = [
  {
    id: "quick_coffee",
    label: "Schneller Kaffee",
    shortLabel: "Kaffee",
    emoji: "☕",
    bizTypes: ["cafe"],
    gradient: "from-amber-500 to-orange-500",
    suggestHours: [7, 17],
    groupSize: [1, 3],
    durationMins: 60,
  },
  {
    id: "lunch_plan",
    label: "Mittagessen",
    shortLabel: "Lunch",
    emoji: "🍽️",
    bizTypes: ["restaurant"],
    gradient: "from-orange-500 to-rose-500",
    suggestHours: [11, 15],
    groupSize: [1, 5],
    durationMins: 75,
  },
  {
    id: "group_dinner",
    label: "Gemeinsames Abendessen",
    shortLabel: "Dinner",
    emoji: "🥂",
    bizTypes: ["restaurant"],
    gradient: "from-violet-500 to-purple-600",
    suggestHours: [17, 22],
    groupSize: [2, 8],
    durationMins: 120,
  },
  {
    id: "night_out",
    label: "Abend ausgehen",
    shortLabel: "Ausgehen",
    emoji: "🌙",
    bizTypes: ["bar"],
    gradient: "from-indigo-500 to-violet-600",
    suggestHours: [20, 2],
    groupSize: [2, 6],
    durationMins: 180,
  },
  {
    id: "trending_spot",
    label: "Trendiger Spot",
    shortLabel: "Trending",
    emoji: "🔥",
    bizTypes: ["restaurant", "cafe", "bar"],
    gradient: "from-rose-500 to-pink-600",
    suggestHours: [0, 24],
    groupSize: [1, 6],
    durationMins: 90,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getAutoMode(hour: number): PlanMode {
  if (hour >= 7 && hour < 11)  return "quick_coffee";
  if (hour >= 11 && hour < 15) return "lunch_plan";
  if (hour >= 15 && hour < 18) return "quick_coffee";
  if (hour >= 18 && hour < 22) return "group_dinner";
  return "night_out";
}

export function getModeConfig(id: PlanMode): PlanModeConfig {
  return PLAN_MODES.find(m => m.id === id) ?? PLAN_MODES[0];
}

function addMinutes(base: Date, mins: number): string {
  const d = new Date(base.getTime() + mins * 60000);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function roundToNext15(date: Date): Date {
  const ms = 15 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export function formatSuggestedTime(offsetMins: number): string {
  const base = roundToNext15(new Date());
  return addMinutes(base, offsetMins);
}

// ─── Plan suggestion types ────────────────────────────────────────────────────

export interface InstantPlanSuggestion {
  mode: PlanMode;
  modeConfig: PlanModeConfig;
  restaurant: MarketplaceRestaurant;
  score: number;
  suggestedTime: string;        // "in 30 min" display
  suggestedTimeRaw: string;     // "14:30" for API
  invitedFriends: FriendProfile[];
  friendsAlreadyThere: string[];  // names from radar
  hasActiveFlash: boolean;
  urgencyLabel: string | null;
  expiresInMins: number;          // plan expires in N minutes from creation
}

// ─── Main engine function ─────────────────────────────────────────────────────

export function generateInstantPlan(params: {
  restaurants: MarketplaceRestaurant[];
  flashDeals: MarketplaceFlashDeal[];
  friends: FriendProfile[];
  radarZones: RadarZone[];
  cues: Record<string, SocialCue>;
  mode: LifestyleMode;
  planMode?: PlanMode;
}): InstantPlanSuggestion | null {
  const { restaurants, flashDeals, friends, radarZones, cues, mode } = params;
  const hour = new Date().getHours();
  const planMode = params.planMode ?? getAutoMode(hour);
  const modeConfig = getModeConfig(planMode);

  // 1. Filter restaurants by mode's business types, open now
  const candidates = restaurants.filter(r => {
    const biz = (r as any).businessType ?? "restaurant";
    const avail = (r as any).availabilityStatus;
    return (
      r.isOpenNow &&
      (modeConfig.bizTypes.includes(biz) || planMode === "trending_spot") &&
      avail !== "full"
    );
  });

  if (candidates.length === 0) return null;

  // Build radar map for quick lookup
  const radarMap = new Map(radarZones.map(z => [z.restaurantId, z]));

  // 2. Score and pick the best restaurant
  const scored = candidates
    .map(r => {
      const live = scoreLiveActivity(r, mode, cues, flashDeals);
      let bonus = 0;
      // Friends already there → big bonus
      const zone = radarMap.get(r.id);
      if (zone) bonus += zone.friendCount * 20;
      // Flash deal → urgency bonus
      if (r.hasActiveFlash) bonus += 15;
      return { r, score: live.score + bonus, zone };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  const best = scored[0];

  // 3. Pick friends to invite (max from modeConfig, prioritise radar overlap)
  const maxFriends = modeConfig.groupSize[1];
  const alreadyThere = best.zone ? best.zone.friendNames : [];
  const alreadyEmails = new Set(
    radarZones.find(z => z.restaurantId === best.r.id)?.friendNames ?? []
  );

  // Sort friends: those active at the venue first, then others
  const sorted = [...friends].sort((a, b) => {
    const aT = alreadyThere.includes(a.name) ? 0 : 1;
    const bT = alreadyThere.includes(b.name) ? 0 : 1;
    return aT - bT;
  });
  const invited = sorted.slice(0, maxFriends);

  // 4. Suggest timing
  const offsetMins = hour >= 20 ? 30 : hour >= 11 && hour < 15 ? 30 : 45;
  const timeRaw = formatSuggestedTime(offsetMins);
  const timeDisplay = offsetMins === 30 ? "in 30 Min." : "in 45 Min.";

  // 5. Urgency label
  const avail = (best.r as any).availabilityStatus;
  const urgency =
    best.r.hasActiveFlash ? `⚡ ${best.r.flashPercentage}% Rabatt aktiv` :
    avail === "nearly_full" ? "⚠️ Fast ausgebucht" :
    avail === "limited"    ? "⏳ Wenige Plätze" :
    alreadyThere.length > 0 ? `👥 ${alreadyThere[0]} ist schon dort` :
    null;

  return {
    mode: planMode,
    modeConfig,
    restaurant: best.r,
    score: best.score,
    suggestedTime: timeDisplay,
    suggestedTimeRaw: timeRaw,
    invitedFriends: invited,
    friendsAlreadyThere: alreadyThere,
    hasActiveFlash: best.r.hasActiveFlash ?? false,
    urgencyLabel: urgency,
    expiresInMins: 120,
  };
}
