/**
 * Wallet API — prepaid boost balance system for business owners.
 *
 * Endpoints:
 *   GET  /api/wallet          — current balance + transaction history
 *   POST /api/wallet/topup    — add credit to wallet (simulated payment)
 *   GET  /api/wallet/cost     — estimated cost for a given boost type
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { computeDynamicPrice } from "../lib/pricing-engine";

const router = Router();

// ── Boost base costs (EUR) — multiplied by demand at runtime ──────────────────
export const BOOST_BASE_COSTS: Record<string, number> = {
  breakfast_boost:  1.50,
  lunch_boost:      2.00,
  happy_hour_boost: 2.00,
  nightlife_boost:  2.50,
  local_spotlight:  1.80,
  local_heat_boost: 1.80,
};

// ── Helper: get current balance for a restaurant ─────────────────────────────

export async function getWalletBalance(restaurantId: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(CASE WHEN type = 'topup' OR type = 'refund' THEN amount ELSE -amount END), 0) AS balance
    FROM wallet_transactions
    WHERE restaurant_id = ${restaurantId}
  `);
  return parseFloat((result.rows[0] as any)?.balance ?? "0");
}

// ── Helper: compute boost cost using live demand ──────────────────────────────

export async function computeBoostCost(boostType: string, restaurantId: number): Promise<number> {
  const baseCost = BOOST_BASE_COSTS[boostType] ?? 2.00;
  try {
    const pricing = await computeDynamicPrice({ restaurantId, boostType });
    const demandMult = pricing.breakdown.demandMultiplier ?? 1.0;
    const cost = Math.round(baseCost * demandMult * 10) / 10;
    return Math.max(0.50, Math.min(9.99, cost));
  } catch {
    return baseCost;
  }
}

// ── GET /api/wallet?restaurantId=X ────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId required" });

    const [balanceResult, txResult] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(SUM(CASE WHEN type = 'topup' OR type = 'refund' THEN amount ELSE -amount END), 0) AS balance
        FROM wallet_transactions WHERE restaurant_id = ${restaurantId}
      `),
      db.execute(sql`
        SELECT id, type, amount, description, boost_type, balance_after, created_at
        FROM wallet_transactions
        WHERE restaurant_id = ${restaurantId}
        ORDER BY created_at DESC
        LIMIT 30
      `),
    ]);

    const balance  = parseFloat((balanceResult.rows[0] as any)?.balance ?? "0");
    const isLow    = balance > 0 && balance < 3.00;
    const isEmpty  = balance <= 0;

    return res.json({
      restaurantId,
      balance:      Math.round(balance * 100) / 100,
      isLow,
      isEmpty,
      transactions: txResult.rows,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch wallet");
    return res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

// ── POST /api/wallet/topup ────────────────────────────────────────────────────

const TopUpSchema = z.object({
  restaurantId: z.number().int().positive(),
  amount:       z.number().min(1).max(500),
});

router.post("/topup", async (req, res) => {
  try {
    const body = TopUpSchema.parse(req.body);

    const currentBalance = await getWalletBalance(body.restaurantId);
    const newBalance     = Math.round((currentBalance + body.amount) * 100) / 100;

    const result = await db.execute(sql`
      INSERT INTO wallet_transactions (restaurant_id, type, amount, description, balance_after)
      VALUES (
        ${body.restaurantId},
        'topup',
        ${body.amount},
        ${"Guthaben aufgeladen: \u20AC" + body.amount.toFixed(2)},
        ${newBalance}
      )
      RETURNING *
    `);

    return res.status(201).json({
      balance:     newBalance,
      transaction: result.rows[0],
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    req.log.error({ err }, "Failed to top up wallet");
    return res.status(500).json({ error: "Top-up failed" });
  }
});

// ── GET /api/wallet/cost?boostType=X&restaurantId=Y ──────────────────────────

router.get("/cost", async (req, res) => {
  try {
    const boostType    = String(req.query.boostType ?? "");
    const restaurantId = Number(req.query.restaurantId ?? 1);

    if (!boostType) return res.status(400).json({ error: "boostType required" });

    const cost = await computeBoostCost(boostType, restaurantId);
    return res.json({ boostType, cost });
  } catch (err) {
    req.log.error({ err }, "Failed to compute cost");
    return res.status(500).json({ error: "Cost computation failed" });
  }
});

export default router;
