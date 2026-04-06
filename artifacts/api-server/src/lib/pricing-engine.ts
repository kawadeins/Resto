/**
 * Dynamic Pricing Engine v2 — Smart & Controlled
 *
 * Computes real-time boost impression prices based on:
 *  - Demand    (platform-wide active boosts)
 *  - Time      (business-type-aware peak windows)
 *  - Slot      (same-category competition density)
 *  - Location  (city center vs outer districts)
 *  - Weekend   (bars on Fri/Sat/Sun)
 *
 * Safety:
 *  - Min/max price caps enforced
 *  - Max price change per cycle capped at 25%
 *  - All multipliers returned for full transparency
 *
 * Slot-based pricing tiers:
 *  - Top #1:  highest price (1.30× slot premium)
 *  - Top #2-3: medium price (1.15× slot premium)
 *  - Standard: base price (1.0× slot)
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DemandLevel = "low" | "normal" | "high" | "very_high";
export type LocationTier = "zentrum" | "innenbezirk" | "aussenbezirk";

export interface PricingConfig {
  basePrice: number;
  maxMultiplier: number;
  minPrice: number;
  maxPrice: number;
  maxChangePercent: number;
  demandSensitivity: number;
  demandThresholds: { low: number; normal: number; high: number; very_high: number };
}

export interface SlotTier {
  tier: "top1" | "top3" | "standard";
  label: string;
  multiplier: number;
  pricePer1000: number;
}

export interface PricingResult {
  pricePerImpression: number;
  pricePer1000: number;
  demandLevel: DemandLevel;
  totalActivePlatformBoosts: number;
  competingBoosts: number;
  slotPosition: number;
  locationTier: LocationTier;
  demandSignal: string;
  timeSignal: string;
  competitionSignal: string;
  locationSignal: string;
  pricingContext: string;
  suggestion: string;
  bestBoostWindow: string;
  slotTiers: SlotTier[];
  breakdown: {
    basePrice: number;
    demandMultiplier: number;
    timeMultiplier: number;
    slotMultiplier: number;
    locationMultiplier: number;
    weekendBonus: number;
    finalPrice: number;
    totalMultiplier: number;
  };
  config: { basePrice: number; maxMultiplier: number; maxPrice: number; maxChangePercent: number };
}

export interface SmartSuggestion {
  type: "timing" | "budget" | "opportunity" | "savings";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionLabel?: string;
}

// ─── Config loader ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: PricingConfig = {
  basePrice: 0.01,
  maxMultiplier: 2.5,
  minPrice: 0.004,
  maxPrice: 0.025,
  maxChangePercent: 25,
  demandSensitivity: 1.0,
  demandThresholds: { low: 3, normal: 8, high: 15, very_high: 25 },
};

export async function getPricingConfig(): Promise<PricingConfig> {
  try {
    const result = await db.execute(sql`
      SELECT value FROM platform_config WHERE key = 'pricing_config' LIMIT 1
    `);
    if (result.rows[0]) {
      const stored = (result.rows[0] as any).value as Partial<PricingConfig>;
      return { ...DEFAULT_CONFIG, ...stored };
    }
  } catch {
    /* table may not exist yet — fall back to defaults */
  }
  return DEFAULT_CONFIG;
}

export async function savePricingConfig(patch: Partial<PricingConfig>): Promise<PricingConfig> {
  const current = await getPricingConfig();
  const merged = { ...current, ...patch };
  await db.execute(sql`
    INSERT INTO platform_config (key, value, updated_at)
    VALUES ('pricing_config', ${JSON.stringify(merged)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(merged)}::jsonb, updated_at = NOW()
  `);
  return merged;
}

// ─── Time multiplier (business-type-aware) ────────────────────────────────────

interface TimeInfo { mult: number; label: string; bestWindow: string }

function getTimeMultiplier(bizType: string, hour: number): TimeInfo {
  if (bizType === "cafe") {
    if (hour >= 6  && hour < 10) return { mult: 0.80, label: "Frühstückszeit — günstig für Cafés",      bestWindow: "06:00–10:00 Uhr" };
    if (hour >= 10 && hour < 14) return { mult: 1.00, label: "Mittagszeit — normale Preise",            bestWindow: "06:00–10:00 Uhr" };
    if (hour >= 14 && hour < 18) return { mult: 0.90, label: "Nachmittagszeit — leicht günstiger",      bestWindow: "06:00–10:00 Uhr" };
    if (hour >= 18 && hour < 22) return { mult: 1.15, label: "Abendzeit — erhöhte Nachfrage",           bestWindow: "06:00–10:00 Uhr" };
    return                              { mult: 1.20, label: "Spätabend",                                bestWindow: "06:00–10:00 Uhr" };
  }
  if (bizType === "bar") {
    if (hour >= 6  && hour < 12) return { mult: 0.70, label: "Morgen — niedrige Bar-Nachfrage",         bestWindow: "20:00–24:00 Uhr" };
    if (hour >= 12 && hour < 17) return { mult: 0.85, label: "Nachmittag — moderate Preise",            bestWindow: "20:00–24:00 Uhr" };
    if (hour >= 17 && hour < 20) return { mult: 1.20, label: "Happy Hour — erhöhte Nachfrage",          bestWindow: "20:00–24:00 Uhr" };
    if (hour >= 20 && hour < 24) return { mult: 1.50, label: "Nachtleben-Peak — höchste Preise",        bestWindow: "20:00–24:00 Uhr" };
    return                              { mult: 1.35, label: "Spätnacht",                                bestWindow: "20:00–24:00 Uhr" };
  }
  // restaurant (default)
  if (hour >= 6  && hour < 9)  return { mult: 0.85, label: "Früh — ruhige Zeit",                       bestWindow: "11:00–14:00 Uhr" };
  if (hour >= 9  && hour < 11) return { mult: 0.95, label: "Vormittag",                                 bestWindow: "11:00–14:00 Uhr" };
  if (hour >= 11 && hour < 14) return { mult: 1.30, label: "Mittagspeak — hohe Nachfrage",              bestWindow: "17:00–21:00 Uhr" };
  if (hour >= 14 && hour < 17) return { mult: 1.00, label: "Nachmittag — normale Preise",               bestWindow: "17:00–21:00 Uhr" };
  if (hour >= 17 && hour < 21) return { mult: 1.35, label: "Abendpeak — höchste Restaurant-Nachfrage",  bestWindow: "17:00–21:00 Uhr" };
  if (hour >= 21)              return { mult: 1.10, label: "Spätabend",                                  bestWindow: "17:00–21:00 Uhr" };
  return                              { mult: 0.90, label: "Nacht",                                      bestWindow: "17:00–21:00 Uhr" };
}

// ─── Demand multiplier ────────────────────────────────────────────────────────

interface DemandInfo { mult: number; level: DemandLevel; signal: string }

function getDemandMultiplier(
  activeBoosts: number,
  config: PricingConfig,
): DemandInfo {
  const t = config.demandThresholds;
  const adjusted = activeBoosts * config.demandSensitivity;

  if (adjusted <= t.low)     return { mult: 0.80, level: "low",       signal: "Niedrige Nachfrage — günstiger Zeitpunkt zum Boosten" };
  if (adjusted <= t.normal)  return { mult: 1.00, level: "normal",    signal: "Normale Nachfrage" };
  if (adjusted <= t.high)    return { mult: 1.25, level: "high",      signal: "Hohe Nachfrage — Preis leicht erhöht" };
  if (adjusted <= t.very_high) return { mult: 1.45, level: "very_high", signal: "Sehr hohe Nachfrage — Premium-Preis aktiv" };
  return                            { mult: 1.60, level: "very_high", signal: "Peak-Nachfrage — maximale Plattformaktivität" };
}

// ─── Slot / competition multiplier ───────────────────────────────────────────

interface SlotInfo { mult: number; position: number; competition: string }

function getSlotMultiplier(sameTypeBoosts: number): SlotInfo {
  if (sameTypeBoosts === 0) return { mult: 0.90, position: 1,                   competition: "Keine Konkurrenz aktiv — günstigste Slots verfügbar" };
  if (sameTypeBoosts <= 2)  return { mult: 1.00, position: sameTypeBoosts + 1,  competition: `${sameTypeBoosts} Mitbewerber aktiv` };
  if (sameTypeBoosts <= 5)  return { mult: 1.10, position: sameTypeBoosts + 1,  competition: `${sameTypeBoosts} Mitbewerber — mittlerer Wettbewerb` };
  return                           { mult: 1.20, position: sameTypeBoosts + 1,  competition: `${sameTypeBoosts} Mitbewerber — hoher Wettbewerb` };
}

// ─── Location multiplier (Vienna district-based) ────────────────────────────

interface LocationInfo { mult: number; tier: LocationTier; signal: string }

export function getLocationMultiplier(district?: number): LocationInfo {
  const zentrum = [1];
  const inner = [2, 3, 4, 5, 6, 7, 8, 9];

  if (!district || district <= 0) {
    return { mult: 1.15, tier: "innenbezirk", signal: "Innenbezirk — durchschnittliche Nachfrage" };
  }

  if (zentrum.includes(district)) {
    return { mult: 1.25, tier: "zentrum", signal: "1. Bezirk — höchste Lauffrequenz, Premium-Lage" };
  }
  if (inner.includes(district)) {
    return { mult: 1.15, tier: "innenbezirk", signal: `${district}. Bezirk — gute Lage, hohe Nachfrage` };
  }
  return { mult: 0.90, tier: "aussenbezirk", signal: `${district}. Bezirk — weniger Konkurrenz, günstigerer Preis` };
}

// ─── Slot-based pricing tiers ────────────────────────────────────────────────

function computeSlotTiers(basePricePer1000: number): SlotTier[] {
  return [
    {
      tier: "top1",
      label: "Top #1 — Maximale Sichtbarkeit",
      multiplier: 1.30,
      pricePer1000: Math.round(basePricePer1000 * 1.30 * 100) / 100,
    },
    {
      tier: "top3",
      label: "Top #2–3 — Premium-Platzierung",
      multiplier: 1.15,
      pricePer1000: Math.round(basePricePer1000 * 1.15 * 100) / 100,
    },
    {
      tier: "standard",
      label: "Standard — Regulärer Boost",
      multiplier: 1.00,
      pricePer1000: Math.round(basePricePer1000 * 100) / 100,
    },
  ];
}

// ─── Safe price limiting (scoped per business type) ─────────────────────────

const lastPriceByBiz: Record<string, number> = {};

function applySafeLimits(rawPrice: number, config: PricingConfig, bizType: string): number {
  let price = Math.max(config.minPrice, Math.min(config.maxPrice, rawPrice));

  const lastPrice = lastPriceByBiz[bizType];
  if (lastPrice !== undefined && config.maxChangePercent > 0) {
    const maxDelta = lastPrice * (config.maxChangePercent / 100);
    const upper = lastPrice + maxDelta;
    const lower = lastPrice - maxDelta;
    price = Math.max(lower, Math.min(upper, price));
  }

  price = Math.round(price * 10000) / 10000;
  lastPriceByBiz[bizType] = price;
  return price;
}

// ─── Main computation ─────────────────────────────────────────────────────────

export async function computeDynamicPrice(bizType: string, district?: number): Promise<PricingResult> {
  const config = await getPricingConfig();
  const hour      = new Date().getHours();
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

  const [totalResult, sameTypeResult] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS count FROM promotions
      WHERE status = 'active' AND (ends_at IS NULL OR ends_at > NOW())
    `),
    db.execute(sql`
      SELECT COUNT(*) AS count
      FROM promotions p
      INNER JOIN restaurants r ON r.id = p.restaurant_id
      WHERE p.status = 'active'
        AND (p.ends_at IS NULL OR p.ends_at > NOW())
        AND r.business_type = ${bizType}
    `),
  ]);

  const totalActivePlatformBoosts = parseInt((totalResult.rows[0] as any)?.count ?? "0");
  const competingBoosts           = parseInt((sameTypeResult.rows[0] as any)?.count ?? "0");

  const timeInfo     = getTimeMultiplier(bizType, hour);
  const demandInfo   = getDemandMultiplier(totalActivePlatformBoosts, config);
  const slotInfo     = getSlotMultiplier(competingBoosts);
  const locationInfo = getLocationMultiplier(district);

  const weekendBonus = (bizType === "bar" && isWeekend) ? 1.10 : 1.0;

  const rawMultiplier   = demandInfo.mult * timeInfo.mult * slotInfo.mult * locationInfo.mult * weekendBonus;
  const totalMultiplier = Math.min(rawMultiplier, config.maxMultiplier);
  const rawPrice        = config.basePrice * totalMultiplier;
  const finalPrice      = applySafeLimits(rawPrice, config, bizType);

  const pricePer1000 = Math.round(finalPrice * 1000 * 100) / 100;
  const slotTiers = computeSlotTiers(pricePer1000);

  let pricingContext: string;
  if (demandInfo.level === "very_high")
    pricingContext = `Sehr hohe Nachfrage — Preis erhöht (${totalMultiplier.toFixed(2)}× Basis)`;
  else if (demandInfo.level === "high")
    pricingContext = `Hohe Nachfrage — Preis leicht erhöht (${totalMultiplier.toFixed(2)}× Basis)`;
  else if (demandInfo.level === "low")
    pricingContext = `Niedrige Nachfrage — günstigster Preis (${totalMultiplier.toFixed(2)}× Basis)`;
  else
    pricingContext = `Normale Nachfrage — Standardpreis (${totalMultiplier.toFixed(2)}× Basis)`;

  let suggestion: string;
  if (demandInfo.level === "low") {
    suggestion = "Jetzt boosten — niedrige Nachfrage bedeutet günstige Preise und wenig Konkurrenz";
  } else if (demandInfo.level === "very_high" && timeInfo.mult > 1.2) {
    suggestion = `Hohe Kosten gerade — für günstigere Preise bis ${timeInfo.bestWindow} warten`;
  } else if (timeInfo.mult < 0.9) {
    suggestion = `Günstige Zeit — warten bis ${timeInfo.bestWindow} für Peak-Sichtbarkeit`;
  } else if (slotInfo.position === 1) {
    suggestion = "Keine Konkurrenz aktiv — idealer Zeitpunkt für maximale Sichtbarkeit";
  } else {
    suggestion = "Guter Zeitpunkt zum Boosten — solide Nachfrage, faire Preise";
  }

  return {
    pricePerImpression: finalPrice,
    pricePer1000,
    demandLevel: demandInfo.level,
    totalActivePlatformBoosts,
    competingBoosts,
    slotPosition: slotInfo.position,
    locationTier: locationInfo.tier,
    demandSignal: demandInfo.signal,
    timeSignal: timeInfo.label,
    competitionSignal: slotInfo.competition,
    locationSignal: locationInfo.signal,
    pricingContext,
    suggestion,
    bestBoostWindow: timeInfo.bestWindow,
    slotTiers,
    breakdown: {
      basePrice: config.basePrice,
      demandMultiplier: demandInfo.mult,
      timeMultiplier: timeInfo.mult,
      slotMultiplier: slotInfo.mult,
      locationMultiplier: locationInfo.mult,
      weekendBonus,
      finalPrice,
      totalMultiplier,
    },
    config: {
      basePrice: config.basePrice,
      maxMultiplier: config.maxMultiplier,
      maxPrice: config.maxPrice,
      maxChangePercent: config.maxChangePercent,
    },
  };
}

// ─── AI Smart Suggestions ────────────────────────────────────────────────────

export async function generateSmartSuggestions(bizType: string, district?: number): Promise<SmartSuggestion[]> {
  const suggestions: SmartSuggestion[] = [];
  const config = await getPricingConfig();
  const hour = new Date().getHours();
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

  const [totalResult, perfResult, scheduleData] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS count FROM promotions
      WHERE status = 'active' AND (ends_at IS NULL OR ends_at > NOW())
    `),
    db.execute(sql`
      SELECT type, SUM(impressions) AS imp, SUM(clicks) AS clk, SUM(bookings_attributed) AS bk
      FROM promotions
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY type
      ORDER BY SUM(clicks)::float / GREATEST(SUM(impressions), 1) DESC
    `),
    generateScheduleData(bizType, config),
  ]);

  const activeBoosts = parseInt((totalResult.rows[0] as any)?.count ?? "0");
  const perfRows = perfResult.rows as any[];

  const cheapestHour = scheduleData.reduce((best, cur) =>
    cur.pricePer1000 < best.pricePer1000 ? cur : best
  );

  if (cheapestHour.hour !== hour) {
    const formattedHour = `${String(cheapestHour.hour).padStart(2, "0")}:00`;
    suggestions.push({
      type: "timing",
      priority: cheapestHour.pricePer1000 < scheduleData[hour]?.pricePer1000 * 0.7 ? "high" : "medium",
      title: `Günstigster Zeitpunkt: ${formattedHour} Uhr`,
      description: `Um ${formattedHour} Uhr kostet ein Boost nur €${cheapestHour.pricePer1000.toFixed(2)}/1.000 Einblendungen — ${Math.round((1 - cheapestHour.pricePer1000 / Math.max(scheduleData[hour]?.pricePer1000 ?? 1, 0.01)) * 100)}% günstiger als jetzt.`,
      actionLabel: "Boost planen",
    });
  }

  if (activeBoosts <= (config.demandThresholds.low ?? 3)) {
    suggestions.push({
      type: "opportunity",
      priority: "high",
      title: "Wenig Konkurrenz — jetzt zuschlagen",
      description: `Nur ${activeBoosts} Boosts auf der Plattform aktiv. Jetzt boosten für maximale Sichtbarkeit zum niedrigsten Preis.`,
      actionLabel: "Jetzt boosten",
    });
  }

  if (perfRows.length > 0) {
    const bestType = perfRows[0];
    const ctr = Number(bestType.imp) > 0 ? (Number(bestType.clk) / Number(bestType.imp) * 100) : 0;
    if (ctr > 0) {
      const typeLabels: Record<string, string> = {
        breakfast_boost: "Frühstücks-Boost",
        lunch_boost: "Mittags-Boost",
        happy_hour_boost: "Happy Hour Boost",
        nightlife_boost: "Nachtleben-Boost",
        local_spotlight: "Local Spotlight",
        local_heat_boost: "Heat-Map Boost",
      };
      suggestions.push({
        type: "budget",
        priority: "medium",
        title: `${typeLabels[bestType.type] ?? bestType.type} hat die beste Performance`,
        description: `${ctr.toFixed(1)}% CTR mit ${Number(bestType.bk)} Buchungen in den letzten 30 Tagen. Mehr Budget hier bringt den besten ROI.`,
        actionLabel: "Budget erhöhen",
      });
    }
  }

  if (isWeekend && bizType === "bar") {
    suggestions.push({
      type: "opportunity",
      priority: "high",
      title: "Wochenend-Peak für Bars",
      description: "Freitag bis Sonntag sind die stärksten Tage für Bars. Ein Nachtleben-Boost jetzt bringt maximale Reichweite.",
      actionLabel: "Nachtleben-Boost starten",
    });
  } else if (isWeekend && bizType === "restaurant") {
    suggestions.push({
      type: "opportunity",
      priority: "medium",
      title: "Wochenend-Brunch Gelegenheit",
      description: "Am Wochenende suchen mehr Gäste nach Brunch und Mittagessen. Ein Frühstücks- oder Mittags-Boost lohnt sich besonders.",
    });
  }

  const timeInfo = getTimeMultiplier(bizType, hour);
  if (timeInfo.mult < 0.85) {
    suggestions.push({
      type: "savings",
      priority: "low",
      title: "Niedrige Preise gerade — Schnäppchen-Boost",
      description: `Aktuell sind die Preise ${Math.round((1 - timeInfo.mult) * 100)}% unter dem Durchschnitt. Gut für Langzeit-Boosts wie Local Spotlight.`,
    });
  }

  if (hour >= 17 && hour < 21 && bizType === "restaurant") {
    suggestions.push({
      type: "timing",
      priority: "high",
      title: "Jetzt boosten — Abend-Peak aktiv",
      description: "Die meisten Gäste suchen jetzt nach Restaurants. Hohe Aktivität in deiner Umgebung.",
      actionLabel: "Jetzt boosten",
    });
  }

  return suggestions.sort((a, b) => {
    const prio = { high: 0, medium: 1, low: 2 };
    return prio[a.priority] - prio[b.priority];
  });
}

// ─── Schedule data helper ────────────────────────────────────────────────────

interface SchedulePoint {
  hour: number;
  pricePerImpression: number;
  pricePer1000: number;
  level: string;
}

async function generateScheduleData(bizType: string, config: PricingConfig): Promise<SchedulePoint[]> {
  const totalResult = await db.execute(sql`
    SELECT COUNT(*) AS count FROM promotions
    WHERE status = 'active' AND (ends_at IS NULL OR ends_at > NOW())
  `);
  const activePlatformBoosts = parseInt((totalResult.rows[0] as any)?.count ?? "0");
  const dMult = getDemandMultiplier(activePlatformBoosts, config).mult;

  return Array.from({ length: 24 }, (_, h) => {
    const tMult = getTimeMultiplier(bizType, h).mult;
    const rawMult = dMult * tMult;
    const totalMult = Math.min(rawMult, config.maxMultiplier);
    const price = Math.max(config.minPrice, Math.round(config.basePrice * totalMult * 10000) / 10000);
    const level =
      totalMult >= 1.35 ? "very_high" :
      totalMult >= 1.10 ? "high" :
      totalMult < 0.90  ? "low" : "normal";
    return { hour: h, pricePerImpression: price, pricePer1000: Math.round(price * 1000 * 100) / 100, level };
  });
}

export { generateScheduleData };
