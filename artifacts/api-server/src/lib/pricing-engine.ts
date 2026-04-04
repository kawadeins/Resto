/**
 * Dynamic Pricing Engine
 *
 * Computes real-time boost impression prices based on:
 *  - Demand  (platform-wide active boosts)
 *  - Time    (business-type-aware peak windows)
 *  - Slot    (same-category competition density)
 *  - Weekend bonus (bars on Fri/Sat)
 *
 * Pricing is fully transparent — all multipliers are returned to the client
 * so owners always understand why a price is what it is.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DemandLevel = "low" | "normal" | "high" | "very_high";

export interface PricingConfig {
  basePrice: number;
  maxMultiplier: number;
  minPrice: number;
  demandSensitivity: number;
  demandThresholds: { low: number; normal: number; high: number; very_high: number };
}

export interface PricingResult {
  pricePerImpression: number;
  pricePer1000: number;
  demandLevel: DemandLevel;
  totalActivePlatformBoosts: number;
  competingBoosts: number;
  slotPosition: number;
  demandSignal: string;
  timeSignal: string;
  competitionSignal: string;
  pricingContext: string;
  suggestion: string;
  bestBoostWindow: string;
  breakdown: {
    basePrice: number;
    demandMultiplier: number;
    timeMultiplier: number;
    slotMultiplier: number;
    weekendBonus: number;
    finalPrice: number;
    totalMultiplier: number;
  };
  config: { basePrice: number; maxMultiplier: number };
}

// ─── Config loader ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: PricingConfig = {
  basePrice: 0.01,
  maxMultiplier: 2.5,
  minPrice: 0.004,
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

// ─── Main computation ─────────────────────────────────────────────────────────

export async function computeDynamicPrice(bizType: string): Promise<PricingResult> {
  const config = await getPricingConfig();
  const hour      = new Date().getHours();
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6; // Fri/Sat/Sun

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

  const timeInfo   = getTimeMultiplier(bizType, hour);
  const demandInfo = getDemandMultiplier(totalActivePlatformBoosts, config);
  const slotInfo   = getSlotMultiplier(competingBoosts);

  const weekendBonus = (bizType === "bar" && isWeekend) ? 1.10 : 1.0;

  const rawMultiplier   = demandInfo.mult * timeInfo.mult * slotInfo.mult * weekendBonus;
  const totalMultiplier = Math.min(rawMultiplier, config.maxMultiplier);
  const rawPrice        = config.basePrice * totalMultiplier;
  const finalPrice      = Math.max(config.minPrice, Math.round(rawPrice * 10000) / 10000);

  // Human-readable pricing context
  let pricingContext: string;
  if (demandInfo.level === "very_high")
    pricingContext = `Sehr hohe Nachfrage — Preis erhöht (${totalMultiplier.toFixed(2)}× Basis)`;
  else if (demandInfo.level === "high")
    pricingContext = `Hohe Nachfrage — Preis leicht erhöht (${totalMultiplier.toFixed(2)}× Basis)`;
  else if (demandInfo.level === "low")
    pricingContext = `Niedrige Nachfrage — günstigster Preis (${totalMultiplier.toFixed(2)}× Basis)`;
  else
    pricingContext = `Normale Nachfrage — Standardpreis (${totalMultiplier.toFixed(2)}× Basis)`;

  // Actionable suggestion
  let suggestion: string;
  if (demandInfo.level === "low") {
    suggestion = "Jetzt boosten — niedrige Nachfrage bedeutet günstige Preise und wenig Konkurrenz";
  } else if (demandInfo.level === "very_high" && timeInfo.mult > 1.2) {
    suggestion = `Hohe Kosten gerade — für günstigere Preise bis ${timeInfo.bestWindow} warten`;
  } else if (timeInfo.mult < 0.9) {
    suggestion = `Günstige Zeit — warten bis ${timeInfo.bestWindow} für Peak-Sichtbarkeit`;
  } else if (slotInfo.competition.includes("keine") || slotInfo.competition.includes("keine")) {
    suggestion = "Keine Konkurrenz aktiv — idealer Zeitpunkt für maximale Sichtbarkeit";
  } else {
    suggestion = "Guter Zeitpunkt zum Boosten — solide Nachfrage, faire Preise";
  }

  return {
    pricePerImpression: finalPrice,
    pricePer1000: Math.round(finalPrice * 1000 * 100) / 100,
    demandLevel: demandInfo.level,
    totalActivePlatformBoosts,
    competingBoosts,
    slotPosition: slotInfo.position,
    demandSignal: demandInfo.signal,
    timeSignal: timeInfo.label,
    competitionSignal: slotInfo.competition,
    pricingContext,
    suggestion,
    bestBoostWindow: timeInfo.bestWindow,
    breakdown: {
      basePrice: config.basePrice,
      demandMultiplier: demandInfo.mult,
      timeMultiplier: timeInfo.mult,
      slotMultiplier: slotInfo.mult,
      weekendBonus,
      finalPrice,
      totalMultiplier,
    },
    config: { basePrice: config.basePrice, maxMultiplier: config.maxMultiplier },
  };
}
