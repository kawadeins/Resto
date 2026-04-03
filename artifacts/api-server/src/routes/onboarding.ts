import { Router } from "express";
import { db } from "@workspace/db";
import {
  restaurantsTable,
  menuItemsTable,
  employeesTable,
  discountsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const RESTAURANT_ID = 1;

// ─── Checklist computation ───────────────────────────────────────────────────
async function computeChecklist(restaurant: typeof restaurantsTable.$inferSelect) {
  const [menuCount, staffCount, discountCount] = await Promise.all([
    db.select().from(menuItemsTable).where(eq(menuItemsTable.isActive, true)),
    db.select().from(employeesTable),
    db.select().from(discountsTable),
  ]);

  const infoComplete =
    !!restaurant.name &&
    !!restaurant.cuisine &&
    !!restaurant.address &&
    !!restaurant.phone;

  const items = [
    {
      id: "restaurant_info",
      label: "Restaurant information",
      description: "Name, cuisine, address and phone number saved",
      completed: infoComplete,
      href: null,
      step: 1,
    },
    {
      id: "menu_item",
      label: "Add your first menu item",
      description: "At least one active menu item is required",
      completed: menuCount.length > 0,
      href: "/menu",
      step: 2,
    },
    {
      id: "staff",
      label: "Add a staff member",
      description: "Set up your team so you can assign shifts",
      completed: staffCount.length > 0,
      href: "/staff",
      step: 3,
    },
    {
      id: "bookings_enabled",
      label: "Enable online bookings",
      description: "Customers can book tables through the marketplace",
      completed: restaurant.bookingsEnabled,
      href: null,
      step: 4,
    },
    {
      id: "discount",
      label: "Create your first discount",
      description: "Flash deal or scheduled offer to attract customers",
      completed: discountCount.length > 0,
      href: "/marketing",
      step: 5,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const allComplete = completedCount === totalCount;

  return { items, completedCount, totalCount, progressPercent, allComplete };
}

// ─── GET /api/onboarding/status ──────────────────────────────────────────────
router.get("/status", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, RESTAURANT_ID));

    if (rows.length === 0) {
      return void res.status(404).json({ error: "Restaurant not found" });
    }

    const restaurant = rows[0];
    const checklist = await computeChecklist(restaurant);

    res.json({
      restaurantId: restaurant.id,
      onboardingCompleted: restaurant.onboardingCompleted,
      onboardingStep: restaurant.onboardingStep,
      bookingsEnabled: restaurant.bookingsEnabled,
      checklist: checklist.items,
      completedCount: checklist.completedCount,
      totalCount: checklist.totalCount,
      progressPercent: checklist.progressPercent,
      allChecklistComplete: checklist.allComplete,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get onboarding status");
    res.status(500).json({ error: "Failed to get onboarding status" });
  }
});

// ─── PATCH /api/onboarding/step ──────────────────────────────────────────────
router.patch("/step", async (req, res) => {
  try {
    const { step } = z.object({ step: z.number().int().min(0).max(6) }).parse(req.body);

    await db
      .update(restaurantsTable)
      .set({ onboardingStep: step })
      .where(eq(restaurantsTable.id, RESTAURANT_ID));

    const rows = await db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, RESTAURANT_ID));

    const restaurant = rows[0];
    const checklist = await computeChecklist(restaurant);

    res.json({
      restaurantId: restaurant.id,
      onboardingCompleted: restaurant.onboardingCompleted,
      onboardingStep: restaurant.onboardingStep,
      bookingsEnabled: restaurant.bookingsEnabled,
      checklist: checklist.items,
      completedCount: checklist.completedCount,
      totalCount: checklist.totalCount,
      progressPercent: checklist.progressPercent,
      allChecklistComplete: checklist.allComplete,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update onboarding step");
    res.status(500).json({ error: "Failed to update step" });
  }
});

// ─── POST /api/onboarding/enable-bookings ────────────────────────────────────
router.post("/enable-bookings", async (req, res) => {
  try {
    await db
      .update(restaurantsTable)
      .set({ bookingsEnabled: true })
      .where(eq(restaurantsTable.id, RESTAURANT_ID));

    const rows = await db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, RESTAURANT_ID));

    const restaurant = rows[0];
    res.json({
      id: restaurant.id,
      bookingsEnabled: restaurant.bookingsEnabled,
      onboardingCompleted: restaurant.onboardingCompleted,
      onboardingStep: restaurant.onboardingStep,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to enable bookings");
    res.status(500).json({ error: "Failed to enable bookings" });
  }
});

// ─── POST /api/onboarding/complete ───────────────────────────────────────────
router.post("/complete", async (req, res) => {
  try {
    await db
      .update(restaurantsTable)
      .set({ onboardingCompleted: true, onboardingStep: 6 })
      .where(eq(restaurantsTable.id, RESTAURANT_ID));

    const rows = await db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, RESTAURANT_ID));

    const restaurant = rows[0];
    const checklist = await computeChecklist(restaurant);

    res.json({
      restaurantId: restaurant.id,
      onboardingCompleted: restaurant.onboardingCompleted,
      onboardingStep: restaurant.onboardingStep,
      bookingsEnabled: restaurant.bookingsEnabled,
      checklist: checklist.items,
      completedCount: checklist.completedCount,
      totalCount: checklist.totalCount,
      progressPercent: checklist.progressPercent,
      allChecklistComplete: checklist.allComplete,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to complete onboarding");
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

// ─── GET /api/onboarding/restaurant ──────────────────────────────────────────
router.get("/restaurant", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, RESTAURANT_ID));

    if (rows.length === 0) return void res.status(404).json({ error: "Not found" });

    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      description: r.description ?? "",
      address: r.address,
      city: r.city,
      phone: r.phone ?? "",
      email: r.email ?? "",
      openTime: r.openTime,
      closeTime: r.closeTime,
      bookingsEnabled: r.bookingsEnabled,
      onboardingCompleted: r.onboardingCompleted,
      onboardingStep: r.onboardingStep,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get restaurant");
    res.status(500).json({ error: "Failed to get restaurant" });
  }
});

// ─── PATCH /api/onboarding/restaurant ────────────────────────────────────────
const UpdateRestaurantBody = z.object({
  name: z.string().min(1).optional(),
  cuisine: z.string().min(1).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
});

router.patch("/restaurant", async (req, res) => {
  try {
    const body = UpdateRestaurantBody.parse(req.body);

    await db
      .update(restaurantsTable)
      .set({ ...body })
      .where(eq(restaurantsTable.id, RESTAURANT_ID));

    const rows = await db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, RESTAURANT_ID));

    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      description: r.description ?? "",
      address: r.address,
      city: r.city,
      phone: r.phone ?? "",
      email: r.email ?? "",
      openTime: r.openTime,
      closeTime: r.closeTime,
      bookingsEnabled: r.bookingsEnabled,
      onboardingCompleted: r.onboardingCompleted,
      onboardingStep: r.onboardingStep,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update restaurant");
    res.status(500).json({ error: "Failed to update restaurant" });
  }
});

export default router;
