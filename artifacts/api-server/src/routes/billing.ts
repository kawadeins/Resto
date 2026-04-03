import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, restaurantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

async function getRestaurantPilotMode(): Promise<boolean> {
  try {
    const [r] = await db.select({ pilotMode: restaurantsTable.pilotMode }).from(restaurantsTable).where(eq(restaurantsTable.id, 1));
    return r?.pilotMode ?? false;
  } catch { return false; }
}

const router = Router();

function mapSub(s: typeof subscriptionsTable.$inferSelect) {
  const now = new Date();
  const isActive = s.status === "active" || s.status === "trial";
  const daysRemaining = s.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(s.currentPeriodEnd).getTime() - now.getTime()) / 86400000))
    : null;

  return {
    id: s.id,
    restaurantId: s.restaurantId,
    status: s.status,
    planName: s.planName,
    amountEur: parseFloat(s.amountEur),
    isActive,
    stripeSessionId: s.stripeSessionId,
    stripeCustomerId: s.stripeCustomerId,
    stripeSubscriptionId: s.stripeSubscriptionId,
    currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    daysRemaining,
    cancelledAt: s.cancelledAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

// GET /api/billing/subscription — get current subscription for restaurant 1
router.get("/subscription", async (req, res) => {
  try {
    const isPilot = await getRestaurantPilotMode();
    let rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, 1));
    if (rows.length === 0) {
      const [created] = await db.insert(subscriptionsTable).values({ restaurantId: 1, status: "inactive" }).returning();
      const mapped = mapSub(created);
      return void res.json({ ...mapped, isPilot, isActive: isPilot || mapped.isActive });
    }
    const mapped = mapSub(rows[0]);
    res.json({ ...mapped, isPilot, isActive: isPilot || mapped.isActive });
  } catch (err) {
    req.log.error({ err }, "Failed to get subscription");
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

// POST /api/billing/checkout — initiate mock Stripe-style checkout
router.post("/checkout", async (req, res) => {
  try {
    // In test mode: immediately activate subscription with a simulated session ID
    // When real Stripe is wired, replace this with Stripe Checkout Session creation
    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, 1));
    let sub;
    if (rows.length === 0) {
      [sub] = await db.insert(subscriptionsTable).values({
        restaurantId: 1,
        status: "active",
        stripeSessionId: sessionId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      }).returning();
    } else {
      [sub] = await db.update(subscriptionsTable)
        .set({
          status: "active",
          stripeSessionId: sessionId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelledAt: null,
        })
        .where(eq(subscriptionsTable.restaurantId, 1))
        .returning();
    }

    res.json({
      success: true,
      sessionId,
      subscription: mapSub(sub),
      message: "Subscription activated successfully (test mode)",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// POST /api/billing/cancel — cancel subscription
router.post("/cancel", async (req, res) => {
  try {
    const [sub] = await db.update(subscriptionsTable)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(subscriptionsTable.restaurantId, 1))
      .returning();
    res.json({ success: true, subscription: mapSub(sub) });
  } catch (err) {
    req.log.error({ err }, "Failed to cancel subscription");
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

export default router;
