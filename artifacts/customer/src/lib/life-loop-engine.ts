/**
 * Life Loop Engine — daily rhythm orchestration + context-aware decision layer.
 *
 * Combines: time of day · digital twin · social signals · location ·
 * heat map · meal plan · micro-moments → decides WHAT to surface,
 * WHEN, and HOW STRONGLY across every surface in the app.
 *
 * Deterministic rule-based scoring — no fake AI, just real behavioral logic.
 */

import type { DigitalTwin, TwinRoutines } from "@/lib/digital-twin";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";
import type { RadarZone, SocialCue } from "@/lib/social-api";
import type { MarketplaceRestaurant } from "@workspace/api-client-react";

// ─── Life moment types ────────────────────────────────────────────────────────

export type LifeMoment =
  | "morning_coffee"
  | "lunch_rush"
  | "afternoon_break"
  | "evening_social"
  | "night_out"
  | "weekend_explorer"
  | "habit_window"
  | "idle";

// ─── Surface priority map ─────────────────────────────────────────────────────

export interface SurfacePriorities {
  smartOffers:       number;  // 0–100
  instantPlan:       number;
  autoPlan:          number;
  activityFeed:      number;
  mapHeatMap:        number;
  mealPlan:          number;
  groupSuggestions:  number;
  liveActivity:      number;
  friendRadar:       number;
  notifications:     number;
}

// ─── Full life loop decision ──────────────────────────────────────────────────

export interface LifeLoopDecision {
  moment:            LifeMoment;
  momentLabel:       string;   // German display label
  momentEmoji:       string;
  momentSubline:     string;   // Short context hint for the UI
  surfaces:          SurfacePriorities;
  twinReadiness:     number;   // 0–100 overall readiness to engage
  contextHint:       string;   // What the twin "knows" → shown subtly in UI
  recommendedMode:   string;   // PlanMode or "none"
  sectionOrder:      string[]; // Ordered list of home sections to render
  microMomentSignal: string;   // "interested" | "uncertain" | "bored" | "satisfied" | "exploring"
  confidence:        number;   // 0–1 decision confidence
}

// ─── Moment detection ─────────────────────────────────────────────────────────

export function detectLifeMoment(
  hour: number,
  dow: number,  // 0=Sun, 6=Sat
  twin: DigitalTwin,
): LifeMoment {
  const routines = twin.routines;
  const isWeekend = dow === 0 || dow === 6;

  // Habit window: user has an established routine that matches right now
  if (routines.morningCoffee && hour >= 7 && hour <= 10)  return "habit_window";
  if (routines.lunchOut && hour >= 11 && hour <= 14)       return "habit_window";
  if (routines.eveningSocial && hour >= 18 && hour <= 22)  return "habit_window";

  // Weekend explorer
  if (isWeekend && routines.weekendExplorer && hour >= 10 && hour <= 21) return "weekend_explorer";

  // Standard time-based moments
  if (hour >= 7  && hour <= 10) return "morning_coffee";
  if (hour >= 11 && hour <= 14) return "lunch_rush";
  if (hour >= 15 && hour <= 17) return "afternoon_break";
  if (hour >= 18 && hour <= 21) return "evening_social";
  if (hour >= 21 || hour <= 2)  return "night_out";

  return "idle";
}

// ─── Moment metadata ──────────────────────────────────────────────────────────

const MOMENT_META: Record<LifeMoment, { label: string; emoji: string; subline: string }> = {
  morning_coffee:   { label: "Guten Morgen",       emoji: "☕", subline: "Zeit für deinen ersten Kaffee" },
  lunch_rush:       { label: "Mittagszeit",         emoji: "🍽️", subline: "Was gibt es heute zu Mittag?" },
  afternoon_break:  { label: "Nachmittags-Pause",   emoji: "🥐", subline: "Gönn dir eine kleine Auszeit" },
  evening_social:   { label: "Abend-Modus",         emoji: "🌆", subline: "Perfekte Zeit für Freunde & gutes Essen" },
  night_out:        { label: "Nacht-Modus",         emoji: "🌙", subline: "Die Nacht gehört dir" },
  weekend_explorer: { label: "Wochenend-Entdecker", emoji: "🗺️", subline: "Zeit, etwas Neues zu erleben" },
  habit_window:     { label: "Deine Gewohnheit",    emoji: "⭐", subline: "Der App kennt deine Routine" },
  idle:             { label: "Willkommen",           emoji: "✨", subline: "Was planst du heute?" },
};

// ─── Context hint generator ───────────────────────────────────────────────────

function buildContextHint(
  twin: DigitalTwin,
  moment: LifeMoment,
  radarZones: RadarZone[],
  hasOffers: boolean,
): string {
  const { routines, preferences, totalInteractions } = twin;

  if (totalInteractions < 3) return "Entdecke RestoSmart — je mehr du nutzt, desto persönlicher wird dein Erlebnis.";

  if (moment === "habit_window" && routines.morningCoffee)
    return `Du trinkst morgens meist einen Kaffee — hier sind die besten Cafés für dich.`;
  if (moment === "habit_window" && routines.lunchOut)
    return `Du isst häufig mittags aus — hier sind heute passende Orte.`;
  if (moment === "habit_window" && routines.eveningSocial)
    return `Dein abendliches Muster erkannt — Freunde & die besten Spots warten.`;

  if (radarZones.length > 0)
    return `${radarZones.reduce((sum, z) => sum + z.friendCount, 0)} Freund(e) sind gerade in der Nähe aktiv.`;

  if (routines.habitualCuisines.length > 0)
    return `Du magst häufig ${routines.habitualCuisines[0]} — hier sind heute die besten Optionen.`;

  if (hasOffers && preferences.offerClickRate > 0.5)
    return "Exklusive Angebote, die zu deinem Stil passen, sind gerade aktiv.";

  if (preferences.planAcceptRate > 0.6)
    return "Du bist heute bereit — der perfekte Plan wartet auf dich.";

  return "Basierend auf deinem Verhalten haben wir das Beste für dich ausgewählt.";
}

// ─── Surface priority calculator ──────────────────────────────────────────────

function calcSurfaces(
  moment: LifeMoment,
  twin: DigitalTwin,
  radarZones: RadarZone[],
  hasFlashDeals: boolean,
): SurfacePriorities {
  const base: SurfacePriorities = {
    smartOffers:      40,
    instantPlan:      40,
    autoPlan:         40,
    activityFeed:     35,
    mapHeatMap:       35,
    mealPlan:         30,
    groupSuggestions: 30,
    liveActivity:     45,
    friendRadar:      30,
    notifications:    20,
  };

  const { preferences: p, routines: r } = twin;
  const hasFriends = radarZones.length > 0;

  // Moment-based boosts
  switch (moment) {
    case "morning_coffee":
      base.smartOffers  += 20;
      base.mealPlan     += 25;
      base.liveActivity += 10;
      base.instantPlan  += r.morningCoffee ? 30 : 10;
      break;
    case "lunch_rush":
      base.instantPlan  += r.lunchOut ? 35 : 15;
      base.smartOffers  += 25;
      base.liveActivity += 20;
      base.mealPlan     += 20;
      break;
    case "afternoon_break":
      base.smartOffers  += 15;
      base.activityFeed += 10;
      base.mapHeatMap   += 10;
      break;
    case "evening_social":
      base.groupSuggestions += hasFriends ? 40 : 20;
      base.activityFeed     += 30;
      base.friendRadar      += hasFriends ? 35 : 10;
      base.instantPlan      += 25;
      base.autoPlan         += 20;
      break;
    case "night_out":
      base.instantPlan  += 30;
      base.mapHeatMap   += 25;
      base.liveActivity += 30;
      base.friendRadar  += hasFriends ? 25 : 5;
      break;
    case "weekend_explorer":
      base.mapHeatMap       += 30;
      base.groupSuggestions += hasFriends ? 35 : 15;
      base.autoPlan         += 25;
      base.smartOffers      += 20;
      break;
    case "habit_window":
      base.instantPlan += 35;
      base.autoPlan    += 40;
      base.smartOffers += 20;
      break;
    case "idle":
      break;
  }

  // Flash deal boost
  if (hasFlashDeals && p.offerClickRate > 0.4) {
    base.smartOffers  += 15;
    base.notifications += 15;
  }

  // Group affinity
  if (p.soloScore > 0.6) {
    base.groupSuggestions += 25;
    base.friendRadar      += 20;
  }

  // Habit window gets max priority
  if (moment === "habit_window") base.autoPlan = Math.min(100, base.autoPlan + 15);

  // Cap all at 100
  Object.keys(base).forEach(k => {
    (base as any)[k] = Math.min(100, (base as any)[k]);
  });

  return base;
}

// ─── Section ordering ─────────────────────────────────────────────────────────

const ALL_SECTIONS = [
  "active_plans",   // incoming plan invitations
  "auto_plan",      // proactive suggestion
  "hero",
  "personalized",
  "smart_offers",
  "live_sections",
  "activity_feed",
  "group_suggestions",
  "near_you",
  "dynamic_sections",
  "cuisine_bubbles",
  "biz_type_nav",
  "cta",
];

function buildSectionOrder(moment: LifeMoment, surfaces: SurfacePriorities, hasFriends: boolean): string[] {
  const order = [...ALL_SECTIONS];

  // In the evening or when friends are active — bump social surfaces earlier
  if (moment === "evening_social" || moment === "night_out" || hasFriends) {
    const feedIdx = order.indexOf("activity_feed");
    const groupIdx = order.indexOf("group_suggestions");
    if (feedIdx > 3) {
      order.splice(feedIdx, 1);
      order.splice(3, 0, "activity_feed");
    }
    if (groupIdx > 4) {
      order.splice(groupIdx, 1);
      order.splice(4, 0, "group_suggestions");
    }
  }

  // During lunch rush — live activity first
  if (moment === "lunch_rush" || moment === "morning_coffee") {
    const liveIdx = order.indexOf("live_sections");
    if (liveIdx > 3) {
      order.splice(liveIdx, 1);
      order.splice(3, 0, "live_sections");
    }
  }

  // During habit window — instant plan right after hero
  if (moment === "habit_window" || moment === "weekend_explorer") {
    const autoIdx = order.indexOf("auto_plan");
    if (autoIdx > 1) {
      order.splice(autoIdx, 1);
      order.splice(1, 0, "auto_plan");
    }
  }

  return order;
}

// ─── Recommended plan mode ────────────────────────────────────────────────────

function getRecommendedMode(moment: LifeMoment, twin: DigitalTwin): string {
  const biz = twin.routines.preferredBizType;
  switch (moment) {
    case "morning_coffee":
    case "habit_window":
      return twin.routines.morningCoffee ? "quick_coffee" : biz === "cafe" ? "quick_coffee" : "lunch_plan";
    case "lunch_rush":        return "lunch_plan";
    case "afternoon_break":   return "quick_coffee";
    case "evening_social":    return twin.preferences.soloScore > 0.5 ? "group_dinner" : "lunch_plan";
    case "night_out":         return "night_out";
    case "weekend_explorer":  return twin.preferences.soloScore > 0.5 ? "group_dinner" : "trending_spot";
    default:                  return "trending_spot";
  }
}

// ─── Twin readiness score ─────────────────────────────────────────────────────

function computeTwinReadiness(
  twin: DigitalTwin,
  moment: LifeMoment,
  radarZones: RadarZone[],
  hasFlashDeals: boolean,
): number {
  let score = 30;

  // Base from plan acceptance rate
  score += twin.preferences.planAcceptRate * 25;

  // Habit window = high readiness
  if (moment === "habit_window") score += 20;

  // Friends active
  if (radarZones.length > 0) score += Math.min(radarZones.length * 8, 20);

  // Flash deals available
  if (hasFlashDeals) score += 8;

  // Micro-moment
  const mm = twin.microMoment.signal;
  if (mm === "interested") score += 15;
  if (mm === "exploring")  score += 10;
  if (mm === "bored")      score += 12; // opportunity
  if (mm === "satisfied")  score -= 20;
  if (mm === "uncertain")  score -= 5;

  // Outing frequency (active users → more ready)
  score += twin.preferences.outingFrequency * 5;

  return Math.min(100, Math.max(0, Math.round(score)));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function evaluateLifeLoop(params: {
  twin: DigitalTwin;
  mode: LifestyleMode;
  radarZones: RadarZone[];
  cues: Record<string, SocialCue>;
  hasFlashDeals: boolean;
  friendCount: number;
  restaurants: MarketplaceRestaurant[];
}): LifeLoopDecision {
  const { twin, radarZones, cues, hasFlashDeals, friendCount } = params;
  const now = new Date();
  const hour = now.getHours();
  const dow  = now.getDay();

  const moment = detectLifeMoment(hour, dow, twin);
  const meta   = MOMENT_META[moment];
  const surfaces = calcSurfaces(moment, twin, radarZones, hasFlashDeals);
  const hasFriends = friendCount > 0 || radarZones.length > 0;
  const sectionOrder = buildSectionOrder(moment, surfaces, hasFriends);
  const twinReadiness = computeTwinReadiness(twin, moment, radarZones, hasFlashDeals);
  const recommendedMode = getRecommendedMode(moment, twin);
  const contextHint = buildContextHint(twin, moment, radarZones, hasFlashDeals);

  return {
    moment,
    momentLabel:       meta.label,
    momentEmoji:       meta.emoji,
    momentSubline:     meta.subline,
    surfaces,
    twinReadiness,
    contextHint,
    recommendedMode,
    sectionOrder,
    microMomentSignal: twin.microMoment.signal,
    confidence: twin.totalInteractions >= 10 ? 0.85 : twin.totalInteractions >= 5 ? 0.65 : 0.40,
  };
}
