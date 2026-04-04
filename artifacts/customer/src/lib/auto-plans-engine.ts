/**
 * Auto Plans Engine — predictive social outing suggestions.
 *
 * Determines when conditions are right for an outing and generates
 * a proactive plan suggestion. Fully privacy-safe and client-side.
 * Uses localStorage to track behavior patterns and suppress spam.
 */

import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";
import type { SocialCue, FriendProfile, RadarZone } from "@/lib/social-api";
import { generateInstantPlan, getAutoMode, type PlanMode, type InstantPlanSuggestion } from "@/lib/instant-plan-engine";

// ─── localStorage keys ────────────────────────────────────────────────────────

const KEYS = {
  lastSuggestion:   "restosmart_auto_plan_last_suggestion",
  lastDismiss:      "restosmart_auto_plan_last_dismiss",
  outcomeHistory:   "restosmart_auto_plan_outcomes",
  behaviorPatterns: "restosmart_auto_plan_patterns",
  suppressUntil:    "restosmart_auto_plan_suppress_until",
} as const;

// ─── Outcome tracking ─────────────────────────────────────────────────────────

export type SuggestionOutcome = "accepted" | "dismissed" | "ignored";

interface OutcomeRecord {
  planMode: PlanMode;
  outcome: SuggestionOutcome;
  hour: number;
  ts: number;
}

export function recordOutcome(planMode: PlanMode, outcome: SuggestionOutcome) {
  try {
    const raw = localStorage.getItem(KEYS.outcomeHistory);
    const history: OutcomeRecord[] = raw ? JSON.parse(raw) : [];
    history.push({ planMode, outcome, hour: new Date().getHours(), ts: Date.now() });
    // Keep last 50 outcomes
    localStorage.setItem(KEYS.outcomeHistory, JSON.stringify(history.slice(-50)));

    if (outcome === "dismissed") {
      // Suppress for 2 hours after dismiss
      localStorage.setItem(KEYS.suppressUntil, String(Date.now() + 2 * 3600000));
    }
    if (outcome === "ignored") {
      // Suppress for 30 mins after ignore
      localStorage.setItem(KEYS.suppressUntil, String(Date.now() + 30 * 60000));
    }
    localStorage.setItem(KEYS.lastSuggestion, String(Date.now()));
  } catch {}
}

// ─── Acceptance rate for a given mode ────────────────────────────────────────

function getAcceptanceRate(mode: PlanMode): number {
  try {
    const raw = localStorage.getItem(KEYS.outcomeHistory);
    if (!raw) return 0.5; // neutral prior
    const history: OutcomeRecord[] = JSON.parse(raw);
    const modeHistory = history.filter(h => h.planMode === mode);
    if (modeHistory.length < 3) return 0.5;
    const accepted = modeHistory.filter(h => h.outcome === "accepted").length;
    return accepted / modeHistory.length;
  } catch { return 0.5; }
}

// ─── Readiness scoring ────────────────────────────────────────────────────────

interface ReadinessResult {
  score: number;           // 0–100
  isReady: boolean;        // score >= threshold
  suppressedUntil: number; // timestamp
  reasons: string[];       // debug labels
}

function computeReadiness(params: {
  hour: number;
  friendCount: number;
  radarZones: RadarZone[];
  cues: Record<string, SocialCue>;
  restaurants: MarketplaceRestaurant[];
  flashDeals: MarketplaceFlashDeal[];
  mode: LifestyleMode;
  planMode: PlanMode;
}): ReadinessResult {
  const { hour, friendCount, radarZones, cues, restaurants, mode, planMode } = params;
  const reasons: string[] = [];
  let score = 0;

  // ── Check suppression first ─────────────────────────────────────────────────
  const suppressUntil = parseInt(localStorage.getItem(KEYS.suppressUntil) ?? "0");
  if (suppressUntil > Date.now()) {
    return { score: 0, isReady: false, suppressedUntil: suppressUntil, reasons: ["suppressed"] };
  }

  // ── Time of day relevance ───────────────────────────────────────────────────
  const goodHours: Record<PlanMode, [number, number][]> = {
    quick_coffee: [[7, 10], [14, 17]],
    lunch_plan:   [[11, 14]],
    group_dinner: [[17, 21]],
    night_out:    [[20, 23]],
    trending_spot:[[10, 22]],
  };
  const ranges = goodHours[planMode] ?? goodHours.trending_spot;
  const inGoodHour = ranges.some(([start, end]) => hour >= start && hour <= end);
  if (inGoodHour) { score += 25; reasons.push("good_time"); }

  // ── Day of week (weekend boost) ────────────────────────────────────────────
  const dow = new Date().getDay(); // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) { score += 15; reasons.push("weekend"); }
  else if (dow === 5 /* Fri */) { score += 10; reasons.push("friday"); }

  // ── Friend social signals ──────────────────────────────────────────────────
  if (friendCount > 0) {
    score += Math.min(friendCount * 10, 25);
    reasons.push(`${friendCount}_friends`);
  }
  if (radarZones.length > 0) {
    const totalFriendsActive = radarZones.reduce((sum, z) => sum + z.friendCount, 0);
    score += Math.min(totalFriendsActive * 15, 30);
    reasons.push(`radar_${radarZones.length}_zones`);
  }

  // ── Live activity ──────────────────────────────────────────────────────────
  const hotPlaces = restaurants.filter(r => r.isOpenNow && (r as any).availabilityStatus !== "full");
  if (hotPlaces.length > 0) { score += 10; reasons.push("hot_places_open"); }

  const flashActive = params.flashDeals.filter(d => {
    const exp = new Date(d.flashExpiresAt ?? 0).getTime();
    return exp > Date.now();
  });
  if (flashActive.length > 0) { score += 12; reasons.push("flash_deals_live"); }

  // ── Historical acceptance for this mode ───────────────────────────────────
  const acceptRate = getAcceptanceRate(planMode);
  if (acceptRate > 0.6) { score += 15; reasons.push("high_acceptance"); }
  else if (acceptRate < 0.25) { score -= 10; reasons.push("low_acceptance"); }

  // ── Min time since last suggestion ────────────────────────────────────────
  const lastTs = parseInt(localStorage.getItem(KEYS.lastSuggestion) ?? "0");
  const minGapMs = 60 * 60 * 1000; // 1 hour between suggestions
  if (Date.now() - lastTs < minGapMs) {
    return { score: 0, isReady: false, suppressedUntil: lastTs + minGapMs, reasons: ["too_soon"] };
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    isReady: score >= 45,
    suppressedUntil: suppressUntil,
    reasons,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface AutoPlanResult {
  isReady: boolean;
  suggestion: InstantPlanSuggestion | null;
  readinessScore: number;
  suppressedUntil: number;
  triggerReason: string;
}

export function evaluateAutoPlans(params: {
  email: string;
  restaurants: MarketplaceRestaurant[];
  flashDeals: MarketplaceFlashDeal[];
  friends: FriendProfile[];
  radarZones: RadarZone[];
  cues: Record<string, SocialCue>;
  mode: LifestyleMode;
  hasTodayMealPlan?: boolean;
}): AutoPlanResult {
  const { email, restaurants, flashDeals, friends, radarZones, cues, mode, hasTodayMealPlan } = params;

  if (!email) return { isReady: false, suggestion: null, readinessScore: 0, suppressedUntil: 0, triggerReason: "no_email" };

  const hour = new Date().getHours();
  const planMode = getAutoMode(hour);

  // If the user already has a meal plan for today's relevant window, don't override with a competing suggestion
  if (hasTodayMealPlan) {
    const isMealHour = (planMode === "lunch_plan" && hour >= 11 && hour <= 14)
      || (planMode === "group_dinner" && hour >= 17 && hour <= 21);
    if (isMealHour) {
      return { isReady: false, suggestion: null, readinessScore: 0, suppressedUntil: 0, triggerReason: "meal_plan_active" };
    }
  }

  const readiness = computeReadiness({
    hour, friendCount: friends.length, radarZones, cues, restaurants, flashDeals, mode, planMode,
  });

  if (!readiness.isReady) {
    return {
      isReady: false,
      suggestion: null,
      readinessScore: readiness.score,
      suppressedUntil: readiness.suppressedUntil,
      triggerReason: readiness.reasons[0] ?? "not_ready",
    };
  }

  const suggestion = generateInstantPlan({
    restaurants, flashDeals, friends, radarZones, cues, mode, planMode,
  });

  if (!suggestion) {
    return { isReady: false, suggestion: null, readinessScore: readiness.score, suppressedUntil: 0, triggerReason: "no_venue_found" };
  }

  // Record that we showed a suggestion
  localStorage.setItem(KEYS.lastSuggestion, String(Date.now()));

  const triggerLabel = readiness.reasons.includes("radar_1_zones") || readiness.reasons.some(r => r.startsWith("radar"))
    ? "Freunde in der Nähe aktiv"
    : readiness.reasons.includes("weekend")
    ? "Perfekt für das Wochenende"
    : readiness.reasons.includes("flash_deals_live")
    ? "Aktive Angebote verfügbar"
    : readiness.reasons.includes("good_time")
    ? "Jetzt der richtige Zeitpunkt"
    : "Basierend auf deinen Gewohnheiten";

  return {
    isReady: true,
    suggestion,
    readinessScore: readiness.score,
    suppressedUntil: 0,
    triggerReason: triggerLabel,
  };
}
