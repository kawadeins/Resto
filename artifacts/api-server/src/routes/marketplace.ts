import { Router } from "express";
import { db } from "@workspace/db";
import { restaurantsTable, discountsTable, menuItemsTable, reservationsTable } from "@workspace/db";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { sendBookingConfirmation } from "../services/email";
import { computeLiveAvailability, buildSlots } from "../lib/availability";

const router = Router();

function isOpen(r: typeof restaurantsTable.$inferSelect): boolean {
  const now = new Date();
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
  if (!r.openDays.includes(day)) return false;
  const [openH, openM] = r.openTime.split(":").map(Number);
  const [closeH, closeM] = r.closeTime.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= openH * 60 + openM && nowMin <= closeH * 60 + closeM;
}

async function getActiveFlash() {
  const now = new Date();
  const deals = await db.select().from(discountsTable);
  return deals.find(
    (d) =>
      d.type === "flash" &&
      d.enabled &&
      d.flashExpiresAt != null &&
      new Date(d.flashExpiresAt) > now
  ) ?? null;
}

type AvailInfo = { status: string; availableSeats: number; nextAvailableSlot: string | null };

function mapRestaurant(
  r: typeof restaurantsTable.$inferSelect,
  flashDeal: typeof discountsTable.$inferSelect | null,
  avail?: AvailInfo,
  boostInfo?: BoostInfo
) {
  const now = new Date();
  const open = isOpen(r);
  const hasFlash = flashDeal != null;
  const minutesRemaining = hasFlash && flashDeal.flashExpiresAt
    ? Math.max(0, Math.round((new Date(flashDeal.flashExpiresAt).getTime() - now.getTime()) / 60000))
    : null;

  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    cuisineEmoji: r.cuisineEmoji,
    description: r.description ?? "",
    address: r.address,
    city: r.city,
    phone: r.phone ?? "",
    email: r.email ?? "",
    heroImage: r.heroImage
      ? r.heroImage.startsWith("/uploads/")
        ? `/api/uploads/${r.heroImage.slice("/uploads/".length)}`
        : r.heroImage
      : null,
    about: r.about ?? "",
    photos: (r.photos ?? []).map((p: string) =>
      p.startsWith("/uploads/") ? `/api/uploads/${p.slice("/uploads/".length)}` : p
    ),
    videoUrl: r.videoUrl ?? "",
    instagram: r.instagram ?? "",
    facebook: r.facebook ?? "",
    tiktok: r.tiktok ?? "",
    website: r.website ?? "",
    googleMapsUrl: r.googleMapsUrl ?? "",
    rating: parseFloat(r.rating),
    reviewCount: r.reviewCount,
    priceRange: r.priceRange,
    openTime: r.openTime,
    closeTime: r.closeTime,
    openDays: r.openDays,
    tags: r.tags,
    lat: r.lat ? parseFloat(r.lat) : 48.2093,
    lng: r.lng ? parseFloat(r.lng) : 16.3726,
    isActive: r.isActive,
    isFeatured: r.isFeatured,
    isPartner: r.isPartner,
    isOpenNow: open,
    hasActiveFlash: hasFlash,
    flashPercentage: hasFlash ? parseFloat(flashDeal!.percentage) : null,
    flashLabel: hasFlash ? flashDeal!.label : null,
    flashMinutesRemaining: hasFlash ? minutesRemaining : null,
    // Availability engine
    availabilityStatus: avail?.status ?? (open ? "available" : "closed"),
    availableSeats: avail?.availableSeats ?? null,
    nextAvailableSlot: avail?.nextAvailableSlot ?? null,
    tableCapacity: r.tableCapacity ?? 20,
    seatingCapacity: r.seatingCapacity ?? 80,
    slotDurationMinutes: r.slotDurationMinutes ?? 90,
    maxPartySize: r.maxPartySize ?? 8,
    walkInsEnabled: r.walkInsEnabled ?? true,
    businessType: r.businessType ?? "restaurant",
    hasActiveBoost: (boostInfo?.types?.length ?? 0) > 0,
    activeBoostType: boostInfo?.types?.[0] ?? null,
    boostDailyBudget: boostInfo?.dailyBudget ?? 0,
    boostBudgetRemaining: boostInfo?.budgetRemaining ?? null,
    boostSpentToday: boostInfo?.spentToday ?? 0,
  };
}

async function getTodayReservations() {
  const today = new Date().toISOString().split("T")[0];
  return db.select({
    time: reservationsTable.time,
    partySize: reservationsTable.partySize,
    status: reservationsTable.status,
  }).from(reservationsTable).where(eq(reservationsTable.date, today));
}

// ─── Active promotion boosts (for ethical relevance-aware visibility) ─────────

const BOOST_HOURS: Record<string, [number, number]> = {
  breakfast_boost:  [6, 10],
  lunch_boost:      [11, 14],
  happy_hour_boost: [15, 19],
  nightlife_boost:  [19, 26], // 26 = 2am next day
  local_spotlight:  [0, 24],
  local_heat_boost: [0, 24],
};

function isBoostTimeActive(type: string, hour: number): boolean {
  const [s, e] = BOOST_HOURS[type] ?? [0, 24];
  if (e > 24) return hour >= s || hour <= (e - 24);
  return hour >= s && hour <= e;
}

interface BoostInfo {
  types: string[];
  budgetRemaining: number | null; // null = unlimited (no budget set)
  dailyBudget: number;
  spentToday: number;
}

async function getActiveBoostMap(): Promise<Map<number, BoostInfo>> {
  try {
    const rows = await db.execute(sql`
      SELECT restaurant_id, type, daily_budget, spent_today, budget_reset_date
      FROM promotions
      WHERE status = 'active' AND (ends_at IS NULL OR ends_at > NOW())
    `);
    const map = new Map<number, BoostInfo>();
    const hour = new Date().getHours();
    const today = new Date().toISOString().split("T")[0];
    for (const row of rows.rows as {
      restaurant_id: number;
      type: string;
      daily_budget: string;
      spent_today: string;
      budget_reset_date: string;
    }[]) {
      if (!isBoostTimeActive(row.type, hour)) continue;

      // Auto-reset daily spend if it's a new day
      const lastReset = (row.budget_reset_date ?? "").toString().slice(0, 10);
      const spentToday = lastReset < today ? 0 : parseFloat(row.spent_today ?? "0");
      const dailyBudget = parseFloat(row.daily_budget ?? "0");

      // Budget check: 0 means no budget cap (unlimited)
      const budgetRemaining = dailyBudget > 0
        ? Math.max(0, dailyBudget - spentToday)
        : null;

      const existing = map.get(row.restaurant_id);
      if (existing) {
        existing.types.push(row.type);
      } else {
        map.set(row.restaurant_id, {
          types: [row.type],
          budgetRemaining,
          dailyBudget,
          spentToday,
        });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

router.get("/restaurants", async (req, res) => {
  try {
    const { cuisine, priceRange, rating, openNow, search, featured, businessType } = req.query as Record<string, string>;
    const [flash, todayRes, boostMap] = await Promise.all([
      getActiveFlash(),
      getTodayReservations(),
      getActiveBoostMap(),
    ]);

    let rows = await db.select().from(restaurantsTable).where(eq(restaurantsTable.isActive, true));

    if (cuisine && cuisine !== "all") {
      rows = rows.filter((r) => r.cuisine.toLowerCase() === cuisine.toLowerCase());
    }
    if (priceRange) {
      const pr = parseInt(priceRange);
      rows = rows.filter((r) => r.priceRange <= pr);
    }
    if (rating) {
      const minRating = parseFloat(rating);
      rows = rows.filter((r) => parseFloat(r.rating) >= minRating);
    }
    if (openNow === "true") {
      rows = rows.filter((r) => isOpen(r));
    }
    if (featured === "true") {
      rows = rows.filter((r) => r.isFeatured);
    }
    if (businessType && businessType !== "all") {
      rows = rows.filter((r) => (r.businessType ?? "restaurant") === businessType);
    }
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.cuisine.toLowerCase().includes(s) ||
          (r.description ?? "").toLowerCase().includes(s) ||
          r.tags.some((t) => t.toLowerCase().includes(s))
      );
    }

    const mapped = rows.map((r) => {
      const open = isOpen(r);
      const avail = computeLiveAvailability(
        {
          isOpenNow: open,
          seatingCapacity: r.seatingCapacity ?? 80,
          slotDurationMinutes: r.slotDurationMinutes ?? 90,
          availabilityPaused: r.availabilityPaused ?? false,
          availabilityPausedUntil: r.availabilityPausedUntil ?? null,
          openTime: r.openTime,
          closeTime: r.closeTime,
        },
        todayRes
      );
      return mapRestaurant(r, flash, avail, boostMap.get(r.id));
    });

    // Fair weighted sort: relevance (rating) first, boost as secondary uplift only.
    // Budget-exhausted boosts have no effect on ordering. Rule 4.
    mapped.sort((a, b) => {
      const aHasBudgetedBoost = a.hasActiveBoost &&
        ((a as any).boostBudgetRemaining === null || (a as any).boostBudgetRemaining > 0);
      const bHasBudgetedBoost = b.hasActiveBoost &&
        ((b as any).boostBudgetRemaining === null || (b as any).boostBudgetRemaining > 0);
      const aScore = parseFloat(String(a.rating)) * 0.7 + (aHasBudgetedBoost ? 1.5 : 0);
      const bScore = parseFloat(String(b.rating)) * 0.7 + (bHasBudgetedBoost ? 1.5 : 0);
      return bScore - aScore;
    });

    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Failed to list restaurants");
    res.status(500).json({ error: "Failed to list restaurants" });
  }
});

router.get("/restaurants/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const flash = await getActiveFlash();
    const rows = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
    if (rows.length === 0) return void res.status(404).json({ error: "Not found" });
    const r = rows[0];

    const todayRes = await getTodayReservations();
    const open = isOpen(r);
    const avail = computeLiveAvailability(
      {
        isOpenNow: open,
        seatingCapacity: r.seatingCapacity ?? 80,
        slotDurationMinutes: r.slotDurationMinutes ?? 90,
        availabilityPaused: r.availabilityPaused ?? false,
        availabilityPausedUntil: r.availabilityPausedUntil ?? null,
        openTime: r.openTime,
        closeTime: r.closeTime,
      },
      todayRes
    );

    const restaurant = mapRestaurant(r, flash, avail);

    const menuItems = await db
      .select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.isActive, true));

    res.json({
      ...restaurant,
      menu: menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description ?? "",
        category: m.category,
        price: parseFloat(m.sellingPrice),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get restaurant");
    res.status(500).json({ error: "Failed to get restaurant" });
  }
});

// GET /api/marketplace/slots?restaurantId=1&date=YYYY-MM-DD
router.get("/slots", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const date = (req.query.date as string) ?? new Date().toISOString().split("T")[0];

    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
    if (!r) return void res.status(404).json({ error: "Restaurant not found" });

    const dayReservations = await db.select({
      time: reservationsTable.time,
      partySize: reservationsTable.partySize,
      status: reservationsTable.status,
    }).from(reservationsTable).where(eq(reservationsTable.date, date));

    const slots = buildSlots(
      r.openTime,
      r.closeTime,
      r.slotDurationMinutes ?? 90,
      r.seatingCapacity ?? 80,
      dayReservations
    );

    res.json({
      date,
      restaurantId,
      openTime: r.openTime,
      closeTime: r.closeTime,
      seatingCapacity: r.seatingCapacity ?? 80,
      slotDurationMinutes: r.slotDurationMinutes ?? 90,
      maxPartySize: r.maxPartySize ?? 8,
      walkInsEnabled: r.walkInsEnabled ?? true,
      slots,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get slots");
    res.status(500).json({ error: "Failed to get slot availability" });
  }
});

router.get("/flash-deals", async (req, res) => {
  try {
    const now = new Date();
    const deals = await db.select().from(discountsTable);
    const active = deals.filter(
      (d) =>
        d.type === "flash" &&
        d.enabled &&
        d.flashExpiresAt != null &&
        new Date(d.flashExpiresAt) > now
    );

    const restaurants = await db.select().from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
    const restaurantMap = new Map(restaurants.map(r => [r.id, r]));
    // Prefer featured/partner restaurants for global flash deals
    const defaultRestaurant = restaurants.find(r => r.isFeatured) ?? restaurants.find(r => r.isPartner) ?? restaurants[0];

    res.json(
      active.map((d) => {
        const dealRestaurant = defaultRestaurant;
        return {
          id: d.id,
          label: d.label,
          percentage: parseFloat(d.percentage),
          flashExpiresAt: d.flashExpiresAt?.toISOString() ?? null,
          minutesRemaining: d.flashExpiresAt
            ? Math.max(0, Math.round((new Date(d.flashExpiresAt).getTime() - now.getTime()) / 60000))
            : null,
          restaurant: dealRestaurant
            ? {
                id: dealRestaurant.id,
                name: dealRestaurant.name,
                cuisine: dealRestaurant.cuisine,
                cuisineEmoji: dealRestaurant.cuisineEmoji,
                heroImage: dealRestaurant.heroImage
                  ? dealRestaurant.heroImage.startsWith("/uploads/")
                    ? `/api/uploads/${dealRestaurant.heroImage.slice("/uploads/".length)}`
                    : dealRestaurant.heroImage
                  : null,
              }
            : null,
        };
      })
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get flash deals");
    res.status(500).json({ error: "Failed to get flash deals" });
  }
});

const CreateBookingBody = z.object({
  customerName: z.string().min(1).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(1).max(30),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.number().int().min(1).max(20),
  notes: z.string().max(500).optional(),
  restaurantId: z.number().int().positive().optional(),
});

router.post("/bookings", async (req, res) => {
  try {
    const parsed = CreateBookingBody.safeParse(req.body);
    if (!parsed.success) {
      return void res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;

    const restaurantId = body.restaurantId ?? 1;
    const [restaurant] = await db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, restaurantId));

    if (!restaurant) {
      return void res.status(404).json({ error: "Restaurant not found" });
    }
    if (!restaurant.bookingsEnabled) {
      return void res.status(403).json({ error: "This restaurant is not currently accepting online bookings" });
    }

    // Check if availability is paused
    if (restaurant.availabilityPaused) {
      const until = restaurant.availabilityPausedUntil;
      if (!until || until > new Date()) {
        return void res.status(409).json({ error: "The restaurant is temporarily not accepting new bookings right now. Please try again later or call us." });
      }
    }

    // Deduplication: prevent double-booking within 60 seconds for same slot
    const existing = await db.select({ id: reservationsTable.id })
      .from(reservationsTable)
      .where(
        and(
          eq(reservationsTable.customerEmail, body.customerEmail),
          eq(reservationsTable.restaurantId, restaurantId),
          eq(reservationsTable.date, body.date),
          eq(reservationsTable.time, body.time),
          gte(reservationsTable.createdAt, new Date(Date.now() - 60_000)),
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return void res.status(409).json({ error: "Eine Buchung für diesen Zeitraum existiert bereits." });
    }

    const [created] = await db.insert(reservationsTable).values({
      restaurantId,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      date: body.date,
      time: body.time,
      partySize: body.partySize,
      notes: body.notes ?? null,
      status: "pending",
      source: "customer",
    }).returning();

    // Non-blocking email confirmation
    try {
      await sendBookingConfirmation({
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        date: body.date,
        time: body.time,
        partySize: body.partySize,
        restaurantName: restaurant.name,
      });
    } catch {}

    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create customer booking");
    res.status(500).json({ error: "Failed to create booking" });
  }
});

router.get("/my-bookings", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) return void res.status(400).json({ error: "email query param required" });

    const bookings = await db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.customerEmail, email))
      .orderBy(sql`${reservationsTable.date} desc, ${reservationsTable.time} desc`);

    // Fetch all restaurants to map against booking restaurantIds
    const restaurantRows = await db.select().from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
    const restaurantMap = new Map(restaurantRows.map(r => [r.id, r]));

    res.json(
      bookings.map((b) => {
        const rid = b.restaurantId ?? 1;
        const r = restaurantMap.get(rid) ?? restaurantRows[0];
        return {
          id: b.id,
          restaurantId: rid,
          customerName: b.customerName,
          customerEmail: b.customerEmail,
          customerPhone: b.customerPhone,
          date: b.date,
          time: b.time,
          partySize: b.partySize,
          status: b.status,
          notes: b.notes,
          source: b.source,
          createdAt: b.createdAt.toISOString(),
          restaurant: r ? {
            id: r.id,
            name: r.name,
            cuisine: r.cuisine,
            cuisineEmoji: r.cuisineEmoji,
            heroImage: r.heroImage
              ? r.heroImage.startsWith("/uploads/")
                ? `/api/uploads/${r.heroImage.slice("/uploads/".length)}`
                : r.heroImage
              : null,
            address: r.address,
          } : null,
        };
      })
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get customer bookings");
    res.status(500).json({ error: "Failed to get bookings" });
  }
});

// PATCH /api/marketplace/bookings/:id/cancel — customer self-cancel
router.patch("/bookings/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { email } = req.body as { email: string };
    if (!email) return void res.status(400).json({ error: "email required" });

    const [booking] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, id));
    if (!booking) return void res.status(404).json({ error: "Booking not found" });
    if (booking.customerEmail !== email) return void res.status(403).json({ error: "Not your booking" });
    if (["cancelled", "rejected", "completed"].includes(booking.status)) {
      return void res.status(409).json({ error: "Booking cannot be cancelled in its current state" });
    }

    const [updated] = await db
      .update(reservationsTable)
      .set({ status: "cancelled" })
      .where(eq(reservationsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to cancel booking");
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

export default router;
