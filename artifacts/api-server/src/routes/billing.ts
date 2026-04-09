/**
 * billing.ts — Real Stripe billing routes
 *
 * POST /api/billing/checkout          → create Stripe Checkout Session for subscription
 * POST /api/billing/trial             → start 14-day free trial
 * GET  /api/billing/subscription      → get current subscription from DB
 * GET  /api/billing/verify-session    → verify a Stripe Checkout Session
 * POST /api/billing/cancel            → cancel subscription (Stripe + DB)
 * GET  /api/billing/portal            → create Stripe Customer Portal session
 *
 * Billing truth: ALL state changes come from Stripe webhooks (webhookHandlers.ts).
 * Checkout route ONLY creates the session and redirects — it does NOT activate Premium.
 * The webhook checkout.session.completed event activates Premium after verified payment.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, restaurantsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireOwner } from "../middleware/role-guard";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";

async function getRestaurantPilotMode(): Promise<boolean> {
  try {
    const [r] = await db.select({ pilotMode: restaurantsTable.pilotMode }).from(restaurantsTable).where(eq(restaurantsTable.id, 1));
    return r?.pilotMode ?? false;
  } catch { return false; }
}

function getFrontendBase(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  return `https://${domain}/restosmart`;
}

const router = Router();
const TRIAL_DAYS = 14;

function mapSub(s: typeof subscriptionsTable.$inferSelect) {
  const now = new Date();
  const isTrial = s.status === "trial";
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
    isExpiredTrial: s.status === "expired",
    isPastDue: s.status === "past_due",
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

// GET /api/billing/subscription
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

// POST /api/billing/trial
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

// POST /api/billing/checkout — create real Stripe Checkout Session for subscription
// Returns {url} — frontend must redirect to this URL.
// Premium is NOT activated here; it is activated by the webhook after confirmed payment.
router.post("/checkout", requireOwner(), async (req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const frontendBase = getFrontendBase();
    const ownerEmail = req.headers["x-user-email"] as string | undefined;

    // Find or create Stripe customer linked to this restaurant
    const rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, 1));
    const existing = rows[0];
    let customerId: string | undefined = existing?.stripeCustomerId ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ownerEmail ?? undefined,
        metadata: { restaurant_id: "1", platform: "restosmart" },
      });
      customerId = customer.id;

      // Persist customer ID immediately so we can link webhook events
      if (existing) {
        await db.update(subscriptionsTable)
          .set({ stripeCustomerId: customerId })
          .where(eq(subscriptionsTable.restaurantId, 1));
      } else {
        await db.insert(subscriptionsTable).values({
          restaurantId: 1,
          status: "inactive",
          stripeCustomerId: customerId,
        });
      }
    }

    // Live Stripe price ID for RestoSmart Business Premium (€39.90/month)
    const PREMIUM_PRICE_ID = "price_1TK7DxDq06OMDnUjYnSnpUY3";

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: PREMIUM_PRICE_ID, quantity: 1 }],
      mode: "subscription",
      success_url: `${frontendBase}/billing?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBase}/billing?stripe=cancel`,
      metadata: {
        restaurant_id: "1",
        type: "subscription",
        platform: "restosmart",
      },
      subscription_data: {
        metadata: { restaurant_id: "1", platform: "restosmart" },
      },
      allow_promotion_codes: true,
    });

    req.log.info({ sessionId: session.id, customerId }, "Stripe checkout session created");

    res.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to create Stripe checkout session");
    res.status(500).json({ error: "Zahlung konnte nicht gestartet werden. Bitte versuchen Sie es erneut." });
  }
});

// GET /api/billing/verify-session?session_id=cs_xxx
// Called by the billing page on return from Stripe success URL to confirm pending status.
// Actual activation comes from webhook — this just returns current DB state.
router.get("/verify-session", async (req, res) => {
  try {
    const sessionId = req.query.session_id as string;
    if (!sessionId) return void res.status(400).json({ error: "session_id required" });

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, 1));
    const sub = rows[0];

    res.json({
      stripeStatus: session.payment_status,
      stripeMode: session.mode,
      subscriptionStatus: sub?.status ?? "inactive",
      isActive: sub?.status === "active",
      isPending: session.payment_status === "unpaid",
      message: session.payment_status === "paid"
        ? "Zahlung erfolgreich"
        : "Zahlung wird verarbeitet",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to verify session");
    res.status(500).json({ error: "Session-Verifizierung fehlgeschlagen" });
  }
});

// GET /api/billing/portal — Stripe Customer Portal for managing subscription
router.get("/portal", requireOwner(), async (req, res) => {
  try {
    const rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, 1));
    const sub = rows[0];
    const customerId = sub?.stripeCustomerId;

    if (!customerId) {
      return void res.status(400).json({ error: "Kein Stripe-Kundenkonto gefunden." });
    }

    const stripe = await getUncachableStripeClient();
    const frontendBase = getFrontendBase();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendBase}/billing`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    req.log.error({ err }, "Failed to create portal session");
    res.status(500).json({ error: "Kundenportal konnte nicht gestartet werden." });
  }
});

// POST /api/billing/cancel — cancel Stripe subscription + update DB
router.post("/cancel", requireOwner(), async (req, res) => {
  try {
    const rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, 1));
    const sub = rows[0];

    if (!sub) {
      return void res.status(400).json({ error: "Kein Abonnement gefunden." });
    }

    // Cancel in Stripe if we have a subscription ID
    if (sub.stripeSubscriptionId) {
      try {
        const stripe = await getUncachableStripeClient();
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        req.log.info({ stripeSubscriptionId: sub.stripeSubscriptionId }, "Stripe subscription cancelled");
      } catch (err) {
        req.log.warn({ err }, "Could not cancel Stripe subscription — continuing with DB cancel");
      }
    }

    const [updated] = await db.update(subscriptionsTable)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(subscriptionsTable.restaurantId, 1))
      .returning();

    res.json({ success: true, subscription: mapSub(updated) });
  } catch (err) {
    req.log.error({ err }, "Failed to cancel subscription");
    res.status(500).json({ error: "K\u00fcndigung fehlgeschlagen" });
  }
});

// GET /api/billing/publishable-key — returns Stripe publishable key for frontend
router.get("/publishable-key", async (_req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (err) {
    res.status(500).json({ error: "Could not retrieve publishable key" });
  }
});

export default router;
