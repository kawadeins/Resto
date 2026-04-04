/**
 * Promotions API — manages business promotion boosts and tracks performance events.
 *
 * Endpoints:
 *   GET  /api/promotions                — list promotions for a restaurant
 *   POST /api/promotions                — create / activate a boost
 *   PUT  /api/promotions/:id/pause      — pause active boost
 *   PUT  /api/promotions/:id/stop       — end boost permanently
 *   POST /api/promotions/:id/event      — record impression / click / booking event
 *   GET  /api/promotions/active         — get all currently active boosts (for marketplace boost scoring)
 *   GET  /api/promotions/:id/stats      — detailed stats for one promotion
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ─── Boost type definitions ───────────────────────────────────────────────────

export const BOOST_TYPES = {
  breakfast_boost:  { label: "Frühstücks-Boost",   hours: [6, 10],  multiplier: 1.25, bizTypes: ["cafe", "restaurant"] },
  lunch_boost:      { label: "Mittags-Boost",        hours: [11, 14], multiplier: 1.30, bizTypes: ["cafe", "restaurant"] },
  happy_hour_boost: { label: "Happy Hour Boost",     hours: [15, 19], multiplier: 1.28, bizTypes: ["bar", "restaurant"] },
  nightlife_boost:  { label: "Nachtleben-Boost",     hours: [19, 2],  multiplier: 1.35, bizTypes: ["bar"] },
  local_spotlight:  { label: "Local Spotlight",      hours: [0, 24],  multiplier: 1.20, bizTypes: ["restaurant", "cafe", "bar"] },
  local_heat_boost: { label: "Heat-Map Boost",       hours: [0, 24],  multiplier: 1.22, bizTypes: ["restaurant", "cafe", "bar"] },
} as const;

export type BoostType = keyof typeof BOOST_TYPES;

// ─── GET /api/promotions?restaurantId=:id ─────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId required" });

    const rows = await db.execute(sql`
      SELECT
        p.*,
        COUNT(pe.id) FILTER (WHERE pe.event_type = 'impression')       AS event_impressions,
        COUNT(pe.id) FILTER (WHERE pe.event_type = 'click')            AS event_clicks,
        COUNT(pe.id) FILTER (WHERE pe.event_type = 'booking')          AS event_bookings,
        COUNT(pe.id) FILTER (WHERE pe.event_type = 'heat_exposure')    AS event_heat,
        COUNT(pe.id) FILTER (WHERE pe.event_type = 'group_exposure')   AS event_group
      FROM promotions p
      LEFT JOIN promotion_events pe ON pe.promotion_id = p.id
      WHERE p.restaurant_id = ${restaurantId}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 50
    `);

    return res.json(rows.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch promotions");
    return res.status(500).json({ error: "Failed to fetch promotions" });
  }
});

// ─── GET /api/promotions/my — promotions for the owner's own restaurant ────────
// Single-tenant: the admin always owns the first active restaurant.
router.get("/my", async (req, res) => {
  try {
    const restResult = await db.execute(sql`
      SELECT id, name, business_type FROM restaurants WHERE is_active = true ORDER BY id ASC LIMIT 1
    `);
    const restaurant = restResult.rows[0] as { id: number; name: string; business_type: string } | undefined;
    if (!restaurant) return res.json({ restaurantId: null, businessType: "restaurant", promotions: [] });

    const rows = await db.execute(sql`
      SELECT
        p.*,
        COUNT(pe.id) FILTER (WHERE pe.event_type = 'impression')     AS event_impressions,
        COUNT(pe.id) FILTER (WHERE pe.event_type = 'click')          AS event_clicks,
        COUNT(pe.id) FILTER (WHERE pe.event_type = 'booking')        AS event_bookings,
        COUNT(pe.id) FILTER (WHERE pe.event_type = 'heat_exposure')  AS event_heat,
        COUNT(pe.id) FILTER (WHERE pe.event_type = 'group_exposure') AS event_group
      FROM promotions p
      LEFT JOIN promotion_events pe ON pe.promotion_id = p.id
      WHERE p.restaurant_id = ${restaurant.id}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 50
    `);

    return res.json({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      businessType: restaurant.business_type ?? "restaurant",
      promotions: rows.rows,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch my promotions");
    return res.status(500).json({ error: "Failed to fetch promotions" });
  }
});

// ─── GET /api/promotions/active — all active boosts (for marketplace ranking) ─
router.get("/active", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT p.restaurant_id, p.type, p.impressions, p.clicks, p.bookings_attributed
      FROM promotions p
      WHERE p.status = 'active'
        AND (p.ends_at IS NULL OR p.ends_at > NOW())
    `);
    return res.json(rows.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch active promotions");
    return res.status(500).json({ error: "Failed to fetch active promotions" });
  }
});

// ─── POST /api/promotions — create a new boost ────────────────────────────────
const CreatePromoSchema = z.object({
  restaurantId: z.number(),
  type: z.enum(["breakfast_boost", "lunch_boost", "happy_hour_boost", "nightlife_boost", "local_spotlight", "local_heat_boost"]),
  durationHours: z.number().min(1).max(168).optional(), // optional: null = manual stop
});

router.post("/", async (req, res) => {
  try {
    const body = CreatePromoSchema.parse(req.body);

    // Pause any active boost of same type for this restaurant (one active per type)
    await db.execute(sql`
      UPDATE promotions
      SET status = 'paused', updated_at = NOW()
      WHERE restaurant_id = ${body.restaurantId}
        AND type = ${body.type}
        AND status = 'active'
    `);

    const endsAt = body.durationHours
      ? sql`NOW() + INTERVAL '${sql.raw(String(body.durationHours))} hours'`
      : sql`NULL`;

    const result = await db.execute(sql`
      INSERT INTO promotions (restaurant_id, type, status, ends_at)
      VALUES (${body.restaurantId}, ${body.type}, 'active', ${endsAt})
      RETURNING *
    `);

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    req.log.error({ err }, "Failed to create promotion");
    return res.status(500).json({ error: "Failed to create promotion" });
  }
});

// ─── PUT /api/promotions/:id/pause ────────────────────────────────────────────
router.put("/:id/pause", async (req, res) => {
  try {
    await db.execute(sql`
      UPDATE promotions SET status = 'paused', updated_at = NOW()
      WHERE id = ${Number(req.params.id)}
    `);
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to pause promotion");
    return res.status(500).json({ error: "Failed to pause promotion" });
  }
});

// ─── PUT /api/promotions/:id/resume ───────────────────────────────────────────
router.put("/:id/resume", async (req, res) => {
  try {
    await db.execute(sql`
      UPDATE promotions SET status = 'active', updated_at = NOW()
      WHERE id = ${Number(req.params.id)}
    `);
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to resume promotion");
    return res.status(500).json({ error: "Failed to resume promotion" });
  }
});

// ─── PUT /api/promotions/:id/stop ─────────────────────────────────────────────
router.put("/:id/stop", async (req, res) => {
  try {
    await db.execute(sql`
      UPDATE promotions SET status = 'ended', ends_at = NOW(), updated_at = NOW()
      WHERE id = ${Number(req.params.id)}
    `);
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to stop promotion");
    return res.status(500).json({ error: "Failed to stop promotion" });
  }
});

// ─── GET /api/promotions/budget?restaurantId=:id — get budget state ───────────
router.get("/budget", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId required" });

    const today = new Date().toISOString().split("T")[0];
    const rows = await db.execute(sql`
      SELECT id, type, status, daily_budget, spent_today, budget_reset_date
      FROM promotions
      WHERE restaurant_id = ${restaurantId}
        AND status IN ('active', 'paused')
      ORDER BY created_at DESC
    `);

    const budgets = rows.rows.map((r: any) => {
      const lastReset = (r.budget_reset_date ?? "").toString().slice(0, 10);
      const spentToday = lastReset < today ? 0 : parseFloat(r.spent_today ?? "0");
      const dailyBudget = parseFloat(r.daily_budget ?? "0");
      const budgetRemaining = dailyBudget > 0 ? Math.max(0, dailyBudget - spentToday) : null;
      return {
        id: r.id,
        type: r.type,
        status: r.status,
        dailyBudget,
        spentToday,
        budgetRemaining,
        budgetExhausted: dailyBudget > 0 && spentToday >= dailyBudget,
      };
    });

    return res.json({ restaurantId, budgets });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch budget");
    return res.status(500).json({ error: "Failed to fetch budget" });
  }
});

// ─── PUT /api/promotions/:id/budget — set daily budget for a promotion ─────────
router.put("/:id/budget", async (req, res) => {
  try {
    const promoId = Number(req.params.id);
    const schema = z.object({ dailyBudget: z.number().min(0).max(500) });
    const { dailyBudget } = schema.parse(req.body);

    await db.execute(sql`
      UPDATE promotions
      SET daily_budget = ${dailyBudget}, updated_at = NOW()
      WHERE id = ${promoId}
    `);
    return res.json({ ok: true, dailyBudget });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    req.log.error({ err }, "Failed to update budget");
    return res.status(500).json({ error: "Failed to update budget" });
  }
});

// ─── POST /api/promotions/restaurant/:restaurantId/impression — convenience endpoint ──
// Finds the active promotion for a restaurant, records an impression, and deducts from budget.
router.post("/restaurant/:restaurantId/impression", async (req, res) => {
  try {
    const restaurantId = Number(req.params.restaurantId);
    const today = new Date().toISOString().split("T")[0];

    const rows = await db.execute(sql`
      SELECT id, daily_budget, spent_today, budget_reset_date FROM promotions
      WHERE restaurant_id = ${restaurantId}
        AND status = 'active'
        AND (ends_at IS NULL OR ends_at > NOW())
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const promo = rows.rows[0] as {
      id: number;
      daily_budget: string;
      spent_today: string;
      budget_reset_date: string;
    } | undefined;
    if (!promo) return res.json({ ok: false, reason: "no_active_promotion" });

    // Check budget
    const lastReset = (promo.budget_reset_date ?? "").toString().slice(0, 10);
    const spentToday = lastReset < today ? 0 : parseFloat(promo.spent_today ?? "0");
    const dailyBudget = parseFloat(promo.daily_budget ?? "0");
    if (dailyBudget > 0 && spentToday >= dailyBudget) {
      return res.json({ ok: false, reason: "budget_exhausted", promotionId: promo.id });
    }

    await db.execute(sql`
      INSERT INTO promotion_events (promotion_id, event_type, context)
      VALUES (${promo.id}, 'impression', 'explore_list')
    `);

    // Deduct €0.01 per impression from daily budget and reset if new day
    if (lastReset < today) {
      await db.execute(sql`
        UPDATE promotions
        SET impressions = impressions + 1,
            spent_today = 0.01,
            budget_reset_date = ${today},
            updated_at = NOW()
        WHERE id = ${promo.id}
      `);
    } else {
      await db.execute(sql`
        UPDATE promotions
        SET impressions = impressions + 1,
            spent_today = spent_today + 0.01,
            updated_at = NOW()
        WHERE id = ${promo.id}
      `);
    }

    const remaining = dailyBudget > 0 ? Math.max(0, dailyBudget - spentToday - 0.01) : null;
    return res.json({ ok: true, promotionId: promo.id, budgetRemaining: remaining });
  } catch (err) {
    req.log.error({ err }, "Failed to record restaurant impression");
    return res.status(500).json({ error: "Failed to record impression" });
  }
});

// ─── POST /api/promotions/:id/event — record a performance event ──────────────
const EventSchema = z.object({
  eventType: z.enum(["impression", "click", "booking", "heat_exposure", "group_exposure"]),
  context: z.string().max(100).optional(),
});

router.post("/:id/event", async (req, res) => {
  try {
    const body = EventSchema.parse(req.body);
    const promoId = Number(req.params.id);

    // Insert event
    await db.execute(sql`
      INSERT INTO promotion_events (promotion_id, event_type, context)
      VALUES (${promoId}, ${body.eventType}, ${body.context ?? null})
    `);

    // Increment counter on promotion row (denormalised for fast reads)
    const colMap: Record<string, string> = {
      impression:    "impressions",
      click:         "clicks",
      booking:       "bookings_attributed",
      heat_exposure: "heat_exposure",
      group_exposure:"group_exposure",
    };
    const col = colMap[body.eventType];
    if (col) {
      await db.execute(sql`
        UPDATE promotions
        SET ${sql.raw(col)} = ${sql.raw(col)} + 1, updated_at = NOW()
        WHERE id = ${promoId}
      `);
    }

    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    req.log.error({ err }, "Failed to record promotion event");
    return res.status(500).json({ error: "Failed to record event" });
  }
});

// ─── GET /api/promotions/:id/stats ────────────────────────────────────────────
router.get("/:id/stats", async (req, res) => {
  try {
    const promoId = Number(req.params.id);

    const [promo, eventsResult] = await Promise.all([
      db.execute(sql`SELECT * FROM promotions WHERE id = ${promoId}`),
      db.execute(sql`
        SELECT
          event_type,
          COUNT(*) AS count,
          DATE_TRUNC('hour', created_at) AS hour
        FROM promotion_events
        WHERE promotion_id = ${promoId}
        GROUP BY event_type, DATE_TRUNC('hour', created_at)
        ORDER BY hour ASC
      `),
    ]);

    if (!promo.rows[0]) return res.status(404).json({ error: "Not found" });

    return res.json({
      promotion: promo.rows[0],
      hourlyEvents: eventsResult.rows,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch promotion stats");
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
