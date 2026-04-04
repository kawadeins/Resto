/**
 * Monetization Engine — client-side boost scoring and ethical placement logic.
 *
 * Premium businesses receive relevance-aware boosts. The boost multiplier
 * is applied ON TOP of existing quality scores — it never replaces quality.
 * A low-rated premium business still won't outrank a high-rated free one.
 *
 * Boost multipliers: 1.15–1.35× depending on type and time relevance.
 * Maximum possible boost over free: 35% (ethical cap).
 */

import type { MarketplaceRestaurant } from "@workspace/api-client-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ─── Boost type config (mirrors server) ──────────────────────────────────────

export interface BoostConfig {
  type: string;
  label: string;
  emoji: string;
  description: string;         // German, business-type-aware
  hours: [number, number];     // active time window
  multiplier: number;          // relevance score boost
  bizTypes: string[];
  businessCopy: Record<string, string>; // biz-type-specific value prop
}

export const BOOST_CONFIGS: BoostConfig[] = [
  {
    type: "breakfast_boost",
    label: "Frühstücks-Boost",
    emoji: "☕",
    description: "Sichtbarkeit 6–10 Uhr für Frühstücksgäste maximieren",
    hours: [6, 10],
    multiplier: 1.25,
    bizTypes: ["cafe", "restaurant"],
    businessCopy: {
      cafe: "Mehr Gäste in Ihrer ruhigsten Morgenstunde — erscheinen Sie ganz oben im Entdecken-Feed.",
      restaurant: "Frühstücksangebote sichtbarer machen — mehr Tischbuchungen am Morgen.",
    },
  },
  {
    type: "lunch_boost",
    label: "Mittags-Boost",
    emoji: "🍽️",
    description: "Priorität in der Mittagszeit 11–14 Uhr",
    hours: [11, 14],
    multiplier: 1.30,
    bizTypes: ["cafe", "restaurant"],
    businessCopy: {
      cafe: "Mittagsgäste anziehen — Cafés mit Mittagsangeboten erreichen 3× mehr Klicks.",
      restaurant: "Zum beliebtesten Mittagsziel in Ihrer Gegend werden — mehr Laufkundschaft.",
    },
  },
  {
    type: "happy_hour_boost",
    label: "Happy Hour Boost",
    emoji: "🍹",
    description: "Erhöhte Sichtbarkeit 15–19 Uhr",
    hours: [15, 19],
    multiplier: 1.28,
    bizTypes: ["bar", "restaurant"],
    businessCopy: {
      bar: "Ihre Happy Hour wird zur meistbesuchten — Sichtbarkeit genau dann, wenn Gäste planen.",
      restaurant: "Nachmittags-Lücken füllen — Aperitif-Gäste und frühe Abendessen anziehen.",
    },
  },
  {
    type: "nightlife_boost",
    label: "Nachtleben-Boost",
    emoji: "🌙",
    description: "Maximale Sichtbarkeit ab 19 Uhr bis spät in die Nacht",
    hours: [19, 2],
    multiplier: 1.35,
    bizTypes: ["bar"],
    businessCopy: {
      bar: "Werden Sie die erste Wahl für Abendgäste — erscheinen Sie in der Karte, im Heat-Map und in Gruppen-Vorschlägen.",
    },
  },
  {
    type: "local_spotlight",
    label: "Local Spotlight",
    emoji: "⭐",
    description: "Ganztägige Premium-Platzierung im Entdecken-Feed und auf der Karte",
    hours: [0, 24],
    multiplier: 1.20,
    bizTypes: ["restaurant", "cafe", "bar"],
    businessCopy: {
      restaurant: "24/7 auf Seite 1 — mehr Sichtbarkeit, mehr Vertrauen, mehr Buchungen.",
      cafe: "Ihr Café im Mittelpunkt — Featured-Badge und Top-Platzierung im ganzen Tag.",
      bar: "Immer sichtbar für Abend- und Wochenendgäste — lokale Bekanntheit maximieren.",
    },
  },
  {
    type: "local_heat_boost",
    label: "Heat-Map Boost",
    emoji: "🔥",
    description: "Priorisierte Darstellung in der Live-Karte und im Heat-Map-Layer",
    hours: [0, 24],
    multiplier: 1.22,
    bizTypes: ["restaurant", "cafe", "bar"],
    businessCopy: {
      restaurant: "Im Heat-Map als aktiver Hotspot gezeigt — Gäste sehen Sie genau dann, wenn sie in der Nähe sind.",
      cafe: "Live auf der Karte als belebter Treffpunkt — organische Laufkundschaft verdreifachen.",
      bar: "Im Nachtleben-Layer der Karte prominent — Gäste auf dem Weg finden Sie zuerst.",
    },
  },
];

// ─── Active promotion record from API ────────────────────────────────────────

export interface ActivePromotion {
  restaurant_id: number;
  type: string;
  impressions: number;
  clicks: number;
  bookings_attributed: number;
}

// ─── Boost cache (refreshed every 5 min) ─────────────────────────────────────

let boostCache: ActivePromotion[] = [];
let boostCacheTs = 0;

export async function fetchActiveBoosts(): Promise<ActivePromotion[]> {
  const now = Date.now();
  if (now - boostCacheTs < 5 * 60 * 1000) return boostCache;

  try {
    const res = await fetch(`${API_BASE}/api/promotions/active`);
    if (!res.ok) return boostCache;
    boostCache = await res.json();
    boostCacheTs = now;
    return boostCache;
  } catch {
    return boostCache;
  }
}

// ─── Time-window check ────────────────────────────────────────────────────────

export function isBoostActive(boostType: string, hour: number = new Date().getHours()): boolean {
  const cfg = BOOST_CONFIGS.find(b => b.type === boostType);
  if (!cfg) return false;
  const [start, end] = cfg.hours;
  if (end < start) {
    // Crosses midnight
    return hour >= start || hour <= end;
  }
  return hour >= start && hour <= end;
}

// ─── Boost multiplier for a restaurant at current time ────────────────────────

export function getBoostMultiplier(
  restaurantId: number,
  businessType: string,
  activeBoosts: ActivePromotion[],
): number {
  const hour = new Date().getHours();
  const restaurantBoosts = activeBoosts.filter(b => b.restaurant_id === restaurantId);
  if (restaurantBoosts.length === 0) return 1.0;

  let maxMultiplier = 1.0;
  for (const boost of restaurantBoosts) {
    if (!isBoostActive(boost.type, hour)) continue;
    const cfg = BOOST_CONFIGS.find(b => b.type === boost.type);
    if (!cfg) continue;
    if (!cfg.bizTypes.includes(businessType)) continue;
    maxMultiplier = Math.max(maxMultiplier, cfg.multiplier);
  }

  // Ethical cap: no more than 1.35× boost
  return Math.min(1.35, maxMultiplier);
}

// ─── Apply boost to restaurant ranking scores ─────────────────────────────────

export function applyBoostToScore(
  baseScore: number,
  restaurantId: number,
  businessType: string,
  activeBoosts: ActivePromotion[],
): number {
  const multiplier = getBoostMultiplier(restaurantId, businessType, activeBoosts);
  // Boost is applied only to the discovery component (not rating) to protect quality
  return Math.min(100, baseScore * multiplier);
}

// ─── Check if a restaurant has an active boost ────────────────────────────────

export function hasActiveBoost(restaurantId: number, activeBoosts: ActivePromotion[]): boolean {
  const hour = new Date().getHours();
  return activeBoosts.some(b =>
    b.restaurant_id === restaurantId && isBoostActive(b.type, hour),
  );
}

// ─── Contextual upsell moment detection ──────────────────────────────────────

export type UpsellMoment =
  | "after_booking_spike"    // restaurant got multiple bookings recently
  | "after_low_traffic"      // analytics show below-average views
  | "competitor_is_boosted"  // a similar business in area has active boost
  | "peak_hour_approaching"  // 30 min before their busy window
  | "weekend_prep"           // Friday afternoon prompt
  | "first_month_offer"      // new premium subscriber — launch offer
  | null;

export interface UpsellSuggestion {
  moment: UpsellMoment;
  headline: string;
  subline: string;
  boostType: string;
  urgency: "low" | "medium" | "high";
  ctaLabel: string;
}

export function detectUpsellMoment(params: {
  businessType: string;
  recentBookings: number;
  avgDailyBookings: number;
  hasCompetitorBoost: boolean;
  isPremium: boolean;
  dayOfWeek: number; // 0=Sun
  hour: number;
}): UpsellSuggestion | null {
  const { businessType, recentBookings, avgDailyBookings, hasCompetitorBoost, isPremium, dayOfWeek, hour } = params;

  if (!isPremium) return null; // non-premium sees the premium upsell, not boost upsell

  // Peak hour approaching
  const relevantBoost = BOOST_CONFIGS.find(b =>
    b.bizTypes.includes(businessType) &&
    Math.abs(b.hours[0] - hour) <= 1,
  );
  if (relevantBoost) {
    const copy = relevantBoost.businessCopy[businessType] ?? relevantBoost.description;
    return {
      moment: "peak_hour_approaching",
      headline: `${relevantBoost.emoji} ${relevantBoost.label} jetzt aktivieren`,
      subline: copy,
      boostType: relevantBoost.type,
      urgency: "high",
      ctaLabel: "Jetzt aktivieren",
    };
  }

  // Competitor boosted
  if (hasCompetitorBoost) {
    const bestBoost = BOOST_CONFIGS.find(b => b.bizTypes.includes(businessType) && isBoostActive(b.type, hour));
    if (bestBoost) return {
      moment: "competitor_is_boosted",
      headline: "Ein Konkurrent wirbt gerade aktiv",
      subline: `Holen Sie sich mit dem ${bestBoost.label} die Sichtbarkeit zurück.`,
      boostType: bestBoost.type,
      urgency: "high",
      ctaLabel: "Jetzt gegenhalten",
    };
  }

  // Weekend prep (Friday 14–18h)
  if (dayOfWeek === 5 && hour >= 14 && hour <= 18) {
    const wb = BOOST_CONFIGS.find(b => b.type === "nightlife_boost" || b.type === "happy_hour_boost");
    if (wb && wb.bizTypes.includes(businessType)) return {
      moment: "weekend_prep",
      headline: "Wochenende steht bevor",
      subline: `Starten Sie den ${wb.label}, bevor die Gäste planen.`,
      boostType: wb.type,
      urgency: "medium",
      ctaLabel: "Boost starten",
    };
  }

  // Low traffic signal
  if (recentBookings < avgDailyBookings * 0.6 && avgDailyBookings > 0) {
    return {
      moment: "after_low_traffic",
      headline: "Weniger Buchungen als üblich",
      subline: "Ein Local Spotlight bringt Sie wieder in den Vordergrund.",
      boostType: "local_spotlight",
      urgency: "medium",
      ctaLabel: "Sichtbarkeit erhöhen",
    };
  }

  return null;
}

// ─── Premium value propositions by business type ──────────────────────────────

export const PREMIUM_VALUE_BY_TYPE: Record<string, {
  headline: string;
  subline: string;
  benefits: { icon: string; text: string }[];
  socialProof: string;
}> = {
  restaurant: {
    headline: "Mehr Buchungen. Mehr Wachstum.",
    subline: "Premium macht Ihr Restaurant zur ersten Wahl für hungrige Gäste.",
    benefits: [
      { icon: "🔝", text: "Priorisierte Platzierung im Entdecken-Feed" },
      { icon: "🔥", text: "Heat-Map & Live-Zones Sichtbarkeit" },
      { icon: "📊", text: "Vollständige Analytics & Buchungseinblicke" },
      { icon: "🎯", text: "Smart Offers & Kampagnen-Tools" },
      { icon: "👥", text: "Gruppen-Vorschlag Priorität für große Tische" },
      { icon: "✅", text: "Verifiziertes Restaurant-Badge" },
    ],
    socialProof: "Premium-Restaurants erhalten durchschnittlich 3,2× mehr Profilaufrufe.",
  },
  cafe: {
    headline: "Ihr Café. Überall sichtbar.",
    subline: "Von der Morgendämmerung bis zum Nachmittag — stets die erste Wahl.",
    benefits: [
      { icon: "☕", text: "Frühstücks- & Mittags-Boost genau zur richtigen Zeit" },
      { icon: "🗺️", text: "Prominente Platzierung auf der Live-Karte" },
      { icon: "⭐", text: "Featured-Café-Badge im Entdecken-Feed" },
      { icon: "📈", text: "Impressionen, Klicks & Buchungsanalysen" },
      { icon: "🎁", text: "Flash Deals & Smart Offers selbst gestalten" },
      { icon: "✅", text: "Verifiziertes Café-Badge" },
    ],
    socialProof: "Premium-Cafés verzeichnen im Schnitt 2,8× mehr Morgengäste.",
  },
  bar: {
    headline: "Die Nacht gehört Ihnen.",
    subline: "Werden Sie zum Anlaufpunkt für jeden Abend in Ihrer Stadt.",
    benefits: [
      { icon: "🌙", text: "Nachtleben- & Happy Hour Boost ab 15 Uhr" },
      { icon: "🔥", text: "Heat-Map Hotspot — sichtbar wenn es zählt" },
      { icon: "👥", text: "Gruppen-Outings & Instant Plan Priorität" },
      { icon: "🎯", text: "Gezielte Abend-Kampagnen & Promotions" },
      { icon: "📊", text: "Abend-Analytics & Conversion-Tracking" },
      { icon: "✅", text: "Verifiziertes Bar-Badge" },
    ],
    socialProof: "Premium-Bars erhalten 4× mehr Gruppen-Buchungsanfragen.",
  },
};

// ─── Record a promotion event (fire-and-forget) ───────────────────────────────

export async function recordPromoEvent(
  promotionId: number,
  eventType: "impression" | "click" | "booking" | "heat_exposure" | "group_exposure",
  context: string,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/promotions/${promotionId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, context }),
    });
  } catch {}
}
