/**
 * Pilot Mode API
 * Manages the real-world launch program for 5–10 restaurants.
 * Super-admin endpoints require X-Super-Admin-Key header.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  restaurantsTable,
  reservationsTable,
  menuItemsTable,
  discountsTable,
  loyaltyPointsTable,
  pilotFeedbackTable,
  campaignsTable,
} from "@workspace/db";
import { eq, gte, sql, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const SUPER_ADMIN_KEY = process.env.SUPER_ADMIN_KEY ?? "restosmart-super-2025";

function requireSuperAdmin(req: any, res: any): boolean {
  const key = req.headers["x-super-admin-key"];
  if (key !== SUPER_ADMIN_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

// ─── Pilot readiness check ────────────────────────────────────────────────────
async function getPilotReadiness(restaurantId: number) {
  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId));

  if (!restaurant) return null;

  // Count menu items (single-restaurant system — no restaurantId filter needed)
  const menuItems = await db.select().from(menuItemsTable);

  // Count discounts
  const discounts = await db.select().from(discountsTable);

  // Count bookings for this restaurant (all reservations for now, since system is single-restaurant)
  const bookings = await db.select().from(reservationsTable);

  // Count total unique customers
  const loyaltyRows = await db.select().from(loyaltyPointsTable);

  // Compute 24h activity alert
  let is24hAlert = false;
  if (restaurant.pilotMode && restaurant.pilotActivatedAt) {
    const hoursSinceActivation =
      (Date.now() - new Date(restaurant.pilotActivatedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceActivation >= 24) {
      // Check if any bookings were made after activation
      const bookingsAfterActivation = bookings.filter(
        (b) => new Date(b.createdAt) >= new Date(restaurant.pilotActivatedAt!)
      );
      is24hAlert = bookingsAfterActivation.length === 0;
    }
  }

  // Readiness criteria (5 steps)
  const criteria = {
    restaurantInfoFilled: !!(restaurant.name && restaurant.address && restaurant.phone && restaurant.email),
    menuItemsAdded: menuItems.length >= 3,
    bookingEnabled: restaurant.bookingsEnabled,
    discountCreated: discounts.length >= 1,
    firstBookingReceived: bookings.length >= 1,
  };

  const completedCount = Object.values(criteria).filter(Boolean).length;
  const readinessScore = Math.round((completedCount / 5) * 100);
  const isPilotActive = restaurant.pilotMode && readinessScore >= 80;

  return {
    pilotMode: restaurant.pilotMode,
    pilotActivatedAt: restaurant.pilotActivatedAt?.toISOString() ?? null,
    isPilotActive,
    is24hAlert,
    readinessScore,
    criteria,
    totalBookings: bookings.length,
    totalCustomers: loyaltyRows.length,
    restaurantName: restaurant.name,
  };
}

// ─── GET /api/pilot/status — owner dashboard ──────────────────────────────────
router.get("/status", async (req, res) => {
  try {
    const data = await getPilotReadiness(1);
    if (!data) return void res.status(404).json({ error: "Restaurant not found" });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to get pilot status");
    res.status(500).json({ error: "Failed to get pilot status" });
  }
});

// ─── POST /api/pilot/feedback — submit feedback (owner) ──────────────────────
const FeedbackBody = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  message: z.string().min(1),
  category: z.enum(["bookings", "revenue", "marketing", "general"]).optional().default("general"),
});

router.post("/feedback", async (req, res) => {
  try {
    const body = FeedbackBody.parse(req.body);
    const [created] = await db
      .insert(pilotFeedbackTable)
      .values({
        restaurantId: 1,
        rating: body.rating ?? null,
        message: body.message,
        category: body.category,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to submit feedback");
    res.status(400).json({ error: "Failed to submit feedback" });
  }
});

// ─── GET /api/pilot/feedback — get feedback (owner sees own) ─────────────────
router.get("/feedback", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(pilotFeedbackTable)
      .where(eq(pilotFeedbackTable.restaurantId, 1))
      .orderBy(desc(pilotFeedbackTable.createdAt))
      .limit(20);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to get feedback" });
  }
});

// ─── POST /api/pilot/activate — super-admin: activate pilot ──────────────────
router.post("/activate", async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;
  try {
    const { restaurantId } = z.object({ restaurantId: z.number() }).parse(req.body);
    const [updated] = await db
      .update(restaurantsTable)
      .set({ pilotMode: true, pilotActivatedAt: new Date() })
      .where(eq(restaurantsTable.id, restaurantId))
      .returning();
    res.json({ ok: true, restaurant: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to activate pilot" });
  }
});

// ─── POST /api/pilot/deactivate — super-admin: deactivate pilot ──────────────
router.post("/deactivate", async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;
  try {
    const { restaurantId } = z.object({ restaurantId: z.number() }).parse(req.body);
    const [updated] = await db
      .update(restaurantsTable)
      .set({ pilotMode: false, pilotActivatedAt: null })
      .where(eq(restaurantsTable.id, restaurantId))
      .returning();
    res.json({ ok: true, restaurant: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to deactivate pilot" });
  }
});

// ─── GET /api/pilot/dashboard — super-admin pilot overview ───────────────────
router.get("/dashboard", async (req, res) => {
  if (!requireSuperAdmin(req, res)) return;
  try {
    const restaurants = await db.select().from(restaurantsTable);
    const bookings = await db.select().from(reservationsTable);
    const feedbackRows = await db
      .select()
      .from(pilotFeedbackTable)
      .orderBy(desc(pilotFeedbackTable.createdAt))
      .limit(50);
    const campaigns = await db.select().from(campaignsTable);

    const pilotRestaurants = restaurants.filter((r) => r.pilotMode);
    const activeRestaurants = pilotRestaurants.filter((r) => {
      if (!r.pilotActivatedAt) return false;
      const hoursSince = (Date.now() - new Date(r.pilotActivatedAt).getTime()) / (1000 * 60 * 60);
      // "Active" = activated within 30 days
      return hoursSince <= 720;
    });

    // Total bookings since any pilot was activated
    const earliestActivation = pilotRestaurants
      .filter((r) => r.pilotActivatedAt)
      .map((r) => new Date(r.pilotActivatedAt!))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const pilotBookings = earliestActivation
      ? bookings.filter((b) => new Date(b.createdAt) >= earliestActivation)
      : [];

    // Revenue impact (rough estimate: avg 2 covers × £35 per cover per arrived booking)
    const arrivedPilotBookings = pilotBookings.filter((b) => b.status === "arrived");
    const estimatedRevenue = arrivedPilotBookings.reduce(
      (sum, b) => sum + b.partySize * 35,
      0
    );

    // Repeat customers
    const emailCounts = new Map<string, number>();
    pilotBookings.forEach((b) => {
      emailCounts.set(b.customerEmail, (emailCounts.get(b.customerEmail) ?? 0) + 1);
    });
    const repeatCustomers = [...emailCounts.values()].filter((c) => c >= 2).length;

    // Per-restaurant metrics
    const restaurantMetrics = await Promise.all(
      pilotRestaurants.map(async (r) => {
        const rBookings = bookings; // Single-restaurant system
        const rMenuItems = await db.select().from(menuItemsTable);
        const rDiscounts = await db.select().from(discountsTable);
        const rFeedback = feedbackRows.filter((f) => f.restaurantId === r.id);

        const readiness = await getPilotReadiness(r.id);
        const hoursSinceActivation = r.pilotActivatedAt
          ? (Date.now() - new Date(r.pilotActivatedAt).getTime()) / (1000 * 60 * 60)
          : null;

        const bookingsAfterActivation = r.pilotActivatedAt
          ? rBookings.filter((b) => new Date(b.createdAt) >= new Date(r.pilotActivatedAt!))
          : [];

        return {
          id: r.id,
          name: r.name,
          pilotMode: r.pilotMode,
          pilotActivatedAt: r.pilotActivatedAt?.toISOString() ?? null,
          hoursSinceActivation: hoursSinceActivation ? Math.round(hoursSinceActivation) : null,
          readinessScore: readiness?.readinessScore ?? 0,
          bookings: bookingsAfterActivation.length,
          arrivedBookings: bookingsAfterActivation.filter((b) => b.status === "arrived").length,
          menuItemCount: rMenuItems.length,
          discountCount: rDiscounts.length,
          estimatedRevenue: bookingsAfterActivation
            .filter((b) => b.status === "arrived")
            .reduce((sum, b) => sum + b.partySize * 35, 0),
          feedbackCount: rFeedback.length,
          avgRating:
            rFeedback.filter((f) => f.rating).length > 0
              ? Math.round(
                  (rFeedback.reduce((s, f) => s + (f.rating ?? 0), 0) /
                    rFeedback.filter((f) => f.rating).length) *
                    10
                ) / 10
              : null,
          is24hAlert: readiness?.is24hAlert ?? false,
          criteria: readiness?.criteria ?? {},
        };
      })
    );

    // Most active restaurant
    const mostActive = [...restaurantMetrics].sort((a, b) => b.bookings - a.bookings)[0] ?? null;

    res.json({
      summary: {
        totalPilotRestaurants: pilotRestaurants.length,
        activeRestaurants: activeRestaurants.length,
        totalBookingsGenerated: pilotBookings.length,
        arrivedBookings: arrivedPilotBookings.length,
        estimatedRevenueImpact: estimatedRevenue,
        repeatCustomers,
        totalFeedbackItems: feedbackRows.length,
        activeCampaigns: campaigns.filter((c) => c.status === "sent").length,
        mostActiveRestaurant: mostActive?.name ?? null,
      },
      restaurants: restaurantMetrics,
      recentFeedback: feedbackRows.slice(0, 10).map((f) => ({
        id: f.id,
        restaurantId: f.restaurantId,
        rating: f.rating,
        message: f.message,
        category: f.category,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get pilot dashboard");
    res.status(500).json({ error: "Failed to get pilot dashboard" });
  }
});

export default router;
