/**
 * Competition Engine API
 *
 * GET  /api/competition/signals?restaurantId=:id&businessType=:type
 *   — returns real-time competition signals for the dashboard widget
 *
 * GET  /api/competition/insights  (founder auth)
 *   — returns platform-wide competition analytics
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const FOUNDER_KEY = "rs_founder_2026";

function isFounder(req: any) {
  return req.headers["x-founder-key"] === FOUNDER_KEY;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type DemandLevel = "high" | "medium" | "low";
type CompLevel   = "high" | "medium" | "low";
type VisTier     = "top1" | "top3" | "boosted" | "standard";

function getDemandSignal(bizType: string, hour: number, isWeekend: boolean): {
  level: DemandLevel;
  label: string;
  sub: string;
  isActive: boolean;
} {
  if (bizType === "cafe") {
    if (hour >= 6 && hour < 11)
      return { level: "high",   label: "Frühstücks-Peak aktiv",          sub: "Kaffeenachfrage in Wien ist jetzt maximal",            isActive: true  };
    if (hour >= 11 && hour < 14)
      return { level: "medium", label: "Mittagspause in Wien",            sub: "Gute Sichtbarkeitschance für Cafés",                   isActive: true  };
    return   { level: "low",    label: "Café-Nachfrage in Wien",          sub: "Täglich über 100 Suchanfragen nach Cafés",             isActive: false };
  }
  if (bizType === "bar") {
    if ((hour >= 19 || hour <= 2) && (isWeekend || hour >= 20))
      return { level: "high",   label: "Nachtleben-Peak — Wien ist aktiv", sub: "Nutzer suchen gerade aktiv nach Bars in Wien",        isActive: true  };
    if (hour >= 17 && hour < 20)
      return { level: "medium", label: "Happy Hour — gute Sichtbarkeitschance", sub: "Happy-Hour-Suchen sind gerade hoch",             isActive: true  };
    return   { level: "low",    label: "Bar-Aktivität in Wien",            sub: "Täglich über 80 Suchanfragen nach Bars",             isActive: false };
  }
  // restaurant (default)
  if (hour >= 11 && hour < 14)
    return { level: "high",   label: "Mittags-Peak — starke Nachfrage",   sub: "Nutzer suchen aktiv nach Restaurants in Wien",       isActive: true  };
  if (hour >= 17 && hour < 21)
    return { level: "high",   label: "Abend-Peak — maximale Sichtbarkeit", sub: "Abendreservierungen sind jetzt besonders gefragt",  isActive: true  };
  if (hour >= 9 && hour < 11)
    return { level: "medium", label: "Gute Zeit für Sichtbarkeit",         sub: "Nutzer planen ihr Mittag — sei früh sichtbar",       isActive: true  };
  return   { level: "low",    label: "Restaurant-Nachfrage in Wien",       sub: "Täglich über 200 Reservierungsanfragen in Wien",     isActive: false };
}

function getCompetitionMessage(bizType: string, activeBoosters: number, level: CompLevel): {
  headline: string;
  sub: string;
} {
  const typeLabel = bizType === "cafe" ? "Cafés" : bizType === "bar" ? "Bars" : "Restaurants";
  if (level === "high") {
    return {
      headline: `Hohe Konkurrenz unter ${typeLabel} in Wien`,
      sub: `${activeBoosters} Betriebe erhöhen gerade ihre Sichtbarkeit`,
    };
  }
  if (level === "medium") {
    return {
      headline: `Moderate Aktivität in deiner Umgebung`,
      sub: `${activeBoosters} Betriebe sind gerade mit Boost aktiv`,
    };
  }
  return {
    headline: `Gute Chance — wenig Wettbewerb gerade`,
    sub: activeBoosters > 0
      ? `Nur ${activeBoosters} Mitbewerber boosten aktuell`
      : "Kaum Mitbewerber aktiv — jetzt ist deine Chance",
  };
}

function getVisibilityTier(hasPremium: boolean, hasActiveBoost: boolean, rating: number): {
  tier: VisTier;
  label: string;
  score: number;
  desc: string;
} {
  if (hasActiveBoost && hasPremium && rating >= 4.5) {
    return { tier: "top3",     label: "Top 3 Sichtbarkeit",      score: 82, desc: "Du erscheinst sehr prominent in den Suchergebnissen" };
  }
  if (hasActiveBoost) {
    return { tier: "boosted",  label: "Boost aktiv",             score: 65, desc: "Dein Betrieb wird bevorzugt in der Nähesuche angezeigt" };
  }
  if (hasPremium) {
    return { tier: "standard", label: "Premium — kein Boost",    score: 42, desc: "Premium-Status aktiv, aber kein Boost — Potenzial ungenutzt" };
  }
  return   { tier: "standard", label: "Standard-Sichtbarkeit",   score: 22, desc: "Basis-Listing ohne Boost — du wirst seltener angezeigt" };
}

// ─── GET /api/competition/signals ─────────────────────────────────────────────

router.get("/signals", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId) || 1;
    const bizType      = (req.query.businessType as string) || "restaurant";

    const now       = new Date();
    const hour      = now.getHours();
    const day       = now.getDay();
    const isWeekend = day === 0 || day === 5 || day === 6;

    // ── Fetch real data in parallel ───────────────────────────────────────────
    const [promoStats, restaurantRow, platformStats] = await Promise.all([

      // Active promotions in the platform (competition signals)
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')                          AS total_active,
          COUNT(*) FILTER (WHERE status = 'active'
            AND restaurant_id != ${restaurantId})                             AS competitor_active,
          COUNT(*) FILTER (WHERE status = 'active'
            AND restaurant_id = ${restaurantId})                              AS own_active,
          COALESCE(SUM(impressions) FILTER (WHERE status = 'active'), 0)     AS total_impressions,
          COALESCE(SUM(daily_budget) FILTER (WHERE status = 'active'), 0)    AS total_daily_budget
        FROM promotions
      `),

      // Restaurant's own data
      db.execute(sql`
        SELECT id, name, rating, business_type
        FROM restaurants
        WHERE id = ${restaurantId}
        LIMIT 1
      `),

      // Platform overview (total venues, premium counts)
      db.execute(sql`
        SELECT
          COUNT(*) AS total_venues,
          COUNT(*) FILTER (WHERE rating >= 4.5) AS high_rated,
          COUNT(*) FILTER (WHERE business_type = ${bizType}) AS same_type_count,
          ROUND(AVG(rating)::numeric, 1) AS avg_rating
        FROM restaurants
      `),
    ]);

    const promo    = promoStats.rows[0] as any;
    const rest     = restaurantRow.rows[0] as any;
    const platform = platformStats.rows[0] as any;

    const activeBoosters   = parseInt(promo.competitor_active ?? "0");
    const hasOwnBoost      = parseInt(promo.own_active ?? "0") > 0;
    const totalVenues      = parseInt(platform.total_venues ?? "30");
    const sameTypeCount    = parseInt(platform.same_type_count ?? "10");
    const rating           = parseFloat(rest?.rating ?? "4.5");

    // Derive premium status from localStorage read is client-side, so we check
    // via query param; default to false if not provided
    const hasPremium = req.query.hasPremium === "true";

    // ── Compute signals ───────────────────────────────────────────────────────

    // Competition level (based on active boosters vs market size)
    const boostRatio  = activeBoosters / Math.max(sameTypeCount, 1);
    const compLevel: CompLevel =
      activeBoosters >= 5 || boostRatio >= 0.4 ? "high"
      : activeBoosters >= 2 || boostRatio >= 0.15 ? "medium"
      : "low";

    // Demand signal
    const demand = getDemandSignal(bizType, hour, isWeekend);

    // Visibility tier
    const visibility = getVisibilityTier(hasPremium, hasOwnBoost, rating);

    // Competition message
    const compMessage = getCompetitionMessage(bizType, activeBoosters, compLevel);

    // Slot availability (top 3 slots in the platform; boosted slots limited to 8)
    const TOP_SLOTS     = 3;
    const BOOSTED_SLOTS = 8;
    const topSlotsUsed     = Math.min(parseInt(promo.total_active ?? "0"), TOP_SLOTS);
    const boostedSlotsUsed = parseInt(promo.total_active ?? "0");
    const topSlotsLeft     = Math.max(0, TOP_SLOTS - topSlotsUsed);
    const boostedSlotsLeft = Math.max(0, BOOSTED_SLOTS - boostedSlotsUsed);

    // Recommended action
    let recommendedAction: "boost" | "upgrade" | "maintain" | "none" = "none";
    let recommendedMessage = "";
    let recommendedUrgency: "high" | "medium" | "low" = "low";

    if (!hasPremium) {
      recommendedAction = "upgrade";
      recommendedMessage = "Premium aktivieren — mehr Sichtbarkeit sofort";
      recommendedUrgency = demand.level === "high" ? "high" : "medium";
    } else if (!hasOwnBoost && demand.level === "high") {
      recommendedAction = "boost";
      recommendedMessage = `${demand.label} — jetzt Boost aktivieren`;
      recommendedUrgency = "high";
    } else if (!hasOwnBoost) {
      recommendedAction = "boost";
      recommendedMessage = "Sichtbarkeit mit Boost erhöhen";
      recommendedUrgency = compLevel === "high" ? "high" : "low";
    } else {
      recommendedAction = "maintain";
      recommendedMessage = "Boost aktiv — du bist gut sichtbar";
      recommendedUrgency = "low";
    }

    // Business-type peak label
    const peakLabels: Record<string, string[]> = {
      restaurant: ["Mittag (11–14 Uhr)", "Abend (17–21 Uhr)"],
      cafe:       ["Morgen (6–11 Uhr)", "Mittagspause (11–14 Uhr)"],
      bar:        ["Happy Hour (17–20 Uhr)", "Nachtleben (20–2 Uhr)"],
    };

    return res.json({
      visibility: {
        tier:        visibility.tier,
        label:       visibility.label,
        score:       visibility.score,
        desc:        visibility.desc,
        hasOwnBoost,
        hasPremium,
      },
      competition: {
        level:           compLevel,
        activeBoosters,
        headline:        compMessage.headline,
        sub:             compMessage.sub,
        totalVenuesInCity: totalVenues,
        sameTypeCount,
        boostRatio:      Math.round(boostRatio * 100),
      },
      demand: {
        level:    demand.level,
        label:    demand.label,
        sub:      demand.sub,
        isActive: demand.isActive,
        peakTimes: peakLabels[bizType] ?? peakLabels.restaurant,
      },
      slots: {
        top3Available:     topSlotsLeft,
        top3Total:         TOP_SLOTS,
        boostedAvailable:  boostedSlotsLeft,
        boostedTotal:      BOOSTED_SLOTS,
      },
      recommendation: {
        action:  recommendedAction,
        message: recommendedMessage,
        urgency: recommendedUrgency,
      },
      meta: {
        hour,
        isWeekend,
        bizType,
        restaurantName: rest?.name ?? "Dein Betrieb",
        platformRating: parseFloat(platform.avg_rating ?? "4.6"),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get competition signals");
    return res.status(500).json({ error: "Failed" });
  }
});

// ─── GET /api/competition/insights — founder analytics ───────────────────────

router.get("/insights", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const [promoData, boostTrend, revenueData] = await Promise.all([

      // Current boost activity
      db.execute(sql`
        SELECT
          p.id,
          r.name,
          r.business_type,
          r.rating,
          p.status,
          p.type,
          p.impressions,
          p.clicks,
          p.daily_budget,
          p.spent_today,
          p.started_at
        FROM promotions p
        JOIN restaurants r ON r.id = p.restaurant_id
        ORDER BY p.created_at DESC
        LIMIT 20
      `),

      // Promotion activity over time
      db.execute(sql`
        SELECT
          DATE_TRUNC('day', created_at) AS day,
          COUNT(*) AS total_boosts,
          COUNT(*) FILTER (WHERE status = 'active') AS active_boosts,
          COALESCE(SUM(daily_budget), 0) AS total_budget
        FROM promotions
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 14
      `),

      // Revenue by business type
      db.execute(sql`
        SELECT
          r.business_type,
          COUNT(p.id) AS total_promotions,
          COUNT(p.id) FILTER (WHERE p.status = 'active') AS active_promotions,
          COALESCE(SUM(p.daily_budget), 0) AS total_daily_budget,
          COALESCE(SUM(p.impressions), 0) AS total_impressions,
          COALESCE(SUM(p.clicks), 0) AS total_clicks,
          ROUND(AVG(r.rating)::numeric, 1) AS avg_rating
        FROM restaurants r
        LEFT JOIN promotions p ON p.restaurant_id = r.id
        GROUP BY r.business_type
        ORDER BY total_daily_budget DESC
      `),
    ]);

    const allActive   = (promoData.rows as any[]).filter((r: any) => r.status === "active");
    const totalActive = allActive.length;
    const totalBudget = allActive.reduce((s: number, r: any) => s + parseFloat(r.daily_budget ?? "0"), 0);
    const totalImpressions = (promoData.rows as any[]).reduce((s: number, r: any) => s + parseInt(r.impressions ?? "0"), 0);

    return res.json({
      summary: {
        totalActive,
        totalBudgetPerDay: parseFloat(totalBudget.toFixed(2)),
        totalImpressions,
        competitionIntensity: totalActive >= 5 ? "hoch" : totalActive >= 2 ? "mittel" : "niedrig",
      },
      activeBoosts:  promoData.rows,
      boostTrend:    boostTrend.rows,
      byBusinessType: revenueData.rows,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get competition insights");
    return res.status(500).json({ error: "Failed" });
  }
});

export default router;
