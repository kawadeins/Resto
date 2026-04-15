/**
 * Behavior Priority Engine — Unified Ranking Brain
 *
 * THE single source of truth for ranking every venue across all discovery
 * surfaces: homepage Smart Offers, Near You Now, Trending, Explore search.
 *
 * Formula:
 *   finalScore = relevanceScore * fairnessMultiplier + boostScore
 *
 * Where:
 *   relevanceScore = smart-offers score (prefs + location + lifestyle + rating)
 *   fairnessMultiplier = penalises closed venues, far venues, off-peak biz types
 *   boostScore = 0-12 pts, only applied if budget remaining AND time-window match
 *
 * Transparency:
 *   Boosted venues get a score bonus if their budget is not exhausted.
 */

import { scoreRestaurant } from "./smart-offers";
import { haversineKm } from "@/hooks/use-geolocation";
import type { UserContext, ReasonLabel } from "./smart-offers";
import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";
import type { SocialCue } from "@/lib/social-api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RankedVenue {
  restaurant: MarketplaceRestaurant;
  finalScore: number;
  relevanceScore: number;
  boostScore: number;
  reasons: ReasonLabel[];
  primaryReason: ReasonLabel;
  flashDeal: MarketplaceFlashDeal | null;
  distance?: number;
}

export interface RankContext {
  user: UserContext;
  mode: LifestyleMode;
  interactions: { cafe: number; restaurant: number; bar: number };
  cues?: Record<string, SocialCue>;
  flashDeals?: MarketplaceFlashDeal[];
  limit?: number;
  allowClosed?: boolean;
}

// ─── Time-aware boost multiplier ──────────────────────────────────────────────
// A bar's Nightlife Boost should not help them at 8am.
// Rule 6: boost must respect time context.

const TIME_BIZ_PRIORITY: Record<LifestyleMode, string[]> = {
  morning:   ["cafe"],
  lunch:     ["restaurant"],
  afternoon: ["cafe", "restaurant"],
  evening:   ["restaurant", "bar"],
  night:     ["bar"],
};

function timeBoostMultiplier(restaurant: MarketplaceRestaurant, mode: LifestyleMode): number {
  const biz: string = (restaurant as any).businessType ?? "restaurant";
  const priority = TIME_BIZ_PRIORITY[mode] ?? [];
  if (priority[0] === biz) return 1.0;
  if (priority[1] === biz) return 0.6;
  return 0.2;
}

// ─── Main ranking function ────────────────────────────────────────────────────

export function rankVenues(
  restaurants: MarketplaceRestaurant[],
  ctx: RankContext
): RankedVenue[] {
  const {
    user,
    mode,
    interactions,
    flashDeals = [],
    limit = 20,
    allowClosed = false,
  } = ctx;

  const flashByRestaurantId = new Map<number, MarketplaceFlashDeal>();
  for (const deal of flashDeals) {
    if (deal.restaurant?.id != null) flashByRestaurantId.set(deal.restaurant.id, deal);
  }

  const ranked: RankedVenue[] = [];

  for (const restaurant of restaurants) {
    if (!restaurant.isOpenNow && !allowClosed) continue;

    // ── Base relevance score (smart-offers engine handles all personalization) ──
    const offer = scoreRestaurant(
      restaurant,
      user,
      mode,
      interactions,
      flashByRestaurantId.get(restaurant.id) ?? null
    );

    // Remove the unconditional +12 boost already baked into scoreRestaurant.
    // We re-apply it budget-aware below.
    let relevanceScore = offer.score;
    if ((restaurant as any).hasActiveBoost) {
      relevanceScore = Math.max(0, relevanceScore - 12);
    }

    // ── Fairness gate: closed venue gets heavily penalised ────────────────────
    const closedMult = restaurant.isOpenNow ? 1.0 : 0.4;

    // ── Fairness gate: distance cap — very far venues cannot rank high ────────
    let distMult = 1.0;
    if (user.lat && user.lng && restaurant.lat && restaurant.lng) {
      const dist = haversineKm(user.lat, user.lng, restaurant.lat, restaurant.lng);
      if (dist > 10) distMult = 0.25;
      else if (dist > 6) distMult = 0.65;
    }

    // ── Boost score (budget-aware, time-aware) ────────────────────────────────
    // Rule 4: boost enhances relevance, never overrides it.
    // Rule 6: boost must respect time context.
    const budgetRemaining: number = (restaurant as any).boostBudgetRemaining ?? Infinity;
    const hasActiveBudgetedBoost =
      Boolean((restaurant as any).hasActiveBoost) && budgetRemaining > 0;

    let boostScore = 0;

    if (hasActiveBudgetedBoost) {
      const timeFactor = timeBoostMultiplier(restaurant, mode);
      boostScore = Math.round(12 * timeFactor);
    }

    // ── Compute final score ───────────────────────────────────────────────────
    const adjustedRelevance = relevanceScore * closedMult * distMult;
    const finalScore = Math.min(100, Math.max(0, adjustedRelevance + boostScore));

    ranked.push({
      restaurant,
      finalScore,
      relevanceScore: Math.round(adjustedRelevance),
      boostScore,
      reasons: offer.reasons,
      primaryReason: offer.primaryReason,
      flashDeal: flashByRestaurantId.get(restaurant.id) ?? null,
      distance: offer.distance,
    });
  }

  return ranked
    .filter(r => r.finalScore > 0)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);
}

// ─── Context-free ranking for Trending / Top section ─────────────────────────
// Used when no user profile is available. Ranks by time-matched biz type +
// rating + budgeted boost. Never claims "real-time" traffic.

export function rankByContext(
  restaurants: MarketplaceRestaurant[],
  mode: LifestyleMode,
  limit = 6
): RankedVenue[] {
  const priority = TIME_BIZ_PRIORITY[mode] ?? ["restaurant"];

  return restaurants
    .filter(r => r.isOpenNow)
    .map(r => {
      const biz: string = (r as any).businessType ?? "restaurant";
      const budgetRemaining: number = (r as any).boostBudgetRemaining ?? Infinity;
      const hasActiveBudgetedBoost = Boolean((r as any).hasActiveBoost) && budgetRemaining > 0;

      let score = (r.rating ?? 0) * 14;
      if (biz === priority[0]) score += 14;
      else if (priority[1] && biz === priority[1]) score += 6;

      const boostScore = hasActiveBudgetedBoost ? Math.round(10 * timeBoostMultiplier(r, mode)) : 0;

      return {
        restaurant: r,
        finalScore: Math.min(100, score + boostScore),
        relevanceScore: Math.round(score),
        boostScore,
        reasons: [] as ReasonLabel[],
        primaryReason: {
          emoji: "⭐",
          text: "Top bewertet",
          cls: "bg-amber-50 text-amber-700 border-amber-200",
        } as ReasonLabel,
        flashDeal: null,
        distance: undefined,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);
}
