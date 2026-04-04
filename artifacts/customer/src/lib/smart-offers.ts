/**
 * Smart Offers Engine — rule-based personalization scoring
 *
 * Scores every restaurant 0-100 against user context signals and returns
 * an ordered list of SmartOffers with human-readable reason labels that
 * explain WHY each result was surfaced.
 *
 * All logic is deterministic and transparent — no fake ML, no black box.
 */

import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import { haversineKm } from "@/hooks/use-geolocation";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserContext {
  favoriteCuisines: string[];      // e.g. ["Italian","Japanese"]
  dietaryStyle: string;             // e.g. "vegetarian" | "vegan" | "halal" | "no_preference"
  allergies: string[];              // e.g. ["nuts","shellfish"]
  favoriteRestaurantIds: string[];  // e.g. ["42", "7"]
  totalBookings: number;
  lat?: number | null;
  lng?: number | null;
}

export interface ReasonLabel {
  text: string;
  emoji: string;
  cls: string;   // tailwind color classes for chip
}

export interface SmartOffer {
  restaurant: MarketplaceRestaurant;
  score: number;          // 0-100
  reasons: ReasonLabel[];
  primaryReason: ReasonLabel;
  flashDeal: MarketplaceFlashDeal | null;
  distance?: number;
}

// ─── Cuisine label normalizer ─────────────────────────────────────────────────
// Favorite cuisines in the profile use English IDs (Italian, Japanese…)
// Restaurant cuisine field uses German strings (Italienisch, Japanisch…)

const CUISINE_ID_TO_GERMAN: Record<string, string[]> = {
  Italian:        ["Italienisch", "Italian"],
  Japanese:       ["Japanisch", "Japanese", "Sushi"],
  French:         ["Französisch", "French"],
  Indian:         ["Indisch", "Indian"],
  Mexican:        ["Mexikanisch", "Mexican"],
  Thai:           ["Thailändisch", "Thai"],
  American:       ["Amerikanisch", "American", "Burger"],
  "Middle Eastern": ["Orientalisch", "Middle Eastern", "Turkish", "Türkisch", "Lebanese"],
  Chinese:        ["Chinesisch", "Chinese"],
  Mediterranean:  ["Mediterran", "Mediterranean", "Greek", "Griechisch"],
  Seafood:        ["Meeresfrüchte", "Seafood", "Fish"],
  Steakhouse:     ["Steakhaus", "Steakhouse", "Steak"],
};

function cuisineMatches(favIds: string[], restaurantCuisine: string): boolean {
  const lower = restaurantCuisine.toLowerCase();
  for (const id of favIds) {
    const variants = CUISINE_ID_TO_GERMAN[id] ?? [id];
    if (variants.some(v => lower.includes(v.toLowerCase()))) return true;
  }
  return false;
}

// ─── Dietary-to-tag mapping ───────────────────────────────────────────────────

const DIETARY_TAGS: Record<string, string[]> = {
  vegetarian: ["vegetarisch", "vegetarian", "vegan", "veggie", "plant"],
  vegan:      ["vegan", "plant-based", "pflanzlich"],
  halal:      ["halal"],
  seafood:    ["meeresfrüchte", "seafood", "fish", "fisch"],
  meat_lover: ["steakhouse", "bbq", "grill", "burger", "fleisch"],
};

function dietaryMatch(dietaryStyle: string, restaurant: MarketplaceRestaurant): boolean {
  if (dietaryStyle === "no_preference") return false;
  const keywords = DIETARY_TAGS[dietaryStyle] ?? [];
  const haystack = [
    restaurant.cuisine,
    ...(restaurant.tags ?? []),
    restaurant.description ?? "",
  ].join(" ").toLowerCase();
  return keywords.some(kw => haystack.includes(kw));
}

// ─── Allergen conflict detection ──────────────────────────────────────────────

const ALLERGEN_DANGER_TAGS: Record<string, string[]> = {
  nuts:      ["nuts", "peanuts", "almond", "nuss", "erdnuss", "mandel"],
  shellfish: ["shellfish", "shrimp", "prawn", "lobster", "schalentiere", "garnelen"],
  gluten:    ["bread", "pizza", "pasta", "gluten", "wheat"],
  lactose:   ["dairy", "cheese", "milk", "cream", "laktose", "käse"],
  eggs:      ["egg", "omelette", "ei"],
  soy:       ["soy", "tofu", "edamame", "soja"],
  fish:      ["fish", "sushi", "salmon", "tuna", "fisch", "lachs"],
};

function hasAllergenRisk(allergies: string[], restaurant: MarketplaceRestaurant): boolean {
  if (!allergies.length || allergies.includes("no_allergies")) return false;
  const haystack = [
    restaurant.cuisine,
    ...(restaurant.tags ?? []),
    restaurant.description ?? "",
  ].join(" ").toLowerCase();
  for (const allergen of allergies) {
    const danger = ALLERGEN_DANGER_TAGS[allergen] ?? [];
    if (danger.some(kw => haystack.includes(kw))) return true;
  }
  return false;
}

// ─── Mode-to-businessType priority ───────────────────────────────────────────

const MODE_PRIORITY: Record<LifestyleMode, { primary: string; secondary: string }> = {
  morning:   { primary: "cafe",       secondary: "restaurant" },
  lunch:     { primary: "restaurant", secondary: "cafe" },
  afternoon: { primary: "cafe",       secondary: "restaurant" },
  evening:   { primary: "restaurant", secondary: "bar" },
  night:     { primary: "bar",        secondary: "restaurant" },
};

// ─── Reason label definitions ─────────────────────────────────────────────────

const R = {
  nearYou:      (): ReasonLabel => ({ emoji: "📍", text: "In Ihrer Nähe",         cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }),
  favCuisine:   (): ReasonLabel => ({ emoji: "✨", text: "Ihre Lieblingsküche",   cls: "bg-primary/8 text-primary border-primary/25" }),
  dietary:      (style: string): ReasonLabel => {
    const map: Record<string, [string, string]> = {
      vegetarian: ["🥗", "Vegetarierfreundlich"],
      vegan:      ["🌿", "Veganfreundlich"],
      halal:      ["🌙", "Halal-Zertifiziert"],
      seafood:    ["🐟", "Meeresfrüchte"],
      meat_lover: ["🥩", "Fleischliebhaber"],
    };
    const [emoji, text] = map[style] ?? ["🍽️", "Ihrer Ernährung"];
    return { emoji, text, cls: "bg-green-50 text-green-700 border-green-200" };
  },
  highRated:    (): ReasonLabel => ({ emoji: "⭐", text: "Hochbewertet",          cls: "bg-amber-50 text-amber-700 border-amber-200" }),
  flashDeal:    (pct: number): ReasonLabel => ({ emoji: "⚡", text: `${pct}% Rabatt heute`, cls: "bg-rose-50 text-rose-700 border-rose-200" }),
  openNow:      (): ReasonLabel => ({ emoji: "🟢", text: "Jetzt geöffnet",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }),
  premium:      (): ReasonLabel => ({ emoji: "🏆", text: "Premiumlokal",          cls: "bg-violet-50 text-violet-700 border-violet-200" }),
  morningCafe:  (): ReasonLabel => ({ emoji: "☕", text: "Gut zum Frühstück",     cls: "bg-amber-50 text-amber-700 border-amber-200" }),
  lunchTip:     (): ReasonLabel => ({ emoji: "🍽️", text: "Mittagstipp",           cls: "bg-primary/8 text-primary border-primary/25" }),
  eveningBar:   (): ReasonLabel => ({ emoji: "🍸", text: "Happy Hour",            cls: "bg-rose-50 text-rose-700 border-rose-200" }),
  nightLife:    (): ReasonLabel => ({ emoji: "🌙", text: "Nachtbetrieb",          cls: "bg-indigo-50 text-indigo-700 border-indigo-200" }),
  favorite:     (): ReasonLabel => ({ emoji: "❤️", text: "Ihr Favorit",           cls: "bg-rose-50 text-rose-700 border-rose-200" }),
  fewSeats:     (): ReasonLabel => ({ emoji: "🪑", text: "Wenige Plätze frei",    cls: "bg-orange-50 text-orange-700 border-orange-200" }),
  goodForWork:  (): ReasonLabel => ({ emoji: "💻", text: "Work-friendly",         cls: "bg-sky-50 text-sky-700 border-sky-200" }),
  mealPlan:     (): ReasonLabel => ({ emoji: "📋", text: "Passt zu Ihrem Plan",   cls: "bg-teal-50 text-teal-700 border-teal-200" }),
};

// ─── Core scoring function ────────────────────────────────────────────────────

export function scoreRestaurant(
  restaurant: MarketplaceRestaurant,
  user: UserContext,
  mode: LifestyleMode,
  interactions: { cafe: number; restaurant: number; bar: number },
  flashDeal: MarketplaceFlashDeal | null = null
): SmartOffer {
  let score = 0;
  const reasons: ReasonLabel[] = [];
  const bizType = (restaurant as any).businessType ?? "restaurant";

  // ── 1. Allergen conflict — hard penalty ───────────────────────────────────
  if (hasAllergenRisk(user.allergies, restaurant)) {
    score -= 40;
  }

  // ── 2. Favorite restaurant ────────────────────────────────────────────────
  if (user.favoriteRestaurantIds.includes(String(restaurant.id))) {
    score += 30;
    reasons.push(R.favorite());
  }

  // ── 3. Favorite cuisine ───────────────────────────────────────────────────
  if (user.favoriteCuisines.length > 0 && cuisineMatches(user.favoriteCuisines, restaurant.cuisine)) {
    score += 25;
    reasons.push(R.favCuisine());
  }

  // ── 4. Dietary style match ────────────────────────────────────────────────
  if (user.dietaryStyle && user.dietaryStyle !== "no_preference" && dietaryMatch(user.dietaryStyle, restaurant)) {
    score += 20;
    reasons.push(R.dietary(user.dietaryStyle));
  }

  // ── 5. Mode-aware businessType priority ───────────────────────────────────
  const modePriority = MODE_PRIORITY[mode];
  if (bizType === modePriority.primary) {
    score += 20;
    if (mode === "morning" && bizType === "cafe") reasons.push(R.morningCafe());
    else if (mode === "lunch" && bizType === "restaurant") reasons.push(R.lunchTip());
    else if ((mode === "evening" || mode === "night") && bizType === "bar") {
      score += 5;
      reasons.push(mode === "night" ? R.nightLife() : R.eveningBar());
    }
  } else if (bizType === modePriority.secondary) {
    score += 8;
  }

  // ── 6. Behavioral boost from interactions ──────────────────────────────────
  const total = interactions.cafe + interactions.restaurant + interactions.bar;
  if (total >= 3) {
    const bizInteractions = (interactions as any)[bizType] ?? 0;
    const share = bizInteractions / total;
    score += Math.round(share * 15); // up to +15 from behavior
  }

  // ── 7. Open now ───────────────────────────────────────────────────────────
  if (restaurant.isOpenNow) {
    score += 18;
    reasons.push(R.openNow());
  }

  // ── 8. Location proximity ─────────────────────────────────────────────────
  let distance: number | undefined;
  if (user.lat && user.lng && restaurant.lat && restaurant.lng) {
    distance = haversineKm(user.lat, user.lng, restaurant.lat, restaurant.lng);
    if (distance <= 0.5) { score += 25; reasons.push(R.nearYou()); }
    else if (distance <= 1.5) { score += 18; reasons.push(R.nearYou()); }
    else if (distance <= 3)   { score += 12; reasons.push(R.nearYou()); }
    else if (distance <= 6)   { score += 5; }
  }

  // ── 9. Rating ─────────────────────────────────────────────────────────────
  if (restaurant.rating >= 4.5) { score += 14; reasons.push(R.highRated()); }
  else if (restaurant.rating >= 4.0) { score += 8; }
  else if (restaurant.rating >= 3.5) { score += 3; }

  // ── 10. Flash deal ────────────────────────────────────────────────────────
  if (restaurant.hasActiveFlash && restaurant.flashPercentage) {
    score += 12;
    reasons.push(R.flashDeal(restaurant.flashPercentage));
  }

  // ── 11. Premium / partner trust ──────────────────────────────────────────
  if (restaurant.isPartner) { score += 10; reasons.push(R.premium()); }
  else if (restaurant.isFeatured) { score += 5; }

  // ── 11b. Ethical boost (premium businesses get relevance-aware uplift) ────
  // Max +12 points — never enough to outrank a significantly better restaurant.
  // Only applies during the boost's active time window (handled server-side via hasActiveBoost).
  if ((restaurant as any).hasActiveBoost) {
    score += 12;
  }

  // ── 12. Availability ──────────────────────────────────────────────────────
  const avail = (restaurant as any).availabilityStatus;
  if (avail === "available") score += 10;
  else if (avail === "limited") { score += 5; reasons.push(R.fewSeats()); }
  else if (avail === "full") score -= 8;

  // ── 13. Work-friendly cafe bonus ─────────────────────────────────────────
  if (bizType === "cafe" && (mode === "morning" || mode === "afternoon")) {
    const tags = (restaurant.tags ?? []).join(" ").toLowerCase();
    if (tags.includes("work") || tags.includes("wifi") || tags.includes("laptop")) {
      score += 8;
      reasons.push(R.goodForWork());
    }
  }

  // Clamp score to 0-100
  score = Math.min(100, Math.max(0, score));

  // De-duplicate reasons (keep first occurrence of each text)
  const seen = new Set<string>();
  const uniqueReasons = reasons.filter(r => {
    if (seen.has(r.text)) return false;
    seen.add(r.text);
    return true;
  });

  // Choose the primary reason (most specific, highest priority)
  const priorityOrder = ["❤️", "✨", "🥗", "🌿", "🌙", "🥩", "⚡", "☕", "🍽️", "🍸", "🌙", "📍", "⭐", "🏆", "🟢", "🪑"];
  const primaryReason = uniqueReasons.sort((a, b) =>
    (priorityOrder.indexOf(a.emoji) + 1 || 99) - (priorityOrder.indexOf(b.emoji) + 1 || 99)
  )[0] ?? R.openNow();

  return {
    restaurant,
    score,
    reasons: uniqueReasons.slice(0, 4),
    primaryReason,
    flashDeal,
    distance,
  };
}

// ─── Rank all restaurants for a user ─────────────────────────────────────────

export function rankSmartOffers(
  restaurants: MarketplaceRestaurant[],
  user: UserContext,
  mode: LifestyleMode,
  interactions: { cafe: number; restaurant: number; bar: number },
  flashDeals: MarketplaceFlashDeal[] = [],
  limit = 8
): SmartOffer[] {
  const flashByRestaurantId = new Map<number, MarketplaceFlashDeal>();
  for (const deal of flashDeals) {
    if (deal.restaurant?.id != null) flashByRestaurantId.set(deal.restaurant.id, deal);
  }

  return restaurants
    .map(r => scoreRestaurant(r, user, mode, interactions, flashByRestaurantId.get(r.id) ?? null))
    .filter(o => o.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Personalization confidence label ─────────────────────────────────────────

export function getPersonalizationLevel(user: UserContext): "high" | "medium" | "low" {
  let signals = 0;
  if (user.favoriteCuisines.length >= 2) signals += 2;
  if (user.dietaryStyle && user.dietaryStyle !== "no_preference") signals += 1;
  if (user.allergies.length > 0 && !user.allergies.includes("no_allergies")) signals += 1;
  if (user.totalBookings >= 3) signals += 1;
  if (user.lat && user.lng) signals += 1;
  if (user.favoriteRestaurantIds.length > 0) signals += 1;
  if (signals >= 5) return "high";
  if (signals >= 2) return "medium";
  return "low";
}
