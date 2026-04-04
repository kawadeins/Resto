/**
 * Pricing API — dynamic boost pricing endpoints.
 *
 *  GET  /api/pricing/current   — current dynamic price for the pilot restaurant
 *  GET  /api/pricing/config    — founder-only: get pricing config
 *  PUT  /api/pricing/config    — founder-only: update pricing config
 *  GET  /api/pricing/schedule  — pricing forecast for the next 24 hours
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { computeDynamicPrice, getPricingConfig, savePricingConfig } from "../lib/pricing-engine";

const router = Router();

const FOUNDER_KEY = "rs_founder_2026";

// ─── GET /api/pricing/current ─────────────────────────────────────────────────
// Returns current dynamic pricing for the pilot restaurant.
// Single-tenant: auto-discovers the first active restaurant.
router.get("/current", async (req, res) => {
  try {
    const restResult = await db.execute(sql`
      SELECT id, name, business_type FROM restaurants WHERE is_active = true ORDER BY id ASC LIMIT 1
    `);
    const restaurant = restResult.rows[0] as { id: number; name: string; business_type: string } | undefined;
    if (!restaurant) return res.status(404).json({ error: "No restaurant found" });

    const bizType = restaurant.business_type ?? "restaurant";
    const pricing = await computeDynamicPrice(bizType);

    return res.json({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      businessType: bizType,
      ...pricing,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to compute dynamic price");
    return res.status(500).json({ error: "Failed to compute price" });
  }
});

// ─── GET /api/pricing/schedule — 24-hour price forecast ──────────────────────
// Shows how the price will change over the next 24 hours for planning.
router.get("/schedule", async (req, res) => {
  try {
    const restResult = await db.execute(sql`
      SELECT business_type FROM restaurants WHERE is_active = true ORDER BY id ASC LIMIT 1
    `);
    const restaurant = restResult.rows[0] as { business_type: string } | undefined;
    const bizType = restaurant?.business_type ?? "restaurant";

    const config = await getPricingConfig();

    // Simulate 24 hours (0..23) with current demand signal
    const totalResult = await db.execute(sql`
      SELECT COUNT(*) AS count FROM promotions
      WHERE status = 'active' AND (ends_at IS NULL OR ends_at > NOW())
    `);
    const activePlatformBoosts = parseInt((totalResult.rows[0] as any)?.count ?? "0");

    // Import time multiplier logic inline for schedule generation
    function timeMultForHour(h: number): number {
      if (bizType === "cafe") {
        if (h >= 6 && h < 10) return 0.80;
        if (h >= 10 && h < 14) return 1.00;
        if (h >= 14 && h < 18) return 0.90;
        if (h >= 18 && h < 22) return 1.15;
        return 1.20;
      }
      if (bizType === "bar") {
        if (h >= 6 && h < 12) return 0.70;
        if (h >= 12 && h < 17) return 0.85;
        if (h >= 17 && h < 20) return 1.20;
        if (h >= 20 && h < 24) return 1.50;
        return 1.35;
      }
      // restaurant
      if (h >= 6 && h < 9) return 0.85;
      if (h >= 9 && h < 11) return 0.95;
      if (h >= 11 && h < 14) return 1.30;
      if (h >= 14 && h < 17) return 1.00;
      if (h >= 17 && h < 21) return 1.35;
      if (h >= 21) return 1.10;
      return 0.90;
    }

    function demandMult(n: number): number {
      const t = config.demandThresholds;
      const adj = n * config.demandSensitivity;
      if (adj <= t.low) return 0.80;
      if (adj <= t.normal) return 1.00;
      if (adj <= t.high) return 1.25;
      if (adj <= t.very_high) return 1.45;
      return 1.60;
    }

    const dMult = demandMult(activePlatformBoosts);

    const schedule = Array.from({ length: 24 }, (_, h) => {
      const tMult = timeMultForHour(h);
      const rawMult = dMult * tMult;
      const totalMult = Math.min(rawMult, config.maxMultiplier);
      const price = Math.max(config.minPrice, Math.round(config.basePrice * totalMult * 10000) / 10000);
      const level =
        totalMult >= 1.35 ? "very_high" :
        totalMult >= 1.10 ? "high" :
        totalMult < 0.90  ? "low" : "normal";
      return { hour: h, pricePerImpression: price, pricePer1000: Math.round(price * 1000 * 100) / 100, level };
    });

    return res.json({ businessType: bizType, schedule });
  } catch (err) {
    req.log.error({ err }, "Failed to generate pricing schedule");
    return res.status(500).json({ error: "Failed to generate schedule" });
  }
});

// ─── GET /api/pricing/config — founder only ───────────────────────────────────
router.get("/config", async (req, res) => {
  if (req.headers["x-founder-key"] !== FOUNDER_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const config = await getPricingConfig();
    return res.json(config);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch pricing config");
    return res.status(500).json({ error: "Failed to fetch config" });
  }
});

// ─── PUT /api/pricing/config — founder only ───────────────────────────────────
const ConfigSchema = z.object({
  basePrice:         z.number().min(0.001).max(0.10).optional(),
  maxMultiplier:     z.number().min(1.0).max(5.0).optional(),
  minPrice:          z.number().min(0.001).max(0.05).optional(),
  demandSensitivity: z.number().min(0.1).max(3.0).optional(),
  demandThresholds:  z.object({
    low:       z.number().min(0).max(100),
    normal:    z.number().min(0).max(100),
    high:      z.number().min(0).max(100),
    very_high: z.number().min(0).max(100),
  }).optional(),
});

router.put("/config", async (req, res) => {
  if (req.headers["x-founder-key"] !== FOUNDER_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const patch = ConfigSchema.parse(req.body);
    const updated = await savePricingConfig(patch);
    return res.json({ ok: true, config: updated });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    req.log.error({ err }, "Failed to update pricing config");
    return res.status(500).json({ error: "Failed to update config" });
  }
});

export default router;
