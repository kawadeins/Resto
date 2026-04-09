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
import { requireManagerOrAbove } from "../middleware/role-guard";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { computeDynamicPrice } from "../lib/pricing-engine";
import { getWalletBalance, computeBoostCost } from "./wallet";

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

router.post("/", requireManagerOrAbove(), async (req, res) => {
  try {
    const body = CreatePromoSchema.parse(req.body);

    // Compute cost BEFORE the transaction (uses external pricing signals, not wallet state)
    const boostCost  = await computeBoostCost(body.type, body.restaurantId);
    const boostLabel = BOOST_TYPES[body.type as BoostType]?.label ?? body.type;

    req.log.info({ restaurantId: body.restaurantId, boostType: body.type, cost: boostCost }, "Boost activation attempted");

    let txResult: { promotion: { id: number; type: string }; balanceBefore: number; balanceAfter: number };

    try {
      txResult = await db.transaction(async (tx) => {
        // ── Advisory lock: serialise concurrent activations per restaurant ────
        // Released automatically when the transaction ends (commit or rollback).
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${body.restaurantId})`);

        // ── Balance check INSIDE the transaction (no TOCTOU race) ─────────────
        const balResult = await tx.execute(sql`
          SELECT COALESCE(SUM(
            CASE WHEN type = 'topup' OR type = 'refund' THEN amount ELSE -amount END
          ), 0) AS balance
          FROM wallet_transactions
          WHERE restaurant_id = ${body.restaurantId}
        `);
        const currentBalance = parseFloat((balResult.rows[0] as any)?.balance ?? "0");

        if (currentBalance < boostCost) {
          const err = new Error("insufficient_balance") as Error & { walletData: Record<string, number> };
          err.walletData = {
            required:  boostCost,
            current:   Math.round(currentBalance * 100) / 100,
            shortfall: Math.round((boostCost - currentBalance) * 100) / 100,
          };
          throw err;
        }

        // ── Duplicate protection: same type activated in last 10 seconds ───────
        const recentRows = await tx.execute(sql`
          SELECT id FROM promotions
          WHERE restaurant_id = ${body.restaurantId}
            AND type          = ${body.type}
            AND status        = 'active'
            AND created_at   > NOW() - INTERVAL '10 seconds'
          LIMIT 1
        `);
        if (recentRows.rows.length > 0) {
          throw new Error("duplicate_activation");
        }

        // ── Pause any active boost of same type (one active per type) ─────────
        await tx.execute(sql`
          UPDATE promotions
          SET status = 'paused', updated_at = NOW()
          WHERE restaurant_id = ${body.restaurantId}
            AND type          = ${body.type}
            AND status        = 'active'
        `);

        // ── Create the new boost ───────────────────────────────────────────────
        const endsAt = body.durationHours
          ? sql`NOW() + INTERVAL '${sql.raw(String(body.durationHours))} hours'`
          : sql`NULL`;

        const insertResult = await tx.execute(sql`
          INSERT INTO promotions (restaurant_id, type, status, ends_at)
          VALUES (${body.restaurantId}, ${body.type}, 'active', ${endsAt})
          RETURNING *
        `);
        const promotion = insertResult.rows[0] as { id: number; type: string };

        // ── Deduct from wallet (inside same transaction — atomic with insert) ──
        const newBalance = Math.round((currentBalance - boostCost) * 100) / 100;
        await tx.execute(sql`
          INSERT INTO wallet_transactions
            (restaurant_id, type, amount, description, boost_type, balance_after, promotion_id)
          VALUES (
            ${body.restaurantId},
            'boost_spend',
            ${boostCost},
            ${"Boost aktiviert: " + boostLabel},
            ${body.type},
            ${newBalance},
            ${promotion.id}
          )
        `);

        return { promotion, balanceBefore: currentBalance, balanceAfter: newBalance };
      });
    } catch (txErr: any) {
      if (txErr.message === "insufficient_balance") {
        req.log.warn({ restaurantId: body.restaurantId, boostType: body.type, ...txErr.walletData }, "Boost blocked — insufficient balance");
        return res.status(402).json({
          error:    "insufficient_balance",
          message:  "Nicht gen\u00FCgend Guthaben. Bitte lade zuerst dein Guthaben auf.",
          ...txErr.walletData,
        });
      }
      if (txErr.message === "duplicate_activation") {
        req.log.warn({ restaurantId: body.restaurantId, boostType: body.type }, "Boost blocked — duplicate activation within 10 s");
        return res.status(409).json({
          error:   "duplicate_activation",
          message: "Dieser Boost wurde gerade erst aktiviert. Bitte warte kurz.",
        });
      }
      throw txErr;
    }

    req.log.info({
      restaurantId:  body.restaurantId,
      boostType:     body.type,
      promotionId:   txResult.promotion.id,
      cost:          boostCost,
      balanceBefore: txResult.balanceBefore,
      balanceAfter:  txResult.balanceAfter,
    }, "Boost activated — wallet deducted atomically");

    return res.status(201).json({
      ...txResult.promotion,
      walletDeducted: boostCost,
      walletBalance:  txResult.balanceAfter,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    req.log.error({ err }, "Failed to create promotion — unexpected error");
    return res.status(500).json({ error: "Boost konnte nicht gestartet werden. Bitte versuche es erneut." });
  }
});

// ─── PUT /api/promotions/:id/pause ────────────────────────────────────────────
router.put("/:id/pause", requireManagerOrAbove(), async (req, res) => {
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
router.put("/:id/resume", requireManagerOrAbove(), async (req, res) => {
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
router.put("/:id/stop", requireManagerOrAbove(), async (req, res) => {
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

// ─── GET /api/promotions/analysis — revenue optimization engine ───────────────
// Single-tenant: always analyzes the first active restaurant.
router.get("/analysis", async (req, res) => {
  try {
    const restResult = await db.execute(sql`
      SELECT id, name, business_type FROM restaurants WHERE is_active = true ORDER BY id ASC LIMIT 1
    `);
    const restaurant = restResult.rows[0] as { id: number; name: string; business_type: string } | undefined;
    if (!restaurant) return res.status(404).json({ error: "No restaurant found" });

    const bizType = restaurant.business_type ?? "restaurant";
    const restaurantId = restaurant.id;

    const promosResult = await db.execute(sql`
      SELECT id, type, status, daily_budget, spent_today, budget_reset_date,
             impressions, clicks, bookings_attributed, heat_exposure, group_exposure,
             created_at, ends_at
      FROM promotions
      WHERE restaurant_id = ${restaurantId}
      ORDER BY created_at DESC
      LIMIT 30
    `);
    const promos = promosResult.rows as any[];

    const hourlyResult = await db.execute(sql`
      SELECT EXTRACT(HOUR FROM pe.created_at)::int AS hour,
             pe.event_type,
             COUNT(*) AS count
      FROM promotion_events pe
      INNER JOIN promotions p ON p.id = pe.promotion_id
      WHERE p.restaurant_id = ${restaurantId}
        AND pe.created_at > NOW() - INTERVAL '7 days'
      GROUP BY hour, pe.event_type
      ORDER BY hour ASC
    `);
    const hourlyEvents = hourlyResult.rows as { hour: number; event_type: string; count: string }[];

    const demandResult = await db.execute(sql`
      SELECT COUNT(*) AS active_count FROM promotions
      WHERE status = 'active' AND (ends_at IS NULL OR ends_at > NOW())
    `);
    const activePlatformBoosts = parseInt((demandResult.rows[0] as any)?.active_count ?? "0");

    const activePromos = promos.filter((p: any) => p.status === "active");
    const totalImpressions = promos.reduce((s: number, p: any) => s + parseInt(p.impressions ?? 0), 0);
    const totalClicks     = promos.reduce((s: number, p: any) => s + parseInt(p.clicks ?? 0), 0);
    const totalBookings   = promos.reduce((s: number, p: any) => s + parseInt(p.bookings_attributed ?? 0), 0);
    const avgCTR         = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgBookingRate = totalClicks > 0 ? totalBookings / totalClicks : 0;

    const today = new Date().toISOString().split("T")[0];
    let totalBudget = 0, totalSpent = 0;
    for (const p of activePromos) {
      const lastReset = (p.budget_reset_date ?? "").toString().slice(0, 10);
      const spent  = lastReset < today ? 0 : parseFloat(p.spent_today ?? 0);
      const budget = parseFloat(p.daily_budget ?? 0);
      if (budget > 0) { totalBudget += budget; totalSpent += spent; }
    }
    const budgetUtilization = totalBudget > 0 ? totalSpent / totalBudget : 0;

    const impressionsByHour: Record<number, number> = {};
    for (const ev of hourlyEvents) {
      if (ev.event_type === "impression") {
        impressionsByHour[ev.hour] = (impressionsByHour[ev.hour] ?? 0) + parseInt(ev.count);
      }
    }
    const peakHours = Object.entries(impressionsByHour)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 3)
      .map(([hour, count]) => ({ hour: parseInt(hour), count: parseInt(String(count)) }));

    const LABELS: Record<string, string> = {
      breakfast_boost: "Frühstücks-Boost", lunch_boost: "Mittags-Boost",
      happy_hour_boost: "Happy Hour Boost",  nightlife_boost: "Nachtleben-Boost",
      local_spotlight: "Local Spotlight",    local_heat_boost: "Heat-Map Boost",
    };

    const bestBoost = promos.length > 0
      ? promos.reduce((best: any, p: any) => {
          const ctr = parseInt(p.impressions ?? 0) > 0 ? parseInt(p.clicks ?? 0) / parseInt(p.impressions ?? 0) : 0;
          const bCtr = parseInt(best.impressions ?? 0) > 0 ? parseInt(best.clicks ?? 0) / parseInt(best.impressions ?? 0) : 0;
          return ctr > bCtr ? p : best;
        })
      : null;

    const roiFeedback = {
      bestBoostType: bestBoost?.type ?? null,
      bestBoostLabel: bestBoost ? (LABELS[bestBoost.type] ?? bestBoost.type) : null,
      bestImpressions: bestBoost ? parseInt(bestBoost.impressions ?? 0) : 0,
      bestCTR: bestBoost && parseInt(bestBoost.impressions ?? 0) > 0
        ? parseInt(bestBoost.clicks ?? 0) / parseInt(bestBoost.impressions ?? 0)
        : 0,
      insight: bestBoost && parseInt(bestBoost.clicks ?? 0) > 5
        ? `Ihr ${LABELS[bestBoost.type] ?? bestBoost.type} erzielt die höchste Klickrate — weiter aktiv lassen.`
        : promos.length === 0
        ? "Noch kein Boost aktiv — starten Sie den ersten Boost für sofortige Sichtbarkeit."
        : "Aktivieren Sie mehr Boosts, um Daten zu sammeln und präzise Empfehlungen zu erhalten.",
    };

    const currentHour = new Date().getHours();
    const currentDay  = new Date().getDay();
    const isWeekend   = currentDay === 0 || currentDay === 6;

    const PEAK_BY_TYPE: Record<string, { boost: string; hours: [number, number]; label: string }> = {
      cafe:       { boost: "breakfast_boost", hours: [6, 11],  label: "Frühstücks-Boost" },
      restaurant: { boost: "lunch_boost",     hours: [11, 14], label: "Mittags-Boost" },
      bar:        { boost: "nightlife_boost", hours: [19, 24], label: "Nachtleben-Boost" },
    };

    const recommendations: any[] = [];
    const recommended = PEAK_BY_TYPE[bizType];
    if (recommended) {
      const [pStart, pEnd] = recommended.hours;
      const isPeak = currentHour >= pStart && currentHour < pEnd;
      const hasActive = activePromos.some((p: any) => p.type === recommended.boost);
      if (isPeak && !hasActive) {
        recommendations.push({
          type: "missing_boost", priority: "high",
          title: `Jetzt ist Ihre Peak-Zeit — ${recommended.label} ist inaktiv`,
          description: `Es ist ${currentHour}:00 Uhr — genau der richtige Zeitraum für Ihren ${recommended.label}. Starten Sie ihn jetzt für sofortige Sichtbarkeit.`,
          action: "boost_activate", actionValue: recommended.boost, metric: "+40% Reichweite",
        });
      } else if (!hasActive) {
        const hint = bizType === "cafe"
          ? "Aktivieren Sie ihn vor 8 Uhr für maximale Morgensichtbarkeit."
          : bizType === "bar"
          ? "Aktivieren Sie ihn vor dem Abend für mehr Nachtgäste."
          : "Aktivieren Sie ihn vor 11 Uhr für mehr Mittagsgäste.";
        recommendations.push({
          type: "boost_time_window", priority: "medium",
          title: `${recommended.label} vorbereiten`,
          description: hint,
          action: "boost_activate", actionValue: recommended.boost, metric: null,
        });
      }
    }

    if (totalImpressions > 20 && avgCTR < 0.03) {
      recommendations.push({
        type: "low_ctr", priority: "high",
        title: "Hohe Sichtbarkeit, wenig Klicks — Profil optimieren",
        description: `Klickrate: ${(avgCTR * 100).toFixed(1)}% — unter dem Durchschnitt (3–5%). Bessere Fotos oder ein stärkerer Kurztext können die Klicks verdoppeln.`,
        action: "go_to_marketing", metric: `CTR ${(avgCTR * 100).toFixed(1)}%`,
      });
    }

    if (totalClicks > 10 && avgBookingRate < 0.05) {
      recommendations.push({
        type: "low_conversion", priority: "medium",
        title: "Klicks ohne Buchungen — Flash Deal hinzufügen",
        description: `Nur ${(avgBookingRate * 100).toFixed(1)}% Ihrer Besucher buchen. Ein Flash Deal oder Smart Offer kann die Konversion sofort erhöhen.`,
        action: "go_to_insights", metric: `Buchungsrate ${(avgBookingRate * 100).toFixed(1)}%`,
      });
    }

    const exhausted = activePromos.filter((p: any) => {
      const lastReset = (p.budget_reset_date ?? "").toString().slice(0, 10);
      const spent  = lastReset < today ? 0 : parseFloat(p.spent_today ?? 0);
      const budget = parseFloat(p.daily_budget ?? 0);
      return budget > 0 && spent >= budget;
    });
    if (exhausted.length > 0) {
      recommendations.push({
        type: "budget_exhausted", priority: "high",
        title: `${exhausted.length} Boost${exhausted.length > 1 ? "s" : ""} aufgebraucht — Budget erhöhen`,
        description: "Ihr Tagesbudget ist erschöpft. Ihr Boost ist pausiert — erhöhen Sie das Budget um wieder sichtbar zu sein.",
        action: "go_to_marketing", metric: `${exhausted.length} aufgebraucht`,
      });
    }

    if (totalBudget > 0 && budgetUtilization < 0.3 && totalImpressions < 50) {
      recommendations.push({
        type: "budget_shift", priority: "low",
        title: "Budget auf Peak-Stunden konzentrieren",
        description: "Ihr Budget wird kaum genutzt. Aktivieren Sie Boosts gezielt in Ihren Peak-Stunden für bessere Effizienz.",
        action: "go_to_marketing", metric: `Nutzung ${(budgetUtilization * 100).toFixed(0)}%`,
      });
    }

    if (bizType === "bar" && isWeekend && !activePromos.some((p: any) => ["nightlife_boost","happy_hour_boost"].includes(p.type))) {
      recommendations.push({
        type: "demand_spike", priority: "high",
        title: "Wochenende — Hohe Bar-Nachfrage in Wien",
        description: "Wochenends suchen 3× mehr Nutzer nach Bars. Starten Sie jetzt den Nachtleben-Boost für maximale Sichtbarkeit.",
        action: "boost_activate", actionValue: "nightlife_boost", metric: "Wochenend-Peak",
      });
    }

    if (promos.length === 0) {
      const first = bizType === "cafe" ? "breakfast_boost" : bizType === "bar" ? "nightlife_boost" : "lunch_boost";
      recommendations.push({
        type: "missing_boost", priority: "high",
        title: `Ersten Boost starten — ${LABELS[first]}`,
        description: `Ihr ${bizType === "cafe" ? "Café" : bizType === "bar" ? "Bar" : "Restaurant"} ist noch nicht geboostet. Starten Sie mit dem ${LABELS[first]} für sofortige Sichtbarkeitserhöhung.`,
        action: "boost_activate", actionValue: first, metric: null,
      });
    }

    if (bestBoost && parseInt(bestBoost.impressions ?? 0) > 30 && avgCTR >= 0.04) {
      recommendations.push({
        type: "winner_confirmation", priority: "low",
        title: `${LABELS[bestBoost.type] ?? bestBoost.type} läuft hervorragend`,
        description: `Dieser Boost erzielt ${(avgCTR * 100).toFixed(1)}% Klickrate — über dem Durchschnitt. Halten Sie ihn aktiv und erwägen Sie mehr Budget.`,
        action: null, metric: `CTR ${(avgCTR * 100).toFixed(1)}%`,
      });
    }

    const order = { high: 0, medium: 1, low: 2 } as const;
    recommendations.sort((a, b) => order[a.priority as keyof typeof order] - order[b.priority as keyof typeof order]);

    const demandLevel = activePlatformBoosts > 20 ? "high" : activePlatformBoosts > 8 ? "medium" : "low";
    const demandSignal = demandLevel === "high"
      ? "Hohe Plattformnachfrage — jetzt ist ein guter Zeitpunkt für einen Boost"
      : demandLevel === "medium"
      ? "Moderate Aktivität auf der Plattform — ein Boost hebt Sie heraus"
      : "Ruhige Plattformlage — guter Zeitpunkt zum Vorbereiten";

    return res.json({
      restaurantId, restaurantName: restaurant.name, businessType: bizType,
      metrics: { totalImpressions, totalClicks, totalBookings, avgCTR, avgBookingRate, activeBoostCount: activePromos.length, budgetUtilization },
      peakHours, recommendations,
      platformDemand: { level: demandLevel, activePlatformBoosts, signal: demandSignal },
      roiFeedback,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to compute revenue analysis");
    return res.status(500).json({ error: "Failed to compute analysis" });
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
router.put("/:id/budget", requireManagerOrAbove(), async (req, res) => {
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

    // Fetch active promotion and restaurant business type in parallel
    const [rows, bizRows] = await Promise.all([
      db.execute(sql`
        SELECT id, daily_budget, spent_today, budget_reset_date FROM promotions
        WHERE restaurant_id = ${restaurantId}
          AND status = 'active'
          AND (ends_at IS NULL OR ends_at > NOW())
        ORDER BY created_at DESC
        LIMIT 1
      `),
      db.execute(sql`
        SELECT COALESCE(business_type, 'restaurant') AS business_type
        FROM restaurants WHERE id = ${restaurantId} LIMIT 1
      `),
    ]);

    const promo = rows.rows[0] as {
      id: number;
      daily_budget: string;
      spent_today: string;
      budget_reset_date: string;
    } | undefined;
    if (!promo) return res.json({ ok: false, reason: "no_active_promotion" });

    const bizType = ((bizRows.rows[0] as any)?.business_type as string | undefined) ?? "restaurant";

    // Check budget
    const lastReset = (promo.budget_reset_date ?? "").toString().slice(0, 10);
    const spentToday = lastReset < today ? 0 : parseFloat(promo.spent_today ?? "0");
    const dailyBudget = parseFloat(promo.daily_budget ?? "0");
    if (dailyBudget > 0 && spentToday >= dailyBudget) {
      return res.json({ ok: false, reason: "budget_exhausted", promotionId: promo.id });
    }

    // Compute real-time impression price
    const pricing = await computeDynamicPrice(bizType);
    const impressionCost = pricing.pricePerImpression;

    await db.execute(sql`
      INSERT INTO promotion_events (promotion_id, event_type, context)
      VALUES (${promo.id}, 'impression', 'explore_list')
    `);

    // Deduct dynamic price per impression; reset daily spend if new day
    if (lastReset < today) {
      await db.execute(sql`
        UPDATE promotions
        SET impressions = impressions + 1,
            spent_today = ${impressionCost},
            budget_reset_date = ${today},
            updated_at = NOW()
        WHERE id = ${promo.id}
      `);
    } else {
      await db.execute(sql`
        UPDATE promotions
        SET impressions = impressions + 1,
            spent_today = spent_today + ${impressionCost},
            updated_at = NOW()
        WHERE id = ${promo.id}
      `);
    }

    const remaining = dailyBudget > 0 ? Math.max(0, dailyBudget - spentToday - impressionCost) : null;
    return res.json({
      ok: true,
      promotionId: promo.id,
      budgetRemaining: remaining,
      impressionCost,
      demandLevel: pricing.demandLevel,
    });
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

// ─── GET /api/promotions/recommendations?restaurantId=:id ────────────────────
// Returns ranked smart boost recommendations driven by real business data:
// business type, Vienna time, demand signals, wallet balance, and historical ROI.

const BOOST_HOUR_SCORE: Record<string, (hour: number) => number> = {
  breakfast_boost:  h => h >= 5  && h < 11 ? 1.0 : h >= 11 && h < 13 ? 0.35 : 0.1,
  lunch_boost:      h => h >= 10 && h < 15 ? 1.0 : h >= 15 && h < 17 ? 0.4  : 0.1,
  happy_hour_boost: h => h >= 14 && h < 20 ? 1.0 : h >= 20 && h < 22 ? 0.5  : 0.15,
  nightlife_boost:  h => h >= 18           ? 1.0 : h < 3              ? 0.8  : 0.05,
  local_spotlight:  _  => 0.7,
  local_heat_boost: _  => 0.65,
};

const BIZ_BOOST_WEIGHT: Record<string, Record<string, number>> = {
  restaurant: { breakfast_boost: 0.85, lunch_boost: 1.0,  happy_hour_boost: 0.9, nightlife_boost: 0.4, local_spotlight: 0.95, local_heat_boost: 0.85 },
  cafe:       { breakfast_boost: 1.0,  lunch_boost: 0.85, happy_hour_boost: 0.6, nightlife_boost: 0.2, local_spotlight: 0.9,  local_heat_boost: 0.8  },
  bar:        { breakfast_boost: 0.2,  lunch_boost: 0.4,  happy_hour_boost: 1.0, nightlife_boost: 1.0, local_spotlight: 0.75, local_heat_boost: 0.7  },
};

const BOOST_WINDOW_LABEL: Record<string, string> = {
  breakfast_boost:  "05:00–11:00 Uhr",
  lunch_boost:      "10:00–15:00 Uhr",
  happy_hour_boost: "14:00–20:00 Uhr",
  nightlife_boost:  "18:00–02:00 Uhr",
  local_spotlight:  "Ganztags",
  local_heat_boost: "Ganztags",
};

const BOOST_EMOJIS: Record<string, string> = {
  breakfast_boost: "☕", lunch_boost: "🍽️", happy_hour_boost: "🍹",
  nightlife_boost: "🌙", local_spotlight: "⭐", local_heat_boost: "🔥",
};
const BOOST_LABELS: Record<string, string> = {
  breakfast_boost: "Frühstücks-Boost", lunch_boost: "Mittags-Boost",
  happy_hour_boost: "Happy Hour Boost", nightlife_boost: "Nachtleben-Boost",
  local_spotlight: "Local Spotlight", local_heat_boost: "Heat-Map Boost",
};

router.get("/recommendations", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId required" });

    // ── Context gathering ────────────────────────────────────────────────────
    const [restRes, walletEurRaw, roiRes, activeRes] = await Promise.all([
      db.execute(sql`SELECT business_type, name FROM restaurants WHERE id = ${restaurantId} LIMIT 1`),
      getWalletBalance(restaurantId),
      // Best ROI per boost type (last 30 days)
      db.execute(sql`
        WITH spend AS (
          SELECT boost_type, SUM(amount) AS cost
          FROM wallet_transactions
          WHERE restaurant_id = ${restaurantId} AND type = 'boost_spend'
            AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY boost_type
        ),
        perf AS (
          SELECT type, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
                 SUM(bookings_attributed) AS bookings
          FROM promotions
          WHERE restaurant_id = ${restaurantId}
            AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY type
        )
        SELECT p.type, p.clicks, p.impressions, p.bookings,
               COALESCE(s.cost,0) AS cost
        FROM perf p LEFT JOIN spend s ON s.boost_type = p.type
      `),
      // Currently active boosts
      db.execute(sql`
        SELECT type FROM promotions WHERE restaurant_id = ${restaurantId} AND status = 'active'
      `),
    ]);

    const biz  = (restRes.rows[0] as any) ?? { business_type: "restaurant" };
    const bizType: string = biz.business_type ?? "restaurant";
    const walletEur   = walletEurRaw;

    // Vienna time (UTC+1 / UTC+2 in summer) — use UTC+1 as safe default
    const nowUtc  = new Date();
    const hour    = (nowUtc.getUTCHours() + 1) % 24;

    const roiByType = new Map<string, { clicks: number; impressions: number; bookings: number; cost: number }>();
    for (const row of roiRes.rows as any[]) {
      roiByType.set(row.type, {
        clicks:      Number(row.clicks ?? 0),
        impressions: Number(row.impressions ?? 0),
        bookings:    Number(row.bookings ?? 0),
        cost:        Number(row.cost ?? 0),
      });
    }

    const activeTypes = new Set((activeRes.rows as any[]).map(r => r.type));

    // ── Demand score from simple heuristic (0-1) ─────────────────────────────
    // Peak hours inject demand; can be extended via cities_signals later
    const demandByHour = (h: number) => {
      if (h >= 7 && h < 9)   return 0.85;
      if (h >= 11 && h < 14) return 0.95;
      if (h >= 17 && h < 21) return 1.0;
      if (h >= 21 && h < 24) return 0.7;
      if (h >= 0  && h < 3)  return 0.6;
      return 0.35;
    };
    const demandScore = demandByHour(hour);

    // ── CLICK/BOOKING values (same as ROI panel) ──────────────────────────────
    const CLICK_VAL:   Record<string, number> = { restaurant: 3.00, cafe: 1.50, bar: 2.50 };
    const BOOKING_VAL: Record<string, number> = { restaurant: 28.0, cafe: 11.0, bar: 20.0 };
    const clickVal   = CLICK_VAL[bizType]   ?? 2.50;
    const bookingVal = BOOKING_VAL[bizType] ?? 20.0;

    // ── Score every boost type ────────────────────────────────────────────────
    const ALL_TYPES = Object.keys(BOOST_HOUR_SCORE);
    const bizWeight = BIZ_BOOST_WEIGHT[bizType] ?? BIZ_BOOST_WEIGHT.restaurant;

    const scored = ALL_TYPES.map(type => {
      const hourScore = BOOST_HOUR_SCORE[type](hour);
      const bizScore  = bizWeight[type] ?? 0.5;
      const hist      = roiByType.get(type);
      const histScore = hist
        ? Math.min(1, (hist.clicks * clickVal + hist.bookings * bookingVal) / Math.max(1, hist.cost * 100)) / 100
        : 0.5; // neutral if no history

      const confidence = Math.round((hourScore * 0.45 + demandScore * 0.30 + bizScore * 0.15 + histScore * 0.10) * 100);

      // Budget suggestion: based on demand + time
      const baseBudget = hourScore > 0.8 && demandScore > 0.7 ? 10 :
                         hourScore > 0.5 || demandScore > 0.5  ?  5 : 5;
      const suggestedBudget = Math.min(baseBudget, Math.max(5, Math.floor(walletEur * 0.5)));

      // Build reason text
      let reason = "";
      const isActive = activeTypes.has(type);
      if (hourScore > 0.8 && demandScore > 0.7) {
        reason = "Optimaler Zeitpunkt und hohe lokale Nachfrage — jetzt aktivieren lohnt sich.";
      } else if (hourScore > 0.8) {
        reason = "Perfektes Zeitfenster für diesen Boost-Typ.";
      } else if (demandScore > 0.7) {
        reason = "Hohe Nachfrage gerade aktiv — erhöhte Sichtbarkeit möglich.";
      } else if (hist && hist.clicks > 0) {
        reason = `In den letzten 30 Tagen: ${hist.clicks} Klicks bei €${(hist.cost).toFixed(2)} Ausgaben.`;
      } else if (bizScore > 0.85) {
        reason = "Besonders geeignet für Ihren Betriebstyp.";
      } else {
        reason = "Grundlegende Sichtbarkeit — aktuell kein idealer Zeitpunkt.";
      }

      // Warning
      let warning: string | null = null;
      if (walletEur < 5) warning = "Wallet-Guthaben unter €5 — bitte zuerst aufladen.";
      else if (hourScore < 0.3) warning = "Aktuell kein optimales Zeitfenster für diesen Boost.";
      else if (demandScore < 0.4) warning = "Niedrige Nachfrage — geringere Wirkung zu erwarten.";

      return {
        type,
        label:           BOOST_LABELS[type]  ?? type,
        emoji:           BOOST_EMOJIS[type]  ?? "🚀",
        window:          BOOST_WINDOW_LABEL[type] ?? "—",
        confidence,
        suggestedBudget,
        reason,
        warning,
        isActive,
        hourScore:       Math.round(hourScore  * 100),
        demandScore:     Math.round(demandScore * 100),
        hasHistory:      !!hist,
        historicalClicks: hist?.clicks ?? 0,
        historicalImpressions: hist?.impressions ?? 0,
        historicalCost:  hist?.cost ?? 0,
      };
    });

    // Sort: already active last (can keep), then by confidence desc
    scored.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? 1 : -1;
      return b.confidence - a.confidence;
    });

    const top3 = scored.slice(0, 3);
    const globalWarning =
      walletEur < 5         ? "Wallet-Guthaben zu niedrig für Boosts. Bitte aufladen." :
      demandScore < 0.35    ? "Aktuell sehr schwache Nachfrage — Boost nicht empfohlen." :
      null;

    return res.json({
      restaurantId,
      bizType,
      currentHour: hour,
      demandScore: Math.round(demandScore * 100),
      walletEur: Math.round(walletEur * 100) / 100,
      globalWarning,
      recommendations: top3,
      allScored: scored,
    });
  } catch (err) {
    req.log.error({ err }, "Recommendations failed");
    return res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

// ─── GET /api/promotions/auto-budget-settings?restaurantId=:id ───────────────
router.get("/auto-budget-settings", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId required" });
    const result = await db.execute(sql`
      SELECT * FROM auto_budget_settings WHERE restaurant_id = ${restaurantId} LIMIT 1
    `);
    if (result.rows.length === 0) {
      return res.json({
        restaurantId, enabled: false,
        dailyMaxEur: 10, weeklyMaxEur: 50, minWalletBalanceEur: 5,
        allowedBoostTypes: ["breakfast_boost","lunch_boost","happy_hour_boost","nightlife_boost","local_spotlight","local_heat_boost"],
        autoPauseLowROI: true,
      });
    }
    const row = result.rows[0] as any;
    return res.json({
      restaurantId,
      enabled:              row.enabled,
      dailyMaxEur:          row.daily_max_cents / 100,
      weeklyMaxEur:         row.weekly_max_cents / 100,
      minWalletBalanceEur:  row.min_wallet_balance_cents / 100,
      allowedBoostTypes:    row.allowed_boost_types,
      autoPauseLowROI:      row.auto_pause_low_roi,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get auto-budget settings");
    return res.status(500).json({ error: "Failed to get settings" });
  }
});

// ─── PUT /api/promotions/auto-budget-settings ─────────────────────────────────
const AutoBudgetSchema = z.object({
  restaurantId:         z.number().int().positive(),
  enabled:              z.boolean(),
  dailyMaxEur:          z.number().min(1).max(200),
  weeklyMaxEur:         z.number().min(1).max(500),
  minWalletBalanceEur:  z.number().min(0).max(50),
  allowedBoostTypes:    z.array(z.string()).min(1),
  autoPauseLowROI:      z.boolean(),
});

router.put("/auto-budget-settings", requireManagerOrAbove(), async (req, res) => {
  try {
    const body = AutoBudgetSchema.parse(req.body);
    // Serialize JS array to PostgreSQL text[] literal so drizzle doesn't treat it as a row constructor
    const typesLiteral = "{" + body.allowedBoostTypes.map((t: string) => '"' + t.replace(/"/g, '\\"') + '"').join(",") + "}";
    await db.execute(sql`
      INSERT INTO auto_budget_settings
        (restaurant_id, enabled, daily_max_cents, weekly_max_cents, min_wallet_balance_cents, allowed_boost_types, auto_pause_low_roi, updated_at)
      VALUES
        (${body.restaurantId}, ${body.enabled}, ${Math.round(body.dailyMaxEur*100)}, ${Math.round(body.weeklyMaxEur*100)},
         ${Math.round(body.minWalletBalanceEur*100)}, ${typesLiteral}::text[], ${body.autoPauseLowROI}, NOW())
      ON CONFLICT (restaurant_id) DO UPDATE SET
        enabled                  = EXCLUDED.enabled,
        daily_max_cents          = EXCLUDED.daily_max_cents,
        weekly_max_cents         = EXCLUDED.weekly_max_cents,
        min_wallet_balance_cents = EXCLUDED.min_wallet_balance_cents,
        allowed_boost_types      = EXCLUDED.allowed_boost_types,
        auto_pause_low_roi       = EXCLUDED.auto_pause_low_roi,
        updated_at               = NOW()
    `);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
    req.log.error({ err }, "Failed to save auto-budget settings");
    return res.status(500).json({ error: "Failed to save settings" });
  }
});

// ─── GET /api/promotions/roi?restaurantId=:id&period=week|month ───────────────
// Returns per-boost cost, ROI estimates, spend summary, and smart text insights.

const CLICK_VALUE: Record<string, number>   = { restaurant: 3.00, cafe: 1.50, bar: 2.50 };
const BOOKING_VALUE: Record<string, number> = { restaurant: 28.00, cafe: 11.00, bar: 20.00 };

router.get("/roi", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId required" });

    const period = (req.query.period as string) ?? "month";
    const interval = period === "week" ? "7 days" : "30 days";

    // ── Fetch restaurant business type ────────────────────────────────────────
    const restResult = await db.execute(sql`
      SELECT business_type FROM restaurants WHERE id = ${restaurantId} LIMIT 1
    `);
    const bizType = (restResult.rows[0] as any)?.business_type ?? "restaurant";
    const clickVal   = CLICK_VALUE[bizType]   ?? 2.50;
    const bookingVal = BOOKING_VALUE[bizType] ?? 20.00;

    // ── Fetch promotions in period ────────────────────────────────────────────
    const promoResult = await db.execute(sql`
      SELECT id, type, status, impressions, clicks, bookings_attributed,
             heat_exposure, group_exposure, created_at, ends_at
      FROM promotions
      WHERE restaurant_id = ${restaurantId}
        AND created_at   > NOW() - INTERVAL '${sql.raw(interval)}'
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const promos = promoResult.rows as any[];

    // ── Fetch spend linked to each promotion ───────────────────────────────────
    // Prefers promotion_id link; falls back to boost_type + restaurant_id for old records.
    const spendResult = await db.execute(sql`
      SELECT promotion_id, boost_type, SUM(amount) AS total_cost
      FROM wallet_transactions
      WHERE restaurant_id = ${restaurantId}
        AND type          = 'boost_spend'
        AND created_at   > NOW() - INTERVAL '${sql.raw(interval)}'
      GROUP BY promotion_id, boost_type
    `);
    const spendRows = spendResult.rows as { promotion_id: number | null; boost_type: string; total_cost: string }[];

    // Map promotion_id → cost (prefer exact link)
    const costByPromoId   = new Map<number, number>();
    const costByBoostType = new Map<string, number>();
    for (const row of spendRows) {
      const cost = parseFloat(row.total_cost);
      if (row.promotion_id) {
        costByPromoId.set(row.promotion_id, (costByPromoId.get(row.promotion_id) ?? 0) + cost);
      } else {
        costByBoostType.set(row.boost_type, (costByBoostType.get(row.boost_type) ?? 0) + cost);
      }
    }

    // ── Build per-boost ROI rows ───────────────────────────────────────────────
    const LABELS: Record<string, string> = {
      breakfast_boost: "Frühstücks-Boost", lunch_boost: "Mittags-Boost",
      happy_hour_boost: "Happy Hour Boost",  nightlife_boost: "Nachtleben-Boost",
      local_spotlight: "Local Spotlight",    local_heat_boost: "Heat-Map Boost",
    };
    const EMOJIS: Record<string, string> = {
      breakfast_boost: "☕", lunch_boost: "🍽️",
      happy_hour_boost: "🍹", nightlife_boost: "🌙",
      local_spotlight: "⭐", local_heat_boost: "🔥",
    };

    let totalSpent = 0, totalEstReturn = 0;

    const boostRows = promos.map((p: any) => {
      const impressions = Number(p.impressions) || 0;
      const clicks      = Number(p.clicks) || 0;
      const bookings    = Number(p.bookings_attributed) || 0;

      const cost = costByPromoId.get(p.id) ?? costByBoostType.get(p.type) ?? 0;
      const estimatedRevenue = Math.round((clicks * clickVal + bookings * bookingVal) * 100) / 100;
      const netProfit  = Math.round((estimatedRevenue - cost) * 100) / 100;
      const roi        = cost > 0 ? Math.round((netProfit / cost) * 100) : null;
      const cpc        = clicks > 0 && cost > 0 ? Math.round((cost / clicks) * 100) / 100 : null;
      const cpb        = bookings > 0 && cost > 0 ? Math.round((cost / bookings) * 100) / 100 : null;
      const ctr        = impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : null;

      let roiTier: "green" | "yellow" | "red" | "neutral" = "neutral";
      if (roi !== null) {
        roiTier = roi > 150 ? "green" : roi > 0 ? "yellow" : "red";
      }

      totalSpent     += cost;
      totalEstReturn += estimatedRevenue;

      return {
        id:          p.id,
        type:        p.type,
        label:       LABELS[p.type] ?? p.type,
        emoji:       EMOJIS[p.type] ?? "🚀",
        status:      p.status,
        createdAt:   p.created_at,
        endsAt:      p.ends_at,
        impressions, clicks, bookings,
        heatExposure: Number(p.heat_exposure) || 0,
        cost:        Math.round(cost * 100) / 100,
        estimatedRevenue,
        netProfit,
        roi,
        roiTier,
        costPerClick:   cpc,
        costPerBooking: cpb,
        ctr,
      };
    });

    // ── Smart insights ─────────────────────────────────────────────────────────
    const insights: { icon: string; text: string; priority: "high" | "medium" | "low" }[] = [];

    const activeRows   = boostRows.filter(b => b.status === "active");
    const withCost     = boostRows.filter(b => b.cost > 0);
    const profitable   = withCost.filter(b => (b.roi ?? 0) > 150);
    const losing       = withCost.filter(b => b.roi !== null && b.roi < 0);

    // Best performer
    if (profitable.length > 0) {
      const best = profitable.reduce((a, b) => (a.roi! > b.roi! ? a : b));
      insights.push({
        icon: "📈",
        text: `${best.label} erzielt ${best.roi}% ROI — Ihr bester Boost. Weiter aktiv lassen.`,
        priority: "high",
      });
    }

    // Underperformer
    if (losing.length > 0) {
      const worst = losing.reduce((a, b) => (a.roi! < b.roi! ? a : b));
      insights.push({
        icon: "⚠️",
        text: `${worst.label} erzielt negativen ROI (${worst.roi}%). Budget prüfen oder Boost pausieren.`,
        priority: "high",
      });
    }

    // High cost-per-click
    const highCPC = withCost.filter(b => b.costPerClick !== null && b.costPerClick > 2.0);
    if (highCPC.length > 0) {
      const h = highCPC[0];
      insights.push({
        icon: "💸",
        text: `${h.label} kostet €${h.costPerClick} pro Klick — optimieren Sie Ihr Profil für mehr organische Klicks.`,
        priority: "medium",
      });
    }

    // Great CTR
    const greatCTR = boostRows.filter(b => b.ctr !== null && b.ctr > 4.0 && b.impressions > 20);
    if (greatCTR.length > 0) {
      const g = greatCTR[0];
      insights.push({
        icon: "🎯",
        text: `${g.label} hat eine Klickrate von ${g.ctr}% — deutlich über dem Durchschnitt von 2–3%.`,
        priority: "low",
      });
    }

    // No bookings despite clicks
    const noBookings = withCost.filter(b => b.clicks > 10 && b.bookings === 0);
    if (noBookings.length > 0) {
      insights.push({
        icon: "🔍",
        text: "Viele Klicks, keine Buchungen — starke Fotos und ein Flash Deal können die Konversion verdoppeln.",
        priority: "medium",
      });
    }

    // Wallet ROI summary
    const netProfit = Math.round((totalEstReturn - totalSpent) * 100) / 100;
    const overallROI = totalSpent > 0 ? Math.round((netProfit / totalSpent) * 100) : null;
    if (overallROI !== null && overallROI > 200) {
      insights.push({
        icon: "🏆",
        text: `Gesamt-ROI ${overallROI}% — Ihr Boost-Budget arbeitet effizient. Weiter so!`,
        priority: "low",
      });
    }

    if (insights.length === 0 && boostRows.length === 0) {
      insights.push({
        icon: "🚀",
        text: "Aktivieren Sie Ihren ersten Boost, um ROI-Daten zu sammeln und Einblicke zu erhalten.",
        priority: "high",
      });
    }

    const summary = {
      period,
      totalSpent:     Math.round(totalSpent * 100) / 100,
      totalEstReturn: Math.round(totalEstReturn * 100) / 100,
      netProfit:      Math.round((totalEstReturn - totalSpent) * 100) / 100,
      overallROI,
      boostCount:     boostRows.length,
      activeCount:    activeRows.length,
      bizType,
    };

    return res.json({ summary, boosts: boostRows, insights });
  } catch (err) {
    req.log.error({ err }, "Failed to compute ROI");
    return res.status(500).json({ error: "Failed to compute ROI" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTO CAMPAIGN MODE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/promotions/auto-campaign/log ─────────────────────────────────────
router.get("/auto-campaign/log", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId required" });

    const [logRows, settingsRes, activeRes] = await Promise.all([
      db.execute(sql`
        SELECT id, action, boost_type, promotion_id, reason, confidence,
               wallet_before, wallet_after, created_at
        FROM auto_campaign_log
        WHERE restaurant_id = ${restaurantId}
        ORDER BY created_at DESC
        LIMIT 50
      `),
      db.execute(sql`
        SELECT enabled, daily_max_cents, weekly_max_cents, min_wallet_balance_cents,
               allowed_boost_types, auto_pause_low_roi, updated_at
        FROM auto_budget_settings
        WHERE restaurant_id = ${restaurantId}
        LIMIT 1
      `),
      db.execute(sql`
        SELECT type, status, id, created_at, impressions, clicks, bookings_attributed
        FROM promotions
        WHERE restaurant_id = ${restaurantId} AND status IN ('active', 'paused')
        ORDER BY created_at DESC
      `),
    ]);

    const settings = (settingsRes.rows[0] as any) ?? null;

    const boostStatus: Record<string, any> = {};
    for (const row of activeRes.rows as any[]) {
      if (!boostStatus[row.type]) {
        boostStatus[row.type] = {
          status:      row.status,
          promotionId: row.id,
          since:       row.created_at,
          impressions: Number(row.impressions ?? 0),
          clicks:      Number(row.clicks ?? 0),
          bookings:    Number(row.bookings_attributed ?? 0),
        };
      }
    }

    return res.json({
      settings,
      log:         logRows.rows,
      boostStatus,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch auto-campaign log");
    return res.status(500).json({ error: "Failed to fetch auto-campaign log" });
  }
});

// ── POST /api/promotions/auto-campaign/run ────────────────────────────────────
router.post("/auto-campaign/run", async (req, res) => {
  const restaurantId = Number(req.body?.restaurantId ?? req.query.restaurantId);
  if (!restaurantId) return res.status(400).json({ error: "restaurantId required" });

  try {
    // 1. Load settings
    const settingsRes = await db.execute(sql`
      SELECT enabled, daily_max_cents, weekly_max_cents, min_wallet_balance_cents,
             allowed_boost_types, auto_pause_low_roi
      FROM auto_budget_settings
      WHERE restaurant_id = ${restaurantId}
      LIMIT 1
    `);
    const settings = settingsRes.rows[0] as any;

    if (!settings || !settings.enabled) {
      return res.json({ skipped: true, reason: "Auto-Kampagnenmodus ist deaktiviert." });
    }

    // 2. Load restaurant context
    const [restRes, walletEur, spendRes, activeRes] = await Promise.all([
      db.execute(sql`SELECT business_type, name FROM restaurants WHERE id = ${restaurantId} LIMIT 1`),
      getWalletBalance(restaurantId),
      db.execute(sql`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE),0)             AS today_cents_raw,
          COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('week', NOW())),0) AS week_cents_raw
        FROM wallet_transactions
        WHERE restaurant_id = ${restaurantId} AND type = 'boost_spend'
      `),
      db.execute(sql`
        SELECT type, id, impressions, clicks, bookings_attributed, created_at
        FROM promotions
        WHERE restaurant_id = ${restaurantId} AND status = 'active'
      `),
    ]);

    const biz     = (restRes.rows[0] as any) ?? {};
    const bizType = (biz.business_type as string) ?? "restaurant";

    const spendRow    = spendRes.rows[0] as any;
    let todaySpent  = Math.round(Number(spendRow?.today_cents_raw ?? 0) * 100);  // in cents
    let weekSpent   = Math.round(Number(spendRow?.week_cents_raw  ?? 0) * 100);

    const dailyMaxCents  = Number(settings.daily_max_cents  ?? 0);
    const weeklyMaxCents = Number(settings.weekly_max_cents ?? 0);
    const minWalletCents = Number(settings.min_wallet_balance_cents ?? 0);
    let walletCents      = Math.round(walletEur * 100);

    const allowedTypes: string[] = Array.isArray(settings.allowed_boost_types)
      ? settings.allowed_boost_types
      : Object.keys(BOOST_TYPES);

    const activeTypes = new Set((activeRes.rows as any[]).map(r => r.type));

    // 3. Current time (Vienna)
    const nowUtc = new Date();
    const hour   = (nowUtc.getUTCHours() + 1) % 24;

    const demandByHour = (h: number) => {
      if (h >= 7  && h < 9)  return 0.85;
      if (h >= 11 && h < 14) return 0.95;
      if (h >= 17 && h < 21) return 1.0;
      if (h >= 21 && h < 24) return 0.7;
      if (h >= 0  && h < 3)  return 0.6;
      return 0.35;
    };
    const demandScore = demandByHour(hour);

    const bizWeight = BIZ_BOOST_WEIGHT[bizType] ?? BIZ_BOOST_WEIGHT.restaurant;
    const roiRes = await db.execute(sql`
      WITH perf AS (
        SELECT type, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
               SUM(bookings_attributed) AS bookings
        FROM promotions
        WHERE restaurant_id = ${restaurantId} AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY type
      )
      SELECT * FROM perf
    `);
    const roiByType = new Map<string, { clicks: number; impressions: number; bookings: number }>();
    for (const row of roiRes.rows as any[]) {
      roiByType.set((row as any).type, {
        clicks:      Number((row as any).clicks      ?? 0),
        impressions: Number((row as any).impressions ?? 0),
        bookings:    Number((row as any).bookings    ?? 0),
      });
    }

    const actions: Array<{
      boostType:   string;
      action:      string;
      reason:      string;
      confidence:  number;
      promotionId?: number;
      walletBefore?: number;
      walletAfter?:  number;
    }> = [];

    // 4. Global limit checks
    const dailyLimitHit  = dailyMaxCents  > 0 && todaySpent  >= dailyMaxCents;
    const weeklyLimitHit = weeklyMaxCents > 0 && weekSpent   >= weeklyMaxCents;
    const walletLow      = minWalletCents > 0 && walletCents <= minWalletCents;

    // 5. Score and decide for each allowed boost type
    for (const type of allowedTypes) {
      const hourScore  = BOOST_HOUR_SCORE[type]?.(hour) ?? 0.5;
      const bizScore   = bizWeight[type]              ?? 0.5;
      const hist       = roiByType.get(type)          ?? { clicks: 0, impressions: 0, bookings: 0 };
      const ctr        = hist.impressions > 0 ? hist.clicks / hist.impressions : 0;
      const histScore  = Math.min(1, ctr * 5 + (hist.bookings > 0 ? 0.2 : 0));
      const confidence = Math.round((hourScore * 0.45 + demandScore * 0.30 + bizScore * 0.15 + histScore * 0.10) * 100);

      const isActive   = activeTypes.has(type);

      // ── Pause logic: active boost performing poorly ──────────────────────────
      if (isActive && settings.auto_pause_low_roi && confidence < 30) {
        const activeRow = (activeRes.rows as any[]).find(r => r.type === type);
        if (activeRow) {
          await db.execute(sql`
            UPDATE promotions SET status = 'paused', updated_at = NOW()
            WHERE id = ${activeRow.id} AND status = 'active'
          `);
          await db.execute(sql`
            INSERT INTO auto_campaign_log
              (restaurant_id, action, boost_type, promotion_id, reason, confidence, wallet_before, wallet_after)
            VALUES (${restaurantId}, 'paused', ${type}, ${activeRow.id},
              ${"Schwache Performance — Boost automatisch pausiert (Score " + confidence + "%)"},
              ${confidence}, ${walletEur}, ${walletEur})
          `);
          actions.push({
            boostType: type, action: "paused",
            reason: "Schwache Performance — Boost automatisch pausiert (Score " + confidence + "%)",
            confidence, promotionId: activeRow.id,
          });
        }
        continue;
      }

      // ── Skip if already active and healthy ───────────────────────────────────
      if (isActive) {
        actions.push({
          boostType: type, action: "already_active",
          reason: "Boost bereits aktiv — kein Handlungsbedarf.",
          confidence,
        });
        continue;
      }

      // ── Budget / wallet limit checks ─────────────────────────────────────────
      if (walletLow) {
        await db.execute(sql`
          INSERT INTO auto_campaign_log
            (restaurant_id, action, boost_type, reason, confidence, wallet_before, wallet_after)
          VALUES (${restaurantId}, 'skipped_low_wallet', ${type},
            ${"Guthaben zu niedrig — Mindestguthaben nicht erfüllt"},
            ${confidence}, ${walletEur}, ${walletEur})
        `);
        actions.push({
          boostType: type, action: "skipped_low_wallet",
          reason: "Guthaben zu niedrig — Mindestguthaben nicht erfüllt.",
          confidence,
        });
        continue;
      }
      if (dailyLimitHit) {
        actions.push({
          boostType: type, action: "skipped_budget_limit",
          reason: "Tageslimit erreicht — kein weiterer Boost heute.",
          confidence,
        });
        continue;
      }
      if (weeklyLimitHit) {
        actions.push({
          boostType: type, action: "skipped_budget_limit",
          reason: "Wochenlimit erreicht — kein weiterer Boost diese Woche.",
          confidence,
        });
        continue;
      }

      // ── Low confidence: wait ─────────────────────────────────────────────────
      if (confidence < 65) {
        let waitReason = "Bedingungen nicht optimal — System wartet auf besseres Zeitfenster.";
        if (demandScore < 0.4) waitReason = "Niedrige Nachfrage — Aktivierung verschoben.";
        else if (hourScore < 0.3) waitReason = "Kein optimales Zeitfenster — System wartet.";
        await db.execute(sql`
          INSERT INTO auto_campaign_log
            (restaurant_id, action, boost_type, reason, confidence, wallet_before, wallet_after)
          VALUES (${restaurantId}, 'waiting', ${type}, ${waitReason}, ${confidence}, ${walletEur}, ${walletEur})
        `);
        actions.push({ boostType: type, action: "waiting", reason: waitReason, confidence });
        continue;
      }

      // ── High confidence: activate ────────────────────────────────────────────
      const boostCost = await computeBoostCost(type as BoostType, restaurantId);
      if (walletCents < Math.round(boostCost * 100)) {
        await db.execute(sql`
          INSERT INTO auto_campaign_log
            (restaurant_id, action, boost_type, reason, confidence, wallet_before, wallet_after)
          VALUES (${restaurantId}, 'skipped_low_wallet', ${type},
            ${"Nicht genug Guthaben für Aktivierung (benötigt €" + boostCost.toFixed(2) + ")"},
            ${confidence}, ${walletEur}, ${walletEur})
        `);
        actions.push({
          boostType: type, action: "skipped_low_wallet",
          reason: "Nicht genug Guthaben für Aktivierung (benötigt €" + boostCost.toFixed(2) + ").",
          confidence,
        });
        continue;
      }

      // Atomic activate + wallet deduction (same pattern as manual POST /)
      try {
        const boostLabel = BOOST_TYPES[type as BoostType]?.label ?? type;
        const txResult = await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${restaurantId})`);

          const balResult = await tx.execute(sql`
            SELECT COALESCE(SUM(CASE WHEN type='topup' OR type='refund' THEN amount ELSE -amount END),0) AS balance
            FROM wallet_transactions WHERE restaurant_id = ${restaurantId}
          `);
          const currentBalance = parseFloat((balResult.rows[0] as any)?.balance ?? "0");
          if (currentBalance < boostCost) throw new Error("insufficient_balance");

          // Duplicate guard (within 30s for auto mode)
          const dupCheck = await tx.execute(sql`
            SELECT id FROM promotions
            WHERE restaurant_id = ${restaurantId} AND type = ${type}
              AND status = 'active' AND created_at > NOW() - INTERVAL '30 seconds'
            LIMIT 1
          `);
          if (dupCheck.rows.length > 0) throw new Error("duplicate_activation");

          // Pause any existing active same-type
          await tx.execute(sql`
            UPDATE promotions SET status = 'paused', updated_at = NOW()
            WHERE restaurant_id = ${restaurantId} AND type = ${type} AND status = 'active'
          `);

          const insertResult = await tx.execute(sql`
            INSERT INTO promotions (restaurant_id, type, status)
            VALUES (${restaurantId}, ${type}, 'active')
            RETURNING id, type
          `);
          const promotion = insertResult.rows[0] as { id: number; type: string };

          const newBalance = Math.round((currentBalance - boostCost) * 100) / 100;
          await tx.execute(sql`
            INSERT INTO wallet_transactions
              (restaurant_id, type, amount, description, boost_type, balance_after, promotion_id)
            VALUES (${restaurantId}, 'boost_spend', ${boostCost},
              ${"Auto-Kampagne: " + boostLabel}, ${type}, ${newBalance}, ${promotion.id})
          `);

          return { promotion, balanceBefore: currentBalance, balanceAfter: newBalance };
        });

        const activateReason =
          hourScore  > 0.8 && demandScore > 0.7
            ? "Automatisch aktiviert wegen hoher Nachfrage und optimalem Zeitfenster."
            : hourScore > 0.7
              ? "Automatisch aktiviert wegen optimalem Zeitfenster."
              : "Automatisch aktiviert wegen guter Marktbedingungen.";

        await db.execute(sql`
          INSERT INTO auto_campaign_log
            (restaurant_id, action, boost_type, promotion_id, reason, confidence, wallet_before, wallet_after)
          VALUES (${restaurantId}, 'activated', ${type}, ${txResult.promotion.id},
            ${activateReason}, ${confidence}, ${txResult.balanceBefore}, ${txResult.balanceAfter})
        `);

        actions.push({
          boostType:   type,
          action:      "activated",
          reason:      activateReason,
          confidence,
          promotionId: txResult.promotion.id,
          walletBefore: txResult.balanceBefore,
          walletAfter:  txResult.balanceAfter,
        });

        // Update limits tracking
        todaySpent  += Math.round(boostCost * 100);
        weekSpent   += Math.round(boostCost * 100);
        walletCents -= Math.round(boostCost * 100);
        activeTypes.add(type);
      } catch (innerErr: any) {
        const errReason = innerErr.message === "insufficient_balance"
          ? "Guthaben aufgebraucht — Aktivierung gestoppt."
          : innerErr.message === "duplicate_activation"
            ? "Dieser Boost wurde gerade erst aktiviert — Duplikat verhindert."
            : "Unbekannter Fehler bei der Aktivierung.";
        await db.execute(sql`
          INSERT INTO auto_campaign_log
            (restaurant_id, action, boost_type, reason, confidence, wallet_before, wallet_after)
          VALUES (${restaurantId}, 'error', ${type}, ${errReason}, ${confidence}, ${walletEur}, ${walletEur})
        `);
        actions.push({ boostType: type, action: "error", reason: errReason, confidence });
      }
    }

    return res.json({
      ran:     true,
      actions,
      summary: {
        activated: actions.filter(a => a.action === "activated").length,
        paused:    actions.filter(a => a.action === "paused").length,
        waiting:   actions.filter(a => a.action === "waiting").length,
        skipped:   actions.filter(a => ["skipped_low_wallet","skipped_budget_limit","already_active"].includes(a.action)).length,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Auto-campaign run failed");
    return res.status(500).json({ error: "Auto-Kampagne konnte nicht ausgeführt werden." });
  }
});

export default router;
