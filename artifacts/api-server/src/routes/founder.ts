import { Router } from "express";
import { db } from "@workspace/db";
import { restaurantsTable, reservationsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router = Router();

const FOUNDER_KEY = process.env.FOUNDER_KEY ?? "rs_founder_2026";

function authMiddleware(req: any, res: any, next: any) {
  const key = req.headers["x-founder-key"] as string | undefined;
  if (!key || key !== FOUNDER_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.use(authMiddleware);

// ─── /api/founder/metrics ─────────────────────────────────────────────────────

router.get("/metrics", async (req, res) => {
  try {
    const [
      restaurants,
      reservations,
      promotionRows,
      promoByType,
      byCity,
      byBizType,
    ] = await Promise.all([
      db.select().from(restaurantsTable),
      db.select().from(reservationsTable),
      db.execute(sql`
        SELECT p.id, p.restaurant_id, p.type, p.status, p.budget_cents,
               p.impressions, p.clicks, p.bookings_attributed,
               p.heat_exposure, p.group_exposure, p.started_at, p.ends_at,
               r.name as restaurant_name, r.business_type, r.city
        FROM promotions p
        LEFT JOIN restaurants r ON r.id = p.restaurant_id
        ORDER BY p.created_at DESC
      `),
      db.execute(sql`
        SELECT type,
               COUNT(*)::int as count,
               SUM(budget_cents)::int as total_budget_cents,
               SUM(impressions)::int as total_impressions,
               SUM(clicks)::int as total_clicks,
               SUM(bookings_attributed)::int as total_bookings,
               SUM(heat_exposure)::int as total_heat,
               SUM(group_exposure)::int as total_group
        FROM promotions
        GROUP BY type
        ORDER BY total_bookings DESC
      `),
      db.execute(sql`
        SELECT r.city,
               COUNT(DISTINCT r.id)::int as total,
               COUNT(DISTINCT r.id) FILTER (WHERE r.is_partner) ::int as premium,
               COUNT(DISTINCT r.id) FILTER (WHERE r.is_active) ::int as active,
               ROUND(AVG(DISTINCT r.rating::numeric), 2) as avg_rating,
               COALESCE(SUM(p.bookings_attributed), 0)::int as boost_bookings,
               COALESCE(SUM(p.impressions), 0)::int as boost_impressions
        FROM restaurants r
        LEFT JOIN promotions p ON p.restaurant_id = r.id
        GROUP BY r.city
        ORDER BY premium DESC, total DESC
      `),
      db.execute(sql`
        WITH promo_agg AS (
          SELECT restaurant_id,
                 SUM(bookings_attributed) as boost_bookings,
                 SUM(budget_cents) as total_budget_cents
          FROM promotions GROUP BY restaurant_id
        )
        SELECT r.business_type,
               COUNT(r.id)::int as total,
               COUNT(r.id) FILTER (WHERE r.is_partner) ::int as premium,
               COUNT(r.id) FILTER (WHERE r.is_active) ::int as active,
               ROUND(AVG(r.rating::numeric), 2) as avg_rating,
               ROUND(AVG(r.review_count::numeric), 0)::int as avg_reviews,
               COALESCE(SUM(pa.boost_bookings), 0)::int as boost_bookings,
               COALESCE(SUM(pa.total_budget_cents), 0)::int as total_budget_cents
        FROM restaurants r
        LEFT JOIN promo_agg pa ON pa.restaurant_id = r.id
        GROUP BY r.business_type
        ORDER BY premium DESC
      `),
    ]);

    const promos = promotionRows.rows as any[];
    const activePromos = promos.filter(p => p.status === "active");
    const allPromos = promos;

    // ─── Executive KPIs ───────────────────────────────────────────────────
    const totalRestaurants = restaurants.length;
    const activeRestaurants = restaurants.filter(r => r.isActive).length;
    const premiumBusinesses = restaurants.filter(r => r.isPartner).length;
    const nonPremiumActive = restaurants.filter(r => r.isActive && !r.isPartner).length;

    // MRR estimate: €49/month per premium business
    const mrrEur = premiumBusinesses * 49;

    // New premium in last 30 days (estimate: businesses created recently and is_partner)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newPremium30d = restaurants.filter(r =>
      r.isPartner && r.createdAt && new Date(r.createdAt) >= thirtyDaysAgo
    ).length;

    // Churn/expired: is_featured but not is_partner (downgraded proxies)
    const churnRisk = restaurants.filter(r =>
      r.isFeatured && !r.isPartner && r.isActive
    ).length;

    const totalBoostBudgetCents = allPromos.reduce((s: number, p: any) => s + (p.budget_cents ?? 0), 0);
    const totalBoostImpressions = allPromos.reduce((s: number, p: any) => s + (p.impressions ?? 0), 0);
    const totalBoostClicks = allPromos.reduce((s: number, p: any) => s + (p.clicks ?? 0), 0);
    const totalBookingsInfluenced = allPromos.reduce((s: number, p: any) => s + (p.bookings_attributed ?? 0), 0);
    const totalHeatExposure = allPromos.reduce((s: number, p: any) => s + (p.heat_exposure ?? 0), 0);
    const totalGroupExposure = allPromos.reduce((s: number, p: any) => s + (p.group_exposure ?? 0), 0);

    // Platform revenue = MRR + boost revenue
    const boostRevenueEur = Math.round(totalBoostBudgetCents / 100);
    const totalRevenueEur = mrrEur + boostRevenueEur;

    // Conversion rate: bookings influenced / total impressions
    const boostConvRate = totalBoostImpressions > 0
      ? ((totalBoostClicks / totalBoostImpressions) * 100).toFixed(1)
      : "0.0";

    // Total reservations
    const totalReservations = reservations.length;
    const arrivedReservations = reservations.filter(r => r.status === "arrived").length;

    // ─── Rankings ─────────────────────────────────────────────────────────

    // Aggregate promo data per restaurant
    const promoByRestaurant = new Map<number, {
      totalBudget: number;
      totalImpressions: number;
      totalClicks: number;
      totalBookings: number;
      activeCount: number;
    }>();
    for (const p of allPromos) {
      const rid = p.restaurant_id as number;
      const existing = promoByRestaurant.get(rid) ?? {
        totalBudget: 0, totalImpressions: 0, totalClicks: 0, totalBookings: 0, activeCount: 0
      };
      promoByRestaurant.set(rid, {
        totalBudget: existing.totalBudget + (p.budget_cents ?? 0),
        totalImpressions: existing.totalImpressions + (p.impressions ?? 0),
        totalClicks: existing.totalClicks + (p.clicks ?? 0),
        totalBookings: existing.totalBookings + (p.bookings_attributed ?? 0),
        activeCount: existing.activeCount + (p.status === "active" ? 1 : 0),
      });
    }

    // Enrich restaurants
    const enriched = restaurants.map(r => ({
      id: r.id,
      name: r.name,
      city: r.city,
      businessType: r.businessType ?? "restaurant",
      rating: parseFloat(r.rating as any),
      reviewCount: r.reviewCount,
      isActive: r.isActive,
      isPartner: r.isPartner,
      isFeatured: r.isFeatured,
      createdAt: r.createdAt,
      promo: promoByRestaurant.get(r.id) ?? {
        totalBudget: 0, totalImpressions: 0, totalClicks: 0, totalBookings: 0, activeCount: 0
      },
      // Use boost bookings as proxy for engagement since reservations has no restaurant_id
      recentBookings: promoByRestaurant.get(r.id)?.totalBookings ?? 0,
    }));

    // Top by boost ROI (bookings_attributed)
    const topBoosted = [...enriched]
      .sort((a, b) => b.promo.totalBookings - a.promo.totalBookings)
      .slice(0, 10);

    // Top by boost spend
    const topSpenders = [...enriched]
      .filter(r => r.promo.totalBudget > 0)
      .sort((a, b) => b.promo.totalBudget - a.promo.totalBudget)
      .slice(0, 10);

    // Upsell candidates: active, not premium, any engagement
    const upsellCandidates = [...enriched]
      .filter(r => r.isActive && !r.isPartner && r.rating >= 3.5)
      .sort((a, b) => (b.recentBookings + b.reviewCount) - (a.recentBookings + a.reviewCount))
      .slice(0, 15);

    // Churn risk: premium, but 0 recent bookings and 0 active promos
    const churnRiskBusinesses = [...enriched]
      .filter(r => r.isPartner && r.recentBookings === 0 && r.promo.activeCount === 0)
      .sort((a, b) => a.rating - b.rating)
      .slice(0, 10);

    // Top recent bookings
    const topByRecentBookings = [...enriched]
      .sort((a, b) => b.recentBookings - a.recentBookings)
      .slice(0, 10);

    // ─── Alerts ───────────────────────────────────────────────────────────
    const alerts: { type: string; severity: string; title: string; detail: string }[] = [];

    if (churnRiskBusinesses.length > 0) {
      alerts.push({
        type: "churn",
        severity: "high",
        title: `${churnRiskBusinesses.length} Premium-Betriebe ohne Aktivität`,
        detail: `${churnRiskBusinesses.map(r => r.name).slice(0, 3).join(", ")} — Abwanderungsgefahr`,
      });
    }

    const lowRatingPremium = enriched.filter(r => r.isPartner && r.rating < 3.5 && r.rating > 0);
    if (lowRatingPremium.length > 0) {
      alerts.push({
        type: "rating",
        severity: "medium",
        title: `${lowRatingPremium.length} Premium-Betriebe mit niedriger Bewertung`,
        detail: `Unter 3,5 ★: ${lowRatingPremium.map(r => r.name).join(", ")}`,
      });
    }

    const highBudgetZeroBookings = allPromos.filter(
      (p: any) => (p.budget_cents ?? 0) > 5000 && (p.bookings_attributed ?? 0) === 0
    );
    if (highBudgetZeroBookings.length > 0) {
      alerts.push({
        type: "boost_roi",
        severity: "medium",
        title: `${highBudgetZeroBookings.length} Boosts mit hohem Budget, aber 0 Buchungen`,
        detail: `Optimierungspotenzial erkannt`,
      });
    }

    if (upsellCandidates.length >= 5) {
      alerts.push({
        type: "upsell",
        severity: "info",
        title: `${upsellCandidates.length} hochwertige Upsell-Kandidaten identifiziert`,
        detail: `Aktive Betriebe ohne Premium — konvertierungsbereit`,
      });
    }

    if (newPremium30d > 0) {
      alerts.push({
        type: "growth",
        severity: "success",
        title: `${newPremium30d} neue Premium-Abonnements in den letzten 30 Tagen`,
        detail: `Wachstumstrend positiv`,
      });
    }

    res.json({
      kpis: {
        totalRestaurants,
        activeRestaurants,
        premiumBusinesses,
        nonPremiumActive,
        mrrEur,
        newPremium30d,
        churnRisk,
        boostRevenueEur,
        totalRevenueEur,
        totalBoostImpressions,
        totalBoostClicks,
        totalBookingsInfluenced,
        totalHeatExposure,
        totalGroupExposure,
        boostConvRate,
        totalReservations,
        arrivedReservations,
        activePromos: activePromos.length,
        totalPromos: allPromos.length,
      },
      byBizType: byBizType.rows,
      byCity: byCity.rows,
      promoByType: promoByType.rows,
      rankings: {
        topBoosted,
        topSpenders,
        upsellCandidates,
        churnRiskBusinesses,
        topByRecentBookings,
      },
      alerts,
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "founder metrics error");
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

// ─── /api/founder/businesses ─────────────────────────────────────────────────

router.get("/businesses", async (req, res) => {
  try {
    const [restaurants, promoRows] = await Promise.all([
      db.select().from(restaurantsTable),
      db.execute(sql`
        SELECT restaurant_id,
               COUNT(*)::int as total_promos,
               COUNT(*) FILTER (WHERE status='active')::int as active_promos,
               SUM(budget_cents)::int as total_budget_cents,
               SUM(impressions)::int as total_impressions,
               SUM(clicks)::int as total_clicks,
               SUM(bookings_attributed)::int as total_bookings
        FROM promotions
        GROUP BY restaurant_id
      `),
    ]);

    const promoMap = new Map((promoRows.rows as any[]).map(r => [r.restaurant_id, r]));

    const businesses = restaurants.map(r => ({
      id: r.id,
      name: r.name,
      businessType: r.businessType ?? "restaurant",
      city: r.city,
      email: r.email,
      phone: r.phone,
      rating: parseFloat(r.rating as any),
      reviewCount: r.reviewCount,
      priceRange: r.priceRange,
      isActive: r.isActive,
      isPartner: r.isPartner,
      isFeatured: r.isFeatured,
      createdAt: r.createdAt,
      promo: promoMap.get(r.id) ?? {
        total_promos: 0, active_promos: 0, total_budget_cents: 0,
        total_impressions: 0, total_clicks: 0, total_bookings: 0,
      },
      recentBookings: (promoMap.get(r.id)?.total_bookings as number) ?? 0,
    }));

    res.json(businesses);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

// ─── /api/founder/pipeline ────────────────────────────────────────────────────

router.get("/pipeline", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        r.id, r.name, r.business_type, r.address, r.city,
        r.rating, r.review_count, r.is_partner, r.is_featured, r.is_active,
        r.email, r.phone, r.cuisine, r.cuisine_emoji,
        p.status, p.priority, p.notes, p.contact_name, p.contact_phone,
        p.contacted_at, p.demo_at, p.trial_started_at, p.converted_at, p.updated_at
      FROM restaurants r
      LEFT JOIN sales_pipeline p ON p.restaurant_id = r.id
      ORDER BY
        CASE p.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        r.rating DESC
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

router.put("/pipeline/:restaurantId", async (req, res) => {
  try {
    const id = parseInt(req.params.restaurantId, 10);
    const { status, notes, contact_name, contact_phone, priority } = req.body;

    // Build timestamp columns from status transitions
    const now = new Date().toISOString();
    const tsColumns: Record<string, string | null> = {};
    if (status === "contacted") tsColumns["contacted_at"] = now;
    if (status === "demo")      tsColumns["demo_at"] = now;
    if (status === "trial")     tsColumns["trial_started_at"] = now;
    if (status === "paying")    tsColumns["converted_at"] = now;

    const tsSetClauses = Object.entries(tsColumns)
      .map(([col, val]) => sql`${sql.raw(col)} = COALESCE(${sql.raw(col)}, ${val})`)
      .join(sql`, `)

    await db.execute(sql`
      UPDATE sales_pipeline SET
        status = ${status ?? sql`status`},
        priority = ${priority ?? sql`priority`},
        notes = ${notes ?? sql`notes`},
        contact_name = ${contact_name ?? sql`contact_name`},
        contact_phone = ${contact_phone ?? sql`contact_phone`},
        updated_at = NOW()
      WHERE restaurant_id = ${id}
    `);

    // Set timestamp columns if transitioning to new status
    for (const [col, val] of Object.entries(tsColumns)) {
      await db.execute(sql`
        UPDATE sales_pipeline
        SET ${sql.raw(col)} = COALESCE(${sql.raw(col)}, ${val})
        WHERE restaurant_id = ${id}
      `);
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

// ─── /api/founder/leads (business interest from customer app) ─────────────────

router.post("/leads", async (req, res) => {
  try {
    const { restaurant_id, contact_name, contact_phone, message } = req.body;
    if (!restaurant_id) return res.status(400).json({ error: "restaurant_id required" });

    await db.execute(sql`
      UPDATE sales_pipeline SET
        status = CASE WHEN status = 'discovered' THEN 'contacted' ELSE status END,
        contact_name = COALESCE(contact_name, ${contact_name ?? null}),
        contact_phone = COALESCE(contact_phone, ${contact_phone ?? null}),
        notes = CASE
          WHEN ${message ?? null} IS NOT NULL
          THEN COALESCE(notes || E'\n', '') || '[Inbound Lead] ' || ${message ?? ''}
          ELSE notes
        END,
        contacted_at = COALESCE(contacted_at, NOW()),
        updated_at = NOW()
      WHERE restaurant_id = ${restaurant_id}
    `);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
});

export default router;
