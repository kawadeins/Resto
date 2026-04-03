import { Router } from "express";
import { db } from "@workspace/db";
import {
  platformSettingsTable,
  restaurantsTable,
  subscriptionsTable,
  reservationsTable,
  reviewsTable,
  loyaltyPointsTable,
} from "@workspace/db";
import { eq, sql, count, avg, sum } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const SUPER_ADMIN_KEY = process.env["SUPER_ADMIN_KEY"] ?? "restosmart-super-2025";

// Simple header-based auth middleware for super-admin routes
function requireSuperAdmin(req: any, res: any, next: any) {
  const key = req.headers["x-super-admin-key"] ?? req.query.key;
  if (key !== SUPER_ADMIN_KEY) {
    return res.status(403).json({ error: "Forbidden: invalid super-admin key" });
  }
  next();
}

// ==================== Platform Settings ====================

// GET /api/platform/settings
router.get("/settings", async (req, res) => {
  try {
    const rows = await db.select().from(platformSettingsTable).orderBy(platformSettingsTable.category, platformSettingsTable.key);
    res.json(rows.map(s => ({
      id: s.id,
      key: s.key,
      value: s.value,
      label: s.label,
      description: s.description ?? "",
      category: s.category,
      updatedAt: s.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get platform settings");
    res.status(500).json({ error: "Failed to get platform settings" });
  }
});

const UpdateSettingBody = z.object({ value: z.string() });

// PATCH /api/platform/settings/:key
router.patch("/settings/:key", requireSuperAdmin, async (req, res) => {
  try {
    const { value } = UpdateSettingBody.parse(req.body);
    const [updated] = await db.update(platformSettingsTable)
      .set({ value, updatedAt: new Date() })
      .where(eq(platformSettingsTable.key, req.params.key))
      .returning();
    if (!updated) return void res.status(404).json({ error: "Setting not found" });
    res.json({ id: updated.id, key: updated.key, value: updated.value, label: updated.label, category: updated.category });
  } catch (err) {
    req.log.error({ err }, "Failed to update platform setting");
    res.status(500).json({ error: "Failed to update setting" });
  }
});

// ==================== Super Admin ====================

// GET /api/platform/super-admin/stats
router.get("/super-admin/stats", requireSuperAdmin, async (req, res) => {
  try {
    const [restaurantCount] = await db.select({ count: count() }).from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
    const [totalRestaurants] = await db.select({ count: count() }).from(restaurantsTable);
    const [bookingCount] = await db.select({ count: count() }).from(reservationsTable);
    const [reviewCount] = await db.select({ count: count() }).from(reviewsTable);
    const [avgRating] = await db.select({ avg: avg(reviewsTable.rating) }).from(reviewsTable);
    const [loyaltyCount] = await db.select({ count: count() }).from(loyaltyPointsTable);
    const [totalPoints] = await db.select({ total: sum(loyaltyPointsTable.totalEarned) }).from(loyaltyPointsTable);

    const subs = await db.select().from(subscriptionsTable);
    const activeSubs = subs.filter(s => s.status === "active").length;
    const trialSubs = subs.filter(s => s.status === "trial").length;
    const monthlyRevenue = activeSubs * 30;

    res.json({
      restaurants: {
        active: Number(restaurantCount.count),
        total: Number(totalRestaurants.count),
      },
      subscriptions: {
        active: activeSubs,
        trial: trialSubs,
        inactive: subs.length - activeSubs - trialSubs,
        monthlyRevenueEur: monthlyRevenue,
        annualRevenueEur: monthlyRevenue * 12,
      },
      bookings: { total: Number(bookingCount.count) },
      reviews: {
        total: Number(reviewCount.count),
        averageRating: avgRating.avg ? parseFloat(avgRating.avg) : null,
      },
      loyalty: {
        totalMembers: Number(loyaltyCount.count),
        totalPointsEarned: Number(totalPoints.total ?? 0),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get super-admin stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/platform/super-admin/restaurants
router.get("/super-admin/restaurants", requireSuperAdmin, async (req, res) => {
  try {
    const restaurants = await db.select().from(restaurantsTable).orderBy(restaurantsTable.id);
    const subs = await db.select().from(subscriptionsTable);
    const bookings = await db.select({ restaurantId: sql<number>`1`, total: count() }).from(reservationsTable);
    const reviews = await db.select({ total: count(), avgRating: avg(reviewsTable.rating) }).from(reviewsTable);

    const subMap = new Map(subs.map(s => [s.restaurantId, s]));
    const totalBookings = Number(bookings[0]?.total ?? 0);
    const totalReviews = Number(reviews[0]?.total ?? 0);
    const avgRating = reviews[0]?.avgRating ? parseFloat(reviews[0].avgRating) : null;

    res.json(restaurants.map(r => {
      const sub = subMap.get(r.id);
      return {
        id: r.id,
        name: r.name,
        cuisine: r.cuisine,
        city: r.city,
        isActive: r.isActive,
        isFeatured: r.isFeatured,
        rating: parseFloat(r.rating),
        subscription: sub ? {
          status: sub.status,
          planName: sub.planName,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        } : null,
        bookingCount: r.id === 1 ? totalBookings : 0,
        reviewCount: r.id === 1 ? totalReviews : 0,
        avgRating: r.id === 1 ? avgRating : null,
        createdAt: r.createdAt.toISOString(),
      };
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to get super-admin restaurants");
    res.status(500).json({ error: "Failed to get restaurants" });
  }
});

const UpdateRestaurantBody = z.object({
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

// PATCH /api/platform/super-admin/restaurants/:id
router.patch("/super-admin/restaurants/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateRestaurantBody.parse(req.body);
    const updates: Partial<typeof restaurantsTable.$inferInsert> = {};
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.isFeatured !== undefined) updates.isFeatured = body.isFeatured;
    const [updated] = await db.update(restaurantsTable).set(updates).where(eq(restaurantsTable.id, id)).returning();
    if (!updated) return void res.status(404).json({ error: "Restaurant not found" });
    res.json({ id: updated.id, name: updated.name, isActive: updated.isActive, isFeatured: updated.isFeatured });
  } catch (err) {
    req.log.error({ err }, "Failed to update restaurant");
    res.status(500).json({ error: "Failed to update restaurant" });
  }
});

export default router;
