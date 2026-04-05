/**
 * City Expansion Engine API
 *
 * GET /api/cities            — all cities with health scores (no auth)
 * GET /api/cities/signals    — city signals for owner widget (no auth, ?city=Wien)
 * GET /api/cities/dashboard  — founder city analytics (founder auth)
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const FOUNDER_KEY = "rs_founder_2026";

function isFounder(req: any) {
  return req.headers["x-founder-key"] === FOUNDER_KEY;
}

// ─── City health score ────────────────────────────────────────────────────────

type CityStage = "Früh" | "Wachstum" | "Stark" | "Dominant";

interface CityHealth {
  city: string;
  stage: CityStage;
  score: number;
  stageColor: string;
  stageEN: string;
}

function computeHealthScore(
  bizCount: number,
  premiumCount: number,
  activeBoosts: number,
  avgRating: number,
  bookingCount: number
): number {
  const base        = Math.min(bizCount * 2.5, 35);
  const premiumBonus = Math.min(premiumCount * 6, 25);
  const boostBonus  = Math.min(activeBoosts * 4, 12);
  const ratingBonus = Math.min((avgRating - 3.5) * 8, 12);
  const bookingBonus = Math.min(bookingCount * 0.3, 16);
  return Math.min(100, Math.round(base + premiumBonus + boostBonus + ratingBonus + bookingBonus));
}

function classifyStage(bizCount: number, score: number): CityStage {
  if (bizCount >= 20 || score >= 70) return "Dominant";
  if (bizCount >= 10 || score >= 45) return "Stark";
  if (bizCount >= 4  || score >= 25) return "Wachstum";
  return "Früh";
}

const STAGE_COLORS: Record<CityStage, string> = {
  Dominant: "emerald",
  Stark:    "blue",
  Wachstum: "amber",
  Früh:     "rose",
};

const STAGE_EN: Record<CityStage, string> = {
  Dominant: "Dominant",
  Stark:    "Strong",
  Wachstum: "Growing",
  Früh:     "Early Stage",
};

// ─── GET /api/cities — all cities with health scores ─────────────────────────

router.get("/", async (req, res) => {
  try {
    const [cityStats, promoStats, bookingStats] = await Promise.all([
      db.execute(sql`
        SELECT
          city,
          COUNT(*) AS biz_count,
          COUNT(*) FILTER (WHERE business_type = 'restaurant') AS restaurant_count,
          COUNT(*) FILTER (WHERE business_type = 'cafe')       AS cafe_count,
          COUNT(*) FILTER (WHERE business_type = 'bar')        AS bar_count,
          ROUND(AVG(rating)::numeric, 2)                       AS avg_rating,
          COUNT(*) FILTER (WHERE is_featured)                  AS featured_count
        FROM restaurants
        WHERE is_active = true
        GROUP BY city
        ORDER BY biz_count DESC
      `),

      db.execute(sql`
        SELECT
          r.city,
          COUNT(p.id) FILTER (WHERE p.status = 'active')              AS active_boosts,
          COUNT(p.id)                                                  AS total_boosts,
          COALESCE(SUM(p.daily_budget) FILTER (WHERE p.status = 'active'), 0) AS active_budget,
          COALESCE(SUM(p.impressions), 0)                              AS total_impressions,
          COALESCE(SUM(p.clicks), 0)                                   AS total_clicks
        FROM restaurants r
        LEFT JOIN promotions p ON p.restaurant_id = r.id
        GROUP BY r.city
      `),

      db.execute(sql`
        SELECT
          r.city,
          COUNT(bp.id) AS booking_count
        FROM restaurants r
        LEFT JOIN booking_plans bp ON bp.restaurant_id = r.id
        GROUP BY r.city
      `),
    ]);

    const promoMap   = new Map<string, any>();
    const bookingMap = new Map<string, number>();

    for (const row of promoStats.rows as any[]) {
      promoMap.set(row.city, row);
    }
    for (const row of bookingStats.rows as any[]) {
      bookingMap.set(row.city, parseInt(row.booking_count ?? "0"));
    }

    const cities = (cityStats.rows as any[]).map((row: any) => {
      const promo   = promoMap.get(row.city) ?? {};
      const bookings = bookingMap.get(row.city) ?? 0;

      const bizCount     = parseInt(row.biz_count ?? "0");
      const activeBoosts = parseInt(promo.active_boosts ?? "0");
      const avgRating    = parseFloat(row.avg_rating ?? "4.0");
      const activeBudget = parseFloat(promo.active_budget ?? "0");

      // premium simulated: Wien has partial premium penetration, others near-zero
      const premiumEst = row.city === "Wien" ? 4 : 0;

      const score = computeHealthScore(bizCount, premiumEst, activeBoosts, avgRating, bookings);
      const stage = classifyStage(bizCount, score);

      return {
        city:             row.city,
        bizCount,
        restaurantCount:  parseInt(row.restaurant_count ?? "0"),
        cafeCount:        parseInt(row.cafe_count ?? "0"),
        barCount:         parseInt(row.bar_count ?? "0"),
        avgRating,
        featuredCount:    parseInt(row.featured_count ?? "0"),
        activeBoosts,
        totalBoosts:      parseInt(promo.total_boosts ?? "0"),
        activeBudgetPerDay: parseFloat(activeBudget.toFixed(2)),
        totalImpressions: parseInt(promo.total_impressions ?? "0"),
        totalClicks:      parseInt(promo.total_clicks ?? "0"),
        bookingCount:     bookings,
        premiumEstimate:  premiumEst,
        score,
        stage,
        stageColor: STAGE_COLORS[stage],
        stageEN:    STAGE_EN[stage],
        // Expansion signals
        opportunityLevel:
          stage === "Früh" ? "high"
          : stage === "Wachstum" ? "medium"
          : "low",
        competitionLevel:
          activeBoosts >= 5 ? "high"
          : activeBoosts >= 2 ? "medium"
          : "low",
        expansionPriority:
          stage === "Dominant" ? 0
          : stage === "Stark"  ? 1
          : stage === "Wachstum" ? 2
          : 3, // Early Stage = highest priority to activate
      };
    });

    return res.json({ cities });
  } catch (err) {
    req.log.error({ err }, "Failed to get cities");
    return res.status(500).json({ error: "Failed" });
  }
});

// ─── GET /api/cities/signals?city=Wien ───────────────────────────────────────
// Owner-facing: city opportunity signals for the overview widget

router.get("/signals", async (req, res) => {
  try {
    const city = (req.query.city as string) || "Wien";

    const [cityRow, promoRow, allCities] = await Promise.all([
      db.execute(sql`
        SELECT
          city,
          COUNT(*) AS biz_count,
          COUNT(*) FILTER (WHERE business_type = 'restaurant') AS restaurant_count,
          COUNT(*) FILTER (WHERE business_type = 'cafe')       AS cafe_count,
          COUNT(*) FILTER (WHERE business_type = 'bar')        AS bar_count,
          ROUND(AVG(rating)::numeric, 2)                       AS avg_rating
        FROM restaurants
        WHERE city = ${city} AND is_active = true
        GROUP BY city
      `),

      db.execute(sql`
        SELECT
          COUNT(p.id) FILTER (WHERE p.status = 'active') AS active_boosts,
          COALESCE(SUM(p.impressions), 0)                 AS total_impressions
        FROM promotions p
        JOIN restaurants r ON r.id = p.restaurant_id
        WHERE r.city = ${city}
      `),

      db.execute(sql`SELECT COUNT(DISTINCT city) AS city_count FROM restaurants WHERE is_active = true`),
    ]);

    const row   = cityRow.rows[0] as any;
    const promo = promoRow.rows[0] as any;

    if (!row) {
      return res.json({
        city,
        stage: "Früh",
        score: 0,
        signals: {
          demandLevel: "low",
          competitionLevel: "low",
          opportunityLevel: "high",
          headline: "Noch keine Betriebe in deiner Stadt",
          sub: "Sei der erste Betrieb in deiner Stadt",
        },
      });
    }

    const bizCount     = parseInt(row.biz_count ?? "0");
    const activeBoosts = parseInt(promo.active_boosts ?? "0");
    const avgRating    = parseFloat(row.avg_rating ?? "4.0");
    const premiumEst   = city === "Wien" ? 4 : 0;
    const score        = computeHealthScore(bizCount, premiumEst, activeBoosts, avgRating, 0);
    const stage        = classifyStage(bizCount, score);
    const stageColor   = STAGE_COLORS[stage];

    const hour       = new Date().getHours();
    const isWeekend  = [0, 5, 6].includes(new Date().getDay());
    const demandHigh = (hour >= 11 && hour < 14) || (hour >= 17 && hour < 21) || (isWeekend && hour >= 10);

    const competitionLevel: "low" | "medium" | "high" =
      activeBoosts >= 5 ? "high" : activeBoosts >= 2 ? "medium" : "low";

    // City-specific messaging
    const CITY_MESSAGES: Record<string, { headline: string; sub: string; earlyAdvantage: string }> = {
      Wien:      { headline: "Du bist in Wien — der stärksten Stadt", sub: "30 Betriebe aktiv · höchste Nutzerdichte in Österreich", earlyAdvantage: "Nutze den Wettbewerbsvorteil durch Boost" },
      Graz:      { headline: "Graz wächst — ideal zum Einsteigen",     sub: "Wachsende Nutzerbasis in Graz · noch wenig Konkurrenz", earlyAdvantage: "Früh dabei = höhere Sichtbarkeit in Graz" },
      Salzburg:  { headline: "Salzburg — tourismusstarke Nachfrage",    sub: "Hohe Touristendichte · starke Gastronomienachfrage",   earlyAdvantage: "Jetzt einsteigen und Tourists gewinnen" },
      Linz:      { headline: "Linz — wachsende Digitalisierung",        sub: "Technikstadt mit steigender App-Nutzung",              earlyAdvantage: "Sei früh dabei in Linz" },
      Innsbruck: { headline: "Innsbruck — Tourismus & Studentenstadt",  sub: "Skitourismus + Uni-Bevölkerung = starke Nachfrage",    earlyAdvantage: "Hohe Sichtbarkeit in einer wachsenden Stadt" },
    };

    const msg = CITY_MESSAGES[city] ?? {
      headline: `${city} — lokale Nachfrage wächst`,
      sub: `${bizCount} Betriebe aktiv in deiner Stadt`,
      earlyAdvantage: "Nutze den Vorteil in deiner Stadt",
    };

    const isEarlyCity = stage === "Früh" || stage === "Wachstum";

    return res.json({
      city,
      stage,
      score,
      stageColor,
      stageEN: STAGE_EN[stage],
      bizCount,
      restaurantCount: parseInt(row.restaurant_count ?? "0"),
      cafeCount:       parseInt(row.cafe_count ?? "0"),
      barCount:        parseInt(row.bar_count ?? "0"),
      avgRating,
      activeBoosts,
      totalImpressions: parseInt(promo.total_impressions ?? "0"),
      totalCities:     parseInt((allCities.rows[0] as any)?.city_count ?? "5"),
      signals: {
        demandLevel:      demandHigh ? "high" : "medium",
        competitionLevel,
        opportunityLevel: isEarlyCity ? "high" : competitionLevel === "low" ? "medium" : "low",
        headline:         msg.headline,
        sub:              msg.sub,
        earlyAdvantage:   isEarlyCity ? msg.earlyAdvantage : null,
        isDemandActive:   demandHigh,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get city signals");
    return res.status(500).json({ error: "Failed" });
  }
});

// ─── GET /api/cities/dashboard — Founder city dashboard ──────────────────────

router.get("/dashboard", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const [cityStats, promoStats, bookingStats, recentClaims] = await Promise.all([
      db.execute(sql`
        SELECT
          city,
          COUNT(*) AS biz_count,
          COUNT(*) FILTER (WHERE business_type = 'restaurant') AS restaurant_count,
          COUNT(*) FILTER (WHERE business_type = 'cafe')       AS cafe_count,
          COUNT(*) FILTER (WHERE business_type = 'bar')        AS bar_count,
          ROUND(AVG(rating)::numeric, 2)                       AS avg_rating,
          COUNT(*) FILTER (WHERE is_featured)                  AS featured_count,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_last_30d
        FROM restaurants
        WHERE is_active = true
        GROUP BY city
        ORDER BY biz_count DESC
      `),

      db.execute(sql`
        SELECT
          r.city,
          COUNT(p.id) FILTER (WHERE p.status = 'active')                AS active_boosts,
          COUNT(p.id)                                                    AS total_boosts,
          COALESCE(SUM(p.daily_budget) FILTER (WHERE p.status='active'), 0) AS active_budget_day,
          COALESCE(SUM(p.daily_budget), 0)                               AS total_budget,
          COALESCE(SUM(p.impressions), 0)                                AS total_impressions,
          COALESCE(SUM(p.clicks), 0)                                     AS total_clicks,
          COALESCE(SUM(p.spent_today), 0)                               AS spent_today
        FROM restaurants r
        LEFT JOIN promotions p ON p.restaurant_id = r.id
        GROUP BY r.city
      `),

      db.execute(sql`
        SELECT r.city, COUNT(bp.id) AS booking_count
        FROM restaurants r
        LEFT JOIN booking_plans bp ON bp.restaurant_id = r.id
        GROUP BY r.city
      `),

      db.execute(sql`
        SELECT city, COUNT(*) AS claims_count
        FROM business_claims
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY city
      `),
    ]);

    const promoMap   = new Map<string, any>();
    const bookingMap = new Map<string, number>();
    const claimsMap  = new Map<string, number>();

    for (const r of promoStats.rows as any[])  promoMap.set(r.city, r);
    for (const r of bookingStats.rows as any[]) bookingMap.set(r.city, parseInt(r.booking_count ?? "0"));
    for (const r of recentClaims.rows as any[]) claimsMap.set(r.city, parseInt(r.claims_count ?? "0"));

    const cities = (cityStats.rows as any[]).map((row: any) => {
      const promo       = promoMap.get(row.city) ?? {};
      const bookings    = bookingMap.get(row.city) ?? 0;
      const claims30d   = claimsMap.get(row.city) ?? 0;

      const bizCount     = parseInt(row.biz_count ?? "0");
      const activeBoosts = parseInt(promo.active_boosts ?? "0");
      const totalBoosts  = parseInt(promo.total_boosts ?? "0");
      const avgRating    = parseFloat(row.avg_rating ?? "4.0");
      const activeBudget = parseFloat(promo.active_budget_day ?? "0");
      const premiumEst   = row.city === "Wien" ? 4 : 0;
      const new30d       = parseInt(row.new_last_30d ?? "0");

      const score  = computeHealthScore(bizCount, premiumEst, activeBoosts, avgRating, bookings);
      const stage  = classifyStage(bizCount, score);

      const premiumRate    = bizCount > 0 ? Math.round((premiumEst / bizCount) * 100) : 0;
      const boostRate      = bizCount > 0 ? Math.round((totalBoosts / bizCount) * 100) : 0;
      const conversionRate = bizCount > 0 ? Math.round(((premiumEst + totalBoosts) / bizCount) * 100) : 0;

      return {
        city:           row.city,
        bizCount,
        restaurantCount: parseInt(row.restaurant_count ?? "0"),
        cafeCount:       parseInt(row.cafe_count ?? "0"),
        barCount:        parseInt(row.bar_count ?? "0"),
        avgRating,
        featuredCount:  parseInt(row.featured_count ?? "0"),
        new30d,
        claims30d,
        activeBoosts,
        totalBoosts,
        activeBudgetPerDay: parseFloat(activeBudget.toFixed(2)),
        totalImpressions:  parseInt(promo.total_impressions ?? "0"),
        totalClicks:       parseInt(promo.total_clicks ?? "0"),
        bookingCount: bookings,
        premiumEstimate:  premiumEst,
        premiumRate,
        boostRate,
        conversionRate,
        score,
        stage,
        stageColor: STAGE_COLORS[stage],
        stageEN:    STAGE_EN[stage],
        expansionPriority: stage === "Früh" ? 3 : stage === "Wachstum" ? 2 : stage === "Stark" ? 1 : 0,
      };
    });

    // Summary insights
    const dominantCity = cities.find(c => c.stage === "Dominant");
    const highestRevenueCity = [...cities].sort((a, b) => b.activeBudgetPerDay - a.activeBudgetPerDay)[0];
    const fastestGrowingCity = [...cities].sort((a, b) => b.new30d - a.new30d)[0];
    const highestCompCity    = [...cities].sort((a, b) => b.activeBoosts - a.activeBoosts)[0];
    const nextFocusCity      = [...cities].sort((a, b) => b.expansionPriority - a.expansionPriority)[0];

    return res.json({
      cities,
      insights: {
        dominantCity:       dominantCity?.city ?? null,
        highestRevenueCity: highestRevenueCity?.city ?? null,
        fastestGrowingCity: fastestGrowingCity?.city ?? null,
        highestCompCity:    highestCompCity?.city ?? null,
        nextFocusCity:      nextFocusCity?.city ?? null,
        totalCities:        cities.length,
        totalBizAcrossAll:  cities.reduce((s, c) => s + c.bizCount, 0),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get city dashboard");
    return res.status(500).json({ error: "Failed" });
  }
});

export default router;
