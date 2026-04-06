/**
 * Pricing API — dynamic boost pricing endpoints.
 *
 *  GET  /api/pricing/current      — current dynamic price for the pilot restaurant
 *  GET  /api/pricing/config       — founder-only: get pricing config
 *  PUT  /api/pricing/config       — founder-only: update pricing config
 *  GET  /api/pricing/schedule     — pricing forecast for the next 24 hours
 *  GET  /api/pricing/suggestions  — AI smart suggestions for optimal boosting
 *  POST /api/pricing/auto-optimize — toggle auto-optimize mode
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  computeDynamicPrice,
  getPricingConfig,
  savePricingConfig,
  generateSmartSuggestions,
  generateScheduleData,
} from "../lib/pricing-engine";

const router = Router();

const FOUNDER_KEY = "rs_founder_2026";

// ─── GET /api/pricing/current ─────────────────────────────────────────────────
router.get("/current", async (req, res) => {
  try {
    const restResult = await db.execute(sql`
      SELECT id, name, business_type, district FROM restaurants WHERE is_active = true ORDER BY id ASC LIMIT 1
    `);
    const restaurant = restResult.rows[0] as { id: number; name: string; business_type: string; district?: number } | undefined;
    if (!restaurant) return res.status(404).json({ error: "No restaurant found" });

    const bizType = restaurant.business_type ?? "restaurant";
    const district = restaurant.district ?? (parseInt(req.query.district as string) || undefined);
    const pricing = await computeDynamicPrice(bizType, district);

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
router.get("/schedule", async (req, res) => {
  try {
    const restResult = await db.execute(sql`
      SELECT business_type FROM restaurants WHERE is_active = true ORDER BY id ASC LIMIT 1
    `);
    const restaurant = restResult.rows[0] as { business_type: string } | undefined;
    const bizType = restaurant?.business_type ?? "restaurant";

    const config = await getPricingConfig();
    const schedule = await generateScheduleData(bizType, config);

    return res.json({ businessType: bizType, schedule });
  } catch (err) {
    req.log.error({ err }, "Failed to generate pricing schedule");
    return res.status(500).json({ error: "Failed to generate schedule" });
  }
});

// ─── GET /api/pricing/suggestions — AI smart suggestions ────────────────────
router.get("/suggestions", async (req, res) => {
  try {
    const restResult = await db.execute(sql`
      SELECT business_type, district FROM restaurants WHERE is_active = true ORDER BY id ASC LIMIT 1
    `);
    const restaurant = restResult.rows[0] as { business_type: string; district?: number } | undefined;
    const bizType = restaurant?.business_type ?? "restaurant";
    const district = restaurant?.district ?? (parseInt(req.query.district as string) || undefined);

    const suggestions = await generateSmartSuggestions(bizType, district);
    return res.json({ businessType: bizType, suggestions });
  } catch (err) {
    req.log.error({ err }, "Failed to generate suggestions");
    return res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

// ─── POST /api/pricing/auto-optimize — toggle auto-optimize mode ────────────
router.post("/auto-optimize", async (req, res) => {
  try {
    const { restaurantId, enabled } = req.body;
    if (!restaurantId) return res.status(400).json({ error: "restaurantId required" });

    await db.execute(sql`
      INSERT INTO platform_config (key, value, updated_at)
      VALUES (${`auto_optimize_${restaurantId}`}, ${JSON.stringify({ enabled: !!enabled })}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify({ enabled: !!enabled })}::jsonb, updated_at = NOW()
    `);

    if (enabled) {
      const restResult = await db.execute(sql`
        SELECT business_type, district FROM restaurants WHERE id = ${restaurantId} LIMIT 1
      `);
      const rest = restResult.rows[0] as { business_type?: string; district?: number } | undefined;
      const bizType = rest?.business_type ?? "restaurant";
      const district = rest?.district ?? undefined;

      const suggestions = await generateSmartSuggestions(bizType, district);
      return res.json({
        ok: true,
        enabled: true,
        message: "Automatische Optimierung aktiviert",
        activeSuggestions: suggestions.filter(s => s.priority === "high").length,
      });
    }

    return res.json({ ok: true, enabled: false, message: "Automatische Optimierung deaktiviert" });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle auto-optimize");
    return res.status(500).json({ error: "Failed to toggle" });
  }
});

// ─── GET /api/pricing/auto-optimize — get auto-optimize status ──────────────
router.get("/auto-optimize", async (req, res) => {
  try {
    const restaurantId = parseInt(req.query.restaurantId as string) || 1;
    const result = await db.execute(sql`
      SELECT value FROM platform_config WHERE key = ${`auto_optimize_${restaurantId}`} LIMIT 1
    `);
    const config = result.rows[0] ? (result.rows[0] as any).value : { enabled: false };
    return res.json({ restaurantId, ...config });
  } catch (err) {
    return res.json({ restaurantId: 1, enabled: false });
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
  maxPrice:          z.number().min(0.005).max(0.10).optional(),
  maxChangePercent:  z.number().min(5).max(100).optional(),
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
