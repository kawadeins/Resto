import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, restaurantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireOwner } from "../middleware/role-guard";

async function getRestaurantPilotMode(): Promise<boolean> {
  try {
    const [r] = await db.select({ pilotMode: restaurantsTable.pilotMode }).from(restaurantsTable).where(eq(restaurantsTable.id, 1));
    return r?.pilotMode ?? false;
  } catch { return false; }
}

const router = Router();

const TRIAL_DAYS = 14;

function mapSub(s: typeof subscriptionsTable.$inferSelect) {
  const now = new Date();
  const isTrial = s.status === "trial";
  const isExpiredTrial = s.status === "expired";
  const isActive = s.status === "active" || (isTrial && !!s.currentPeriodEnd && new Date(s.currentPeriodEnd) > now);
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
    isTrial,
    isExpiredTrial,
    trialDaysRemaining: isTrial ? daysRemaining : null,
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
    const now = new Date();
    let rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, 1));

    if (rows.length === 0) {
      const [created] = await db.insert(subscriptionsTable).values({ restaurantId: 1, status: "inactive" }).returning();
      const mapped = mapSub(created);
      return void res.json({ ...mapped, isPilot, isActive: isPilot || mapped.isActive });
    }

    // Auto-expire trial if past end date
    if (rows[0].status === "trial" && rows[0].currentPeriodEnd && new Date(rows[0].currentPeriodEnd) < now) {
      const [expired] = await db.update(subscriptionsTable)
        .set({ status: "expired" })
        .where(eq(subscriptionsTable.restaurantId, 1))
        .returning();
      rows = [expired];
    }

    const mapped = mapSub(rows[0]);
    res.json({ ...mapped, isPilot, isActive: isPilot || mapped.isActive });
  } catch (err) {
    req.log.error({ err }, "Failed to get subscription");
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

// POST /api/billing/trial — start 14-day free trial (once per restaurant)
router.post("/trial", requireOwner(), async (req, res) => {
  try {
    const rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, 1));
    const existing = rows[0];

    if (existing) {
      if (existing.status === "active") {
        return void res.status(400).json({ error: "already_active", message: "Sie haben bereits ein aktives Abonnement." });
      }
      if (existing.status === "trial") {
        return void res.status(400).json({ error: "trial_active", message: "Ihre Testphase ist bereits aktiv." });
      }
      if (existing.status === "expired") {
        return void res.status(400).json({ error: "trial_used", message: "Ihre Testphase wurde bereits genutzt. Bitte abonnieren Sie f\u00fcr vollen Zugang." });
      }
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    let sub;
    if (!existing) {
      [sub] = await db.insert(subscriptionsTable).values({
        restaurantId: 1,
        status: "trial",
        planName: "RestoSmart Business Premium",
        amountEur: "0.00",
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      }).returning();
    } else {
      [sub] = await db.update(subscriptionsTable)
        .set({
          status: "trial",
          planName: "RestoSmart Business Premium",
          amountEur: "0.00",
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          cancelledAt: null,
        })
        .where(eq(subscriptionsTable.restaurantId, 1))
        .returning();
    }

    res.json({
      success: true,
      subscription: mapSub(sub),
      trialEndDate: trialEnd.toISOString(),
      trialDays: TRIAL_DAYS,
      message: `${TRIAL_DAYS}-Tage Testphase erfolgreich gestartet`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to start trial");
    res.status(500).json({ error: "Failed to start trial" });
  }
});

// POST /api/billing/checkout — activate full subscription (from trial or direct)
router.post("/checkout", requireOwner(), async (req, res) => {
  try {
    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, 1));
    let sub;
    if (rows.length === 0) {
      [sub] = await db.insert(subscriptionsTable).values({
        restaurantId: 1,
        status: "active",
        planName: "RestoSmart Business Premium",
        amountEur: "39.90",
        stripeSessionId: sessionId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      }).returning();
    } else {
      [sub] = await db.update(subscriptionsTable)
        .set({
          status: "active",
          planName: "RestoSmart Business Premium",
          amountEur: "39.90",
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
router.post("/cancel", requireOwner(), async (req, res) => {
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
