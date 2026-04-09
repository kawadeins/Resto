/**
 * Wallet API — prepaid boost balance system for business owners.
 *
 * Endpoints:
 *   GET  /api/wallet               — current balance + transaction history
 *   POST /api/wallet/topup         — create Stripe Checkout for wallet top-up
 *   GET  /api/wallet/topup/verify  — verify topup session after Stripe redirect
 *   GET  /api/wallet/cost          — estimated cost for a given boost type
 *
 * Billing truth: wallet credit is ONLY added by the webhook handler after
 * Stripe confirms successful payment (checkout.session.completed with payment_status=paid).
 * No credit is added directly in this route.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { z } from "zod";
import { computeDynamicPrice } from "../lib/pricing-engine";
import { requireManagerOrAbove } from "../middleware/role-guard";
import { strictLimiter } from "../middleware/rate-limiters";
import { getUncachableStripeClient } from "../stripeClient";

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

// ── GET /api/wallet?restaurantId=X ───────────────────────────────────────────
// Requires manager-or-above auth: wallet balance is sensitive business data.

router.get("/", requireManagerOrAbove(), async (req, res) => {
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
// Creates a Stripe Checkout Session for a one-time wallet top-up payment.
// Returns {checkoutUrl} — frontend redirects to Stripe.
// Credit is ONLY added after verified payment via webhook (checkout.session.completed).
// Rate-limited: max 20 top-up sessions per 15 minutes per user.

const ALLOWED_TOPUP_AMOUNTS = [5, 10, 20, 50] as const;
type AllowedAmount = typeof ALLOWED_TOPUP_AMOUNTS[number];

// ── Wallet top-up price IDs (environment-aware) ───────────────────────────────
const IS_PRODUCTION = process.env.REPLIT_DEPLOYMENT === "1";

const WALLET_PRICE_MAP_TEST: Record<AllowedAmount, string> = {
  5:  "price_1TK5glAgY8yJ0qgTReaHz2z6",
  10: "price_1TK5gmAgY8yJ0qgT1fgsk1Q4",
  20: "price_1TK5gmAgY8yJ0qgTox5IbVhe",
  50: "price_1TK5gmAgY8yJ0qgTlTgR4k46",
};

const WALLET_PRICE_MAP_LIVE: Record<AllowedAmount, string> = {
  5:  "price_1TK85zDq06OMDnUjwib9ALyb",
  10: "price_1TK86iDq06OMDnUjlGz1JfYl",
  20: "price_1TK87FDq06OMDnUjz3TfwCgI",
  50: "price_1TK88CDq06OMDnUjiu6n5Sx7",
};

const WALLET_PRICE_MAP = IS_PRODUCTION ? WALLET_PRICE_MAP_LIVE : WALLET_PRICE_MAP_TEST;

const TopUpSchema = z.object({
  restaurantId: z.number().int().positive(),
  amount:       z.number().refine(
    (n): n is AllowedAmount => (ALLOWED_TOPUP_AMOUNTS as readonly number[]).includes(n),
    { message: "Betrag muss 5, 10, 20 oder 50 EUR sein." }
  ),
});

function getFrontendBase(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  return `https://${domain}/restosmart`;
}

router.post("/topup", strictLimiter, requireManagerOrAbove(), async (req, res) => {
  try {
    const body = TopUpSchema.parse(req.body);
    const stripe = await getUncachableStripeClient();
    const frontendBase = getFrontendBase();

    // Find or reuse Stripe customer for this restaurant
    const subRows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, body.restaurantId));
    const existingSub = subRows[0];
    let customerId: string | undefined = existingSub?.stripeCustomerId ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { restaurant_id: String(body.restaurantId), platform: "restosmart" },
      });
      customerId = customer.id;

      if (existingSub) {
        await db.update(subscriptionsTable)
          .set({ stripeCustomerId: customerId })
          .where(eq(subscriptionsTable.restaurantId, body.restaurantId));
      }
    }

    // Resolve price ID from static environment-aware map (no dynamic Stripe lookup)
    const priceId = WALLET_PRICE_MAP[body.amount as AllowedAmount];

    // Create one-time Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${frontendBase}/billing?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBase}/billing?topup=cancel`,
      metadata: {
        restaurant_id: String(body.restaurantId),
        type: "wallet_topup",
        topup_amount: String(body.amount),
        platform: "restosmart",
      },
    });

    req.log.info({ sessionId: session.id, amount: body.amount, restaurantId: body.restaurantId }, "Wallet topup Stripe checkout created");

    return res.status(201).json({
      checkoutUrl: session.url,
      sessionId: session.id,
      amount: body.amount,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    req.log.error({ err }, "Failed to create wallet topup checkout");
    return res.status(500).json({ error: "Guthaben konnte nicht aufgeladen werden. Bitte versuchen Sie es erneut." });
  }
});

// ── GET /api/wallet/topup/verify?session_id=cs_xxx ───────────────────────────
// Called after returning from Stripe topup success URL.
// Webhook is the true source of credit — this just returns current DB balance.

router.get("/topup/verify", requireManagerOrAbove(), async (req, res) => {
  try {
    const sessionId = req.query.session_id as string;
    const restaurantId = Number(req.query.restaurantId ?? 1);

    if (!sessionId) return void res.status(400).json({ error: "session_id required" });

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const currentBalance = await getWalletBalance(restaurantId);

    res.json({
      stripeStatus: session.payment_status,
      balance: Math.round(currentBalance * 100) / 100,
      isPaid: session.payment_status === "paid",
      message: session.payment_status === "paid"
        ? "Zahlung erfolgreich — Guthaben wird in K\u00fcrze gutgeschrieben"
        : "Zahlung wird noch verarbeitet",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to verify topup session");
    res.status(500).json({ error: "Verifizierung fehlgeschlagen" });
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
